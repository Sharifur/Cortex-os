import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import postgres from 'postgres';

export interface TaskipUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  trialEndsAt: string | null;
  lastActiveAt: string | null;
  plan: string;
}

// Expected Taskip user table schema (verify against actual Taskip DB):
//   users(id, email, name, created_at, trial_ends_at, last_active_at, plan, cancelled_at, feature_count)

@Injectable()
export class TaskipDbService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TaskipDbService.name);
  private sql!: ReturnType<typeof postgres>;

  onModuleInit() {
    const url = process.env.TASKIP_DB_URL_READONLY;
    if (!url) {
      this.logger.warn('TASKIP_DB_URL_READONLY not set — segment queries will return empty');
      return;
    }
    this.sql = postgres(url, { max: 3 });
  }

  async onModuleDestroy() {
    await this.sql?.end();
  }

  async getUsersForSegment(segment: string, limit: number): Promise<TaskipUser[]> {
    if (!this.sql) return [];

    try {
      let rows: TaskipUser[] = [];

      switch (segment) {
        case 'trial_day_3':
          rows = await this.sql<TaskipUser[]>`
            SELECT id, email, name, created_at as "createdAt",
                   trial_ends_at as "trialEndsAt", last_active_at as "lastActiveAt", plan
            FROM users
            WHERE created_at::date = CURRENT_DATE - 3
              AND plan = 'trial'
            LIMIT ${limit}`;
          break;

        case 'trial_day_5_low_activity':
          rows = await this.sql<TaskipUser[]>`
            SELECT id, email, name, created_at as "createdAt",
                   trial_ends_at as "trialEndsAt", last_active_at as "lastActiveAt", plan
            FROM users
            WHERE created_at::date = CURRENT_DATE - 5
              AND plan = 'trial'
              AND COALESCE(feature_count, 0) < 3
            LIMIT ${limit}`;
          break;

        case 'trial_expiring_24h':
          rows = await this.sql<TaskipUser[]>`
            SELECT id, email, name, created_at as "createdAt",
                   trial_ends_at as "trialEndsAt", last_active_at as "lastActiveAt", plan
            FROM users
            WHERE trial_ends_at BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
              AND plan = 'trial'
            LIMIT ${limit}`;
          break;

        case 'paid_at_risk':
          rows = await this.sql<TaskipUser[]>`
            SELECT id, email, name, created_at as "createdAt",
                   NULL::timestamptz as "trialEndsAt",
                   last_active_at as "lastActiveAt", plan
            FROM users
            WHERE plan NOT IN ('trial', 'free')
              AND last_active_at < NOW() - INTERVAL '14 days'
            LIMIT ${limit}`;
          break;

        case 'churned_30d':
          rows = await this.sql<TaskipUser[]>`
            SELECT id, email, name, created_at as "createdAt",
                   NULL::timestamptz as "trialEndsAt",
                   last_active_at as "lastActiveAt", plan
            FROM users
            WHERE cancelled_at::date = CURRENT_DATE - 30
            LIMIT ${limit}`;
          break;
      }

      return rows;
    } catch (err) {
      this.logger.error(`Segment query failed (${segment}): ${(err as Error).message}`);
      return [];
    }
  }
}
