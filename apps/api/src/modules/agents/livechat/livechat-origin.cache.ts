import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { livechatSites } from './schema';

@Injectable()
export class LivechatOriginCache implements OnModuleInit {
  private readonly logger = new Logger(LivechatOriginCache.name);
  /** Exact normalized origins e.g. https://taskip.net */
  private origins = new Set<string>();
  /** Exact hostnames e.g. taskip.net */
  private hostnames = new Set<string>();
  /** Wildcard suffixes e.g. .taskip.net (already includes leading dot) */
  private wildcardSuffixes = new Set<string>();
  /** True when any site has origin=* (allow all) */
  private allowAll = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(private db: DbService) {}

  async onModuleInit() {
    await this.refresh().catch((err) => this.logger.warn(`initial refresh failed: ${(err as Error).message}`));
    this.timer = setInterval(() => {
      this.refresh().catch((err) => this.logger.debug(`refresh failed: ${(err as Error).message}`));
    }, 30_000);
    this.timer.unref();
  }

  has(origin: string | null | undefined): boolean {
    if (!origin) return false;
    if (this.allowAll) return true;
    if (this.origins.has(origin)) return true;
    try {
      const hostname = new URL(origin.trim()).hostname.toLowerCase().replace(/^www\./, '');
      if (this.hostnames.has(hostname)) return true;
      for (const suffix of this.wildcardSuffixes) {
        if (hostname === suffix.slice(1) || hostname.endsWith(suffix)) return true;
      }
    } catch { /* ignore */ }
    return false;
  }

  list(): string[] {
    return Array.from(this.origins);
  }

  async refresh(): Promise<void> {
    const rows = await this.db.db
      .select({ origin: livechatSites.origin })
      .from(livechatSites)
      .where(eq(livechatSites.enabled, true));

    const newOrigins = new Set<string>();
    const newHostnames = new Set<string>();
    const newWildcards = new Set<string>();
    let newAllowAll = false;

    for (const row of rows) {
      for (const entry of row.origin.split(',')) {
        const e = entry.trim();
        if (!e) continue;
        if (e === '*') { newAllowAll = true; continue; }
        if (e.startsWith('*.')) {
          newWildcards.add(e.slice(1)); // store as '.taskip.net'
        } else {
          newOrigins.add(e);
          try { newHostnames.add(new URL(e).hostname.toLowerCase().replace(/^www\./, '')); } catch { /* skip */ }
        }
      }
    }

    this.origins = newOrigins;
    this.hostnames = newHostnames;
    this.wildcardSuffixes = newWildcards;
    this.allowAll = newAllowAll;
  }
}
