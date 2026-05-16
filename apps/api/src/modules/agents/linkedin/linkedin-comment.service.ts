import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';

@Injectable()
export class LinkedInCommentService {
  private readonly logger = new Logger(LinkedInCommentService.name);

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
   * Post a comment on a LinkedIn post.
   *
   * Strategy:
   *  1. Unipile native POST /posts/{id}/comments — works when postId is a
   *     Unipile-internal ID returned by GET /posts (the native feed endpoint).
   *  2. Voyager proxy fallback — used when postId is a LinkedIn activity URN
   *     from the Voyager feed. Less reliable; may fail if LinkedIn rejects it.
   *
   * buildContext() now fetches feed via getNativeFeedPosts() which returns
   * Unipile-internal IDs, so path 1 should succeed for all normal runs.
   */
  async postComment(postId: string, comment: string, accountId?: string): Promise<void> {
    const { unipileKey, unipileDsn } = await this.getCredentials();
    if (!unipileKey || !unipileDsn) throw new Error('Unipile API key or DSN not configured in Settings');

    this.logger.log(`postComment: postId=${postId} accountId=${accountId ?? 'none'}`);

    // Attempt 1: Unipile native API — works when postId is a Unipile-internal ID (from GET /posts feed)
    try {
      const nativeBody: Record<string, any> = { text: comment };
      if (accountId) nativeBody['account_id'] = accountId;
      const nativeRes = await fetch(
        `${this.unipileBase(unipileDsn)}/posts/${encodeURIComponent(postId)}/comments`,
        { method: 'POST', headers: this.unipileHeaders(unipileKey), body: JSON.stringify(nativeBody) },
      );
      if (nativeRes.ok) {
        this.logger.log(`Comment posted via native Unipile API (${nativeRes.status})`);
        return;
      }
      const nativeRaw = await nativeRes.text();
      this.logger.warn(`Native Unipile comment failed (${nativeRes.status}): ${nativeRaw.slice(0, 300)}`);
    } catch (err) {
      this.logger.warn(`Native Unipile comment error: ${(err as Error).message}`);
    }

    // Attempt 2: Voyager proxy POST — fallback for activity URNs from Voyager feed
    const voyagerRes = await fetch(`${this.unipileBase(unipileDsn)}/linkedin`, {
      method: 'POST',
      headers: this.unipileHeaders(unipileKey),
      body: JSON.stringify({
        account_id: accountId,
        method: 'POST',
        request_url: `https://www.linkedin.com/voyager/api/feed/socialactions/${encodeURIComponent(postId)}/comments`,
        body: { message: { attributes: [], text: comment } },
      }),
    });
    const voyagerRaw = await voyagerRes.text();
    if (!voyagerRes.ok) {
      throw new Error(
        `Comment failed on both paths. Voyager (${voyagerRes.status}): ${voyagerRaw.slice(0, 300)}`,
      );
    }
    this.logger.log(`Comment posted via Voyager proxy (${voyagerRes.status})`);
  }
}
