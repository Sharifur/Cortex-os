import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { eq, desc, sql, and, ilike, or } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { DbService } from '../../../db/db.service';
import { agents } from '../../../db/schema';
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
        const purchaseCodes = PurchaseVerifyService.extractPurchaseCodes(ticketText);

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
          }
          continue;
        }

        // --- Verify purchase code if we have one and haven't verified yet ---
        let purchaseBlock = '';
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
    return action.type === 'post_reply' || action.type === 'escalate_to_owner' || action.type === 'request_purchase_code';
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
            await this.writeWebhookLog({ status: 'rejected', rawPayload: _rawBody.slice(0, 5000), error: 'secret_not_configured' });
            return { ok: false, reason: 'secret_not_configured' };
          }
          const sent = (headers['x-webhook-secret'] as string | undefined)?.trim() ?? '';
          if (!sent) {
            this.logger.warn('Webhook arrived without x-webhook-secret header');
            await this.writeWebhookLog({ status: 'rejected', rawPayload: _rawBody.slice(0, 5000), error: 'missing_header' });
            return { ok: false, reason: 'missing_header' };
          }
          this.logger.debug(`Webhook secret check: sent.length=${sent.length} stored.length=${secret.length}`);
          const ok = safeEqualString(sent, secret);
          if (!ok) {
            this.logger.warn('Webhook x-webhook-secret header did not match stored secret');
            await this.writeWebhookLog({ status: 'rejected', rawPayload: _rawBody.slice(0, 5000), error: 'header_mismatch' });
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
    error?: string | null;
  }) {
    await this.db.db.insert(supportWebhookLogs).values({
      status: entry.status,
      externalId: entry.externalId ?? null,
      ticketId: entry.ticketId ?? null,
      rawPayload: entry.rawPayload ?? null,
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

  private async ingestWebhook(payload: any) {
    this.logger.log(`ingestWebhook called — event: "${payload?.event ?? 'none'}" | payload keys: ${Object.keys(payload ?? {}).join(', ')}`);
    const rawPayload = JSON.stringify(payload).slice(0, 5000);
    const { ticket, contact, event, replyData } = this.normalizeCrmPayload(payload);

    if (!ticket?.id || !ticket?.subject) {
      const errMsg = `Missing ticket.id or ticket.subject after normalization (event="${event ?? 'none'}")`;
      this.logger.warn(`ingestWebhook: ${errMsg} — raw keys: ${Object.keys(payload ?? {}).join(', ')}`);
      await this.writeWebhookLog({ status: 'error', rawPayload, error: errMsg });
      return { ok: false, error: errMsg };
    }

    // For reply events triggered by our own agent, just log and skip — avoid feedback loops
    if (event === 'support.ticket.replied' && payload?.data?.replied_by?.type === 'agent') {
      this.logger.log(`ingestWebhook: skipping agent-replied event for ticket #${ticket.id}`);
      await this.writeWebhookLog({ status: 'skipped_agent_reply', externalId: String(ticket.id), rawPayload });
      return { ok: true, status: 'skipped', reason: 'agent_reply' };
    }

    this.logger.log(`Webhook received: ticket #${ticket.id} "${ticket.subject}" from ${contact?.email ?? '(no contact)'}`);

    const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
    const priority =
      (typeof ticket.priority === 'string' && VALID_PRIORITIES.includes(ticket.priority))
        ? ticket.priority
        : (PRIORITY_MAP[ticket.priority as number] ?? 'medium');

    let body = await this.fetchCrmTicket(ticket.id);

    if (body) {
      this.logger.log(`CRM fetch OK for ticket #${ticket.id} (${body.length} chars)`);
    } else {
      const rawDesc: string = ticket.description ?? ticket.message ?? '';
      body = rawDesc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (body) {
        this.logger.log(`Using webhook description field for ticket #${ticket.id} (${body.length} chars)`);
      } else {
        this.logger.warn(`No body available for ticket #${ticket.id} — proceeding with subject only`);
      }
    }

    // Customer reply on a ticket that's awaiting a purchase code — re-open for re-processing
    if (event === 'support.ticket.replied') {
      const [existing] = await this.db.db
        .select({ id: supportTickets.id, purchaseCodeStatus: supportTickets.purchaseCodeStatus })
        .from(supportTickets)
        .where(eq(supportTickets.externalId, String(ticket.id)));

      if (existing?.purchaseCodeStatus === 'requested') {
        await this.db.db
          .update(supportTickets)
          .set({ status: 'open', body: body || undefined, updatedAt: new Date() })
          .where(eq(supportTickets.id, existing.id));
        this.logger.log(`Ticket #${ticket.id} reopened after customer reply — will re-check for purchase code`);
        await this.writeWebhookLog({ status: 'reopened', externalId: String(ticket.id), ticketId: existing.id, rawPayload });
        await this.writeTicketEvent({
          ticketId: existing.id,
          externalId: String(ticket.id),
          eventType: 'ticket_reopened',
          summary: 'Customer replied — ticket reopened for purchase code re-check',
        });
        return { ok: true, status: 'reopened', ticketId: existing.id, externalId: String(ticket.id) };
      }
    }

    const [row] = await this.db.db
      .insert(supportTickets)
      .values({
        externalId: String(ticket.id),
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

    await this.writeWebhookLog({
      status,
      externalId: String(ticket.id),
      ticketId: row?.id ?? null,
      rawPayload,
    });

    return { ok: true, status, ticketId: row?.id ?? null, externalId: String(ticket.id) };
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
