import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
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
  nextRunAt: timestamp('next_run_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
