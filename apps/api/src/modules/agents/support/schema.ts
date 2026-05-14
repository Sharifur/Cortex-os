import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const supportWebhookLogs = pgTable('support_webhook_logs', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  status: text('status').notNull(),
  externalId: text('external_id'),
  ticketId: text('ticket_id'),
  rawPayload: text('raw_payload'),
  responseBody: text('response_body'),
  error: text('error'),
  receivedAt: timestamp('received_at').defaultNow().notNull(),
});

export const supportTicketEvents = pgTable('support_ticket_events', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  ticketId: text('ticket_id'),
  externalId: text('external_id'),
  eventType: text('event_type').notNull(),
  summary: text('summary'),
  payload: jsonb('payload'),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const supportTickets = pgTable('support_tickets', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  externalId: text('external_id').unique(),
  crmUuid: text('crm_uuid'),
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
  purchaseCodeStatus: text('purchase_code_status'), // null | 'requested' | 'verified' | 'invalid' | 'expired'
  purchaseCode: text('purchase_code'),
  repliedAt: timestamp('replied_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
