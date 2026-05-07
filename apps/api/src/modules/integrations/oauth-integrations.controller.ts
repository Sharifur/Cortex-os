import { Controller, Get, Post, Param, Query, Res, Delete, UseGuards, Logger } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OAuthIntegrationsService } from './oauth-integrations.service';
import { SettingsService } from '../settings/settings.service';
import * as crypto from 'crypto';

// In-memory PKCE/state store (single-owner platform — one pending auth at a time per provider)
const pendingStates = new Map<string, { provider: string; codeVerifier?: string; createdAt: number }>();

@Controller('integrations/oauth')
export class OAuthIntegrationsController {
  private readonly logger = new Logger(OAuthIntegrationsController.name);

  constructor(
    private readonly oauth: OAuthIntegrationsService,
    private readonly settings: SettingsService,
  ) {}

  // ─── List all providers with their connection status ────────────────────────
  @Get('providers')
  @UseGuards(JwtAuthGuard)
  async listProviders() {
    const configs = this.oauth.listProviders();
    const rows    = await this.oauth.findAll();
    const rowMap  = new Map(rows.map((r) => [r.provider, r]));

    return configs.map((c) => {
      const row = rowMap.get(c.provider);
      return {
        provider:    c.provider,
        displayName: c.displayName,
        description: c.description,
        status:      row?.status ?? 'disconnected',
        connectedAt: row?.connectedAt ?? null,
        expiresAt:   row?.expiresAt ?? null,
        scope:       row?.scope ?? null,
        errorMessage: row?.errorMessage ?? null,
        mcpServerUrl: c.mcpServerUrl ?? null,
      };
    });
  }

  // ─── Start OAuth flow — return auth URL for frontend redirect ───────────────
  @Post('connect/:provider')
  @UseGuards(JwtAuthGuard)
  async connect(@Param('provider') provider: string) {
    const config = this.oauth.getProvider(provider);
    if (!config) return { error: `Unknown provider: ${provider}` };

    const clientId = await this.settings.getDecrypted(config.clientIdKey);
    if (!clientId) {
      return {
        error: `Client ID not configured. Add "${config.clientIdKey}" in Settings.`,
      };
    }

    const state       = crypto.randomBytes(16).toString('hex');
    const baseUrl     = await this.settings.getDecrypted('app_base_url')
                         ?? process.env.COOLIFY_URL
                         ?? 'http://localhost:3000';
    const redirectUri = `${baseUrl}/integrations/oauth/callback/${provider}`;

    pendingStates.set(state, { provider, createdAt: Date.now() });

    const params = new URLSearchParams({
      response_type: 'code',
      client_id:     clientId,
      redirect_uri:  redirectUri,
      scope:         config.scopes.join(' '),
      state,
    });

    const authUrl = `${config.authUrl}?${params.toString()}`;
    this.logger.log(`OAuth connect initiated for ${provider}`);
    return { authUrl };
  }

  // ─── OAuth callback — exchange code for token ───────────────────────────────
  @Get('callback/:provider')
  async callback(
    @Param('provider') provider: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const pending = pendingStates.get(state);
    const baseUrl = await this.settings.getDecrypted('app_base_url')
                      ?? process.env.COOLIFY_URL
                      ?? 'http://localhost:3000';

    if (error) {
      this.logger.warn(`OAuth error for ${provider}: ${error}`);
      return res.redirect(`${baseUrl.replace(/\/api$/, '')}/integrations?error=${encodeURIComponent(error)}&provider=${provider}`);
    }

    if (!pending || pending.provider !== provider) {
      return res.redirect(`${baseUrl.replace(/\/api$/, '')}/integrations?error=invalid_state&provider=${provider}`);
    }

    pendingStates.delete(state);

    // Prune stale states (> 10 min)
    const cutoff = Date.now() - 10 * 60 * 1000;
    for (const [k, v] of pendingStates) {
      if (v.createdAt < cutoff) pendingStates.delete(k);
    }

    const config = this.oauth.getProvider(provider);
    if (!config) return res.status(404).json({ error: 'Unknown provider' });

    const clientId     = await this.settings.getDecrypted(config.clientIdKey);
    const clientSecret = await this.settings.getDecrypted(config.clientSecretKey);
    const callbackBase = await this.settings.getDecrypted('app_base_url')
                          ?? process.env.COOLIFY_URL
                          ?? 'http://localhost:3000';
    const redirectUri  = `${callbackBase}/integrations/oauth/callback/${provider}`;

    try {
      const tokenRes = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept':        'application/json',
        },
        body: new URLSearchParams({
          grant_type:    'authorization_code',
          code,
          redirect_uri:  redirectUri,
          client_id:     clientId!,
          client_secret: clientSecret ?? '',
        }),
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        this.logger.error(`Token exchange failed for ${provider}: ${errText}`);
        return res.redirect(`${baseUrl.replace(/\/api$/, '')}/integrations?error=token_exchange_failed&provider=${provider}`);
      }

      const data: any = await tokenRes.json();
      const expiresAt = data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined;

      await this.oauth.saveTokens(provider, {
        accessToken:  data.access_token,
        refreshToken: data.refresh_token,
        tokenType:    data.token_type,
        scope:        data.scope,
        expiresAt,
      });

      this.logger.log(`OAuth connected for ${provider}`);
      res.redirect(`${baseUrl.replace(/\/api$/, '')}/integrations?connected=${provider}`);
    } catch (err) {
      this.logger.error(`OAuth callback error for ${provider}: ${(err as Error).message}`);
      res.redirect(`${baseUrl.replace(/\/api$/, '')}/integrations?error=server_error&provider=${provider}`);
    }
  }

  // ─── Disconnect / revoke ─────────────────────────────────────────────────────
  @Delete('disconnect/:provider')
  @UseGuards(JwtAuthGuard)
  async disconnect(@Param('provider') provider: string) {
    await this.oauth.revoke(provider);
    return { ok: true };
  }
}
