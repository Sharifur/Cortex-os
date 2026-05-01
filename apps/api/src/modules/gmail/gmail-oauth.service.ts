import { Inject, Injectable, Logger } from '@nestjs/common';
import IORedis from 'ioredis';
import { google } from 'googleapis';
import { randomBytes } from 'crypto';
import { encrypt } from '../../common/crypto/crypto.util';
import { DbService } from '../../db/db.service';
import { gmailAccounts } from './schema';
import { eq } from 'drizzle-orm';

/**
 * One-shot OAuth2 flow for adding a Gmail / Workspace account.
 *
 * Why this exists: pasting refresh tokens by hand is painful when Google's
 * test-mode refresh tokens expire weekly. With this flow the operator clicks
 * Connect → Google consent screen → we receive the code on the callback,
 * exchange it for a refresh token, and store the account row.
 *
 * Pending OAuth attempts (clientId/secret/label/redirect) are kept in Redis
 * keyed by an opaque `state` token with a 10 minute TTL — enough time for the
 * user to read the consent screen, not so long that abandoned attempts pile up.
 */

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email',
];

interface PendingOAuth {
  label: string;
  displayName: string | null;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  setDefault: boolean;
}

@Injectable()
export class GmailOAuthService {
  private readonly logger = new Logger(GmailOAuthService.name);

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: IORedis,
    private readonly db: DbService,
  ) {}

  /**
   * Begin the OAuth dance. Returns a Google consent URL the frontend opens
   * in a new window; when the user approves, Google redirects to
   * `redirectUri` (which must be the /gmail/oauth/callback route on this app
   * AND registered as an authorized redirect URI in the Google Cloud project).
   */
  async start(input: {
    label: string;
    displayName?: string | null;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    setDefault: boolean;
  }): Promise<{ authUrl: string }> {
    const state = randomBytes(24).toString('hex');
    const payload: PendingOAuth = {
      label: input.label.trim(),
      displayName: input.displayName?.trim() || null,
      clientId: input.clientId.trim(),
      clientSecret: input.clientSecret.trim(),
      redirectUri: input.redirectUri,
      setDefault: input.setDefault,
    };
    await this.redis.set(`gmail:oauth:pending:${state}`, JSON.stringify(payload), 'EX', 600);

    const oauth2 = new google.auth.OAuth2(payload.clientId, payload.clientSecret, payload.redirectUri);
    const authUrl = oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent', // force a refresh token even if the user has consented before
      scope: SCOPES,
      state,
    });
    return { authUrl };
  }

  /**
   * Handle the redirect from Google. Exchanges the auth code for a refresh
   * token, looks up the connected email via the userinfo endpoint, then
   * upserts a `gmail_accounts` row with auth_type='oauth2'.
   */
  async handleCallback(code: string, state: string): Promise<{ email: string; accountId: string }> {
    const raw = await this.redis.get(`gmail:oauth:pending:${state}`);
    if (!raw) throw new Error('OAuth state expired or unknown — please try connecting again');
    await this.redis.del(`gmail:oauth:pending:${state}`);
    const pending: PendingOAuth = JSON.parse(raw);

    const oauth2 = new google.auth.OAuth2(pending.clientId, pending.clientSecret, pending.redirectUri);
    const { tokens } = await oauth2.getToken(code);
    if (!tokens.refresh_token) {
      throw new Error('Google did not return a refresh token. Revoke the previous grant at myaccount.google.com → Security → Third-party apps and try again.');
    }
    oauth2.setCredentials(tokens);

    const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2 });
    const me = await oauth2Api.userinfo.get();
    const email = me.data.email;
    if (!email) throw new Error('Could not read account email from Google');

    if (pending.setDefault) {
      await this.db.db.update(gmailAccounts).set({ isDefault: false });
    }

    // Upsert by email so re-connecting the same address refreshes the tokens
    // instead of failing on the unique constraint.
    const [existing] = await this.db.db
      .select()
      .from(gmailAccounts)
      .where(eq(gmailAccounts.email, email.toLowerCase()))
      .limit(1);

    if (existing) {
      await this.db.db
        .update(gmailAccounts)
        .set({
          label: pending.label,
          displayName: pending.displayName,
          authType: 'oauth2',
          appPasswordEncrypted: null,
          oauthClientId: pending.clientId,
          oauthClientSecretEncrypted: encrypt(pending.clientSecret),
          oauthRefreshTokenEncrypted: encrypt(tokens.refresh_token),
          isDefault: pending.setDefault || existing.isDefault,
          updatedAt: new Date(),
        })
        .where(eq(gmailAccounts.id, existing.id));
      return { email, accountId: existing.id };
    }

    // First account auto-defaults
    const anyExisting = await this.db.db.select({ id: gmailAccounts.id }).from(gmailAccounts).limit(1);
    const isDefault = pending.setDefault || anyExisting.length === 0;

    const [row] = await this.db.db
      .insert(gmailAccounts)
      .values({
        label: pending.label,
        email: email.toLowerCase(),
        displayName: pending.displayName,
        authType: 'oauth2',
        oauthClientId: pending.clientId,
        oauthClientSecretEncrypted: encrypt(pending.clientSecret),
        oauthRefreshTokenEncrypted: encrypt(tokens.refresh_token),
        isDefault,
      })
      .returning();
    this.logger.log(`Connected Gmail (OAuth2): ${email}`);
    return { email, accountId: row.id };
  }
}
