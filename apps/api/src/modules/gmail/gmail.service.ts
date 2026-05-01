import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq, ne, asc, desc } from 'drizzle-orm';
import { ImapFlow } from 'imapflow';
import nodemailer, { Transporter } from 'nodemailer';
import { simpleParser } from 'mailparser';
import { DbService } from '../../db/db.service';
import { gmailAccounts } from './schema';
import { encrypt, decrypt } from '../../common/crypto/crypto.util';

export interface GmailSendParams {
  to: string;
  from: string;
  subject: string;
  textBody: string;
}

export interface GmailMessage {
  id: string;       // IMAP UID (as string)
  threadId: string; // Message-ID header — used as the thread anchor for replies
  from: string;
  subject: string;
  snippet: string;
  body: string;
  receivedAt: Date;
}

export interface GmailThread {
  id: string;
  messages: GmailMessage[];
}

export interface GmailAccountSummary {
  id: string;
  label: string;
  email: string;
  displayName: string | null;
  isDefault: boolean;
  createdAt: Date;
}

export interface CreateAccountDto {
  label: string;
  email: string;
  displayName?: string | null;
  appPassword: string;
  isDefault?: boolean;
}

export interface UpdateAccountDto {
  label?: string;
  displayName?: string | null;
  appPassword?: string;
}

interface ResolvedAccount {
  id: string;
  email: string;
  password: string;
  displayName: string | null;
}

