import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const shortsScripts = pgTable('shorts_scripts', {
  id:             text('id').primaryKey().$defaultFn(() => createId()),
  title:          text('title').notNull(),
  hook:           text('hook').notNull(),
  voiceover:      text('voiceover').notNull(),
  visualBrief:    text('visual_brief').notNull(),
  canvaDesignId:  text('canva_design_id'),
  canvaDesignUrl: text('canva_design_url'),
  brand:          text('brand').notNull().default('taskip'),
  topic:          text('topic').notNull(),
  durationSecs:   integer('duration_secs').notNull().default(30),
  status:         text('status').notNull().default('draft'),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
});
