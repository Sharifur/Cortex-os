import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const contentIdeas = pgTable('content_ideas', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  month: text('month').notNull(),    // YYYY-MM
  format: text('format').notNull(), // carousel | reel | post | story | youtube
  hook: text('hook').notNull(),
  body: text('body').notNull(),
  cta: text('cta').notNull(),
  platform: text('platform'),       // fb | ig | x | linkedin | youtube
  brand: text('brand'),             // taskip | xgenious
  canvaDesignId: text('canva_design_id'),
  mediaUrl: text('media_url'),      // MinIO URL after export
  status: text('status').notNull().default('idea'), // idea | approved | designed | published
  scheduledFor: timestamp('scheduled_for'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
