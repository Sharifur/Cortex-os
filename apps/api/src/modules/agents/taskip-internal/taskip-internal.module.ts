import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TaskipInternalAgent } from './agent';
import { TaskipInternalDbService } from './taskip-internal-db.service';
import { TaskipInsightService } from './taskip-insight.service';
import { TaskipInternalEmailService } from './taskip-internal-email.service';
import { TaskipInternalEmailSweepProcessor, TASKIP_EMAIL_SWEEP_QUEUE } from './taskip-internal-email-sweep.processor';
import { TaskipInternalSuggestionSweepService } from './taskip-internal-suggestion-sweep.service';
import { TaskipInternalSuggestionSweepProcessor, TASKIP_SUGGESTION_SWEEP_QUEUE } from './taskip-internal-suggestion-sweep.processor';
import { AgentsModule } from '../agents.module';
import { LlmModule } from '../../llm/llm.module';
import { TelegramModule } from '../../telegram/telegram.module';
import { GmailModule } from '../../gmail/gmail.module';
import { SettingsModule } from '../../settings/settings.module';
import { SafetyModule } from '../../safety/safety.module';
import { KnowledgeBaseModule } from '../../knowledge-base/knowledge-base.module';
import { SpamCheckerModule } from '../../spam-checker/spam-checker.module';

@Module({
  imports: [
    AgentsModule,
    LlmModule,
    TelegramModule,
    GmailModule,
    SettingsModule,
    SafetyModule,
    KnowledgeBaseModule,
    SpamCheckerModule,
    BullModule.registerQueue({ name: TASKIP_EMAIL_SWEEP_QUEUE }),
    BullModule.registerQueue({ name: TASKIP_SUGGESTION_SWEEP_QUEUE }),
  ],
  providers: [
    TaskipInternalAgent,
    TaskipInternalDbService,
    TaskipInsightService,
    TaskipInternalEmailService,
    TaskipInternalEmailSweepProcessor,
    TaskipInternalSuggestionSweepService,
    TaskipInternalSuggestionSweepProcessor,
  ],
})
export class TaskipInternalModule {}
