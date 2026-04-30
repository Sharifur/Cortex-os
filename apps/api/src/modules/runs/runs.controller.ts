import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { RunsService } from './runs.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('runs')
@UseGuards(JwtAuthGuard)
export class RunsController {
  constructor(private runs: RunsService) {}

  @Get()
  findAll() {
    return this.runs.findAll();
  }

  @Get('activity')
  getActivity(@Query('limit') limit?: string, @Query('before') before?: string) {
    const beforeDate = before ? new Date(before) : undefined;
    return this.runs.getRecentLogs({
      limit: limit ? parseInt(limit, 10) : 100,
      before: beforeDate && !isNaN(beforeDate.getTime()) ? beforeDate : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.runs.findById(id);
  }

  @Get(':id/logs')
  async getLogs(@Param('id') id: string) {
    const [logs, finished] = await Promise.all([
      this.runs.getLogs(id),
      this.runs.isRunFinished(id),
    ]);
    return { logs, finished };
  }
}
