import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { agents } from '../../../db/schema';
import { crispConversations } from './schema';
import { CrispService } from './crisp.service';
import { AgentRegistryService } from '../runtime/agent-registry.service';
import { LlmRouterService } from '../../llm/llm-router.service';
import { TelegramService } from '../../telegram/telegram.service';
import { KnowledgeBaseService } from '../../knowledge-base/knowledge-base.service';
import { PurchaseVerifyService } from '../purchase-verify/purchase-verify.service';
import { SettingsService } from '../../settings/settings.service';
import { ContactsService } from '../../contacts/contacts.service';
import { hmacHex, safeEqualHex } from '../../../common/webhooks/verify';
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

interface CrispConfig {
  replyTone: string;
  productContext: string;
  maxConversationsPerRun: number;
  autoReply: boolean;
  llm: { provider: string; model: string };
}

interface CrispSnapshot {
  newMessages: any[];
  config: CrispConfig;
  threadHistory?: Record<string, { role: 'customer' | 'agent'; text: string }[]>;
}

const DEFAULT_CONFIG: CrispConfig = {
  replyTone: 'friendly, concise, and helpful — like a knowledgeable founder replying to a customer',
  productContext: 'Taskip is a project management SaaS for teams.',
  maxConversationsPerRun: 10,
  autoReply: true,
  llm: { provider: 'auto', model: 'gpt-4o-mini' },
};

@Injectable()
export class CrispAgent implements IAgent, OnModuleInit {
  readonly key = 'crisp';
  readonly name = 'Crisp AI Agent';
  private readonly logger = new Logger(CrispAgent.name);

