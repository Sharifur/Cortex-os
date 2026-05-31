import { pgTable, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const correctionSignals = pgTable('correction_signals', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  agentKey:        text('agent_key').notNull(),
  runId:           text('run_id'),
  approvalId:      text('approval_id'),
  signalType:      text('signal_type').notNull(),
  latencyMs:       integer('latency_ms'),
  followupCount:   integer('followup_count').notNull().default(0),
  draftText:       text('draft_text'),
  correctionText:  text('correction_text'),
  rejectionReason: text('rejection_reason'),
  rating:          text('rating'),
  actionType:      text('action_type'),
  payload:         jsonb('payload'),
  capturedAt:      timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
});
