import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents.module';
import { LlmModule } from '../../llm/llm.module';
import { TelegramModule } from '../../telegram/telegram.module';
import { LinkedInAgent } from './agent';
import { LinkedInService } from './linkedin.service';

@Module({
  imports: [AgentsModule, LlmModule, TelegramModule],
  providers: [LinkedInService, LinkedInAgent],
  exports: [LinkedInService, LinkedInAgent],
})
export class LinkedInModule {}
