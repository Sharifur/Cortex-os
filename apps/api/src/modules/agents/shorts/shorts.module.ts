import { Module } from '@nestjs/common';
import { ShortsAgent } from './agent';
import { AgentRuntimeModule } from '../runtime/agent-runtime.module';
import { LlmModule } from '../../llm/llm.module';
import { TelegramModule } from '../../telegram/telegram.module';
import { KnowledgeBaseModule } from '../../knowledge-base/knowledge-base.module';
import { DbModule } from '../../../db/db.module';

@Module({
  imports: [DbModule, AgentRuntimeModule, LlmModule, TelegramModule, KnowledgeBaseModule],
  providers: [ShortsAgent],
})
export class ShortsModule {}
