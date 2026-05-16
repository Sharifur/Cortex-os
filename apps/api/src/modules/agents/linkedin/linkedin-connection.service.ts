import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';
import type { UnipileProfile } from './linkedin.service';

@Injectable()
export class LinkedInConnectionService {
  private readonly logger = new Logger(LinkedInConnectionService.name);

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
   * Send a LinkedIn connection request via Unipile.
   * Docs: https://developer.unipile.com/docs/invite-users
   */
  async sendConnectionRequest(accountId: string, profileId: string, note: string): Promise<void> {
    const { unipileKey, unipileDsn } = await this.getCredentials();
    if (!unipileKey || !unipileDsn) throw new Error('Unipile not configured');

    this.logger.log(`sendConnectionRequest: profileId=${profileId} accountId=${accountId}`);
    const res = await fetch(`${this.unipileBase(unipileDsn)}/users/invite`, {
      method: 'POST',
      headers: this.unipileHeaders(unipileKey),
      body: JSON.stringify({ account_id: accountId, provider_id: profileId, message: note }),
    });
    if (!res.ok) {
      const raw = await res.text();
      throw new Error(`Unipile connection request failed (${res.status}): ${raw.slice(0, 300)}`);
    }
  }

  /**
   * Fetch existing LinkedIn connections (people already connected).
   * Docs: GET /api/v1/users/relations
   */
  async getConnections(accountId: string, limit = 100): Promise<UnipileProfile[]> {
    const { unipileKey, unipileDsn } = await this.getCredentials();
    if (!unipileKey || !unipileDsn) return [];
    try {
      const res = await fetch(
        `${this.unipileBase(unipileDsn)}/users/relations?account_id=${encodeURIComponent(accountId)}&limit=${limit}`,
        { headers: this.unipileHeaders(unipileKey) },
      );
      if (!res.ok) {
        this.logger.warn(`getConnections failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
        return [];
      }
      const data = await res.json() as any;
      return (data.items ?? []).map((p: any) => ({
        id: p.provider_id ?? p.member_id ?? p.id ?? '',
        public_identifier: p.public_identifier ?? '',
        first_name: p.first_name ?? '',
        last_name: p.last_name ?? '',
        headline: p.headline ?? '',
        profile_url: p.public_profile_url ?? `https://www.linkedin.com/in/${p.public_identifier ?? ''}`,
      })) as UnipileProfile[];
    } catch (err) {
      this.logger.warn(`getConnections error: ${(err as Error).message}`);
      return [];
    }
  }

  /**
   * Search LinkedIn for people matching keywords.
   * Docs: https://developer.unipile.com/docs/linkedin-search
   */
  async searchPeople(
    accountId: string,
    keywords: string,
    filters: { jobTitles?: string[]; industries?: string[] } = {},
  ): Promise<UnipileProfile[]> {
    const { unipileKey, unipileDsn } = await this.getCredentials();
    if (!unipileKey || !unipileDsn) return [];
    try {
      const body: Record<string, any> = { api: 'classic', category: 'people', keywords, limit: 25 };
      if (filters.jobTitles?.length) body['title'] = filters.jobTitles[0];

      const res = await fetch(
        `${this.unipileBase(unipileDsn)}/linkedin/search?account_id=${encodeURIComponent(accountId)}`,
        { method: 'POST', headers: this.unipileHeaders(unipileKey), body: JSON.stringify(body) },
      );
      if (!res.ok) {
        this.logger.warn(`searchPeople failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
        return [];
      }
      const data = await res.json() as any;
      return (data.items ?? data.results ?? []).map((p: any) => ({
        id: p.provider_id ?? p.id ?? p.member_urn ?? '',
        public_identifier: p.public_identifier ?? p.username ?? '',
        first_name: p.first_name ?? '',
        last_name: p.last_name ?? '',
        headline: p.headline ?? p.sub_title ?? '',
        profile_url: p.public_profile_url ?? p.profile_url ?? `https://www.linkedin.com/in/${p.public_identifier ?? ''}`,
        network_distance: p.distance ?? p.network_distance ?? '',
      })) as UnipileProfile[];
    } catch (err) {
      this.logger.warn(`searchPeople error: ${(err as Error).message}`);
      return [];
    }
  }

  async getProfile(accountId: string, profileIdentifier: string): Promise<UnipileProfile | null> {
    const { unipileKey, unipileDsn } = await this.getCredentials();
    if (!unipileKey || !unipileDsn) return null;
    try {
      const res = await fetch(
        `${this.unipileBase(unipileDsn)}/users/${encodeURIComponent(profileIdentifier)}?account_id=${encodeURIComponent(accountId)}`,
        { headers: this.unipileHeaders(unipileKey) },
      );
      if (!res.ok) return null;
      const p = await res.json() as any;
      return {
        id: p.provider_id ?? p.id ?? p.member_urn ?? '',
        public_identifier: p.public_identifier ?? p.username ?? '',
        first_name: p.first_name ?? '',
        last_name: p.last_name ?? '',
        headline: p.headline ?? p.sub_title ?? '',
        profile_url: p.public_profile_url ?? `https://www.linkedin.com/in/${p.public_identifier ?? ''}`,
      };
    } catch {
      return null;
    }
  }
}
