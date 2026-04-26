import { Module } from '@nestjs/common';
import { TaskipTrialAgent } from './agent';
import { TaskipDbService } from './taskip-db.service';
import { AgentsModule } from '../agents.module';
import { LlmModule } from '../../llm/llm.module';
import { SesModule } from '../../ses/ses.module';

@Module({
  imports: [AgentsModule, LlmModule, SesModule],
  providers: [TaskipTrialAgent, TaskipDbService],
})
export class TaskipTrialModule {}
