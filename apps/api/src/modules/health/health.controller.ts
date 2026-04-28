import { Controller, Get } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DbService } from '../../db/db.service';

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
