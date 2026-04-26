import { Body, Controller, Headers, HttpCode, Logger, Post } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { taskipTrialSuppressed } from '../../db/schema';

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

  constructor(private db: DbService) {}

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Body() body: SnsEnvelope,
    @Headers('x-amz-sns-message-type') messageType: string,
  ) {
    if (messageType === 'SubscriptionConfirmation' && body.SubscribeURL) {
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
