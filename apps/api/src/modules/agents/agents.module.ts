import { Module } from '@nestjs/common';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { AgentRuntimeModule } from './runtime/agent-runtime.module';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [AgentRuntimeModule, KnowledgeBaseModule, LlmModule],
  controllers: [AgentsController],
  providers: [AgentsService],
  exports: [AgentsService, AgentRuntimeModule],
})
export class AgentsModule {}
