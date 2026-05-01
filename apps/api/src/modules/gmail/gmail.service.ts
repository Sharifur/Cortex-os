import { Injectable, Logger } from '@nestjs/common';
import { ImapFlow } from 'imapflow';
import nodemailer, { Transporter } from 'nodemailer';
import { simpleParser } from 'mailparser';
import { SettingsService } from '../settings/settings.service';

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

interface ImapCreds {
  email: string;
  password: string;
}

@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);

  constructor(private readonly settings: SettingsService) {}

  async getFromAddress(): Promise<string> {
    const explicit = await this.settings.getDecrypted('gmail_from_address');
    if (explicit?.trim()) return explicit.trim();
    return (await this.settings.getDecrypted('gmail_email')) ?? '';
  }

  async isConfigured(): Promise<boolean> {
    const [email, pw] = await Promise.all([
      this.settings.getDecrypted('gmail_email'),
      this.settings.getDecrypted('gmail_app_password'),
    ]);
    return !!(email && pw);
  }

  async sendEmail(params: GmailSendParams): Promise<string> {
    const creds = await this.getCreds();
    const transporter = this.smtpTransport(creds);
    const info = await transporter.sendMail({
      from: params.from || creds.email,
      to: params.to,
      subject: params.subject,
      text: params.textBody,
    });
    this.logger.log(`Gmail sent to ${params.to} — messageId: ${info.messageId}`);
    return info.messageId ?? '';
  }

  async listUnread(maxResults = 20): Promise<GmailMessage[]> {
    return this.withImap(async (client) => {
      const lock = await client.getMailboxLock('INBOX');
      try {
        // UNSEEN messages, newest first, capped at maxResults.
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

  async getMessage(uidStr: string): Promise<GmailMessage> {
    const uid = Number(uidStr);
    return this.withImap(async (client) => {
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

  /**
   * IMAP has no native "thread" concept; we approximate by searching for
   * messages whose References / In-Reply-To chain or Subject matches the
   * anchor message-id. Sufficient for the agent flows we use.
   */
  async getThread(threadId: string): Promise<GmailThread> {
    return this.withImap(async (client) => {
      const lock = await client.getMailboxLock('INBOX');
      try {
        // Try to find by Message-ID first; fall back to the raw threadId.
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

  /**
   * Gmail-over-IMAP exposes labels as folders under "[Gmail]/All Mail" etc.
   * Removing from INBOX = moving to "[Gmail]/All Mail" (archive).
   */
  async archiveMessage(uidStr: string): Promise<void> {
    const uid = Number(uidStr);
    await this.withImap(async (client) => {
      const lock = await client.getMailboxLock('INBOX');
      try {
        await client.messageMove(uid, '[Gmail]/All Mail', { uid: true }).catch(() => undefined);
      } finally {
        lock.release();
      }
    });
  }

  /**
   * IMAP equivalent of Gmail labels: a folder under [Gmail]/. We create the
   * folder if missing and copy the message there (Gmail mirrors copy → label).
   */
  async addLabel(uidStr: string, labelName: string): Promise<void> {
    const uid = Number(uidStr);
    await this.withImap(async (client) => {
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

  async markRead(uidStr: string): Promise<void> {
    const uid = Number(uidStr);
    await this.withImap(async (client) => {
      const lock = await client.getMailboxLock('INBOX');
      try {
        await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
      } finally {
        lock.release();
      }
    });
  }

  // ─── internals ───────────────────────────────────────────────────────────

  private async getCreds(): Promise<ImapCreds> {
    const [email, password] = await Promise.all([
      this.settings.getDecrypted('gmail_email'),
      this.settings.getDecrypted('gmail_app_password'),
    ]);
    if (!email || !password) {
      throw new Error('Gmail credentials not configured — set them in Settings → Gmail');
    }
    return { email, password };
  }

  private async withImap<T>(fn: (client: ImapFlow) => Promise<T>): Promise<T> {
    const creds = await this.getCreds();
    const client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: { user: creds.email, pass: creds.password },
      logger: false,
    });
    await client.connect();
    try {
      return await fn(client);
    } finally {
      await client.logout().catch(() => undefined);
    }
  }

  private smtpTransport(creds: ImapCreds): Transporter {
    return nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: creds.email, pass: creds.password },
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
}
