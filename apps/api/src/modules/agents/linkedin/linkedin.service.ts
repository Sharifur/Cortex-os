import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';

export interface LinkedInPost {
  id: string;
  authorName: string;
  content: string;
  url: string;
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

  async isConfigured(): Promise<boolean> {
    const { unipileKey, linkedinToken } = await this.getCredentials();
    return !!(unipileKey || linkedinToken);
  }

  async getFeedPosts(limit = 10): Promise<LinkedInPost[]> {
    const { unipileKey, unipileDsn, linkedinToken } = await this.getCredentials();
    if (!unipileKey && !linkedinToken) {
      this.logger.warn('LinkedIn not configured — returning empty feed');
      return [];
    }

    if (unipileKey && unipileDsn) {
      return this.getFeedViaUnipile(unipileKey, unipileDsn, limit);
    }
    return this.getFeedDirect(linkedinToken!, limit);
  }

  async postComment(postId: string, comment: string): Promise<void> {
    const { unipileKey, unipileDsn, linkedinToken } = await this.getCredentials();
    if (!unipileKey && !linkedinToken) {
      this.logger.warn('LinkedIn not configured — skipping comment');
      return;
    }

    if (unipileKey && unipileDsn) {
      const res = await fetch(`https://${unipileDsn}/api/v1/linkedin/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'X-API-KEY': unipileKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: comment }),
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

  async publishPost(text: string): Promise<void> {
    const { unipileKey, unipileDsn, linkedinToken } = await this.getCredentials();
    if (!unipileKey && !linkedinToken) {
      this.logger.warn('LinkedIn not configured — skipping post publish');
      return;
    }

    if (unipileKey && unipileDsn) {
      const res = await fetch(`https://${unipileDsn}/api/v1/linkedin/posts`, {
        method: 'POST',
        headers: { 'X-API-KEY': unipileKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
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

  async sendDM(profileId: string, message: string): Promise<void> {
    const { unipileKey, unipileDsn, linkedinToken } = await this.getCredentials();
    if (!unipileKey && !linkedinToken) {
      this.logger.warn('LinkedIn not configured — skipping DM');
      return;
    }

    if (unipileKey && unipileDsn) {
      const res = await fetch(`https://${unipileDsn}/api/v1/linkedin/messages`, {
        method: 'POST',
        headers: { 'X-API-KEY': unipileKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_id: profileId, text: message }),
      });
      if (!res.ok) throw new Error(`Unipile DM failed: ${await res.text()}`);
    }
  }

  private async getFeedViaUnipile(key: string, dsn: string, limit: number): Promise<LinkedInPost[]> {
    try {
      const res = await fetch(`https://${dsn}/api/v1/linkedin/feed?limit=${limit}`, {
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
      const res = await fetch(`https://api.linkedin.com/v2/shares?q=owners&owners=urn:li:person:me&count=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
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
