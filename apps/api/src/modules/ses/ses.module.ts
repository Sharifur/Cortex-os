import { Module } from '@nestjs/common';
import { SesService } from './ses.service';
import { SesWebhookController } from './ses-webhook.controller';
import { SesSupressionsController } from './ses-suppressions.controller';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  controllers: [SesWebhookController, SesSupressionsController],
  providers: [SesService],
  exports: [SesService],
})
export class SesModule {}
