import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { SettingsModule } from '../settings/settings.module';
import { CrispModule } from '../agents/crisp/crisp.module';

@Module({
  imports: [SettingsModule, CrispModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService],
})
export class IntegrationsModule {}
