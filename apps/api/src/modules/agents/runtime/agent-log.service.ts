import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { eq } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { agentLogs, agentRuns, agents } from '../../../db/schema';
import type { LogLevel } from './types';

@Injectable()
export class AgentLogService {
  constructor(
    private db: DbService,
    private events: EventEmitter2,
  ) {}

  async log(
    runId: string,
    level: LogLevel,
    message: string,
    meta?: Record<string, unknown>,
  ) {
    const [row] = await this.db.db
      .insert(agentLogs)
      .values({ runId, level, message, meta })
      .returning();

    const [ctx] = await this.db.db
      .select({ agentName: agents.name, agentKey: agents.key, runStatus: agentRuns.status })
      .from(agentRuns)
      .innerJoin(agents, eq(agentRuns.agentId, agents.id))
      .where(eq(agentRuns.id, runId))
      .limit(1);

    this.events.emit('log.created', {
      id: row.id,
      level: row.level,
      message: row.message,
      meta: row.meta,
      createdAt: row.createdAt,
      runId: row.runId,
      agentName: ctx?.agentName ?? 'unknown',
      agentKey: ctx?.agentKey ?? 'unknown',
      runStatus: ctx?.runStatus ?? 'RUNNING',
    });
  }

  async info(runId: string, message: string, meta?: Record<string, unknown>) {
    return this.log(runId, 'INFO', message, meta);
  }

  async error(runId: string, message: string, meta?: Record<string, unknown>) {
    return this.log(runId, 'ERROR', message, meta);
  }

  async warn(runId: string, message: string, meta?: Record<string, unknown>) {
    return this.log(runId, 'WARN', message, meta);
  }

  async debug(runId: string, message: string, meta?: Record<string, unknown>) {
    return this.log(runId, 'DEBUG', message, meta);
  }
}
