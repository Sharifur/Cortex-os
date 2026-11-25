import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LoggerModule } from 'nestjs-pino';
import { DbModule } from './db/db.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { AgentsModule } from './modules/agents/agents.module';
import { RunsModule } from './modules/runs/runs.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { SettingsModule } from './modules/settings/settings.module';
import { LlmModule } from './modules/llm/llm.module';
import { SesModule } from './modules/ses/ses.module';
import { SpamCheckerModule } from './modules/spam-checker/spam-checker.module';
import { LivechatModule } from './modules/agents/livechat/livechat.module';
import { KnowledgeBaseModule } from './modules/knowledge-base/knowledge-base.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DebugLogsModule } from './modules/debug-logs/debug-logs.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { VisitorEnrichmentModule } from './common/visitor-enrichment/visitor-enrichment.module';
import { StorageModule } from './modules/storage/storage.module';
import { PushModule } from './modules/push/push.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { TrackingModule } from './modules/tracking/tracking.module';

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
            enableReadyCheck: false,
            connectTimeout: 3000,
            lazyConnect: true,
          },
        };
      },
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
    SesModule,
    SpamCheckerModule,
    LivechatModule,
    KnowledgeBaseModule,
    TasksModule,
    DashboardModule,
    DebugLogsModule,
    ContactsModule,
    RealtimeModule,
    VisitorEnrichmentModule,
    StorageModule,
    PushModule,
    NotificationsModule,
    TrackingModule,
  ],
})
export class AppModule {}
