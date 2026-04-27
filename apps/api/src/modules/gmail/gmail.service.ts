import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { SettingsService } from '../settings/settings.service';

export interface GmailSendParams {
  to: string;
  from: string;
  subject: string;
  textBody: string;
}

export interface GmailMessage {
  id: string;
  threadId: string;
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

@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);

  constructor(private readonly settings: SettingsService) {}

  async isConfigured(): Promise<boolean> {
    const [id, secret, token] = await Promise.all([
      this.settings.getDecrypted('gmail_client_id'),
      this.settings.getDecrypted('gmail_client_secret'),
      this.settings.getDecrypted('gmail_refresh_token'),
    ]);
    return !!(id && secret && token);
  }

  async sendEmail(params: GmailSendParams): Promise<string> {
    const [clientId, clientSecret, refreshToken] = await Promise.all([
      this.settings.getDecrypted('gmail_client_id'),
      this.settings.getDecrypted('gmail_client_secret'),
      this.settings.getDecrypted('gmail_refresh_token'),
    ]);

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Gmail credentials not configured — set them in Settings → Gmail');
    }

    const auth = new google.auth.OAuth2(clientId, clientSecret);
    auth.setCredentials({ refresh_token: refreshToken });
    const gmail = google.gmail({ version: 'v1', auth });

    const raw = this.buildRaw(params);
    const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });

    const messageId = res.data.id ?? '';
    this.logger.log(`Gmail sent to ${params.to} — messageId: ${messageId}`);
    return messageId;
  }

  async getAuthClient() {
    const [clientId, clientSecret, refreshToken] = await Promise.all([
      this.settings.getDecrypted('gmail_client_id'),
      this.settings.getDecrypted('gmail_client_secret'),
      this.settings.getDecrypted('gmail_refresh_token'),
    ]);
    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Gmail credentials not configured — set them in Settings → Gmail');
    }
    const auth = new google.auth.OAuth2(clientId, clientSecret);
    auth.setCredentials({ refresh_token: refreshToken });
    return google.gmail({ version: 'v1', auth });
  }

  async listUnread(maxResults = 20): Promise<GmailMessage[]> {
    const gmail = await this.getAuthClient();
    const list = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread in:inbox',
      maxResults,
    });
    const ids = list.data.messages ?? [];
    if (!ids.length) return [];

    const messages = await Promise.all(
      ids.map((m) =>
        gmail.users.messages.get({ userId: 'me', id: m.id!, format: 'full' }),
      ),
    );

    return messages.map((res) => this.parseMessage(res.data));
  }

  async getMessage(messageId: string): Promise<GmailMessage> {
    const gmail = await this.getAuthClient();
    const res = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
    return this.parseMessage(res.data);
  }

  async getThread(threadId: string): Promise<GmailThread> {
    const gmail = await this.getAuthClient();
    const res = await gmail.users.threads.get({ userId: 'me', id: threadId, format: 'full' });
    const messages = (res.data.messages ?? []).map((m) => this.parseMessage(m));
    return { id: threadId, messages };
  }

  async archiveMessage(messageId: string): Promise<void> {
    const gmail = await this.getAuthClient();
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: { removeLabelIds: ['INBOX'] },
    });
  }

  async addLabel(messageId: string, labelName: string): Promise<void> {
    const gmail = await this.getAuthClient();
    const labelsRes = await gmail.users.labels.list({ userId: 'me' });
    let label = (labelsRes.data.labels ?? []).find(
      (l) => l.name?.toLowerCase() === labelName.toLowerCase(),
    );
    if (!label) {
      const created = await gmail.users.labels.create({
        userId: 'me',
        requestBody: { name: labelName, labelListVisibility: 'labelShow', messageListVisibility: 'show' },
      });
      label = created.data;
    }
    if (label?.id) {
      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: { addLabelIds: [label.id] },
      });
    }
  }

  async markRead(messageId: string): Promise<void> {
    const gmail = await this.getAuthClient();
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: { removeLabelIds: ['UNREAD'] },
    });
  }

  private parseMessage(data: any): GmailMessage {
    const headers: Record<string, string> = {};
    for (const h of data.payload?.headers ?? []) {
      headers[h.name.toLowerCase()] = h.value;
    }
    const body = this.extractBody(data.payload);
    return {
      id: data.id ?? '',
      threadId: data.threadId ?? '',
      from: headers['from'] ?? '',
      subject: headers['subject'] ?? '(no subject)',
      snippet: data.snippet ?? '',
      body,
      receivedAt: new Date(parseInt(data.internalDate ?? '0', 10)),
    };
  }

  private extractBody(payload: any): string {
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

  private buildRaw(params: GmailSendParams): string {
    const lines = [
      `From: ${params.from}`,
      `To: ${params.to}`,
      `Subject: ${params.subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=UTF-8`,
      ``,
      params.textBody,
    ].join('\r\n');
    return Buffer.from(lines).toString('base64url');
  }
}
