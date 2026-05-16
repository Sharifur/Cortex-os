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

  async getCredentials() {
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
  // Correct: GET /api/v1/accounts?provider=LINKEDIN

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
  // Correct: POST /api/v1/linkedin (raw Voyager proxy)
  // Docs: https://developer.unipile.com/reference/linkedincontroller_getrawdata

  async getFeedPosts(limit = 10, accountId?: string): Promise<LinkedInPost[]> {
    const result = await this.getFeedWithDiagnostics(limit, accountId);
    if (result.error) this.logger.warn(`Unipile feed error: ${result.error} | raw: ${result.raw}`);
    return result.posts;
  }

  async getFeedWithDiagnostics(limit = 20, accountId?: string): Promise<{ posts: LinkedInPost[]; error: string | null; status: number | null; raw: string | null }> {
    const { unipileKey, unipileDsn } = await this.getCredentials();
    if (!unipileKey || !unipileDsn) {
      return { posts: [], error: 'Unipile API key or DSN not configured in Settings', status: null, raw: null };
    }
    if (!accountId) {
      return { posts: [], error: 'No account_id provided for feed fetch', status: null, raw: null };
    }
    try {
      const feedUrl = `https://www.linkedin.com/voyager/api/graphql?queryId=voyagerFeedDashMainFeed.7a50ef8ba5a7865c23ad5df46f735709&variables=(start:0,count:${limit})`;
      const res = await fetch(`${this.unipileBase(unipileDsn)}/linkedin`, {
        method: 'POST',
        headers: this.unipileHeaders(unipileKey),
        body: JSON.stringify({ account_id: accountId, request_url: feedUrl }),
      });
      const raw = await res.text();
      if (!res.ok) {
        return { posts: [], error: `HTTP ${res.status}`, status: res.status, raw: raw.slice(0, 500) };
      }
      const unipile = JSON.parse(raw) as any;
      // Unipile wraps response as { object: "LinkedinRawData", data: <LinkedIn response> }
      const voyager = unipile?.data ?? unipile;

      // LinkedIn returns elements at different paths depending on REST vs GraphQL endpoint
      const elements: any[] =
        voyager?.data?.feedDashMainFeedByMainFeed?.elements ??  // GraphQL path
        voyager?.elements ??                                     // REST path
        voyager?.feedUpdates ??                                  // older REST path
        [];

      const posts = elements
        .map((el: any) => {
          // REST format: element has actor + commentary directly
          // GraphQL format: element has updateV2 wrapper
          const update = el?.updateV2 ?? el?.update ?? el;
          const authorName =
            update?.actor?.name?.text ??
            update?.actor?.name ??
            update?.author?.miniProfile?.firstName ??
            el?.actor?.name?.text ??
            'Unknown';
          const content =
            update?.commentary?.text?.text ??
            update?.commentary?.text ??
            update?.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary?.text ??
            update?.value?.['com.linkedin.voyager.feed.Update']?.value?.['com.linkedin.voyager.feed.TextUpdate']?.text?.text ??
            el?.commentary?.text?.text ??
            el?.text?.text ??
            '';
          const urn: string =
            update?.dashEntityUrn ??
            update?.entityUrn ??
            el?.dashEntityUrn ??
            el?.entityUrn ??
            el?.id ??
            '';
          // Extract urn:li:activity:XXXXX from compound fsd_update URNs
          const activityUrn = urn.match(/urn:li:activity:\d+/)?.[0] ?? urn;
          const url = activityUrn.startsWith('urn:li:') ? `https://www.linkedin.com/feed/update/${activityUrn}/` : '';
          return { id: urn || `post_${Math.random()}`, authorName, content, url };
        })
        .filter(p => p.content?.trim());

      return { posts, error: null, status: res.status, raw: posts.length === 0 ? raw.slice(0, 600) : null };
    } catch (err) {
      return { posts: [], error: (err as Error).message, status: null, raw: null };
    }
  }

  // ─── Search ────────────────────────────────────────────────────────────────
  // Correct: POST /api/v1/linkedin/search?account_id=X  (body: { api, category, keywords })
  // Docs: https://developer.unipile.com/docs/linkedin-search

  async searchPeople(
    accountId: string,
    keywords: string,
    filters: { jobTitles?: string[]; industries?: string[] } = {},
  ): Promise<UnipileProfile[]> {
    const { unipileKey, unipileDsn } = await this.getCredentials();
    if (!unipileKey || !unipileDsn) return [];
    try {
      const body: Record<string, any> = {
        api: 'classic',
        category: 'people',
        keywords,
        limit: 25,
      };
      if (filters.jobTitles?.length) body['title'] = filters.jobTitles[0];

      const res = await fetch(
        `${this.unipileBase(unipileDsn)}/linkedin/search?account_id=${encodeURIComponent(accountId)}`,
        { method: 'POST', headers: this.unipileHeaders(unipileKey), body: JSON.stringify(body) },
      );
      if (!res.ok) {
        this.logger.warn(`LinkedIn people search failed: HTTP ${res.status} — ${await res.text()}`);
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

  // ─── Connection requests ────────────────────────────────────────────────────
  // Correct: POST /api/v1/users/invite  { account_id, provider_id, message }
  // Docs: https://developer.unipile.com/docs/invite-users

  async sendConnectionRequest(accountId: string, profileId: string, note: string): Promise<void> {
    const { unipileKey, unipileDsn } = await this.getCredentials();
    if (!unipileKey || !unipileDsn) {
      this.logger.warn('LinkedIn not configured — skipping connection request');
      return;
    }
    const res = await fetch(`${this.unipileBase(unipileDsn)}/users/invite`, {
      method: 'POST',
      headers: this.unipileHeaders(unipileKey),
      body: JSON.stringify({ account_id: accountId, provider_id: profileId, message: note }),
    });
    if (!res.ok) throw new Error(`Unipile connection request failed: ${await res.text()}`);
  }

  async getConnections(accountId: string, limit = 50): Promise<UnipileProfile[]> {
    const { unipileKey, unipileDsn } = await this.getCredentials();
    if (!unipileKey || !unipileDsn) return [];
    try {
      const res = await fetch(
        `${this.unipileBase(unipileDsn)}/users/relations?account_id=${encodeURIComponent(accountId)}&limit=${limit}`,
        { headers: this.unipileHeaders(unipileKey) },
      );
      if (!res.ok) return [];
      const data = await res.json() as any;
      return (data.items ?? []).map((p: any) => ({
        id: p.provider_id ?? p.member_id ?? p.id ?? '',
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
  // Correct: POST /api/v1/posts/{post_id}/comments?account_id=X  { text }
  // Docs: https://developer.unipile.com/docs/posts-and-comments

  async postComment(postId: string, comment: string, accountId?: string): Promise<void> {
    const { unipileKey, unipileDsn } = await this.getCredentials();
    if (!unipileKey || !unipileDsn) {
      this.logger.warn('LinkedIn not configured — skipping comment');
      return;
    }
    const query = accountId ? `?account_id=${encodeURIComponent(accountId)}` : '';
    const res = await fetch(`${this.unipileBase(unipileDsn)}/posts/${encodeURIComponent(postId)}/comments${query}`, {
      method: 'POST',
      headers: this.unipileHeaders(unipileKey),
      body: JSON.stringify({ text: comment }),
    });
    if (!res.ok) throw new Error(`Unipile comment failed: ${await res.text()}`);
  }

  // ─── DMs ───────────────────────────────────────────────────────────────────
  // Correct: POST /api/v1/chats  { account_id, attendees_ids: [profileId], text }
  // Docs: https://developer.unipile.com/docs/send-messages

  async sendDM(profileId: string, message: string, accountId?: string): Promise<void> {
    const { unipileKey, unipileDsn } = await this.getCredentials();
    if (!unipileKey || !unipileDsn) {
      this.logger.warn('LinkedIn not configured — skipping DM');
      return;
    }
    const res = await fetch(`${this.unipileBase(unipileDsn)}/chats`, {
      method: 'POST',
      headers: this.unipileHeaders(unipileKey),
      body: JSON.stringify({ account_id: accountId, attendees_ids: [profileId], text: message }),
    });
    if (!res.ok) throw new Error(`Unipile DM failed: ${await res.text()}`);
  }

  // ─── Posts ─────────────────────────────────────────────────────────────────
  // Correct: POST /api/v1/posts?account_id=X  { text }
  // Docs: https://developer.unipile.com/docs/posts-and-comments

  async publishPost(text: string, accountId?: string): Promise<void> {
    const { unipileKey, unipileDsn } = await this.getCredentials();
    if (!unipileKey || !unipileDsn) {
      this.logger.warn('LinkedIn not configured — skipping post publish');
      return;
    }
    const query = accountId ? `?account_id=${encodeURIComponent(accountId)}` : '';
    const res = await fetch(`${this.unipileBase(unipileDsn)}/posts${query}`, {
      method: 'POST',
      headers: this.unipileHeaders(unipileKey),
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`Unipile publish failed: ${await res.text()}`);
  }
}
