import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { eq, desc, sql, and, ilike, or } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { DbService } from '../../../db/db.service';
import { agents } from '../../../db/schema';
import { kbProposals } from '../../knowledge-base/schema';
import { supportTickets, supportWebhookLogs, supportTicketEvents } from './schema';
import { AgentRegistryService } from '../runtime/agent-registry.service';
import { LlmRouterService } from '../../llm/llm-router.service';
import { TelegramService } from '../../telegram/telegram.service';
import { KnowledgeBaseService } from '../../knowledge-base/knowledge-base.service';
import { PurchaseVerifyService } from '../purchase-verify/purchase-verify.service';
import { SettingsService } from '../../settings/settings.service';
import { safeEqualString } from '../../../common/webhooks/verify';
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

interface SupportConfig {
  autoCloseCategories: string[];
  escalateKeywords: string[];
  maxTicketsPerRun: number;
  llm?: { provider?: string; model?: string };
}

interface SupportSnapshot {
  tickets: any[];
  config: SupportConfig;
}

const DEFAULT_CONFIG: SupportConfig = {
  autoCloseCategories: [],
  escalateKeywords: ['urgent', 'lawsuit', 'refund', 'legal', 'fraud'],
  maxTicketsPerRun: 20,
};

const PRIORITY_MAP: Record<number, string> = { 0: 'low', 1: 'medium', 2: 'high', 3: 'urgent', 4: 'urgent' };

const SYSTEM_PROMPT = `You are a support agent for Taskip/Xgenious. Given a support ticket:
1. Classify it: billing | technical | feature | general
2. Assign priority: low | medium | high | urgent
3. Draft a helpful, professional reply (2-4 sentences max).

Respond with valid JSON only:
{ "category": "...", "priority": "...", "reply": "..." }`;

const TRAIN_PROPOSE_SYSTEM = `You are a knowledge base curator for a support ticket AI agent.
An operator is training the agent by providing a ticket example and an instruction for how similar tickets should be handled in the future.

Your job: formulate a clear, reusable rule from the instruction so the support agent consistently applies it.

Category guidance:
- spam_filter: Write a detection + action rule. Pattern: "SPAM FILTER: If ticket [matches pattern], [action — e.g. close with brief reply or skip entirely]."
- decision_rule: Write a routing instruction. Pattern: "DECISION RULE: When ticket is about [topic], [action — escalate / skip / close / auto-reply with X]."
- faq: Write a Q&A fact. Pattern: "FAQ: [Generalized question] → [Complete accurate answer]."
- policy: Write a policy statement. Pattern: "POLICY: [Condition] → [Required action or response]."

The rule must be general enough to apply to similar future tickets, not just this specific one.

Return JSON only — no markdown:
{
  "title": "short descriptive title (max 8 words)",
  "content": "the rule, clearly worded for the AI to follow",
  "reasoning": "one sentence: what problem this solves"
}`;

const KB_IMPORT_SYSTEM = `You are a knowledge base curator for a software support team.
Given a resolved support ticket conversation, create ONE clean, reusable Q&A entry that will help the AI agent handle similar tickets in the future.

Rules:
- The question must be a generalized version of the customer's problem (not word-for-word from the ticket)
- The answer must be the complete, accurate resolution — synthesize it from the agent's replies, skip pleasantries
- Only include actionable content ("thank you", "please let us know" should be removed)
- If the ticket has multiple back-and-forth messages, distill the core Q&A from the full thread
- Choose the most accurate category: "technical", "faq", "policy", or "product"

Return JSON only — no markdown:
{
  "title": "short descriptive title (max 8 words)",
  "category": "technical" | "faq" | "policy" | "product",
  "content": "Q: [generalized question]\\nA: [complete resolution]",
  "reasoning": "one sentence: what this entry teaches the agent"
}`;

@Injectable()
export class SupportAgent implements IAgent, OnModuleInit {
  readonly key = 'support';
  readonly name = 'Support Ticket Manager';
  private readonly logger = new Logger(SupportAgent.name);

  constructor(
    private db: DbService,
    private llm: LlmRouterService,
    private telegram: TelegramService,
    private registry: AgentRegistryService,
    private kb: KnowledgeBaseService,
    private purchaseVerify: PurchaseVerifyService,
    private settings: SettingsService,
    private events: EventEmitter2,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  triggers(): TriggerSpec[] {
    return [
      { type: 'CRON', cron: '*/30 * * * *' },
      { type: 'WEBHOOK', webhookPath: '/support/ingest-ticket' },
    ];
  }

  async buildContext(trigger: TriggerEvent, run: RunContext): Promise<AgentContext> {
    const config = await this.getConfig();

    if (trigger.type === 'WEBHOOK') {
      const payload = trigger.payload as any;
      const crmTicketId = payload?.ticket?.id;
      if (crmTicketId != null) {
        const [row] = await this.db.db
          .select()
          .from(supportTickets)
          .where(eq(supportTickets.externalId, String(crmTicketId)));
        if (row) {
          return { source: trigger, snapshot: { tickets: [row], config }, followups: [] };
        }
      }
    }

    const openTickets = await this.db.db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.status, 'open'))
      .orderBy(supportTickets.createdAt)
      .limit(config.maxTicketsPerRun);

