import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { LoggerModule } from 'nestjs-pino';
import IORedis from 'ioredis';
import { DbModule } from './db/db.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { QUEUE_NAMES } from './common/queue/queue.constants';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
        ...(process.env.NODE_ENV !== 'production' && {
          transport: { target: 'pino-pretty', options: { singleLine: true } },
        }),
      },
    }),

    BullModule.forRootAsync({
      useFactory: () => ({
        connection: new IORedis(process.env.REDIS_URL!, {
          maxRetriesPerRequest: null,
        }),
      }),
    }),

    BullModule.registerQueue(
      ...Object.values(QUEUE_NAMES).map((name) => ({ name })),
    ),

    DbModule,
    AuthModule,
    HealthModule,
    MetricsModule,
  ],
})
export class AppModule {}
