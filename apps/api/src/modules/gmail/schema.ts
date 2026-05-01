import { pgTable, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const gmailAccounts = pgTable('gmail_accounts', {
  id:                       text('id').primaryKey().$defaultFn(() => createId()),
  label:                    text('label').notNull(),
  email:                    text('email').notNull().unique(),
  // Optional display name used in the From header. If null, just `email` is used.
  displayName:              text('display_name'),
  // Auth strategy:
  //   'imap'   — IMAP/SMTP with a Google App Password (personal Gmail, simple)
  //   'oauth2' — Gmail API with OAuth2 refresh token (Workspace, no App Password needed)
  authType:                 text('auth_type').notNull().default('imap'),
  // IMAP path
  appPasswordEncrypted:     text('app_password_encrypted'),
  // OAuth2 path
  oauthClientId:            text('oauth_client_id'),
  oauthClientSecretEncrypted: text('oauth_client_secret_encrypted'),
  oauthRefreshTokenEncrypted: text('oauth_refresh_token_encrypted'),
  // Exactly one row should be true. Service unsets others when toggling.
  isDefault:                boolean('is_default').notNull().default(false),
  createdAt:                timestamp('created_at').notNull().defaultNow(),
  updatedAt:                timestamp('updated_at').notNull().defaultNow(),
});