    return { source: trigger, snapshot: { tickets: openTickets, config }, followups: [] };
  }

  async decide(ctx: AgentContext): Promise<ProposedAction[]> {
    const { tickets, config } = ctx.snapshot as SupportSnapshot;
    if (!tickets.length) return [{ type: 'noop', summary: 'No open tickets.', payload: {}, riskLevel: 'low' }];

    const [alwaysOn, samples, blocklist, rejections] = await Promise.all([
      this.kb.getAlwaysOnContext(this.key),
      this.kb.getWritingSamples(this.key),
      this.kb.getBlocklistRules(this.key),
      this.kb.getRecentRejections(this.key, 3),
    ]);
    const template = await this.kb.getPromptTemplate(this.key);

    const actions: ProposedAction[] = [];

    for (const ticket of tickets) {
      try {
        const ticketText = `${ticket.subject ?? ''} ${ticket.body ?? ''}`;
        const purchaseCodes = PurchaseVerifyService.extractPurchaseCodes(ticket.body ?? '');
        let purchaseBlock = '';

        // --- Purchase code gate ---
        // Tickets that already have a final purchase status don't need a new code request
        const alreadyGated = ticket.purchaseCodeStatus === 'verified'
          || ticket.purchaseCodeStatus === 'invalid'
          || ticket.purchaseCodeStatus === 'expired';

        if (!alreadyGated && purchaseCodes.length === 0) {
          if (ticket.purchaseCodeStatus !== 'requested') {
            await this.writeTicketEvent({
              ticketId: ticket.id,
              externalId: ticket.externalId,
              eventType: 'purchase_code_not_found',
              summary: 'No purchase code in ticket — queued request_purchase_code action',
              payload: { subject: ticket.subject, userEmail: ticket.userEmail },
            });
            actions.push({
              type: 'request_purchase_code',
              summary: `Request purchase code: ${ticket.subject} from ${ticket.userEmail}`,
              payload: {
                ticketId: ticket.id,
                crmTicketId: ticket.externalId ? Number(ticket.externalId) : null,
                subject: ticket.subject,
                userEmail: ticket.userEmail,
                draft: `Thank you for reaching out. To verify your purchase and provide you with the best support, could you please share your purchase code? You can find it in your Envato purchase email. It looks like one of these formats:\n\nxxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx\nor\nXGENIOUS-XXXX-XXXX-XXXX-XXXX\n\nOnce verified, we will be happy to assist you.`,
              },
              riskLevel: 'low',
            });
            continue;
          }
          // Code was already requested — customer replied without providing it.
          // Fall through to LLM with a pending-code context block so it can address
          // the customer's reply and gently remind them.
          purchaseBlock = '\n\n--- Purchase Code Status ---\nPending — purchase code was requested but not yet provided by the customer. Address their reply normally, then politely remind them to share their purchase code before technical support can be provided.';
        }

        // --- Verify purchase code if we have one and haven't verified yet ---
        if (alreadyGated && ticket.purchaseCode && !purchaseBlock) {
          const statusLabel = ticket.purchaseCodeStatus === 'verified'
            ? 'Active — support is enabled. Proceed to help the customer.'
            : ticket.purchaseCodeStatus === 'expired'
            ? 'Expired — support period has ended. Direct them to renew via Envato.'
            : 'Invalid — code did not validate. Do not provide technical support.';
          purchaseBlock = `\n\n--- Purchase Status (cached) ---\nCode: ${ticket.purchaseCode}\nStatus: ${statusLabel}`;
        }
        if (purchaseCodes.length && !alreadyGated) {
          await this.writeTicketEvent({
            ticketId: ticket.id,
            externalId: ticket.externalId,
            eventType: 'purchase_code_found',
            summary: `Found ${purchaseCodes.length} code(s) — verifying first`,
            payload: { codes: purchaseCodes },
          });
          const verifyResult = await this.purchaseVerify.verify(purchaseCodes[0]);
          if (verifyResult) {
            purchaseBlock = PurchaseVerifyService.buildVerifyPromptBlock(verifyResult);
            await this.writeTicketEvent({
              ticketId: ticket.id,
              externalId: ticket.externalId,
              eventType: verifyResult.supportIsActive ? 'purchase_code_verified'
                : (verifyResult.action === 'reject_invalid_code' ? 'purchase_code_invalid' : 'purchase_code_expired'),
              summary: verifyResult.summary,
              payload: {
                action: verifyResult.action,
                supportIsActive: verifyResult.supportIsActive,
                supportDaysRemaining: verifyResult.supportDaysRemaining,
                buyerUsername: verifyResult.buyerUsername,
                licenseKey: verifyResult.licenseKey,
              },
            });
            await this.db.db
              .update(supportTickets)
              .set({
                purchaseCode: purchaseCodes[0],
                purchaseCodeStatus: verifyResult.supportIsActive ? 'verified'
                  : (verifyResult.action === 'reject_invalid_code' ? 'invalid' : 'expired'),
                updatedAt: new Date(),
              })
              .where(eq(supportTickets.id, ticket.id));
          }
        }

        // --- Server access gate ---
        const serverIssue = this.detectServerIssue(ticketText);
        if (serverIssue && ticket.purchaseCodeStatus === 'verified') {
          const creds = this.detectCredentials(ticket.body ?? '');
          if (!creds.hasAdmin) {
            const missing: string[] = [];
            if (!creds.hasUrl) missing.push('Website URL');
            missing.push('Admin panel URL and login credentials (username + password)');
            if (!creds.hasFtp) missing.push('FTP / cPanel access (host, username, password, port)');

            const credDraft = `Thank you for the details. To investigate this ${serverIssue} issue directly on your server, I need the following:\n\n${missing.map((m, i) => `${i + 1}. ${m}`).join('\n')}\n\nPlease share these details so I can look into it promptly.`;

            await this.writeTicketEvent({
              ticketId: ticket.id,
              externalId: ticket.externalId,
              eventType: 'server_access_not_found',
              summary: `${serverIssue} detected — missing credentials: ${missing.join(', ')}`,
              payload: { serverIssue, creds },
            });
            actions.push({
              type: 'request_server_access',
              summary: `Request server access: ${ticket.subject} from ${ticket.userEmail}`,
              payload: {
                ticketId: ticket.id,
                crmTicketId: ticket.externalId ? Number(ticket.externalId) : null,
                subject: ticket.subject,
                userEmail: ticket.userEmail,
                serverIssue,
                draft: credDraft,
              },
              riskLevel: 'low',
            });
            continue;
          }
        }

        const [references, previousTickets] = await Promise.all([
          this.kb.searchEntries(`${ticket.subject} ${ticket.body?.slice(0, 200) ?? ''}`, this.key, 5),
          this.getContactHistory(ticket.userEmail),
        ]);

        const threadHistory: { role: 'customer' | 'agent'; text: string }[] = ticket.body
          ? [{ role: 'customer', text: ticket.body.slice(0, 1500) }]
          : [];

        const kbBlock = this.kb.buildKbPromptBlock({
          voiceProfile: alwaysOn.find(e => e.entryType === 'voice_profile') ?? null,
          facts: alwaysOn.filter(e => e.entryType === 'fact'),
          catalog: alwaysOn.filter(e => e.entryType === 'product' || e.entryType === 'service' || e.entryType === 'offer'),
          references,
          positiveSamples: samples.filter(s => s.polarity === 'positive'),
          negativeSamples: samples.filter(s => s.polarity === 'negative'),
          rejections,
          threadHistory,
        });

        const contactMemory = previousTickets.length
          ? `\n\nPrevious tickets from this user:\n${previousTickets
              .map(t => `Subject: "${t.subject?.slice(0, 100)}" → You replied: "${t.lastDraft?.slice(0, 150)}"`)
              .join('\n')}`
          : '';

        const systemPrompt = (template?.system ?? SYSTEM_PROMPT) + kbBlock + contactMemory + purchaseBlock;

        const response = await this.llm.complete({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Subject: ${ticket.subject}\n\nBody: ${ticket.body}\n\nFrom: ${ticket.userEmail}` },
          ],
          ...agentLlmOpts(config),
          agentKey: this.key,
          maxTokens: 400,
        });

        let parsed: { category: string; priority: string; reply: string };
        try {
          const text = response.content.trim();
          const match = text.match(/\{[\s\S]*\}/);
          parsed = JSON.parse(match?.[0] ?? text);
        } catch {
          continue;
        }

        await this.writeTicketEvent({
          ticketId: ticket.id,
          externalId: ticket.externalId,
          eventType: 'reply_drafted',
          summary: `[${parsed.category}/${parsed.priority}] ${parsed.reply.slice(0, 120)}`,
          payload: { category: parsed.category, priority: parsed.priority, draft: parsed.reply },
        });

        parsed.reply = await this.selfCritique(
          parsed.reply,
          alwaysOn.find(e => e.entryType === 'voice_profile')?.content,
          blocklist,
        );
        const violation = blocklist.find(p => parsed.reply.toLowerCase().includes(p.toLowerCase()));

        const needsEscalation = config.escalateKeywords.some(
          (kw) => ticket.body?.toLowerCase().includes(kw),
        );

        const actionType = (needsEscalation || parsed.priority === 'urgent') ? 'escalate_to_owner' : 'post_reply';

        actions.push({
          type: actionType,
          summary: `${actionType === 'escalate_to_owner' ? 'Escalate' : 'Reply'}: [${parsed.priority}] ${ticket.subject} from ${ticket.userEmail}${violation ? ` - Blocklist: "${violation}"` : ''}`,
          payload: {
            ticketId: ticket.id,
            crmTicketId: ticket.externalId ? Number(ticket.externalId) : null,
            subject: ticket.subject,
            userEmail: ticket.userEmail,
            category: parsed.category,
            priority: parsed.priority,
            draft: parsed.reply,
          },
          riskLevel: violation ? 'high' : actionType === 'escalate_to_owner' ? 'high' : 'medium',
        });
      } catch (err) {
        this.logger.warn(`Failed to process ticket ${ticket.id}: ${err}`);
        await this.writeTicketEvent({
          ticketId: ticket.id,
          externalId: ticket.externalId,
          eventType: 'decide_error',
          summary: `Failed to process ticket: ${(err as Error).message}`,
          error: (err as Error).message,
        });
      }
    }

    return actions.length ? actions : [{ type: 'noop', summary: 'No actionable tickets.', payload: {}, riskLevel: 'low' }];
  }

  requiresApproval(action: ProposedAction): boolean {
    return action.type === 'post_reply' || action.type === 'escalate_to_owner' || action.type === 'request_purchase_code' || action.type === 'request_server_access';
  }

  async execute(action: ProposedAction): Promise<ActionResult> {
    if (action.type === 'noop') return { success: true };
    const p = action.payload as any;

    if (action.type === 'request_purchase_code') {
      if (p.ticketId) {
        await this.db.db
          .update(supportTickets)
          .set({ purchaseCodeStatus: 'requested', status: 'replied', repliedAt: new Date(), updatedAt: new Date() })
          .where(eq(supportTickets.id, p.ticketId));
      }
      if (p.crmTicketId) {
        await this.postCrmReply(p.crmTicketId, p.draft);
      }
      await this.writeTicketEvent({
        ticketId: p.ticketId,
        externalId: p.crmTicketId ? String(p.crmTicketId) : null,
        eventType: 'purchase_code_requested',
        summary: 'Sent purchase code request reply to CRM',
        payload: { draft: p.draft },
      });
      await this.telegram.sendMessage(
        `Purchase code requested: ${p.subject}\nFrom: ${p.userEmail}\n\nSent:\n${p.draft}`,
      );
      return { success: true, data: { ticketId: p.ticketId } };
    }

    if (action.type === 'request_server_access') {
      if (p.ticketId) {
        await this.db.db
          .update(supportTickets)
          .set({ status: 'replied', repliedAt: new Date(), updatedAt: new Date() })
          .where(eq(supportTickets.id, p.ticketId));
      }
      if (p.crmTicketId) {
        await this.postCrmReply(p.crmTicketId, p.draft);
      }
      await this.writeTicketEvent({
        ticketId: p.ticketId,
        externalId: p.crmTicketId ? String(p.crmTicketId) : null,
        eventType: 'server_access_requested',
        summary: `Server access requested (${p.serverIssue}) for ticket: ${p.subject}`,
        payload: { draft: p.draft, serverIssue: p.serverIssue },
      });
      await this.telegram.sendMessage(
        `Server access requested: ${p.subject}\nFrom: ${p.userEmail}\nIssue: ${p.serverIssue}\n\nSent:\n${p.draft}`,
      );
      return { success: true, data: { ticketId: p.ticketId } };
    }

    if (action.type === 'post_reply' || action.type === 'escalate_to_owner') {
      const now = new Date();
      const isReply = action.type === 'post_reply';

      if (p.ticketId) {
        await this.db.db
          .update(supportTickets)
          .set({
            category: p.category,
            priority: p.priority,
            lastDraft: p.draft,
            status: isReply ? 'replied' : 'escalated',
            repliedAt: isReply ? now : null,
            updatedAt: now,
          })
          .where(eq(supportTickets.id, p.ticketId));
      }

      if (isReply && p.crmTicketId) {
        await this.postCrmReply(p.crmTicketId, p.draft);
        await this.writeTicketEvent({
          ticketId: p.ticketId,
          externalId: p.crmTicketId ? String(p.crmTicketId) : null,
          eventType: 'reply_sent',
          summary: `Reply posted to CRM for ticket #${p.crmTicketId}`,
          payload: { draft: p.draft, category: p.category, priority: p.priority },
        });
      } else if (!isReply) {
        await this.writeTicketEvent({
          ticketId: p.ticketId,
          externalId: p.crmTicketId ? String(p.crmTicketId) : null,
          eventType: 'escalated',
          summary: 'Ticket escalated to owner',
          payload: { draft: p.draft, priority: p.priority },
        });
      }

      await this.telegram.sendMessage(
        `${isReply ? 'Replied' : 'Escalated'}: ${p.subject}\nFrom: ${p.userEmail}\n\nDraft:\n${p.draft}`,
      );
    }

    return { success: true, data: { ticketId: p.ticketId } };
  }

  mcpTools(): McpToolDefinition[] {
    return [
      {
        name: 'get_ticket',
        description: 'Fetch a local support ticket record by its internal ID',
        inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
        handler: async (input) => this.getTicket((input as any).id),
      },
      {
        name: 'search_similar_tickets',
        description: 'Full-text search for similar past tickets in the local database',
        inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number' } }, required: ['query'] },
        handler: async (input) => {
          const { query, limit = 5 } = input as any;
          return this.searchSimilar(query, limit);
        },
      },
      {
        name: 'ingest_ticket',
        description: 'Manually push a new ticket into the agent for processing',
        inputSchema: {
          type: 'object',
          properties: { subject: { type: 'string' }, body: { type: 'string' }, userEmail: { type: 'string' }, externalId: { type: 'string' } },
          required: ['subject', 'userEmail'],
        },
        handler: async (input) => this.ingestTicket(input as any),
      },
      {
        name: 'crm_get_ticket',
        description: 'Fetch the full ticket details (including description) from the CRM by its numeric ID',
        inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
        handler: async (input) => {
          const description = await this.fetchCrmTicket((input as any).id);
          return { id: (input as any).id, description };
        },
      },
      {
        name: 'crm_list_tickets',
        description: 'List open support tickets from the CRM public API',
        inputSchema: { type: 'object', properties: { page: { type: 'number' } } },
        handler: async (input) => this.crmListTickets((input as any).page ?? 1),
      },
      {
        name: 'crm_post_reply',
        description: 'Post a reply to a CRM ticket by its numeric ID. Use only after approval is confirmed.',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'number' }, message: { type: 'string' } },
          required: ['id', 'message'],
        },
        handler: async (input) => {
          await this.postCrmReply((input as any).id, (input as any).message);
          return { ok: true };
        },
      },
    ];
  }

  apiRoutes(): AgentApiRoute[] {
    return [
      {
        method: 'POST',
        path: '/support/ingest-ticket',
        requiresAuth: false,
        verifySignature: async (_rawBody, headers) => {
          const raw = await this.settings.getDecrypted('support_webhook_secret');
          const secret = raw?.trim() ?? '';
          if (!secret) {
            this.logger.warn('support_webhook_secret not configured in Settings — all webhook requests will be rejected');
            await this.writeWebhookLog({
              status: 'rejected',
              rawPayload: _rawBody.slice(0, 5000),
              responseBody: JSON.stringify({ ok: false, error: 'Invalid webhook signature', reason: 'secret_not_configured' }),
              error: 'secret_not_configured',
            });
            return { ok: false, reason: 'secret_not_configured' };
          }
          const sent = (headers['x-webhook-secret'] as string | undefined)?.trim() ?? '';
          if (!sent) {
            this.logger.warn('Webhook arrived without x-webhook-secret header');
            await this.writeWebhookLog({
              status: 'rejected',
              rawPayload: _rawBody.slice(0, 5000),
              responseBody: JSON.stringify({ ok: false, error: 'Invalid webhook signature', reason: 'missing_header' }),
              error: 'missing_header',
            });
            return { ok: false, reason: 'missing_header' };
          }
          this.logger.debug(`Webhook secret check: sent.length=${sent.length} stored.length=${secret.length}`);
          const ok = safeEqualString(sent, secret);
          if (!ok) {
            this.logger.warn('Webhook x-webhook-secret header did not match stored secret');
            await this.writeWebhookLog({
              status: 'rejected',
              rawPayload: _rawBody.slice(0, 5000),
              responseBody: JSON.stringify({ ok: false, error: 'Invalid webhook signature', reason: 'header_mismatch' }),
              error: 'header_mismatch',
            });
            return { ok: false, reason: 'header_mismatch' };
          }
          return true;
        },
        handler: async (body) => this.ingestWebhook(body as any),
      },
      {
        method: 'GET',
        path: '/support/tickets',
        requiresAuth: true,
        handler: async (query) => this.listTickets(query as any),
      },
      {
        method: 'GET',
        path: '/support/tickets/:id',
        requiresAuth: true,
        handler: async (params) => this.getTicket((params as any).id),
      },
      {
        method: 'GET',
        path: '/support/webhook-logs',
        requiresAuth: true,
        handler: async (query) => this.listWebhookLogs((query as any)?.limit),
      },
      {
        method: 'POST',
        path: '/support/webhook-test',
        requiresAuth: true,
        handler: async (body) => {
          this.logger.log(`webhook-test invoked — payload keys: ${Object.keys(body ?? {}).join(', ')}`);
          return this.ingestWebhook(body);
        },
      },
      {
        method: 'GET',
        path: '/support/tickets/:id/events',
        requiresAuth: true,
        handler: async (params) => this.listTicketEvents((params as any).id),
      },
      {
        method: 'POST',
        path: '/support/tickets/:id/draft',
        requiresAuth: true,
        handler: async (params) => this.generateDraftForTicket((params as any).id),
      },
      {
        method: 'DELETE',
        path: '/support/tickets/:id',
        requiresAuth: true,
        handler: async (params) => this.deleteTicket((params as any).id),
      },
      {
        method: 'POST',
        path: '/support/kb-import',
        requiresAuth: true,
        handler: async (body) => {
          const crmTicketId = Number((body as any)?.crmTicketId);
          if (!crmTicketId || isNaN(crmTicketId)) throw new Error('crmTicketId is required');
          return this.importTicketToKb(crmTicketId);
        },
      },
      {
        method: 'POST',
        path: '/support/tickets/:id/train',
        requiresAuth: true,
        handler: async (params) => {
          const { id, category, instruction } = params as any;
          if (!instruction?.trim()) throw new Error('instruction is required');
          const validCategories = ['spam_filter', 'decision_rule', 'faq', 'policy'];
          if (!validCategories.includes(category)) throw new Error('invalid category');
          return this.trainFromTicket(id, category, instruction.trim());
        },
      },
      {
        method: 'POST',
        path: '/support/tickets/:id/priority',
        requiresAuth: true,
        handler: async (params) => {
          const { id, priority } = params as any;
          const p = Number(priority);
          if (isNaN(p) || p < 0 || p > 4) throw new Error('priority must be 0–4 (0=Low,1=Normal,2=Medium,3=High,4=Urgent)');
          const [ticket] = await this.db.db.select().from(supportTickets).where(eq(supportTickets.id, id));
          if (!ticket) throw new Error('Ticket not found');
          if (!ticket.crmUuid) throw new Error('Ticket has no CRM UUID — webhook may need to re-deliver it');
          await this.updateCrmPriority(ticket.crmUuid, p);
          const priorityLabel = ['low', 'normal', 'medium', 'high', 'urgent'][p];
          await this.db.db.update(supportTickets).set({ priority: priorityLabel, updatedAt: new Date() }).where(eq(supportTickets.id, id));
          await this.writeTicketEvent({ ticketId: id, externalId: ticket.externalId, eventType: 'priority_updated', summary: `Priority set to ${priorityLabel} (${p}) via CRM API` });
          return { ok: true, priority: priorityLabel };
        },
      },
      {
        method: 'POST',
        path: '/support/tickets/:id/status',
        requiresAuth: true,
        handler: async (params) => {
          const { id, status, notes } = params as any;
          const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
          if (!validStatuses.includes(status)) throw new Error(`status must be one of: ${validStatuses.join(', ')}`);
          const [ticket] = await this.db.db.select().from(supportTickets).where(eq(supportTickets.id, id));
          if (!ticket) throw new Error('Ticket not found');
          const crmId = ticket.externalId ? Number(ticket.externalId) : null;
          if (!crmId) throw new Error('Ticket has no CRM ID');
          await this.updateCrmStatus(crmId, status, notes?.trim() || undefined);
          const localStatus = status === 'resolved' || status === 'closed' ? 'closed' : 'open';
          await this.db.db.update(supportTickets).set({ status: localStatus, updatedAt: new Date() }).where(eq(supportTickets.id, id));
          await this.writeTicketEvent({ ticketId: id, externalId: ticket.externalId, eventType: 'status_updated', summary: `Status set to ${status} via CRM API`, payload: notes ? { notes } : undefined });
          return { ok: true, status };
        },
      },
      {
        method: 'POST',
        path: '/support/tickets/:id/note',
        requiresAuth: true,
        handler: async (params) => {
          const { id, note } = params as any;
          if (!note?.trim()) throw new Error('note is required');
          const [ticket] = await this.db.db.select().from(supportTickets).where(eq(supportTickets.id, id));
          if (!ticket) throw new Error('Ticket not found');
          if (!ticket.crmUuid) throw new Error('Ticket has no CRM UUID — webhook may need to re-deliver it');
          await this.addCrmNote(ticket.crmUuid, note.trim());
          await this.writeTicketEvent({ ticketId: id, externalId: ticket.externalId, eventType: 'note_added', summary: `Internal note added: ${note.trim().slice(0, 100)}`, payload: { note: note.trim() } });
          return { ok: true };
        },
      },
      {
        method: 'POST',
        path: '/support/tickets/:id/send-reply',
        requiresAuth: true,
        handler: async (params) => {
          const { id } = params as any;
          const [ticket] = await this.db.db.select().from(supportTickets).where(eq(supportTickets.id, id));
          if (!ticket) throw new Error('Ticket not found');
          if (!ticket.lastDraft?.trim()) throw new Error('No draft to send — generate a draft first');
          const crmId = ticket.externalId ? Number(ticket.externalId) : null;
          if (!crmId || isNaN(crmId)) throw new Error('Ticket has no CRM ID — cannot post reply');
          await this.postCrmReply(crmId, ticket.lastDraft);
          await this.db.db.update(supportTickets).set({ status: 'replied', updatedAt: new Date() }).where(eq(supportTickets.id, id));
          await this.writeTicketEvent({ ticketId: id, externalId: ticket.externalId, eventType: 'reply_sent', summary: `Reply sent via dashboard: ${ticket.lastDraft.slice(0, 120)}`, payload: { draft: ticket.lastDraft } });
          return { ok: true };
        },
      },
    ];
  }

  async ingestTicket(ticket: { subject: string; body?: string; userEmail: string; externalId?: string }) {
    const [row] = await this.db.db
      .insert(supportTickets)
      .values({
        externalId: ticket.externalId ?? null,
        subject: ticket.subject,
        body: ticket.body ?? null,
        userEmail: ticket.userEmail,
      })
      .onConflictDoNothing()
      .returning();
    return row;
  }

  private async deleteTicket(id: string): Promise<{ ok: boolean }> {
    await this.db.db.delete(supportTicketEvents).where(eq(supportTicketEvents.ticketId, id));
    await this.db.db.delete(supportTickets).where(eq(supportTickets.id, id));
    return { ok: true };
  }

  private async trainFromTicket(id: string, category: string, instruction: string): Promise<{ proposalId: string }> {
    const [ticket] = await this.db.db.select().from(supportTickets).where(eq(supportTickets.id, id));
    if (!ticket) throw new Error('Ticket not found');

    const userContent = [
      `Ticket subject: "${ticket.subject}"`,
      ticket.body ? `Ticket body (excerpt): "${ticket.body.slice(0, 400)}"` : null,
      `Training category: ${category}`,
      `Operator instruction: "${instruction}"`,
    ].filter(Boolean).join('\n\n');

    const response = await this.llm.complete({
      messages: [
        { role: 'system', content: TRAIN_PROPOSE_SYSTEM },
        { role: 'user', content: userContent },
      ],
      provider: 'auto',
      model: 'gpt-4o-mini',
      maxTokens: 400,
      temperature: 0.2,
    });

    const raw = response.content.trim();
    const match = raw.match(/\{[\s\S]*\}/);
    const proposal: { title: string; content: string; reasoning: string } = JSON.parse(match?.[0] ?? raw);
    if (!proposal.title || !proposal.content) throw new Error('LLM returned incomplete proposal');

    const categoryMap: Record<string, string> = { spam_filter: 'spam_rule', decision_rule: 'decision_rule', faq: 'faq', policy: 'policy' };
    const priorityMap: Record<string, number> = { spam_filter: 90, decision_rule: 85, policy: 75, faq: 70 };

    const [row] = await this.db.db
      .insert(kbProposals)
      .values({
        agentKey: this.key,
        proposedEntryType: 'fact',
        title: proposal.title,
        content: proposal.content,
        polarity: null,
        reasoning: proposal.reasoning ?? '',
        category: categoryMap[category] ?? 'general',
        sourceType: 'training',
      })
      .returning();

    const labelMap: Record<string, string> = { spam_filter: 'Spam Filter', decision_rule: 'Decision Rule', faq: 'FAQ', policy: 'Policy' };
    const text = [
      `*Agent Training Proposal*`,
      `Agent: *${this.name}* (\`${this.key}\`)`,
      ``,
      `Type: *${labelMap[category] ?? category}*`,
      `From ticket: _"${ticket.subject.slice(0, 100)}"_`,
      ``,
      `Rule: *${proposal.title}*`,
      `_${proposal.content.slice(0, 300)}_`,
      ``,
      `Why: ${proposal.reasoning}`,
      ``,
      `Add this to the Knowledge Base?`,
    ].join('\n');

    this.events.emit('telegram.kb_proposal', { proposalId: row.id, text });
    this.logger.log(`Training proposal created: ${row.id} agent=${this.key} category=${category}`);
    return { proposalId: row.id };
  }

  private async writeTicketEvent(entry: {
    ticketId?: string | null;
    externalId?: string | null;
    eventType: string;
    summary?: string;
    payload?: Record<string, unknown>;
    error?: string;
  }) {
    await this.db.db.insert(supportTicketEvents).values({
      ticketId: entry.ticketId ?? null,
      externalId: entry.externalId ?? null,
      eventType: entry.eventType,
      summary: entry.summary ?? null,
      payload: entry.payload ?? null,
      error: entry.error ?? null,
    }).catch((err: unknown) => {
      this.logger.warn(`writeTicketEvent failed: ${(err as Error).message} | type=${entry.eventType}`);
    });
  }

  private async writeWebhookLog(entry: {
    status: string;
    externalId?: string | null;
    ticketId?: string | null;
    rawPayload?: string | null;
    responseBody?: string | null;
    error?: string | null;
  }) {
    await this.db.db.insert(supportWebhookLogs).values({
      status: entry.status,
      externalId: entry.externalId ?? null,
      ticketId: entry.ticketId ?? null,
      rawPayload: entry.rawPayload ?? null,
      responseBody: entry.responseBody ?? null,
      error: entry.error ?? null,
    }).catch((dbErr: unknown) => {
      this.logger.error(`writeWebhookLog failed: ${(dbErr as Error).message} | status=${entry.status} externalId=${entry.externalId ?? 'none'}`);
    });
  }

  /** Normalize the CRM webhook payload into a flat { ticket, contact } shape.
   *
   * Supported formats:
   *   1. Flat:            { ticket: { id, subject }, contact: { email } }
   *   2. Nested (old):    { event, data: { ticket: { "Modules\\...": { id, subject, created_by } } } }
   *   3. Nested (actual): { event, data: { "Modules\\...": { id, subject, created_by } } }
   */
  private normalizeCrmPayload(payload: any): { ticket: any; contact: any; event: string | null; replyData: any } {
    const event: string | null = payload?.event ?? null;
    const dataObj = payload?.data;

    if (dataObj && typeof dataObj === 'object') {
      let ticketCandidate: any = null;

      // Format 4: data IS the ticket directly — flat object with id + subject at top level
      // e.g. data: { id: 1, subject: "...", priority: "medium", uuid: "...", ... }
      if (dataObj.id != null && dataObj.subject) {
        ticketCandidate = dataObj;
      }

      // Format 3: transformer class is a direct key of data (actual CRM payload)
      // e.g. data["Modules\\SupportTicket\\Transformers\\SupportTicketResource"] = { id, subject, ... }
      if (!ticketCandidate) {
        const firstVal = Object.values(dataObj)[0];
        if (firstVal && typeof firstVal === 'object' && (firstVal as any).id != null) {
          ticketCandidate = firstVal;
        }
      }

      // Format 2: transformer class is nested under data.ticket
      // e.g. data.ticket["Modules\\..."] = { id, subject, ... }
      if (!ticketCandidate && dataObj.ticket && typeof dataObj.ticket === 'object') {
        ticketCandidate = Object.values(dataObj.ticket)[0];
      }

      if (ticketCandidate?.id != null && ticketCandidate?.subject) {
        const contact = {
          email: ticketCandidate?.created_by?.email ?? ticketCandidate?.user?.email ?? '',
          name: ticketCandidate?.created_by?.full_name ?? ticketCandidate?.created_by?.first_name ?? '',
        };
        return { ticket: ticketCandidate, contact, event, replyData: dataObj?.reply ?? ticketCandidate?.reply ?? null };
      }
    }

    // Format 1: flat legacy format
    return { ticket: payload?.ticket ?? null, contact: payload?.contact ?? null, event, replyData: null };
  }

  private async ingestWebhook(payload: any): Promise<Record<string, unknown>> {
    this.logger.log(`ingestWebhook called — event: "${payload?.event ?? 'none'}" | payload keys: ${Object.keys(payload ?? {}).join(', ')}`);
    const rawPayload = JSON.stringify(payload).slice(0, 5000);
    const { ticket, contact, event, replyData } = this.normalizeCrmPayload(payload);

    if (!ticket?.id || !ticket?.subject) {
      // Attempt to recover by extracting a ticket ID from the payload and fetching from CRM
      const recoveredId = this.extractTicketIdFromPayload(payload);
      if (recoveredId) {
        this.logger.log(`ingestWebhook: normalization failed but found ticket id=${recoveredId} — fetching from CRM`);
        try {
          const recovered = await this.fetchCrmTicketFull(recoveredId);
          if (recovered?.id && recovered?.subject) {
            this.logger.log(`ingestWebhook: CRM fetch recovered ticket #${recovered.id} "${recovered.subject}"`);
            // Re-enter ingest with the recovered ticket merged into the payload
            return this.ingestWebhook({
              ...payload,
              ticket: recovered,
              contact: {
                email: recovered.created_by?.email ?? recovered.user?.email ?? '',
                name: recovered.created_by?.full_name ?? recovered.created_by?.first_name ?? '',
              },
            });
          }
        } catch (err) {
          this.logger.warn(`ingestWebhook: CRM fetch fallback failed for id=${recoveredId}: ${err}`);
        }
      }
      const errMsg = `Missing ticket.id or ticket.subject after normalization (event="${event ?? 'none'}")`;
      this.logger.warn(`ingestWebhook: ${errMsg} — raw keys: ${Object.keys(payload ?? {}).join(', ')}`);
      const errorResp = { ok: false, error: errMsg };
      await this.writeWebhookLog({ status: 'error', rawPayload, responseBody: JSON.stringify(errorResp), error: errMsg });
      return errorResp;
    }

    // For reply events triggered by our own agent — update ticket to 'replied' and stop
    const ticketData = payload?.data?.ticket;
    const isAgentReply = event === 'support.ticket.replied' && (
      payload?.replied_by?.type === 'agent' ||
      payload?.data?.replied_by?.type === 'agent' ||
      payload?.data?.user?.type === 'agent' ||
      payload?.data?.reply?.user?.type === 'agent' ||
      replyData?.user?.type === 'agent' ||
      // CRM format: data.ticket.user = replier, data.ticket.created_by = customer
      // If they differ, the reply was posted by a support agent, not the customer
      (ticketData?.user?.id != null && ticketData?.created_by?.id != null &&
        ticketData.user.id !== ticketData.created_by.id)
    );
    if (isAgentReply) {
      this.logger.log(`ingestWebhook: agent reply event for ticket #${ticket.id} — marking replied`);
      const [existing] = await this.db.db
        .select({ id: supportTickets.id })
        .from(supportTickets)
        .where(eq(supportTickets.externalId, String(ticket.id)));
      if (existing) {
        await this.db.db
          .update(supportTickets)
          .set({ status: 'replied', repliedAt: new Date(), updatedAt: new Date() })
          .where(eq(supportTickets.id, existing.id));
        await this.writeTicketEvent({
          ticketId: existing.id,
          externalId: String(ticket.id),
          eventType: 'agent_reply_received',
          summary: 'Agent reply recorded — no further action taken',
        });
      }
      const skippedResp = { ok: true, status: 'acknowledged', reason: 'agent_reply' };
      await this.writeWebhookLog({ status: 'skipped_agent_reply', externalId: String(ticket.id), ticketId: existing?.id ?? null, rawPayload, responseBody: JSON.stringify(skippedResp) });
      return skippedResp;
    }

    this.logger.log(`Webhook received: ticket #${ticket.id} "${ticket.subject}" from ${contact?.email ?? '(no contact)'}`);

    const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
    const priority =
      (typeof ticket.priority === 'string' && VALID_PRIORITIES.includes(ticket.priority))
        ? ticket.priority
        : (PRIORITY_MAP[ticket.priority as number] ?? 'medium');

    let body = this.stripHtml(await this.fetchCrmTicket(ticket.id));

    if (body) {
      this.logger.log(`CRM fetch OK for ticket #${ticket.id} (${body.length} chars)`);
    } else {
      const rawDesc: string = ticket.description ?? ticket.message ?? '';
      body = this.stripHtml(rawDesc);
      if (body) {
        this.logger.log(`Using webhook description field for ticket #${ticket.id} (${body.length} chars)`);
      } else {
        this.logger.warn(`No body available for ticket #${ticket.id} — proceeding with subject only`);
      }
    }

    // Customer reply — re-open any existing ticket for re-processing (skip purchase code gate)
    if (event === 'support.ticket.replied') {
      const [existing] = await this.db.db
        .select({ id: supportTickets.id, status: supportTickets.status, purchaseCodeStatus: supportTickets.purchaseCodeStatus })
        .from(supportTickets)
        .where(eq(supportTickets.externalId, String(ticket.id)));

      if (existing) {
        await this.db.db
          .update(supportTickets)
          .set({ status: 'open', body: body || undefined, updatedAt: new Date() })
          .where(eq(supportTickets.id, existing.id));
        this.logger.log(`Ticket #${ticket.id} reopened after customer reply (prev status: ${existing.status})`);
        const reopenedResp = { ok: true, status: 'reopened', ticketId: existing.id, externalId: String(ticket.id) };
        await this.writeWebhookLog({ status: 'reopened', externalId: String(ticket.id), ticketId: existing.id, rawPayload, responseBody: JSON.stringify(reopenedResp) });
        await this.writeTicketEvent({
          ticketId: existing.id,
          externalId: String(ticket.id),
          eventType: 'customer_reply_received',
          summary: `Customer replied — ticket reopened (purchaseCodeStatus was: ${existing.purchaseCodeStatus ?? 'none'})`,
          payload: { prevStatus: existing.status, prevPurchaseCodeStatus: existing.purchaseCodeStatus },
        });
        return reopenedResp;
      }
    }

    const [row] = await this.db.db
      .insert(supportTickets)
      .values({
        externalId: String(ticket.id),
        crmUuid: ticket.uuid ?? null,
        ticketNo: ticket.ticket_no ?? null,
        subject: ticket.subject,
        body: body || null,
        userEmail: contact?.email ?? '',
        contactName: contact?.name ?? null,
        contactPhone: contact?.phone ?? null,
        priority,
      })
      .onConflictDoNothing()
      .returning();

    const status = row ? 'stored' : 'duplicate';
    if (row) {
      this.logger.log(`Ticket stored: internal id=${row.id} external=${ticket.id} priority=${priority}`);
    } else {
      this.logger.warn(`Ticket #${ticket.id} already exists (onConflictDoNothing) — skipped`);
    }

    const finalResp = { ok: true, status, ticketId: row?.id ?? null, externalId: String(ticket.id) };
    await this.writeWebhookLog({
      status,
      externalId: String(ticket.id),
      ticketId: row?.id ?? null,
      rawPayload,
      responseBody: JSON.stringify(finalResp),
    });

    return finalResp;
  }

  async listWebhookLogs(limit?: number) {
    return this.db.db
      .select()
      .from(supportWebhookLogs)
      .orderBy(desc(supportWebhookLogs.receivedAt))
      .limit(Math.min(Number(limit ?? 100), 500))
      .catch((err: unknown) => {
        this.logger.error(`listWebhookLogs query failed: ${(err as Error).message}`);
        return [];
      });
  }

  private async crmHeaders(): Promise<Record<string, string>> {
    const key = await this.settings.getDecrypted('support_crm_api_key');
    return { 'X-Secret-Key': key ?? '', 'Content-Type': 'application/json', Accept: 'application/json' };
  }

  private async importTicketToKb(crmTicketId: number): Promise<{ ok: boolean; title?: string; entryId?: string; error?: string }> {
    const baseUrl = await this.settings.getDecrypted('support_crm_base_url');
    if (!baseUrl) return { ok: false, error: 'support_crm_base_url not configured' };
    const headers = await this.crmHeaders();

    const ticketRes = await fetch(`${baseUrl.replace(/\/$/, '')}/api/public-v1/support-ticket/${crmTicketId}`, {
      headers,
      signal: AbortSignal.timeout(10000),
    });
    if (!ticketRes.ok) return { ok: false, error: `CRM ticket fetch failed: HTTP ${ticketRes.status}` };

    const ticketData = (await ticketRes.json() as any)?.data;
    if (!ticketData?.subject) return { ok: false, error: 'Ticket not found or missing subject' };

    const subject = ticketData.subject as string;
    const description = this.stripHtml(ticketData.description ?? ticketData.message ?? '');

    // Try to fetch reply thread
    let replies: { role: 'customer' | 'agent'; text: string }[] = [];
    try {
      const replyRes = await fetch(`${baseUrl.replace(/\/$/, '')}/api/public-v1/support-ticket/${crmTicketId}/replies`, {
        headers,
        signal: AbortSignal.timeout(8000),
      });
      if (replyRes.ok) {
        const replyData = (await replyRes.json() as any)?.data ?? [];
        const replyArray = Array.isArray(replyData) ? replyData : Object.values(replyData);
        replies = replyArray.map((r: any) => ({
          role: (r?.user?.type === 'agent' ? 'agent' : 'customer') as 'agent' | 'customer',
          text: this.stripHtml(r?.message ?? r?.description ?? '').slice(0, 600),
        })).filter(r => r.text.length > 10);
      }
    } catch {
      // replies endpoint may not exist — continue with description only
    }

    if (!description && replies.length === 0) {
      return { ok: false, error: 'No conversation content found for this ticket' };
    }

    const agentReplies = replies.filter(r => r.role === 'agent');
    if (agentReplies.length === 0 && !description) {
      return { ok: false, error: 'No agent replies found — ticket may not be resolved yet' };
    }

    const conversationLines = [
      `Subject: ${subject}`,
      description ? `Customer: ${description.slice(0, 800)}` : null,
      ...replies.map(r => `${r.role === 'agent' ? 'Agent' : 'Customer'}: ${r.text}`),
    ].filter(Boolean).join('\n\n');

    const response = await this.llm.complete({
      messages: [
        { role: 'system', content: KB_IMPORT_SYSTEM },
        { role: 'user', content: conversationLines },
      ],
      provider: 'auto',
      model: 'gpt-4o-mini',
      maxTokens: 600,
      temperature: 0.2,
    });

    const raw = response.content.trim();
    const match = raw.match(/\{[\s\S]*\}/);
    const proposal: { title: string; category: string; content: string; reasoning: string } = JSON.parse(match?.[0] ?? raw);
    if (!proposal.title || !proposal.content) return { ok: false, error: 'LLM returned incomplete entry' };

    const entry = await this.kb.createEntry({
      title: proposal.title,
      content: proposal.content,
      category: proposal.category ?? 'faq',
      entryType: 'reference',
      priority: 70,
      agentKeys: this.key,
      sourceType: 'crm_import',
      sourceUrl: `${baseUrl.replace(/\/$/, '')}/support-ticket/${crmTicketId}`,
    });

    this.logger.log(`KB import from CRM ticket #${crmTicketId}: "${proposal.title}" (${entry.id})`);
    return { ok: true, title: proposal.title, entryId: entry.id };
  }

  private detectServerIssue(text: string): string | null {
    if (/\b(500|internal server error|white screen|wsod|fatal error|php error|parse error|database error|db error|connection refused|server down|blank page|blank screen)\b/i.test(text)) {
      return '500/server error';
    }
    if (/\b(license\s*(error|invalid|expired|fail|not found)|activation\s*(fail|error|invalid)|invalid\s*(license|key)|license\s*key\s*(wrong|incorrect))\b/i.test(text)) {
      return 'license error';
    }
    if (/\b(404|page not found|file not found|missing\s*file|resource not found)\b/i.test(text)) {
      return '404 error';
    }
    return null;
  }

  private detectCredentials(text: string): { hasUrl: boolean; hasAdmin: boolean; hasFtp: boolean } {
    const hasUrl = /https?:\/\/[^\s]+/i.test(text);
    const hasAdmin = (
      /\b(username|user|login)\s*[:=]\s*\S+/i.test(text) &&
      /\b(password|pass|pwd)\s*[:=]\s*\S+/i.test(text)
    );
    const hasFtp = /\b(ftp|ssh|sftp|cpanel|plesk|whm)\b/i.test(text) && (
      /\b(host|server|ip|address)\s*[:=]\s*\S+/i.test(text) ||
      /\b(user|username|login)\s*[:=]\s*\S+/i.test(text)
    );
    return { hasUrl, hasAdmin, hasFtp };
  }

  private stripHtml(html: string): string {
    if (!html?.trim()) return '';
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractTicketIdFromPayload(payload: any): number | null {
    if (!payload) return null;
    const candidates = [
      payload?.ticket?.id,
      payload?.data?.ticket_id,
      payload?.data?.id,
      payload?.ticket_id,
      payload?.id,
    ];
    for (const c of candidates) {
      const n = Number(c);
      if (!isNaN(n) && n > 0) return n;
    }
    // Check any nested object keys for numeric ticket IDs
    const dataObj = payload?.data;
    if (dataObj && typeof dataObj === 'object') {
      const firstVal = Object.values(dataObj)[0];
      if (firstVal && typeof firstVal === 'object') {
        const n = Number((firstVal as any).id);
        if (!isNaN(n) && n > 0) return n;
      }
    }
    return null;
  }

  private async fetchCrmTicketFull(id: number): Promise<any | null> {
    try {
      const baseUrl = await this.settings.getDecrypted('support_crm_base_url');
      if (!baseUrl) return null;
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/public-v1/support-ticket/${id}`, {
        headers: await this.crmHeaders(),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;
      const data = await res.json() as any;
      return data?.data ?? null;
    } catch (err) {
      this.logger.warn(`fetchCrmTicketFull(${id}) failed: ${err}`);
      return null;
    }
  }

  private async fetchCrmTicket(id: number): Promise<string> {
    try {
      const baseUrl = await this.settings.getDecrypted('support_crm_base_url');
      if (!baseUrl) return '';
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/public-v1/support-ticket/${id}`, {
        headers: await this.crmHeaders(),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return '';
      const data = await res.json() as any;
      return (data?.data?.description as string | undefined) ?? '';
    } catch (err) {
      this.logger.warn(`fetchCrmTicket(${id}) failed: ${err}`);
      return '';
    }
  }

  private async crmListTickets(page = 1): Promise<unknown> {
    try {
      const baseUrl = await this.settings.getDecrypted('support_crm_base_url');
      if (!baseUrl) return { error: 'support_crm_base_url not configured' };
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/public-v1/support-ticket?page=${page}`, {
        headers: await this.crmHeaders(),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return { error: `HTTP ${res.status}` };
      return res.json();
    } catch (err) {
      return { error: String(err) };
    }
  }

  private async postCrmReply(crmTicketId: number, message: string): Promise<void> {
    try {
      const baseUrl = await this.settings.getDecrypted('support_crm_base_url');
      if (!baseUrl) {
        this.logger.warn('support_crm_base_url not configured — skipping CRM reply');
        return;
      }
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/public-v1/support-ticket/reply/${crmTicketId}`, {
        method: 'POST',
        headers: await this.crmHeaders(),
        body: JSON.stringify({ description: message }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        this.logger.log(`CRM reply posted for ticket #${crmTicketId}`);
      } else {
        const body = await res.text().catch(() => '');
        this.logger.warn(`postCrmReply(${crmTicketId}) failed: HTTP ${res.status} — ${body}`);
      }
    } catch (err) {
      this.logger.warn(`postCrmReply(${crmTicketId}) error: ${err}`);
    }
  }

  private async updateCrmPriority(crmUuid: string, priority: number): Promise<void> {
    try {
      const baseUrl = await this.settings.getDecrypted('support_crm_base_url');
      if (!baseUrl) { this.logger.warn('support_crm_base_url not configured — skipping priority update'); return; }
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/public-v1/support-ticket/${crmUuid}/priority`, {
        method: 'POST',
        headers: await this.crmHeaders(),
        body: JSON.stringify({ priority }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        this.logger.log(`CRM priority updated: uuid=${crmUuid} priority=${priority}`);
      } else {
        const body = await res.text().catch(() => '');
        this.logger.warn(`updateCrmPriority(${crmUuid}) failed: HTTP ${res.status} — ${body}`);
      }
    } catch (err) {
      this.logger.warn(`updateCrmPriority(${crmUuid}) error: ${err}`);
    }
  }

  private async updateCrmStatus(crmTicketId: number, status: string, resolutionNotes?: string): Promise<void> {
    try {
      const baseUrl = await this.settings.getDecrypted('support_crm_base_url');
      if (!baseUrl) { this.logger.warn('support_crm_base_url not configured — skipping status update'); return; }
      const body: Record<string, unknown> = { status };
      if (resolutionNotes) body.resolution_notes = resolutionNotes;
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/public-v1/ticket/${crmTicketId}/status-update`, {
        method: 'POST',
        headers: await this.crmHeaders(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        this.logger.log(`CRM status updated: id=${crmTicketId} status=${status}`);
      } else {
        const respBody = await res.text().catch(() => '');
        this.logger.warn(`updateCrmStatus(${crmTicketId}) failed: HTTP ${res.status} — ${respBody}`);
      }
    } catch (err) {
      this.logger.warn(`updateCrmStatus(${crmTicketId}) error: ${err}`);
    }
  }

  private async addCrmNote(crmUuid: string, note: string): Promise<void> {
    try {
      const baseUrl = await this.settings.getDecrypted('support_crm_base_url');
      if (!baseUrl) { this.logger.warn('support_crm_base_url not configured — skipping note'); return; }
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/public-v1/support-ticket/${crmUuid}/note-store`, {
        method: 'POST',
        headers: await this.crmHeaders(),
        body: JSON.stringify({ message: note }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        this.logger.log(`CRM note added: uuid=${crmUuid}`);
      } else {
        const body = await res.text().catch(() => '');
        this.logger.warn(`addCrmNote(${crmUuid}) failed: HTTP ${res.status} — ${body}`);
      }
    } catch (err) {
      this.logger.warn(`addCrmNote(${crmUuid}) error: ${err}`);
    }
  }

  async listTickets(query: { status?: string; q?: string; limit?: string; offset?: string }) {
    const limit = Math.min(Number(query.limit ?? 50), 200);
    const offset = Number(query.offset ?? 0);
    const filters: ReturnType<typeof eq>[] = [];
    if (query.status) filters.push(eq(supportTickets.status, query.status));
    if (query.q) {
      const like = `%${query.q}%`;
      filters.push(
        or(
          ilike(supportTickets.subject, like),
          ilike(supportTickets.userEmail, like),
          ilike(supportTickets.contactName, like),
          ilike(supportTickets.ticketNo, like),
        ) as ReturnType<typeof eq>,
      );
    }
    const rows = await this.db.db
      .select()
      .from(supportTickets)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(supportTickets.createdAt))
      .limit(limit)
      .offset(offset);
    return { data: rows, limit, offset };
  }

  async getTicket(id: string) {
    const [ticket] = await this.db.db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.id, id));
    return ticket;
  }

  async searchSimilar(query: string, limit = 5) {
    return this.db.db
      .select()
      .from(supportTickets)
      .where(
        sql`to_tsvector('english', coalesce(${supportTickets.subject}, '') || ' ' || coalesce(${supportTickets.body}, '')) @@ plainto_tsquery('english', ${query})`,
      )
      .orderBy(desc(supportTickets.createdAt))
      .limit(limit);
  }

  private async getContactHistory(userEmail: string) {
    if (!userEmail) return [];
    try {
      return this.db.db
        .select({ subject: supportTickets.subject, lastDraft: supportTickets.lastDraft })
        .from(supportTickets)
        .where(and(eq(supportTickets.userEmail, userEmail), eq(supportTickets.status, 'replied')))
        .orderBy(desc(supportTickets.updatedAt))
        .limit(2);
    } catch {
      return [];
    }
  }

  private async selfCritique(draft: string, voiceProfile?: string, blocklist?: string[]): Promise<string> {
    try {
      const critique = await this.llm.complete({
        messages: [
          {
            role: 'system',
            content: `You are a strict editor. Review this support reply draft.
Voice: ${voiceProfile ?? 'professional, helpful, concise'}
Avoid: ${blocklist?.join(', ') || 'none specified'}
If the draft is good, return: {"ok":true}
If not, rewrite and return: {"ok":false,"revised":"improved reply here"}`,
          },
          { role: 'user', content: `Draft: "${draft}"` },
        ],
        agentKey: this.key,
        maxTokens: 300,
      });
      const result = JSON.parse(critique.content);
      if (!result.ok && result.revised) return result.revised.trim();
    } catch {
      // fail-open: use original draft
    }
    return draft;
  }

  async generateDraftForTicket(ticketId: string): Promise<{ draft: string; category: string; priority: string } | { error: string }> {
    const [ticket] = await this.db.db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.id, ticketId));
    if (!ticket) return { error: 'Ticket not found' };

    const config = await this.getConfig();
    const [alwaysOn, samples, blocklist, rejections] = await Promise.all([
      this.kb.getAlwaysOnContext(this.key),
      this.kb.getWritingSamples(this.key),
      this.kb.getBlocklistRules(this.key),
      this.kb.getRecentRejections(this.key, 3),
    ]);
    const template = await this.kb.getPromptTemplate(this.key);
    const references = await this.kb.searchEntries(`${ticket.subject} ${ticket.body?.slice(0, 200) ?? ''}`, this.key, 5);
    const previousTickets = await this.getContactHistory(ticket.userEmail);

    const threadHistory: { role: 'customer' | 'agent'; text: string }[] = ticket.body
      ? [{ role: 'customer', text: ticket.body.slice(0, 1500) }]
      : [];

    const kbBlock = this.kb.buildKbPromptBlock({
      voiceProfile: alwaysOn.find(e => e.entryType === 'voice_profile') ?? null,
      facts: alwaysOn.filter(e => e.entryType === 'fact'),
      catalog: alwaysOn.filter(e => e.entryType === 'product' || e.entryType === 'service' || e.entryType === 'offer'),
      references,
      positiveSamples: samples.filter(s => s.polarity === 'positive'),
      negativeSamples: samples.filter(s => s.polarity === 'negative'),
      rejections,
      threadHistory,
    });

    const contactMemory = previousTickets.length
      ? `\n\nPrevious tickets from this user:\n${previousTickets
          .map(t => `Subject: "${t.subject?.slice(0, 100)}" → You replied: "${t.lastDraft?.slice(0, 150)}"`)
          .join('\n')}`
      : '';

    const systemPrompt = (template?.system ?? SYSTEM_PROMPT) + kbBlock + contactMemory;

    try {
      const response = await this.llm.complete({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Subject: ${ticket.subject}\n\nBody: ${ticket.body}\n\nFrom: ${ticket.userEmail}` },
        ],
        ...agentLlmOpts(config),
        agentKey: this.key,
        maxTokens: 400,
      });

      const text = response.content.trim();
      const match = text.match(/\{[\s\S]*\}/);
      const parsed: { category: string; priority: string; reply: string } = JSON.parse(match?.[0] ?? text);

      parsed.reply = await this.selfCritique(
        parsed.reply,
        alwaysOn.find(e => e.entryType === 'voice_profile')?.content,
        blocklist,
      );

      await this.db.db
        .update(supportTickets)
        .set({ lastDraft: parsed.reply, category: parsed.category, priority: parsed.priority, updatedAt: new Date() })
        .where(eq(supportTickets.id, ticketId));

      await this.writeTicketEvent({
        ticketId: ticket.id,
        externalId: ticket.externalId,
        eventType: 'manual_draft',
        summary: `Manual draft generated: ${parsed.reply.slice(0, 120)}`,
        payload: { category: parsed.category, priority: parsed.priority, draft: parsed.reply },
      });

      return { draft: parsed.reply, category: parsed.category, priority: parsed.priority };
    } catch (err) {
      return { error: (err as Error).message };
    }
  }

  async listTicketEvents(ticketId: string) {
    return this.db.db
      .select()
      .from(supportTicketEvents)
      .where(eq(supportTicketEvents.ticketId, ticketId))
      .orderBy(desc(supportTicketEvents.createdAt))
      .limit(100)
      .catch(() => []);
  }

  private async getConfig(): Promise<SupportConfig> {
    const [row] = await this.db.db.select().from(agents).where(eq(agents.key, this.key));
    return { ...DEFAULT_CONFIG, ...(row?.config as Partial<SupportConfig> ?? {}) };
  }
}
