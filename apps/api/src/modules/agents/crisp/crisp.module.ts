import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents.module';
import { LlmModule } from '../../llm/llm.module';
import { TelegramModule } from '../../telegram/telegram.module';
import { SettingsModule } from '../../settings/settings.module';
import { KnowledgeBaseModule } from '../../knowledge-base/knowledge-base.module';
import { PurchaseVerifyModule } from '../purchase-verify/purchase-verify.module';
import { CrispAgent } from './agent';
import { CrispService } from './crisp.service';

@Module({
  imports: [AgentsModule, LlmModule, TelegramModule, SettingsModule, KnowledgeBaseModule, PurchaseVerifyModule],
  providers: [CrispService, CrispAgent],
  exports: [CrispService, CrispAgent],
})
export class CrispModule {}
