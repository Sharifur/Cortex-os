import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const supportWebhookLogs = pgTable('support_webhook_logs', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  status: text('status').notNull(),       // 'ok' | 'duplicate' | 'error' | 'rejected'
  externalId: text('external_id'),        // ticket.id from CRM
  ticketId: text('ticket_id'),            // internal support_tickets.id if created
  rawPayload: text('raw_payload'),        // first 5000 chars of the raw JSON body
  error: text('error'),                   // error message when status = 'error'|'rejected'
  receivedAt: timestamp('received_at').defaultNow().notNull(),
});

export const supportTickets = pgTable('support_tickets', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  externalId: text('external_id').unique(),
  ticketNo: text('ticket_no'),
  subject: text('subject').notNull(),
  body: text('body'),
  userEmail: text('user_email').notNull(),
  contactName: text('contact_name'),
  contactPhone: text('contact_phone'),
  category: text('category'),        // billing | technical | feature | general
  priority: text('priority').notNull().default('medium'), // low | medium | high | urgent
  status: text('status').notNull().default('open'),       // open | replied | escalated | closed
  assignedTo: text('assigned_to'),
  lastDraft: text('last_draft'),
  repliedAt: timestamp('replied_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
