import { Module } from '@nestjs/common';
import { TelegramChatStateService } from './telegram-chat-state.service';

@Module({
  providers: [TelegramChatStateService],
  exports: [TelegramChatStateService],
})
export class TelegramChatStateModule {}
