import { pgTable, text, integer, numeric, timestamp, index } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const llmUsageLogs = pgTable(
  'llm_usage_logs',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    runId: text('run_id'),
    agentKey: text('agent_key'),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    inputTokens: integer('input_tokens').default(0).notNull(),
    outputTokens: integer('output_tokens').default(0).notNull(),
    cachedInputTokens: integer('cached_input_tokens').default(0).notNull(),
    costUsd: numeric('cost_usd', { precision: 14, scale: 8 }).default('0').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    createdIdx: index('llm_usage_logs_created_idx').on(t.createdAt),
    agentIdx: index('llm_usage_logs_agent_idx').on(t.agentKey),
    modelIdx: index('llm_usage_logs_model_idx').on(t.provider, t.model),
  }),
);
