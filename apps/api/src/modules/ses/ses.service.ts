import { Injectable, Logger } from '@nestjs/common';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { SettingsService } from '../settings/settings.service';

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

  constructor(private readonly settings: SettingsService) {}

  async sendEmail(params: SendEmailParams): Promise<string> {
    const [accessKeyId, secretAccessKey, region] = await Promise.all([
      this.settings.getDecrypted('aws_access_key_id'),
      this.settings.getDecrypted('aws_secret_access_key'),
      this.settings.getDecrypted('aws_region'),
    ]);

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('AWS credentials not configured — set them in Settings → Email (SES)');
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
