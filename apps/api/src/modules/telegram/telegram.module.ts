import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { AgentRuntimeModule } from '../agents/runtime/agent-runtime.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule, AgentRuntimeModule],
  controllers: [TelegramWebhookController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
