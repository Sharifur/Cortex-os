import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TasksService } from './tasks.service';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private tasksService: TasksService) {}

  @Get()
  list() {
    return this.tasksService.list();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: {
    title: string;
    instructions: string;
    agentKey: string;
    recurrence?: string;
    recurrenceTime?: string;
    runNow?: boolean;
    scheduledAt?: string;
  }) {
    return this.tasksService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: {
      title?: string;
      instructions?: string;
      agentKey?: string;
      recurrence?: string | null;
      recurrenceTime?: string | null;
      nextRunAt?: Date | null;
    },
  ) {
    return this.tasksService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.tasksService.delete(id);
  }

  @Post(':id/run')
  @HttpCode(HttpStatus.OK)
  run(@Param('id') id: string) {
    return this.tasksService.runTask(id);
  }
}
