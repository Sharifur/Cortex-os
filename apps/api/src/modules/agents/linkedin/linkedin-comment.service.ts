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
   *  1. Try Unipile Voyager proxy with method:POST — works when Unipile forwards
   *     write requests to LinkedIn's socialactions endpoint.
   *  2. Fall back to Unipile native comment API with URL-encoded post ID — works
   *     for posts that Unipile has already indexed in its own database.
   *
   * The Voyager feed returns LinkedIn activity URNs (urn:li:activity:XXX).
   * Unipile's native POST /posts/{id}/comments requires Unipile-internal IDs,
   * so that path fails with 422 for Voyager-sourced posts. The Voyager proxy
   * attempt covers this case.
   */
  async postComment(postId: string, comment: string, accountId?: string): Promise<void> {
    const { unipileKey, unipileDsn } = await this.getCredentials();
    if (!unipileKey || !unipileDsn) throw new Error('Unipile API key or DSN not configured in Settings');

    this.logger.log(`postComment: postId=${postId} accountId=${accountId ?? 'none'}`);

    // Attempt 1: Voyager proxy POST (handles LinkedIn activity URNs from feed)
    try {
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
      if (voyagerRes.ok) {
        this.logger.log(`Comment posted via Voyager proxy (${voyagerRes.status})`);
        return;
      }
      this.logger.warn(`Voyager proxy comment failed (${voyagerRes.status}): ${voyagerRaw.slice(0, 300)}`);
    } catch (err) {
      this.logger.warn(`Voyager proxy comment error: ${(err as Error).message}`);
    }

    // Attempt 2: Unipile native API — works if Unipile has this post indexed
    const nativeBody: Record<string, any> = { text: comment };
    if (accountId) nativeBody['account_id'] = accountId;

    const nativeRes = await fetch(
      `${this.unipileBase(unipileDsn)}/posts/${encodeURIComponent(postId)}/comments`,
      { method: 'POST', headers: this.unipileHeaders(unipileKey), body: JSON.stringify(nativeBody) },
    );
    if (!nativeRes.ok) {
      const raw = await nativeRes.text();
      throw new Error(
        `Comment failed on both paths. Native Unipile (${nativeRes.status}): ${raw.slice(0, 300)}. ` +
        `If postId is a LinkedIn activity URN, Unipile needs to have the post indexed. ` +
        `Try fetching feed posts via Unipile native GET /posts instead of Voyager proxy.`,
      );
    }
    this.logger.log(`Comment posted via native Unipile API (${nativeRes.status})`);
  }
}
