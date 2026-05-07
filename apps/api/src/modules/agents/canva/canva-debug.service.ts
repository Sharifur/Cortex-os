import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '../../../db/db.service';
import { canvaDebugLog } from './schema';

@Injectable()
export class CanvaDebugService {
  private readonly logger = new Logger(CanvaDebugService.name);

  constructor(private readonly db: DbService) {}

  async log(opts: {
    sessionId?: string;
    candidateId?: string;
    step: string;
    actor: string;
    data?: unknown;
    latencyMs?: number;
    debugMode: boolean;
  }): Promise<void> {
    if (!opts.debugMode) return;
    try {
      await this.db.db.insert(canvaDebugLog).values({
        sessionId: opts.sessionId ?? null,
        candidateId: opts.candidateId ?? null,
        step: opts.step,
        actor: opts.actor,
        data: opts.data as any ?? null,
        latencyMs: opts.latencyMs ?? null,
      });
    } catch (err) {
      this.logger.warn(`debug log write failed: ${(err as Error).message}`);
    }
  }

  async getSessionLog(sessionId: string) {
    const { eq } = await import('drizzle-orm');
    return this.db.db
      .select()
      .from(canvaDebugLog)
      .where(eq(canvaDebugLog.sessionId, sessionId))
      .orderBy(canvaDebugLog.createdAt);
  }
}
