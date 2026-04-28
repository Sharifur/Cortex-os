import { Controller, Get, Res } from '@nestjs/common';
import { FastifyReply } from 'fastify';
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
  async check(@Res() reply: FastifyReply) {
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

    // Storage (Cloudflare R2 / MinIO) — settings take precedence over env vars
    try {
      const [settingEndpoint, settingAccessKey, settingSecretKey, settingPort, settingUseSsl] = await Promise.all([
        this.settings.getDecrypted('storage_endpoint'),
        this.settings.getDecrypted('storage_access_key'),
        this.settings.getDecrypted('storage_secret_key'),
        this.settings.getDecrypted('storage_port'),
        this.settings.getDecrypted('storage_use_ssl'),
      ]);
      const storageEndpoint = settingEndpoint || process.env.MINIO_ENDPOINT;
      const storageAccessKey = settingAccessKey || process.env.MINIO_ACCESS_KEY;
      const storageSecretKey = settingSecretKey || process.env.MINIO_SECRET_KEY;
      if (!storageEndpoint || !storageAccessKey || !storageSecretKey) {
        checks.storage = { status: 'not_configured', message: 'Storage credentials not configured' };
      } else {
        try {
          const rawSsl = settingUseSsl ?? process.env.MINIO_USE_SSL;
          const useSSL = rawSsl ? rawSsl === 'true' : true;
          const rawPort = settingPort || process.env.MINIO_PORT;
          const port = rawPort ? parseInt(rawPort) : (useSSL ? 443 : 9000);
          const client = new MinioClient({
            endPoint: storageEndpoint,
            port,
            useSSL,
            accessKey: storageAccessKey,
            secretKey: storageSecretKey,
          });
          await client.listBuckets();
          checks.storage = { status: 'ok' };
        } catch (err) {
          checks.storage = { status: 'error', message: err instanceof Error ? err.message : String(err) };
        }
      }
    } catch (err) {
      checks.storage = { status: 'error', message: `Settings read failed: ${err instanceof Error ? err.message : String(err)}` };
    }

    // LLM — at least one key present
    try {
      const [openaiKey, geminiKey, deepseekKey] = await Promise.all([
        this.settings.getDecrypted('openai_api_key'),
        this.settings.getDecrypted('gemini_api_key'),
        this.settings.getDecrypted('deepseek_api_key'),
      ]);
      checks.llm = openaiKey || geminiKey || deepseekKey
        ? { status: 'ok', message: [openaiKey && 'OpenAI', geminiKey && 'Gemini', deepseekKey && 'DeepSeek'].filter(Boolean).join(', ') }
        : { status: 'not_configured', message: 'No LLM API key set' };
    } catch {
      checks.llm = { status: 'not_configured', message: 'Settings read failed' };
    }

    // Telegram
    try {
      const [tgToken, tgChatId] = await Promise.all([
        this.settings.getDecrypted('telegram_bot_token'),
        this.settings.getDecrypted('telegram_owner_chat_id'),
      ]);
      checks.telegram = tgToken && tgChatId
        ? { status: 'ok' }
        : { status: 'not_configured', message: !tgToken ? 'Bot token missing' : 'Owner chat ID missing' };
    } catch {
      checks.telegram = { status: 'not_configured', message: 'Settings read failed' };
    }

    const coreOk = checks.postgres?.status === 'ok' && checks.redis?.status === 'ok';
    const coreConfigured =
      checks.postgres?.status !== 'not_configured' && checks.redis?.status !== 'not_configured';

    const httpStatus = coreConfigured && !coreOk ? 503 : 200;

    return reply.code(httpStatus).send({
      status: coreOk ? 'ok' : 'degraded',
      checks,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  }
}
