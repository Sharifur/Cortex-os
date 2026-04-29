import { Controller, Get, Header } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import IORedis from 'ioredis';
import { DbService } from '../../db/db.service';
import { homePage, faviconSvg } from '../../common/pages';

type ServiceStatus = 'ok' | 'error' | 'not_configured';
interface ServiceCheck { status: ServiceStatus; message?: string; }

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
    const checks: Record<string, ServiceCheck> = {
      postgres: await this.checkPostgres(),
      redis: await this.checkRedis(),
      minio: this.checkMinio(),
    };

    const coreOk = checks.postgres.status === 'ok';

    return {
      status: coreOk ? 'ok' : 'degraded',
      checks,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  private async checkPostgres(): Promise<ServiceCheck> {
    if (!process.env.DATABASE_URL) return { status: 'not_configured' };
    try {
      await this.db.db.execute(sql`SELECT 1`);
      return { status: 'ok' };
    } catch (err) {
      return { status: 'error', message: (err as Error).message };
    }
  }

  private async checkRedis(): Promise<ServiceCheck> {
    const url = process.env.REDIS_URL;
    if (!url) return { status: 'not_configured' };
    let client: IORedis | null = null;
    try {
      client = new IORedis(url, { lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 2000 });
      await client.connect();
      const pong = await client.ping();
      return pong === 'PONG' ? { status: 'ok' } : { status: 'error', message: `Unexpected reply: ${pong}` };
    } catch (err) {
      return { status: 'error', message: (err as Error).message };
    } finally {
      if (client) {
        try { client.disconnect(); } catch { /* noop */ }
      }
    }
  }

  private checkMinio(): ServiceCheck {
    const endpoint = process.env.MINIO_ENDPOINT;
    const access = process.env.MINIO_ACCESS_KEY;
    const secret = process.env.MINIO_SECRET_KEY;
    if (!endpoint || !access || !secret) return { status: 'not_configured' };
    return { status: 'ok', message: 'Credentials present (no live probe)' };
  }
}
