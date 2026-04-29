import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApprovalService } from '../agents/runtime/approval.service';
import { FollowupDto } from './dto/followup.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('approvals')
export class ApprovalsController {
  constructor(
    private approvals: ApprovalService,
    private jwt: JwtService,
    private events: EventEmitter2,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  getPending() {
    return this.approvals.getPending();
  }

  @Get('stream')
  async streamApprovals(
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

    const snapshot = await this.approvals.getPending();
    send({ type: 'snapshot', data: snapshot });

    const onCreate = (approval: unknown) => send({ type: 'created', data: approval });
    const onRemove = (payload: unknown) => send({ type: 'removed', data: payload });

    this.events.on('approval.created', onCreate);
    this.events.on('approval.removed', onRemove);

    reply.raw.on('close', () => {
      this.events.removeListener('approval.created', onCreate);
      this.events.removeListener('approval.removed', onRemove);
      clearInterval(heartbeat);
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/approve')
  @HttpCode(200)
  approve(@Param('id') id: string) {
    return this.approvals.approve(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/reject')
  @HttpCode(200)
  reject(@Param('id') id: string) {
    return this.approvals.reject(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/followup')
  @HttpCode(200)
  followup(@Param('id') id: string, @Body() dto: FollowupDto) {
    return this.approvals.followup(id, dto.instruction);
  }
}
