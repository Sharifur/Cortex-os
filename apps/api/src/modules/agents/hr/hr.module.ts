import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents.module';
import { TelegramModule } from '../../telegram/telegram.module';
import { SettingsModule } from '../../settings/settings.module';
import { HrmApiModule } from './hrm-api.module';
import { HrAgent } from './agent';

@Module({
  imports: [AgentsModule, TelegramModule, SettingsModule, HrmApiModule],
  providers: [HrAgent],
  exports: [HrAgent],
})
export class HrModule {}
