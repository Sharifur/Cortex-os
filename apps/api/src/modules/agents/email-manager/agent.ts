import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { agents, emailItems } from '../../../db/schema';
import { AgentRegistryService } from '../runtime/agent-registry.service';
import { LlmRouterService } from '../../llm/llm-router.service';
import { TelegramService } from '../../telegram/telegram.service';
import { GmailService } from '../../gmail/gmail.service';
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

type Classification = 'must-reply' | 'nice-to-reply' | 'newsletter' | 'spam';

interface EmailManagerConfig {
  maxEmailsPerRun: number;
  importantSenders: string[];
  autoArchiveDomains: string[];
  llm: { provider: string; model: string };
}

interface EmailSnapshot {
  newMessages: {
    id: string;
    threadId: string;
    from: string;
    subject: string;
    snippet: string;
    body: string;
    receivedAt: string;
  }[];
  config: EmailManagerConfig;
}

const CLASSIFY_SYSTEM = `You are an email classifier for Sharifur Rahman, founder of Taskip and Xgenious.
Classify the email into exactly one category:
- must-reply: customer, partner, investor, or important business contact who needs a response
- nice-to-reply: potentially useful but not urgent
- newsletter: marketing, announcements, digests, automated emails
- spam: unsolicited, irrelevant, or junk

Reply with ONLY the category name, nothing else.`;

const DRAFT_SYSTEM = `You are Sharifur Rahman's email assistant. Write a concise, professional reply.
Keep it under 100 words. Be warm but direct. Do not include a subject line — just the reply body.`;

@Injectable()
export class EmailManagerAgent implements IAgent, OnModuleInit {
  readonly key = 'email_manager';
  readonly name = 'Email Manager';
  private readonly logger = new Logger(EmailManagerAgent.name);

