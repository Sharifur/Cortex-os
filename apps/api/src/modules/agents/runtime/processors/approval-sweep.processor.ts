import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ApprovalService } from '../approval.service';
import { QUEUE_NAMES } from '../../../../common/queue/queue.constants';

@Processor(QUEUE_NAMES.APPROVAL_SWEEP, { autorun: false })
export class ApprovalSweepProcessor extends WorkerHost {
  private readonly logger = new Logger(ApprovalSweepProcessor.name);

  startWorker(): void {
    this.worker.run().catch((err) => this.logger.error('Worker crashed', err));
  }

  constructor(private approvalSvc: ApprovalService) {
    super();
  }

  async process(_job: Job): Promise<void> {
    const expired = await this.approvalSvc.sweepExpired();
    if (expired > 0) {
      this.logger.log(`Swept ${expired} expired approval(s)`);
    }
  }
}
