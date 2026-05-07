import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { OAuthIntegrationsController } from './oauth-integrations.controller';
import { OAuthIntegrationsService } from './oauth-integrations.service';
import { SettingsModule } from '../settings/settings.module';
import { GmailModule } from '../gmail/gmail.module';

@Module({
  imports: [SettingsModule, GmailModule],
  controllers: [IntegrationsController, OAuthIntegrationsController],
  providers: [IntegrationsService, OAuthIntegrationsService],
  exports: [OAuthIntegrationsService],
})
export class IntegrationsModule {}
