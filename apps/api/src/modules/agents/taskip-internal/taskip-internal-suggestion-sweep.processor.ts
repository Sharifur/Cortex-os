import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { TaskipInternalSuggestionSweepService } from './taskip-internal-suggestion-sweep.service';

export const TASKIP_SUGGESTION_SWEEP_QUEUE = 'taskip-internal-suggestion-sweep';

@Processor(TASKIP_SUGGESTION_SWEEP_QUEUE, { autorun: false })
export class TaskipInternalSuggestionSweepProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(TaskipInternalSuggestionSweepProcessor.name);

  constructor(
    private readonly sweep: TaskipInternalSuggestionSweepService,
    @InjectQueue(TASKIP_SUGGESTION_SWEEP_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      'sweep',
      {},
      {
        repeat: { every: 6 * 60 * 60 * 1000 },
        jobId: 'taskip-internal-suggestion-sweep-repeatable',
      },
    );
  }

  startWorker(): void {
    this.worker.run().catch((err) => this.logger.error('Suggestion sweep worker crashed', err));
  }

  async process(_job: Job): Promise<void> {
    try {
      const r = await this.sweep.runSweep();
      this.logger.log(`Suggestion sweep drafted=${r.drafted} skipped=${r.skipped}`);
    } catch (err) {
      this.logger.warn(`Suggestion sweep failed: ${(err as Error).message}`);
    }
  }
}
