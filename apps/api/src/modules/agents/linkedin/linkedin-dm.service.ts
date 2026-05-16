import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';

@Injectable()
export class LinkedInDmService {
  private readonly logger = new Logger(LinkedInDmService.name);

  constructor(private readonly settings: SettingsService) {}

  private async getCredentials() {
    const [unipileKey, unipileDsn] = await Promise.all([
      this.settings.getDecrypted('unipile_api_key'),
      this.settings.getDecrypted('unipile_dsn'),
    ]);
    return { unipileKey, unipileDsn };
  }

  private unipileBase(dsn: string) { return `https://${dsn}/api/v1`; }
  private unipileHeaders(key: string) {
    return { 'X-API-KEY': key, 'Content-Type': 'application/json' };
  }

  /**
   * Send a LinkedIn DM to a connected user.
   * Docs: https://developer.unipile.com/docs/send-messages
   * Creates a new chat with the attendee and sends the message.
   */
  async sendDM(profileId: string, message: string, accountId?: string): Promise<void> {
    const { unipileKey, unipileDsn } = await this.getCredentials();
    if (!unipileKey || !unipileDsn) throw new Error('Unipile not configured');

    this.logger.log(`sendDM: profileId=${profileId} accountId=${accountId ?? 'none'} length=${message.length}`);
    const res = await fetch(`${this.unipileBase(unipileDsn)}/chats`, {
      method: 'POST',
      headers: this.unipileHeaders(unipileKey),
      body: JSON.stringify({ account_id: accountId, attendees_ids: [profileId], text: message }),
    });
    if (!res.ok) {
      const raw = await res.text();
      throw new Error(`Unipile DM failed (${res.status}): ${raw.slice(0, 300)}`);
    }
    this.logger.log(`DM sent to ${profileId} (${res.status})`);
  }
}
