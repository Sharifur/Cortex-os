import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { agents, taskipInternalOps, taskipInternalSuggestions, taskipInternalWorkspaceActivity } from '../../../db/schema';
import { AgentRegistryService } from '../runtime/agent-registry.service';
import { LlmRouterService } from '../../llm/llm-router.service';
import { TelegramService } from '../../telegram/telegram.service';
import { TaskipInternalDbService } from './taskip-internal-db.service';
import { TaskipInsightService, type InsightCohort, type InsightMarketingSuggestion, type InsightSubmitMessage } from './taskip-insight.service';
import { TaskipInternalEmailService, type TaskipEmailPurpose } from './taskip-internal-email.service';
import { TaskipInternalSuggestionSweepService } from './taskip-internal-suggestion-sweep.service';
import { TASKIP_SUGGESTION_SWEEP_QUEUE } from './taskip-internal-suggestion-sweep.processor';
import { KillSwitchService, type KillSwitchAction } from '../../safety/kill-switch.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { LlmToolMessage, ToolDefinition } from '../../llm/llm.types';
import type {
  IAgent,
  TriggerSpec,
  TriggerEvent,
  RunContext,
  AgentContext,
  ProposedAction,
  ActionResult,
  McpToolDefinition,
  AgentApiRoute,
} from '../runtime/types';
import { agentLlmOpts } from '../runtime/llm-config.util';

interface TaskipInternalConfig {
  llm?: { provider?: string; model?: string };
}

interface TaskipInternalSnapshot {
  query: string;
  config: TaskipInternalConfig;
  history?: string;
}

const SYSTEM_PROMPT = `You are an internal ops assistant for Sharifur Rahman, founder of Taskip.

GOLDEN RULE: You NEVER send an email, lifecycle message, or marketing suggestion automatically. Every write action (send_email, insight_submit_message, insight_submit_marketing_suggestion, extend_trial, mark_refund) requires explicit human approval. Propose the action and stop — the approval gate handles delivery.

---

## Read tools

Taskip DB: lookup_user / query_subscriptions / query_invoices / summarize_user_history
Insight (read): insight_list_cohort / insight_get_overview / insight_recommended_actions / insight_log_agent_action / insight_get_lifecycle / insight_pending_scenarios / insight_recent_messages
Agent queue (read): list_workspace_suggestions / list_sent_emails / sync_email_replies

## Write tools (ALL approval-gated — propose only, never execute directly)

- send_email — Gmail outbound for FREE and TRIAL cohorts only
- insight_submit_message — Insight lifecycle delivery for PAID cohorts only
- insight_submit_marketing_suggestion — marketing queue for any cohort; human reviews before send
- extend_trial / mark_refund — Taskip DB mutations

---

## Channel routing — CRITICAL

| Cohort | Channel to use |
|---|---|
| serious_trial, looking_trial, ignore_trial, expired_trial_warm, expired_trial_cold | send_email (Gmail — personal founder tone) |
| trial_ready_free, nurture_free, activate_free, ignore_free | send_email (Gmail — personal founder tone) |
| healthy_paid, expanding_paid, at_risk_paid, dormant_paid | insight_submit_message (Insight system delivery) |

Never use send_email for paid-plan workspaces.
Never use insight_submit_message for free or trial workspaces.

---

## Score thresholds

| Score type | When active | Priority guidance |
|---|---|---|
| CHS (Customer Health) | paid cohorts | < 40 = act now, 40–70 = monitor, > 70 = healthy |
| TRS (Trial Readiness) | free cohorts | > 70 = upgrade candidate, 50–70 = nurture |
| THS (Trial Health) | trial cohorts | > 60 = on track, < 40 = stalled — intervene |

THS alt-activation: invoices_total > 0 OR leads_total > 0 OR contacts_total >= 3 counts as activated even if the event stream didn't fire. Do NOT send activation nudges to already-activated workspaces.

---

## Valid scenario_key values (insight_submit_message only)

NEVER invent or guess a scenario_key. Before calling insight_submit_message, you MUST call insight_pending_scenarios(workspace_uuid) first.
Use ONLY a scenario_key that appears in insight_pending_scenarios.eligible[].scenario_key for that workspace.
If the eligible list is empty, skip this workspace — do not submit a message.

---

## Intent detection — READ THIS FIRST before every response

Classify the user's message before doing anything:

**READ intent** — keywords: list, show, find, get, what, how many, check, who, display, summarize, overview, drill into, look up, give me, tell me
→ Run read tools only. Return the data. STOP. Do NOT propose any write action unless the user explicitly asked for one.

**ACTION intent** — keywords: propose, suggest, send, submit, draft, extend, refund, reach out, outreach, write email, create suggestion
→ Follow the outreach workflow below. Propose ONE action and stop.

If the message is ambiguous, treat it as READ. Never auto-escalate to an action.

Examples:
- "List at_risk_paid workspaces" → READ — return the list, nothing else
- "Show me user X's history" → READ — return the data
- "Propose retention outreach for workspace Y" → ACTION — draft and propose
- "Find trial_ready_free workspaces and suggest upgrade emails" → ACTION (explicitly asks to suggest)

---

## Workflow for READ queries

Call the relevant read tool(s), format the results clearly, and reply. Do not call any write tool. Do not propose any action at the end.

---

## Workflow for ACTION queries (outreach)

Phase 1 — insight_list_cohort(cohort, per_page=5, min_score=0). Pick top 3-5 by score/urgency. Do NOT fetch 50-100 and loop over all.
Phase 2 — for each candidate: insight_get_overview → insight_recent_messages → list_workspace_suggestions.
  Skip workspace if: a message was sent in the last 7 days OR a pending suggestion already exists in the queue.
Phase 3 — insight_pending_scenarios to confirm the scenario is eligible.
Phase 4 — propose ONE action per workspace using the correct channel (see routing table above). Stop — do not chain multiple send calls.
Phase 5 — insight_log_agent_action(result=success|skipped, reason=...) to record the decision.

Before ANY outreach proposal:
- Call list_sent_emails(workspaceUuid=...) or insight_recent_messages first.
- If contacted in the last 7 days → log skipped, move on.
- Never propose more than one action per workspace per session.

insight_get_overview returns: plan, cohort, score, score_type, score_delta_14d, activation_event_hit, volume_metrics (invoices_total, invoices_paid, contacts_total, leads_total, projects_total, tasks_total), session (last_active_at, is_active_now). Ground all outreach copy in these real numbers.

Always look up the user/workspace before a write operation. Final answer goes to Telegram — be concise.`;

