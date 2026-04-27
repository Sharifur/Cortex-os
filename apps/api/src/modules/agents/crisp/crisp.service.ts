import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';

interface CrispMessage {
  sessionId: string;
  websiteId: string;
  visitorEmail?: string;
  visitorNickname?: string;
  content: string;
  timestamp: number;
}

@Injectable()
export class CrispService {
  private readonly logger = new Logger(CrispService.name);

  constructor(private settings: SettingsService) {}

  async isConfigured(): Promise<boolean> {
    const [id, key, websiteId] = await Promise.all([
      this.settings.getDecrypted('crisp_api_identifier'),
      this.settings.getDecrypted('crisp_api_key'),
      this.settings.getDecrypted('crisp_website_id'),
    ]);
    return !!(id && key && websiteId);
  }

  private async getCredentials() {
    const [identifier, key, websiteId] = await Promise.all([
      this.settings.getDecrypted('crisp_api_identifier'),
      this.settings.getDecrypted('crisp_api_key'),
      this.settings.getDecrypted('crisp_website_id'),
    ]);
    if (!identifier || !key || !websiteId) throw new Error('Crisp credentials not configured');
    return { identifier, key, websiteId };
  }

  private authHeader(identifier: string, key: string): string {
    return `Basic ${Buffer.from(`${identifier}:${key}`).toString('base64')}`;
  }

  async getOpenConversations(limit = 20): Promise<CrispMessage[]> {
    const { identifier, key, websiteId } = await this.getCredentials();

    const res = await fetch(
      `https://api.crisp.chat/v1/website/${websiteId}/conversations/1?filter_unread=1`,
      { headers: { Authorization: this.authHeader(identifier, key), 'X-Crisp-Tier': 'plugin' } },
    );

    if (!res.ok) {
      this.logger.warn(`Crisp API error: ${res.status} ${await res.text()}`);
      return [];
    }

    const data = await res.json();
    const conversations: CrispMessage[] = [];

    for (const conv of (data.data ?? []).slice(0, limit)) {
      const sessionId = conv.session_id;
      const lastMsg = conv.last_message;
      if (!lastMsg?.content) continue;

      conversations.push({
        sessionId,
        websiteId,
        visitorEmail: conv.meta?.email ?? undefined,
        visitorNickname: conv.meta?.nickname ?? undefined,
        content: typeof lastMsg.content === 'string' ? lastMsg.content : JSON.stringify(lastMsg.content),
        timestamp: lastMsg.timestamp,
      });
    }

    return conversations;
  }

  async sendReply(sessionId: string, message: string): Promise<void> {
    const { identifier, key, websiteId } = await this.getCredentials();

    const res = await fetch(
      `https://api.crisp.chat/v1/website/${websiteId}/conversation/${sessionId}/message`,
      {
        method: 'POST',
        headers: {
          Authorization: this.authHeader(identifier, key),
          'X-Crisp-Tier': 'plugin',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'text', from: 'operator', origin: 'chat', content: message }),
      },
    );

    if (!res.ok) throw new Error(`Crisp send reply failed: ${res.status} ${await res.text()}`);
  }

  parseWebhookMessage(body: any): CrispMessage | null {
    try {
      if (body.event !== 'message:send') return null;
      if (body.data?.from !== 'user') return null;

      return {
        sessionId: body.data.session_id,
        websiteId: body.website_id,
        visitorEmail: body.data.user?.email ?? undefined,
        visitorNickname: body.data.user?.nickname ?? undefined,
        content: body.data.content,
        timestamp: body.data.timestamp,
      };
    } catch {
      return null;
    }
  }
}
