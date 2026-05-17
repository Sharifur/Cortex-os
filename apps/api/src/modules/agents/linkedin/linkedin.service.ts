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
  location?: string;
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

  // ─── Native posts (Unipile-stored, have native IDs usable for commenting) ──

  async getNativeFeedPosts(accountId: string, limit = 20): Promise<{ posts: LinkedInPost[]; raw: string | null; status: number | null }> {
    const { unipileKey, unipileDsn } = await this.getCredentials();
    if (!unipileKey || !unipileDsn) return { posts: [], raw: 'not configured', status: null };
    try {
      const res = await fetch(
        `${this.unipileBase(unipileDsn)}/posts?account_id=${encodeURIComponent(accountId)}&limit=${limit}`,
        { headers: this.unipileHeaders(unipileKey) },
      );
      const raw = await res.text();
      if (!res.ok) return { posts: [], raw: raw.slice(0, 400), status: res.status };
      const data = JSON.parse(raw) as any;
      const items: any[] = data.items ?? data.posts ?? data.data ?? [];
      const posts = items.map((p: any) => ({
        // Use Unipile internal ID so POST /posts/{id}/comments works.
        // provider_id is the LinkedIn URN — used only for URL generation.
        id: p.id ?? p.provider_id ?? '',
        authorName: p.author?.name ?? p.author?.display_name ?? p.author_name ?? 'Unknown',
        content: p.text ?? p.content ?? p.body ?? '',
        url: p.url ?? (p.provider_id ? `https://www.linkedin.com/feed/update/${p.provider_id}/` : ''),
      })).filter(p => p.content?.trim() && p.id);
      return { posts, raw: posts.length === 0 ? raw.slice(0, 600) : null, status: res.status };
    } catch (err) {
      return { posts: [], raw: (err as Error).message, status: null };
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
          // Extract urn:li:activity:XXXXX from compound fsd_update URNs.
          // Use the clean activity URN as the post ID — Unipile comment API requires it.
          const activityUrn = urn.match(/urn:li:activity:\d+/)?.[0] ?? urn;
          const url = activityUrn.startsWith('urn:li:') ? `https://www.linkedin.com/feed/update/${activityUrn}/` : '';
          return { id: activityUrn || `post_${Math.random()}`, authorName, content, url };
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
        location: p.location ?? p.geo_location ?? p.country ?? '',
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
  // Unipile comment API: POST /api/v1/posts/{post_id}/comments
  // post_id must be a Unipile-native post ID (from GET /api/v1/posts), NOT a LinkedIn URN.
  // Feed must be fetched via getNativeFeedPosts() so the IDs are compatible.

  async postComment(postId: string, comment: string, accountId?: string): Promise<void> {
    const { unipileKey, unipileDsn } = await this.getCredentials();
    if (!unipileKey || !unipileDsn) {
      throw new Error('Unipile API key or DSN not configured in Settings');
    }

    const body: Record<string, any> = { text: comment };
    if (accountId) body['account_id'] = accountId;

    const res = await fetch(
      `${this.unipileBase(unipileDsn)}/posts/${postId}/comments`,
      {
        method: 'POST',
        headers: this.unipileHeaders(unipileKey),
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      const raw = await res.text();
      throw new Error(`Unipile comment failed (${res.status}): ${raw.slice(0, 300)}`);
    }
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

  // ─── Own profile posts (persona training) ──────────────────────────────────
  // Uses Voyager proxy to fetch recent posts authored by this account.
  // Falls back to empty array if the endpoint is unavailable.

  async fetchOwnPosts(accountId: string): Promise<string[]> {
    const { unipileKey, unipileDsn } = await this.getCredentials();
    if (!unipileKey || !unipileDsn) return [];

    // Step 1: get own public identifier via Voyager /me
    let publicId: string | null = null;
    try {
      const meRes = await fetch(`${this.unipileBase(unipileDsn)}/linkedin`, {
        method: 'POST',
        headers: this.unipileHeaders(unipileKey),
        body: JSON.stringify({ account_id: accountId, request_url: 'https://www.linkedin.com/voyager/api/me' }),
      });
      const meRaw = await meRes.text();
      this.logger.log(`fetchOwnPosts /me status=${meRes.status} raw=${meRaw.slice(0, 400)}`);
      if (meRes.ok) {
        const meData = JSON.parse(meRaw) as any;
        // Unipile wraps: { object:"LinkedinRawData", data: <linkedin-response> }
        // LinkedIn /me returns: { data: { miniProfile: { publicIdentifier } }, included: [...] }
        const li = meData?.data ?? meData;
        publicId =
          li?.data?.miniProfile?.publicIdentifier ??   // LinkedIn REST /me
          li?.miniProfile?.publicIdentifier ??          // some versions
          li?.publicIdentifier ??                       // rare
          null;
        this.logger.log(`fetchOwnPosts publicId resolved: ${publicId}`);
      }
    } catch (err) {
      this.logger.warn(`fetchOwnPosts /me error: ${(err as Error).message}`);
    }

    // Step 2: fetch profile updates (own posts) — try multiple URL patterns
    const urlsToTry = publicId
      ? [
          `https://www.linkedin.com/voyager/api/identity/profiles/${publicId}/updates?type=SHARES&start=0&count=20`,
          `https://www.linkedin.com/voyager/api/identity/profiles/${publicId}/updates?start=0&count=20`,
        ]
      : [
          `https://www.linkedin.com/voyager/api/identity/profiles/me/updates?type=SHARES&start=0&count=20`,
          `https://www.linkedin.com/voyager/api/identity/profiles/me/updates?start=0&count=20`,
        ];

    for (const updatesUrl of urlsToTry) {
      try {
        const updatesRes = await fetch(`${this.unipileBase(unipileDsn)}/linkedin`, {
          method: 'POST',
          headers: this.unipileHeaders(unipileKey),
          body: JSON.stringify({ account_id: accountId, request_url: updatesUrl }),
        });
        const updatesRaw = await updatesRes.text();
        this.logger.log(`fetchOwnPosts updates status=${updatesRes.status} url=${updatesUrl} raw=${updatesRaw.slice(0, 500)}`);

        if (!updatesRes.ok) continue;

        const parsed = JSON.parse(updatesRaw) as any;
        const voyager = parsed?.data ?? parsed;
        const elements: any[] = voyager?.elements ?? voyager?.feedUpdates ?? voyager?.data?.elements ?? [];

        const texts: string[] = [];
        for (const el of elements) {
          const update = el?.updateV2 ?? el?.update ?? el;
          const text =
            update?.commentary?.text?.text ??
            update?.commentary?.text ??
            update?.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary?.text ??
            el?.commentary?.text?.text ??
            el?.text?.text ??
            '';
          if (text?.trim()) texts.push(text.trim());
        }

        this.logger.log(`fetchOwnPosts: extracted ${texts.length} posts from ${elements.length} elements`);
        if (texts.length > 0) return texts;
      } catch (err) {
        this.logger.warn(`fetchOwnPosts updates error (${updatesUrl}): ${(err as Error).message}`);
      }
    }
    return [];
  }

  // Debug helper — returns raw Voyager responses for persona training diagnosis
  async debugPersonaFetch(accountId: string): Promise<{ me: any; updates: any }> {
    const { unipileKey, unipileDsn } = await this.getCredentials();
    if (!unipileKey || !unipileDsn) return { me: { error: 'not configured' }, updates: { error: 'not configured' } };

    const meRes = await fetch(`${this.unipileBase(unipileDsn)}/linkedin`, {
      method: 'POST',
      headers: this.unipileHeaders(unipileKey),
      body: JSON.stringify({ account_id: accountId, request_url: 'https://www.linkedin.com/voyager/api/me' }),
    });
    const meRaw = await meRes.text();
    let meParsed: any = null;
    try { meParsed = JSON.parse(meRaw); } catch { /* ignore */ }

    const updatesRes = await fetch(`${this.unipileBase(unipileDsn)}/linkedin`, {
      method: 'POST',
      headers: this.unipileHeaders(unipileKey),
      body: JSON.stringify({
        account_id: accountId,
        request_url: 'https://www.linkedin.com/voyager/api/identity/profiles/me/updates?type=SHARES&start=0&count=5',
      }),
    });
    const updatesRaw = await updatesRes.text();
    let updatesParsed: any = null;
    try { updatesParsed = JSON.parse(updatesRaw); } catch { /* ignore */ }

    return {
      me: { status: meRes.status, raw: meRaw.slice(0, 1000), parsed: meParsed },
      updates: { status: updatesRes.status, raw: updatesRaw.slice(0, 2000), parsed: updatesParsed },
    };
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