const MAX_TOOL_ITERATIONS = 14;

@Injectable()
export class TaskipInternalAgent implements IAgent, OnModuleInit {
  readonly key = 'taskip_internal';
  readonly name = 'Taskip Internal';
  private readonly logger = new Logger(TaskipInternalAgent.name);

  constructor(
    private db: DbService,
    private llm: LlmRouterService,
    private telegram: TelegramService,
    private taskipDb: TaskipInternalDbService,
    private insight: TaskipInsightService,
    private emails: TaskipInternalEmailService,
    private suggestionSweep: TaskipInternalSuggestionSweepService,
    private killSwitch: KillSwitchService,
    private registry: AgentRegistryService,
    @InjectQueue(TASKIP_SUGGESTION_SWEEP_QUEUE) private readonly suggestionSweepQueue: Queue,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  triggers(): TriggerSpec[] {
    return [{ type: 'MANUAL' }];
  }

  async buildContext(trigger: TriggerEvent, run: RunContext): Promise<AgentContext> {
    const config = await this.getConfig();
    const payload = run.triggerPayload as { query?: string; history?: string } | null;
    const query = payload?.query ?? 'No query provided';
    const history = payload?.history;

    return {
      source: trigger,
      snapshot: { query, config, history } satisfies TaskipInternalSnapshot,
      followups: (run.context as AgentContext | null)?.followups ?? [],
    };
  }

  async decide(ctx: AgentContext): Promise<ProposedAction[]> {
    const { query, config, history } = ctx.snapshot as TaskipInternalSnapshot;
    const followupNote = ctx.followups.at(-1)?.text;

    const effectiveQuery = followupNote
      ? `${query}\n\nAdditional instruction: ${followupNote}`
      : query;

    const priorMessages: LlmToolMessage[] = [];
    if (history) {
      for (const line of history.split('\n')) {
        if (line.startsWith('User: ')) priorMessages.push({ role: 'user', content: line.slice(6) });
        else if (line.startsWith('Agent: ')) priorMessages.push({ role: 'assistant', content: line.slice(7) });
      }
    }

    const tools = this.buildToolDefinitions();
    const messages: LlmToolMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...priorMessages,
      { role: 'user', content: effectiveQuery },
    ];

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const result = await this.llm.completeWithTools({
        ...agentLlmOpts(config),
        agentKey: this.key,
        messages,
        tools,
        maxTokens: 800,
        temperature: 0.2,
      });

      if (result.type === 'text') {
        return [{
          type: 'notify_result',
          summary: 'Send query result via Telegram',
          payload: { message: result.content, query },
          riskLevel: 'low',
        }];
      }

      // Append assistant message with tool calls
      messages.push({
        role: 'assistant',
        content: null,
        tool_calls: result.tool_calls,
      });

      for (const tc of result.tool_calls) {
        let args: Record<string, unknown>;
        try {
          args = JSON.parse(tc.arguments);
        } catch {
          args = {};
        }

        // Write operations require approval — surface as ProposedAction
        if (tc.name === 'extend_trial' || tc.name === 'mark_refund') {
          const summary = tc.name === 'extend_trial'
            ? `Extend trial for user ${args.userId} by ${args.days ?? 7} day(s)`
            : `Mark refund for user ${args.userId}, invoice ${args.invoiceId}`;

          return [{
            type: tc.name,
            summary,
            payload: { ...args, _query: query },
            riskLevel: 'high',
          }];
        }

        if (tc.name === 'insight_submit_marketing_suggestion') {
          const summary = `Submit marketing suggestion for workspace ${args.workspace_uuid} (${args.template_key})`;
          return [{
            type: 'insight_submit_marketing_suggestion',
            summary,
            payload: { ...args, _query: query },
            riskLevel: 'high',
          }];
        }

        if (tc.name === 'send_email') {
          const summary = `Send ${args.purpose ?? 'other'} email to ${args.recipient} — "${(args.subject as string ?? '').slice(0, 60)}"`;
          return [{
            type: 'send_email',
            summary,
            payload: { ...args, _query: query },
            riskLevel: 'high',
          }];
        }

        if (tc.name === 'insight_submit_message') {
          const summary = `Send Insight ${args.scenario_key} message to workspace ${args.workspace_uuid} (${args.channel})`;
          return [{
            type: 'insight_submit_message',
            summary,
            payload: { ...args, _query: query },
            riskLevel: 'high',
          }];
        }

        // Read-only tools — execute and feed result back
        const toolResult = await this.executeReadTool(tc.name, args);
        messages.push({
          role: 'tool',
          content: JSON.stringify(toolResult),
          tool_call_id: tc.id,
        });
      }
    }

