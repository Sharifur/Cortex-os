import { Module } from '@nestjs/common';
import { TaskipInternalAgent } from './agent';
import { TaskipInternalDbService } from './taskip-internal-db.service';
import { TaskipInsightService } from './taskip-insight.service';
import { AgentsModule } from '../agents.module';
import { LlmModule } from '../../llm/llm.module';
import { TelegramModule } from '../../telegram/telegram.module';

@Module({
  imports: [AgentsModule, LlmModule, TelegramModule],
  providers: [TaskipInternalAgent, TaskipInternalDbService, TaskipInsightService],
})
export class TaskipInternalModule {}
