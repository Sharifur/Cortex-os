import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';

export interface LinkedInPost {
  id: string;
  authorName: string;
  content: string;
  url: string;
}

export interface UnipileAccount {
  id: string;
  name: string;
  type: string;
  connection_status: string;
}

export interface UnipileProfile {
  id: string;
  public_identifier: string;
  first_name: string;
  last_name: string;
  headline: string;
  profile_url: string;
  network_distance?: string;
}

@Injectable()
export class LinkedInService {
  private readonly logger = new Logger(LinkedInService.name);

  constructor(private readonly settings: SettingsService) {}

  private async getCredentials() {
    const [unipileKey, unipileDsn, linkedinToken] = await Promise.all([
      this.settings.getDecrypted('unipile_api_key'),
      this.settings.getDecrypted('unipile_dsn'),
      this.settings.getDecrypted('linkedin_access_token'),
    ]);
    return { unipileKey, unipileDsn, linkedinToken };
  }

  private unipileBase(dsn: string) {
    return `https://${dsn}/api/v1`;
  }

  private unipileHeaders(key: string) {
    return { 'X-API-KEY': key, 'Content-Type': 'application/json' };
  }

  async isConfigured(): Promise<boolean> {
    const { unipileKey, linkedinToken } = await this.getCredentials();
    return !!(unipileKey || linkedinToken);
  }

  // ─── Accounts ──────────────────────────────────────────────────────────────

  async getUnipileAccounts(): Promise<UnipileAccount[]> {
    const { unipileKey, unipileDsn } = await this.getCredentials();
    if (!unipileKey || !unipileDsn) return [];
    try {
      const res = await fetch(
        `${this.unipileBase(unipileDsn)}/accounts?provider=LINKEDIN`,
        { headers: this.unipileHeaders(unipileKey) },
      );
      if (!res.ok) return [];
      const data = await res.json() as any;
      return (data.items ?? data.accounts ?? []) as UnipileAccount[];
    } catch {
      return [];
    }
  }

  // ─── Feed ──────────────────────────────────────────────────────────────────

  async getFeedPosts(limit = 10, accountId?: string): Promise<LinkedInPost[]> {
    const { unipileKey, unipileDsn, linkedinToken } = await this.getCredentials();
    if (!unipileKey && !linkedinToken) {
      this.logger.warn('LinkedIn not configured — returning empty feed');
      return [];
    }
    if (unipileKey && unipileDsn) {
      return this.getFeedViaUnipile(unipileKey, unipileDsn, limit, accountId);
    }
    return this.getFeedDirect(linkedinToken!, limit);
  }

  // ─── Search ────────────────────────────────────────────────────────────────

