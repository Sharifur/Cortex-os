import { Injectable, NotFoundException } from '@nestjs/common';
import { eq, desc, and, sql, inArray } from 'drizzle-orm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DbService } from '../../db/db.service';
import { agents, agentRuns, agentConversations, pendingApprovals, agentLogs } from '../../db/schema';
import { AgentRuntimeService } from './runtime/agent-runtime.service';
import { AgentRegistryService } from './runtime/agent-registry.service';
import { CorrectionCaptureService } from './runtime/correction-capture.service';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';
import { LlmRouterService } from '../llm/llm-router.service';
import type { UpdateAgentDto } from './dto/update-agent.dto';
import type { TriggerAgentDto } from './dto/trigger-agent.dto';

@Injectable()
export class AgentsService {
  constructor(
    private db: DbService,
    private runtime: AgentRuntimeService,
    private registry: AgentRegistryService,
    private events: EventEmitter2,
    private capture: CorrectionCaptureService,
    private kb: KnowledgeBaseService,
    private llm: LlmRouterService,
  ) {}

  async findAll() {
    const rows = await this.db.db.select().from(agents);
    return rows.map((a) => ({
      ...a,
      registered: this.registry.has(a.key),
    }));
  }

  async findByKey(key: string) {
    const [agent] = await this.db.db
      .select()
      .from(agents)
      .where(eq(agents.key, key));

    if (!agent) throw new NotFoundException(`Agent not found: ${key}`);

    const registered = this.registry.get(key);
    return {
      ...agent,
      registered: !!registered,
      triggers: registered?.triggers() ?? [],
      mcpTools: registered?.mcpTools().map((t) => ({ name: t.name, description: t.description })) ?? [],
      apiRoutes: registered?.apiRoutes().map((r) => ({ method: r.method, path: r.path })) ?? [],
    };
  }

  async update(key: string, dto: UpdateAgentDto) {
    const [agent] = await this.db.db
      .select()
      .from(agents)
      .where(eq(agents.key, key));

    if (!agent) throw new NotFoundException(`Agent not found: ${key}`);

    const [updated] = await this.db.db
      .update(agents)
      .set({
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.enabled !== undefined && { enabled: dto.enabled }),
        ...(dto.pinned !== undefined && { pinned: dto.pinned }),
        ...(dto.config !== undefined && { config: dto.config }),
        updatedAt: new Date(),
      })
      .where(eq(agents.key, key))
      .returning();

