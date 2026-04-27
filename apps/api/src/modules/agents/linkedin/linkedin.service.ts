import { Injectable, Logger } from '@nestjs/common';

export interface LinkedInPost {
  id: string;
  authorName: string;
  content: string;
  url: string;
}

@Injectable()
export class LinkedInService {
  private readonly logger = new Logger(LinkedInService.name);

  // Supports Unipile (preferred) or direct LinkedIn OAuth2
  private readonly unipileKey = process.env.UNIPILE_API_KEY;
  private readonly unipileDsn = process.env.UNIPILE_DSN;
  private readonly linkedinToken = process.env.LINKEDIN_ACCESS_TOKEN;

  isConfigured() {
    return !!(this.unipileKey || this.linkedinToken);
  }

  async getFeedPosts(limit = 10): Promise<LinkedInPost[]> {
    if (!this.isConfigured()) {
      this.logger.warn('LinkedIn not configured — returning empty feed');
      return [];
    }

    if (this.unipileKey && this.unipileDsn) {
      return this.getFeedViaUnipile(limit);
    }

    // Direct LinkedIn API fallback
    return this.getFeedDirect(limit);
  }

  async postComment(postId: string, comment: string): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn('LinkedIn not configured — skipping comment');
      return;
    }

    if (this.unipileKey && this.unipileDsn) {
      const res = await fetch(`https://${this.unipileDsn}/api/v1/linkedin/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'X-API-KEY': this.unipileKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: comment }),
      });
      if (!res.ok) throw new Error(`Unipile comment failed: ${await res.text()}`);
      return;
    }

    const res = await fetch('https://api.linkedin.com/v2/socialActions/comments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.linkedinToken}`,
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

  async sendDM(profileId: string, message: string): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn('LinkedIn not configured — skipping DM');
      return;
    }

    if (this.unipileKey && this.unipileDsn) {
      const res = await fetch(`https://${this.unipileDsn}/api/v1/linkedin/messages`, {
        method: 'POST',
        headers: { 'X-API-KEY': this.unipileKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_id: profileId, text: message }),
      });
      if (!res.ok) throw new Error(`Unipile DM failed: ${await res.text()}`);
    }
  }

  private async getFeedViaUnipile(limit: number): Promise<LinkedInPost[]> {
    try {
      const res = await fetch(`https://${this.unipileDsn}/api/v1/linkedin/feed?limit=${limit}`, {
        headers: { 'X-API-KEY': this.unipileKey! },
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

  private async getFeedDirect(limit: number): Promise<LinkedInPost[]> {
    try {
      const res = await fetch(`https://api.linkedin.com/v2/shares?q=owners&owners=urn:li:person:me&count=${limit}`, {
        headers: { Authorization: `Bearer ${this.linkedinToken}` },
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
