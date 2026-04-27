import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents.module';
import { LlmModule } from '../../llm/llm.module';
import { TelegramModule } from '../../telegram/telegram.module';
import { RedditAgent } from './agent';
import { RedditService } from './reddit.service';

@Module({
  imports: [AgentsModule, LlmModule, TelegramModule],
  providers: [RedditService, RedditAgent],
  exports: [RedditService, RedditAgent],
})
export class RedditModule {}
