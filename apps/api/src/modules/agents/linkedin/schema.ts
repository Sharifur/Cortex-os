import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const linkedinLeads = pgTable('linkedin_leads', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  profileUrl: text('profile_url').notNull().unique(),
  name: text('name'),
  headline: text('headline'),
  status: text('status').notNull().default('new'), // new | messaged | replied | converted | ignored
  lastContactedAt: timestamp('last_contacted_at'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const linkedinPosts = pgTable('linkedin_posts', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  externalId: text('external_id').notNull().unique(),
  authorName: text('author_name'),
  content: text('content').notNull(),
  draftComment: text('draft_comment'),
  status: text('status').notNull().default('pending'), // pending | approved | posted | skipped
  postedAt: timestamp('posted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
