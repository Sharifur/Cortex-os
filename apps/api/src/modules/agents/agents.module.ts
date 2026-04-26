import { Module } from '@nestjs/common';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { AgentRuntimeModule } from './runtime/agent-runtime.module';

@Module({
  imports: [AgentRuntimeModule],
  controllers: [AgentsController],
  providers: [AgentsService],
  exports: [AgentsService, AgentRuntimeModule],
})
export class AgentsModule {}
