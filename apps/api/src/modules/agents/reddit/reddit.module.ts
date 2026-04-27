import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents.module';
import { LlmModule } from '../../llm/llm.module';
import { TelegramModule } from '../../telegram/telegram.module';
import { KnowledgeBaseModule } from '../../knowledge-base/knowledge-base.module';
import { SettingsModule } from '../../settings/settings.module';
import { RedditAgent } from './agent';
import { RedditService } from './reddit.service';

@Module({
  imports: [AgentsModule, LlmModule, TelegramModule, KnowledgeBaseModule, SettingsModule],
  providers: [RedditService, RedditAgent],
  exports: [RedditService, RedditAgent],
})
export class RedditModule {}
