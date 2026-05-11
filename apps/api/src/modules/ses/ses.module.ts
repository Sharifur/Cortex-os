import { Module } from '@nestjs/common';
import { SesService } from './ses.service';
import { SesWebhookController } from './ses-webhook.controller';
import { SesSupressionsController } from './ses-suppressions.controller';
import { SettingsModule } from '../settings/settings.module';
import { SpamCheckerModule } from '../spam-checker/spam-checker.module';

@Module({
  imports: [SettingsModule, SpamCheckerModule],
  controllers: [SesWebhookController, SesSupressionsController],
  providers: [SesService],
  exports: [SesService],
})
export class SesModule {}
