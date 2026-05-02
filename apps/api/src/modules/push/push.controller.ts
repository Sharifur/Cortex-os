import { Body, Controller, Delete, Get, Headers, Param, Post, Req, UseGuards, BadRequestException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PushService } from './push.service';

interface SubscribeBody {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  label?: string;
}

@Controller('push')
export class PushController {
  constructor(private push: PushService) {}

  /** Public — visitor and operator alike can fetch the public key for subscription. */
  @Get('vapid-public-key')
  async vapidKey() {
    const publicKey = await this.push.getPublicKey();
    return { publicKey, configured: !!publicKey };
  }

  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  async subscribe(
    @Body() body: SubscribeBody,
    @Req() req: FastifyRequest & { user?: { sub?: string } },
    @Headers('user-agent') ua?: string,
  ) {
    if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
      throw new BadRequestException('endpoint and keys are required');
    }
    const userId = req.user?.sub;
    if (!userId) throw new BadRequestException('no user');
    await this.push.subscribe({
      userId,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      ua: ua ?? null,
      label: body.label ?? null,
    });
    return { ok: true };
  }

  @Delete('subscribe')
  @UseGuards(JwtAuthGuard)
  async unsubscribe(@Body() body: { endpoint: string }) {
    if (!body?.endpoint) throw new BadRequestException('endpoint is required');
    await this.push.unsubscribe(body.endpoint);
    return { ok: true };
  }

  @Get('subscriptions')
  @UseGuards(JwtAuthGuard)
  async list(@Req() req: FastifyRequest & { user?: { sub?: string } }) {
    const userId = req.user?.sub;
    if (!userId) return [];
    return this.push.listForUser(userId);
  }

  /** Manual smoke test — fires a push to the calling operator's devices. */
  @Post('test')
  @UseGuards(JwtAuthGuard)
  async test(@Req() req: FastifyRequest & { user?: { sub?: string } }) {
    const userId = req.user?.sub;
    if (!userId) throw new BadRequestException('no user');
    const configured = await this.push.isConfigured();
    if (!configured) throw new BadRequestException('VAPID keys not configured — go to Live Chat and click "Set up push"');
    const result = await this.push.sendToAll({
      title: 'Cortex OS push test',
      body: 'Notifications are working — open the app to start.',
      tag: 'cortex-test',
      url: '/livechat',
    });
    if (result.sent === 0) throw new BadRequestException('No active subscriptions found — try disabling and re-enabling notifications');
    return result;
  }

  /**
   * One-click setup: generate a VAPID keypair and save to Settings.
   * Idempotent — refuses to overwrite existing keys (would invalidate
   * every operator device's existing subscription).
   */
  @Post('generate-vapid-keys')
  @UseGuards(JwtAuthGuard)
  async generate(@Req() req: FastifyRequest & { user?: { sub?: string; email?: string } }) {
    const subjectFallback = req.user?.email ? `mailto:${req.user.email}` : undefined;
    return this.push.generateAndSaveKeys(subjectFallback);
  }
}