    return [{
      type: 'notify_result',
      summary: 'Send query result via Telegram',
      payload: { message: 'Could not produce a final answer within the iteration limit.', query },
      riskLevel: 'low',
    }];
  }

  requiresApproval(action: ProposedAction): boolean {
    return action.type === 'extend_trial'
      || action.type === 'mark_refund'
      || action.type === 'insight_submit_marketing_suggestion'
      || action.type === 'insight_submit_message'
      || action.type === 'send_email';
  }

  async execute(action: ProposedAction): Promise<ActionResult> {
    const killSwitchActions: KillSwitchAction[] = ['extend_trial', 'mark_refund', 'send_email', 'insight_submit_marketing_suggestion', 'insight_submit_message'];
    if (killSwitchActions.includes(action.type as KillSwitchAction)) {
      const blocked = await this.killSwitch.isBlocked(action.type as KillSwitchAction);
      if (blocked) {
        const msg = `Blocked by kill switch: ${action.type}`;
        await this.telegram.sendMessage(msg);
        return { success: false, error: msg };
      }
    }
    switch (action.type) {
      case 'notify_result': {
        const { message } = action.payload as { message: string; query: string };
        await this.telegram.sendMessage(`Taskip Internal\n\n${message}`);
        return { success: true, data: { notified: true } };
      }

      case 'extend_trial': {
        const { userId, days = 7, _query } = action.payload as {
          userId: string;
          days?: number;
          _query?: string;
        };

        await this.db.db.insert(taskipInternalOps).values({
          runId: 'executed',
          opType: 'extend_trial',
          payload: { userId, days, query: _query },
          status: 'executing',
        });

        const result = await this.taskipDb.extendTrial(userId, Number(days));

        await this.db.db.insert(taskipInternalOps).values({
          runId: 'executed',
          opType: 'extend_trial',
          payload: { userId, days, result },
          status: result.success ? 'executed' : 'failed',
          executedAt: new Date(),
        });

        const msg = result.success
          ? `Trial extended for user ${userId} by ${days} day(s). New end: ${result.newTrialEndsAt ?? 'unknown'}`
          : `Failed to extend trial for user ${userId}`;
        await this.telegram.sendMessage(msg);
        return { success: result.success, data: result };
      }

      case 'mark_refund': {
        const { userId, invoiceId, _query } = action.payload as {
          userId: string;
          invoiceId: string;
          _query?: string;
        };

        const result = await this.taskipDb.markRefund(userId, invoiceId);

        await this.db.db.insert(taskipInternalOps).values({
          runId: 'executed',
          opType: 'mark_refund',
          payload: { userId, invoiceId, query: _query, result },
          status: result.success ? 'executed' : 'failed',
          executedAt: new Date(),
        });

        const msg = result.success
          ? `Invoice ${invoiceId} for user ${userId} marked as refund_requested`
          : `Failed to mark refund for invoice ${invoiceId}`;
        await this.telegram.sendMessage(msg);
        return { success: result.success, data: result };
      }

      case 'send_email': {
        const { _query, purpose, recipient, subject, body, workspaceUuid } = action.payload as {
          _query?: string;
          purpose?: TaskipEmailPurpose;
          recipient: string;
          subject: string;
          body: string;
          workspaceUuid?: string;
        };
        const result = await this.emails.send({
          purpose: purpose ?? 'other',
          recipient,
          subject,
          body,
          workspaceUuid,
          metadata: _query ? { query: _query } : undefined,
        });
        const msg = result.status === 'sent'
          ? `Email sent to ${recipient} — "${subject}". Tracked as ${result.id}.`
          : `Failed to send email to ${recipient}: ${result.error}`;
        await this.telegram.sendMessage(msg);
        return { success: result.status === 'sent', data: result };
      }

      case 'insight_submit_message': {
        const { _query, workspace_uuid, ...payload } = action.payload as InsightSubmitMessage & { _query?: string; workspace_uuid: string };
        try {
          const result = await this.insight.submitMessage(workspace_uuid, payload);
          await this.db.db.insert(taskipInternalOps).values({
            runId: 'executed',
            opType: 'insight_submit_message',
            payload: { query: _query, workspace_uuid, request: payload, result },
            status: 'executed',
            executedAt: new Date(),
          });
          await this.insight.logAgentAction(workspace_uuid, {
            action_type: 'lifecycle_message_submitted',
            result: result.status === 'sent' || result.status === 'manual_review_pending' ? 'success' : 'skipped',
            reason: result.status,
            payload: { message_id: result.id, scenario_key: payload.scenario_key, channel: result.channel },
          }).catch((err) => this.logger.warn(`logAgentAction failed: ${(err as Error).message}`));
          await this.telegram.sendMessage(
            `Insight message #${result.id} ${result.status} for ${workspace_uuid} (${payload.scenario_key}, ${payload.channel})`,
          );
          return { success: true, data: result };
        } catch (err) {
          const message = (err as Error).message;
          await this.db.db.insert(taskipInternalOps).values({
            runId: 'executed',
            opType: 'insight_submit_message',
            payload: { query: _query, workspace_uuid, request: payload, error: message },
            status: 'failed',
            executedAt: new Date(),
          });
          await this.telegram.sendMessage(`Insight message failed for ${workspace_uuid}: ${message}`);
          return { success: false, error: message };
        }
      }

      case 'insight_submit_marketing_suggestion': {
        const { _query, ...payload } = action.payload as InsightMarketingSuggestion & { _query?: string };
        try {
          const result = await this.insight.submitMarketingSuggestion(payload);
          await this.db.db.insert(taskipInternalOps).values({
            runId: 'executed',
            opType: 'insight_marketing_suggestion',
            payload: { query: _query, request: payload, result },
            status: 'executed',
            executedAt: new Date(),
          });
          await this.insight.logAgentAction(payload.workspace_uuid, {
            action_type: 'marketing_suggestion_submitted',
            result: 'success',
            payload: { suggestion_id: result.id, template_key: payload.template_key },
          }).catch((err) => this.logger.warn(`logAgentAction failed: ${(err as Error).message}`));
          await this.telegram.sendMessage(
            `Marketing suggestion #${result.id} submitted for ${payload.workspace_uuid} (${payload.template_key}, status: ${result.status})`,
          );
          return { success: true, data: result };
        } catch (err) {
          const message = (err as Error).message;
          await this.db.db.insert(taskipInternalOps).values({
            runId: 'executed',
            opType: 'insight_marketing_suggestion',
            payload: { query: _query, request: payload, error: message },
            status: 'failed',
            executedAt: new Date(),
          });
          await this.telegram.sendMessage(`Marketing suggestion failed for ${payload.workspace_uuid}: ${message}`);
          return { success: false, error: message };
        }
      }

      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  mcpTools(): McpToolDefinition[] {
    return [
      {
        name: 'lookup_user',
        description: 'Find a Taskip user by email address or user ID',
        inputSchema: {
          type: 'object',
          properties: { emailOrId: { type: 'string' } },
          required: ['emailOrId'],
        },
        handler: async (input) => {
          const { emailOrId } = input as { emailOrId: string };
          return this.taskipDb.lookupUser(emailOrId);
        },
      },
      {
        name: 'lookup_workspace_owner',
        description: 'Find the Taskip user who owns a workspace by workspace UUID. Use this when you have a workspace UUID and need the owner email/details to draft an email.',
        inputSchema: {
          type: 'object',
          properties: { workspaceUuid: { type: 'string', description: 'Taskip workspace UUID' } },
          required: ['workspaceUuid'],
        },
        handler: async (input) => {
          const { workspaceUuid } = input as { workspaceUuid: string };
          return this.taskipDb.lookupUserByWorkspace(workspaceUuid);
        },
      },
      {
        name: 'query_subscriptions',
        description: 'Get subscription history for a Taskip user',
        inputSchema: {
          type: 'object',
          properties: { userId: { type: 'string' } },
          required: ['userId'],
        },
        handler: async (input) => {
          const { userId } = input as { userId: string };
          return this.taskipDb.querySubscriptions(userId);
        },
      },
      {
        name: 'query_invoices',
        description: 'List invoices for a Taskip user',
        inputSchema: {
          type: 'object',
          properties: { userId: { type: 'string' } },
          required: ['userId'],
        },
        handler: async (input) => {
          const { userId } = input as { userId: string };
          return this.taskipDb.queryInvoices(userId);
        },
      },
      {
        name: 'summarize_user_history',
        description: 'LLM summary of a user journey — looks up user, subscriptions, and invoices',
        inputSchema: {
          type: 'object',
          properties: { emailOrId: { type: 'string' } },
          required: ['emailOrId'],
        },
        handler: async (input) => {
          const { emailOrId } = input as { emailOrId: string };
          const user = await this.taskipDb.lookupUser(emailOrId);
          if (!user) return { error: 'User not found' };
          const [subs, invoices] = await Promise.all([
            this.taskipDb.querySubscriptions(user.id),
            this.taskipDb.queryInvoices(user.id),
          ]);
          return { user, subscriptions: subs, invoices };
        },
      },
    ];
  }

  apiRoutes(): AgentApiRoute[] {
    return [
      {
        method: 'GET',
        path: '/taskip-internal/lookup',
        requiresAuth: true,
        handler: async (params) => {
          const { q } = params as { q?: string };
          if (!q) throw new Error('?q= required');
          return this.taskipDb.lookupUser(q);
        },
      },
      {
        method: 'GET',
        path: '/taskip-internal/insight/status',
        requiresAuth: true,
        handler: async (params) => {
          const { workspaceUuid } = params as { workspaceUuid?: string };
          return this.insight.status(workspaceUuid);
        },
      },
      {
        method: 'GET',
        path: '/taskip-internal/inbox',
        requiresAuth: true,
        handler: async (params) => {
          const { limit, purpose, workspaceUuid } = params as {
            limit?: string;
            purpose?: TaskipEmailPurpose;
            workspaceUuid?: string;
          };
          return this.emails.listSent({
            limit: limit ? parseInt(limit, 10) : undefined,
            purpose,
            workspaceUuid,
          });
        },
      },
      {
        method: 'GET',
        path: '/taskip-internal/inbox/:id',
        requiresAuth: true,
        handler: async (params) => {
          const { id } = params as { id: string };
          const detail = await this.emails.getDetail(id);
          if (!detail) throw new Error('Email not found');
          return detail;
        },
      },
      {
        method: 'POST',
        path: '/taskip-internal/inbox/:id/sync',
        requiresAuth: true,
        handler: async (params) => {
          const { id } = params as { id: string };
          return this.emails.syncReplies(id);
        },
      },

      // Suggestion sweep routes
      {
        method: 'GET',
        path: '/taskip-internal/suggestions',
        requiresAuth: true,
        handler: async (params) => {
          const { status } = params as { status?: string };
          const rows = await this.db.db
            .select()
            .from(taskipInternalSuggestions)
            .where(status && status !== 'all' ? eq(taskipInternalSuggestions.status, status) : undefined)
            .orderBy(desc(taskipInternalSuggestions.createdAt))
            .limit(100);

          const uuids = [...new Set(rows.map((r) => r.workspaceUuid))];
          const allActivity = uuids.length > 0
            ? await this.db.db
                .select()
                .from(taskipInternalWorkspaceActivity)
                .where(inArray(taskipInternalWorkspaceActivity.workspaceUuid, uuids))
                .orderBy(desc(taskipInternalWorkspaceActivity.createdAt))
            : [];

          const activityByUuid = new Map<string, typeof allActivity>();
          for (const a of allActivity) {
            const bucket = activityByUuid.get(a.workspaceUuid) ?? [];
            if (bucket.length < 3) {
              bucket.push(a);
              activityByUuid.set(a.workspaceUuid, bucket);
            }
          }

          return rows.map((row) => ({ ...row, recentActivity: activityByUuid.get(row.workspaceUuid) ?? [] }));
        },
      },
      {
        method: 'PATCH',
        path: '/taskip-internal/suggestions/:id',
        requiresAuth: true,
        handler: async (params) => {
          const { id, subject, bodyMd, ctaText, ctaUrl } = params as {
            id: string;
            subject?: string;
            bodyMd?: string;
            ctaText?: string;
            ctaUrl?: string;
          };
          const [row] = await this.db.db
            .select({ status: taskipInternalSuggestions.status })
            .from(taskipInternalSuggestions)
            .where(eq(taskipInternalSuggestions.id, id))
            .limit(1);
          if (!row) throw new Error('Suggestion not found');
          if (row.status !== 'pending') throw new Error('Only pending suggestions can be edited');

          const updates: Partial<typeof taskipInternalSuggestions.$inferInsert> = {};
          if (subject !== undefined) updates.subject = subject;
          if (bodyMd !== undefined) updates.bodyMd = bodyMd;
          if (ctaText !== undefined) updates.ctaText = ctaText;
          if (ctaUrl !== undefined) updates.ctaUrl = ctaUrl;

          const [updated] = await this.db.db
            .update(taskipInternalSuggestions)
            .set(updates)
            .where(eq(taskipInternalSuggestions.id, id))
            .returning();
          return updated;
        },
      },
      {
        method: 'POST',
        path: '/taskip-internal/suggestions/:id/approve',
        requiresAuth: true,
        handler: async (params) => {
          const { id } = params as { id: string };
          return this.approveSuggestion(id);
        },
      },
      {
        method: 'POST',
        path: '/taskip-internal/suggestions/:id/skip',
        requiresAuth: true,
        handler: async (params) => {
          const { id, reason } = params as { id: string; reason?: string };
          return this.skipSuggestion(id, reason);
        },
      },
      {
        method: 'POST',
        path: '/taskip-internal/suggestions/sweep',
        requiresAuth: true,
        handler: async () => {
          await this.suggestionSweepQueue.add('sweep', {}, { jobId: `manual-sweep-${Date.now()}` });
          return { queued: true };
        },
      },
      {
        method: 'GET',
        path: '/taskip-internal/workspace/:uuid/activity',
        requiresAuth: true,
        handler: async (params) => {
          const { uuid } = params as { uuid: string };
          return this.db.db
            .select()
            .from(taskipInternalWorkspaceActivity)
            .where(eq(taskipInternalWorkspaceActivity.workspaceUuid, uuid))
            .orderBy(desc(taskipInternalWorkspaceActivity.createdAt))
            .limit(100);
        },
      },
    ];
  }

  private async approveSuggestion(id: string): Promise<{ ok: boolean; channel: string }> {
    const [row] = await this.db.db
      .select()
      .from(taskipInternalSuggestions)
      .where(eq(taskipInternalSuggestions.id, id))
      .limit(1);
    if (!row) throw new Error('Suggestion not found');
    if (row.status !== 'pending') throw new Error(`Cannot approve suggestion with status: ${row.status}`);

    await this.db.db
      .update(taskipInternalSuggestions)
      .set({ status: 'approved', approvedAt: new Date() })
      .where(eq(taskipInternalSuggestions.id, id));

    try {
      if (row.channel === 'gmail') {
        const result = await this.emails.send({
          purpose: 'followup',
          recipient: row.ownerEmail,
          subject: row.subject,
          body: row.bodyMd,
          workspaceUuid: row.workspaceUuid,
          metadata: { suggestionId: id, cohort: row.cohort, scenarioKey: row.scenarioKey },
        });

        await this.db.db
          .update(taskipInternalSuggestions)
          .set({ status: 'sent', sentEmailId: result.id, sentAt: new Date() })
          .where(eq(taskipInternalSuggestions.id, id));

        await this.db.db.insert(taskipInternalWorkspaceActivity).values({
          workspaceUuid: row.workspaceUuid,
          activityType: 'email_sent',
          suggestionId: id,
          emailId: result.id,
          score: row.score,
          cohort: row.cohort,
        });
      } else {
        const result = await this.insight.submitMessage(row.workspaceUuid, {
          scenario_key: row.scenarioKey,
          channel: 'both',
          subject: row.subject,
          body_md: row.bodyMd,
          cta_text: row.ctaText ?? undefined,
          cta_url: row.ctaUrl ?? undefined,
        });

        const finalStatus = result.status === 'suppressed_cooldown' ? 'skipped' : 'sent';
        await this.db.db
          .update(taskipInternalSuggestions)
          .set({
            status: finalStatus,
            insightMessageId: result.id,
            sentAt: finalStatus === 'sent' ? new Date() : undefined,
            skippedAt: finalStatus === 'skipped' ? new Date() : undefined,
            failedReason: finalStatus === 'skipped' ? result.status : null,
          })
          .where(eq(taskipInternalSuggestions.id, id));

        await this.db.db.insert(taskipInternalWorkspaceActivity).values({
          workspaceUuid: row.workspaceUuid,
          activityType: 'insight_message_sent',
          suggestionId: id,
          score: row.score,
          cohort: row.cohort,
          notes: result.status,
        });
      }
    } catch (err) {
      const msg = (err as Error).message;
      await this.db.db
        .update(taskipInternalSuggestions)
        .set({ status: 'failed', failedReason: msg })
        .where(eq(taskipInternalSuggestions.id, id));
      throw err;
    }

    return { ok: true, channel: row.channel };
  }

  private async skipSuggestion(id: string, reason?: string): Promise<{ ok: boolean; suppressed: boolean }> {
    const [row] = await this.db.db
      .select()
      .from(taskipInternalSuggestions)
      .where(eq(taskipInternalSuggestions.id, id))
      .limit(1);
    if (!row) throw new Error('Suggestion not found');
    if (row.status !== 'pending') throw new Error(`Cannot skip suggestion with status: ${row.status}`);

    await this.db.db
      .update(taskipInternalSuggestions)
      .set({ status: 'skipped', skippedAt: new Date() })
      .where(eq(taskipInternalSuggestions.id, id));

    await this.db.db.insert(taskipInternalWorkspaceActivity).values({
      workspaceUuid: row.workspaceUuid,
      activityType: 'suggestion_skipped',
      suggestionId: id,
      score: row.score,
      cohort: row.cohort,
      notes: reason ?? null,
    });

    // check for 3-consecutive-skip suppression
    const recent = await this.db.db
      .select({ activityType: taskipInternalWorkspaceActivity.activityType })
      .from(taskipInternalWorkspaceActivity)
      .where(eq(taskipInternalWorkspaceActivity.workspaceUuid, row.workspaceUuid))
      .orderBy(desc(taskipInternalWorkspaceActivity.createdAt))
      .limit(3);

    const suppressed = recent.length === 3 && recent.every((r) => r.activityType === 'suggestion_skipped');
    if (suppressed) {
      await this.db.db.insert(taskipInternalWorkspaceActivity).values({
        workspaceUuid: row.workspaceUuid,
        activityType: 'sweep_ignored',
        score: row.score,
        cohort: row.cohort,
        notes: '3 consecutive skips',
      });
    }

    return { ok: true, suppressed };
  }

  private async executeReadTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    try {
      switch (name) {
        case 'lookup_user':
          return await this.taskipDb.lookupUser(args.emailOrId as string);
        case 'lookup_workspace_owner':
          return await this.taskipDb.lookupUserByWorkspace(args.workspaceUuid as string);
        case 'query_subscriptions':
          return await this.taskipDb.querySubscriptions(args.userId as string);
        case 'query_invoices':
          return await this.taskipDb.queryInvoices(args.userId as string);
        case 'summarize_user_history': {
          const user = await this.taskipDb.lookupUser(args.emailOrId as string);
          if (!user) return { error: 'User not found' };
          const [subs, invoices] = await Promise.all([
            this.taskipDb.querySubscriptions(user.id),
            this.taskipDb.queryInvoices(user.id),
          ]);
          return { user, subscriptions: subs, invoices };
        }
        case 'insight_list_cohort':
          return await this.insight.listCohort(args.cohort as InsightCohort, {
            perPage: args.per_page as number | undefined,
            cursor: args.cursor as string | undefined,
            minScore: args.min_score as number | undefined,
            updatedAfter: args.updated_after as string | undefined,
          });
        case 'insight_get_overview':
          return await this.insight.getOverview(args.workspace_uuid as string);
        case 'insight_recommended_actions':
          return await this.insight.getRecommendedActions(args.workspace_uuid as string);
        case 'list_sent_emails':
          return await this.emails.listSent({
            limit: args.limit as number | undefined,
            purpose: args.purpose as TaskipEmailPurpose | undefined,
            workspaceUuid: args.workspaceUuid as string | undefined,
          });
        case 'sync_email_replies':
          return await this.emails.syncReplies(args.emailId as string);
        case 'insight_get_lifecycle':
          return await this.insight.getLifecycle(args.workspace_uuid as string);
        case 'insight_pending_scenarios':
          return await this.insight.getPendingScenarios(args.workspace_uuid as string);
        case 'insight_recent_messages':
          return await this.insight.getRecentMessages(args.workspace_uuid as string);
        case 'insight_log_agent_action': {
          const { workspace_uuid, action_type, result, reason, payload } = args as {
            workspace_uuid: string;
            action_type: string;
            result: 'success' | 'failed' | 'skipped';
            reason?: string;
            payload: Record<string, unknown>;
          };
          return await this.insight.logAgentAction(workspace_uuid, {
            action_type,
            result,
            reason: reason ?? null,
            payload,
          });
        }
        case 'list_workspace_suggestions': {
          const { workspace_uuid, status } = args as { workspace_uuid: string; status?: string };
          return await this.db.db
            .select({
              id: taskipInternalSuggestions.id,
              status: taskipInternalSuggestions.status,
              cohort: taskipInternalSuggestions.cohort,
              scenarioKey: taskipInternalSuggestions.scenarioKey,
              subject: taskipInternalSuggestions.subject,
              channel: taskipInternalSuggestions.channel,
              createdAt: taskipInternalSuggestions.createdAt,
              sentAt: taskipInternalSuggestions.sentAt,
              skippedAt: taskipInternalSuggestions.skippedAt,
            })
            .from(taskipInternalSuggestions)
            .where(
              and(
                eq(taskipInternalSuggestions.workspaceUuid, workspace_uuid),
                status ? eq(taskipInternalSuggestions.status, status) : undefined,
              ),
            )
            .orderBy(desc(taskipInternalSuggestions.createdAt))
            .limit(10);
        }
        default:
          return { error: `Unknown tool: ${name}` };
      }
    } catch (err) {
      return { error: (err as Error).message };
    }
  }

  private buildToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: 'lookup_user',
        description: 'Find a Taskip user by email (partial match) or exact UUID',
        parameters: {
          type: 'object',
          properties: { emailOrId: { type: 'string', description: 'email address or user UUID' } },
          required: ['emailOrId'],
        },
      },
      {
        name: 'lookup_workspace_owner',
        description: 'Find the Taskip user who owns a workspace by workspace UUID. Use when you have a workspace UUID and need the owner email or details to draft a personalised email.',
        parameters: {
          type: 'object',
          properties: { workspaceUuid: { type: 'string', description: 'Taskip workspace UUID' } },
          required: ['workspaceUuid'],
        },
      },
      {
        name: 'query_subscriptions',
        description: 'Get subscription history for a user by their UUID',
        parameters: {
          type: 'object',
          properties: { userId: { type: 'string', description: 'user UUID' } },
          required: ['userId'],
        },
      },
      {
        name: 'query_invoices',
        description: 'List invoices for a user by their UUID',
        parameters: {
          type: 'object',
          properties: { userId: { type: 'string', description: 'user UUID' } },
          required: ['userId'],
        },
      },
      {
        name: 'summarize_user_history',
        description: 'Get a full picture of a user — profile, subscriptions, and invoices in one call',
        parameters: {
          type: 'object',
          properties: { emailOrId: { type: 'string' } },
          required: ['emailOrId'],
        },
      },
      {
        name: 'extend_trial',
        description: 'Extend a user\'s trial period. Requires approval before executing.',
        parameters: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'user UUID' },
            days: { type: 'number', description: 'number of days to extend (default 7)' },
          },
          required: ['userId'],
        },
      },
      {
        name: 'mark_refund',
        description: 'Mark an invoice as refund_requested. Requires approval before executing.',
        parameters: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'user UUID' },
            invoiceId: { type: 'string', description: 'invoice UUID' },
          },
          required: ['userId', 'invoiceId'],
        },
      },
      {
        name: 'insight_list_cohort',
        description: 'List workspaces in a lifecycle cohort. Use for Phase 1 segmentation. Returns minimal per-workspace data, paginated.',
        parameters: {
          type: 'object',
          properties: {
            cohort: {
              type: 'string',
              enum: [
                'serious_trial', 'looking_trial', 'ignore_trial',
                'healthy_paid', 'expanding_paid', 'at_risk_paid', 'dormant_paid',
                'trial_ready_free', 'nurture_free', 'ignore_free',
                'expired_trial_warm', 'expired_trial_cold', 'uncategorized',
              ],
            },
            per_page: { type: 'number', description: '1-500, default 100' },
            cursor: { type: 'string' },
            min_score: { type: 'number', description: '0-100, only return workspaces with score >= this' },
            updated_after: { type: 'string', description: 'ISO-8601, incremental sweep' },
          },
          required: ['cohort'],
        },
      },
      {
        name: 'insight_get_overview',
        description: 'Drill into a single workspace. Returns plan, cohort, score, signals, recent activities. Use after insight_list_cohort.',
        parameters: {
          type: 'object',
          properties: {
            workspace_uuid: { type: 'string', description: 'workspace UUID or url slug' },
          },
          required: ['workspace_uuid'],
        },
      },
      {
        name: 'insight_recommended_actions',
        description: 'Get pre-ranked rules-engine actions for a workspace. Pick actions[0] and render its prompt through the LLM.',
        parameters: {
          type: 'object',
          properties: {
            workspace_uuid: { type: 'string' },
          },
          required: ['workspace_uuid'],
        },
      },
      {
        name: 'insight_submit_marketing_suggestion',
        description: 'Propose a marketing task for a workspace. Lands in the central queue with status=pending. Requires approval before executing.',
        parameters: {
          type: 'object',
          properties: {
            workspace_uuid: { type: 'string' },
            template_key: { type: 'string', description: 'e.g. retention_outreach (must be a registered template)' },
            title: { type: 'string', description: '<=255 chars' },
            description: { type: 'string', description: '<=5000 chars, the rendered email/message body' },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
            channel: { type: 'string', enum: ['email', 'inapp', 'push'] },
            recommended_due_at: { type: 'string', description: 'ISO-8601, must be in the future' },
            idempotency_key: { type: 'string', description: 'Stable per logical attempt, e.g. SHA of {workspace_uuid}:{template_key}:{date}' },
            evidence: {
              type: 'array',
              items: {
                type: 'object',
                properties: { key: { type: 'string' }, value: { type: 'number' } },
                required: ['key', 'value'],
              },
            },
          },
          required: ['workspace_uuid', 'template_key', 'title', 'description', 'priority', 'channel', 'recommended_due_at'],
        },
      },
      {
        name: 'send_email',
        description: 'Send a Gmail email to a FREE or TRIAL cohort workspace owner. Tracked so replies can be matched. Requires approval before sending. DO NOT use for paid-plan workspaces — use insight_submit_message instead.',
        parameters: {
          type: 'object',
          properties: {
            purpose: { type: 'string', enum: ['marketing', 'followup', 'offer', 'other'] },
            recipient: { type: 'string', description: 'recipient email address' },
            subject: { type: 'string' },
            body: { type: 'string', description: 'Markdown-formatted email body. Keep under 120 words. Reference specific actions the user took (volume_metrics). One CTA only.' },
            workspaceUuid: { type: 'string', description: 'link this email to a Taskip workspace for dedup tracking' },
          },
          required: ['purpose', 'recipient', 'subject', 'body'],
        },
      },
      {
        name: 'list_sent_emails',
        description: 'List previously-sent emails tracked by this agent (newest first). Use to check whether a recipient already received outreach.',
        parameters: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'default 50, max 200' },
            purpose: { type: 'string', enum: ['marketing', 'followup', 'offer', 'other'] },
            workspaceUuid: { type: 'string' },
          },
        },
      },
      {
        name: 'sync_email_replies',
        description: 'Pull the Gmail thread for a tracked email and record any new replies. Returns the count of replies added.',
        parameters: {
          type: 'object',
          properties: { emailId: { type: 'string', description: 'tracked email id (from list_sent_emails)' } },
          required: ['emailId'],
        },
      },
      {
        name: 'insight_log_agent_action',
        description: 'Audit write-back. Call after deciding to act, skip, or escalate. Low risk — invoke freely.',
        parameters: {
          type: 'object',
          properties: {
            workspace_uuid: { type: 'string' },
            action_type: { type: 'string', description: '<=80 chars; e.g. marketing_suggestion_submitted, cohort_swept, skipped_low_confidence, escalated_to_human' },
            result: { type: 'string', enum: ['success', 'failed', 'skipped'] },
            reason: { type: 'string', description: '<=500 chars; required when result != success' },
            payload: { type: 'object' },
          },
          required: ['workspace_uuid', 'action_type', 'result', 'payload'],
        },
      },
      {
        name: 'insight_get_lifecycle',
        description: 'Read the full lifecycle snapshot (state, owner, score, signals, recent_messages) for a workspace. Use to compose personalized copy.',
        parameters: {
          type: 'object',
          properties: { workspace_uuid: { type: 'string' } },
          required: ['workspace_uuid'],
        },
      },
      {
        name: 'insight_pending_scenarios',
        description: 'Probe the lifecycle rules engine: which scenarios are eligible to fire RIGHT NOW for this workspace, and which are blocked (with reason).',
        parameters: {
          type: 'object',
          properties: { workspace_uuid: { type: 'string' } },
          required: ['workspace_uuid'],
        },
      },
      {
        name: 'insight_recent_messages',
        description: 'Last 50 AI message attempts for the workspace (sent, suppressed, rejected). Use to avoid repeating yourself.',
        parameters: {
          type: 'object',
          properties: { workspace_uuid: { type: 'string' } },
          required: ['workspace_uuid'],
        },
      },
      {
        name: 'list_workspace_suggestions',
        description: 'Check this agent\'s suggestion queue for a workspace. Call before proposing new outreach to avoid duplicates. Returns recent suggestions with status (pending/sent/skipped/suppressed).',
        parameters: {
          type: 'object',
          properties: {
            workspace_uuid: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'approved', 'sent', 'skipped', 'failed', 'suppressed'], description: 'filter by status; omit to return all' },
          },
          required: ['workspace_uuid'],
        },
      },
      {
        name: 'insight_submit_message',
        description: 'Submit a personalized lifecycle message for a PAID cohort workspace. Server validates against tone rules + scenario allow-list, logs the row, then delivers via in-app + email. Approval-gated. DO NOT use for free/trial workspaces — use send_email. cta_url must be on taskip.net or taskip.app. Email body <=120 words; in-app <=40.',
        parameters: {
          type: 'object',
          properties: {
            workspace_uuid: { type: 'string' },
            scenario_key: { type: 'string', description: 'MUST be a key from insight_pending_scenarios.eligible[].scenario_key — never guess or hardcode.' },
            channel: { type: 'string', enum: ['email', 'inapp', 'both'] },
            subject: { type: 'string', description: '<=255 chars; required when channel includes email' },
            body_md: { type: 'string', description: 'Markdown body. <=120 words for email, <=40 for in-app.' },
            cta_text: { type: 'string', description: '<=191 chars' },
            cta_url: { type: 'string', description: 'Must be on taskip.net or taskip.app' },
            force_send: { type: 'boolean', description: 'Bypass cooldown / manual review / idempotency. Use sparingly.' },
          },
          required: ['workspace_uuid', 'scenario_key', 'channel', 'body_md'],
        },
      },
    ];
  }

  private async getConfig(): Promise<TaskipInternalConfig> {
    const [row] = await this.db.db
      .select({ config: agents.config })
      .from(agents)
      .where(eq(agents.key, this.key));

    return (row?.config as TaskipInternalConfig) ?? this.defaultConfig();
  }

  private defaultConfig(): TaskipInternalConfig {
    return {};
  }
}
