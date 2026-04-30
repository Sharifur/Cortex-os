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
  contactId: text('contact_id'),
  followUp: boolean('follow_up').notNull().default(false),
  followUpNote: text('follow_up_note'),
  followUpDueAt: timestamp('follow_up_due_at'),
  followUpNotifiedAt: timestamp('follow_up_notified_at'),
  followUpResolvedAt: timestamp('follow_up_resolved_at'),
});

export const crispWebsites = pgTable('crisp_websites', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  label: text('label').notNull(),
  websiteId: text('website_id').notNull().unique(),
  identifier: text('identifier').notNull(),
  apiKey: text('api_key').notNull(), // AES-256-GCM encrypted
  enabled: boolean('enabled').notNull().default(true),
  productContext: text('product_context'),
  replyTone: text('reply_tone'),
  // 'plugin' for Crisp Website Tokens / marketplace plugin tokens (default).
  // 'user' for personal API tokens from Settings → API Token.
  // Drives the X-Crisp-Tier auth header sent to api.crisp.chat.
  tokenType: text('token_type').notNull().default('plugin'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
