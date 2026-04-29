import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { eq, desc } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { agents } from '../../../db/schema';
import { whatsappMessages } from './schema';
import { WhatsAppService, WaMessage } from './whatsapp.service';
import { AgentRegistryService } from '../runtime/agent-registry.service';
import { LlmRouterService } from '../../llm/llm-router.service';
import { TelegramService } from '../../telegram/telegram.service';
import { KnowledgeBaseService } from '../../knowledge-base/knowledge-base.service';
import { SettingsService } from '../../settings/settings.service';
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

interface WhatsAppConfig {
  offlineStart: number;
  offlineEnd: number;
  timezone: string;
  holdingMessage: string;
  llm: { provider: string; model: string };
}

interface WhatsAppSnapshot {
  messages: any[];
  isOffline: boolean;
  config: WhatsAppConfig;
}

const DEFAULT_CONFIG: WhatsAppConfig = {
  offlineStart: 21,
  offlineEnd: 10,
  timezone: 'Asia/Dhaka',
  holdingMessage: "Thanks for your message! I'm currently offline but will respond as soon as possible.",
  llm: { provider: 'auto', model: 'gpt-4o-mini' },
};

const CLASSIFY_PROMPT = `Classify this WhatsApp message as: urgent | important | normal | spam
Also draft a short reply (1-2 sentences, friendly tone).

Respond with JSON only:
{ "importance": "...", "reply": "..." }`;

@Injectable()
export class WhatsAppAgent implements IAgent, OnModuleInit {
  readonly key = 'whatsapp';
  readonly name = 'WhatsApp Business Watcher';
  private readonly logger = new Logger(WhatsAppAgent.name);

