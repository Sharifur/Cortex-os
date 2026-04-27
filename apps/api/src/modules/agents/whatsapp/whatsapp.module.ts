import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents.module';
import { LlmModule } from '../../llm/llm.module';
import { TelegramModule } from '../../telegram/telegram.module';
import { WhatsAppAgent } from './agent';
import { WhatsAppService } from './whatsapp.service';

@Module({
  imports: [AgentsModule, LlmModule, TelegramModule],
  providers: [WhatsAppService, WhatsAppAgent],
  exports: [WhatsAppService, WhatsAppAgent],
})
export class WhatsAppModule {}
