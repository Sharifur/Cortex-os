import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq, ne, asc, desc } from 'drizzle-orm';
import { ImapFlow } from 'imapflow';
import nodemailer, { Transporter } from 'nodemailer';
import { simpleParser } from 'mailparser';
import { google, gmail_v1 } from 'googleapis';
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
  id: string;       // IMAP UID (imap accounts) or Gmail API messageId (oauth accounts)
  threadId: string; // Message-ID header (imap) or Gmail threadId (oauth)
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
  authType: 'imap' | 'oauth2';
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

interface ResolvedImapAccount {
  kind: 'imap';
  id: string;
  email: string;
  password: string;
  displayName: string | null;
}

interface ResolvedOAuthAccount {
  kind: 'oauth2';
  id: string;
  email: string;
  displayName: string | null;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

type ResolvedAccount = ResolvedImapAccount | ResolvedOAuthAccount;

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
        authType: gmailAccounts.authType,
        isDefault: gmailAccounts.isDefault,
        createdAt: gmailAccounts.createdAt,
      })
      .from(gmailAccounts)
      .orderBy(desc(gmailAccounts.isDefault), asc(gmailAccounts.createdAt));
    return rows.map((r) => ({ ...r, authType: r.authType as 'imap' | 'oauth2' }));
  }

  /** IMAP / App-Password flow. The OAuth flow lives in GmailOAuthService. */
  async createAccount(dto: CreateAccountDto): Promise<GmailAccountSummary> {
    const password = dto.appPassword.replace(/\s+/g, '');
    if (!password) throw new Error('App password is required');
    if (!dto.email?.trim()) throw new Error('Email is required');
    if (!dto.label?.trim()) throw new Error('Label is required');

    const existing = await this.db.db.select({ id: gmailAccounts.id }).from(gmailAccounts);
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
        authType: 'imap',
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

  /** Used by the per-row Test button. Probes whichever auth path the account uses. */
  async testAccount(id: string): Promise<{ ok: boolean; message: string }> {
    let acc: ResolvedAccount;
    try {
      acc = await this.resolveAccount(id);
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
    try {
      if (acc.kind === 'imap') {
        const client = new ImapFlow({
          host: 'imap.gmail.com',
          port: 993,
          secure: true,
          auth: { user: acc.email, pass: acc.password },
          logger: false,
        });
        await client.connect();
        await client.logout().catch(() => undefined);
        return { ok: true, message: `Connected as ${acc.email} (IMAP)` };
      }
      // OAuth2: hit the profile endpoint to confirm the refresh token works.
      const gmail = this.gmailApi(acc);
      const profile = await gmail.users.getProfile({ userId: 'me' });
      return { ok: true, message: `Connected as ${profile.data.emailAddress ?? acc.email} (OAuth2)` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  // ─── IMAP / SMTP / OAuth2 operations ─────────────────────────────────────

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
    const fromHeader = params.from || (acc.displayName ? `${acc.displayName} <${acc.email}>` : acc.email);

    if (acc.kind === 'imap') {
      const transporter = this.smtpTransport(acc);
      const info = await transporter.sendMail({
        from: fromHeader,
        to: params.to,
        subject: params.subject,
        text: params.textBody,
      });
      this.logger.log(`Gmail/IMAP (${acc.email}) sent to ${params.to} — messageId: ${info.messageId}`);
      return info.messageId ?? '';
    }

    // OAuth2 → Gmail API users.messages.send
    const gmail = this.gmailApi(acc);
    const raw = Buffer.from(
      [
        `From: ${fromHeader}`,
        `To: ${params.to}`,
        `Subject: ${params.subject}`,
        `MIME-Version: 1.0`,
        `Content-Type: text/plain; charset=UTF-8`,
        ``,
        params.textBody,
      ].join('\r\n'),
    ).toString('base64url');
    const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
    const messageId = res.data.id ?? '';
    this.logger.log(`Gmail/OAuth (${acc.email}) sent to ${params.to} — messageId: ${messageId}`);
    return messageId;
  }

  async listUnread(maxResults = 20, accountId?: string): Promise<GmailMessage[]> {
    const acc = await this.resolveAccount(accountId);
    if (acc.kind === 'imap') {
      return this.withImap(acc, async (client) => {
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
    const gmail = this.gmailApi(acc);
    const list = await gmail.users.messages.list({ userId: 'me', q: 'is:unread in:inbox', maxResults });
    const ids = list.data.messages ?? [];
    if (!ids.length) return [];
    const messages = await Promise.all(
      ids.map((m) => gmail.users.messages.get({ userId: 'me', id: m.id!, format: 'full' })),
    );
    return messages.map((res) => this.parseGmailApi(res.data));
  }

  async getMessage(id: string, accountId?: string): Promise<GmailMessage> {
    const acc = await this.resolveAccount(accountId);
    if (acc.kind === 'imap') {
      const uid = Number(id);
      return this.withImap(acc, async (client) => {
        const lock = await client.getMailboxLock('INBOX');
        try {
          const msg = await client.fetchOne(uid, { uid: true, source: true, envelope: true, internalDate: true }, { uid: true });
          if (!msg) throw new Error(`Gmail message not found: ${id}`);
          return this.parseFetched(msg);
        } finally {
          lock.release();
        }
      });
    }
    const gmail = this.gmailApi(acc);
    const res = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
    return this.parseGmailApi(res.data);
  }

  async getThread(threadId: string, accountId?: string): Promise<GmailThread> {
    const acc = await this.resolveAccount(accountId);
    if (acc.kind === 'imap') {
      return this.withImap(acc, async (client) => {
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
    const gmail = this.gmailApi(acc);
    const res = await gmail.users.threads.get({ userId: 'me', id: threadId, format: 'full' });
    const messages = (res.data.messages ?? []).map((m) => this.parseGmailApi(m));
    return { id: threadId, messages };
  }

  async archiveMessage(id: string, accountId?: string): Promise<void> {
    const acc = await this.resolveAccount(accountId);
    if (acc.kind === 'imap') {
      const uid = Number(id);
      await this.withImap(acc, async (client) => {
        const lock = await client.getMailboxLock('INBOX');
        try {
          await client.messageMove(uid, '[Gmail]/All Mail', { uid: true }).catch(() => undefined);
        } finally {
          lock.release();
        }
      });
      return;
    }
    const gmail = this.gmailApi(acc);
    await gmail.users.messages.modify({ userId: 'me', id, requestBody: { removeLabelIds: ['INBOX'] } });
  }

  async addLabel(id: string, labelName: string, accountId?: string): Promise<void> {
    const acc = await this.resolveAccount(accountId);
    if (acc.kind === 'imap') {
      const uid = Number(id);
      await this.withImap(acc, async (client) => {
        const folder = `[Gmail]/${labelName}`;
        try { await client.mailboxCreate(folder); } catch { /* already exists */ }
        const lock = await client.getMailboxLock('INBOX');
        try {
          await client.messageCopy(uid, folder, { uid: true }).catch(() => undefined);
        } finally {
          lock.release();
        }
      });
      return;
    }
    const gmail = this.gmailApi(acc);
    const labelsRes = await gmail.users.labels.list({ userId: 'me' });
    let label = (labelsRes.data.labels ?? []).find((l) => l.name?.toLowerCase() === labelName.toLowerCase());
    if (!label) {
      const created = await gmail.users.labels.create({
        userId: 'me',
        requestBody: { name: labelName, labelListVisibility: 'labelShow', messageListVisibility: 'show' },
      });
      label = created.data;
    }
    if (label?.id) {
      await gmail.users.messages.modify({ userId: 'me', id, requestBody: { addLabelIds: [label.id] } });
    }
  }

  async markRead(id: string, accountId?: string): Promise<void> {
    const acc = await this.resolveAccount(accountId);
    if (acc.kind === 'imap') {
      const uid = Number(id);
      await this.withImap(acc, async (client) => {
        const lock = await client.getMailboxLock('INBOX');
        try {
          await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
        } finally {
          lock.release();
        }
      });
      return;
    }
    const gmail = this.gmailApi(acc);
    await gmail.users.messages.modify({ userId: 'me', id, requestBody: { removeLabelIds: ['UNREAD'] } });
  }

  // ─── internals ───────────────────────────────────────────────────────────

  private async resolveAccount(accountId?: string): Promise<ResolvedAccount> {
    const where = accountId
      ? eq(gmailAccounts.id, accountId)
      : eq(gmailAccounts.isDefault, true);
    let [row] = await this.db.db.select().from(gmailAccounts).where(where).limit(1);
    if (!row && !accountId) {
      [row] = await this.db.db.select().from(gmailAccounts).orderBy(asc(gmailAccounts.createdAt)).limit(1);
    }
    if (!row) {
      throw new Error('No Gmail accounts configured — add one in Integrations → Gmail');
    }

    if (row.authType === 'oauth2') {
      if (!row.oauthClientId || !row.oauthClientSecretEncrypted || !row.oauthRefreshTokenEncrypted) {
        throw new Error(`Gmail account ${row.email} is missing OAuth credentials — reconnect it`);
      }
      return {
        kind: 'oauth2',
        id: row.id,
        email: row.email,
        displayName: row.displayName,
        clientId: row.oauthClientId,
        clientSecret: decrypt(row.oauthClientSecretEncrypted),
        refreshToken: decrypt(row.oauthRefreshTokenEncrypted),
      };
    }

    if (!row.appPasswordEncrypted) {
      throw new Error(`Gmail account ${row.email} has no App Password set — edit it`);
    }
    return {
      kind: 'imap',
      id: row.id,
      email: row.email,
      password: decrypt(row.appPasswordEncrypted),
      displayName: row.displayName,
    };
  }

  private async withImap<T>(acc: ResolvedImapAccount, fn: (client: ImapFlow) => Promise<T>): Promise<T> {
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

  private smtpTransport(acc: ResolvedImapAccount): Transporter {
    return nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: acc.email, pass: acc.password },
    });
  }

  private gmailApi(acc: ResolvedOAuthAccount): gmail_v1.Gmail {
    const auth = new google.auth.OAuth2(acc.clientId, acc.clientSecret);
    auth.setCredentials({ refresh_token: acc.refreshToken });
    return google.gmail({ version: 'v1', auth });
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

  private parseGmailApi(data: gmail_v1.Schema$Message): GmailMessage {
    const headers: Record<string, string> = {};
    for (const h of data.payload?.headers ?? []) {
      if (h.name && h.value) headers[h.name.toLowerCase()] = h.value;
    }
    return {
      id: data.id ?? '',
      threadId: data.threadId ?? '',
      from: headers['from'] ?? '',
      subject: headers['subject'] ?? '(no subject)',
      snippet: data.snippet ?? '',
      body: this.extractBody(data.payload),
      receivedAt: new Date(parseInt(data.internalDate ?? '0', 10)),
    };
  }

  private extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
    if (!payload) return '';
    if (payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64url').toString('utf-8');
    }
    for (const part of payload.parts ?? []) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64url').toString('utf-8');
      }
    }
    for (const part of payload.parts ?? []) {
      const nested = this.extractBody(part);
      if (nested) return nested;
    }
    return '';
  }

  private toSummary(row: typeof gmailAccounts.$inferSelect): GmailAccountSummary {
    return {
      id: row.id,
      label: row.label,
      email: row.email,
      displayName: row.displayName,
      authType: row.authType as 'imap' | 'oauth2',
      isDefault: row.isDefault,
      createdAt: row.createdAt,
    };
  }
}
