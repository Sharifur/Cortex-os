import { Controller, Get } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DbService } from '../../db/db.service';

@Controller('health')
export class HealthController {
  constructor(private db: DbService) {}

  @Get()
  async check() {
    const checks: Record<string, 'ok' | 'error'> = {};

    try {
      await this.db.db.execute(sql`SELECT 1`);
      checks.postgres = 'ok';
    } catch {
      checks.postgres = 'error';
    }

    const allOk = Object.values(checks).every((v) => v === 'ok');

    return {
      status: allOk ? 'ok' : 'degraded',
      checks,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
