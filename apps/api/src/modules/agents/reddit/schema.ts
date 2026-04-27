import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const redditThreads = pgTable('reddit_threads', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  threadId: text('thread_id').notNull().unique(),
  subreddit: text('subreddit').notNull(),
  title: text('title').notNull(),
  url: text('url').notNull(),
  body: text('body'),
  draftComment: text('draft_comment'),
  status: text('status').notNull().default('pending'), // pending | approved | posted | skipped
  lastEngagedAt: timestamp('last_engaged_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const redditKeywords = pgTable('reddit_keywords', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  keyword: text('keyword').notNull().unique(),
  subreddits: text('subreddits'),   // comma-separated, empty = all
  active: text('active').notNull().default('true'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
