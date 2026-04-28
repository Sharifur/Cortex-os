import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TaskipInternalAgent } from './agent';
import { TaskipInternalDbService } from './taskip-internal-db.service';
import { TaskipInsightService } from './taskip-insight.service';
import { TaskipInternalEmailService } from './taskip-internal-email.service';
import { TaskipInternalEmailSweepProcessor, TASKIP_EMAIL_SWEEP_QUEUE } from './taskip-internal-email-sweep.processor';
import { AgentsModule } from '../agents.module';
import { LlmModule } from '../../llm/llm.module';
import { TelegramModule } from '../../telegram/telegram.module';
import { GmailModule } from '../../gmail/gmail.module';

@Module({
  imports: [
    AgentsModule,
    LlmModule,
    TelegramModule,
    GmailModule,
    BullModule.registerQueue({ name: TASKIP_EMAIL_SWEEP_QUEUE }),
  ],
  providers: [
    TaskipInternalAgent,
    TaskipInternalDbService,
    TaskipInsightService,
    TaskipInternalEmailService,
    TaskipInternalEmailSweepProcessor,
  ],
})
export class TaskipInternalModule {}
