import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';

export interface UnsplashPhoto {
  id: string;
  description: string | null;
  alt_description: string | null;
  urls: { raw: string; full: string; regular: string };
  links: { download_location: string; html: string };
  user: { name: string; links: { html: string } };
  width: number;
  height: number;
}

interface UnsplashSearchResponse {
  results: UnsplashPhoto[];
  total: number;
  total_pages: number;
}

function orientationFor(dims: { width: number; height: number }): 'squarish' | 'landscape' | 'portrait' {
  if (dims.width === dims.height) return 'squarish';
  return dims.width > dims.height ? 'landscape' : 'portrait';
}

@Injectable()
export class UnsplashService {
  private readonly logger = new Logger(UnsplashService.name);
  private readonly BASE = 'https://api.unsplash.com';

  constructor(private readonly settings: SettingsService) {}

  async isConfigured(): Promise<boolean> {
    const key = await this.settings.getDecrypted('unsplash_access_key');
    return !!key;
  }

  async search(
    query: string,
    opts: {
      dims: { width: number; height: number };
      count?: number;
      page?: number;
      contentFilter?: 'low' | 'high';
    },
  ): Promise<UnsplashPhoto[]> {
    const key = await this.settings.getDecrypted('unsplash_access_key');
    if (!key) throw new Error('Unsplash access key not configured — add unsplash_access_key in Settings');

    const params = new URLSearchParams({
      query,
      per_page: String(Math.min(opts.count ?? 5, 30)),
      page: String(opts.page ?? 1),
      orientation: orientationFor(opts.dims),
      content_filter: opts.contentFilter ?? 'high',
    });

    const res = await fetch(`${this.BASE}/search/photos?${params}`, {
      headers: { Authorization: `Client-ID ${key}` },
    });

    if (res.status === 401) throw new Error('Unsplash access key is invalid');
    if (!res.ok) {
      const body = await res.text().catch(() => res.status.toString());
      throw new Error(`Unsplash search failed: ${res.status} — ${body}`);
    }

    const data = await res.json() as UnsplashSearchResponse;
    return data.results ?? [];
  }

  async fetchAsBuffer(
    query: string,
    dims: { width: number; height: number },
  ): Promise<{ buffer: Buffer; photo: UnsplashPhoto; attributionText: string } | null> {
    let photos: UnsplashPhoto[];
    try {
      photos = await this.search(query, { dims, count: 5 });
    } catch (err) {
      this.logger.warn(`Unsplash search error: ${(err as Error).message}`);
      return null;
    }

    if (!photos.length) {
      this.logger.warn(`Unsplash: no results for "${query}"`);
      return null;
    }

    // Pick the photo whose native aspect ratio is closest to the target
    const targetRatio = dims.width / dims.height;
    const photo = photos.reduce((best, p) => {
      const pRatio = p.width / p.height;
      const bRatio = best.width / best.height;
      return Math.abs(pRatio - targetRatio) < Math.abs(bRatio - targetRatio) ? p : best;
    });

    // Trigger download tracking (required by Unsplash API ToS)
    void this.triggerDownload(photo).catch(() => {});

    const buffer = await this.downloadResized(photo, dims);
    if (!buffer) return null;

    const attributionText = `Photo by ${photo.user.name} on Unsplash`;
    this.logger.log(`Unsplash: fetched photo ${photo.id} by ${photo.user.name} (${buffer.length}B) for query "${query}"`);

    return { buffer, photo, attributionText };
  }

  async fetchById(
    photoId: string,
    dims: { width: number; height: number },
  ): Promise<{ buffer: Buffer; photo: UnsplashPhoto; attributionText: string } | null> {
    const key = await this.settings.getDecrypted('unsplash_access_key');
    if (!key) return null;

    const res = await fetch(`${this.BASE}/photos/${photoId}`, {
      headers: { Authorization: `Client-ID ${key}` },
    });
    if (!res.ok) return null;

    const photo = await res.json() as UnsplashPhoto;
    void this.triggerDownload(photo).catch(() => {});

    const buffer = await this.downloadResized(photo, dims);
    if (!buffer) return null;

    return {
      buffer,
      photo,
      attributionText: `Photo by ${photo.user.name} on Unsplash`,
    };
  }

  // Search and return metadata only (no image download) — for UI browse flows
  async browse(
    query: string,
    opts: { page?: number; count?: number; dims?: { width: number; height: number } },
  ): Promise<UnsplashPhoto[]> {
    return this.search(query, {
      dims: opts.dims ?? { width: 1080, height: 1080 },
      count: opts.count ?? 10,
      page: opts.page ?? 1,
    });
  }

  private async triggerDownload(photo: UnsplashPhoto): Promise<void> {
    const key = await this.settings.getDecrypted('unsplash_access_key');
    if (!key) return;
    await fetch(photo.links.download_location, {
      headers: { Authorization: `Client-ID ${key}` },
    });
  }

  private async downloadResized(
    photo: UnsplashPhoto,
    dims: { width: number; height: number },
  ): Promise<Buffer | null> {
    // Unsplash raw URL supports Imgix params for server-side resizing and cropping
    const url = `${photo.urls.raw}&w=${dims.width}&h=${dims.height}&fit=crop&crop=entropy&auto=format&q=85&fm=png`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      this.logger.warn(`Unsplash image download failed for ${photo.id}: ${(err as Error).message}`);
      return null;
    }
  }
}
