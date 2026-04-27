import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const socialPosts = pgTable('social_posts', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  brand: text('brand').notNull(),        // taskip | xgenious
  platform: text('platform').notNull(), // fb | ig | x | linkedin
  body: text('body').notNull(),
  mediaUrls: text('media_urls').notNull().default('[]'), // JSON array
  scheduledFor: timestamp('scheduled_for').notNull(),
  status: text('status').notNull().default('scheduled'), // scheduled | published | failed | cancelled
  externalPostId: text('external_post_id'),
  performance: text('performance').notNull().default('{}'), // JSON
  createdAt: timestamp('created_at').notNull().defaultNow(),
  publishedAt: timestamp('published_at'),
});

export const socialEngagements = pgTable('social_engagements', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  postId: text('post_id'),
  platform: text('platform').notNull(),
  type: text('type').notNull(), // comment | dm
  fromUser: text('from_user').notNull(),
  body: text('body').notNull(),
  draftedReply: text('drafted_reply'),
  status: text('status').notNull().default('new'), // new | replied | ignored
  receivedAt: timestamp('received_at').notNull().defaultNow(),
  repliedAt: timestamp('replied_at'),
});
