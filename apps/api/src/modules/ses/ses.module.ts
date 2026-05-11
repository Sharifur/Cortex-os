import { Module } from '@nestjs/common';
import { SesService } from './ses.service';
import { SesWebhookController } from './ses-webhook.controller';
import { SesSupressionsController } from './ses-suppressions.controller';
import { SettingsModule } from '../settings/settings.module';
import { EmailSpamCheckerService } from './email-spam-checker.service';

@Module({
  imports: [SettingsModule],
  controllers: [SesWebhookController, SesSupressionsController],
  providers: [SesService, EmailSpamCheckerService],
  exports: [SesService, EmailSpamCheckerService],
})
export class SesModule {}
