import { Module, forwardRef } from '@nestjs/common';
import { AgentsModule } from '../agents.module';
import { LlmModule } from '../../llm/llm.module';
import { TelegramChatStateModule } from '../../telegram/telegram-chat-state.module';
import { TelegramBotAgent } from './agent';

@Module({
  imports: [forwardRef(() => AgentsModule), LlmModule, TelegramChatStateModule],
  providers: [TelegramBotAgent],
  exports: [TelegramBotAgent],
})
export class TelegramBotAgentModule {}
