import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents.module';
import { LlmModule } from '../../llm/llm.module';
import { TelegramModule } from '../../telegram/telegram.module';
import { HrAgent } from './agent';

@Module({
  imports: [AgentsModule, LlmModule, TelegramModule],
  providers: [HrAgent],
  exports: [HrAgent],
})
export class HrModule {}
