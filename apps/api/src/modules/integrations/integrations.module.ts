import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { SettingsModule } from '../settings/settings.module';
import { GmailModule } from '../gmail/gmail.module';

@Module({
  imports: [SettingsModule, GmailModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService],
})
export class IntegrationsModule {}
