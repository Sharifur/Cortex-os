import { BadGatewayException, BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import type IORedis from 'ioredis';
import * as cheerio from 'cheerio';
import { createHash } from 'crypto';

/** Serve a cached snapshot for this long, then revalidate in the background. */
export const PRICING_FRESH_MS = 48 * 60 * 60 * 1000;
/** Keep the snapshot in Redis longer than the freshness window so we can serve stale. */
const PRICING_REDIS_TTL_SECONDS = 7 * 24 * 60 * 60;
const FETCH_TIMEOUT_MS = 12_000;
const SYNC_FETCH_TIMEOUT_MS = 8_000;
const FETCH_MAX_BYTES = 3 * 1024 * 1024;
const MAX_EXTRACT_CHARS = 3_000;
const MAX_PROMPT_CHARS = 2_000;

const USER_AGENT = 'Mozilla/5.0 (compatible; CortexBot/1.0; +https://cortex.xgenious.com)';

/** A real quoted amount, not just the word "monthly". */
const STRONG_PRICE = /(?:[$€£]\s?\d|\b\d[\d,.]*\s?(?:usd|eur|gbp)\b)/i;
const OFFER_SIGNAL = /(?:\d{1,2}\s?%\s*off|coupon|promo(?:tion)?|discount|black\s+friday|limited[- ]time|\bdeal\b|\bsale\b|code\s+[A-Z0-9]{3,})/i;

export interface PricingSnapshot {
  text: string;
  sourceUrl: string;
  fetchedAt: string;
  contentHash: string;
  /** True when the snapshot is older than the 48h freshness window. */
  stale?: boolean;
}

export interface PricingSiteRef {
  key: string;
  pricingUrl: string | null;
}

export interface PricingStatus {
  configured: boolean;
  sourceUrl: string | null;
  fetchedAt: string | null;
  ageHours: number | null;
  stale: boolean;
  chars: number;
  preview: string | null;
}

/**
 * Fetches a site's public pricing page, extracts plans/prices/offers, and caches
 * the result in Redis for 48 hours. Pricing moves with promotions, so this is
 * treated as the authoritative source over any static KB documentation.
 *
 * Freshness: fresh (<48h) → returned as-is. Stale → returned immediately and a
 * background refresh runs. Missing → fetched synchronously within an 8s budget.
 */
@Injectable()
export class LivechatPricingService {
  private readonly logger = new Logger(LivechatPricingService.name);

  constructor(@Inject('LIVECHAT_REDIS') private readonly redis: IORedis) {}

  private redisKey(siteKey: string) {
    return `livechat:pricing:v1:${siteKey}`;
  }

  private lockKey(siteKey: string) {
    return `livechat:pricing:lock:${siteKey}`;
  }

  /** Cached, fresh or stale snapshot for the reply path. Never throws. */
  async getForSite(site: PricingSiteRef): Promise<PricingSnapshot | null> {
    if (!site.pricingUrl) return null;

    const cached = await this.read(site.key);
    if (cached) {
      const age = Date.now() - Date.parse(cached.fetchedAt);
      if (Number.isFinite(age) && age <= PRICING_FRESH_MS) return cached;
      // Stale-while-revalidate: answer from cache now, refresh in the background.
      void this.refreshInBackground(site);
      return { ...cached, stale: true };
    }

    try {
      return await this.fetchAndStore(site, SYNC_FETCH_TIMEOUT_MS);
    } catch (err) {
      this.logger.warn(`pricing cold fetch failed for ${site.key}: ${(err as Error).message}`);
      return null;
    }
  }

  /** Manual refresh from the admin UI. Throws with a useful message on failure. */
  async refresh(site: PricingSiteRef): Promise<PricingSnapshot> {
    if (!site.pricingUrl) {
      throw new BadRequestException('Set a pricing page URL for this site first');
    }
    const lock = this.lockKey(site.key);
    const acquired = await this.redis.set(lock, '1', 'EX', 60, 'NX').catch(() => null);
    if (!acquired) {
      throw new BadRequestException('A pricing refresh is already running for this site');
    }
    try {
      return await this.fetchAndStore(site, FETCH_TIMEOUT_MS);
    } finally {
      await this.redis.del(lock).catch(() => undefined);
    }
  }

  async getStatus(site: PricingSiteRef): Promise<PricingStatus> {
    const cached = await this.read(site.key);
    if (!cached) {
      return {
        configured: Boolean(site.pricingUrl),
        sourceUrl: site.pricingUrl ?? null,
        fetchedAt: null,
        ageHours: null,
        stale: true,
        chars: 0,
        preview: null,
      };
    }
    const ageMs = Date.now() - Date.parse(cached.fetchedAt);
    const ageHours = Number.isFinite(ageMs) ? Math.round((ageMs / 3_600_000) * 10) / 10 : null;
    return {
      configured: Boolean(site.pricingUrl),
      sourceUrl: cached.sourceUrl,
      fetchedAt: cached.fetchedAt,
      ageHours,
      stale: !Number.isFinite(ageMs) || ageMs > PRICING_FRESH_MS,
      chars: cached.text.length,
      preview: cached.text.slice(0, 600),
    };
  }

  async invalidate(siteKey: string): Promise<void> {
    await this.redis.del(this.redisKey(siteKey)).catch(() => undefined);
  }

  /** Lock-protected background refresh — no-op when another refresh is running. */
  private async refreshInBackground(site: PricingSiteRef): Promise<void> {
    const lock = this.lockKey(site.key);
    const acquired = await this.redis.set(lock, '1', 'EX', 60, 'NX').catch(() => null);
    if (!acquired) return;
    try {
      await this.fetchAndStore(site, FETCH_TIMEOUT_MS);
    } catch (err) {
      this.logger.warn(`pricing background refresh failed for ${site.key}: ${(err as Error).message}`);
    } finally {
      await this.redis.del(lock).catch(() => undefined);
    }
  }

  // ─── Fetch + extract ──────────────────────────────────────────────────────

  private async read(siteKey: string): Promise<PricingSnapshot | null> {
    try {
      const raw = await this.redis.get(this.redisKey(siteKey));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PricingSnapshot;
      if (!parsed?.text || !parsed?.fetchedAt) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private async fetchAndStore(site: PricingSiteRef, timeoutMs: number): Promise<PricingSnapshot> {
    if (!site.pricingUrl) throw new BadRequestException('No pricing URL configured');
    const urls = this.parseUrls(site.pricingUrl);
    if (!urls.length) throw new BadRequestException('No pricing URL configured');

    const deadline = Date.now() + timeoutMs;
    const texts: string[] = [];
    const errors: string[] = [];
    for (const url of urls) {
      const remaining = deadline - Date.now();
      if (remaining < 1_500) break;
      try {
        const html = await this.fetchHtml(url, Math.min(remaining, FETCH_TIMEOUT_MS));
        const extracted = this.extractPricingFacts(html, url);
        if (extracted) texts.push(extracted);
        else errors.push(`${url}: no prices or offers found`);
      } catch (err) {
        errors.push(`${url}: ${(err as Error).message}`);
      }
    }
    if (!texts.length) {
      throw new BadGatewayException(`Could not read pricing pages — ${errors.join('; ')}`);
    }

    const capped = texts.join('\n\n---\n\n').slice(0, MAX_EXTRACT_CHARS);
    const snapshot: PricingSnapshot = {
      text: capped,
      sourceUrl: urls.join(', '),
      fetchedAt: new Date().toISOString(),
      contentHash: createHash('sha256').update(capped).digest('hex').slice(0, 16),
    };
    try {
      await this.redis.set(this.redisKey(site.key), JSON.stringify(snapshot), 'EX', PRICING_REDIS_TTL_SECONDS);
    } catch (err) {
      this.logger.warn(`pricing cache write failed for ${site.key}: ${(err as Error).message}`);
    }
    this.logger.log(`pricing refreshed for ${site.key}: ${capped.length} chars from ${snapshot.sourceUrl}${errors.length ? ` (warnings: ${errors.join('; ')})` : ''}`);
    return snapshot;
  }

  private parseUrls(raw: string): string[] {
    return raw.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean).slice(0, 3);
  }

  private async fetchHtml(url: string, timeoutMs: number): Promise<string> {
    this.assertSafeUrl(url);
    const axios = (await import('axios')).default;
    try {
      const res = await axios.get(url, {
        responseType: 'text',
        timeout: timeoutMs,
        maxContentLength: FETCH_MAX_BYTES,
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
      });
      return String(res.data ?? '');
    } catch (err: any) {
      const status = err?.response?.status;
      if (status) throw new Error(`server returned ${status}`);
      if (err?.code === 'ECONNABORTED') throw new Error('request timed out');
      throw new Error(err?.message ?? 'network error');
    }
  }

  /** Admin-only URLs, but still refuse localhost / private ranges (SSRF). */
  private assertSafeUrl(url: string): void {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('Pricing URL must be a valid http(s) URL');
    }
    if (!/^https?:$/.test(parsed.protocol)) {
      throw new BadRequestException('Pricing URL must start with http:// or https://');
    }
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    const isPrivate =
      host === 'localhost' ||
      host.endsWith('.local') ||
      host === '::1' ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^0\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host);
    if (isPrivate) throw new BadRequestException('Pricing URL cannot point to a private address');
  }

  /** Extract a compact plan/price/offer summary from a pricing page. */
  extractPricingFacts(html: string, url: string): string | null {
    const $ = cheerio.load(html);
    $('script, style, nav, footer, header, aside, noscript, svg, form').remove();

    const pageTitle = $('title').text().trim();
    const scopes = ['main', 'article', '[role="main"]', 'body'];
    const root = scopes.map((s) => $(s).first()).find((el) => el.length) ?? $('body');

    const planLines: string[] = [];
    const offerLines: string[] = [];

    // Add a line, dropping duplicates and lines already covered by a longer
    // line in the same bucket. `limit` keeps each item compact.
    const push = (list: string[], text: string, limit = 300) => {
      const clean = text.replace(/\s+/g, ' ').trim();
      if (clean.length < 8) return;
      if (list.some((l) => l.includes(clean) || clean.includes(l))) return;
      list.push(clean.slice(0, limit));
    };

    // 1) Plan cards: containers that hold a heading AND a real quoted price.
    //    Catches Tailwind-style cards whose class names say nothing.
    root.find('div, section, article, li').each((_i, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (text.length < 100 || text.length > 900) return;
      if (!STRONG_PRICE.test(text)) return;
      if (!$(el).find('h1,h2,h3,h4').length) return;
      push(planLines, text, 300);
    });

    // 2) Semantic lines (headings, list items, price classes) — covers simpler
    //    markup and catches the free/entry plan.
    const headingOf = (el: any): string => {
      const node = $(el);
      const own = node.is('h1,h2,h3,h4') ? node.text().trim() : '';
      if (own) return own;
      const prev = node.prevAll('h1,h2,h3,h4').first().text().trim();
      if (prev) return prev;
      return node.closest('section, article, li, div').find('h1,h2,h3,h4').first().text().trim();
    };

    root.find('h1,h2,h3,h4,li,p,[class*="price"],[class*="plan"],[class*="card"]').each((_i, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (!text || text.length > 900) return;
      const strong = STRONG_PRICE.test(text);
      const offer = OFFER_SIGNAL.test(text);
      if (!strong && !offer) return;

      const heading = headingOf(el);
      const line = heading && !text.toLowerCase().startsWith(heading.toLowerCase())
        ? `${heading}: ${text}`
        : text;
      if (strong) push(planLines, line);
      // Don't duplicate whole pricing cards into the offers bucket, and skip
      // long paragraphs that merely say "we offer…".
      if (offer && !strong && text.length <= 220) push(offerLines, line, 180);
    });

    // 3) Offer windows: promotions often live inside card markup ("40% off",
    //    "code BF40"). Scan around those tokens; plan windows are only used
    //    when no card structure was found.
    const flat = root.text().replace(/\s+/g, ' ').trim();
    const words = flat.split(' ');
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const priceHit = STRONG_PRICE.test(word) || /\d[\d,.]*\s?\/(?:mo|month|yr|year)\b/i.test(word);
      const offerHit = OFFER_SIGNAL.test(word);
      if (!priceHit && !offerHit) continue;
      const span = offerHit && !priceHit ? 12 : 35;
      const snippet = words.slice(Math.max(0, i - span), Math.min(words.length, i + span)).join(' ');
      if (offerHit && !priceHit) push(offerLines, snippet, 180);
      else if (priceHit && planLines.length < 8) push(planLines, snippet, 260);
    }

    if (!offerLines.length && !planLines.length) return null;

    const parts: string[] = [];
    if (pageTitle) parts.push(`Page: ${pageTitle}`);
    parts.push(`URL: ${url}`);
    if (offerLines.length) {
      parts.push(`Offers / promotions:\n${offerLines.slice(0, 4).map((l) => `- ${l}`).join('\n')}`);
    }
    if (planLines.length) {
      parts.push(`Plans / pricing:\n${planLines.slice(0, 6).map((l) => `- ${l}`).join('\n')}`);
    }
    return parts.join('\n\n').slice(0, MAX_PROMPT_CHARS);
  }

  /**
   * Uncached extraction for the legacy path (visitor's current page when the
   * site has no configured pricing URL). Returns null on any failure.
   */
  async fetchPagePricing(url: string): Promise<string | null> {
    try {
      const html = await this.fetchHtml(url, 5_000);
      return this.extractPricingFacts(html, url)?.slice(0, MAX_PROMPT_CHARS) ?? null;
    } catch {
      return null;
    }
  }
}
