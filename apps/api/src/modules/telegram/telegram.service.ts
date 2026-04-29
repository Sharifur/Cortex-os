import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Bot, InlineKeyboard } from 'grammy';
import { eq, and } from 'drizzle-orm';
import { SettingsService } from '../settings/settings.service';
import { ApprovalService } from '../agents/runtime/approval.service';
import { AgentRuntimeService } from '../agents/runtime/agent-runtime.service';
import { LlmRouterService } from '../llm/llm-router.service';
import { DbService } from '../../db/db.service';
import { pendingApprovals, tasks } from '../../db/schema';
import { SelfImprovementService, KbProposalNotifyEvent } from '../knowledge-base/self-improvement.service';
import type { ApprovalCreatedEvent } from './telegram.types';
import { TELEGRAM_EVENTS } from './telegram.types';
import type { ProposedAction } from '../agents/runtime/types';
import { GREETING_SET, normalizeForGreeting } from './greetings';

const RISK_LABEL: Record<string, string> = {
  low: '[low]',
  medium: '[medium]',
  high: '[HIGH]',
};

// Agents available for routing — key must match IAgent.key
const ROUTABLE_AGENTS = [
  { key: 'daily_reminder', name: 'Daily Reminder', aliases: ['daily', 'reminder', 'brief', 'status'], desc: 'Status updates, pending tasks, daily briefs, system status' },
  { key: 'email_manager', name: 'Email Manager', aliases: ['email', 'gmail', 'inbox', 'mail'], desc: 'Email inbox, draft replies, Gmail' },
  { key: 'crisp', name: 'Crisp', aliases: ['crisp', 'support', 'chat', 'customer'], desc: 'Customer support chats, Crisp live chat conversations' },
  { key: 'whatsapp', name: 'WhatsApp', aliases: ['whatsapp', 'wa', 'whats'], desc: 'WhatsApp messages' },
  { key: 'linkedin', name: 'LinkedIn', aliases: ['linkedin', 'li', 'connect', 'outreach'], desc: 'LinkedIn outreach, connections, posts' },
  { key: 'reddit', name: 'Reddit', aliases: ['reddit', 'subreddit', 'post', 'community'], desc: 'Reddit posts, comments, community monitoring' },
  { key: 'social', name: 'Social', aliases: ['social', 'twitter', 'tweet', 'schedule'], desc: 'Social media posts, Twitter/X, scheduling' },
  { key: 'taskip_trial', name: 'Taskip Trial', aliases: ['taskip', 'trial', 'onboard'], desc: 'Taskip trial users, onboarding emails' },
  { key: 'hr', name: 'HR', aliases: ['hr', 'leave', 'salary', 'payroll', 'employee'], desc: 'Leave requests, salary, HR alerts' },
  { key: 'canva', name: 'Canva', aliases: ['canva', 'design', 'graphic'], desc: 'Design generation, Canva calendar' },
  { key: 'shorts', name: 'Shorts', aliases: ['shorts', 'video', 'youtube', 'script'], desc: 'YouTube Shorts scripts, video content' },
];

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private bot: Bot | null = null;
  private ownerChatId: string | null = null;

  // Stores pending route messages: shortId -> { text, expiresAt }
  private pendingRoutes = new Map<string, { text: string; expiresAt: number }>();
  private pendingRouteCounter = 0;

  constructor(
    private readonly settings: SettingsService,
    private readonly approvalSvc: ApprovalService,
    private readonly agentRuntime: AgentRuntimeService,
    private readonly llm: LlmRouterService,
    private readonly db: DbService,
    private readonly selfImproveSvc: SelfImprovementService,
  ) {}

  async onModuleInit() {
    const token = await this.settings.getDecrypted('telegram_bot_token');
    this.ownerChatId = await this.settings.getDecrypted('telegram_owner_chat_id');

    if (!token) {
      this.logger.warn('Telegram bot token not configured — bot disabled');
      return;
    }

    try {
      this.bot = new Bot(token);
      this.registerHandlers();

      if (process.env.NODE_ENV !== 'production') {
        this.bot.start().catch((err: Error) =>
          this.logger.error(`Bot polling error: ${err.message}`),
        );
      }
      this.logger.log('Telegram bot started');
    } catch (err) {
      this.logger.error(`Failed to init Telegram bot: ${(err as Error).message}`);
    }
  }

  async onModuleDestroy() {
    await this.bot?.stop();
  }

  getBot(): Bot | null {
    return this.bot;
  }

  async sendMessage(text: string): Promise<void> {
    if (!this.bot || !this.ownerChatId) return;
    await this.bot.api.sendMessage(this.ownerChatId, text, { parse_mode: 'Markdown' });
  }

  async sendMessageWithKeyboard(text: string, keyboard: InlineKeyboard): Promise<{ message_id: number } | null> {
    if (!this.bot || !this.ownerChatId) return null;
    return this.bot.api.sendMessage(this.ownerChatId, text, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  @OnEvent(TELEGRAM_EVENTS.APPROVAL_CREATED)
  async onApprovalCreated(event: ApprovalCreatedEvent): Promise<void> {
    if (!this.bot || !this.ownerChatId) return;

    const text = this.buildApprovalText(event.agentName, event.action, event.runId);
    const keyboard = new InlineKeyboard()
      .text('Approve', `approval:${event.approvalId}:approve`)
      .text('Reject', `approval:${event.approvalId}:reject`)
      .text('Follow up', `approval:${event.approvalId}:followup`);

    try {
      const sent = await this.bot.api.sendMessage(this.ownerChatId, text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });

      await this.db.db
        .update(pendingApprovals)
        .set({ telegramMessageId: String(sent.message_id) })
        .where(eq(pendingApprovals.id, event.approvalId));
    } catch (err) {
      this.logger.error(`Failed to send approval message: ${(err as Error).message}`);
    }
  }

  @OnEvent('auth.login.new_ip')
  async onNewIpLogin(payload: { email: string; ip: string; userAgent?: string }): Promise<void> {
    if (!this.bot || !this.ownerChatId) return;
    const text = `Cortex OS: new login for ${payload.email}\nIP: ${payload.ip}\nUA: ${(payload.userAgent ?? '—').slice(0, 120)}`;
    try { await this.sendMessage(text); } catch { /* ignore */ }
  }

  @OnEvent('auth.lockout')
  async onLockout(payload: { key: string; fails: number; lockMinutes: number }): Promise<void> {
    if (!this.bot || !this.ownerChatId) return;
    const text = `Cortex OS: login lockout triggered\nKey: ${payload.key}\nFails: ${payload.fails}\nLocked for ${payload.lockMinutes} min`;
    try { await this.sendMessage(text); } catch { /* ignore */ }
  }

  @OnEvent('telegram.kb_proposal')
  async onKbProposal(event: KbProposalNotifyEvent): Promise<void> {
    if (!this.bot || !this.ownerChatId) return;

    const keyboard = new InlineKeyboard()
      .text('Add to KB', `kbproposal:${event.proposalId}:approve`)
      .text('Skip', `kbproposal:${event.proposalId}:reject`);

    try {
      await this.bot.api.sendMessage(this.ownerChatId, event.text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    } catch (err) {
      this.logger.error(`Failed to send KB proposal message: ${(err as Error).message}`);
    }
  }

  private registerHandlers() {
    if (!this.bot) return;

    // Inline keyboard callbacks: approval:<id>:<action>
    this.bot.callbackQuery(
      /^approval:([^:]+):(approve|reject|followup)$/,
      async (ctx) => {
        const fromId = ctx.from?.id ? String(ctx.from.id) : null;
        if (!this.isOwner(fromId)) {
          await ctx.answerCallbackQuery({ text: 'Unauthorized' });
          return;
        }

        const [, approvalId, action] = ctx.match!;
        await ctx.answerCallbackQuery();

        const originalText = ctx.msg?.text ?? '';

        if (action === 'approve') {
          await this.approvalSvc.approve(approvalId);
          await ctx.editMessageText(`${originalText}\n\n*Approved*`, {
            parse_mode: 'Markdown',
          });
        } else if (action === 'reject') {
          const keyboard = new InlineKeyboard()
            .text('Reject silently', `reject:${approvalId}:silent`)
            .text('Reject + reason', `reject:${approvalId}:reason`);
          await ctx.editMessageText(`${originalText}\n\nRejected — add a reason?`, {
            reply_markup: keyboard,
          });
        } else if (action === 'followup') {
          await ctx.editMessageText(
            `${originalText}\n\n_Awaiting follow\\-up instruction\\.\\.\\._`,
            { parse_mode: 'MarkdownV2' },
          );
          const prompt = await ctx.api.sendMessage(
            this.ownerChatId!,
            'Reply to this message with your follow\\-up instruction:',
            {
              parse_mode: 'MarkdownV2',
              reply_markup: { force_reply: true, selective: true },
            },
          );
          await this.db.db
            .update(pendingApprovals)
            .set({ telegramThreadId: String(prompt.message_id), status: 'FOLLOWUP' })
            .where(eq(pendingApprovals.id, approvalId));
        }
      },
    );

    // Rejection sub-action: silent or reason
    this.bot.callbackQuery(
      /^reject:([^:]+):(silent|reason)$/,
      async (ctx) => {
        const fromId = ctx.from?.id ? String(ctx.from.id) : null;
        if (!this.isOwner(fromId)) {
          await ctx.answerCallbackQuery({ text: 'Unauthorized' });
          return;
        }

        const [, approvalId, subAction] = ctx.match!;
        await ctx.answerCallbackQuery();
        const originalText = ctx.msg?.text ?? '';

        if (subAction === 'silent') {
          await this.approvalSvc.rejectWithReason(approvalId, null);
          await ctx.editMessageText(`${originalText}\n\n*Rejected*`, { parse_mode: 'Markdown' });
        } else {
          await ctx.editMessageText(`${originalText}\n\n_Awaiting rejection reason\\.\\.\\._`, {
            parse_mode: 'MarkdownV2',
          });
          const prompt = await ctx.api.sendMessage(
            this.ownerChatId!,
            'Reply to this message with your rejection reason:',
            {
              parse_mode: 'MarkdownV2',
              reply_markup: { force_reply: true, selective: true },
            },
          );
          await this.db.db
            .update(pendingApprovals)
            .set({ telegramThreadId: `REJECT_REASON:${prompt.message_id}` })
            .where(eq(pendingApprovals.id, approvalId));
        }
      },
    );

    // KB proposal callbacks
    this.bot.callbackQuery(
      /^kbproposal:([^:]+):(approve|reject)$/,
      async (ctx) => {
        const fromId = ctx.from?.id ? String(ctx.from.id) : null;
        if (!this.isOwner(fromId)) {
          await ctx.answerCallbackQuery({ text: 'Unauthorized' });
          return;
        }

        const [, proposalId, action] = ctx.match!;
        await ctx.answerCallbackQuery();
        const originalText = ctx.msg?.text ?? '';

        try {
          if (action === 'approve') {
            await this.selfImproveSvc.approveProposal(proposalId);
            await ctx.editMessageText(`${originalText}\n\n*Added to Knowledge Base*`, {
              parse_mode: 'Markdown',
            });
          } else {
            await this.selfImproveSvc.rejectProposal(proposalId);
            await ctx.editMessageText(`${originalText}\n\n*Skipped*`, {
              parse_mode: 'Markdown',
            });
          }
        } catch (err) {
          this.logger.error(`KB proposal ${action} failed: ${err}`);
          await ctx.editMessageText(`${originalText}\n\nAction failed`, { parse_mode: 'Markdown' });
        }
      },
    );

    // Agent picker callback: route:<pendingId>:<agentKey>
    this.bot.callbackQuery(/^route:(\d+):(.+)$/, async (ctx) => {
      const fromId = ctx.from?.id ? String(ctx.from.id) : null;
      if (!this.isOwner(fromId)) {
        await ctx.answerCallbackQuery({ text: 'Unauthorized' });
        return;
      }

      const [, pendingId, agentKey] = ctx.match!;
      await ctx.answerCallbackQuery();

      const pending = this.pendingRoutes.get(pendingId);
      this.pendingRoutes.delete(pendingId);

      if (!pending || Date.now() > pending.expiresAt) {
        await ctx.editMessageText('This request expired. Please send your message again.');
        return;
      }

      const agent = ROUTABLE_AGENTS.find((a) => a.key === agentKey);
      await ctx.editMessageText(`Routing to *${agent?.name ?? agentKey}*...`, { parse_mode: 'Markdown' });

      try {
        await this.agentRuntime.triggerAgent(agentKey, 'MANUAL', { instructions: pending.text });
        await ctx.editMessageText(`Sent to *${agent?.name ?? agentKey}*. Check the run in the dashboard.`, { parse_mode: 'Markdown' });
      } catch (err) {
        await ctx.editMessageText(`Failed to trigger ${agentKey}: ${(err as Error).message}`);
      }
    });

    // All incoming text messages
    this.bot.on('message:text', async (ctx) => {
      const fromId = ctx.from?.id ? String(ctx.from.id) : null;
      if (!this.isOwner(fromId)) return;

      const replyTo = ctx.message.reply_to_message;
      const text = ctx.message.text;

      if (replyTo) {
        // Existing follow-up / rejection-reason flow
        const replyToMsgId = String(replyTo.message_id);

        const [followupApproval] = await this.db.db
          .select()
          .from(pendingApprovals)
          .where(
            and(
              eq(pendingApprovals.telegramThreadId, replyToMsgId),
              eq(pendingApprovals.status, 'FOLLOWUP'),
            ),
          )
          .limit(1);

        if (followupApproval) {
          await this.approvalSvc.followup(followupApproval.id, text);
          await ctx.reply('Follow\\-up received\\. Re\\-evaluating\\.\\.\\.', {
            parse_mode: 'MarkdownV2',
          });
          return;
        }

        const [rejectApproval] = await this.db.db
          .select()
          .from(pendingApprovals)
          .where(eq(pendingApprovals.telegramThreadId, `REJECT_REASON:${replyToMsgId}`))
          .limit(1);

        if (rejectApproval) {
          await this.approvalSvc.rejectWithReason(rejectApproval.id, text);
          await ctx.reply('Rejected with reason recorded\\.', { parse_mode: 'MarkdownV2' });
          return;
        }

        // Reply that doesn't match an approval — treat as a new instruction
      }

      // Conversational routing
      await this.handleConversation(ctx, text);
    });
  }

  private async handleConversation(ctx: { reply: (text: string, opts?: object) => Promise<unknown> }, text: string) {
    // 0. Smalltalk / greeting / help — answer directly, don't pick an agent
    if (this.isSmalltalk(text)) {
      await ctx.reply(this.smalltalkReply(text), { parse_mode: 'Markdown' });
      return;
    }

    // 1. Detect timed reminder (absolute or relative) before routing
    try {
      const reminder = await this.detectReminder(text);
      if (reminder) {
        await this.db.db.insert(tasks).values({
          title: 'Reminder',
          instructions: `REMINDER: ${reminder.message}`,
          agentKey: 'daily_reminder',
          status: 'pending',
          nextRunAt: reminder.sendAt,
        });
        await ctx.reply(
          `Reminder scheduled for *${reminder.sendAtLabel}*\n_"${reminder.message}"_`,
          { parse_mode: 'Markdown' },
        );
        return;
      }
    } catch (err) {
      this.logger.warn(`Reminder detection failed: ${(err as Error).message}`);
    }

    // 2. Check for @mention: "@daily_reminder what's my status?"
    const mentionMatch = text.match(/^@(\S+)\s+([\s\S]+)/i);
    if (mentionMatch) {
      const [, mention, instruction] = mentionMatch;
      const agent = this.resolveAgentByAlias(mention.toLowerCase());
      if (agent) {
        await ctx.reply(`Routing to *${agent.name}*...`, { parse_mode: 'Markdown' });
        try {
          await this.agentRuntime.triggerAgent(agent.key, 'MANUAL', { instructions: instruction.trim() });
          await ctx.reply(`Done. *${agent.name}* is running — check the dashboard for results.`, { parse_mode: 'Markdown' });
        } catch (err) {
          await ctx.reply(`Failed: ${(err as Error).message}`);
        }
        return;
      }
    }

    // 3. LLM auto-classify
    try {
      const agentKey = await this.classifyWithLlm(text);
      if (agentKey) {
        const agent = ROUTABLE_AGENTS.find((a) => a.key === agentKey)!;
        await ctx.reply(`Routing to *${agent.name}*...`, { parse_mode: 'Markdown' });
        await this.agentRuntime.triggerAgent(agentKey, 'MANUAL', { instructions: text });
        await ctx.reply(`Done. *${agent.name}* is running — check the dashboard for results.`, { parse_mode: 'Markdown' });
        return;
      }
    } catch (err) {
      this.logger.warn(`LLM routing failed: ${(err as Error).message}`);
    }

    // 4. Show agent picker as last resort
    await this.showAgentPicker(ctx, text);
  }

  // Single-word greetings / acknowledgments / goodbyes. All lowercase, no punctuation.
  private static SMALLTALK_WORDS: readonly string[] = [
    // English greetings
    'hi', 'hii', 'hiii', 'hiiii', 'hello', 'helo', 'hellooo', 'hey', 'heyy', 'heya', 'heyo', 'hiya',
    'yo', 'yoo', 'sup', 'wassup', 'wazzup', 'howdy', 'greetings', 'salutations',
    'morning', 'afternoon', 'evening', 'night', 'gm', 'gn', 'ge', 'ga',
    // Other languages
    'hola', 'bonjour', 'ciao', 'aloha', 'namaste', 'namaskar', 'nomoshkar',
    'salam', 'salaam', 'slm', 'assalamualaikum', 'walaikumassalam', 'walaikumsalam', 'marhaba',
    'kemon', 'kemne', 'kemoncho', 'bhalo', 'achi', 'vai', 'bhai', 'bhaiya', 'apu', 'apa', 'apurokom',
    // Acknowledgments / fillers
    'ok', 'okk', 'okay', 'kk', 'k', 'alright', 'aight', 'sure', 'fine', 'cool', 'nice', 'great',
    'awesome', 'amazing', 'perfect', 'brilliant', 'lovely', 'sweet', 'neat', 'gotcha', 'roger',
    'ack', 'acked', 'noted', 'understood', 'right', 'yep', 'yeah', 'yup', 'yes', 'yo', 'yass',
    'no', 'nope', 'nah', 'naah',
    // Thanks
    'thanks', 'thx', 'thnx', 'tnx', 'ty', 'tysm', 'thankyou', 'thanku', 'thanq', 'cheers', 'kudos',
    // Goodbyes
    'bye', 'byee', 'byeee', 'goodbye', 'cya', 'cyaa', 'ttyl', 'gtg', 'peace', 'later', 'farewell',
    'tata',
    // Help / capability
    'help', 'menu', 'commands', 'command', 'options', 'option', 'capabilities', 'capability',
    'start', 'about',
  ];

  private static SMALLTALK_PHRASES: readonly RegExp[] = [
    /^good\s*(morning|afternoon|evening|night|day)$/i,
    /^how\s+(are|r)\s+(you|u|ya|yall|y'all)\b.*$/i,
    /^how(\s+are)?\s+things\b.*$/i,
    /^how(\s+is|'s|s)\s+it\s+going\b.*$/i,
    /^how\s+do\s+you\s+do\b.*$/i,
    /^what'?s\s+up\b.*$/i,
    /^whats\s*up\b.*$/i,
    /^thank\s+you(\s+(so\s+much|very\s+much|very\s+kindly))?$/i,
    /^thanks\s+(a\s+lot|a\s+ton|a\s+bunch|so\s+much|very\s+much)$/i,
    /^much\s+(appreciated|thanks)$/i,
    /^appreciate\s+(it|that|you)$/i,
    /^got\s+it$/i,
    /^all\s+good$/i,
    /^no\s+(worries|problem|prob|probs)$/i,
    /^see\s+(you|ya|u)(\s+(later|soon|tomorrow))?$/i,
    /^talk\s+(to\s+you\s+)?later$/i,
    /^take\s+care$/i,
    /^have\s+a\s+(good|great|nice)\s+(day|one|night|evening)$/i,
    /^what\s+can\s+you\s+do\b.*$/i,
    /^who\s+(are|r)\s+you\b.*$/i,
    /^what\s+(are|r)\s+you\b.*$/i,
    /^who\s+is\s+this\b.*$/i,
    /^assalamu?\s*alaikum.*$/i,
    /^kemon\s+acho\b.*$/i,
    /^bhalo\s+achi\b.*$/i,
  ];

  private isSmalltalk(text: string): boolean {
    const normalized = normalizeForGreeting(text);
    if (!normalized) return true;
    if (normalized.length === 1) return true;

    // Fast O(1) lookup against the curated 500+ greeting list.
    if (GREETING_SET.has(normalized)) return true;

    // Telegram slash commands — always smalltalk.
    if (/^\/(start|help|menu|about)\b/i.test(text.trim())) return true;

    // Multi-word phrase patterns (catches free-form variations).
    for (const re of TelegramService.SMALLTALK_PHRASES) {
      if (re.test(normalized)) return true;
    }

    // Token-only check: every token must be a known smalltalk word.
    const tokens = normalized.split(' ').filter(Boolean);
    if (tokens.length === 0) return true;
    if (tokens.length <= 4) {
      const all = tokens.every((tok) => TelegramService.SMALLTALK_WORDS.includes(tok));
      if (all) return true;
    }

    return false;
  }

  private smalltalkReply(text: string): string {
    const t = text.trim().toLowerCase();
    if (/^(thanks|thank\s+you|thx|thnx|tnx|ty|tysm|thanku|thanq|much\s+(appreciated|thanks)|appreciate\s+(it|that|you)|cheers|kudos)\b/i.test(t)) {
      return 'You got it.';
    }
    if (/^(bye|byee|goodbye|cya|ttyl|gtg|peace|later|farewell|tata|see\s+(you|ya|u)|take\s+care|talk\s+(to\s+you\s+)?later)\b/i.test(t)) {
      return 'Talk later.';
    }
    if (/^(ok+|okk|okay|kk|k|alright|aight|sure|fine|cool|nice|great|awesome|amazing|perfect|brilliant|lovely|sweet|neat|gotcha|roger|ack|noted|understood|right|yep|yeah|yup|yes|no|nope|nah|naah)\b/i.test(t)) {
      return 'Noted.';
    }
    const agentList = ROUTABLE_AGENTS.map((a) => `• *${a.name}* — ${a.desc}`).join('\n');
    return [
      'Hi. I route messages to your agents.',
      '',
      'Try things like:',
      '• `remind me to drink water in 5 minutes`',
      '• `draft a reply to the latest email`',
      '• `give me today\'s status`',
      '• `@linkedin connect with the new sign-ups`',
      '',
      '*Agents available:*',
      agentList,
    ].join('\n');
  }

  private async classifyWithLlm(text: string): Promise<string | null> {
    const agentList = ROUTABLE_AGENTS.map((a) => `- ${a.key}: ${a.desc}`).join('\n');

    const response = await this.llm.complete({
      provider: 'auto',
      messages: [
        {
          role: 'system',
          content: `You route a single user message to ONE agent in an AI agent platform.

Available agents:
${agentList}

Decision rules:
- Pick the single best-matching agent. Bias toward picking an agent rather than null — only use null for pure greetings or off-topic messages.
- Reminders, motivational messages, daily briefs, status checks, scheduled notes → daily_reminder
- Anything about emails, inbox, drafting replies, Gmail → email_manager
- Customer support / live chat / Crisp conversations → crisp
- LinkedIn connections, outreach, DMs, posts → linkedin
- Reddit threads, comments, monitoring keywords → reddit
- Twitter/X, Facebook, social posts, scheduling → social
- WhatsApp messages or numbers → whatsapp
- Trial signups, onboarding emails for Taskip → taskip_trial
- Leave / salary / payroll / employee questions → hr
- Designs, banners, posters, Canva → canva
- YouTube Shorts, video scripts, short-form video → shorts

Output ONLY JSON, no prose, no markdown:
{"agent": "<agent_key>", "confidence": "high|medium|low"}
Use {"agent": null, "confidence": "low"} only for greetings, thanks, or genuinely unrelated chatter.

Examples:
"send me a motivational message in 5 min" -> {"agent":"daily_reminder","confidence":"high"}
"remind me to call mom at 8pm" -> {"agent":"daily_reminder","confidence":"high"}
"what's my status today?" -> {"agent":"daily_reminder","confidence":"high"}
"draft a reply to the latest email from Bob" -> {"agent":"email_manager","confidence":"high"}
"any new support chats?" -> {"agent":"crisp","confidence":"high"}
"connect with the new sign-ups on LinkedIn" -> {"agent":"linkedin","confidence":"high"}
"write a youtube short about productivity" -> {"agent":"shorts","confidence":"high"}
"design a banner for the landing page" -> {"agent":"canva","confidence":"high"}
"how many trial users today" -> {"agent":"taskip_trial","confidence":"high"}
"approve John's leave request" -> {"agent":"hr","confidence":"high"}
"hello" -> {"agent":null,"confidence":"low"}`,
        },
        { role: 'user', content: text },
      ],
      maxTokens: 60,
      temperature: 0,
    });

    try {
      const raw = response.content.trim().replace(/^```json\s*|```$/g, '');
      const parsed = JSON.parse(raw) as { agent: string | null; confidence: string };
      if ((parsed.confidence === 'high' || parsed.confidence === 'medium') && parsed.agent) {
        const valid = ROUTABLE_AGENTS.find((a) => a.key === parsed.agent);
        return valid ? valid.key : null;
      }
    } catch {
      // ignore parse errors — fall through to picker
    }
    return null;
  }

  private async showAgentPicker(ctx: { reply: (text: string, opts?: object) => Promise<unknown> }, text: string) {
    this.cleanExpiredRoutes();

    const pendingId = String(++this.pendingRouteCounter);
    this.pendingRoutes.set(pendingId, { text, expiresAt: Date.now() + 5 * 60 * 1000 });

    const keyboard = new InlineKeyboard();
    ROUTABLE_AGENTS.forEach((agent, i) => {
      keyboard.text(agent.name, `route:${pendingId}:${agent.key}`);
      if (i % 2 === 1) keyboard.row();
    });
    if (ROUTABLE_AGENTS.length % 2 !== 0) keyboard.row();

    await ctx.reply(
      "I'm not sure which agent should handle this. Pick one:",
      { reply_markup: keyboard },
    );
  }

  private async detectReminder(text: string): Promise<{ message: string; sendAt: Date; sendAtLabel: string } | null> {
    const nowUtc = new Date();
    const tz = (await this.settings.getDecrypted('timezone')) || 'UTC';
    const nowLocal = nowUtc.toLocaleString('en-US', { timeZone: tz, hour12: false });

    // Fast path: relative-duration patterns ("in 5 min", "after 2 hours", "in next 30 minutes")
    const rel = this.parseRelativeDuration(text);
    if (rel) {
      const sendAt = new Date(nowUtc.getTime() + rel.minutes * 60 * 1000);
      return {
        message: rel.message,
        sendAt,
        sendAtLabel:
          sendAt.toLocaleString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: true }) +
          ` (in ${rel.minutes} min)`,
      };
    }

    const response = await this.llm.complete({
      provider: 'auto',
      messages: [
        {
          role: 'system',
          content: `You detect timed reminders in user messages. Current UTC time: ${nowUtc.toISOString()}. User timezone: ${tz}, local time now: ${nowLocal}.

A "reminder" is any request to be notified later — either at a specific time ("at 9pm"), or after a delay ("in 5 minutes", "after 2 hours"), or at a relative date ("tomorrow at 10am").

If it IS a reminder, return ONE of these two shapes:

(a) Absolute clock time today/tomorrow:
{"isReminder": true, "kind": "absolute", "message": "<clean reminder text>", "targetLocalHHMM": "HH:MM", "targetLocalLabel": "9:00 PM", "sendMinutesBefore": 0}

(b) Relative delay from now:
{"isReminder": true, "kind": "relative", "message": "<clean reminder text>", "delayMinutes": 5}

Rules:
- "in 5 min" / "after 5 minutes" / "in next 5min" → kind=relative, delayMinutes=5
- "at 9pm" / "9:30 in the evening" → kind=absolute, targetLocalHHMM in 24h, sendMinutesBefore=0 (or whatever the user says, e.g. "10 min before 9pm" → sendMinutesBefore=10)
- "tomorrow at 10am" → kind=absolute, targetLocalHHMM="10:00" (assume tomorrow if past)
- message: short, clean reminder text. For "send me a motivational message in 5 min" → message="Send a motivational message".
- If absolute time already passed today, assume tomorrow.

If NOT a reminder, return: {"isReminder": false}
Output ONLY JSON, no prose.`,
        },
        { role: 'user', content: text },
      ],
      maxTokens: 150,
      temperature: 0,
    });

    try {
      const raw = response.content.trim().replace(/^```json\s*|```$/g, '');
      const parsed = JSON.parse(raw) as {
        isReminder: boolean;
        kind?: 'absolute' | 'relative';
        message?: string;
        targetLocalHHMM?: string;
        targetLocalLabel?: string;
        sendMinutesBefore?: number;
        delayMinutes?: number;
      };

      if (!parsed.isReminder || !parsed.message) return null;

      if (parsed.kind === 'relative' && parsed.delayMinutes && parsed.delayMinutes > 0) {
        const sendAt = new Date(nowUtc.getTime() + parsed.delayMinutes * 60 * 1000);
        return {
          message: parsed.message,
          sendAt,
          sendAtLabel:
            sendAt.toLocaleString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: true }) +
            ` (in ${parsed.delayMinutes} min)`,
        };
      }

      if (parsed.targetLocalHHMM) {
        const [hh, mm] = parsed.targetLocalHHMM.split(':').map(Number);
        const sendBefore = parsed.sendMinutesBefore ?? 0;
        const sendAt = this.computeNextLocalTimeUtc(hh, mm, tz, nowUtc, sendBefore);
        const localLabel = sendAt.toLocaleString('en-US', {
          timeZone: tz,
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
        const eventLabel = parsed.targetLocalLabel ?? parsed.targetLocalHHMM;
        const beforeLabel = sendBefore > 0 ? ` (${sendBefore}min before ${eventLabel})` : '';
        return { message: parsed.message, sendAt, sendAtLabel: localLabel + beforeLabel };
      }

      return null;
    } catch {
      return null;
    }
  }

  private parseRelativeDuration(text: string): { minutes: number; message: string } | null {
    const m = text.match(/\b(?:in|after|after\s+next|in\s+next)\s+(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours)\b/i);
    if (!m) return null;
    const value = parseInt(m[1], 10);
    const unit = m[2].toLowerCase();
    let minutes: number;
    if (/^(s|sec|secs|second|seconds)$/.test(unit)) minutes = Math.max(1, Math.round(value / 60));
    else if (/^(h|hr|hrs|hour|hours)$/.test(unit)) minutes = value * 60;
    else minutes = value;
    if (minutes < 1 || minutes > 60 * 24 * 7) return null;

    let message = text.replace(m[0], '').trim();
    message = message.replace(/^(please\s+)?(can\s+you\s+)?(send|remind|tell|message|text)\s+me\s+(to\s+|about\s+)?/i, '').trim();
    message = message.replace(/^(a|an)\s+/i, '').trim();
    if (!message) message = text.trim();
    message = message.charAt(0).toUpperCase() + message.slice(1);
    return { minutes, message };
  }

  private computeNextLocalTimeUtc(hh: number, mm: number, tz: string, now: Date, minutesBefore: number): Date {
    // Find the next UTC instant where local-time-in-tz equals hh:mm.
    const nowParts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(now);
    const get = (k: string) => Number(nowParts.find((p) => p.type === k)?.value ?? '0');
    const localY = get('year'), localMo = get('month'), localD = get('day');
    const localH = get('hour'), localMi = get('minute');

    const offsetMin = (localH * 60 + localMi) - (now.getUTCHours() * 60 + now.getUTCMinutes());
    let candidateUtc = Date.UTC(localY, localMo - 1, localD, hh, mm, 0) - offsetMin * 60 * 1000;
    const nowMs = now.getTime();
    if (candidateUtc - minutesBefore * 60 * 1000 <= nowMs) {
      candidateUtc += 24 * 60 * 60 * 1000;
    }
    return new Date(candidateUtc - minutesBefore * 60 * 1000);
  }

  private resolveAgentByAlias(input: string): typeof ROUTABLE_AGENTS[0] | null {
    const normalized = input.replace(/_/g, '').toLowerCase();
    return (
      ROUTABLE_AGENTS.find(
        (a) =>
          a.key === input ||
          a.key.replace(/_/g, '') === normalized ||
          a.aliases.some((alias) => alias === normalized || alias === input),
      ) ?? null
    );
  }

  private cleanExpiredRoutes() {
    const now = Date.now();
    for (const [key, val] of this.pendingRoutes) {
      if (now > val.expiresAt) this.pendingRoutes.delete(key);
    }
  }

  private isOwner(fromId: string | null): boolean {
    return !!fromId && !!this.ownerChatId && fromId === this.ownerChatId;
  }

  private buildApprovalText(
    agentName: string,
    action: ProposedAction,
    runId: string,
  ): string {
    const risk = RISK_LABEL[action.riskLevel] ?? '[unknown]';
    return [
      `*${agentName}* proposes:`,
      `_${action.summary}_`,
      '',
      `Run: \`${runId}\``,
      `Action: \`${action.type}\``,
      `Risk: ${risk} ${action.riskLevel}`,
    ].join('\n');
  }
}
