import { Injectable, Logger } from '@nestjs/common';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

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
  private readonly client: SESClient;

  constructor() {
    this.client = new SESClient({
      region: process.env.AWS_REGION ?? 'ap-south-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }

  async sendEmail(params: SendEmailParams): Promise<string> {
    const cmd = new SendEmailCommand({
      Destination: { ToAddresses: [params.to] },
      Message: {
        Subject: { Data: params.subject, Charset: 'UTF-8' },
        Body: { Text: { Data: params.textBody, Charset: 'UTF-8' } },
      },
      Source: params.from,
      ...(params.configurationSet ? { ConfigurationSetName: params.configurationSet } : {}),
    });

    const result = await this.client.send(cmd);
    this.logger.log(`Email sent to ${params.to} — messageId: ${result.MessageId}`);
    return result.MessageId ?? '';
  }
}
