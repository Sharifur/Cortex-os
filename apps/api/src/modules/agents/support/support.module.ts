import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents.module';
import { LlmModule } from '../../llm/llm.module';
import { TelegramModule } from '../../telegram/telegram.module';
import { KnowledgeBaseModule } from '../../knowledge-base/knowledge-base.module';
import { PurchaseVerifyModule } from '../purchase-verify/purchase-verify.module';
import { SupportAgent } from './agent';

@Module({
  imports: [AgentsModule, LlmModule, TelegramModule, KnowledgeBaseModule, PurchaseVerifyModule],
  providers: [SupportAgent],
  exports: [SupportAgent],
})
export class SupportModule {}
