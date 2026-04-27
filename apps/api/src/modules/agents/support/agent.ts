import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { eq, desc, sql, and } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { agents } from '../../../db/schema';
import { supportTickets } from './schema';
import { AgentRegistryService } from '../runtime/agent-registry.service';
import { LlmRouterService } from '../../llm/llm-router.service';
import { TelegramService } from '../../telegram/telegram.service';
import { KnowledgeBaseService } from '../../knowledge-base/knowledge-base.service';
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

interface SupportConfig {
  autoCloseCategories: string[];
  escalateKeywords: string[];
  maxTicketsPerRun: number;
  llm: { provider: string; model: string };
}

interface SupportSnapshot {
  tickets: any[];
  config: SupportConfig;
}

const DEFAULT_CONFIG: SupportConfig = {
  autoCloseCategories: [],
  escalateKeywords: ['urgent', 'lawsuit', 'refund', 'legal', 'fraud'],
  maxTicketsPerRun: 20,
  llm: { provider: 'auto', model: 'gpt-4o-mini' },
};

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

    if (trigger.type === 'WEBHOOK' && (trigger.payload as any)?.ticket) {
      const ticket = (trigger.payload as any).ticket;
      return { source: trigger, snapshot: { tickets: [ticket], config }, followups: [] };
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

        const kbBlock = this.kb.buildKbPromptBlock({
          voiceProfile: alwaysOn.find(e => e.entryType === 'voice_profile') ?? null,
          facts: alwaysOn.filter(e => e.entryType === 'fact'),
          references,
          positiveSamples: samples.filter(s => s.polarity === 'positive'),
          negativeSamples: samples.filter(s => s.polarity === 'negative'),
          rejections,
        });

        const contactMemory = previousTickets.length
          ? `\n\nPrevious tickets from this user:\n${previousTickets
              .map(t => `Subject: "${t.subject?.slice(0, 100)}" → You replied: "${t.lastDraft?.slice(0, 150)}"`)
              .join('\n')}`
          : '';

        const systemPrompt = (template?.system ?? SYSTEM_PROMPT) + kbBlock + contactMemory;

        const response = await this.llm.complete({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Subject: ${ticket.subject}\n\nBody: ${ticket.body}\n\nFrom: ${ticket.userEmail}` },
          ],
          provider: config.llm.provider as any,
          model: config.llm.model,
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
      if (p.ticketId) {
        await this.db.db
          .update(supportTickets)
          .set({
            category: p.category,
            priority: p.priority,
            lastDraft: p.draft,
            status: action.type === 'escalate_to_owner' ? 'escalated' : 'replied',
            updatedAt: new Date(),
          })
          .where(eq(supportTickets.id, p.ticketId));
      }

      await this.telegram.sendMessage(
        `${action.type === 'escalate_to_owner' ? 'Escalated' : 'Replied'}: ${p.subject}\nFrom: ${p.userEmail}\n\nDraft:\n${p.draft}`,
      );
    }

    return { success: true, data: { ticketId: p.ticketId } };
  }

  mcpTools(): McpToolDefinition[] {
    return [
      {
        name: 'get_ticket',
        description: 'Fetch a support ticket by ID',
        inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
        handler: async (input) => this.getTicket((input as any).id),
      },
      {
        name: 'search_similar_tickets',
        description: 'Full-text search for similar past tickets',
        inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number' } }, required: ['query'] },
        handler: async (input) => {
          const { query, limit = 5 } = input as any;
          return this.searchSimilar(query, limit);
        },
      },
      {
        name: 'ingest_ticket',
        description: 'Push a new ticket into the agent',
        inputSchema: {
          type: 'object',
          properties: { subject: { type: 'string' }, body: { type: 'string' }, userEmail: { type: 'string' }, externalId: { type: 'string' } },
          required: ['subject', 'body', 'userEmail'],
        },
        handler: async (input) => this.ingestTicket(input as any),
      },
    ];
  }

  apiRoutes(): AgentApiRoute[] {
    return [
      {
        method: 'POST',
        path: '/support/ingest-ticket',
        requiresAuth: true,
        handler: async (body) => this.ingestTicket(body as any),
      },
      {
        method: 'GET',
        path: '/support/tickets/:id',
        requiresAuth: true,
        handler: async (params) => this.getTicket((params as any).id),
      },
    ];
  }

  async ingestTicket(ticket: { subject: string; body: string; userEmail: string; externalId?: string }) {
    const [row] = await this.db.db
      .insert(supportTickets)
      .values({
        externalId: ticket.externalId ?? null,
        subject: ticket.subject,
        body: ticket.body,
        userEmail: ticket.userEmail,
      })
      .onConflictDoNothing()
      .returning();
    return row;
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
        sql`to_tsvector('english', ${supportTickets.subject} || ' ' || ${supportTickets.body}) @@ plainto_tsquery('english', ${query})`,
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
        provider: 'auto',
        model: 'gpt-4o-mini',
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
