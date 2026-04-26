import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { DbService } from '../../../../db/db.service';
import { agentRuns } from '../../../../db/schema';
import { AgentRegistryService } from '../agent-registry.service';
import { ApprovalService } from '../approval.service';
import { AgentLogService } from '../agent-log.service';
import { QUEUE_NAMES } from '../../../../common/queue/queue.constants';
import type { AgentRunJobData, AgentExecuteJobData, TriggerEvent } from '../types';

const MAX_FOLLOWUPS = 5;

@Processor(QUEUE_NAMES.AGENT_RUN)
export class AgentRunProcessor extends WorkerHost {
  private readonly logger = new Logger(AgentRunProcessor.name);

  constructor(
    private db: DbService,
    private registry: AgentRegistryService,
    private approvalSvc: ApprovalService,
    private logSvc: AgentLogService,
    @InjectQueue(QUEUE_NAMES.AGENT_EXECUTE) private executeQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<AgentRunJobData>): Promise<void> {
    const { agentKey, runId } = job.data;
    this.logger.log(`Processing run ${runId} for agent ${agentKey}`);

    const agent = this.registry.get(agentKey);
    if (!agent) throw new Error(`Agent not found in registry: ${agentKey}`);

    const [run] = await this.db.db
      .select()
      .from(agentRuns)
      .where(eq(agentRuns.id, runId));

    if (!run) throw new Error(`Run not found: ${runId}`);

    await this.db.db
      .update(agentRuns)
      .set({ status: 'RUNNING' })
      .where(eq(agentRuns.id, runId));

    await this.logSvc.info(runId, `Run started`, { agentKey, trigger: run.triggerType });

    try {
      const trigger: TriggerEvent = {
        type: run.triggerType as TriggerEvent['type'],
        payload: run.triggerPayload,
      };

      const runCtx = {
        id: run.id,
        triggerType: run.triggerType as TriggerEvent['type'],
        triggerPayload: run.triggerPayload,
        context: run.context as never,
      };

      const context = await agent.buildContext(trigger, runCtx);

      await this.db.db
        .update(agentRuns)
        .set({ context })
        .where(eq(agentRuns.id, runId));

      const actions = await agent.decide(context);
      await this.logSvc.info(runId, `Decided ${actions.length} action(s)`);

      if (!actions.length) {
        await this.db.db
          .update(agentRuns)
          .set({ status: 'EXECUTED', proposedActions: [], finishedAt: new Date() })
          .where(eq(agentRuns.id, runId));
        await this.logSvc.info(runId, `Run completed — no actions`);
        return;
      }

      await this.db.db
        .update(agentRuns)
        .set({ proposedActions: actions, status: 'AWAITING_APPROVAL' })
        .where(eq(agentRuns.id, runId));

      for (const action of actions) {
        if (agent.requiresApproval(action)) {
          const approval = await this.approvalSvc.createApproval(runId, action);
          await this.logSvc.info(runId, `Approval pending: ${action.summary}`, {
            approvalId: approval.id,
            risk: action.riskLevel,
          });
          // Telegram notification will be added in the Telegram phase
        } else {
          await this.executeQueue.add(
            'execute',
            {
              agentKey,
              runId,
              approvalId: '',
              action,
            } satisfies AgentExecuteJobData,
            { attempts: 3, backoff: { type: 'exponential', delay: 60_000 } },
          );
          await this.logSvc.info(runId, `Auto-executing: ${action.summary}`);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.db.db
        .update(agentRuns)
        .set({ status: 'FAILED', error: message, finishedAt: new Date() })
        .where(eq(agentRuns.id, runId));
      await this.logSvc.error(runId, `Run failed: ${message}`);
      throw err;
    }
  }
}
