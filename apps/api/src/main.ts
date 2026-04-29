import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { RequestLogExceptionFilter } from './modules/debug-logs/request-log.filter';
import { AgentRunProcessor } from './modules/agents/runtime/processors/agent-run.processor';
import { AgentExecuteProcessor } from './modules/agents/runtime/processors/agent-execute.processor';
import { AgentFollowupProcessor } from './modules/agents/runtime/processors/agent-followup.processor';
import { ApprovalSweepProcessor } from './modules/agents/runtime/processors/approval-sweep.processor';
import { TaskSweepProcessor } from './modules/tasks/task-sweep.processor';
import { TaskipInternalEmailSweepProcessor } from './modules/agents/taskip-internal/taskip-internal-email-sweep.processor';

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

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true }),
    { bufferLogs: true },
  );

  const fastify = app.getHttpAdapter().getInstance();

  // Preserve raw JSON body for webhook HMAC verification (overrides default JSON parser)
  fastify.removeContentTypeParser?.('application/json');
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    ((req: unknown, body: string, done: (err: Error | null, parsed?: unknown) => void) => {
      (req as { rawBody?: string }).rawBody = body;
      try {
        done(null, body && body.length ? JSON.parse(body) : {});
      } catch (err) {
        done(err as Error);
      }
    }) as never,
  );

  fastify.addHook('onSend', async (_req: unknown, reply: { header: (k: string, v: string) => unknown }, payload: unknown) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('X-DNS-Prefetch-Control', 'off');
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    reply.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    return payload;
  });

  app.useLogger(app.get(Logger));
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true }),
  );
  app.useGlobalFilters(app.get(RequestLogExceptionFilter));

  const allowList = (process.env.CORS_ORIGINS ?? 'https://cortex.xgenious.com,http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowList.includes('*') || allowList.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS: origin ${origin} not allowed`), false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    credentials: false,
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
}

bootstrap();
