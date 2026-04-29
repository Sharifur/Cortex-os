import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents.module';
import { LlmModule } from '../../llm/llm.module';
import { TelegramModule } from '../../telegram/telegram.module';
import { SettingsModule } from '../../settings/settings.module';
import { KnowledgeBaseModule } from '../../knowledge-base/knowledge-base.module';
import { PurchaseVerifyModule } from '../purchase-verify/purchase-verify.module';
import { ContactsModule } from '../../contacts/contacts.module';
import { CrispAgent } from './agent';
import { CrispService } from './crisp.service';
import { CrispWebsitesController } from './crisp-websites.controller';
import { CrispConversationsController } from './crisp-conversations.controller';
import { CrispFollowUpSweeper } from './crisp-followup.sweeper';

@Module({
  imports: [AgentsModule, LlmModule, TelegramModule, SettingsModule, KnowledgeBaseModule, PurchaseVerifyModule, ContactsModule],
  controllers: [CrispWebsitesController, CrispConversationsController],
  providers: [CrispService, CrispAgent, CrispFollowUpSweeper],
  exports: [CrispService, CrispAgent],
})
export class CrispModule {}
