import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import postgres from 'postgres';
import { SettingsService } from '../../settings/settings.service';

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
export class TaskipInternalDbService implements OnModuleDestroy {
  private readonly logger = new Logger(TaskipInternalDbService.name);
  private sql: ReturnType<typeof postgres> | null = null;

  constructor(private readonly settings: SettingsService) {}

  private async getClient(): Promise<ReturnType<typeof postgres> | null> {
    if (this.sql) return this.sql;
    const url = (await this.settings.getDecrypted('taskip_db_url_readonly'))?.trim();
    if (!url) {
      this.logger.warn('taskip_db_url_readonly not set in Settings — Taskip DB queries will return empty');
      return null;
    }
    this.sql = postgres(url, { max: 3 });
    return this.sql;
  }

  async onModuleDestroy() {
    await this.sql?.end();
  }

  async lookupUser(emailOrId: string): Promise<TaskipUserDetail | null> {
    const sql = await this.getClient();
    if (!sql) return null;
    try {
      const isUuid = /^[0-9a-f-]{36}$/i.test(emailOrId);
      const rows = await sql<TaskipUserDetail[]>`
        SELECT id, email, name, plan,
               created_at as "createdAt",
               trial_ends_at as "trialEndsAt",
               last_active_at as "lastActiveAt",
               cancelled_at as "cancelledAt",
               COALESCE(feature_count, 0) as "featureCount"
        FROM users
        WHERE ${isUuid ? sql`id = ${emailOrId}` : sql`email ILIKE ${'%' + emailOrId + '%'}`}
        LIMIT 1`;
      return rows[0] ?? null;
    } catch (err) {
      this.logger.error(`lookupUser failed: ${(err as Error).message}`);
      return null;
    }
  }

  async querySubscriptions(userId: string): Promise<TaskipSubscription[]> {
    const sql = await this.getClient();
    if (!sql) return [];
    try {
      return await sql<TaskipSubscription[]>`
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
    const sql = await this.getClient();
    if (!sql) return [];
    try {
      return await sql<TaskipInvoice[]>`
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

  async lookupUserByWorkspace(workspaceUuid: string): Promise<TaskipUserDetail | null> {
    const sql = await this.getClient();
    if (!sql) return null;
    try {
      const rows = await sql<TaskipUserDetail[]>`
        SELECT u.id, u.email, u.name, u.plan,
               u.created_at as "createdAt",
               u.trial_ends_at as "trialEndsAt",
               u.last_active_at as "lastActiveAt",
               u.cancelled_at as "cancelledAt",
               COALESCE(u.feature_count, 0) as "featureCount"
        FROM workspaces w
        JOIN users u ON u.id = w.user_id
        WHERE w.uuid = ${workspaceUuid}
        LIMIT 1`;
      return rows[0] ?? null;
    } catch (err) {
      this.logger.error(`lookupUserByWorkspace failed: ${(err as Error).message}`);
      return null;
    }
  }

  async extendTrial(userId: string, days: number): Promise<{ success: boolean; newTrialEndsAt?: string }> {
    const sql = await this.getClient();
    if (!sql) return { success: false };
    try {
      const rows = await sql<{ trialEndsAt: string }[]>`
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
    const sql = await this.getClient();
    if (!sql) return { success: false };
    try {
      await sql`
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
