import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents.module';
import { LlmModule } from '../../llm/llm.module';
import { TelegramModule } from '../../telegram/telegram.module';
import { KnowledgeBaseModule } from '../../knowledge-base/knowledge-base.module';
import { SocialAgent } from './agent';

@Module({
  imports: [AgentsModule, LlmModule, TelegramModule, KnowledgeBaseModule],
  providers: [SocialAgent],
  exports: [SocialAgent],
})
export class SocialModule {}
