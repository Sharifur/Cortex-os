import { Injectable, Logger } from '@nestjs/common';
import webpush from 'web-push';
import { eq, inArray } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { pushSubscriptions } from './push.schema';
import { SettingsService } from '../settings/settings.service';

export interface PushPayload {
  title: string;
  body: string;
  /** Notification tag — same tag replaces a previous notification instead of stacking. */
  tag?: string;
  /** Path the SW should navigate to on click. e.g. /livechat or /livechat?session=abc. */
  url?: string;
  /** Optional small icon URL override. */
  icon?: string;
  /** Optional renotify flag — re-buzz even if a notification with same tag exists. */
  renotify?: boolean;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private cached: { publicKey: string; privateKey: string; subject: string; expiresAt: number } | null = null;
  private readonly cacheMs = 60_000;

  constructor(private db: DbService, private settings: SettingsService) {}

  async getPublicKey(): Promise<string | null> {
    const cfg = await this.resolveVapid().catch(() => null);
    return cfg?.publicKey ?? null;
  }

  async isConfigured(): Promise<boolean> {
    return !!(await this.resolveVapid().catch(() => null));
  }

  /**
   * Upsert a subscription by endpoint. Same browser re-subscribing replaces
   * its previous keys (push servers rotate them).
   */
  async subscribe(input: {
    userId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    ua?: string | null;
    label?: string | null;
  }): Promise<void> {
    const [existing] = await this.db.db
      .select({ id: pushSubscriptions.id })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, input.endpoint))
      .limit(1);
    if (existing) {
      await this.db.db
        .update(pushSubscriptions)
        .set({
          userId: input.userId,
          p256dh: input.p256dh,
          auth: input.auth,
          ua: input.ua ?? null,
          label: input.label ?? null,
          lastSeenAt: new Date(),
        })
        .where(eq(pushSubscriptions.id, existing.id));
      return;
    }
    await this.db.db.insert(pushSubscriptions).values({
      userId: input.userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      ua: input.ua ?? null,
      label: input.label ?? null,
    });
  }

  async unsubscribe(endpoint: string): Promise<void> {
    await this.db.db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  }

  async listForUser(userId: string) {
    return this.db.db
      .select({
        id: pushSubscriptions.id,
        endpoint: pushSubscriptions.endpoint,
        ua: pushSubscriptions.ua,
        label: pushSubscriptions.label,
        lastSeenAt: pushSubscriptions.lastSeenAt,
        createdAt: pushSubscriptions.createdAt,
      })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
  }

  /**
   * Send a push to every subscribed operator. Stale subscriptions (404/410
   * responses from the push service) are pruned automatically.
   */
  async sendToAll(payload: PushPayload): Promise<{ sent: number; pruned: number }> {
    const cfg = await this.resolveVapid().catch(() => null);
    if (!cfg) {
      this.logger.debug('push not configured — skipping');
      return { sent: 0, pruned: 0 };
    }
    const subs = await this.db.db.select().from(pushSubscriptions);
    if (!subs.length) return { sent: 0, pruned: 0 };

    webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);

    const stale: string[] = [];
    let sent = 0;
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify(payload),
            { TTL: 60 },
          );
          sent++;
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            stale.push(s.endpoint);
          } else {
            this.logger.warn(`push failed for ${s.endpoint.slice(-20)}: ${(err as Error).message}`);
          }
        }
      }),
    );

    if (stale.length) {
      await this.db.db.delete(pushSubscriptions).where(inArray(pushSubscriptions.endpoint, stale));
      this.logger.log(`pruned ${stale.length} stale push subscriptions`);
    }
    return { sent, pruned: stale.length };
  }

  private async resolveVapid(forceRefresh = false): Promise<{ publicKey: string; privateKey: string; subject: string }> {
    if (!forceRefresh && this.cached && this.cached.expiresAt > Date.now()) return this.cached;
    const [publicKey, privateKey, subject] = await Promise.all([
      this.settings.getDecrypted('push_vapid_public_key'),
      this.settings.getDecrypted('push_vapid_private_key'),
      this.settings.getDecrypted('push_vapid_subject'),
    ]);
    if (!publicKey || !privateKey || !subject) {
      this.cached = null;
      throw new Error('VAPID not configured');
    }
    this.cached = { publicKey, privateKey, subject, expiresAt: Date.now() + this.cacheMs };
    return this.cached;
  }
}
