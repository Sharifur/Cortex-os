import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const authSessions = pgTable(
  'auth_sessions',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    userId: text('user_id').notNull(),
    jti: text('jti').notNull().unique(),
    ip: text('ip'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    lastUsedAt: timestamp('last_used_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    revokedAt: timestamp('revoked_at'),
  },
  (t) => ({
    userIdx: index('auth_sessions_user_idx').on(t.userId),
    jtiIdx: index('auth_sessions_jti_idx').on(t.jti),
  }),
);
