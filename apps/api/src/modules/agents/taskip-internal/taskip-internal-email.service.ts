import { Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, gte, isNotNull, isNull, lt, or } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { taskipInternalEmails, taskipInternalEmailReplies } from '../../../db/schema';
import { GmailService } from '../../gmail/gmail.service';

export type TaskipEmailPurpose = 'marketing' | 'followup' | 'offer' | 'other';

export interface SendTrackedEmailInput {
  purpose: TaskipEmailPurpose;
  recipient: string;
  subject: string;
  body: string;
  workspaceUuid?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class TaskipInternalEmailService {
  private readonly logger = new Logger(TaskipInternalEmailService.name);

  constructor(private readonly db: DbService, private readonly gmail: GmailService) {}

  async send(input: SendTrackedEmailInput): Promise<{ id: string; gmailMessageId: string | null; status: 'sent' | 'failed'; error?: string }> {
    const from = await this.gmail.getFromAddress();
    try {
      const messageId = await this.gmail.sendEmail({
        to: input.recipient,
        from,
        subject: input.subject,
        textBody: input.body,
      });

      let threadId: string | null = null;
      try {
        const msg = await this.gmail.getMessage(messageId);
        threadId = msg.threadId || null;
      } catch (err) {
        this.logger.warn(`could not fetch threadId for ${messageId}: ${(err as Error).message}`);
      }

      const [row] = await this.db.db
        .insert(taskipInternalEmails)
        .values({
          purpose: input.purpose,
          workspaceUuid: input.workspaceUuid ?? null,
          recipient: input.recipient,
          subject: input.subject,
          body: input.body,
          gmailMessageId: messageId,
          gmailThreadId: threadId,
          status: 'sent',
          metadata: input.metadata ?? null,
        })
        .returning({ id: taskipInternalEmails.id });

      return { id: row.id, gmailMessageId: messageId, status: 'sent' };
    } catch (err) {
      const message = (err as Error).message;
      const [row] = await this.db.db
        .insert(taskipInternalEmails)
        .values({
          purpose: input.purpose,
          workspaceUuid: input.workspaceUuid ?? null,
          recipient: input.recipient,
          subject: input.subject,
          body: input.body,
          status: 'failed',
          error: message,
          metadata: input.metadata ?? null,
        })
        .returning({ id: taskipInternalEmails.id });
      return { id: row.id, gmailMessageId: null, status: 'failed', error: message };
    }
  }

  async listSent(opts: { limit?: number; purpose?: TaskipEmailPurpose; workspaceUuid?: string } = {}) {
    const limit = Math.min(opts.limit ?? 50, 200);
    const where = [];
    if (opts.purpose) where.push(eq(taskipInternalEmails.purpose, opts.purpose));
    if (opts.workspaceUuid) where.push(eq(taskipInternalEmails.workspaceUuid, opts.workspaceUuid));

    const rows = await this.db.db
      .select()
      .from(taskipInternalEmails)
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(taskipInternalEmails.sentAt))
      .limit(limit);
    return rows;
  }

  async getDetail(id: string) {
    const [email] = await this.db.db
      .select()
      .from(taskipInternalEmails)
      .where(eq(taskipInternalEmails.id, id))
      .limit(1);
    if (!email) return null;

    const replies = await this.db.db
      .select()
      .from(taskipInternalEmailReplies)
      .where(eq(taskipInternalEmailReplies.emailId, id))
      .orderBy(taskipInternalEmailReplies.receivedAt);
    return { email, replies };
  }

  async syncReplies(emailId: string): Promise<{ added: number; total: number }> {
    const [email] = await this.db.db
      .select()
      .from(taskipInternalEmails)
      .where(eq(taskipInternalEmails.id, emailId))
      .limit(1);
    if (!email || !email.gmailThreadId) return { added: 0, total: email?.replyCount ?? 0 };

    const thread = await this.gmail.getThread(email.gmailThreadId);
    const ourMsgIds = new Set([email.gmailMessageId].filter(Boolean) as string[]);

    let added = 0;
    let lastReplyAt: Date | null = email.lastReplyAt;

    for (const msg of thread.messages) {
      if (!msg.id || ourMsgIds.has(msg.id)) continue;
      if (this.fromIsSelf(msg.from)) continue;

      try {
        await this.db.db.insert(taskipInternalEmailReplies).values({
          emailId,
          gmailMessageId: msg.id,
          gmailThreadId: thread.id,
          fromAddress: msg.from,
          snippet: msg.snippet ?? null,
          body: msg.body ?? null,
          receivedAt: msg.receivedAt,
        });
        added++;
        if (!lastReplyAt || msg.receivedAt > lastReplyAt) lastReplyAt = msg.receivedAt;
      } catch (err) {
        // unique index on gmail_message_id — ignore conflicts (already recorded)
        const m = (err as Error).message;
        if (!m.includes('duplicate') && !m.includes('unique')) {
          this.logger.warn(`reply insert failed for ${msg.id}: ${m}`);
        }
      }
    }

    const total = await this.db.db
      .select({ id: taskipInternalEmailReplies.id })
      .from(taskipInternalEmailReplies)
      .where(eq(taskipInternalEmailReplies.emailId, emailId));

    await this.db.db
      .update(taskipInternalEmails)
      .set({
        replyCount: total.length,
        lastReplyAt: lastReplyAt ?? null,
        lastSyncedAt: new Date(),
      })
      .where(eq(taskipInternalEmails.id, emailId));

    return { added, total: total.length };
  }

  async sweepRecent(): Promise<{ scanned: number; updated: number }> {
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const candidates = await this.db.db
      .select({ id: taskipInternalEmails.id })
      .from(taskipInternalEmails)
      .where(
        and(
          eq(taskipInternalEmails.status, 'sent'),
          isNotNull(taskipInternalEmails.gmailThreadId),
          gte(taskipInternalEmails.sentAt, since),
          or(
            isNull(taskipInternalEmails.lastSyncedAt),
            lt(taskipInternalEmails.lastSyncedAt, new Date(Date.now() - 10 * 60 * 1000)),
          ),
        ),
      )
      .limit(50);

    let updated = 0;
    for (const c of candidates) {
      try {
        const r = await this.syncReplies(c.id);
        if (r.added > 0) updated++;
      } catch (err) {
        this.logger.warn(`sweep syncReplies failed for ${c.id}: ${(err as Error).message}`);
      }
    }
    return { scanned: candidates.length, updated };
  }

  private fromIsSelf(from: string): boolean {
    if (!from) return false;
    const lower = from.toLowerCase();
    return lower.includes('sharifur') || lower.includes('xgenious') || lower.includes('taskip.net');
  }
}
