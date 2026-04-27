import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents.module';
import { LlmModule } from '../../llm/llm.module';
import { TelegramModule } from '../../telegram/telegram.module';
import { KnowledgeBaseModule } from '../../knowledge-base/knowledge-base.module';
import { SettingsModule } from '../../settings/settings.module';
import { LinkedInAgent } from './agent';
import { LinkedInService } from './linkedin.service';

@Module({
  imports: [AgentsModule, LlmModule, TelegramModule, KnowledgeBaseModule, SettingsModule],
  providers: [LinkedInService, LinkedInAgent],
  exports: [LinkedInService, LinkedInAgent],
})
export class LinkedInModule {}
