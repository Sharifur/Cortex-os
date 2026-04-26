import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export interface GmailSendParams {
  to: string;
  from: string;
  subject: string;
  textBody: string;
}

// Required env vars:
//   GMAIL_CLIENT_ID      — OAuth2 client ID from Google Cloud Console
//   GMAIL_CLIENT_SECRET  — OAuth2 client secret
//   GMAIL_REFRESH_TOKEN  — refresh token obtained via OAuth2 consent flow
//   GMAIL_FROM           — sender address, e.g. "Sharifur <sharifur@taskip.net>"

@Injectable()
export class GmailService implements OnModuleInit {
  private readonly logger = new Logger(GmailService.name);
  private gmail!: gmail_v1.Gmail;
  private oauth2Client!: OAuth2Client;

  onModuleInit() {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      this.logger.warn('Gmail OAuth2 credentials not set — GmailService disabled');
      return;
    }

    this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    this.oauth2Client.setCredentials({ refresh_token: refreshToken });
    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    this.logger.log('GmailService ready');
  }

  isConfigured(): boolean {
    return !!this.gmail;
  }

  async sendEmail(params: GmailSendParams): Promise<string> {
    if (!this.gmail) {
      throw new Error('GmailService not configured — set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN');
    }

    const raw = this.buildRawMessage(params);

    const res = await this.gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    const messageId = res.data.id ?? '';
    this.logger.log(`Gmail sent to ${params.to} — messageId: ${messageId}`);
    return messageId;
  }

  private buildRawMessage(params: GmailSendParams): string {
    const boundary = `boundary_${Date.now()}`;
    const headers = [
      `From: ${params.from}`,
      `To: ${params.to}`,
      `Subject: ${params.subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=UTF-8`,
    ].join('\r\n');

    const message = `${headers}\r\n\r\n${params.textBody}`;
    return Buffer.from(message).toString('base64url');
  }
}