  async searchPeople(
    accountId: string,
    keywords: string,
    filters: { jobTitles?: string[]; industries?: string[] } = {},
  ): Promise<UnipileProfile[]> {
    const { unipileKey, unipileDsn } = await this.getCredentials();
    if (!unipileKey || !unipileDsn) return [];
    try {
      const params = new URLSearchParams({ account_id: accountId, keywords, limit: '25' });
      if (filters.jobTitles?.length) params.set('title', filters.jobTitles[0]);
      const res = await fetch(
        `${this.unipileBase(unipileDsn)}/linkedin/search/people?${params}`,
        { headers: this.unipileHeaders(unipileKey) },
      );
      if (!res.ok) {
        this.logger.warn(`LinkedIn people search failed: HTTP ${res.status}`);
        return [];
      }
      const data = await res.json() as any;
      return (data.items ?? data.results ?? []).map((p: any) => ({
        id: p.id ?? p.member_urn ?? '',
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
      const params = new URLSearchParams({ account_id: accountId });
      const res = await fetch(
        `${this.unipileBase(unipileDsn)}/linkedin/profile/${encodeURIComponent(profileIdentifier)}?${params}`,
        { headers: this.unipileHeaders(unipileKey) },
      );
      if (!res.ok) return null;
      const p = await res.json() as any;
      return {
        id: p.id ?? p.member_urn ?? '',
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

  // ─── Connection requests ────────────────────────────────────────────────────

  async sendConnectionRequest(accountId: string, profileId: string, note: string): Promise<void> {
    const { unipileKey, unipileDsn } = await this.getCredentials();
    if (!unipileKey || !unipileDsn) {
      this.logger.warn('LinkedIn not configured — skipping connection request');
      return;
    }
    const res = await fetch(`${this.unipileBase(unipileDsn)}/linkedin/relations`, {
      method: 'POST',
      headers: this.unipileHeaders(unipileKey),
      body: JSON.stringify({ account_id: accountId, profile_id: profileId, message: note }),
    });
    if (!res.ok) throw new Error(`Unipile connection request failed: ${await res.text()}`);
  }

  async getConnections(accountId: string, limit = 50): Promise<UnipileProfile[]> {
    const { unipileKey, unipileDsn } = await this.getCredentials();
    if (!unipileKey || !unipileDsn) return [];
    try {
      const params = new URLSearchParams({ account_id: accountId, limit: String(limit) });
      const res = await fetch(
        `${this.unipileBase(unipileDsn)}/linkedin/relations?${params}`,
        { headers: this.unipileHeaders(unipileKey) },
      );
      if (!res.ok) return [];
      const data = await res.json() as any;
      return (data.items ?? []).map((p: any) => ({
        id: p.member_id ?? p.id ?? '',
        public_identifier: p.public_identifier ?? '',
        first_name: p.first_name ?? '',
        last_name: p.last_name ?? '',
        headline: p.headline ?? '',
        profile_url: p.public_profile_url ?? `https://www.linkedin.com/in/${p.public_identifier ?? ''}`,
      })) as UnipileProfile[];
    } catch {
      return [];
    }
  }

  // ─── Comments ──────────────────────────────────────────────────────────────

  async postComment(postId: string, comment: string, accountId?: string): Promise<void> {
    const { unipileKey, unipileDsn, linkedinToken } = await this.getCredentials();
    if (!unipileKey && !linkedinToken) {
      this.logger.warn('LinkedIn not configured — skipping comment');
      return;
    }
    if (unipileKey && unipileDsn) {
      const body: any = { text: comment };
      if (accountId) body.account_id = accountId;
      const res = await fetch(`${this.unipileBase(unipileDsn)}/linkedin/posts/${postId}/comments`, {
        method: 'POST',
        headers: this.unipileHeaders(unipileKey),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Unipile comment failed: ${await res.text()}`);
      return;
    }
    const res = await fetch('https://api.linkedin.com/v2/socialActions/comments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${linkedinToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        actor: `urn:li:person:me`,
        object: `urn:li:activity:${postId}`,
        message: { text: comment },
      }),
    });
    if (!res.ok) throw new Error(`LinkedIn comment failed: ${await res.text()}`);
  }

  // ─── DMs ───────────────────────────────────────────────────────────────────

  async sendDM(profileId: string, message: string, accountId?: string): Promise<void> {
    const { unipileKey, unipileDsn } = await this.getCredentials();
    if (!unipileKey || !unipileDsn) {
      this.logger.warn('LinkedIn not configured — skipping DM');
      return;
    }
    const body: any = { recipient_id: profileId, text: message };
    if (accountId) body.account_id = accountId;
    const res = await fetch(`${this.unipileBase(unipileDsn)}/linkedin/messages`, {
      method: 'POST',
      headers: this.unipileHeaders(unipileKey),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Unipile DM failed: ${await res.text()}`);
  }

  // ─── Posts ─────────────────────────────────────────────────────────────────

  async publishPost(text: string, accountId?: string): Promise<void> {
    const { unipileKey, unipileDsn, linkedinToken } = await this.getCredentials();
    if (!unipileKey && !linkedinToken) {
      this.logger.warn('LinkedIn not configured — skipping post publish');
      return;
    }
    if (unipileKey && unipileDsn) {
      const body: any = { text };
      if (accountId) body.account_id = accountId;
      const res = await fetch(`${this.unipileBase(unipileDsn)}/linkedin/posts`, {
        method: 'POST',
        headers: this.unipileHeaders(unipileKey),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Unipile publish failed: ${await res.text()}`);
      return;
    }
    const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${linkedinToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        author: 'urn:li:person:me',
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text },
            shareMediaCategory: 'NONE',
          },
        },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
      }),
    });
    if (!res.ok) throw new Error(`LinkedIn publish failed: ${await res.text()}`);
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async getFeedViaUnipile(key: string, dsn: string, limit: number, accountId?: string): Promise<LinkedInPost[]> {
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (accountId) params.set('account_id', accountId);
      const res = await fetch(`${this.unipileBase(dsn)}/linkedin/feed?${params}`, {
        headers: { 'X-API-KEY': key },
      });
      if (!res.ok) return [];
      const data = await res.json() as any;
      return (data.items ?? []).map((p: any) => ({
        id: p.id ?? p.activity_id,
        authorName: p.author?.name ?? 'Unknown',
        content: p.text ?? p.commentary ?? '',
        url: p.url ?? '',
      }));
    } catch {
      return [];
    }
  }

  private async getFeedDirect(token: string, limit: number): Promise<LinkedInPost[]> {
    try {
      const res = await fetch(
        `https://api.linkedin.com/v2/shares?q=owners&owners=urn:li:person:me&count=${limit}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) return [];
      const data = await res.json() as any;
      return (data.elements ?? []).map((p: any) => ({
        id: p.id,
        authorName: 'LinkedIn Post',
        content: p.text?.text ?? '',
        url: '',
      }));
    } catch {
      return [];
    }
  }
}
