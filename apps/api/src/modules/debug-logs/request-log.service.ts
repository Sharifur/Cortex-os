import { Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, gte, sql, ilike, or } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { requestLogs } from '../../db/schema';

export interface RequestLogEntry {
  method: string;
  path: string;
  statusCode: number;
  durationMs?: number;
  requestId?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  queryString?: string;
  requestBody?: string;
  responseBody?: string;
  errorMessage?: string;
  errorStack?: string;
}

const MAX_BODY_LEN = 8000;

@Injectable()
export class RequestLogService {
  private readonly logger = new Logger(RequestLogService.name);

  constructor(private readonly db: DbService) {}

  async record(entry: RequestLogEntry): Promise<void> {
    try {
      await this.db.db.insert(requestLogs).values({
        method: entry.method,
        path: entry.path,
        statusCode: entry.statusCode,
        durationMs: entry.durationMs ?? null,
        requestId: entry.requestId ?? null,
        userId: entry.userId ?? null,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
        queryString: entry.queryString ?? null,
        requestBody: truncate(entry.requestBody),
        responseBody: truncate(entry.responseBody),
        errorMessage: entry.errorMessage ?? null,
        errorStack: truncate(entry.errorStack),
      });
    } catch (err) {
      this.logger.warn(`failed to record request log: ${(err as Error).message}`);
    }
  }

  async list(opts: { limit?: number; minStatus?: number; q?: string; sinceHours?: number } = {}) {
    const limit = Math.min(opts.limit ?? 100, 500);
    const where = [];
    if (opts.minStatus) where.push(gte(requestLogs.statusCode, opts.minStatus));
    if (opts.sinceHours) {
      where.push(gte(requestLogs.createdAt, new Date(Date.now() - opts.sinceHours * 60 * 60 * 1000)));
    }
    if (opts.q) {
      const like = `%${opts.q}%`;
      where.push(or(
        ilike(requestLogs.path, like),
        ilike(requestLogs.errorMessage, like),
        ilike(requestLogs.requestBody, like),
      )!);
    }
    return this.db.db
      .select()
      .from(requestLogs)
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(requestLogs.createdAt))
      .limit(limit);
  }

  async getById(id: string) {
    const [row] = await this.db.db
      .select()
      .from(requestLogs)
      .where(eq(requestLogs.id, id))
      .limit(1);
    return row ?? null;
  }

  async stats() {
    const [row] = await this.db.db.execute<{ total: number; errors: number; last_hour: number }>(sql`
      SELECT
        COUNT(*)::int AS total,
        SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END)::int AS errors,
        SUM(CASE WHEN created_at >= NOW() - INTERVAL '1 hour' THEN 1 ELSE 0 END)::int AS last_hour
      FROM request_logs
    `);
    return row ?? { total: 0, errors: 0, last_hour: 0 };
  }
}

function truncate(s: string | undefined): string | null {
  if (!s) return null;
  return s.length > MAX_BODY_LEN ? s.slice(0, MAX_BODY_LEN) + `\n…[truncated ${s.length - MAX_BODY_LEN} chars]` : s;
}
