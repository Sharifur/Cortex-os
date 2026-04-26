import { Controller, Get, Res } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private svc: MetricsService) {}

  @Get()
  async metrics(@Res() res: FastifyReply) {
    const data = await this.svc.getMetrics();
    res.header('Content-Type', this.svc.contentType());
    res.send(data);
  }
}
