import { Injectable, NotFoundException } from '@nestjs/common';
import { eq, desc, and, sql, inArray } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { agents, agentRuns, agentConversations, pendingApprovals, agentLogs } from '../../db/schema';
import { AgentRuntimeService } from './runtime/agent-runtime.service';
import { AgentRegistryService } from './runtime/agent-registry.service';
import type { UpdateAgentDto } from './dto/update-agent.dto';
import type { TriggerAgentDto } from './dto/trigger-agent.dto';

@Injectable()
export class AgentsService {
  constructor(
    private db: DbService,
    private runtime: AgentRuntimeService,
    private registry: AgentRegistryService,
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
}
