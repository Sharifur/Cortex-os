import { Module } from '@nestjs/common';
import { DailyReminderAgent } from './agent';
import { AgentsModule } from '../agents.module';
import { LlmModule } from '../../llm/llm.module';
import { TelegramModule } from '../../telegram/telegram.module';

@Module({
  imports: [AgentsModule, LlmModule, TelegramModule],
  providers: [DailyReminderAgent],
})
export class DailyReminderModule {}
