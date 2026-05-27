import { Module } from '@nestjs/common';
import { TaskipTrialAgent } from './agent';
import { TaskipDbService } from './taskip-db.service';
import { AgentsModule } from '../agents.module';
import { LlmModule } from '../../llm/llm.module';
import { SesModule } from '../../ses/ses.module';
import { GmailModule } from '../../gmail/gmail.module';
import { SettingsModule } from '../../settings/settings.module';
import { TaskipInsightService } from '../taskip-internal/taskip-insight.service';

@Module({
  imports: [AgentsModule, LlmModule, SesModule, GmailModule, SettingsModule],
  providers: [TaskipTrialAgent, TaskipDbService, TaskipInsightService],
})
export class TaskipTrialModule {}
