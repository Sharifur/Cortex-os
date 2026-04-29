import { Module, forwardRef } from '@nestjs/common';
import { AgentsModule } from '../agents.module';
import { LlmModule } from '../../llm/llm.module';
import { TelegramBotAgent } from './agent';

@Module({
  imports: [forwardRef(() => AgentsModule), LlmModule],
  providers: [TelegramBotAgent],
  exports: [TelegramBotAgent],
})
export class TelegramBotAgentModule {}
