import { Injectable, Logger } from '@nestjs/common';

export interface WaMessage {
  id: string;
  from: string;
  name: string | null;
  body: string;
  timestamp: number;
  type: string;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly token = process.env.WHATSAPP_API_TOKEN;
  private readonly phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  private readonly apiBase = 'https://graph.facebook.com/v20.0';

  isConfigured() {
    return !!(this.token && this.phoneNumberId);
  }

  async sendMessage(to: string, body: string): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn('WhatsApp API not configured — skipping send');
      return;
    }

    const res = await fetch(`${this.apiBase}/${this.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`WhatsApp send failed: ${err}`);
    }
  }

  parseWebhookMessages(body: unknown): WaMessage[] {
    try {
      const b = body as any;
      const entry = b?.entry?.[0];
      const changes = entry?.changes?.[0];
      const messages = changes?.value?.messages ?? [];
      const contacts = changes?.value?.contacts ?? [];

      return messages.map((m: any) => ({
        id: m.id,
        from: m.from,
        name: contacts.find((c: any) => c.wa_id === m.from)?.profile?.name ?? null,
        body: m.text?.body ?? m.caption ?? `[${m.type}]`,
        timestamp: parseInt(m.timestamp, 10),
        type: m.type,
      }));
    } catch {
      return [];
    }
  }

  isOfflineHours(tz = 'Asia/Dhaka', offlineStart = 21, offlineEnd = 10): boolean {
    const hour = new Date(
      new Date().toLocaleString('en-US', { timeZone: tz }),
    ).getHours();
    if (offlineStart > offlineEnd) {
      return hour >= offlineStart || hour < offlineEnd;
    }
    return hour >= offlineStart && hour < offlineEnd;
  }
}
