import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Queue, Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { DbService } from '../../../../db/db.service';
import { computeNextRunAt } from '../../../tasks/task.utils';
import { agentRuns, agents, tasks as tasksTable } from '../../../../db/schema';
import { AgentRegistryService } from '../agent-registry.service';
import { ApprovalService } from '../approval.service';
import { AgentLogService } from '../agent-log.service';
import { QUEUE_NAMES } from '../../../../common/queue/queue.constants';
import { TELEGRAM_EVENTS } from '../../../telegram/telegram.types';
import type { AgentRunJobData, AgentExecuteJobData, TriggerEvent } from '../types';
import type { ApprovalCreatedEvent } from '../../../telegram/telegram.types';

const MAX_FOLLOWUPS = 5;

@Processor(QUEUE_NAMES.AGENT_RUN, { autorun: false })
export class AgentRunProcessor extends WorkerHost {
  private readonly logger = new Logger(AgentRunProcessor.name);

  startWorker(): void {
    this.worker.run().catch((err) => this.logger.error('Worker crashed', err));
  }

  constructor(
    private db: DbService,
    private registry: AgentRegistryService,
    private approvalSvc: ApprovalService,
    private logSvc: AgentLogService,
    private eventEmitter: EventEmitter2,
    @InjectQueue(QUEUE_NAMES.AGENT_EXECUTE) private executeQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<AgentRunJobData>): Promise<void> {
    const { agentKey, runId } = job.data;
    this.logger.log(`Processing run ${runId} for agent ${agentKey}`);

    const agent = this.registry.get(agentKey);
    if (!agent) throw new Error(`Agent not found in registry: ${agentKey}`);

    const [runRow] = await this.db.db
      .select()
      .from(agentRuns)
      .where(eq(agentRuns.id, runId));

    if (!runRow) throw new Error(`Run not found: ${runId}`);

    // Look up agent display name
    const [agentRecord] = await this.db.db
      .select({ name: agents.name })
      .from(agents)
      .where(eq(agents.id, runRow.agentId));

    const agentName = agentRecord?.name ?? agentKey;

    await this.db.db
      .update(agentRuns)
      .set({ status: 'RUNNING' })
      .where(eq(agentRuns.id, runId));

    await this.logSvc.info(runId, `Run started`, { agentKey, trigger: runRow.triggerType });

    try {
      const trigger: TriggerEvent = {
        type: runRow.triggerType as TriggerEvent['type'],
        payload: runRow.triggerPayload,
      };

      const runCtx = {
        id: runRow.id,
        triggerType: runRow.triggerType as TriggerEvent['type'],
        triggerPayload: runRow.triggerPayload,
        context: runRow.context as never,
      };

      const context = await agent.buildContext(trigger, runCtx);

      await this.db.db
        .update(agentRuns)
        .set({ context })
        .where(eq(agentRuns.id, runId));

      const actions = await agent.decide(context);
      const actionsSummary = actions.length
        ? actions.map((a, i) => `${i + 1}. [${a.type}${a.riskLevel ? ` · ${a.riskLevel}` : ''}] ${a.summary}`).join('\n')
        : '(none)';
      await this.logSvc.info(
        runId,
        `Decided ${actions.length} action(s)\n${actionsSummary}`,
        { actions: actions.map((a) => ({ type: a.type, summary: a.summary, riskLevel: a.riskLevel, payload: a.payload })) },
      );

      if (!actions.length) {
        await this.db.db
          .update(agentRuns)
          .set({ status: 'EXECUTED', proposedActions: [], finishedAt: new Date() })
          .where(eq(agentRuns.id, runId));
        await this.logSvc.info(runId, `Run completed — no actions`);

        // Close out the parent task so it doesn't sit in "running" forever.
        const noopTaskId = (runRow.triggerPayload as Record<string, unknown> | null)?._taskId as string | undefined;
        if (noopTaskId) {
          const [t] = await this.db.db.select().from(tasksTable).where(eq(tasksTable.id, noopTaskId));
          if (t?.recurrence && t.recurrenceTime) {
            const nextRunAt = computeNextRunAt(t.recurrence, t.recurrenceTime);
            await this.db.db.update(tasksTable).set({ status: 'pending', nextRunAt, updatedAt: new Date() }).where(eq(tasksTable.id, noopTaskId));
          } else if (t) {
            await this.db.db.update(tasksTable).set({ status: 'done', updatedAt: new Date() }).where(eq(tasksTable.id, noopTaskId));
          }
        }
        return;
      }

      const anyRequiresApproval = actions.some((a) => agent.requiresApproval(a));

      await this.db.db
        .update(agentRuns)
        .set({ proposedActions: actions, status: anyRequiresApproval ? 'AWAITING_APPROVAL' : 'RUNNING' })
        .where(eq(agentRuns.id, runId));

      if (anyRequiresApproval) {
        const awaitingTaskId = (runRow.triggerPayload as Record<string, unknown> | null)?._taskId as string | undefined;
        if (awaitingTaskId) {
          await this.db.db.update(tasksTable).set({ status: 'awaiting_approval', updatedAt: new Date() }).where(eq(tasksTable.id, awaitingTaskId));
        }
      }

      for (const action of actions) {
        if (agent.requiresApproval(action)) {
          const approval = await this.approvalSvc.createApproval(runId, action);
          await this.logSvc.info(runId, `Approval pending: ${action.summary}`, {
            approvalId: approval.id,
            risk: action.riskLevel,
          });

          this.eventEmitter.emit(TELEGRAM_EVENTS.APPROVAL_CREATED, {
            approvalId: approval.id,
            runId,
            agentKey,
            agentName,
            action,
          } satisfies ApprovalCreatedEvent);
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
      const failedTaskId = (runRow?.triggerPayload as Record<string, unknown> | null)?._taskId as string | undefined;
      if (failedTaskId) {
        await this.db.db.update(tasksTable).set({ status: 'failed', updatedAt: new Date() }).where(eq(tasksTable.id, failedTaskId));
      }
      throw err;
    }
  }
}
