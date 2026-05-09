import { pgTable, text, timestamp, jsonb, index, integer, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
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
    // open tracking
    trackingToken: text('tracking_token'),
    openCount: integer('open_count').notNull().default(0),
    firstOpenAt: timestamp('first_open_at'),
    lastOpenAt: timestamp('last_open_at'),
    openEvents: jsonb('open_events'), // Array<{ at: string; ip: string; ua: string }>
  },
  (t) => ({
    threadIdx: index('taskip_internal_emails_thread_idx').on(t.gmailThreadId),
    workspaceIdx: index('taskip_internal_emails_workspace_idx').on(t.workspaceUuid),
    sentAtIdx: index('taskip_internal_emails_sent_at_idx').on(t.sentAt),
    trackingTokenIdx: uniqueIndex('taskip_internal_emails_tracking_token_idx').on(t.trackingToken),
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

// Suggestion tables — proactive sweep (sprint plan T1)

export const taskipInternalSuggestions = pgTable(
  'taskip_internal_suggestions',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    workspaceUuid: text('workspace_uuid').notNull(),
    ownerEmail: text('owner_email').notNull(),
    ownerName: text('owner_name').notNull(),
    cohort: text('cohort').notNull(),
    scenarioKey: text('scenario_key').notNull(),
    score: integer('score').notNull(),
    scoreTier: integer('score_tier').notNull(),
    lifecycleState: text('lifecycle_state').notNull(),
    daysSinceSignup: integer('days_since_signup').notNull(),
    subject: text('subject').notNull(),
    bodyMd: text('body_md').notNull(),
    ctaText: text('cta_text'),
    ctaUrl: text('cta_url'),
    // channel is locked at draft time and never re-evaluated at send
    channel: text('channel').notNull(), // 'gmail' | 'taskip_system'
    channelLockedAt: timestamp('channel_locked_at').notNull(),
    // status lifecycle: pending → approved → sent | failed; or pending → skipped
    status: text('status').notNull().default('pending'), // pending | approved | skipped | sent | failed
    failedReason: text('failed_reason'),
    sentEmailId: text('sent_email_id'), // FK → taskipInternalEmails (gmail path)
    insightMessageId: integer('insight_message_id'), // ID from POST /messages (taskip_system path)
    approvedAt: timestamp('approved_at'),
    sentAt: timestamp('sent_at'),
    skippedAt: timestamp('skipped_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    workspaceIdx: index('taskip_internal_suggestions_workspace_idx').on(t.workspaceUuid),
    statusIdx: index('taskip_internal_suggestions_status_idx').on(t.status),
    cohortIdx: index('taskip_internal_suggestions_cohort_idx').on(t.cohort),
    // prevents duplicate pending suggestions for the same workspace
    pendingUniq: uniqueIndex('taskip_internal_suggestions_pending_uniq')
      .on(t.workspaceUuid)
      .where(sql`status = 'pending'`),
  }),
);

export const taskipInternalWorkspaceActivity = pgTable(
  'taskip_internal_workspace_activity',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    workspaceUuid: text('workspace_uuid').notNull(),
    // suggestion_created | email_sent | email_replied | suggestion_skipped |
    // insight_message_sent | sweep_skipped_cooldown | sweep_ignored
    activityType: text('activity_type').notNull(),
    suggestionId: text('suggestion_id'), // FK → taskipInternalSuggestions (nullable)
    emailId: text('email_id'),           // FK → taskipInternalEmails (nullable)
    score: integer('score'),
    cohort: text('cohort'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    workspaceIdx: index('taskip_internal_workspace_activity_workspace_idx').on(t.workspaceUuid),
    typeIdx: index('taskip_internal_workspace_activity_type_idx').on(t.activityType),
    createdAtIdx: index('taskip_internal_workspace_activity_created_at_idx').on(t.createdAt),
  }),
);
