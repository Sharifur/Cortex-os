import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { eq, desc, sql, and } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { agents } from '../../../db/schema';
import { supportTickets } from './schema';
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

        let purchaseBlock = '';
        const ticketText = `${ticket.subject ?? ''} ${ticket.body ?? ''}`;
        const purchaseCodes = PurchaseVerifyService.extractPurchaseCodes(ticketText);
        if (purchaseCodes.length && PurchaseVerifyService.hasSupportIntent(ticketText)) {
          const verifyResult = await this.purchaseVerify.verify(purchaseCodes[0]);
          if (verifyResult) purchaseBlock = PurchaseVerifyService.buildVerifyPromptBlock(verifyResult);
        }

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

        // Self-critique + blocklist check
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
      }
    }

    return actions.length ? actions : [{ type: 'noop', summary: 'No actionable tickets.', payload: {}, riskLevel: 'low' }];
  }

  requiresApproval(action: ProposedAction): boolean {
    return action.type === 'post_reply' || action.type === 'escalate_to_owner';
  }

  async execute(action: ProposedAction): Promise<ActionResult> {
    if (action.type === 'noop') return { success: true };
    const p = action.payload as any;

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
          const secret = await this.settings.getDecrypted('support_webhook_secret');
          if (!secret) return false;
          const sent = (headers['x-webhook-secret'] as string | undefined)?.trim() ?? '';
          return safeEqualString(sent, secret);
        },
        handler: async (body) => this.ingestWebhook(body as any),
      },
      {
        method: 'GET',
        path: '/support/tickets/:id',
        requiresAuth: true,
        handler: async (params) => this.getTicket((params as any).id),
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

  private async ingestWebhook(payload: any) {
    const { ticket, contact } = payload ?? {};
    if (!ticket?.id || !ticket?.subject) {
      return { ok: false, error: 'Missing ticket.id or ticket.subject' };
    }

    const priority = PRIORITY_MAP[ticket.priority as number] ?? 'medium';
    const body = await this.fetchCrmTicket(ticket.id);

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

    return { ok: true, id: row?.id ?? null };
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
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.warn(`postCrmReply(${crmTicketId}) failed: HTTP ${res.status} — ${body}`);
      }
    } catch (err) {
      this.logger.warn(`postCrmReply(${crmTicketId}) error: ${err}`);
    }
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

  private async getConfig(): Promise<SupportConfig> {
    const [row] = await this.db.db.select().from(agents).where(eq(agents.key, this.key));
    return { ...DEFAULT_CONFIG, ...(row?.config as Partial<SupportConfig> ?? {}) };
  }
}
