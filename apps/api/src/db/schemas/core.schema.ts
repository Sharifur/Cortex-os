import {
  pgTable,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const triggerTypeEnum = pgEnum('trigger_type', [
  'CRON',
  'WEBHOOK',
  'MANUAL',
  'CHAINED',
  'MCP',
  'API',
]);

export const runStatusEnum = pgEnum('run_status', [
  'PENDING',
  'RUNNING',
  'AWAITING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'EXECUTED',
  'FAILED',
  'FOLLOWUP',
]);

export const approvalStatusEnum = pgEnum('approval_status', [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'FOLLOWUP',
  'EXPIRED',
]);

export const logLevelEnum = pgEnum('log_level', [
  'DEBUG',
  'INFO',
  'WARN',
  'ERROR',
]);

export const users = pgTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  telegramChatId: text('telegram_chat_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const agents = pgTable('agents', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  enabled: boolean('enabled').default(true).notNull(),
  config: jsonb('config').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const agentRuns = pgTable('agent_runs', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  agentId: text('agent_id')
    .notNull()
    .references(() => agents.id),
  triggerType: triggerTypeEnum('trigger_type').notNull(),
  triggerPayload: jsonb('trigger_payload'),
  status: runStatusEnum('status').notNull(),
  context: jsonb('context'),
  proposedActions: jsonb('proposed_actions'),
  result: jsonb('result'),
  error: text('error'),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  finishedAt: timestamp('finished_at'),
});

export const pendingApprovals = pgTable('pending_approvals', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  runId: text('run_id')
    .notNull()
    .references(() => agentRuns.id),
  action: jsonb('action').notNull(),
  telegramMessageId: text('telegram_message_id'),
  telegramThreadId: text('telegram_thread_id'),
  status: approvalStatusEnum('status').notNull(),
  followupMessages: jsonb('followup_messages'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
  expiresAt: timestamp('expires_at').notNull(),
});

export const agentLogs = pgTable('agent_logs', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  runId: text('run_id')
    .notNull()
    .references(() => agentRuns.id),
  level: logLevelEnum('level').notNull(),
  message: text('message').notNull(),
  meta: jsonb('meta'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const mcpServers = pgTable('mcp_servers', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text('name').notNull().unique(),
  url: text('url').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const promptTemplates = pgTable('prompt_templates', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  key: text('key').notNull().unique(),
  system: text('system').notNull(),
  userTemplate: text('user_template').notNull(),
  version: integer('version').default(1).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
