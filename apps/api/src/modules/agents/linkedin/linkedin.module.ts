import { Module, OnModuleInit } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AgentsModule } from '../agents.module';
import { AgentRuntimeModule } from '../runtime/agent-runtime.module';
import { LlmModule } from '../../llm/llm.module';
import { TelegramModule } from '../../telegram/telegram.module';
import { KnowledgeBaseModule } from '../../knowledge-base/knowledge-base.module';
import { SettingsModule } from '../../settings/settings.module';
import { QUEUE_NAMES } from '../../../common/queue/queue.constants';
import { LinkedInAgent } from './agent';
import { LinkedInService } from './linkedin.service';
import { LinkedInCommentService } from './linkedin-comment.service';
import { LinkedInConnectionService } from './linkedin-connection.service';
import { LinkedInDmService } from './linkedin-dm.service';
import { LinkedInTemplateService } from './linkedin-template.service';
import { LinkedInCronProcessor } from './linkedin-cron.processor';

// Staggered daily schedule — each action runs independently, hours apart
// Odd minutes make the timing look organic rather than bot-like
const LINKEDIN_CRON_SCHEDULES = [
  { actionType: 'comments',    pattern: '23 9 * * *',  jobId: 'linkedin-cron-comments' },
  { actionType: 'connections', pattern: '41 11 * * *', jobId: 'linkedin-cron-connections' },
  { actionType: 'dms',         pattern: '17 14 * * *', jobId: 'linkedin-cron-dms' },
] as const;

@Module({
  imports: [
    AgentsModule,
    AgentRuntimeModule,
    LlmModule,
    TelegramModule,
    KnowledgeBaseModule,
    SettingsModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.LINKEDIN_CRON }),
  ],
  providers: [LinkedInService, LinkedInCommentService, LinkedInConnectionService, LinkedInDmService, LinkedInTemplateService, LinkedInAgent, LinkedInCronProcessor],
  exports: [LinkedInService, LinkedInCommentService, LinkedInConnectionService, LinkedInDmService, LinkedInTemplateService, LinkedInAgent],
})
export class LinkedInModule implements OnModuleInit {
  constructor(
    @InjectQueue(QUEUE_NAMES.LINKEDIN_CRON) private cronQueue: Queue,
  ) {}

  async onModuleInit() {
    // Remove stale repeatable jobs before re-registering so schedule changes take effect on restart
    const existing = await this.cronQueue.getRepeatableJobs();
    for (const job of existing) {
      await this.cronQueue.removeRepeatableByKey(job.key);
    }

    for (const { actionType, pattern, jobId } of LINKEDIN_CRON_SCHEDULES) {
      await this.cronQueue.add(
        'trigger',
        { actionType },
        { repeat: { pattern }, jobId },
      );
    }
  }
}
