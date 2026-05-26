import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { LoggerModule } from 'nestjs-pino';
import { Module } from '@nestjs/common';
import { DbModule } from './db/db.module';
import { QUEUE_NAMES } from './common/queue/queue.constants';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
      },
    }),

    BullModule.forRootAsync({
      useFactory: () => {
        const u = new URL(process.env.REDIS_URL!);
        return {
          connection: {
            host: u.hostname,
            port: Number(u.port) || 6379,
            ...(u.password && { password: decodeURIComponent(u.password) }),
            ...(u.username && { username: decodeURIComponent(u.username) }),
            ...(u.pathname && u.pathname !== '/' && { db: Number(u.pathname.slice(1)) }),
            maxRetriesPerRequest: null,
          },
        };
      },
    }),

    BullModule.registerQueue(
      ...Object.values(QUEUE_NAMES).map((name) => ({ name })),
    ),

    DbModule,
    // Agent worker processors will be imported here in later phases
  ],
})
class WorkerModule {}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
  });
  await app.init();
  console.log('Worker started');

  process.on('SIGTERM', () => app.close());
  process.on('SIGINT', () => app.close());
}

bootstrap();
