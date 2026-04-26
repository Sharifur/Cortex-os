import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const taskipTrialEmailLog = pgTable('taskip_trial_email_log', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  runId: text('run_id').notNull(),
  userId: text('user_id').notNull(),
  email: text('email').notNull(),
  segment: text('segment').notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  sesMessageId: text('ses_message_id'),
  sentAt: timestamp('sent_at').defaultNow().notNull(),
});

export const taskipTrialSuppressed = pgTable('taskip_trial_suppressed', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  email: text('email').notNull().unique(),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
