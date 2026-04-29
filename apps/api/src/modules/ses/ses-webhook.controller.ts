import { Body, Controller, Headers, HttpCode, Logger, Post, Query, UnauthorizedException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { taskipTrialSuppressed } from '../../db/schema';
import { SettingsService } from '../settings/settings.service';
import { safeEqualString } from '../../common/webhooks/verify';

interface SnsEnvelope {
  Type: string;
  SubscribeURL?: string;
  Message: string;
}

interface SesBouncedRecipient {
  emailAddress: string;
}

interface SesBounce {
  bounceType: string;
  bouncedRecipients: SesBouncedRecipient[];
}

interface SesComplainedRecipient {
  emailAddress: string;
}

interface SesComplaint {
  complainedRecipients: SesComplainedRecipient[];
}

interface SesNotification {
  notificationType: 'Bounce' | 'Complaint';
  bounce?: SesBounce;
  complaint?: SesComplaint;
}

@Controller('ses')
export class SesWebhookController {
  private readonly logger = new Logger(SesWebhookController.name);

  constructor(private db: DbService, private settings: SettingsService) {}

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Body() body: SnsEnvelope,
    @Headers('x-amz-sns-message-type') messageType: string,
    @Query('t') tokenInUrl?: string,
  ) {
    const expected = await this.settings.getDecrypted('ses_webhook_token');
    if (!expected) {
      throw new UnauthorizedException('SES webhook token not configured (Settings → Integrations → Email (SES))');
    }
    if (!tokenInUrl || !safeEqualString(tokenInUrl, expected)) {
      throw new UnauthorizedException('Invalid webhook token');
    }

    if (messageType === 'SubscriptionConfirmation' && body.SubscribeURL) {
      try {
        const u = new URL(body.SubscribeURL);
        if (!/^sns\.[a-z0-9-]+\.amazonaws\.com$/.test(u.hostname) || u.protocol !== 'https:') {
          this.logger.warn(`Refusing SubscribeURL with non-AWS host: ${u.hostname}`);
          return;
        }
      } catch {
        this.logger.warn('SubscribeURL was not a valid URL');
        return;
      }
      await fetch(body.SubscribeURL);
      this.logger.log('SNS subscription confirmed');
      return;
    }

    if (messageType !== 'Notification') return;

    let notification: SesNotification;
    try {
      notification = JSON.parse(body.Message) as SesNotification;
    } catch {
      this.logger.warn('Failed to parse SNS message body');
      return;
    }

    if (notification.notificationType === 'Bounce') {
      const bounce = notification.bounce!;
      if (bounce.bounceType === 'Permanent') {
        for (const r of bounce.bouncedRecipients) {
          await this.suppress(r.emailAddress, 'hard_bounce');
        }
      }
    }

    if (notification.notificationType === 'Complaint') {
      for (const r of notification.complaint!.complainedRecipients) {
        await this.suppress(r.emailAddress, 'complaint');
      }
    }
  }

  private async suppress(email: string, reason: string) {
    const existing = await this.db.db
      .select({ id: taskipTrialSuppressed.id })
      .from(taskipTrialSuppressed)
      .where(eq(taskipTrialSuppressed.email, email));

    if (existing.length) return;

    await this.db.db.insert(taskipTrialSuppressed).values({ email, reason });
    this.logger.log(`Suppressed ${email} (${reason})`);
  }
}
