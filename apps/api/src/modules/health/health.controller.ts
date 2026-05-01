import { Controller, Get, Header } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import IORedis from 'ioredis';
import { DbService } from '../../db/db.service';
import { SettingsService } from '../settings/settings.service';
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
  constructor(
    private db: DbService,
    private settings: SettingsService,
  ) {}

  @Get()
  async check() {
    const [postgres, redis, llm, telegram, ses, gmail, whatsapp, linkedin, reddit] = await Promise.all([
      this.checkPostgres(),
      this.checkRedis(),
      this.checkLlm(),
      this.checkAllPresent(['telegram_bot_token', 'telegram_owner_chat_id']),
      this.checkAllPresent(['aws_access_key_id', 'aws_secret_access_key', 'ses_from_address']),
      this.checkGmail(),
      this.checkAllPresent(['whatsapp_api_token', 'whatsapp_phone_number_id']),
      this.checkLinkedIn(),
      this.checkAllPresent(['reddit_client_id', 'reddit_client_secret', 'reddit_username', 'reddit_password']),
    ]);

    const checks: Record<string, ServiceCheck> = {
      postgres,
      redis,
      minio: this.checkMinio(),
      llm,
      telegram,
      ses,
      gmail,
      whatsapp,
      linkedin,
      reddit,
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

  private async checkAllPresent(keys: string[]): Promise<ServiceCheck> {
    const values = await Promise.all(keys.map((k) => this.settings.getDecrypted(k)));
    const missing = keys.filter((_, i) => !values[i]);
    if (missing.length === keys.length) return { status: 'not_configured' };
    if (missing.length > 0) return { status: 'error', message: `Missing: ${missing.join(', ')}` };
    return { status: 'ok' };
  }

  private async checkLlm(): Promise<ServiceCheck> {
    const [openai, gemini, deepseek] = await Promise.all([
      this.settings.getDecrypted('openai_api_key'),
      this.settings.getDecrypted('gemini_api_key'),
      this.settings.getDecrypted('deepseek_api_key'),
    ]);
    const providers = [
      openai && 'OpenAI',
      gemini && 'Gemini',
      deepseek && 'DeepSeek',
    ].filter(Boolean) as string[];
    if (providers.length === 0) return { status: 'not_configured' };
    return { status: 'ok', message: providers.join(' · ') };
  }

  private async checkLinkedIn(): Promise<ServiceCheck> {
    const [unipile, oauth] = await Promise.all([
      this.settings.getDecrypted('unipile_api_key'),
      this.settings.getDecrypted('linkedin_access_token'),
    ]);
    if (unipile) return { status: 'ok', message: 'Unipile' };
    if (oauth) return { status: 'ok', message: 'Direct OAuth' };
    return { status: 'not_configured' };
  }

  private async checkGmail(): Promise<ServiceCheck> {
    try {
      const [{ count }] = await this.db.db.execute<{ count: number }>(sql`
        SELECT COUNT(*)::int AS count FROM gmail_accounts
      `);
      return count > 0
        ? { status: 'ok', message: `${count} account${count === 1 ? '' : 's'} connected` }
        : { status: 'not_configured' };
    } catch {
      return { status: 'not_configured' };
    }
  }
}
