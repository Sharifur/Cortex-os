import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { LivechatService, CreateSiteDto, UpdateSiteDto } from './livechat.service';
import { LivechatMetricsService } from './livechat-metrics.service';

@Controller('agents/livechat/sites')
@UseGuards(JwtAuthGuard)
export class LivechatSitesController {
  constructor(
    private livechat: LivechatService,
    private metrics: LivechatMetricsService,
  ) {}

  @Get()
  list() {
    return this.livechat.listSites();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.livechat.getSiteById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateSiteDto) {
    return this.livechat.createSite(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSiteDto) {
    return this.livechat.updateSite(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.livechat.deleteSite(id);
  }

  @Get(':id/metrics')
  metricsForSite(@Param('id') id: string, @Query('days') days?: string) {
    const window = days ? Math.max(1, Math.min(90, Number(days))) : 7;
    return this.metrics.forSite(id, window);
  }
}
