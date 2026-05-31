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
    const trace: Array<{ step: string; label: string; detail: string; durationMs: number }> = [];
    const t = (step: string, label: string, detail: string, ms: number) =>
      trace.push({ step, label, detail, durationMs: ms });

    // Step 1: always-on context
    let t0 = Date.now();
    const alwaysOn = await this.kb.getAlwaysOnContext(agentKey, siteKey);
    const voiceProfile = alwaysOn.find((e) => e.entryType === 'voice_profile');
    const facts = alwaysOn.filter((e) => e.entryType === 'fact');
    const catalog = alwaysOn.filter((e) => ['product', 'service', 'offer', 'product_qa'].includes(e.entryType));
    const alwaysOnTypeMap: Record<string, number> = {};
    for (const e of alwaysOn) alwaysOnTypeMap[e.entryType] = (alwaysOnTypeMap[e.entryType] ?? 0) + 1;
    const alwaysOnSummary = Object.entries(alwaysOnTypeMap).map(([k, v]) => `${k}×${v}`).join(', ') || 'none';
    t('always_on', 'Always-on context loaded', `${alwaysOn.length} entries: ${alwaysOnSummary}`, Date.now() - t0);

    // Step 2: writing samples + blocklist + rejections
    t0 = Date.now();
    const [samples, blocklist, rejections] = await Promise.all([
      this.kb.getWritingSamples(agentKey, siteKey),
      this.kb.getBlocklistRules(agentKey, siteKey),
      this.kb.getRecentRejections(agentKey, 3),
    ]);
    const pos = samples.filter((s) => s.polarity === 'positive').length;
    const neg = samples.filter((s) => s.polarity === 'negative').length;
    t('samples', 'Writing samples + blocklist loaded',
      `${pos} positive sample${pos !== 1 ? 's' : ''}, ${neg} negative · ${blocklist.length} blocklist rule${blocklist.length !== 1 ? 's' : ''} · ${rejections.length} recent rejection${rejections.length !== 1 ? 's' : ''}`,
      Date.now() - t0);

    // Step 3: KB search
    t0 = Date.now();
    const references = await this.kb.searchEntries(message, agentKey, 8, siteKey);
    const refTypes: Record<string, number> = {};
    for (const r of references) refTypes[r.entryType] = (refTypes[r.entryType] ?? 0) + 1;
    const refSummary = references.length
      ? Object.entries(refTypes).map(([k, v]) => `${k}×${v}`).join(', ')
      : 'no matches';
    t('kb_search', 'KB semantic search',
      `Query: "${message.slice(0, 60)}${message.length > 60 ? '…' : ''}" → ${references.length} result${references.length !== 1 ? 's' : ''} (${refSummary})`,
      Date.now() - t0);

    // Step 4: build prompt block
    t0 = Date.now();
    const kbBlock = this.kb.buildKbPromptBlock({
      voiceProfile: voiceProfile ?? null,
      facts,
      catalog,
      references,
      positiveSamples: samples.filter((s) => s.polarity === 'positive'),
      negativeSamples: samples.filter((s) => s.polarity === 'negative'),
      rejections,
    });
    const kbTokenEstimate = Math.round(kbBlock.length / 4);
    t('kb_block', 'KB prompt block assembled',
      `~${kbTokenEstimate} tokens · voice profile: ${voiceProfile ? 'yes' : 'no'} · facts: ${facts.length} · catalog: ${catalog.length} · references: ${references.length}`,
      Date.now() - t0);

    // Step 5: coverage check
    const hasProductCatalog = catalog.length > 0;
    const hasReferences = references.length > 0;
    if (!hasProductCatalog && !hasReferences) {
      t('coverage_gate', 'Coverage gate',
        'No product catalog and no reference matches found — in production this would escalate to human. Continuing for simulation.',
        0);
    } else {
      t('coverage_gate', 'Coverage gate passed',
        `Product catalog: ${hasProductCatalog ? 'yes' : 'no'} · reference matches: ${hasReferences ? 'yes' : 'no'} — proceeding to LLM`,
        0);
    }

    // Step 6: LLM call
    const systemPrompt = [
      `You are a helpful assistant for ${agentKey}. Answer the visitor's question using the knowledge provided below.`,
      `If the answer is not covered by the knowledge base, say clearly that you don't have that information — do NOT make things up.`,
      `Be concise and direct. No greetings, no sign-offs.`,
      ``,
      kbBlock,
    ].join('\n');

    t0 = Date.now();
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
    const responseTokens = Math.round(response.content.length / 4);
    t('llm', 'LLM response generated',
      `Model: gpt-4o-mini · ~${responseTokens} output tokens · system prompt ~${Math.round(systemPrompt.length / 4)} tokens`,
      Date.now() - t0);

    return {
      response: response.content,
      trace,
      kbBlock,
      matchedEntries: references.map((e) => ({
        id: e.id,
        title: e.title,
        entryType: e.entryType,
        preview: (e.content ?? '').slice(0, 120),
        priority: e.priority,
      })),
      alwaysOnEntries: alwaysOn.map((e) => ({ title: e.title, entryType: e.entryType })),
      alwaysOnCount: alwaysOn.length,
      blocklistCount: blocklist.length,
      kbTokenEstimate,
    };
  }

  async rateSimulate(agentKey: string, rating: 'good' | 'bad', message: string, response: string) {
    await this.capture.captureSimulateRating(agentKey, rating, message, response);
    return { ok: true };
  }
}
