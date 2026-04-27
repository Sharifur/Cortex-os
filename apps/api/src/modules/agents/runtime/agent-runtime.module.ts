import { Module, OnModuleInit } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AgentRegistryService } from './agent-registry.service';
import { AgentRuntimeService } from './agent-runtime.service';
import { AgentLogService } from './agent-log.service';
import { ApprovalService } from './approval.service';
import { FollowupService } from './followup.service';
import { AgentRunProcessor } from './processors/agent-run.processor';
import { AgentExecuteProcessor } from './processors/agent-execute.processor';
import { AgentFollowupProcessor } from './processors/agent-followup.processor';
import { ApprovalSweepProcessor } from './processors/approval-sweep.processor';
import { AgentRouteDispatcherService } from './agent-route-dispatcher.service';
import { QUEUE_NAMES } from '../../../common/queue/queue.constants';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [
    AuthModule,
    BullModule.registerQueue(
      { name: QUEUE_NAMES.AGENT_RUN },
      { name: QUEUE_NAMES.AGENT_EXECUTE },
      { name: QUEUE_NAMES.AGENT_FOLLOWUP },
      { name: QUEUE_NAMES.APPROVAL_SWEEP },
    ),
  ],
  providers: [
    AgentRegistryService,
    AgentRuntimeService,
    AgentLogService,
    ApprovalService,
    FollowupService,
    AgentRunProcessor,
    AgentExecuteProcessor,
    AgentFollowupProcessor,
    ApprovalSweepProcessor,
    AgentRouteDispatcherService,
  ],
  exports: [
    AgentRegistryService,
    AgentRuntimeService,
    ApprovalService,
    FollowupService,
    AgentLogService,
    BullModule,
  ],
})
export class AgentRuntimeModule implements OnModuleInit {
  constructor(
    @InjectQueue(QUEUE_NAMES.APPROVAL_SWEEP) private sweepQueue: Queue,
  ) {}

  async onModuleInit() {
    await this.sweepQueue.add(
      'sweep',
      {},
      {
        repeat: { every: 15 * 60 * 1000 },
        jobId: 'approval-sweep-repeatable',
      },
    );
  }
}
