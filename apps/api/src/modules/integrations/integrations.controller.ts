import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { IntegrationsService } from './integrations.service';

@Controller('integrations')
@UseGuards(JwtAuthGuard)
export class IntegrationsController {
  constructor(private readonly svc: IntegrationsService) {}

  @Post(':key/test')
  test(@Param('key') key: string) {
    return this.svc.test(key);
  }
}
