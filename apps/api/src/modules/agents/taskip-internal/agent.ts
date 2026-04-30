import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { agents, taskipInternalOps } from '../../../db/schema';
import { AgentRegistryService } from '../runtime/agent-registry.service';
import { LlmRouterService } from '../../llm/llm-router.service';
import { TelegramService } from '../../telegram/telegram.service';
import { TaskipInternalDbService } from './taskip-internal-db.service';
import { TaskipInsightService, type InsightCohort, type InsightMarketingSuggestion, type InsightSubmitMessage } from './taskip-insight.service';
import { TaskipInternalEmailService, type TaskipEmailPurpose } from './taskip-internal-email.service';
import { KillSwitchService, type KillSwitchAction } from '../../safety/kill-switch.service';
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
}

const SYSTEM_PROMPT = `You are an internal ops assistant for Sharifur Rahman, founder of Taskip.

You can:
1. Look up users, subscriptions, and invoices from the Taskip database (lookup_user / query_subscriptions / query_invoices / summarize_user_history).
2. Use the Insight API to segment and drill into workspaces:
   - insight_list_cohort: pull a paginated workspace list for a lifecycle cohort. The full enum is now: serious_trial, looking_trial, ignore_trial, healthy_paid, expanding_paid, at_risk_paid, dormant_paid, trial_ready_free, nurture_free, ignore_free, expired_trial_warm, expired_trial_cold, uncategorized.
   - insight_get_overview: pull the full Insight payload for one workspace. Beyond plan/cohort/score/signals/recent_activities the response includes:
       * score_type — trial_readiness (free, TRS), activation (trial, THS), customer_health (paid, CHS), or *_frozen for expired_trial / churned.
       * activation_event_hit, score_delta_14d, previous_cohort, cohort_assigned_at, last_seen_at — use for outreach framing.
       * volume_metrics — invoices_total, invoices_paid, contacts_total, leads_total, projects_total, tasks_total, support_tickets_total, service_orders_total. Ground outreach in real business activity (e.g. "you've created 12 invoices but none are paid yet").
       * session — last_active_at, last_session_duration_seconds, is_active_now, stats_aggregated_at.
       * signals — for paid CHS includes the new business_traction weight (paid invoices, contacts >= 5, leads > 0). High engagement but zero transactional volume = "busy but not transactional"; flag it.
       * THS alt-activation: a trial with invoices_total > 0 OR leads_total > 0 OR contacts_total >= 3 counts as activated even if the configured event-stream activation didn't fire.
   - insight_recommended_actions: get a pre-ranked list of suggested actions for a workspace.
   - insight_log_agent_action: append an audit row after you decide to act, skip, or escalate (low risk, log freely).

   Lifecycle messaging (Section 21 — server delivers via email + in-app once the agent submits):
   - insight_get_lifecycle: lifecycle snapshot (state, owner, score, recent_messages). Use to compose personalized copy.
   - insight_pending_scenarios: rules-engine probe — which scenarios are eligible to fire right now and which are blocked. Pick from eligible[].scenario_key and respect spec.allowed_vars.
   - insight_recent_messages: last 50 message attempts for the workspace. Read this to avoid repeating yourself.
   - insight_submit_message: submit one personalized message; server validates + delivers + logs. Approval-gated.

   Tone rules (server-enforced; honor them in drafts): reference user actions (what they did), not behavior frequency or what they didn't do; one CTA, named clearly; no countdown timers or emotional exclamation marks; cta_url must be on taskip.net or taskip.app; ≤120 words for email, ≤40 for in-app.
3. Propose write actions for human approval:
   - extend_trial / mark_refund (Taskip DB)
   - insight_submit_marketing_suggestion (Insight marketing-suggestions queue)
   - send_email (Gmail outbound — marketing, follow-up, or offer)
4. Track sent emails and replies via list_sent_emails / sync_email_replies (read-only).

Recommended workflow when asked to "find at-risk customers" or similar:
  Phase 1 — call insight_list_cohort to segment.
  Phase 2 — for the top candidates, call insight_get_overview and insight_recommended_actions.
  Phase 3 — when proposing outreach, call insight_submit_marketing_suggestion with the LLM-rendered prompt.
  Phase 4 — call insight_log_agent_action to record what you did.

Always look up the user before attempting a write operation. Be concise — final answer is sent to Telegram.`;

const MAX_TOOL_ITERATIONS = 8;

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
    private killSwitch: KillSwitchService,
    private registry: AgentRegistryService,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  triggers(): TriggerSpec[] {
    return [{ type: 'MANUAL' }];
  }

  async buildContext(trigger: TriggerEvent, run: RunContext): Promise<AgentContext> {
    const config = await this.getConfig();
    const payload = run.triggerPayload as { query?: string } | null;
    const query = payload?.query ?? 'No query provided';

    return {
      source: trigger,
      snapshot: { query, config } satisfies TaskipInternalSnapshot,
      followups: (run.context as AgentContext | null)?.followups ?? [],
    };
  }

  async decide(ctx: AgentContext): Promise<ProposedAction[]> {
    const { query, config } = ctx.snapshot as TaskipInternalSnapshot;
    const followupNote = ctx.followups.at(-1)?.text;

    const effectiveQuery = followupNote
      ? `${query}\n\nAdditional instruction: ${followupNote}`
      : query;

    const tools = this.buildToolDefinitions();
    const messages: LlmToolMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: effectiveQuery },
    ];

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const result = await this.llm.completeWithTools({
        ...agentLlmOpts(config),
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
    ];
  }

  private async executeReadTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    try {
      switch (name) {
        case 'lookup_user':
          return await this.taskipDb.lookupUser(args.emailOrId as string);
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
          required: ['workspace_uuid', 'template_key', 'title', 'description', 'priority', 'channel', 'recommended_due_at', 'idempotency_key'],
        },
      },
      {
        name: 'send_email',
        description: 'Send a Gmail email (marketing, follow-up, or offer). Tracked in the agent inbox so replies can be matched. Requires approval before sending.',
        parameters: {
          type: 'object',
          properties: {
            purpose: { type: 'string', enum: ['marketing', 'followup', 'offer', 'other'] },
            recipient: { type: 'string', description: 'recipient email address' },
            subject: { type: 'string' },
            body: { type: 'string', description: 'plain text body' },
            workspaceUuid: { type: 'string', description: 'optional — link this email to a Taskip workspace' },
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
        name: 'insight_submit_message',
        description: 'Submit a personalized lifecycle message. Server validates against tone rules + scenario allow-list, logs the row, then delivers via in-app + email. Approval-gated. cta_url must be on taskip.net or taskip.app. Email body <=120 words; in-app <=40.',
        parameters: {
          type: 'object',
          properties: {
            workspace_uuid: { type: 'string' },
            scenario_key: { type: 'string', description: 'Must match a scenario in the rules engine, e.g. celebrate_activation, rescue_stalled, invite_to_trial.' },
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
