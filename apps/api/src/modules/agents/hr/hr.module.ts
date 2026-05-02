import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents.module';
import { TelegramModule } from '../../telegram/telegram.module';
import { SettingsModule } from '../../settings/settings.module';
import { HrAgent } from './agent';
import { HrmApiService } from './hrm-api.service';

@Module({
  imports: [AgentsModule, TelegramModule, SettingsModule],
  providers: [HrAgent, HrmApiService],
  exports: [HrAgent, HrmApiService],
})
export class HrModule {}
