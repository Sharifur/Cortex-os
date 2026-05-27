import { pgTable, text, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';
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

export const taskipTrialSequences = pgTable('taskip_trial_sequences', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  workspaceUuid: text('workspace_uuid').notNull().unique(),
  email: text('email').notNull(),
  industry: text('industry'),
  step: integer('step').notNull().default(0),
  status: text('status').notNull().default('active'),
  gmailAccountId: text('gmail_account_id'),
  sentAngles: jsonb('sent_angles').notNull().default([]),
  activatedAt: timestamp('activated_at').defaultNow().notNull(),
  nextStepAt: timestamp('next_step_at').defaultNow().notNull(),
  lastStepAt: timestamp('last_step_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
