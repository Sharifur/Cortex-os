import { pgTable, text, timestamp, boolean } from 'drizzle-orm/pg-core';
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

export const crispWebsites = pgTable('crisp_websites', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  label: text('label').notNull(),
  websiteId: text('website_id').notNull().unique(),
  identifier: text('identifier').notNull(),
  apiKey: text('api_key').notNull(), // AES-256-GCM encrypted
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
