import { Module } from '@nestjs/common';
import { SesService } from './ses.service';
import { SesWebhookController } from './ses-webhook.controller';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  controllers: [SesWebhookController],
  providers: [SesService],
  exports: [SesService],
})
export class SesModule {}
