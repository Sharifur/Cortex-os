import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { DbService } from '../../../../db/db.service';
import { agentRuns, agents } from '../../../../db/schema';
import { AgentRegistryService } from '../agent-registry.service';
import { ApprovalService } from '../approval.service';
import { AgentLogService } from '../agent-log.service';
import { FollowupService } from '../followup.service';
import { QUEUE_NAMES } from '../../../../common/queue/queue.constants';
import type { AgentFollowupJobData, TriggerEvent, AgentContext } from '../types';

const MAX_FOLLOWUPS = 5;

@Processor(QUEUE_NAMES.AGENT_FOLLOWUP, { autorun: false })
export class AgentFollowupProcessor extends WorkerHost {
  private readonly logger = new Logger(AgentFollowupProcessor.name);

  startWorker(): void {
    this.worker.run().catch((err) => this.logger.error('Worker crashed', err));
  }

  constructor(
    private db: DbService,
    private registry: AgentRegistryService,
    private approvalSvc: ApprovalService,
    private followupSvc: FollowupService,
    private logSvc: AgentLogService,
  ) {
    super();
  }

  async process(job: Job<AgentFollowupJobData>): Promise<void> {
    const { agentKey, runId } = job.data;
    this.logger.log(`Follow-up re-run for ${runId}`);

    const agent = this.registry.get(agentKey);
    if (!agent) throw new Error(`Agent not found: ${agentKey}`);

    const count = await this.followupSvc.countFollowupsForRun(runId);
    if (count > MAX_FOLLOWUPS) {
      await this.db.db
        .update(agentRuns)
        .set({ status: 'FAILED', error: `Max follow-ups (${MAX_FOLLOWUPS}) exceeded`, finishedAt: new Date() })
        .where(eq(agentRuns.id, runId));
      await this.logSvc.error(runId, `Follow-up limit reached`);
      return;
    }

    const [run] = await this.db.db
      .select()
      .from(agentRuns)
      .where(eq(agentRuns.id, runId));

    if (!run) throw new Error(`Run not found: ${runId}`);

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

    const context = (run.context as AgentContext) ?? await agent.buildContext(trigger, runCtx);

    await this.logSvc.info(runId, `Follow-up round ${count} — re-running decide()`);

    const actions = await agent.decide(context);

    if (!actions.length) {
      await this.db.db
        .update(agentRuns)
        .set({ status: 'EXECUTED', finishedAt: new Date() })
        .where(eq(agentRuns.id, runId));
      await this.logSvc.info(runId, `Follow-up produced no actions — run complete`);
      return;
    }

    await this.db.db
      .update(agentRuns)
      .set({ proposedActions: actions, status: 'AWAITING_APPROVAL' })
      .where(eq(agentRuns.id, runId));

    // Cancel any remaining PENDING approvals for this run before creating new ones.
    await this.approvalSvc.cancelPendingForRun(runId);

    for (const action of actions) {
      if (agent.requiresApproval(action)) {
        const approval = await this.approvalSvc.createApproval(runId, action);
        await this.logSvc.info(runId, `New approval after follow-up: ${action.summary}`, {
          approvalId: approval.id,
        });
      }
    }
  }
}
