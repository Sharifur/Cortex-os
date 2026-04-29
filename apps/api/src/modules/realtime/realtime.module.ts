import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RunsModule } from '../runs/runs.module';
import { AgentRuntimeModule } from '../agents/runtime/agent-runtime.module';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  imports: [
    JwtModule.register({}),
    RunsModule,
    AgentRuntimeModule,
  ],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
