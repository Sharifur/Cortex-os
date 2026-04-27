import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents.module';
import { LlmModule } from '../../llm/llm.module';
import { TelegramModule } from '../../telegram/telegram.module';
import { SocialAgent } from './agent';

@Module({
  imports: [AgentsModule, LlmModule, TelegramModule],
  providers: [SocialAgent],
  exports: [SocialAgent],
})
export class SocialModule {}