  constructor(
    private db: DbService,
    private llm: LlmRouterService,
    private telegram: TelegramService,
    private wa: WhatsAppService,
    private registry: AgentRegistryService,
    private kb: KnowledgeBaseService,
    private settings: SettingsService,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  triggers(): TriggerSpec[] {
    return [
      { type: 'CRON', cron: '*/10 * * * *' },
      { type: 'WEBHOOK', webhookPath: '/whatsapp/webhook' },
    ];
  }

  async buildContext(trigger: TriggerEvent, run: RunContext): Promise<AgentContext> {
    const config = await this.getConfig();
    const isOffline = this.wa.isOfflineHours(config.timezone, config.offlineStart, config.offlineEnd);

    if (trigger.type === 'WEBHOOK' && (trigger.payload as any)?.messages) {
      return { source: trigger, snapshot: { messages: (trigger.payload as any).messages, isOffline, config }, followups: [] };
    }

    const unprocessed = await this.db.db
      .select()
      .from(whatsappMessages)
      .where(eq(whatsappMessages.status, 'new'))
      .limit(30);

    return { source: trigger, snapshot: { messages: unprocessed, isOffline, config }, followups: [] };
  }

  async decide(ctx: AgentContext): Promise<ProposedAction[]> {
    const { messages, isOffline, config } = ctx.snapshot as WhatsAppSnapshot;
    if (!messages.length) return [{ type: 'noop', summary: 'No new messages.', payload: {}, riskLevel: 'low' }];

    const [alwaysOn, samples, blocklist, rejections] = await Promise.all([
      this.kb.getAlwaysOnContext(this.key),
      this.kb.getWritingSamples(this.key),
      this.kb.getBlocklistRules(this.key),
      this.kb.getRecentRejections(this.key, 3),
    ]);
    const template = await this.kb.getPromptTemplate(this.key);

    const actions: ProposedAction[] = [];

    for (const msg of messages) {
      try {
        const fromNumber = msg.fromNumber ?? msg.from_number ?? msg.from;
        const fromName = msg.fromName ?? msg.from_name ?? fromNumber;
        const preview = (msg.body ?? '').slice(0, 80);

        const [references, previousCount, threadHistory] = await Promise.all([
          this.kb.searchEntries(msg.body ?? '', this.key, 5),
          this.getContactMessageCount(fromNumber),
          this.getThreadHistory(fromNumber),
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

        const contactNote = previousCount > 0
          ? `\n\nThis is a returning contact — they have sent ${previousCount} previous message(s).`
          : '';

        const response = await this.llm.complete({
          messages: [
            { role: 'system', content: (template?.system ?? CLASSIFY_PROMPT) + kbBlock + contactNote },
            { role: 'user', content: `From: ${fromName}\n\n${msg.body}` },
          ],
          provider: config.llm.provider as any,
          model: config.llm.model,
          maxTokens: 200,
        });

        let parsed: { importance: string; reply: string };
        try {
          const text = response.content.trim();
          const match = text.match(/\{[\s\S]*\}/);
          parsed = JSON.parse(match?.[0] ?? text);
        } catch {
          continue;
        }

        // Self-critique + blocklist check (only for reply-type actions)
        if (parsed.importance !== 'spam') {
          parsed.reply = await this.selfCritique(
            parsed.reply,
            alwaysOn.find(e => e.entryType === 'voice_profile')?.content,
            blocklist,
          );
        }
        const violation = parsed.importance !== 'spam'
          ? blocklist.find(p => parsed.reply.toLowerCase().includes(p.toLowerCase()))
          : undefined;

        const msgId = msg.id;

        if (parsed.importance === 'spam') {
          actions.push({
            type: 'ignore_message',
            summary: `Ignore spam from ${fromName}: "${preview}"`,
            payload: { msgId, fromNumber, importance: 'spam' },
            riskLevel: 'low',
          });
          continue;
        }

        if (parsed.importance === 'urgent' || parsed.importance === 'important') {
          actions.push({
            type: 'notify_telegram_priority',
            summary: `${parsed.importance.toUpperCase()} WhatsApp from ${fromName}: "${preview}"`,
            payload: { msgId, fromNumber, fromName, body: msg.body, importance: parsed.importance, draft: parsed.reply },
            riskLevel: 'low',
          });
        }

        if (isOffline && (parsed.importance === 'urgent' || parsed.importance === 'important')) {
          actions.push({
            type: 'auto_reply_holding',
            summary: `Send holding reply to ${fromName}`,
            payload: { msgId, fromNumber, holdingMessage: config.holdingMessage, draft: parsed.reply },
            riskLevel: 'medium',
          });
        } else if (parsed.importance === 'urgent' || parsed.importance === 'important') {
          actions.push({
            type: 'send_reply',
            summary: `Reply to ${fromName}: "${parsed.reply.slice(0, 60)}"${violation ? ` - Blocklist: "${violation}"` : ''}`,
            payload: { msgId, fromNumber, fromName, draft: parsed.reply },
            riskLevel: violation ? 'high' : 'medium',
          });
        }
      } catch (err) {
        this.logger.warn(`Failed to process WA message: ${err}`);
      }
    }

    return actions.length ? actions : [{ type: 'noop', summary: 'No actionable messages.', payload: {}, riskLevel: 'low' }];
  }

  requiresApproval(action: ProposedAction): boolean {
    return action.type === 'auto_reply_holding' || action.type === 'send_reply';
  }

  async execute(action: ProposedAction): Promise<ActionResult> {
    if (action.type === 'noop') return { success: true };
    const p = action.payload as any;

    if (action.type === 'ignore_message') {
      await this.markProcessed(p.msgId, 'ignored', 'spam');
      return { success: true };
    }

    if (action.type === 'notify_telegram_priority') {
      await this.telegram.sendMessage(
        `${p.importance.toUpperCase()} WhatsApp\nFrom: ${p.fromName} (${p.fromNumber})\n\n${p.body}\n\nSuggested reply:\n${p.draft}`,
      );
      await this.markProcessed(p.msgId, 'notified', p.importance);
      return { success: true };
    }

    if (action.type === 'auto_reply_holding' || action.type === 'send_reply') {
      const replyText = action.type === 'auto_reply_holding' ? p.holdingMessage : p.draft;
      if (await this.wa.isConfigured() && p.fromNumber) {
        await this.wa.sendMessage(p.fromNumber, replyText);
      }
      await this.markProcessed(p.msgId, 'replied', undefined);
      await this.telegram.sendMessage(`Replied to ${p.fromName ?? p.fromNumber}: "${replyText.slice(0, 80)}"`);
      return { success: true };
    }

    return { success: true };
  }

  mcpTools(): McpToolDefinition[] {
    return [
      {
        name: 'get_recent_messages',
        description: 'Fetch recent WhatsApp messages from DB',
        inputSchema: { type: 'object', properties: { limit: { type: 'number' } } },
        handler: async (input) => {
          const limit = (input as any).limit ?? 20;
          return this.db.db.select().from(whatsappMessages).limit(limit);
        },
      },
      {
        name: 'send_reply',
        description: 'Send a WhatsApp reply to a number',
        inputSchema: {
          type: 'object',
          properties: { to: { type: 'string' }, message: { type: 'string' } },
          required: ['to', 'message'],
        },
        handler: async (input) => {
          const { to, message } = input as any;
          await this.wa.sendMessage(to, message);
          return { sent: true };
        },
      },
    ];
  }

  apiRoutes(): AgentApiRoute[] {
    return [
      {
        method: 'GET',
        path: '/whatsapp/messages/recent',
        requiresAuth: true,
        handler: async () => this.db.db.select().from(whatsappMessages).limit(50),
      },
      {
        method: 'GET',
        path: '/whatsapp/webhook',
        requiresAuth: false,
        handler: async (query) => {
          const q = query as any;
          if (q['hub.verify_token'] === await this.wa.getVerifyToken()) {
            return q['hub.challenge'];
          }
          return 'Forbidden';
        },
      },
      {
        method: 'POST',
        path: '/whatsapp/webhook',
        requiresAuth: false,
        verifySignature: async (rawBody, headers) => {
          const secret = await this.settings.getDecrypted('whatsapp_app_secret');
          if (!secret) return false;
          const header = (headers['x-hub-signature-256'] as string | undefined)?.trim();
          if (!header || !header.startsWith('sha256=')) return false;
          const sig = header.slice('sha256='.length);
          const expected = hmacHex('sha256', secret, rawBody);
          return safeEqualHex(sig, expected);
        },
        handler: async (body) => {
          const messages = this.wa.parseWebhookMessages(body);
          await this.ingestWebhook(messages);
          return { received: true };
        },
      },
    ];
  }

  async ingestWebhook(rawMessages: WaMessage[]) {
    for (const msg of rawMessages) {
      await this.db.db
        .insert(whatsappMessages)
        .values({
          externalMsgId: msg.id,
          fromNumber: msg.from,
          fromName: msg.name ?? null,
          body: msg.body,
          receivedAt: new Date(msg.timestamp * 1000),
        })
        .onConflictDoNothing();
    }
  }

  private async markProcessed(msgId: string | undefined, status: string, importance: string | undefined) {
    if (!msgId) return;
    await this.db.db
      .update(whatsappMessages)
      .set({ status, ...(importance && { importance }), processedAt: new Date() })
      .where(eq(whatsappMessages.id, msgId));
  }

  private async getThreadHistory(fromNumber: string | undefined): Promise<{ role: 'customer' | 'agent'; text: string }[]> {
    if (!fromNumber) return [];
    try {
      const rows = await this.db.db
        .select({ body: whatsappMessages.body, status: whatsappMessages.status })
        .from(whatsappMessages)
        .where(eq(whatsappMessages.fromNumber, fromNumber))
        .orderBy(desc(whatsappMessages.receivedAt))
        .limit(6);
      return rows
        .reverse()
        .slice(0, 5)
        .map(r => ({ role: 'customer' as const, text: (r.body ?? '').slice(0, 300) }));
    } catch {
      return [];
    }
  }

  private async getContactMessageCount(fromNumber: string | undefined): Promise<number> {
    if (!fromNumber) return 0;
    try {
      const rows = await this.db.db
        .select({ id: whatsappMessages.id })
        .from(whatsappMessages)
        .where(eq(whatsappMessages.fromNumber, fromNumber))
        .orderBy(desc(whatsappMessages.receivedAt))
        .limit(10);
      return Math.max(0, rows.length - 1); // exclude current message
    } catch {
      return 0;
    }
  }

  private async selfCritique(draft: string, voiceProfile?: string, blocklist?: string[]): Promise<string> {
    try {
      const critique = await this.llm.complete({
        messages: [
          {
            role: 'system',
            content: `You are a strict editor. Review this WhatsApp reply draft.
Voice: ${voiceProfile ?? 'friendly, direct, brief'}
Avoid: ${blocklist?.join(', ') || 'none specified'}
If the draft is good, return: {"ok":true}
If not, rewrite and return: {"ok":false,"revised":"improved reply here"}`,
          },
          { role: 'user', content: `Draft: "${draft}"` },
        ],
        provider: 'auto',
        model: 'gpt-4o-mini',
        maxTokens: 200,
      });
      const result = JSON.parse(critique.content);
      if (!result.ok && result.revised) return result.revised.trim();
    } catch {
      // fail-open: use original draft
    }
    return draft;
  }

  private async getConfig(): Promise<WhatsAppConfig> {
    const [row] = await this.db.db.select().from(agents).where(eq(agents.key, this.key));
    return { ...DEFAULT_CONFIG, ...(row?.config as Partial<WhatsAppConfig> ?? {}) };
  }
}