@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);

  constructor(private readonly db: DbService) {}

  // ─── Account CRUD ────────────────────────────────────────────────────────

  async listAccounts(): Promise<GmailAccountSummary[]> {
    const rows = await this.db.db
      .select({
        id: gmailAccounts.id,
        label: gmailAccounts.label,
        email: gmailAccounts.email,
        displayName: gmailAccounts.displayName,
        isDefault: gmailAccounts.isDefault,
        createdAt: gmailAccounts.createdAt,
      })
      .from(gmailAccounts)
      .orderBy(desc(gmailAccounts.isDefault), asc(gmailAccounts.createdAt));
    return rows;
  }

  async createAccount(dto: CreateAccountDto): Promise<GmailAccountSummary> {
    const password = dto.appPassword.replace(/\s+/g, '');
    if (!password) throw new Error('App password is required');
    if (!dto.email?.trim()) throw new Error('Email is required');
    if (!dto.label?.trim()) throw new Error('Label is required');

    const existing = await this.db.db.select({ count: gmailAccounts.id }).from(gmailAccounts);
    const isFirst = existing.length === 0;
    const wantDefault = dto.isDefault === true || isFirst;

    if (wantDefault) {
      await this.db.db.update(gmailAccounts).set({ isDefault: false });
    }

    const [row] = await this.db.db
      .insert(gmailAccounts)
      .values({
        label: dto.label.trim(),
        email: dto.email.trim().toLowerCase(),
        displayName: dto.displayName?.trim() || null,
        appPasswordEncrypted: encrypt(password),
        isDefault: wantDefault,
      })
      .returning();
    return this.toSummary(row);
  }

  async updateAccount(id: string, dto: UpdateAccountDto): Promise<GmailAccountSummary> {
    const update: Partial<typeof gmailAccounts.$inferInsert> = { updatedAt: new Date() };
    if (dto.label !== undefined) update.label = dto.label.trim();
    if (dto.displayName !== undefined) update.displayName = dto.displayName?.trim() || null;
    if (dto.appPassword !== undefined && dto.appPassword.trim()) {
      update.appPasswordEncrypted = encrypt(dto.appPassword.replace(/\s+/g, ''));
    }
    const [row] = await this.db.db
      .update(gmailAccounts)
      .set(update)
      .where(eq(gmailAccounts.id, id))
      .returning();
    if (!row) throw new NotFoundException(`Gmail account not found: ${id}`);
    return this.toSummary(row);
  }

  async deleteAccount(id: string): Promise<void> {
    const [row] = await this.db.db.delete(gmailAccounts).where(eq(gmailAccounts.id, id)).returning();
    if (!row) throw new NotFoundException(`Gmail account not found: ${id}`);
    // If the deleted row was the default, promote the oldest remaining row.
    if (row.isDefault) {
      const [next] = await this.db.db.select().from(gmailAccounts).orderBy(asc(gmailAccounts.createdAt)).limit(1);
      if (next) await this.db.db.update(gmailAccounts).set({ isDefault: true }).where(eq(gmailAccounts.id, next.id));
    }
  }

  async setDefaultAccount(id: string): Promise<void> {
    const [target] = await this.db.db.select().from(gmailAccounts).where(eq(gmailAccounts.id, id)).limit(1);
    if (!target) throw new NotFoundException(`Gmail account not found: ${id}`);
    await this.db.db.update(gmailAccounts).set({ isDefault: false }).where(ne(gmailAccounts.id, id));
    await this.db.db.update(gmailAccounts).set({ isDefault: true }).where(eq(gmailAccounts.id, id));
  }

  /** Returns ok / message — used by the Test button on each account row. */
  async testAccount(id: string): Promise<{ ok: boolean; message: string }> {
    const acc = await this.resolveAccount(id);
    const client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: { user: acc.email, pass: acc.password },
      logger: false,
    });
    try {
      await client.connect();
      await client.logout().catch(() => undefined);
      return { ok: true, message: `Connected as ${acc.email}` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  // ─── IMAP / SMTP operations ──────────────────────────────────────────────

  async getFromAddress(accountId?: string): Promise<string> {
    const acc = await this.resolveAccount(accountId);
    return acc.displayName ? `${acc.displayName} <${acc.email}>` : acc.email;
  }

  async isConfigured(): Promise<boolean> {
    const rows = await this.db.db.select({ id: gmailAccounts.id }).from(gmailAccounts).limit(1);
    return rows.length > 0;
  }

  async sendEmail(params: GmailSendParams, accountId?: string): Promise<string> {
    const acc = await this.resolveAccount(accountId);
    const transporter = this.smtpTransport(acc);
    const info = await transporter.sendMail({
      from: params.from || (acc.displayName ? `${acc.displayName} <${acc.email}>` : acc.email),
      to: params.to,
      subject: params.subject,
      text: params.textBody,
    });
    this.logger.log(`Gmail (${acc.email}) sent to ${params.to} — messageId: ${info.messageId}`);
    return info.messageId ?? '';
  }

  async listUnread(maxResults = 20, accountId?: string): Promise<GmailMessage[]> {
    return this.withImap(accountId, async (client) => {
      const lock = await client.getMailboxLock('INBOX');
      try {
        const uids = (await client.search({ seen: false }, { uid: true })) || [];
        const slice = uids.slice(-maxResults).reverse();
        if (!slice.length) return [];
        const out: GmailMessage[] = [];
        for await (const msg of client.fetch(slice, { uid: true, source: true, envelope: true, internalDate: true })) {
          out.push(await this.parseFetched(msg));
        }
        return out;
      } finally {
        lock.release();
      }
    });
  }

  async getMessage(uidStr: string, accountId?: string): Promise<GmailMessage> {
    const uid = Number(uidStr);
    return this.withImap(accountId, async (client) => {
      const lock = await client.getMailboxLock('INBOX');
      try {
        const msg = await client.fetchOne(uid, { uid: true, source: true, envelope: true, internalDate: true }, { uid: true });
        if (!msg) throw new Error(`Gmail message not found: ${uidStr}`);
        return this.parseFetched(msg);
      } finally {
        lock.release();
      }
    });
  }

  async getThread(threadId: string, accountId?: string): Promise<GmailThread> {
    return this.withImap(accountId, async (client) => {
      const lock = await client.getMailboxLock('INBOX');
      try {
        const uids = (await client.search({ header: { 'message-id': threadId } }, { uid: true })) || [];
        if (!uids.length) return { id: threadId, messages: [] };
        const out: GmailMessage[] = [];
        for await (const msg of client.fetch(uids, { uid: true, source: true, envelope: true, internalDate: true })) {
          out.push(await this.parseFetched(msg));
        }
        return { id: threadId, messages: out };
      } finally {
        lock.release();
      }
    });
  }

  async archiveMessage(uidStr: string, accountId?: string): Promise<void> {
    const uid = Number(uidStr);
    await this.withImap(accountId, async (client) => {
      const lock = await client.getMailboxLock('INBOX');
      try {
        await client.messageMove(uid, '[Gmail]/All Mail', { uid: true }).catch(() => undefined);
      } finally {
        lock.release();
      }
    });
  }

  async addLabel(uidStr: string, labelName: string, accountId?: string): Promise<void> {
    const uid = Number(uidStr);
    await this.withImap(accountId, async (client) => {
      const folder = `[Gmail]/${labelName}`;
      try { await client.mailboxCreate(folder); } catch { /* already exists */ }
      const lock = await client.getMailboxLock('INBOX');
      try {
        await client.messageCopy(uid, folder, { uid: true }).catch(() => undefined);
      } finally {
        lock.release();
      }
    });
  }

  async markRead(uidStr: string, accountId?: string): Promise<void> {
    const uid = Number(uidStr);
    await this.withImap(accountId, async (client) => {
      const lock = await client.getMailboxLock('INBOX');
      try {
        await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
      } finally {
        lock.release();
      }
    });
  }

  // ─── internals ───────────────────────────────────────────────────────────

  /**
   * Look up an account by id, or fall back to the default account when no id
   * is given. Throws if no accounts exist or the requested id is missing.
   */
  private async resolveAccount(accountId?: string): Promise<ResolvedAccount> {
    const where = accountId
      ? eq(gmailAccounts.id, accountId)
      : eq(gmailAccounts.isDefault, true);
    let [row] = await this.db.db.select().from(gmailAccounts).where(where).limit(1);
    if (!row && !accountId) {
      // No row marked default — promote the oldest one.
      [row] = await this.db.db.select().from(gmailAccounts).orderBy(asc(gmailAccounts.createdAt)).limit(1);
    }
    if (!row) {
      throw new Error('No Gmail accounts configured — add one in Settings → Integrations → Gmail');
    }
    return {
      id: row.id,
      email: row.email,
      password: decrypt(row.appPasswordEncrypted),
      displayName: row.displayName,
    };
  }

  private async withImap<T>(accountId: string | undefined, fn: (client: ImapFlow) => Promise<T>): Promise<T> {
    const acc = await this.resolveAccount(accountId);
    const client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: { user: acc.email, pass: acc.password },
      logger: false,
    });
    await client.connect();
    try {
      return await fn(client);
    } finally {
      await client.logout().catch(() => undefined);
    }
  }

  private smtpTransport(acc: ResolvedAccount): Transporter {
    return nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: acc.email, pass: acc.password },
    });
  }

  private async parseFetched(msg: { uid?: number; source?: Buffer; envelope?: any; internalDate?: Date | string }): Promise<GmailMessage> {
    const parsed = msg.source ? await simpleParser(msg.source) : null;
    const env = msg.envelope ?? {};
    const fromHeader = parsed?.from?.text ?? (env.from?.[0] ? `${env.from[0].name ?? ''} <${env.from[0].address ?? ''}>` : '');
    const messageId = parsed?.messageId ?? env.messageId ?? '';
    const text = parsed?.text?.trim() ?? '';
    const receivedAt = parsed?.date
      ?? (msg.internalDate ? (msg.internalDate instanceof Date ? msg.internalDate : new Date(msg.internalDate)) : new Date());
    return {
      id: String(msg.uid ?? ''),
      threadId: messageId,
      from: fromHeader,
      subject: parsed?.subject ?? env.subject ?? '(no subject)',
      snippet: text.slice(0, 160),
      body: text,
      receivedAt,
    };
  }

  private toSummary(row: typeof gmailAccounts.$inferSelect): GmailAccountSummary {
    return {
      id: row.id,
      label: row.label,
      email: row.email,
      displayName: row.displayName,
      isDefault: row.isDefault,
      createdAt: row.createdAt,
    };
  }
}
