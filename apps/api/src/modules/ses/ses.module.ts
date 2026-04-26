import { Module } from '@nestjs/common';
import { SesService } from './ses.service';
import { SesWebhookController } from './ses-webhook.controller';

@Module({
  controllers: [SesWebhookController],
  providers: [SesService],
  exports: [SesService],
})
export class SesModule {}
