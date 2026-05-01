import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GmailService } from './gmail.service';
import { GmailOAuthService } from './gmail-oauth.service';

@Controller('gmail')
export class GmailController {
  constructor(
    private readonly gmail: GmailService,
    private readonly oauth: GmailOAuthService,
  ) {}

  // ─── Account CRUD (auth required) ────────────────────────────────────────

  @Get('accounts')
  @UseGuards(JwtAuthGuard)
  list() {
    return this.gmail.listAccounts();
  }

  @Post('accounts')
  @UseGuards(JwtAuthGuard)
  async create(@Body() body: { label?: string; email?: string; displayName?: string | null; appPassword?: string; isDefault?: boolean }) {
    if (!body?.label?.trim()) throw new BadRequestException('label is required');
    if (!body?.email?.trim()) throw new BadRequestException('email is required');
    if (!body?.appPassword?.trim()) throw new BadRequestException('appPassword is required');
    return this.gmail.createAccount({
      label: body.label,
      email: body.email,
      displayName: body.displayName ?? null,
      appPassword: body.appPassword,
      isDefault: body.isDefault === true,
    });
  }

  @Patch('accounts/:id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() body: { label?: string; displayName?: string | null; appPassword?: string }) {
    return this.gmail.updateAccount(id, body);
  }

  @Delete('accounts/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id') id: string) {
    await this.gmail.deleteAccount(id);
    return { ok: true };
  }

  @Post('accounts/:id/set-default')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async setDefault(@Param('id') id: string) {
    await this.gmail.setDefaultAccount(id);
    return { ok: true };
  }

  @Post('accounts/:id/test')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  test(@Param('id') id: string) {
    return this.gmail.testAccount(id);
  }

  // ─── OAuth2 connect flow ─────────────────────────────────────────────────

  /**
   * Begin the OAuth2 dance. Returns a Google consent URL the operator opens
   * in a new window. We compute redirectUri from the request origin so it
   * matches whatever URL the admin is currently logged in on (Coolify-friendly).
   */
  @Post('oauth/start')
  @UseGuards(JwtAuthGuard)
  async oauthStart(
    @Req() req: FastifyRequest,
    @Body() body: { label?: string; displayName?: string | null; clientId?: string; clientSecret?: string; setDefault?: boolean },
  ) {
    if (!body?.label?.trim()) throw new BadRequestException('label is required');
    if (!body?.clientId?.trim()) throw new BadRequestException('clientId is required');
    if (!body?.clientSecret?.trim()) throw new BadRequestException('clientSecret is required');

    const origin = (req.headers.origin as string) || `${req.protocol}://${req.headers.host}`;
    const redirectUri = `${origin.replace(/\/$/, '')}/gmail/oauth/callback`;

    const { authUrl } = await this.oauth.start({
      label: body.label,
      displayName: body.displayName ?? null,
      clientId: body.clientId,
      clientSecret: body.clientSecret,
      redirectUri,
      setDefault: body.setDefault === true,
    });
    return { authUrl, redirectUri };
  }

  /**
   * Google redirects here after consent. This is a public endpoint by design
   * — Google can't carry our JWT — but the `state` token issued in /start is
   * the security guard: it's a 192-bit random string that is single-use and
   * expires in 10 minutes, so an attacker can't forge a callback that lands
   * a fake account.
   */
  @Get('oauth/callback')
  async oauthCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: FastifyReply,
  ) {
    const sendHtml = (title: string, message: string, ok: boolean) => {
      res.type('text/html').send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; background: #0b1020; color: #e5e7eb; margin: 0; height: 100vh; display: flex; align-items: center; justify-content: center; }
  .card { background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 32px; max-width: 420px; text-align: center; }
  h1 { margin: 0 0 12px; font-size: 16px; color: ${ok ? '#10b981' : '#ef4444'}; }
  p { margin: 0; font-size: 13px; color: #9ca3af; }
</style>
</head><body>
<div class="card">
  <h1>${ok ? 'Connected' : 'Connection failed'}</h1>
  <p>${message}</p>
  <p style="margin-top: 12px; font-size: 11px;">You can close this window.</p>
</div>
<script>
  if (window.opener) {
    window.opener.postMessage({ type: 'gmail-oauth-${ok ? 'success' : 'error'}', message: ${JSON.stringify(message)} }, '*');
    setTimeout(() => window.close(), 1500);
  }
</script>
</body></html>`);
    };

    if (error) return sendHtml('Auth cancelled', `Google returned: ${error}`, false);
    if (!code || !state) return sendHtml('Bad callback', 'Missing code or state parameter', false);

    try {
      const { email } = await this.oauth.handleCallback(code, state);
      return sendHtml('Connected', `Successfully linked ${email}.`, true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return sendHtml('Connection failed', msg, false);
    }
  }
}
