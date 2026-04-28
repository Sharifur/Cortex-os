import { pgTable, text, timestamp, jsonb, index, integer } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const taskipInternalOps = pgTable('taskip_internal_ops', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  runId: text('run_id').notNull(),
  opType: text('op_type').notNull(), // extend_trial | mark_refund | lookup | query
  payload: jsonb('payload').notNull(),
  status: text('status').notNull().default('pending'), // pending | executed | failed
  executedAt: timestamp('executed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const taskipInternalEmails = pgTable(
  'taskip_internal_emails',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    purpose: text('purpose').notNull(), // marketing | followup | offer | other
    workspaceUuid: text('workspace_uuid'),
    recipient: text('recipient').notNull(),
    subject: text('subject').notNull(),
    body: text('body').notNull(),
    gmailMessageId: text('gmail_message_id'),
    gmailThreadId: text('gmail_thread_id'),
    status: text('status').notNull().default('sent'), // sent | failed
    error: text('error'),
    replyCount: integer('reply_count').notNull().default(0),
    lastReplyAt: timestamp('last_reply_at'),
    lastSyncedAt: timestamp('last_synced_at'),
    metadata: jsonb('metadata'),
    sentAt: timestamp('sent_at').defaultNow().notNull(),
  },
  (t) => ({
    threadIdx: index('taskip_internal_emails_thread_idx').on(t.gmailThreadId),
    workspaceIdx: index('taskip_internal_emails_workspace_idx').on(t.workspaceUuid),
    sentAtIdx: index('taskip_internal_emails_sent_at_idx').on(t.sentAt),
  }),
);

export const taskipInternalEmailReplies = pgTable(
  'taskip_internal_email_replies',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    emailId: text('email_id').notNull(), // FK to taskip_internal_emails.id
    gmailMessageId: text('gmail_message_id').notNull(),
    gmailThreadId: text('gmail_thread_id').notNull(),
    fromAddress: text('from_address').notNull(),
    snippet: text('snippet'),
    body: text('body'),
    receivedAt: timestamp('received_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    emailIdx: index('taskip_internal_email_replies_email_idx').on(t.emailId),
    msgUniq: index('taskip_internal_email_replies_msg_uniq').on(t.gmailMessageId),
  }),
);
