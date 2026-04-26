import { Injectable, Logger } from '@nestjs/common';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { SettingsService } from '../settings/settings.service';

export interface SendEmailParams {
  to: string;
  from: string;
  subject: string;
  textBody: string;
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

    const cmd = new SendEmailCommand({
      Destination: { ToAddresses: [params.to] },
      Message: {
        Subject: { Data: params.subject, Charset: 'UTF-8' },
        Body: { Text: { Data: params.textBody, Charset: 'UTF-8' } },
      },
      Source: params.from,
      ...(params.configurationSet ? { ConfigurationSetName: params.configurationSet } : {}),
    });

    const result = await client.send(cmd);
    this.logger.log(`SES sent to ${params.to} — messageId: ${result.MessageId}`);
    return result.MessageId ?? '';
  }
}
