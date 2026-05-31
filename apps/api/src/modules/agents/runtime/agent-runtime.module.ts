import { Module, OnModuleInit } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AgentRegistryService } from './agent-registry.service';
import { AgentRuntimeService } from './agent-runtime.service';
import { AgentLogService } from './agent-log.service';
import { ApprovalService } from './approval.service';
import { FollowupService } from './followup.service';
import { CorrectionCaptureService } from './correction-capture.service';
import { AgentRunProcessor } from './processors/agent-run.processor';
import { AgentExecuteProcessor } from './processors/agent-execute.processor';
import { AgentFollowupProcessor } from './processors/agent-followup.processor';
import { ApprovalSweepProcessor } from './processors/approval-sweep.processor';
import { CorrectionAnalysisProcessor } from './processors/correction-analysis.processor';
import { AgentRouteDispatcherService } from './agent-route-dispatcher.service';
import { QUEUE_NAMES } from '../../../common/queue/queue.constants';
import { AuthModule } from '../../auth/auth.module';
import { DebugLogsModule } from '../../debug-logs/debug-logs.module';
import { LlmModule } from '../../llm/llm.module';

const WEEKLY_MS = 7 * 24 * 60 * 60 * 1000;

@Module({
  imports: [
    AuthModule,
    DebugLogsModule,
    LlmModule,
    BullModule.registerQueue(
      { name: QUEUE_NAMES.AGENT_RUN },
      { name: QUEUE_NAMES.AGENT_EXECUTE },
      { name: QUEUE_NAMES.AGENT_FOLLOWUP },
      { name: QUEUE_NAMES.APPROVAL_SWEEP },
      { name: QUEUE_NAMES.CORRECTION_ANALYSIS },
    ),
  ],
  providers: [
    AgentRegistryService,
    AgentRuntimeService,
    AgentLogService,
    ApprovalService,
    FollowupService,
    CorrectionCaptureService,
    AgentRunProcessor,
    AgentExecuteProcessor,
    AgentFollowupProcessor,
    ApprovalSweepProcessor,
    CorrectionAnalysisProcessor,
    AgentRouteDispatcherService,
  ],
  exports: [
    AgentRegistryService,
    AgentRuntimeService,
    ApprovalService,
    FollowupService,
    AgentLogService,
    CorrectionCaptureService,
    BullModule,
  ],
})
export class AgentRuntimeModule implements OnModuleInit {
  constructor(
    @InjectQueue(QUEUE_NAMES.APPROVAL_SWEEP) private sweepQueue: Queue,
    @InjectQueue(QUEUE_NAMES.CORRECTION_ANALYSIS) private analysisQueue: Queue,
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

    await this.analysisQueue.add(
      'analyze',
      {},
      {
        repeat: { every: WEEKLY_MS },
        jobId: 'correction-analysis-repeatable',
      },
    );
  }
}
