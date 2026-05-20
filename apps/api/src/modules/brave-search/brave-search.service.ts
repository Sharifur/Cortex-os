import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { SettingsService } from '../settings/settings.service';

export interface BraveResult {
  url: string;
  title: string;
  description: string;
  rank: number;
}

@Injectable()
export class BraveSearchService {
  private readonly logger = new Logger(BraveSearchService.name);

  constructor(private readonly settings: SettingsService) {}

  async search(query: string, count = 10): Promise<BraveResult[]> {
    const apiKey = await this.settings.getDecrypted('brave_search_api_key').catch(() => null);
    if (!apiKey) {
      this.logger.warn('brave_search_api_key not configured — skipping Brave search');
      return [];
    }
    try {
      const res = await axios.get('https://api.search.brave.com/res/v1/web/search', {
        params: { q: query, count, search_lang: 'en' },
        headers: { 'X-Subscription-Token': apiKey, Accept: 'application/json' },
        timeout: 10000,
      });
      const results = res.data?.web?.results ?? [];
      return results.map((r: any, i: number) => ({
        url: r.url as string,
        title: (r.title as string) ?? '',
        description: (r.description as string) ?? '',
        rank: i + 1,
      }));
    } catch (err) {
      this.logger.warn(`Brave Search error: ${(err as Error).message}`);
      return [];
    }
  }

  async getOpenPageRank(domain: string): Promise<number | null> {
    const apiKey = await this.settings.getDecrypted('open_page_rank_api_key').catch(() => null);
    if (!apiKey) return null;
    try {
      const res = await axios.get('https://openpagerank.com/api/v1.0/getPageRank', {
        params: { 'domains[0]': domain },
        headers: { 'API-OPR': apiKey },
        timeout: 8000,
      });
      const entry = res.data?.response?.[0];
      return typeof entry?.page_rank_decimal === 'number' ? entry.page_rank_decimal : null;
    } catch {
      return null;
    }
  }
}
