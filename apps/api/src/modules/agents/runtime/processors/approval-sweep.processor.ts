import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Optional } from '@nestjs/common';
import { Job } from 'bullmq';
import { ApprovalService } from '../approval.service';
import { QUEUE_NAMES } from '../../../../common/queue/queue.constants';
import { RequestLogService } from '../../../debug-logs/request-log.service';
import { AuthSessionService } from '../../../auth/auth-session.service';

const REQUEST_LOG_RETENTION_DAYS = 30;

@Processor(QUEUE_NAMES.APPROVAL_SWEEP, { autorun: false })
export class ApprovalSweepProcessor extends WorkerHost {
  private readonly logger = new Logger(ApprovalSweepProcessor.name);
  private lastRetentionPruneMs = 0;

  startWorker(): void {
    this.worker.run().catch((err) => this.logger.error('Worker crashed', err));
  }

  constructor(
    private approvalSvc: ApprovalService,
    @Optional() private requestLogs?: RequestLogService,
    @Optional() private sessions?: AuthSessionService,
  ) {
    super();
  }

  async process(_job: Job): Promise<void> {
    const expired = await this.approvalSvc.sweepExpired();
    if (expired > 0) this.logger.log(`Swept ${expired} expired approval(s)`);

    // Heavier retention prune at most every 24h
    if (Date.now() - this.lastRetentionPruneMs > 24 * 60 * 60 * 1000) {
      this.lastRetentionPruneMs = Date.now();
      try {
        if (this.requestLogs) {
          const pruned = await this.requestLogs.pruneOlderThanDays(REQUEST_LOG_RETENTION_DAYS);
          if (pruned > 0) this.logger.log(`Pruned ${pruned} request_logs row(s) older than ${REQUEST_LOG_RETENTION_DAYS}d`);
        }
        if (this.sessions) {
          const swept = await this.sessions.sweepExpired();
          if (swept > 0) this.logger.log(`Marked ${swept} auth session(s) as revoked (expired)`);
        }
      } catch (err) {
        this.logger.warn(`retention sweep failed: ${(err as Error).message}`);
      }
    }
  }
}
