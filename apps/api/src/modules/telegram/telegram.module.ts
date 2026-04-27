import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { AgentRuntimeModule } from '../agents/runtime/agent-runtime.module';
import { SettingsModule } from '../settings/settings.module';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';

@Module({
  imports: [SettingsModule, AgentRuntimeModule, KnowledgeBaseModule],
  controllers: [TelegramWebhookController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
