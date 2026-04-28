import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { TaskipInternalEmailService } from './taskip-internal-email.service';

export const TASKIP_EMAIL_SWEEP_QUEUE = 'taskip-internal-email-sweep';

@Processor(TASKIP_EMAIL_SWEEP_QUEUE, { autorun: false })
export class TaskipInternalEmailSweepProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(TaskipInternalEmailSweepProcessor.name);

  constructor(
    private readonly emails: TaskipInternalEmailService,
    @InjectQueue(TASKIP_EMAIL_SWEEP_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      'sweep',
      {},
      {
        repeat: { every: 10 * 60 * 1000 },
        jobId: 'taskip-internal-email-sweep-repeatable',
      },
    );
  }

  startWorker(): void {
    this.worker.run().catch((err) => this.logger.error('Email sweep worker crashed', err));
  }

  async process(_job: Job): Promise<void> {
    try {
      const r = await this.emails.sweepRecent();
      if (r.scanned > 0 || r.updated > 0) {
        this.logger.log(`Email sweep scanned=${r.scanned} updated=${r.updated}`);
      }
    } catch (err) {
      this.logger.warn(`Email sweep failed: ${(err as Error).message}`);
    }
  }
}
