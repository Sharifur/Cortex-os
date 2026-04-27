import { Module } from '@nestjs/common';
import { EmailManagerAgent } from './agent';
import { AgentsModule } from '../agents.module';
import { LlmModule } from '../../llm/llm.module';
import { TelegramModule } from '../../telegram/telegram.module';
import { GmailModule } from '../../gmail/gmail.module';

@Module({
  imports: [AgentsModule, LlmModule, TelegramModule, GmailModule],
  providers: [EmailManagerAgent],
})
export class EmailManagerModule {}