    return updated;
  }

  async trigger(key: string, dto: TriggerAgentDto) {
    return this.runtime.triggerAgent(key, dto.triggerType ?? 'MANUAL', dto.payload, dto.delayMs);
  }

  async getConversation(agentKey: string, conversationId: string) {
    return this.db.db
      .select()
      .from(agentConversations)
      .where(
        and(
          eq(agentConversations.agentKey, agentKey),
          eq(agentConversations.conversationId, conversationId),
        ),
      )
      .orderBy(agentConversations.createdAt);
  }

  async listConversations(agentKey: string) {
    const rows = await this.db.db.execute(sql`
      SELECT
        conversation_id   AS "conversationId",
        MIN(created_at)   AS "startedAt",
        MAX(created_at)   AS "lastActivityAt",
        COUNT(*)::int     AS "messageCount",
        (
          SELECT content
          FROM agent_conversations ac2
          WHERE ac2.conversation_id = agent_conversations.conversation_id
            AND ac2.agent_key = ${agentKey}
            AND ac2.role = 'user'
          ORDER BY ac2.created_at
          LIMIT 1
        ) AS "preview"
      FROM agent_conversations
      WHERE agent_key = ${agentKey}
      GROUP BY conversation_id
      ORDER BY MAX(created_at) DESC
      LIMIT 50
    `);
    return rows;
  }

  async submitFeedback(data: {
    agentKey: string;
    agentName: string;
    rating: 'up' | 'down';
    agentMessage: string;
    userQuery?: string;
  }) {
    if (data.rating === 'down') {
      this.events.emit('kb.rejection', {
        agentKey: data.agentKey,
        agentName: data.agentName,
        draft: data.agentMessage,
        reason: data.userQuery
          ? `User marked as unhelpful. Original query: "${data.userQuery.slice(0, 200)}"`
          : 'User marked this response as unhelpful in chat.',
      });
    }
    return { ok: true };
  }

  async saveConversationMessage(data: {
    agentKey: string;
    conversationId: string;
    role: string;
    content: string;
    runId?: string;
    requiresApproval?: boolean;
  }) {
    const [row] = await this.db.db
      .insert(agentConversations)
      .values({
        agentKey: data.agentKey,
        conversationId: data.conversationId,
        role: data.role,
        content: data.content,
        runId: data.runId ?? null,
        requiresApproval: data.requiresApproval ?? false,
      })
      .returning();
    return row;
  }

  async getRuns(key: string, limit = 20) {
    const [agent] = await this.db.db
      .select()
      .from(agents)
      .where(eq(agents.key, key));

    if (!agent) throw new NotFoundException(`Agent not found: ${key}`);

    return this.db.db
      .select()
      .from(agentRuns)
      .where(eq(agentRuns.agentId, agent.id))
      .orderBy(desc(agentRuns.startedAt))
      .limit(limit);
  }

  async delete(key: string) {
    const [agent] = await this.db.db
      .select()
      .from(agents)
      .where(eq(agents.key, key));

    if (!agent) throw new NotFoundException(`Agent not found: ${key}`);

    const runs = await this.db.db
      .select({ id: agentRuns.id })
      .from(agentRuns)
      .where(eq(agentRuns.agentId, agent.id));

    if (runs.length > 0) {
      const runIds = runs.map((r) => r.id);
      await this.db.db.delete(pendingApprovals).where(inArray(pendingApprovals.runId, runIds));
      await this.db.db.delete(agentLogs).where(inArray(agentLogs.runId, runIds));
      await this.db.db.delete(agentRuns).where(eq(agentRuns.agentId, agent.id));
    }

    await this.db.db.delete(agentConversations).where(eq(agentConversations.agentKey, key));
    await this.db.db.delete(agents).where(eq(agents.key, key));
    return { deleted: true, key };
  }

  async simulate(agentKey: string, message: string, siteKey?: string) {
    const [alwaysOn, samples, blocklist, rejections, references] = await Promise.all([
      this.kb.getAlwaysOnContext(agentKey, siteKey),
      this.kb.getWritingSamples(agentKey, siteKey),
      this.kb.getBlocklistRules(agentKey, siteKey),
      this.kb.getRecentRejections(agentKey, 3),
      this.kb.searchEntries(message, agentKey, 8, siteKey),
    ]);

    const kbBlock = this.kb.buildKbPromptBlock({
      voiceProfile: alwaysOn.find((e) => e.entryType === 'voice_profile') ?? null,
      facts: alwaysOn.filter((e) => e.entryType === 'fact'),
      catalog: alwaysOn.filter((e) => ['product', 'service', 'offer', 'product_qa'].includes(e.entryType)),
      references,
      positiveSamples: samples.filter((s) => s.polarity === 'positive'),
      negativeSamples: samples.filter((s) => s.polarity === 'negative'),
      rejections,
    });

    const systemPrompt = [
      `You are a helpful assistant for ${agentKey}. Answer the visitor's question using the knowledge provided below.`,
      `If the answer is not covered by the knowledge base, say clearly that you don't have that information — do NOT make things up.`,
      `Be concise and direct. No greetings, no sign-offs.`,
      ``,
      kbBlock,
    ].join('\n');

    const response = await this.llm.complete({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      provider: 'auto',
      model: 'gpt-4o-mini',
      maxTokens: 600,
      temperature: 0.3,
    });

    return {
      response: response.content,
      kbBlock,
      matchedEntries: references.map((e) => ({ id: e.id, title: e.title, entryType: e.entryType })),
      alwaysOnCount: alwaysOn.length,
      blocklistCount: blocklist.length,
    };
  }

  async rateSimulate(agentKey: string, rating: 'good' | 'bad', message: string, response: string) {
    await this.capture.captureSimulateRating(agentKey, rating, message, response);
    return { ok: true };
  }
}
