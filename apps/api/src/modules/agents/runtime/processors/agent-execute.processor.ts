import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { DbService } from '../../../../db/db.service';
import { agentRuns, agents, tasks as tasksTable } from '../../../../db/schema';
import { AgentRegistryService } from '../agent-registry.service';
import { AgentLogService } from '../agent-log.service';
import { QUEUE_NAMES } from '../../../../common/queue/queue.constants';
import { computeNextRunAt } from '../../../tasks/task.utils';
import type { AgentExecuteJobData } from '../types';

@Processor(QUEUE_NAMES.AGENT_EXECUTE, { autorun: false })
export class AgentExecuteProcessor extends WorkerHost {
  private readonly logger = new Logger(AgentExecuteProcessor.name);

  startWorker(): void {
    this.worker.run().catch((err) => this.logger.error('Worker crashed', err));
  }

  constructor(
    private db: DbService,
    private registry: AgentRegistryService,
    private logSvc: AgentLogService,
    private events: EventEmitter2,
  ) {
    super();
  }

  async process(job: Job<AgentExecuteJobData>): Promise<void> {
    const { agentKey, runId, action } = job.data;
    this.logger.log(`Executing action "${action.type}" for run ${runId}`);

    const agent = this.registry.get(agentKey);
    if (!agent) throw new Error(`Agent not found: ${agentKey}`);

    await this.logSvc.info(runId, `Executing: ${action.summary}`, { type: action.type });

    try {
      // Inject runId into payload so agents can forward it to sub-services for activity logging.
      const actionWithRunId = { ...action, payload: { ...(action.payload as object ?? {}), _runId: runId } };
      const result = await agent.execute(actionWithRunId);

      const [run] = await this.db.db
        .select()
        .from(agentRuns)
        .where(eq(agentRuns.id, runId));

      const taskId = (run?.triggerPayload as Record<string, unknown> | null)?._taskId as string | undefined;
      if (taskId) {
        const [task] = await this.db.db.select().from(tasksTable).where(eq(tasksTable.id, taskId));
        if (task?.recurrence && task.recurrenceTime) {
          const nextRunAt = computeNextRunAt(task.recurrence, task.recurrenceTime);
          await this.db.db.update(tasksTable).set({ status: 'pending', nextRunAt, updatedAt: new Date() }).where(eq(tasksTable.id, taskId));
        } else if (task) {
          await this.db.db.update(tasksTable).set({ status: 'done', updatedAt: new Date() }).where(eq(tasksTable.id, taskId));
        }
      }

      const prevResult = (run?.result as unknown[]) ?? [];

      await this.db.db
        .update(agentRuns)
        .set({
          status: 'EXECUTED',
          result: [...prevResult, { action: action.type, ...result }],
          finishedAt: new Date(),
        })
        .where(eq(agentRuns.id, runId));

      await this.logSvc.info(runId, `Executed: ${action.summary}`, { success: result.success });
      await this.logSvc.info(runId, `Run completed`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.db.db
        .update(agentRuns)
        .set({ status: 'FAILED', error: message, finishedAt: new Date() })
        .where(eq(agentRuns.id, runId));
      await this.logSvc.error(runId, `Execute failed: ${message}`);

      const [agentRow] = await this.db.db
        .select({ name: agents.name })
        .from(agents)
        .innerJoin(agentRuns, eq(agentRuns.agentId, agents.id))
        .where(eq(agentRuns.id, runId));
      this.events.emit('agent.failed', {
        agentKey,
        agentName: agentRow?.name ?? agentKey,
        runId,
        error: `${action.type}: ${message}`,
      });

      throw err;
    }
  }
}