  constructor(
    private db: DbService,
    private llm: LlmRouterService,
    private telegram: TelegramService,
    private gmail: GmailService,
    private registry: AgentRegistryService,
    private kb: KnowledgeBaseService,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  triggers(): TriggerSpec[] {
    return [{ type: 'CRON', cron: '*/30 * * * *' }];
  }

  async buildContext(trigger: TriggerEvent, run: RunContext): Promise<AgentContext> {
    const config = await this.getConfig();

    const isConfigured = await this.gmail.isConfigured();
    if (!isConfigured) {
      return { source: trigger, snapshot: { newMessages: [], config, skip: true }, followups: [] };
    }

    const messages = await this.gmail.listUnread(config.maxEmailsPerRun);
    if (!messages.length) {
      return { source: trigger, snapshot: { newMessages: [], config }, followups: [] };
    }

    const existingIds = messages.map((m) => m.id);
    const existing = await this.db.db
      .select({ externalMsgId: emailItems.externalMsgId })
      .from(emailItems)
      .where(inArray(emailItems.externalMsgId, existingIds));

    const existingSet = new Set(existing.map((r) => r.externalMsgId));
    const newMessages = messages.filter((m) => !existingSet.has(m.id));

    this.logger.log(
      `buildContext: ${messages.length} unread, ${newMessages.length} new`,
    );

    const snapshot: EmailSnapshot = {
      newMessages: newMessages.map((m) => ({
        id: m.id,
        threadId: m.threadId,
        from: m.from,
        subject: m.subject,
        snippet: m.snippet,
        body: m.body.slice(0, 2000),
        receivedAt: m.receivedAt.toISOString(),
      })),
      config,
    };

    return { source: trigger, snapshot, followups: (run.context as AgentContext | null)?.followups ?? [] };
  }

  async decide(ctx: AgentContext): Promise<ProposedAction[]> {
    const snapshot = ctx.snapshot as EmailSnapshot & { skip?: boolean };
    if (snapshot.skip || !snapshot.newMessages.length) return [];

    const { newMessages, config } = snapshot;
    const actions: ProposedAction[] = [];

    const [alwaysOn, samples, blocklist, rejections] = await Promise.all([
      this.kb.getAlwaysOnContext(this.key),
      this.kb.getWritingSamples(this.key),
      this.kb.getBlocklistRules(this.key),
      this.kb.getRecentRejections(this.key, 3),
    ]);
    const template = await this.kb.getPromptTemplate(this.key);

    for (const msg of newMessages) {
      const classification = await this.classify(msg, config);

      await this.db.db.insert(emailItems).values({
        externalMsgId: msg.id,
        threadId: msg.threadId,
        from: msg.from,
        subject: msg.subject,
        snippet: msg.snippet,
        classification,
        status: 'new',
        receivedAt: new Date(msg.receivedAt),
      }).onConflictDoNothing();

      if (classification === 'newsletter' || classification === 'spam') {
        actions.push({
          type: 'archive_email',
          summary: `Archive "${msg.subject}" (${classification})`,
          payload: { messageId: msg.id, externalMsgId: msg.id, classification },
          riskLevel: 'low',
        });
      } else if (classification === 'must-reply') {
        const references = await this.kb.searchEntries(`${msg.subject} ${msg.snippet}`, this.key, 5);
        const kbBlock = this.kb.buildKbPromptBlock({
          voiceProfile: alwaysOn.find(e => e.entryType === 'voice_profile') ?? null,
          facts: alwaysOn.filter(e => e.entryType === 'fact'),
          references,
          positiveSamples: samples.filter(s => s.polarity === 'positive'),
          negativeSamples: samples.filter(s => s.polarity === 'negative'),
          rejections,
        });
        let draft = await this.draftReply(msg, config, template?.system, kbBlock);
        draft = await this.selfCritique(draft, alwaysOn.find(e => e.entryType === 'voice_profile')?.content, blocklist);
        const violation = blocklist.find(p => draft.toLowerCase().includes(p.toLowerCase()));

        await this.db.db
          .update(emailItems)
          .set({ draftReply: draft, status: 'draft_ready' })
          .where(eq(emailItems.externalMsgId, msg.id));

        actions.push({
          type: 'send_reply',
          summary: `Reply to "${msg.subject}" from ${msg.from}${violation ? ` - Blocklist: "${violation}"` : ''}`,
          payload: {
            messageId: msg.id,
            threadId: msg.threadId,
            from: msg.from,
            subject: msg.subject,
            draft,
          },
          riskLevel: violation ? 'high' : 'medium',
        });
      } else {
        // nice-to-reply — notify only
        actions.push({
          type: 'notify_email',
          summary: `Notify: new email from ${msg.from} — "${msg.subject}"`,
          payload: { messageId: msg.id, from: msg.from, subject: msg.subject, snippet: msg.snippet },
          riskLevel: 'low',
        });
      }
    }

    return actions;
  }

  requiresApproval(action: ProposedAction): boolean {
    return action.type === 'send_reply';
  }

  async execute(action: ProposedAction): Promise<ActionResult> {
    switch (action.type) {
      case 'archive_email': {
        const { messageId, externalMsgId, classification } = action.payload as {
          messageId: string;
          externalMsgId: string;
          classification: string;
        };
        await this.gmail.archiveMessage(messageId);
        await this.gmail.markRead(messageId);
        await this.db.db
          .update(emailItems)
          .set({ status: 'archived', processedAt: new Date() })
          .where(eq(emailItems.externalMsgId, externalMsgId));
        return { success: true, data: { archived: true, classification } };
      }

      case 'notify_email': {
        const { from, subject, snippet } = action.payload as {
          messageId: string;
          from: string;
          subject: string;
          snippet: string;
        };
        await this.telegram.sendMessage(
          `📬 New email (nice-to-reply)\nFrom: ${from}\nSubject: ${subject}\n\n${snippet}`,
        );
        await this.db.db
          .update(emailItems)
          .set({ status: 'notified', processedAt: new Date() })
          .where(eq(emailItems.externalMsgId, (action.payload as any).messageId));
        return { success: true, data: { notified: true } };
      }

      case 'send_reply': {
        const { messageId, threadId, from, subject, draft } = action.payload as {
          messageId: string;
          threadId: string;
          from: string;
          subject: string;
          draft: string;
        };
        const config = await this.getConfig();
        const toAddress = from.match(/<(.+)>/)?.[1] ?? from;
        const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;

        await this.gmail.sendEmail({
          to: toAddress,
          from: `Sharifur <${process.env.GMAIL_FROM_ADDRESS ?? 'me'}>`,
          subject: replySubject,
          textBody: draft,
        });

        await this.gmail.markRead(messageId);
        await this.db.db
          .update(emailItems)
          .set({ status: 'sent', processedAt: new Date() })
          .where(eq(emailItems.externalMsgId, messageId));

        return { success: true, data: { sent: true, to: toAddress } };
      }

      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  mcpTools(): McpToolDefinition[] {
    return [
      {
        name: 'list_unread',
        description: 'List unread emails from Gmail inbox',
        inputSchema: {
          type: 'object',
          properties: { maxResults: { type: 'number', default: 10 } },
        },
        handler: async (input) => {
          const { maxResults = 10 } = input as { maxResults?: number };
          return this.gmail.listUnread(maxResults);
        },
      },
      {
        name: 'get_thread',
        description: 'Fetch a full Gmail thread by thread ID',
        inputSchema: {
          type: 'object',
          properties: { threadId: { type: 'string' } },
          required: ['threadId'],
        },
        handler: async (input) => {
          const { threadId } = input as { threadId: string };
          return this.gmail.getThread(threadId);
        },
      },
      {
        name: 'draft_reply',
        description: 'LLM-draft a reply for an email by its external message ID',
        inputSchema: {
          type: 'object',
          properties: { messageId: { type: 'string' } },
          required: ['messageId'],
        },
        handler: async (input) => {
          const { messageId } = input as { messageId: string };
          const msg = await this.gmail.getMessage(messageId);
          const config = await this.getConfig();
          const draft = await this.draftReply(
            { subject: msg.subject, from: msg.from, body: msg.body.slice(0, 2000), snippet: msg.snippet },
            config,
          );
          return { draft };
        },
      },
      {
        name: 'archive',
        description: 'Archive an email by message ID',
        inputSchema: {
          type: 'object',
          properties: { messageId: { type: 'string' } },
          required: ['messageId'],
        },
        handler: async (input) => {
          const { messageId } = input as { messageId: string };
          await this.gmail.archiveMessage(messageId);
          return { archived: true };
        },
      },
      {
        name: 'label',
        description: 'Apply a Gmail label to a message',
        inputSchema: {
          type: 'object',
          properties: { messageId: { type: 'string' }, labelName: { type: 'string' } },
          required: ['messageId', 'labelName'],
        },
        handler: async (input) => {
          const { messageId, labelName } = input as { messageId: string; labelName: string };
          await this.gmail.addLabel(messageId, labelName);
          return { labeled: true, labelName };
        },
      },
    ];
  }

  apiRoutes(): AgentApiRoute[] {
    return [
      {
        method: 'GET',
        path: '/email-manager/unread',
        requiresAuth: true,
        handler: async () => this.gmail.listUnread(20),
      },
      {
        method: 'POST',
        path: '/email-manager/draft-reply/:msgId',
        requiresAuth: true,
        handler: async (params) => {
          const msgId = (params as { msgId: string }).msgId;
          const msg = await this.gmail.getMessage(msgId);
          const config = await this.getConfig();
          const draft = await this.draftReply(
            { subject: msg.subject, from: msg.from, body: msg.body.slice(0, 2000), snippet: msg.snippet },
            config,
          );
          return { draft };
        },
      },
    ];
  }

  private async classify(
    msg: { from: string; subject: string; snippet: string; body: string },
    config: EmailManagerConfig,
  ): Promise<Classification> {
    const fromLower = msg.from.toLowerCase();

    if (config.importantSenders?.some((s) => fromLower.includes(s.toLowerCase()))) {
      return 'must-reply';
    }
    if (config.autoArchiveDomains?.some((d) => fromLower.includes(d.toLowerCase()))) {
      return 'newsletter';
    }

    const prompt = `From: ${msg.from}\nSubject: ${msg.subject}\n\n${msg.snippet}`;
    const res = await this.llm.complete({
      provider: config.llm.provider as 'openai' | 'gemini' | 'deepseek' | 'auto',
      model: config.llm.model,
      messages: [
        { role: 'system', content: CLASSIFY_SYSTEM },
        { role: 'user', content: prompt },
      ],
      maxTokens: 20,
      temperature: 0,
    });

    const raw = res.content.trim().toLowerCase();
    if (raw.includes('must-reply')) return 'must-reply';
    if (raw.includes('nice-to-reply')) return 'nice-to-reply';
    if (raw.includes('newsletter')) return 'newsletter';
    return 'spam';
  }

  private async draftReply(
    msg: { from: string; subject: string; snippet: string; body: string },
    config: EmailManagerConfig,
    customSystem?: string,
    kbBlock = '',
  ): Promise<string> {
    const res = await this.llm.complete({
      provider: config.llm.provider as 'openai' | 'gemini' | 'deepseek' | 'auto',
      model: config.llm.model,
      messages: [
        { role: 'system', content: (customSystem ?? DRAFT_SYSTEM) + kbBlock },
        {
          role: 'user',
          content: `From: ${msg.from}\nSubject: ${msg.subject}\n\n${msg.body || msg.snippet}`,
        },
      ],
      maxTokens: 300,
      temperature: 0.7,
    });
    return res.content.trim();
  }

  private async selfCritique(draft: string, voiceProfile?: string, blocklist?: string[]): Promise<string> {
    try {
      const critique = await this.llm.complete({
        messages: [
          {
            role: 'system',
            content: `You are a strict editor. Review this email reply draft.
Voice: ${voiceProfile ?? 'warm, direct, under 100 words'}
Avoid: ${blocklist?.join(', ') || 'none specified'}
If the draft is good, return: {"ok":true}
If not, rewrite and return: {"ok":false,"revised":"improved reply here"}`,
          },
          { role: 'user', content: `Draft: "${draft}"` },
        ],
        provider: 'auto',
        model: 'gpt-4o-mini',
        maxTokens: 250,
      });
      const result = JSON.parse(critique.content);
      if (!result.ok && result.revised) return result.revised.trim();
    } catch {
      // fail-open
    }
    return draft;
  }

  private async getConfig(): Promise<EmailManagerConfig> {
    const [row] = await this.db.db
      .select({ config: agents.config })
      .from(agents)
      .where(eq(agents.key, this.key));

    return (row?.config as EmailManagerConfig) ?? this.defaultConfig();
  }

  private defaultConfig(): EmailManagerConfig {
    return {
      maxEmailsPerRun: 20,
      importantSenders: [],
      autoArchiveDomains: [],
      llm: { provider: 'auto', model: 'gpt-4o-mini' },
    };
  }
}
