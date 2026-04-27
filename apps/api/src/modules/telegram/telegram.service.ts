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
    // 0. Detect timed reminder before routing to any agent
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

    // 1. Check for @mention: "@daily_reminder what's my status?"
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

    // 2. LLM auto-classify
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

    // 3. Show agent picker
    await this.showAgentPicker(ctx, text);
  }

  private async classifyWithLlm(text: string): Promise<string | null> {
    const agentList = ROUTABLE_AGENTS.map((a) => `- ${a.key}: ${a.desc}`).join('\n');

    const response = await this.llm.complete({
      provider: 'auto',
      messages: [
        {
          role: 'system',
          content: `You are a router for an AI agent platform. Given a user message, determine which agent key should handle it.
Available agents:
${agentList}

Reply with ONLY a JSON object like: {"agent": "agent_key", "confidence": "high"}
If you cannot determine with high confidence, set agent to null: {"agent": null, "confidence": "low"}
Never explain. Only output the JSON.`,
        },
        { role: 'user', content: text },
      ],
      maxTokens: 60,
      temperature: 0,
    });

    try {
      const raw = response.content.trim().replace(/^```json\s*|```$/g, '');
      const parsed = JSON.parse(raw) as { agent: string | null; confidence: string };
      if (parsed.confidence === 'high' && parsed.agent) {
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
    // User is in Asia/Dhaka (UTC+6)
    const nowLocal = nowUtc.toLocaleString('en-US', { timeZone: 'Asia/Dhaka', hour12: false });
    const utcOffsetMs = 6 * 60 * 60 * 1000;

    const response = await this.llm.complete({
      provider: 'auto',
      messages: [
        {
          role: 'system',
          content: `You detect timed reminders in user messages. Current UTC time: ${nowUtc.toISOString()}. User is in Asia/Dhaka (UTC+6), local time: ${nowLocal}.

If the message is a reminder/schedule request with a specific time, return JSON:
{"isReminder": true, "message": "<clean reminder text>", "targetLocalHHMM": "HH:MM", "targetLocalLabel": "9:00 PM", "sendMinutesBefore": 10}

- message: short, clear reminder text (e.g. "Go to Nurul Ami Bhai's office")
- targetLocalHHMM: 24h format of the event time in Asia/Dhaka
- sendMinutesBefore: how many minutes before the event to send the reminder (default 10)
- If the time has already passed today, assume tomorrow.

If not a reminder, return: {"isReminder": false}
Only output JSON.`,
        },
        { role: 'user', content: text },
      ],
      maxTokens: 120,
      temperature: 0,
    });

    try {
      const raw = response.content.trim().replace(/^```json\s*|```$/g, '');
      const parsed = JSON.parse(raw) as {
        isReminder: boolean;
        message?: string;
        targetLocalHHMM?: string;
        targetLocalLabel?: string;
        sendMinutesBefore?: number;
      };

      if (!parsed.isReminder || !parsed.message || !parsed.targetLocalHHMM) return null;

      const [hh, mm] = parsed.targetLocalHHMM.split(':').map(Number);
      const sendBefore = parsed.sendMinutesBefore ?? 10;

      // Build target datetime in UTC
      const nowDhaka = new Date(nowUtc.getTime() + utcOffsetMs);
      const targetDhaka = new Date(nowDhaka);
      targetDhaka.setHours(hh, mm, 0, 0);
      if (targetDhaka <= nowDhaka) targetDhaka.setDate(targetDhaka.getDate() + 1);

      const sendAtDhaka = new Date(targetDhaka.getTime() - sendBefore * 60 * 1000);
      const sendAtUtc = new Date(sendAtDhaka.getTime() - utcOffsetMs);

      const sendAtLabel = sendAtDhaka.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }) + ` (${sendBefore}min before ${parsed.targetLocalLabel ?? parsed.targetLocalHHMM})`;

      return { message: parsed.message, sendAt: sendAtUtc, sendAtLabel };
    } catch {
      return null;
    }
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
