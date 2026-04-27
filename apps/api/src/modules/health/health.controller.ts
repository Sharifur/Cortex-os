import { Controller, Get } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import IORedis from 'ioredis';
import { Client as MinioClient } from 'minio';
import { DbService } from '../../db/db.service';
import { SettingsService } from '../settings/settings.service';

type ServiceStatus = 'ok' | 'error' | 'not_configured';

interface ServiceCheck {
  status: ServiceStatus;
  message?: string;
}

@Controller('health')
export class HealthController {
  constructor(
    private db: DbService,
    private settings: SettingsService,
  ) {}

  @Get()
  async check() {
    const checks: Record<string, ServiceCheck> = {};

    // Postgres
    if (!process.env.DATABASE_URL) {
      checks.postgres = { status: 'not_configured', message: 'DATABASE_URL not set' };
    } else {
      try {
        await this.db.db.execute(sql`SELECT 1`);
        checks.postgres = { status: 'ok' };
      } catch (err) {
        checks.postgres = { status: 'error', message: err instanceof Error ? err.message : String(err) };
      }
    }

    // Redis
    if (!process.env.REDIS_URL) {
      checks.redis = { status: 'not_configured', message: 'REDIS_URL not set' };
    } else {
      try {
        const redis = new IORedis(process.env.REDIS_URL, { lazyConnect: true, connectTimeout: 3000 });
        await redis.connect();
        await redis.ping();
        await redis.quit();
        checks.redis = { status: 'ok' };
      } catch (err) {
        checks.redis = { status: 'error', message: err instanceof Error ? err.message : String(err) };
      }
    }

    // MinIO
    const minioEndpoint = process.env.MINIO_ENDPOINT;
    const minioKey = process.env.MINIO_ACCESS_KEY;
    const minioSecret = process.env.MINIO_SECRET_KEY;
    if (!minioEndpoint || !minioKey || !minioSecret) {
      checks.minio = { status: 'not_configured', message: 'MINIO_ENDPOINT, MINIO_ACCESS_KEY or MINIO_SECRET_KEY not set' };
    } else {
      try {
        const useSSL = process.env.MINIO_USE_SSL === 'true';
        const port = process.env.MINIO_PORT ? parseInt(process.env.MINIO_PORT) : (useSSL ? 443 : 9000);
        const client = new MinioClient({
          endPoint: minioEndpoint,
          port,
          useSSL,
          accessKey: minioKey,
          secretKey: minioSecret,
        });
        await client.listBuckets();
        checks.minio = { status: 'ok' };
      } catch (err) {
        checks.minio = { status: 'error', message: err instanceof Error ? err.message : String(err) };
      }
    }

    // LLM — at least one key present
    const [openaiKey, geminiKey, deepseekKey] = await Promise.all([
      this.settings.getDecrypted('openai_api_key'),
      this.settings.getDecrypted('gemini_api_key'),
      this.settings.getDecrypted('deepseek_api_key'),
    ]);
    checks.llm = openaiKey || geminiKey || deepseekKey
      ? { status: 'ok', message: [openaiKey && 'OpenAI', geminiKey && 'Gemini', deepseekKey && 'DeepSeek'].filter(Boolean).join(', ') }
      : { status: 'not_configured', message: 'No LLM API key set' };

    // Telegram
    const [tgToken, tgChatId] = await Promise.all([
      this.settings.getDecrypted('telegram_bot_token'),
      this.settings.getDecrypted('telegram_owner_chat_id'),
    ]);
    checks.telegram = tgToken && tgChatId
      ? { status: 'ok' }
      : { status: 'not_configured', message: !tgToken ? 'Bot token missing' : 'Owner chat ID missing' };

    // Gmail
    const [gmailId, gmailSecret, gmailToken] = await Promise.all([
      this.settings.getDecrypted('gmail_client_id'),
      this.settings.getDecrypted('gmail_client_secret'),
      this.settings.getDecrypted('gmail_refresh_token'),
    ]);
    checks.gmail = gmailId && gmailSecret && gmailToken
      ? { status: 'ok' }
      : { status: 'not_configured' };

    // WhatsApp
    const [waToken, waPhoneId] = await Promise.all([
      this.settings.getDecrypted('whatsapp_api_token'),
      this.settings.getDecrypted('whatsapp_phone_number_id'),
    ]);
    checks.whatsapp = waToken && waPhoneId
      ? { status: 'ok' }
      : { status: 'not_configured' };

    // LinkedIn (Unipile or direct token)
    const [unipileKey, linkedinToken] = await Promise.all([
      this.settings.getDecrypted('unipile_api_key'),
      this.settings.getDecrypted('linkedin_access_token'),
    ]);
    checks.linkedin = unipileKey || linkedinToken
      ? { status: 'ok', message: unipileKey ? 'via Unipile' : 'direct token' }
      : { status: 'not_configured' };

    // Reddit
    const [redditId, redditSecret] = await Promise.all([
      this.settings.getDecrypted('reddit_client_id'),
      this.settings.getDecrypted('reddit_client_secret'),
    ]);
    checks.reddit = redditId && redditSecret
      ? { status: 'ok' }
      : { status: 'not_configured' };

    // Crisp
    const [crispSite, crispApiKey] = await Promise.all([
      this.settings.getDecrypted('crisp_website_id'),
      this.settings.getDecrypted('crisp_api_key'),
    ]);
    checks.crisp = crispSite && crispApiKey
      ? { status: 'ok' }
      : { status: 'not_configured' };

    // SES (only AWS service used)
    const [awsKey, awsSecret, awsRegion] = await Promise.all([
      this.settings.getDecrypted('aws_access_key_id'),
      this.settings.getDecrypted('aws_secret_access_key'),
      this.settings.getDecrypted('aws_region'),
    ]);
    checks.ses = awsKey && awsSecret && awsRegion
      ? { status: 'ok', message: awsRegion }
      : { status: 'not_configured' };

    const coreOk = checks.postgres?.status === 'ok' && checks.redis?.status === 'ok';

    return {
      status: coreOk ? 'ok' : 'degraded',
      checks,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
