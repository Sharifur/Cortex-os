import { pgTable, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    userId: text('user_id').notNull(),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    ua: text('ua'),
    label: text('label'),
    lastSeenAt: timestamp('last_seen_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    endpointUnique: uniqueIndex('push_subscriptions_endpoint_unique').on(t.endpoint),
    userIdx: index('push_subscriptions_user_idx').on(t.userId),
  }),
);
