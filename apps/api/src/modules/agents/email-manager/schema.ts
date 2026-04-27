import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const emailItems = pgTable('email_items', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  externalMsgId: text('external_msg_id').notNull().unique(),
  threadId: text('thread_id').notNull(),
  from: text('from').notNull(),
  subject: text('subject').notNull(),
  snippet: text('snippet').notNull(),
  classification: text('classification'), // must-reply | nice-to-reply | newsletter | spam
  draftReply: text('draft_reply'),
  status: text('status').notNull().default('new'), // new | notified | sent | archived
  receivedAt: timestamp('received_at').notNull(),
  processedAt: timestamp('processed_at'),
});
