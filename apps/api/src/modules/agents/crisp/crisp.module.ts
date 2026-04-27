import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents.module';
import { LlmModule } from '../../llm/llm.module';
import { TelegramModule } from '../../telegram/telegram.module';
import { SettingsModule } from '../../settings/settings.module';
import { CrispAgent } from './agent';
import { CrispService } from './crisp.service';

@Module({
  imports: [AgentsModule, LlmModule, TelegramModule, SettingsModule],
  providers: [CrispService, CrispAgent],
  exports: [CrispService, CrispAgent],
})
export class CrispModule {}
