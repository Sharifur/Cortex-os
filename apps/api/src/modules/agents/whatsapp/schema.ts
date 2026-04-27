import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const whatsappMessages = pgTable('whatsapp_messages', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  externalMsgId: text('external_msg_id').notNull().unique(),
  fromNumber: text('from_number').notNull(),
  fromName: text('from_name'),
  body: text('body').notNull(),
  importance: text('importance'),      // urgent | important | normal | spam
  draftedReply: text('drafted_reply'),
  mediaKey: text('media_key'),         // MinIO key for media attachments
  status: text('status').notNull().default('new'), // new | notified | replied | ignored
  receivedAt: timestamp('received_at').notNull(),
  processedAt: timestamp('processed_at'),
});
