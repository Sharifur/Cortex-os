import { Module } from '@nestjs/common';
import { TaskipTrialAgent } from './agent';
import { TaskipDbService } from './taskip-db.service';
import { AgentsModule } from '../agents.module';
import { LlmModule } from '../../llm/llm.module';
import { SesModule } from '../../ses/ses.module';
import { GmailModule } from '../../gmail/gmail.module';

@Module({
  imports: [AgentsModule, LlmModule, SesModule, GmailModule],
  providers: [TaskipTrialAgent, TaskipDbService],
})
export class TaskipTrialModule {}
