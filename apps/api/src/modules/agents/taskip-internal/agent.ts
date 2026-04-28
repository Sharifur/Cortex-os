import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { agents, taskipInternalOps } from '../../../db/schema';
import { AgentRegistryService } from '../runtime/agent-registry.service';
import { LlmRouterService } from '../../llm/llm-router.service';
import { TelegramService } from '../../telegram/telegram.service';
import { TaskipInternalDbService } from './taskip-internal-db.service';
import { TaskipInsightService, type InsightCohort, type InsightMarketingSuggestion } from './taskip-insight.service';
import { TaskipInternalEmailService, type TaskipEmailPurpose } from './taskip-internal-email.service';
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

interface TaskipInternalConfig {
  llm: { provider: string; model: string };
}

interface TaskipInternalSnapshot {
  query: string;
  config: TaskipInternalConfig;
}

const SYSTEM_PROMPT = `You are an internal ops assistant for Sharifur Rahman, founder of Taskip.

You can:
1. Look up users, subscriptions, and invoices from the Taskip database (lookup_user / query_subscriptions / query_invoices / summarize_user_history).
2. Use the Insight API to segment and drill into workspaces:
   - insight_list_cohort: pull a paginated workspace list for a lifecycle cohort (serious_trial, looking_trial, ignore_trial, healthy_paid, expanding_paid, at_risk_paid, dormant_paid).
   - insight_get_overview: pull the full Insight payload for one workspace (plan, cohort, score, signals, recent activities).
   - insight_recommended_actions: get a pre-ranked list of suggested actions for a workspace.
   - insight_log_agent_action: append an audit row after you decide to act, skip, or escalate (low risk, log freely).
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
        provider: config.llm.provider as 'openai' | 'deepseek' | 'auto',
        model: config.llm.model,
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
      || action.type === 'send_email';
  }

  async execute(action: ProposedAction): Promise<ActionResult> {
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
              enum: ['serious_trial', 'looking_trial', 'ignore_trial', 'healthy_paid', 'expanding_paid', 'at_risk_paid', 'dormant_paid'],
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
    return { llm: { provider: 'openai', model: 'gpt-4o' } };
  }
}
