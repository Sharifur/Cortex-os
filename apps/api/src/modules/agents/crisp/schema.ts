import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const crispConversations = pgTable('crisp_conversations', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  sessionId: text('session_id').notNull().unique(),
  websiteId: text('website_id').notNull(),
  visitorEmail: text('visitor_email'),
  visitorNickname: text('visitor_nickname'),
  lastMessage: text('last_message').notNull(),
  draftReply: text('draft_reply'),
  status: text('status').notNull().default('new'), // new | replied | ignored | escalated
  receivedAt: timestamp('received_at').notNull(),
  repliedAt: timestamp('replied_at'),
});
