import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const supportTickets = pgTable('support_tickets', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  externalId: text('external_id').unique(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  userEmail: text('user_email').notNull(),
  category: text('category'),        // billing | technical | feature | general
  priority: text('priority').notNull().default('medium'), // low | medium | high | urgent
  status: text('status').notNull().default('open'),       // open | replied | escalated | closed
  assignedTo: text('assigned_to'),
  lastDraft: text('last_draft'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
