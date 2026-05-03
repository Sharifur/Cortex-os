import { pgTable, text, timestamp, jsonb, integer } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const tasks = pgTable('tasks', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  title: text('title').notNull(),
  instructions: text('instructions').notNull(),
  agentKey: text('agent_key').notNull(),
  status: text('status').notNull().default('pending'),
  output: jsonb('output'),
  runId: text('run_id'),
  recurrence: text('recurrence'),
  recurrenceTime: text('recurrence_time'),
  recurrenceDow: integer('recurrence_dow'),  // 0=Sun … 6=Sat; used for weekly
  recurrenceDom: integer('recurrence_dom'),  // 1–31; used for monthly
  nextRunAt: timestamp('next_run_at'),
  reminderSentAt: timestamp('reminder_sent_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
