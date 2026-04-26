import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { SettingsService } from '../settings/settings.service';

export interface GmailSendParams {
  to: string;
  from: string;
  subject: string;
  textBody: string;
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
