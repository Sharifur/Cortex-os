import { Body, Controller, Headers, HttpCode, Logger, Post, Query, UnauthorizedException } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { safeEqualString } from '../../common/webhooks/verify';
import { SesService } from './ses.service';

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

  constructor(
    private settings: SettingsService,
    private ses: SesService,
  ) {}

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

    this.logger.debug(`SES webhook received — messageType: ${messageType}`);

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

    this.logger.debug(`SES notification — type: ${notification.notificationType}`);

    if (notification.notificationType === 'Bounce') {
      const bounce = notification.bounce!;
      if (bounce.bounceType === 'Permanent') {
        this.logger.log(`SES hard bounce — suppressing: ${bounce.bouncedRecipients.map(r => r.emailAddress).join(', ')}`);
        for (const r of bounce.bouncedRecipients) {
          await this.ses.suppress(r.emailAddress, 'hard_bounce', 'ses');
        }
      } else {
        this.logger.debug(`SES soft bounce (${bounce.bounceType}) — not suppressing: ${bounce.bouncedRecipients.map(r => r.emailAddress).join(', ')}`);
      }
    }

    if (notification.notificationType === 'Complaint') {
      this.logger.log(`SES complaint — suppressing: ${notification.complaint!.complainedRecipients.map(r => r.emailAddress).join(', ')}`);
      for (const r of notification.complaint!.complainedRecipients) {
        await this.ses.suppress(r.emailAddress, 'complaint', 'ses');
      }
    }
  }
}
