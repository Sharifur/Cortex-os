import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RunsService } from './runs.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('runs')
export class RunsController {
  constructor(
    private runs: RunsService,
    private jwt: JwtService,
    private events: EventEmitter2,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.runs.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get('activity')
  getActivity(@Query('limit') limit?: string) {
    return this.runs.getRecentLogs(limit ? parseInt(limit, 10) : 100);
  }

  @Get('activity/stream')
  async streamActivity(
    @Query('token') token: string,
    @Res() reply: FastifyReply,
  ) {
    try {
      this.jwt.verify(token, { secret: process.env.JWT_SECRET });
    } catch {
      reply.status(401).send({ message: 'Unauthorized' });
      return;
    }

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no');
    reply.raw.setHeader('Access-Control-Allow-Origin', '*');
    reply.raw.flushHeaders();

    const send = (data: unknown) => {
      if (!reply.raw.writableEnded) {
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
      }
    };

    const heartbeat = setInterval(() => {
      if (!reply.raw.writableEnded) {
        reply.raw.write(`: heartbeat ${Date.now()}\n\n`);
      }
    }, 20_000);

    const initial = await this.runs.getRecentLogs(100);
    for (const entry of initial) {
      send(entry);
    }
    send({ type: 'snapshot_done' });

    const handler = (entry: unknown) => send(entry);
    this.events.on('log.created', handler);

    reply.raw.on('close', () => {
      this.events.removeListener('log.created', handler);
      clearInterval(heartbeat);
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.runs.findById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/logs')
  async streamLogs(@Param('id') id: string, @Res() reply: FastifyReply) {
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no');
    reply.raw.setHeader('Access-Control-Allow-Origin', '*');
    reply.raw.flushHeaders();

    let lastCreatedAt: Date | undefined;

    const send = (data: unknown) => {
      if (!reply.raw.writableEnded) {
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
      }
    };

    const poll = async () => {
      try {
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
          clearInterval(heartbeat);
          reply.raw.end();
        }
      } catch {
        // silently skip failed poll — stream stays open until client disconnects
      }
    };

    await poll();
    const timer = setInterval(poll, 1000);
    const heartbeat = setInterval(() => {
      if (!reply.raw.writableEnded) {
        reply.raw.write(`: heartbeat ${Date.now()}\n\n`);
      }
    }, 20_000);

    reply.raw.on('close', () => {
      clearInterval(timer);
      clearInterval(heartbeat);
    });
  }
}
