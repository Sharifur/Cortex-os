import { pgTable, text, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const requestLogs = pgTable(
  'request_logs',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    method: text('method').notNull(),
    path: text('path').notNull(),
    statusCode: integer('status_code').notNull(),
    durationMs: integer('duration_ms'),
    requestId: text('request_id'),
    userId: text('user_id'),
    ip: text('ip'),
    userAgent: text('user_agent'),
    queryString: text('query_string'),
    requestBody: text('request_body'),
    responseBody: text('response_body'),
    errorMessage: text('error_message'),
    errorStack: text('error_stack'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('request_logs_status_idx').on(t.statusCode),
    pathIdx: index('request_logs_path_idx').on(t.path),
    createdIdx: index('request_logs_created_idx').on(t.createdAt),
  }),
);
