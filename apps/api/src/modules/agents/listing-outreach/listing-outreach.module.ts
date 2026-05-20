import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents.module';
import { LlmModule } from '../../llm/llm.module';
import { TelegramModule } from '../../telegram/telegram.module';
import { KnowledgeBaseModule } from '../../knowledge-base/knowledge-base.module';
import { SettingsModule } from '../../settings/settings.module';
import { GmailModule } from '../../gmail/gmail.module';
import { PushModule } from '../../push/push.module';
import { BraveSearchModule } from '../../brave-search/brave-search.module';
import { ListingOutreachAgent } from './agent';
import { TaskipInternalEmailService } from '../taskip-internal/taskip-internal-email.service';

@Module({
  imports: [
    AgentsModule,
    LlmModule,
    TelegramModule,
    KnowledgeBaseModule,
    SettingsModule,
    GmailModule,
    PushModule,
    BraveSearchModule,
  ],
  providers: [TaskipInternalEmailService, ListingOutreachAgent],
})
export class ListingOutreachModule {}
