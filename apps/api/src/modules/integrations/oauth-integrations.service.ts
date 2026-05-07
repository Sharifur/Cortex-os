import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '../../db/db.service';
import { SettingsService } from '../settings/settings.service';
import { encrypt, decrypt } from '../../common/crypto/crypto.util';
import { oauthIntegrations } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { OAUTH_PROVIDERS, OAuthProviderConfig } from './oauth-providers';

export interface OAuthTokenSet {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  scope?: string;
  expiresAt?: Date;
}

@Injectable()
export class OAuthIntegrationsService {
  private readonly logger = new Logger(OAuthIntegrationsService.name);

  constructor(
    private readonly db: DbService,
    private readonly settings: SettingsService,
  ) {}

  // ─── Provider registry ──────────────────────────────────────────────────────

  getProvider(provider: string): OAuthProviderConfig | null {
    return OAUTH_PROVIDERS[provider] ?? null;
  }

  listProviders(): OAuthProviderConfig[] {
    return Object.values(OAUTH_PROVIDERS);
  }

  // ─── Read ────────────────────────────────────────────────────────────────────

  async findAll() {
    return this.db.db.select().from(oauthIntegrations).orderBy(oauthIntegrations.provider);
  }

  async findByProvider(provider: string) {
    const [row] = await this.db.db
      .select()
      .from(oauthIntegrations)
      .where(eq(oauthIntegrations.provider, provider));
    return row ?? null;
  }

  // ─── Token management ────────────────────────────────────────────────────────

  async saveTokens(provider: string, tokens: OAuthTokenSet): Promise<void> {
    const config = this.getProvider(provider);
    const encrypted = {
      accessToken:  encrypt(tokens.accessToken),
      refreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
      tokenType:    tokens.tokenType ?? 'Bearer',
      scope:        tokens.scope ?? null,
      expiresAt:    tokens.expiresAt ?? null,
      status:       'connected',
      connectedAt:  new Date(),
      lastRefreshedAt: new Date(),
      errorMessage: null,
      displayName:  config?.displayName ?? provider,
    };

    const existing = await this.findByProvider(provider);
    if (existing) {
      await this.db.db
        .update(oauthIntegrations)
        .set({ ...encrypted, updatedAt: new Date() })
        .where(eq(oauthIntegrations.provider, provider));
    } else {
      await this.db.db
        .insert(oauthIntegrations)
        .values({ provider, ...encrypted });
    }

    this.logger.log(`OAuth tokens saved for provider: ${provider}`);
  }

  // Returns a valid access token, refreshing if needed
  async getValidToken(provider: string): Promise<string | null> {
    const row = await this.findByProvider(provider);
    if (!row || !row.accessToken) return null;

    // Check if token is expired (with 5-min buffer)
    const needsRefresh = row.expiresAt
      ? row.expiresAt.getTime() - Date.now() < 5 * 60 * 1000
      : false;

    if (needsRefresh && row.refreshToken) {
      const refreshed = await this.refreshToken(provider, row);
      return refreshed;
    }

    try {
      return decrypt(row.accessToken);
    } catch {
      return null;
    }
  }

  private async refreshToken(provider: string, row: typeof oauthIntegrations.$inferSelect): Promise<string | null> {
    const config = this.getProvider(provider);
    if (!config || !row.refreshToken) return null;

    try {
      const clientId     = await this.settings.getDecrypted(config.clientIdKey);
      const clientSecret = await this.settings.getDecrypted(config.clientSecretKey);
      if (!clientId || !clientSecret) return null;

      const refreshToken = decrypt(row.refreshToken);

      const res = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type:    'refresh_token',
          refresh_token: refreshToken,
          client_id:     clientId,
          client_secret: clientSecret,
        }),
      });

      if (!res.ok) {
        await this.markError(provider, `Token refresh failed: ${res.status}`);
        return null;
      }

      const data: any = await res.json();
      const expiresAt = data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined;

      await this.saveTokens(provider, {
        accessToken:  data.access_token,
        refreshToken: data.refresh_token ?? refreshToken,
        tokenType:    data.token_type,
        scope:        data.scope,
        expiresAt,
      });

      this.logger.log(`Token refreshed for provider: ${provider}`);
      return data.access_token as string;
    } catch (err) {
      await this.markError(provider, (err as Error).message);
      return null;
    }
  }

  async revoke(provider: string): Promise<void> {
    await this.db.db
      .update(oauthIntegrations)
      .set({
        accessToken:  null,
        refreshToken: null,
        status:       'disconnected',
        expiresAt:    null,
        connectedAt:  null,
        updatedAt:    new Date(),
      })
      .where(eq(oauthIntegrations.provider, provider));
    this.logger.log(`OAuth integration revoked for provider: ${provider}`);
  }

  private async markError(provider: string, message: string): Promise<void> {
    await this.db.db
      .update(oauthIntegrations)
      .set({ status: 'error', errorMessage: message, updatedAt: new Date() })
      .where(eq(oauthIntegrations.provider, provider));
  }

  // Ensure a row exists for every known provider (for UI listing)
  async seedProviders(): Promise<void> {
    for (const config of this.listProviders()) {
      const existing = await this.findByProvider(config.provider);
      if (!existing) {
        await this.db.db.insert(oauthIntegrations).values({
          provider:    config.provider,
          displayName: config.displayName,
          status:      'disconnected',
        });
      }
    }
  }
}
