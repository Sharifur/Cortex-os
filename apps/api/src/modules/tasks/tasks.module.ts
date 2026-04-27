import { Module, OnModuleInit } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DbModule } from '../../db/db.module';
import { AgentRuntimeModule } from '../agents/runtime/agent-runtime.module';
import { QUEUE_NAMES } from '../../common/queue/queue.constants';
import { TasksService } from './tasks.service';
import { TaskSweepProcessor } from './task-sweep.processor';
import { TasksController } from './tasks.controller';

@Module({
  imports: [
    DbModule,
    AgentRuntimeModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.TASK_SWEEP }),
  ],
  providers: [TasksService, TaskSweepProcessor],
  controllers: [TasksController],
  exports: [TasksService],
})
export class TasksModule implements OnModuleInit {
  constructor(
    @InjectQueue(QUEUE_NAMES.TASK_SWEEP) private taskSweepQueue: Queue,
  ) {}

  async onModuleInit() {
    await this.taskSweepQueue.add(
      'sweep',
      {},
      {
        repeat: { every: 60_000 },
        jobId: 'task-sweep-repeatable',
      },
    );
  }
}
