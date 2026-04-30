import { pgTable, text, timestamp, real, integer, jsonb } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
  kind?: string;
  ts: string;
}

export const telegramChatState = pgTable('telegram_chat_state', {
  chatId: text('chat_id').primaryKey(),
  pendingReminderMessage: text('pending_reminder_message'),
  pendingReminderExpiresAt: timestamp('pending_reminder_expires_at'),
  lastRouteAgentKey: text('last_route_agent_key'),
  lastRouteInstructions: text('last_route_instructions'),
  lastRunId: text('last_run_id'),
  recentTurns: jsonb('recent_turns').$type<ChatTurn[]>().notNull().default([]),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const telegramRoutingLogs = pgTable('telegram_routing_logs', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  chatId: text('chat_id').notNull(),
  inboundText: text('inbound_text').notNull(),
  decidedKind: text('decided_kind').notNull(),
  decidedAgentKey: text('decided_agent_key'),
  confidence: real('confidence'),
  latencyMs: integer('latency_ms'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
