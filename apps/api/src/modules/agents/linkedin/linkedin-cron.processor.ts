import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AgentRuntimeService } from '../runtime/agent-runtime.service';
import { QUEUE_NAMES } from '../../../common/queue/queue.constants';

interface LinkedInCronJobData {
  actionType: 'comments' | 'connections' | 'dms';
}

@Processor(QUEUE_NAMES.LINKEDIN_CRON, { autorun: false })
export class LinkedInCronProcessor extends WorkerHost {
  private readonly logger = new Logger(LinkedInCronProcessor.name);

  startWorker(): void {
    this.worker.run().catch((err) => this.logger.error('Worker crashed', err));
  }

  constructor(private readonly runtime: AgentRuntimeService) {
    super();
  }

  async process(job: Job<LinkedInCronJobData>): Promise<void> {
    const { actionType } = job.data;
    this.logger.log(`LinkedIn cron trigger: ${actionType}`);
    try {
      await this.runtime.triggerAgent('linkedin', 'CRON', { actionType });
    } catch (err) {
      this.logger.warn(`LinkedIn cron ${actionType} skipped: ${(err as Error).message}`);
    }
  }
}
