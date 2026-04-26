import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LoggerModule } from 'nestjs-pino';
import IORedis from 'ioredis';
import { DbModule } from './db/db.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { AgentsModule } from './modules/agents/agents.module';
import { RunsModule } from './modules/runs/runs.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { SettingsModule } from './modules/settings/settings.module';
import { LlmModule } from './modules/llm/llm.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { McpModule } from './modules/mcp/mcp.module';
import { SesModule } from './modules/ses/ses.module';
import { TaskipTrialModule } from './modules/agents/taskip-trial/taskip-trial.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),

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

    DbModule,
    AuthModule,
    HealthModule,
    MetricsModule,
    AgentsModule,
    RunsModule,
    ApprovalsModule,
    SettingsModule,
    LlmModule,
    TelegramModule,
    McpModule,
    SesModule,
    TaskipTrialModule,
  ],
})
export class AppModule {}
