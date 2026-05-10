import { Injectable, Logger } from '@nestjs/common';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { eq } from 'drizzle-orm';
import { SettingsService } from '../settings/settings.service';
import { DbService } from '../../db/db.service';
import { emailSuppressions } from './ses-suppressions.schema';

export interface SendEmailParams {
  to: string;
  from: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  configurationSet?: string;
}

@Injectable()
export class SesService {
  private readonly logger = new Logger(SesService.name);

  constructor(
    private readonly settings: SettingsService,
    private readonly db: DbService,
  ) {}

  async isSuppressed(email: string): Promise<boolean> {
    try {
      const [row] = await this.db.db
        .select({ id: emailSuppressions.id })
        .from(emailSuppressions)
        .where(eq(emailSuppressions.email, email.toLowerCase().trim()));
      return !!row;
    } catch (err) {
      if ((err as Error).message?.includes('email_suppressions')) {
        this.logger.warn('email_suppressions table not found — migration pending; skipping suppression check');
        return false;
      }
      throw err;
    }
  }

  async suppress(email: string, reason: string, source = 'ses'): Promise<void> {
    const normalized = email.toLowerCase().trim();
    try {
      const [existing] = await this.db.db
        .select({ id: emailSuppressions.id })
        .from(emailSuppressions)
        .where(eq(emailSuppressions.email, normalized));
      if (existing) return;
      await this.db.db.insert(emailSuppressions).values({ email: normalized, reason, source });
      this.logger.log(`Suppressed ${normalized} (${reason})`);
    } catch (err) {
      if ((err as Error).message?.includes('email_suppressions')) {
        this.logger.warn('email_suppressions table not found — migration pending; suppression not recorded');
        return;
      }
      throw err;
    }
  }

  async sendEmail(params: SendEmailParams): Promise<string> {
    const [accessKeyId, secretAccessKey, region] = await Promise.all([
      this.settings.getDecrypted('aws_access_key_id'),
      this.settings.getDecrypted('aws_secret_access_key'),
      this.settings.getDecrypted('aws_region'),
    ]);

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('AWS credentials not configured — set them in Settings → Email (SES)');
    }

    const atIdx = params.to.indexOf('@');
    const domain = atIdx >= 0 ? params.to.slice(atIdx + 1) : '';
    if (!domain || !/^[a-zA-Z0-9.\-]+$/.test(domain)) {
      this.logger.warn(`SES send skipped: non-ASCII or invalid domain in "${params.to}"`);
      return '';
    }

    if (await this.isSuppressed(params.to)) {
      this.logger.warn(`Skipping suppressed address: ${params.to}`);
      return '';
    }

    const client = new SESClient({
      region: region ?? 'ap-south-1',
      credentials: { accessKeyId, secretAccessKey },
    });

    const Body: { Text: { Data: string; Charset: string }; Html?: { Data: string; Charset: string } } = {
      Text: { Data: params.textBody, Charset: 'UTF-8' },
    };
    if (params.htmlBody) {
      Body.Html = { Data: params.htmlBody, Charset: 'UTF-8' };
    }

    const cmd = new SendEmailCommand({
      Destination: {
        ToAddresses: [params.to],
        ...(params.cc?.length ? { CcAddresses: params.cc } : {}),
        ...(params.bcc?.length ? { BccAddresses: params.bcc } : {}),
      },
      Message: {
        Subject: { Data: params.subject, Charset: 'UTF-8' },
        Body,
      },
      Source: params.from,
      ...(params.replyTo ? { ReplyToAddresses: [params.replyTo] } : {}),
      ...(params.configurationSet ? { ConfigurationSetName: params.configurationSet } : {}),
    });

    const result = await client.send(cmd);
    this.logger.log(`SES sent to ${params.to} — messageId: ${result.MessageId}`);
    return result.MessageId ?? '';
  }
}
