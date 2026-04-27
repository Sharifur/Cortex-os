import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents.module';
import { LlmModule } from '../../llm/llm.module';
import { TelegramModule } from '../../telegram/telegram.module';
import { CanvaAgent } from './agent';

@Module({
  imports: [AgentsModule, LlmModule, TelegramModule],
  providers: [CanvaAgent],
  exports: [CanvaAgent],
})
export class CanvaModule {}
