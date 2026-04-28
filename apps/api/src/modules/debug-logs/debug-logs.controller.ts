import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequestLogService } from './request-log.service';

@Controller('debug-logs')
@UseGuards(JwtAuthGuard)
export class DebugLogsController {
  constructor(private readonly logs: RequestLogService) {}

  @Get()
  list(
    @Query('limit') limit?: string,
    @Query('minStatus') minStatus?: string,
    @Query('q') q?: string,
    @Query('sinceHours') sinceHours?: string,
  ) {
    return this.logs.list({
      limit: limit ? parseInt(limit, 10) : undefined,
      minStatus: minStatus ? parseInt(minStatus, 10) : undefined,
      q: q || undefined,
      sinceHours: sinceHours ? parseInt(sinceHours, 10) : undefined,
    });
  }

  @Get('stats')
  stats() {
    return this.logs.stats();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.logs.getById(id);
  }
}
