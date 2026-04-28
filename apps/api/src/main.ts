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
import { HtmlExceptionFilter } from './common/filters/html-exception.filter';
import { AgentRunProcessor } from './modules/agents/runtime/processors/agent-run.processor';
import { AgentExecuteProcessor } from './modules/agents/runtime/processors/agent-execute.processor';
import { AgentFollowupProcessor } from './modules/agents/runtime/processors/agent-followup.processor';
import { ApprovalSweepProcessor } from './modules/agents/runtime/processors/approval-sweep.processor';
import { TaskSweepProcessor } from './modules/tasks/task-sweep.processor';
import { TaskipInternalEmailSweepProcessor } from './modules/agents/taskip-internal/taskip-internal-email-sweep.processor';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { bufferLogs: true },
  );

  app.useLogger(app.get(Logger));
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true }),
  );
  app.useGlobalFilters(new HtmlExceptionFilter());

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