  constructor(
    private db: DbService,
    private llm: LlmRouterService,
    private telegram: TelegramService,
    private crisp: CrispService,
    private registry: AgentRegistryService,
    private kb: KnowledgeBaseService,
    private purchaseVerify: PurchaseVerifyService,
    private settings: SettingsService,
    private contactsSvc: ContactsService,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  triggers(): TriggerSpec[] {
    return [
      { type: 'CRON', cron: '*/15 * * * *' },
      { type: 'WEBHOOK', webhookPath: '/crisp/webhook' },
      { type: 'MANUAL' },
    ];
  }

  async buildContext(trigger: TriggerEvent, run: RunContext): Promise<AgentContext> {
    const config = await this.getConfig();
    const newMessages: any[] = [];

    if (trigger.type === 'WEBHOOK' && trigger.payload) {
      const msg = this.crisp.parseWebhookMessage(trigger.payload);
      if (msg) {
        const [existing] = await this.db.db
          .select({ lastMessage: crispConversations.lastMessage })
          .from(crispConversations)
          .where(eq(crispConversations.sessionId, msg.sessionId))
          .limit(1);
        if (!existing || existing.lastMessage !== msg.content) {
          newMessages.push(msg);
        }
      }
    } else {
      const conversations = await this.crisp.getOpenConversations(config.maxConversationsPerRun);
      for (const conv of conversations) {
        const [existing] = await this.db.db
          .select({ lastMessage: crispConversations.lastMessage })
          .from(crispConversations)
          .where(eq(crispConversations.sessionId, conv.sessionId))
          .limit(1);
        if (!existing || existing.lastMessage !== conv.content) {
          newMessages.push(conv);
        }
      }
    }

    return { source: trigger, snapshot: { newMessages, config }, followups: [] };
  }

  async decide(ctx: AgentContext): Promise<ProposedAction[]> {
    const { newMessages, config } = ctx.snapshot as CrispSnapshot;
    if (!newMessages.length) {
      return [{ type: 'noop', summary: 'No new Crisp conversations.', payload: {}, riskLevel: 'low' }];
    }

    // Parallel KB fetch (cached where possible)
    const [alwaysOn, samples, blocklist, rejections] = await Promise.all([
      this.kb.getAlwaysOnContext(this.key),
      this.kb.getWritingSamples(this.key),
      this.kb.getBlocklistRules(this.key),
      this.kb.getRecentRejections(this.key, 3),
    ]);

    const template = await this.kb.getPromptTemplate(this.key);

    const actions: ProposedAction[] = [];

    for (const msg of newMessages) {
      try {
        // Per-message: FTS search + visitor memory + conversation thread (parallel)
        const [references, previousReplies, threadHistory] = await Promise.all([
          this.kb.searchEntries(msg.content ?? '', this.key, 5),
          this.getVisitorHistory(msg.visitorEmail, msg.visitorNickname),
          this.crisp.getSessionThread(msg.sessionId, msg.websiteId, 5),
        ]);

        const kbBlock = this.kb.buildKbPromptBlock({
          voiceProfile: alwaysOn.find(e => e.entryType === 'voice_profile') ?? null,
          facts: alwaysOn.filter(e => e.entryType === 'fact'),
          references,
          positiveSamples: samples.filter(s => s.polarity === 'positive'),
          negativeSamples: samples.filter(s => s.polarity === 'negative'),
          rejections,
          threadHistory,
        });

        const visitorMemory = previousReplies.length
          ? `\n\nPrevious interactions with this visitor:\n${previousReplies
              .map(r => `Customer: "${r.msg?.slice(0, 150)}" → You replied: "${r.draft?.slice(0, 150)}"`)
              .join('\n')}`
          : '';

        let purchaseBlock = '';
        const purchaseCodes = PurchaseVerifyService.extractPurchaseCodes(msg.content ?? '');
        if (purchaseCodes.length && PurchaseVerifyService.hasSupportIntent(msg.content ?? '')) {
          const verifyResult = await this.purchaseVerify.verify(purchaseCodes[0]);
          if (verifyResult) purchaseBlock = PurchaseVerifyService.buildVerifyPromptBlock(verifyResult);
        }

        const defaultSystem = `You are a customer support agent. Context: ${config.productContext}\nTone: ${config.replyTone}\nWrite a direct reply to the customer message. 2-4 sentences max. No greetings like "Dear" or closings like "Best regards". Just the reply.`;
        const systemPrompt = (template?.system ?? defaultSystem) + kbBlock + visitorMemory + purchaseBlock;

        const response = await this.llm.complete({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: msg.content },
          ],
          provider: config.llm.provider as any,
          model: config.llm.model,
          maxTokens: 200,
        });

        let draft = response.content.trim();
        if (!draft) continue;

        // Self-critique for medium/high risk (always medium for customer replies)
        draft = await this.selfCritique(draft, alwaysOn.find(e => e.entryType === 'voice_profile')?.content, blocklist);

        // Blocklist check
        const violation = blocklist.find(p => draft.toLowerCase().includes(p.toLowerCase()));

        const receivedAt = new Date(msg.timestamp ? msg.timestamp * 1000 : Date.now());
        await this.db.db
          .insert(crispConversations)
          .values({
            sessionId: msg.sessionId,
            websiteId: msg.websiteId,
            visitorEmail: msg.visitorEmail ?? null,
            visitorNickname: msg.visitorNickname ?? null,
            lastMessage: msg.content.slice(0, 2000),
            draftReply: draft,
            status: 'new',
            receivedAt,
          })
          .onConflictDoUpdate({
            target: crispConversations.sessionId,
            set: {
              lastMessage: msg.content.slice(0, 2000),
              visitorEmail: msg.visitorEmail ?? null,
              visitorNickname: msg.visitorNickname ?? null,
              draftReply: draft,
              status: 'new',
              receivedAt,
              repliedAt: null,
            },
          });

        // Upsert contact + log activity. Visitor identified by Crisp sessionId;
        // if the visitor later supplies an email, the existing row is patched.
        try {
          const contactId = await this.crisp.upsertContactForCrisp({
            sessionId: msg.sessionId,
            websiteId: msg.websiteId,
            email: msg.visitorEmail,
            nickname: msg.visitorNickname,
          });
          await this.contactsSvc.addActivity(
            contactId,
            'crisp_message',
            `Crisp message: "${msg.content.slice(0, 200)}"`,
            { refId: msg.sessionId, meta: { websiteId: msg.websiteId } },
          );
        } catch (err) {
          this.logger.warn(`Failed to upsert contact for Crisp ${msg.sessionId}: ${(err as Error).message}`);
        }

        const visitorLabel = msg.visitorNickname ?? msg.visitorEmail ?? msg.sessionId.slice(-8);

        actions.push({
          type: 'send_reply',
          summary: `Reply to ${visitorLabel}: "${draft.slice(0, 80)}"${violation ? ` [Blocklist: "${violation}"]` : ''}`,
          payload: { sessionId: msg.sessionId, websiteId: msg.websiteId, visitorLabel, message: msg.content, draft, autoReply: config.autoReply ?? true },
          riskLevel: violation ? 'high' : 'medium',
        });
      } catch (err) {
        this.logger.warn(`Failed to draft Crisp reply: ${err}`);
      }
    }

