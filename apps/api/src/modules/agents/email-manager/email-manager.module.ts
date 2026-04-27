import { Module } from '@nestjs/common';
import { EmailManagerAgent } from './agent';
import { AgentsModule } from '../agents.module';
import { LlmModule } from '../../llm/llm.module';
import { TelegramModule } from '../../telegram/telegram.module';
import { GmailModule } from '../../gmail/gmail.module';
import { KnowledgeBaseModule } from '../../knowledge-base/knowledge-base.module';

@Module({
  imports: [AgentsModule, LlmModule, TelegramModule, GmailModule, KnowledgeBaseModule],
  providers: [EmailManagerAgent],
})
export class EmailManagerModule {}
