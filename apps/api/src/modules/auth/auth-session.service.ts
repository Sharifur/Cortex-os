import { Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, isNull, lt } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { DbService } from '../../db/db.service';
import { authSessions } from '../../db/schema';

export interface CreateSessionInput {
  userId: string;
  ip?: string;
  userAgent?: string;
  ttlSeconds: number;
}

@Injectable()
export class AuthSessionService {
  private readonly logger = new Logger(AuthSessionService.name);

  constructor(private readonly db: DbService) {}

  async create(input: CreateSessionInput): Promise<{ jti: string; sessionId: string; isNewIp: boolean }> {
    let isNewIp = false;
    if (input.ip) {
      const [seen] = await this.db.db
        .select({ id: authSessions.id })
        .from(authSessions)
        .where(and(eq(authSessions.userId, input.userId), eq(authSessions.ip, input.ip)))
        .limit(1);
      isNewIp = !seen;
    }

    const jti = randomUUID();
    const [row] = await this.db.db
      .insert(authSessions)
      .values({
        userId: input.userId,
        jti,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        expiresAt: new Date(Date.now() + input.ttlSeconds * 1000),
      })
      .returning({ id: authSessions.id });

    return { jti, sessionId: row.id, isNewIp };
  }

  async isValid(jti: string): Promise<{ ok: boolean; userId?: string }> {
    const [row] = await this.db.db
      .select()
      .from(authSessions)
      .where(eq(authSessions.jti, jti))
      .limit(1);
    if (!row) return { ok: false };
    if (row.revokedAt) return { ok: false };
    if (row.expiresAt.getTime() < Date.now()) return { ok: false };
    return { ok: true, userId: row.userId };
  }

  async touch(jti: string): Promise<void> {
    await this.db.db
      .update(authSessions)
      .set({ lastUsedAt: new Date() })
      .where(eq(authSessions.jti, jti));
  }

  async listForUser(userId: string) {
    return this.db.db
      .select({
        id: authSessions.id,
        ip: authSessions.ip,
        userAgent: authSessions.userAgent,
        createdAt: authSessions.createdAt,
        lastUsedAt: authSessions.lastUsedAt,
        expiresAt: authSessions.expiresAt,
        revokedAt: authSessions.revokedAt,
      })
      .from(authSessions)
      .where(eq(authSessions.userId, userId))
      .orderBy(desc(authSessions.lastUsedAt))
      .limit(50);
  }

  async revokeById(userId: string, sessionId: string): Promise<void> {
    await this.db.db
      .update(authSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(authSessions.id, sessionId), eq(authSessions.userId, userId)));
  }

  async revokeByJti(jti: string): Promise<void> {
    await this.db.db
      .update(authSessions)
      .set({ revokedAt: new Date() })
      .where(eq(authSessions.jti, jti));
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.db.db
      .update(authSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)));
  }

  async sweepExpired(): Promise<number> {
    const result = await this.db.db
      .update(authSessions)
      .set({ revokedAt: new Date() })
      .where(and(isNull(authSessions.revokedAt), lt(authSessions.expiresAt, new Date())))
      .returning({ id: authSessions.id });
    return result.length;
  }
}
