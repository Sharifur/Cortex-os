import { Body, Controller, Delete, Get, Param, Query, UseGuards } from '@nestjs/common';
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

  @Delete()
  async clear(
    @Query('scope') scope?: 'all' | 'errors' | 'olderThanDays',
    @Query('days') days?: string,
    @Body() body?: { ids?: string[] },
  ) {
    if (body?.ids?.length) {
      const deleted = await this.logs.deleteByIds(body.ids);
      return { deleted };
    }
    if (scope === 'olderThanDays') {
      const d = days ? parseInt(days, 10) : 30;
      const deleted = await this.logs.pruneOlderThanDays(Number.isFinite(d) && d > 0 ? d : 30);
      return { deleted };
    }
    if (scope === 'errors') {
      const deleted = await this.logs.deleteByMinStatus(500);
      return { deleted };
    }
    const deleted = await this.logs.deleteAll();
    return { deleted };
  }

  @Delete(':id')
  async deleteOne(@Param('id') id: string) {
    const deleted = await this.logs.deleteByIds([id]);
    return { deleted };
  }
}
