import { pgTable, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const gmailAccounts = pgTable('gmail_accounts', {
  id:                   text('id').primaryKey().$defaultFn(() => createId()),
  label:                text('label').notNull(),
  email:                text('email').notNull().unique(),
  // Optional display name used in the From header. If null, just `email` is used.
  displayName:          text('display_name'),
  // AES-GCM ciphertext of the 16-char Gmail App Password. Spaces stripped.
  appPasswordEncrypted: text('app_password_encrypted').notNull(),
  // Exactly one row should be true. Service unsets others when toggling.
  isDefault:            boolean('is_default').notNull().default(false),
  createdAt:            timestamp('created_at').notNull().defaultNow(),
  updatedAt:            timestamp('updated_at').notNull().defaultNow(),
});
