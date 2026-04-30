import { Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { telegramChatState, telegramRoutingLogs, ChatTurn } from './schema';

export interface PendingReminder {
  message: string;
  expiresAt: Date;
}

export interface LastRoute {
  agentKey: string;
  instructions: string | null;
  runId: string | null;
}

export interface RoutingLogEntry {
  chatId: string;
  inboundText: string;
  decidedKind: string;
  decidedAgentKey?: string | null;
  confidence?: number | null;
  latencyMs?: number | null;
}

const RECENT_TURNS_CAP = 6;

@Injectable()
export class TelegramChatStateService {
  private readonly logger = new Logger(TelegramChatStateService.name);

  constructor(private readonly db: DbService) {}

  async getPendingReminder(chatId: string): Promise<PendingReminder | null> {
    const [row] = await this.db.db
      .select({
        message: telegramChatState.pendingReminderMessage,
        expiresAt: telegramChatState.pendingReminderExpiresAt,
      })
      .from(telegramChatState)
      .where(eq(telegramChatState.chatId, chatId))
      .limit(1);
    if (!row || !row.message || !row.expiresAt) return null;
    if (row.expiresAt.getTime() < Date.now()) return null;
    return { message: row.message, expiresAt: row.expiresAt };
  }

  async setPendingReminder(chatId: string, message: string, ttlMs: number): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlMs);
    await this.db.db
      .insert(telegramChatState)
      .values({
        chatId,
        pendingReminderMessage: message,
        pendingReminderExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: telegramChatState.chatId,
        set: {
          pendingReminderMessage: message,
          pendingReminderExpiresAt: expiresAt,
          updatedAt: new Date(),
        },
      });
  }

  async clearPendingReminder(chatId: string): Promise<boolean> {
    const result = await this.db.db
      .update(telegramChatState)
      .set({
        pendingReminderMessage: null,
        pendingReminderExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(telegramChatState.chatId, chatId),
          // Only "had something" if a message was set
          sql`${telegramChatState.pendingReminderMessage} IS NOT NULL`,
        ),
      )
      .returning({ id: telegramChatState.chatId });
    return result.length > 0;
  }

  async setLastRoute(
    chatId: string,
    agentKey: string,
    instructions: string | null,
    runId: string | null,
  ): Promise<void> {
    await this.db.db
      .insert(telegramChatState)
      .values({
        chatId,
        lastRouteAgentKey: agentKey,
        lastRouteInstructions: instructions,
        lastRunId: runId,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: telegramChatState.chatId,
        set: {
          lastRouteAgentKey: agentKey,
          lastRouteInstructions: instructions,
          lastRunId: runId,
          updatedAt: new Date(),
        },
      });
  }

  async getLastRoute(chatId: string): Promise<LastRoute | null> {
    const [row] = await this.db.db
      .select({
        agentKey: telegramChatState.lastRouteAgentKey,
        instructions: telegramChatState.lastRouteInstructions,
        runId: telegramChatState.lastRunId,
      })
      .from(telegramChatState)
      .where(eq(telegramChatState.chatId, chatId))
      .limit(1);
    if (!row || !row.agentKey) return null;
    return { agentKey: row.agentKey, instructions: row.instructions, runId: row.runId };
  }

  async getRecentTurns(chatId: string, limit = RECENT_TURNS_CAP): Promise<ChatTurn[]> {
    const [row] = await this.db.db
      .select({ recentTurns: telegramChatState.recentTurns })
      .from(telegramChatState)
      .where(eq(telegramChatState.chatId, chatId))
      .limit(1);
    const turns = row?.recentTurns ?? [];
    return turns.slice(-limit);
  }

  async appendTurn(
    chatId: string,
    role: 'user' | 'assistant',
    text: string,
    kind?: string,
  ): Promise<void> {
    if (!text.trim()) return;
    const turn: ChatTurn = { role, text: text.slice(0, 800), ts: new Date().toISOString(), ...(kind ? { kind } : {}) };
    const existing = await this.getRecentTurns(chatId, RECENT_TURNS_CAP);
    const next = [...existing, turn].slice(-RECENT_TURNS_CAP);
    await this.db.db
      .insert(telegramChatState)
      .values({ chatId, recentTurns: next, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: telegramChatState.chatId,
        set: { recentTurns: next, updatedAt: new Date() },
      });
  }

  async logRouting(entry: RoutingLogEntry): Promise<void> {
    try {
      await this.db.db.insert(telegramRoutingLogs).values({
        chatId: entry.chatId,
        inboundText: entry.inboundText.slice(0, 4000),
        decidedKind: entry.decidedKind,
        decidedAgentKey: entry.decidedAgentKey ?? null,
        confidence: entry.confidence ?? null,
        latencyMs: entry.latencyMs ?? null,
      });
    } catch (err) {
      this.logger.warn(`failed to write routing log: ${(err as Error).message}`);
    }
  }

  async listRecentLogs(chatId: string, limit = 50) {
    return this.db.db
      .select()
      .from(telegramRoutingLogs)
      .where(eq(telegramRoutingLogs.chatId, chatId))
      .orderBy(desc(telegramRoutingLogs.createdAt))
      .limit(limit);
  }

  async pruneStaleState(olderThanDays = 30): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const rows = await this.db.db
      .delete(telegramRoutingLogs)
      .where(lt(telegramRoutingLogs.createdAt, cutoff))
      .returning({ id: telegramRoutingLogs.id });
    return rows.length;
  }

  async expireStalePendingReminders(): Promise<number> {
    const rows = await this.db.db
      .update(telegramChatState)
      .set({
        pendingReminderMessage: null,
        pendingReminderExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          sql`${telegramChatState.pendingReminderMessage} IS NOT NULL`,
          gte(sql`${telegramChatState.pendingReminderExpiresAt}`, new Date(0)),
          lt(telegramChatState.pendingReminderExpiresAt, new Date()),
        ),
      )
      .returning({ id: telegramChatState.chatId });
    return rows.length;
  }
}
