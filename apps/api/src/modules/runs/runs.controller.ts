import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { FastifyReply } from 'fastify';
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
  getActivity(@Query('limit') limit?: string) {
    return this.runs.getRecentLogs(limit ? parseInt(limit, 10) : 100);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.runs.findById(id);
  }

  @Get(':id/logs')
  async streamLogs(@Param('id') id: string, @Res() reply: FastifyReply) {
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('Access-Control-Allow-Origin', '*');
    reply.raw.flushHeaders();

    let lastCreatedAt: Date | undefined;

    const send = (data: unknown) => {
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const poll = async () => {
      const logs = await this.runs.getLogs(id);
      const newLogs = lastCreatedAt
        ? logs.filter((l) => l.createdAt > lastCreatedAt!)
        : logs;

      for (const log of newLogs) {
        send(log);
        lastCreatedAt = log.createdAt;
      }

      const done = await this.runs.isRunFinished(id);
      if (done) {
        send({ type: 'done' });
        clearInterval(timer);
        reply.raw.end();
      }
    };

    await poll();
    const timer = setInterval(poll, 1000);

    reply.raw.on('close', () => clearInterval(timer));
  }
}
