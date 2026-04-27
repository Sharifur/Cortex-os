import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const taskipInternalOps = pgTable('taskip_internal_ops', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  runId: text('run_id').notNull(),
  opType: text('op_type').notNull(), // extend_trial | mark_refund | lookup | query
  payload: jsonb('payload').notNull(),
  status: text('status').notNull().default('pending'), // pending | executed | failed
  executedAt: timestamp('executed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
