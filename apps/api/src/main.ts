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
import { runMigrations } from './db/migrate';
import { AgentRunProcessor } from './modules/agents/runtime/processors/agent-run.processor';
import { AgentExecuteProcessor } from './modules/agents/runtime/processors/agent-execute.processor';
import { AgentFollowupProcessor } from './modules/agents/runtime/processors/agent-followup.processor';
import { ApprovalSweepProcessor } from './modules/agents/runtime/processors/approval-sweep.processor';
import { TaskSweepProcessor } from './modules/tasks/task-sweep.processor';

async function bootstrap() {
  const t0 = Date.now();

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { bufferLogs: true },
  );

  console.log(`[bootstrap] NestFactory.create: ${Date.now() - t0}ms`);

  app.useLogger(app.get(Logger));
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true }),
  );

  const port = parseInt(process.env.PORT ?? '3000');
  await app.listen(port, '0.0.0.0');

  console.log(`[bootstrap] app.listen: ${Date.now() - t0}ms`);

  app.get(AgentRunProcessor).startWorker();
  app.get(AgentExecuteProcessor).startWorker();
  app.get(AgentFollowupProcessor).startWorker();
  app.get(ApprovalSweepProcessor).startWorker();
  app.get(TaskSweepProcessor).startWorker();

  await runMigrations();
}

bootstrap();
