import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const emailSuppressions = pgTable('email_suppressions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  email: text('email').notNull().unique(),
  reason: text('reason').notNull(), // 'hard_bounce' | 'complaint' | 'manual'
  source: text('source').notNull().default('ses'), // 'ses' | 'manual'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
