import { Injectable, Logger } from '@nestjs/common';

export interface RedditPost {
  id: string;
  subreddit: string;
  title: string;
  url: string;
  body: string;
  score: number;
  numComments: number;
  createdUtc: number;
}

@Injectable()
export class RedditService {
  private readonly logger = new Logger(RedditService.name);
  private readonly clientId = process.env.REDDIT_CLIENT_ID;
  private readonly clientSecret = process.env.REDDIT_CLIENT_SECRET;
  private readonly username = process.env.REDDIT_USERNAME;
  private readonly password = process.env.REDDIT_PASSWORD;
  private readonly userAgent = `cortex-os/1.0 by ${process.env.REDDIT_USERNAME ?? 'cortex'}`;

  private accessToken: string | null = null;
  private tokenExpiry = 0;

  isConfigured() {
    return !!(this.clientId && this.clientSecret && this.username && this.password);
  }

  async searchPosts(query: string, subreddit?: string, limit = 10): Promise<RedditPost[]> {
    if (!this.isConfigured()) {
      this.logger.warn('Reddit API not configured — returning empty results');
      return [];
    }

    try {
      const token = await this.getToken();
      const sub = subreddit ? `/r/${subreddit}` : '';
      const url = `https://oauth.reddit.com${sub}/search.json?q=${encodeURIComponent(query)}&sort=new&limit=${limit}&restrict_sr=${!!subreddit}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, 'User-Agent': this.userAgent },
      });
      if (!res.ok) return [];

      const data = await res.json() as any;
      return (data.data?.children ?? []).map((c: any) => ({
        id: c.data.id,
        subreddit: c.data.subreddit,
        title: c.data.title,
        url: `https://reddit.com${c.data.permalink}`,
        body: c.data.selftext ?? '',
        score: c.data.score,
        numComments: c.data.num_comments,
        createdUtc: c.data.created_utc,
      }));
    } catch (err) {
      this.logger.warn(`Reddit search failed: ${err}`);
      return [];
    }
  }

  async postComment(thingId: string, text: string): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn('Reddit API not configured — skipping comment');
      return;
    }

    const token = await this.getToken();
    const res = await fetch('https://oauth.reddit.com/api/comment', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': this.userAgent,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ thing_id: `t3_${thingId}`, text }),
    });

    if (!res.ok) throw new Error(`Reddit comment failed: ${await res.text()}`);
  }

  async upvote(thingId: string): Promise<void> {
    if (!this.isConfigured()) return;
    const token = await this.getToken();
    await fetch('https://oauth.reddit.com/api/vote', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': this.userAgent,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ id: `t3_${thingId}`, dir: '1' }),
    });
  }

  private async getToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) return this.accessToken;

    const res = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
        'User-Agent': this.userAgent,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'password', username: this.username!, password: this.password! }),
    });

    if (!res.ok) throw new Error(`Reddit auth failed: ${await res.text()}`);
    const data = await res.json() as any;
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return this.accessToken!;
  }
}
