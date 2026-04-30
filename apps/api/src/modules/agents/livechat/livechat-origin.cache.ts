import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { livechatSites } from './schema';

@Injectable()
export class LivechatOriginCache implements OnModuleInit {
  private readonly logger = new Logger(LivechatOriginCache.name);
  private origins = new Set<string>();
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
    return this.origins.has(origin);
  }

  list(): string[] {
    return Array.from(this.origins);
  }

  async refresh(): Promise<void> {
    const rows = await this.db.db
      .select({ origin: livechatSites.origin })
      .from(livechatSites)
      .where(eq(livechatSites.enabled, true));
    this.origins = new Set(rows.map((r) => r.origin));
  }
}
