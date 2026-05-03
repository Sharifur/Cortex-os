import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Get('summary')
  summary(@Query('failuresSince') failuresSince?: string) {
    const since = failuresSince ? new Date(failuresSince) : undefined;
    return this.notifications.getSummary({ failuresSince: since });
  }
}
