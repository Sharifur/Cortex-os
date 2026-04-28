import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { TasksService } from './tasks.service';
import { QUEUE_NAMES } from '../../common/queue/queue.constants';

@Processor(QUEUE_NAMES.TASK_SWEEP, { autorun: false })
export class TaskSweepProcessor extends WorkerHost {
  private readonly logger = new Logger(TaskSweepProcessor.name);

  startWorker(): void {
    this.worker.run().catch((err) => this.logger.error('Worker crashed', err));
  }

  constructor(private tasksService: TasksService) {
    super();
  }

  async process(_job: Job): Promise<void> {
    await this.tasksService.processDueTasks();
    this.logger.debug('Task sweep completed');
  }
}
