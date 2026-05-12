import { pgTable, text, integer, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const postFormats = pgTable('post_formats', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  platform: text('platform').notNull(),
  category: text('category').notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  slideCount: integer('slide_count').notNull().default(1),
  schema: jsonb('schema').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const postRenders = pgTable('post_renders', {
  id: text('id').primaryKey(),
  formatId: text('format_id').notNull(),
  brand: text('brand').notNull(),
  topic: text('topic'),
  intent: text('intent'),
  filledContent: jsonb('filled_content').notNull(),
  slideUrls: text('slide_urls').array().notNull().default([]),
  status: text('status').notNull().default('draft'),
  telegramMessageId: text('telegram_message_id'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