    return actions.length
      ? actions
      : [{ type: 'noop', summary: 'No actionable conversations.', payload: {}, riskLevel: 'low' }];
  }

  requiresApproval(action: ProposedAction): boolean {
    if (action.type === 'send_reply') {
      return !(action.payload as any).autoReply;
    }
    return false;
  }

  async execute(action: ProposedAction): Promise<ActionResult> {
    if (action.type === 'noop') return { success: true };
    const p = action.payload as any;

    if (action.type === 'send_reply') {
      await this.crisp.sendReply(p.sessionId, p.websiteId, p.draft);
      await this.db.db
        .update(crispConversations)
        .set({ status: 'replied', repliedAt: new Date() })
        .where(eq(crispConversations.sessionId, p.sessionId));
      await this.telegram.sendMessage(
        `Crisp [auto-sent] to ${p.visitorLabel}\n\nCustomer: "${p.message.slice(0, 200)}"\n\nReply: "${p.draft}"`,
      );
      return { success: true, data: { sessionId: p.sessionId } };
    }

    return { success: true };
  }

  mcpTools(): McpToolDefinition[] {
    return [
      {
        name: 'get_open_conversations',
        description: 'Fetch recent open Crisp chat conversations',
        inputSchema: { type: 'object', properties: { limit: { type: 'number' } } },
        handler: async (input) => this.crisp.getOpenConversations((input as any).limit ?? 10),
      },
      {
        name: 'get_crisp_thread',
        description: 'Get a tracked conversation from DB by sessionId',
        inputSchema: { type: 'object', properties: { sessionId: { type: 'string' } }, required: ['sessionId'] },
        handler: async (input) => {
          const [row] = await this.db.db
            .select()
            .from(crispConversations)
            .where(eq(crispConversations.sessionId, (input as any).sessionId));
          return row ?? null;
        },
      },
    ];
  }

  apiRoutes(): AgentApiRoute[] {
    return [
      {
        method: 'GET',
        path: '/crisp/conversations',
        requiresAuth: true,
        handler: async () => this.db.db.select().from(crispConversations).limit(50),
      },
      {
        method: 'POST',
        path: '/crisp/webhook',
        requiresAuth: false,
        verifySignature: async (rawBody, headers) => {
          const secret = await this.settings.getDecrypted('crisp_webhook_signing_secret');
          if (!secret) return false;
          const sig = (headers['x-crisp-signature'] as string | undefined)?.trim();
          if (!sig) return false;
          const expected = hmacHex('sha256', secret, rawBody);
          return safeEqualHex(sig, expected);
        },
        handler: async (_body) => ({ received: true }),
      },
    ];
  }

  private async getConfig(): Promise<CrispConfig> {
    const [row] = await this.db.db.select().from(agents).where(eq(agents.key, this.key));
    return { ...DEFAULT_CONFIG, ...(row?.config as Partial<CrispConfig> ?? {}) };
  }

  private async getVisitorHistory(visitorEmail?: string | null, visitorNickname?: string | null) {
    if (!visitorEmail && !visitorNickname) return [];
    try {
      return this.db.db
        .select({ draft: crispConversations.draftReply, msg: crispConversations.lastMessage })
        .from(crispConversations)
        .where(
          and(
            visitorEmail ? eq(crispConversations.visitorEmail, visitorEmail) : eq(crispConversations.visitorNickname, visitorNickname!),
            eq(crispConversations.status, 'replied'),
          ),
        )
        .limit(2)
        .orderBy(desc(crispConversations.repliedAt));
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
            content: `You are a strict editor. Review this draft reply.
Voice: ${voiceProfile ?? 'direct, friendly, no corporate jargon'}
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
}
