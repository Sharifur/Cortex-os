import { Module, forwardRef } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { AgentRuntimeModule } from '../agents/runtime/agent-runtime.module';
import { SettingsModule } from '../settings/settings.module';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';
import { LlmModule } from '../llm/llm.module';
import { TelegramBotAgentModule } from '../agents/telegram-bot/telegram-bot.module';
import { HrmApiModule } from '../agents/hr/hrm-api.module';

@Module({
  imports: [
    SettingsModule,
    AgentRuntimeModule,
    KnowledgeBaseModule,
    LlmModule,
    HrmApiModule,
    forwardRef(() => TelegramBotAgentModule),
  ],
  controllers: [TelegramWebhookController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
