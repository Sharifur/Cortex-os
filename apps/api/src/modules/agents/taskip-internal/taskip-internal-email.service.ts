import { Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, gte, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { DbService } from '../../../db/db.service';
import { taskipInternalEmails, taskipInternalEmailReplies } from '../../../db/schema';
import { GmailService } from '../../gmail/gmail.service';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function applyInlineMarkup(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>');
}

function buildHtmlEmail(textBody: string, pixelUrl: string): string {
  const blocks = textBody.split(/\n\n+/);
  const htmlParts = blocks.map(block => {
    const lines = block.split('\n');
    const nonEmpty = lines.filter(l => l.trim());
    if (nonEmpty.length > 0 && nonEmpty.every(l => l.trimStart().startsWith('- '))) {
      const items = nonEmpty
        .map(l => `<li>${applyInlineMarkup(escapeHtml(l.replace(/^[\s]*-\s*/, '').trim()))}</li>`)
        .join('');
      return `<ul style="margin:0 0 12px 1.4em;padding:0">${items}</ul>`;
    }
    const content = lines.map(l => applyInlineMarkup(escapeHtml(l))).join('<br>');
    return `<p style="margin:0 0 12px">${content}</p>`;
  });
  const body = htmlParts.join('');
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#222;max-width:600px;padding:16px">${body}<img src="${pixelUrl}" width="1" height="1" style="display:block;width:1px;height:1px;border:0" alt="" loading="eager"></body></html>`;
}

export type TaskipEmailPurpose = 'marketing' | 'followup' | 'offer' | 'other';

export interface SendTrackedEmailInput {
  purpose: TaskipEmailPurpose;
  recipient: string;
  subject: string;
  body: string;
  workspaceUuid?: string;
  metadata?: Record<string, unknown>;
  plainText?: boolean;
}

@Injectable()
export class TaskipInternalEmailService {
  private readonly logger = new Logger(TaskipInternalEmailService.name);

  constructor(private readonly db: DbService, private readonly gmail: GmailService) {}

  async send(input: SendTrackedEmailInput): Promise<{ id: string; gmailMessageId: string | null; status: 'sent' | 'failed'; error?: string }> {
    const from = await this.gmail.getFromAddress();
    const trackingToken = createId();

    let htmlBody: string | undefined;
    if (!input.plainText) {
      const apiBase = (process.env.COOLIFY_URL ?? process.env.API_PUBLIC_URL ?? 'http://localhost:3000').replace(/\/$/, '');
      const pixelUrl = `${apiBase}/track/open/${trackingToken}.gif`;
      htmlBody = buildHtmlEmail(input.body, pixelUrl);
    }

    try {
      const messageId = await this.gmail.sendEmail({
        to: input.recipient,
        from,
        subject: input.subject,
        textBody: input.body,
        htmlBody,
      });

      let threadId: string | null = null;
      try {
        const msg = await this.gmail.getMessage(messageId);
        threadId = msg.threadId || null;
      } catch (err) {
        this.logger.warn(`could not fetch threadId for ${messageId}: ${(err as Error).message}`);
      }

      const id = createId();
      // Use raw SQL to guarantee only stable columns are inserted.
      // Drizzle client-side defaults (e.g. open_count=0) would reference columns
      // that may not exist on older environments where migration 0063 hasn't run.
      await this.db.db.execute(sql`
        INSERT INTO taskip_internal_emails
          (id, purpose, workspace_uuid, recipient, subject, body,
           gmail_message_id, gmail_thread_id, status, metadata, sent_at)
        VALUES
          (${id}, ${input.purpose}, ${input.workspaceUuid ?? null},
           ${input.recipient}, ${input.subject}, ${input.body},
           ${messageId}, ${threadId}, 'sent',
           ${input.metadata ? JSON.stringify(input.metadata) : null}::jsonb,
           NOW())
      `);

      // Best-effort: set tracking token if the column exists
      await this.db.db.execute(sql`
        UPDATE taskip_internal_emails
        SET tracking_token = ${trackingToken}
        WHERE id = ${id}
      `).catch(() => { /* column not yet migrated */ });

      return { id, gmailMessageId: messageId, status: 'sent' };
    } catch (err) {
      const message = (err as Error).message;
      const id = createId();
      await this.db.db.execute(sql`
        INSERT INTO taskip_internal_emails
          (id, purpose, workspace_uuid, recipient, subject, body,
           status, error, metadata, sent_at)
        VALUES
          (${id}, ${input.purpose}, ${input.workspaceUuid ?? null},
           ${input.recipient}, ${input.subject}, ${input.body},
           'failed', ${message},
           ${input.metadata ? JSON.stringify(input.metadata) : null}::jsonb,
           NOW())
      `).catch((dbErr: unknown) => {
        this.logger.warn(`failed to record send failure: ${(dbErr as Error).message}`);
      });
      return { id, gmailMessageId: null, status: 'failed', error: message };
    }
  }

  async listSent(opts: { limit?: number; purpose?: TaskipEmailPurpose; workspaceUuid?: string } = {}) {
    const limit = Math.min(opts.limit ?? 50, 200);
    const where = [];
    if (opts.purpose) where.push(eq(taskipInternalEmails.purpose, opts.purpose));
    if (opts.workspaceUuid) where.push(eq(taskipInternalEmails.workspaceUuid, opts.workspaceUuid));

    const rows = await this.db.db
      .select({
        id: taskipInternalEmails.id,
        purpose: taskipInternalEmails.purpose,
        workspaceUuid: taskipInternalEmails.workspaceUuid,
        recipient: taskipInternalEmails.recipient,
        subject: taskipInternalEmails.subject,
        body: taskipInternalEmails.body,
        gmailMessageId: taskipInternalEmails.gmailMessageId,
        gmailThreadId: taskipInternalEmails.gmailThreadId,
        status: taskipInternalEmails.status,
        error: taskipInternalEmails.error,
        replyCount: taskipInternalEmails.replyCount,
        lastReplyAt: taskipInternalEmails.lastReplyAt,
        lastSyncedAt: taskipInternalEmails.lastSyncedAt,
        metadata: taskipInternalEmails.metadata,
        sentAt: taskipInternalEmails.sentAt,
      })
      .from(taskipInternalEmails)
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(taskipInternalEmails.sentAt))
      .limit(limit);
    return rows;
  }

  async getDetail(id: string) {
    const [email] = await this.db.db
      .select({
        id: taskipInternalEmails.id,
        purpose: taskipInternalEmails.purpose,
        workspaceUuid: taskipInternalEmails.workspaceUuid,
        recipient: taskipInternalEmails.recipient,
        subject: taskipInternalEmails.subject,
        body: taskipInternalEmails.body,
        gmailMessageId: taskipInternalEmails.gmailMessageId,
        gmailThreadId: taskipInternalEmails.gmailThreadId,
        status: taskipInternalEmails.status,
        error: taskipInternalEmails.error,
        replyCount: taskipInternalEmails.replyCount,
        lastReplyAt: taskipInternalEmails.lastReplyAt,
        lastSyncedAt: taskipInternalEmails.lastSyncedAt,
        metadata: taskipInternalEmails.metadata,
        sentAt: taskipInternalEmails.sentAt,
      })
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
      .select({
        id: taskipInternalEmails.id,
        gmailMessageId: taskipInternalEmails.gmailMessageId,
        gmailThreadId: taskipInternalEmails.gmailThreadId,
        status: taskipInternalEmails.status,
        replyCount: taskipInternalEmails.replyCount,
        lastReplyAt: taskipInternalEmails.lastReplyAt,
      })
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

  async markOpened(id: string): Promise<{ ok: boolean }> {
    const [row] = await this.db.db
      .select({ id: taskipInternalEmails.id, firstOpenAt: taskipInternalEmails.firstOpenAt })
      .from(taskipInternalEmails)
      .where(eq(taskipInternalEmails.id, id))
      .limit(1);
    if (!row) return { ok: false };
    const now = new Date();
    await this.db.db
      .update(taskipInternalEmails)
      .set({
        openCount: sql`COALESCE(${taskipInternalEmails.openCount}, 0) + 1`,
        firstOpenAt: row.firstOpenAt ?? now,
        lastOpenAt: now,
      })
      .where(eq(taskipInternalEmails.id, id));
    return { ok: true };
  }

  private fromIsSelf(from: string): boolean {
    if (!from) return false;
    const lower = from.toLowerCase();
    return lower.includes('sharifur') || lower.includes('xgenious') || lower.includes('taskip.net');
  }
}
