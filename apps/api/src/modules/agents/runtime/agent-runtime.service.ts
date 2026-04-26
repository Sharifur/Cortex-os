import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { eq } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { agents, agentRuns } from '../../../db/schema';
import { AgentRegistryService } from './agent-registry.service';
import { QUEUE_NAMES } from '../../../common/queue/queue.constants';
import type { TriggerType, AgentRunJobData } from './types';

@Injectable()
export class AgentRuntimeService {
  constructor(
    private db: DbService,
    private registry: AgentRegistryService,
    @InjectQueue(QUEUE_NAMES.AGENT_RUN) private agentRunQueue: Queue,
  ) {}

  async triggerAgent(
    agentKey: string,
    triggerType: TriggerType,
    payload?: unknown,
  ) {
    const agent = this.registry.get(agentKey);
    if (!agent) throw new NotFoundException(`Agent not found: ${agentKey}`);

    const [agentRecord] = await this.db.db
      .select()
      .from(agents)
      .where(eq(agents.key, agentKey));

    if (!agentRecord) {
      throw new NotFoundException(`Agent not in DB: ${agentKey}`);
    }

    if (!agentRecord.enabled) {
      throw new Error(`Agent is disabled: ${agentKey}`);
    }

    const [run] = await this.db.db
      .insert(agentRuns)
      .values({
        agentId: agentRecord.id,
        triggerType,
        triggerPayload: payload ?? null,
        status: 'PENDING',
      })
      .returning();

    await this.agentRunQueue.add(
      'run',
      { agentKey, runId: run.id } satisfies AgentRunJobData,
      { attempts: 3, backoff: { type: 'exponential', delay: 60_000 } },
    );

    return run;
  }
}
