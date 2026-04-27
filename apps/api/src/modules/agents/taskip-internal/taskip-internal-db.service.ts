import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import postgres from 'postgres';

export interface TaskipUserDetail {
  id: string;
  email: string;
  name: string;
  plan: string;
  createdAt: string;
  trialEndsAt: string | null;
  lastActiveAt: string | null;
  cancelledAt: string | null;
  featureCount: number;
}

export interface TaskipSubscription {
  id: string;
  userId: string;
  plan: string;
  status: string;
  startedAt: string;
  endsAt: string | null;
}

export interface TaskipInvoice {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
}

@Injectable()
export class TaskipInternalDbService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TaskipInternalDbService.name);
  private sql: ReturnType<typeof postgres> | null = null;

  onModuleInit() {
    const url = process.env.TASKIP_DB_URL_READONLY;
    if (!url) {
      this.logger.warn('TASKIP_DB_URL_READONLY not set — Taskip DB queries will return empty');
      return;
    }
    this.sql = postgres(url, { max: 3 });
  }

  async onModuleDestroy() {
    await this.sql?.end();
  }

  async lookupUser(emailOrId: string): Promise<TaskipUserDetail | null> {
    if (!this.sql) return null;
    try {
      const isUuid = /^[0-9a-f-]{36}$/i.test(emailOrId);
      const rows = await this.sql<TaskipUserDetail[]>`
        SELECT id, email, name, plan,
               created_at as "createdAt",
               trial_ends_at as "trialEndsAt",
               last_active_at as "lastActiveAt",
               cancelled_at as "cancelledAt",
               COALESCE(feature_count, 0) as "featureCount"
        FROM users
        WHERE ${isUuid ? this.sql`id = ${emailOrId}` : this.sql`email ILIKE ${'%' + emailOrId + '%'}`}
        LIMIT 1`;
      return rows[0] ?? null;
    } catch (err) {
      this.logger.error(`lookupUser failed: ${(err as Error).message}`);
      return null;
    }
  }

  async querySubscriptions(userId: string): Promise<TaskipSubscription[]> {
    if (!this.sql) return [];
    try {
      return await this.sql<TaskipSubscription[]>`
        SELECT id, user_id as "userId", plan, status,
               started_at as "startedAt", ends_at as "endsAt"
        FROM subscriptions
        WHERE user_id = ${userId}
        ORDER BY started_at DESC
        LIMIT 10`;
    } catch (err) {
      this.logger.error(`querySubscriptions failed: ${(err as Error).message}`);
      return [];
    }
  }

  async queryInvoices(userId: string): Promise<TaskipInvoice[]> {
    if (!this.sql) return [];
    try {
      return await this.sql<TaskipInvoice[]>`
        SELECT id, user_id as "userId", amount, currency, status,
               created_at as "createdAt"
        FROM invoices
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT 20`;
    } catch (err) {
      this.logger.error(`queryInvoices failed: ${(err as Error).message}`);
      return [];
    }
  }

  async extendTrial(userId: string, days: number): Promise<{ success: boolean; newTrialEndsAt?: string }> {
    if (!this.sql) return { success: false };
    try {
      const rows = await this.sql<{ trialEndsAt: string }[]>`
        UPDATE users
        SET trial_ends_at = COALESCE(trial_ends_at, NOW()) + (${days} || ' days')::interval,
            updated_at = NOW()
        WHERE id = ${userId}
        RETURNING trial_ends_at as "trialEndsAt"`;
      return { success: true, newTrialEndsAt: rows[0]?.trialEndsAt };
    } catch (err) {
      this.logger.error(`extendTrial failed: ${(err as Error).message}`);
      return { success: false };
    }
  }

  async markRefund(userId: string, invoiceId: string): Promise<{ success: boolean }> {
    if (!this.sql) return { success: false };
    try {
      await this.sql`
        UPDATE invoices
        SET status = 'refund_requested', updated_at = NOW()
        WHERE id = ${invoiceId} AND user_id = ${userId}`;
      return { success: true };
    } catch (err) {
      this.logger.error(`markRefund failed: ${(err as Error).message}`);
      return { success: false };
    }
  }
}
