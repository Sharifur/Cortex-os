import { Injectable, NotFoundException } from '@nestjs/common';
import { eq, desc } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { agents, agentRuns } from '../../db/schema';
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
        ...(dto.config !== undefined && { config: dto.config }),
        updatedAt: new Date(),
      })
      .where(eq(agents.key, key))
      .returning();

    return updated;
  }

  async trigger(key: string, dto: TriggerAgentDto) {
    return this.runtime.triggerAgent(key, dto.triggerType ?? 'MANUAL', dto.payload);
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
}
