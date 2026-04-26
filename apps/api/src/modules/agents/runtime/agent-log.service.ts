import { Injectable } from '@nestjs/common';
import { DbService } from '../../../db/db.service';
import { agentLogs } from '../../../db/schema';
import type { LogLevel } from './types';

@Injectable()
export class AgentLogService {
  constructor(private db: DbService) {}

  async log(
    runId: string,
    level: LogLevel,
    message: string,
    meta?: Record<string, unknown>,
  ) {
    await this.db.db.insert(agentLogs).values({ runId, level, message, meta });
  }

  async info(runId: string, message: string, meta?: Record<string, unknown>) {
    return this.log(runId, 'INFO', message, meta);
  }

  async error(runId: string, message: string, meta?: Record<string, unknown>) {
    return this.log(runId, 'ERROR', message, meta);
  }

  async debug(runId: string, message: string, meta?: Record<string, unknown>) {
    return this.log(runId, 'DEBUG', message, meta);
  }
}
