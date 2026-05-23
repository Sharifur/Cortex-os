import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { RequestLogExceptionFilter } from './modules/debug-logs/request-log.filter';
import { runMigrations } from './db/migrate';
import { AgentRunProcessor } from './modules/agents/runtime/processors/agent-run.processor';
import { AgentExecuteProcessor } from './modules/agents/runtime/processors/agent-execute.processor';
import { AgentFollowupProcessor } from './modules/agents/runtime/processors/agent-followup.processor';
import { ApprovalSweepProcessor } from './modules/agents/runtime/processors/approval-sweep.processor';
import { TaskSweepProcessor } from './modules/tasks/task-sweep.processor';
import { TaskipInternalEmailSweepProcessor } from './modules/agents/taskip-internal/taskip-internal-email-sweep.processor';
import { DesignStudioProcessor } from './modules/design-studio/design-studio.processor';
import { LinkedInCronProcessor } from './modules/agents/linkedin/linkedin-cron.processor';
import { LivechatOriginCache } from './modules/agents/livechat/livechat-origin.cache';
import multipart from '@fastify/multipart';

function assertJwtSecret(): void {
  const v = process.env.JWT_SECRET;
  const weak = !v || v.length < 32 || ['changeme', 'secret', 'jwtsecret', 'devsecret'].includes(v.toLowerCase());
  if (weak) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET is missing or weak. Set a 32+ char random value in env.');
    }
    // eslint-disable-next-line no-console
    console.warn('[security] JWT_SECRET is missing or weak — refuse to deploy this to production.');
  }
}

async function bootstrap() {
  assertJwtSecret();

  if (process.env.RUN_MIGRATIONS_ON_BOOT !== 'false') {
    try {
      await runMigrations();
      // eslint-disable-next-line no-console
      console.log('[bootstrap] migrations up-to-date');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[bootstrap] migrations failed:', (err as Error).message);
      throw err;
    }
  }

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true, bodyLimit: 15 * 1024 * 1024 }),
    { bufferLogs: true, bodyParser: false },
  );

  const fastify = app.getHttpAdapter().getInstance();

  // Preserve raw JSON body for webhook HMAC verification.
  // bodyParser:false above prevents Nest from installing its own JSON parser,
  // so ours is the only one registered for application/json.
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    ((req: unknown, body: string, done: (err: Error | null, parsed?: unknown) => void) => {
      (req as { rawBody?: string }).rawBody = body;
      try {
        done(null, body && body.length ? JSON.parse(body) : {});
      } catch {
        // Some CRM/webhook senders embed raw control characters inside string values.
        // Strip ASCII 0x00–0x08, 0x0B–0x0C, 0x0E–0x1F (keeps \t \n \r which are valid when escaped).
        const sanitized = body.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
        try {
          done(null, JSON.parse(sanitized));
        } catch (err2) {
          done(err2 as Error);
        }
      }
    }) as never,
  );

  // SNS sends Content-Type: text/plain with a JSON body — parse it the same way.
  fastify.addContentTypeParser(
    'text/plain',
    { parseAs: 'string' },
    ((req: unknown, body: string, done: (err: Error | null, parsed?: unknown) => void) => {
      try {
        done(null, body && body.length ? JSON.parse(body) : {});
      } catch {
        done(null, {});
      }
    }) as never,
  );

  // Multipart upload support for live-chat attachments. Limit per file: 10 MB.
  // Other endpoints continue to use the JSON parser registered above.
  // (cast: @fastify/multipart's TypeProvider augmentation conflicts with the
  // base FastifyInstance generic params; runtime behavior is correct.)
  await fastify.register(multipart as never, {
    limits: { fileSize: 10 * 1024 * 1024, files: 20 },
  });

  fastify.addHook('onSend', async (_req: unknown, reply: { header: (k: string, v: string) => unknown }, payload: unknown) => {
    // Skip page-level security headers for the tracking pixel endpoint.
    // CDN/proxy layers between email clients and the API can reject a GIF that
    // carries a Content-Security-Policy or X-Frame-Options header.
    if ((_req as { url?: string }).url?.startsWith('/track/')) return payload;

    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('X-DNS-Prefetch-Control', 'off');
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    reply.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    reply.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    return payload;
  });

  app.useLogger(app.get(Logger));
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true }),
  );
  app.useGlobalFilters(app.get(RequestLogExceptionFilter));

  // Mount socket.io on the same HTTP server (path: /ws) for realtime activity,
  // approvals and operations. Socket.io upgrades the HTTP connection, so it
  // bypasses the proxy buffering that broke our SSE streams.
  app.useWebSocketAdapter(new IoAdapter(app));

  const allowList = (process.env.CORS_ORIGINS ?? 'https://cortex.xgenious.com,http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // Live chat sites are configured at runtime; the cache is consulted per-request
  // so adding a new site does not require restarting the API.
  const livechatOrigins = app.get(LivechatOriginCache, { strict: false });

  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowList.includes('*') || allowList.includes(origin)) return cb(null, true);
      if (livechatOrigins?.has(origin)) return cb(null, true);
      return cb(new Error(`CORS: origin ${origin} not allowed`), false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Webhook-Secret', 'X-Hub-Signature-256', 'X-Hub-Signature'],
    credentials: true,
    maxAge: 86400,
  });

  const port = parseInt(process.env.PORT ?? '3000');
  await app.listen(port, '0.0.0.0');

  app.get(AgentRunProcessor).startWorker();
  app.get(AgentExecuteProcessor).startWorker();
  app.get(AgentFollowupProcessor).startWorker();
  app.get(ApprovalSweepProcessor).startWorker();
  app.get(TaskSweepProcessor).startWorker();
  app.get(TaskipInternalEmailSweepProcessor).startWorker();
  app.get(DesignStudioProcessor).startWorker();
  app.get(LinkedInCronProcessor).startWorker();
}

bootstrap();
