import { Controller, Get, Header } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { homePage, faviconSvg } from '../../common/pages';

@Controller()
export class RootController {
  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  index(): string {
    return homePage();
  }

  @Get('favicon.svg')
  @Header('Content-Type', 'image/svg+xml')
  @Header('Cache-Control', 'public, max-age=86400')
  favicon(): string {
    return faviconSvg();
  }

  @Get('favicon.ico')
  @Header('Content-Type', 'image/svg+xml')
  @Header('Cache-Control', 'public, max-age=86400')
  faviconIco(): string {
    return faviconSvg();
  }
}

@Controller('health')
export class HealthController {
  constructor(private db: DbService) {}

  @Get()
  async check() {
    let postgres: 'ok' | 'error' | 'not_configured';

    if (!process.env.DATABASE_URL) {
      postgres = 'not_configured';
    } else {
      try {
        await this.db.db.execute(sql`SELECT 1`);
        postgres = 'ok';
      } catch {
        postgres = 'error';
      }
    }

    return {
      status: postgres === 'ok' ? 'ok' : 'degraded',
      postgres,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
