import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Bot, InlineKeyboard } from 'grammy';
import { eq, and, not, inArray } from 'drizzle-orm';
import { SettingsService } from '../settings/settings.service';
import { ApprovalService } from '../agents/runtime/approval.service';
import { AgentRuntimeService } from '../agents/runtime/agent-runtime.service';
import { LlmRouterService } from '../llm/llm-router.service';
import { DbService } from '../../db/db.service';
import { pendingApprovals } from '../../db/schema';
import { SelfImprovementService, KbProposalNotifyEvent } from '../knowledge-base/self-improvement.service';
import { HrmApiService } from '../agents/hr/hrm-api.service';
import { hrPayslipRuns } from '../../db/schema';
import type { ApprovalCreatedEvent } from './telegram.types';
import { TELEGRAM_EVENTS } from './telegram.types';
import type { ProposedAction } from '../agents/runtime/types';
import { TelegramBotAgent } from '../agents/telegram-bot/agent';

type HrPendingReply =
  | { type: 'leave_reject'; xghrmId: string; originalMsgId: number; originalText: string }
  | { type: 'wfh_reject'; xghrmId: string; originalMsgId: number; originalText: string }
  | { type: 'slip_edit'; runId: string; xghrmId: string; originalMsgId: number };

const RISK_LABEL: Record<string, string> = {
  low: '[low]',
  medium: '[medium]',
  high: '[HIGH]',
};

// Agents available for routing — key must match IAgent.key
const ROUTABLE_AGENTS = [
  { key: 'daily_reminder', name: 'Daily Reminder', aliases: ['daily', 'reminder', 'brief', 'status'], desc: 'Status updates, pending tasks, daily briefs, system status' },
  { key: 'email_manager', name: 'Email Manager', aliases: ['email', 'gmail', 'inbox', 'mail'], desc: 'Email inbox, draft replies, Gmail' },
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

  // Keyed by the message_id of the force_reply prompt sent to the operator
  private hrPendingReplies = new Map<number, HrPendingReply>();

  constructor(
    private readonly settings: SettingsService,
    private readonly approvalSvc: ApprovalService,
    private readonly agentRuntime: AgentRuntimeService,
    private readonly llm: LlmRouterService,
    private readonly db: DbService,
    private readonly selfImproveSvc: SelfImprovementService,
    private readonly hrm: HrmApiService,
    @Inject(forwardRef(() => TelegramBotAgent))
    private readonly botAgent: TelegramBotAgent,
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

      // Register native Telegram slash commands so they appear in the "/" menu.
      this.bot.api.setMyCommands([
        { command: 'help', description: 'Show shortcuts and examples' },
        { command: 'remind', description: 'Schedule a reminder (e.g. /remind drink water)' },
        { command: 'status', description: "Today's briefing from Daily Reminder" },
        { command: 'agents', description: 'List all available agents' },
        { command: 'inbox', description: 'Pending approvals' },
        { command: 'cancel', description: 'Cancel the pending reminder I asked you about' },
      ]).catch((err: Error) => this.logger.warn(`setMyCommands failed: ${err.message}`));

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
    await this.bot.api.sendMessage(this.ownerChatId, text);
  }

  async sendMessageWithKeyboard(text: string, keyboard: InlineKeyboard): Promise<{ message_id: number } | null> {
    if (!this.bot || !this.ownerChatId) return null;
    return this.bot.api.sendMessage(this.ownerChatId, text, { reply_markup: keyboard });
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
      await this.bot.api.sendMessage(this.ownerChatId, event.text, { reply_markup: keyboard });
    } catch (err) {
      this.logger.error(`Failed to send KB proposal message: ${(err as Error).message}`);
    }
  }

  private registerHandlers() {
    if (!this.bot) return;

    // Ensure ownerChatId is always resolved before any handler runs.
    this.bot.use(async (_ctx, next) => {
      await this.resolveOwnerChatId();
      return next();
    });

    // ── Native slash commands ──────────────────────────────────────────────
    this.bot.command('help', async (ctx) => {
      const fromId = ctx.from?.id ? String(ctx.from.id) : null;
      if (!this.isOwner(fromId)) return;
      try {
        await ctx.reply(this.botAgent.helpReply(), { parse_mode: 'Markdown' });
      } catch {
        await ctx.reply(this.botAgent.helpReply().replace(/[*_`[\]]/g, '')).catch(() => {});
      }
    });

    this.bot.command('cancel', async (ctx) => {
      const fromId = ctx.from?.id ? String(ctx.from.id) : null;
      if (!this.isOwner(fromId)) return;
      try {
        const tz = (await this.settings.getDecrypted('timezone')) || 'UTC';
        const result = await this.botAgent.routeMessage('/cancel', fromId ?? 'default', tz);
        if (result.kind === 'cancelled') await ctx.reply(result.reply);
        else await ctx.reply('Nothing to cancel.');
      } catch (err) {
        await ctx.reply(`Error: ${(err as Error).message}`);
      }
    });

    this.bot.command('remind', async (ctx) => {
      const fromId = ctx.from?.id ? String(ctx.from.id) : null;
      if (!this.isOwner(fromId)) return;
      try {
        const body = (ctx.match ?? '').toString().trim();
        if (!body) {
          await ctx.reply('Usage: /remind <what> [in 30 min | tomorrow at 9am]\nExample: /remind drink water in 5 min');
          return;
        }
        const tz = (await this.settings.getDecrypted('timezone')) || 'UTC';
        await ctx.api.sendChatAction(ctx.chat.id, 'typing');
        const result = await this.botAgent.routeMessage(body, fromId ?? 'default', tz);
        await this.dispatchRouteResult(ctx, result);
      } catch (err) {
        await ctx.reply(`Error: ${(err as Error).message}`);
      }
    });

    this.bot.command('status', async (ctx) => {
      const fromId = ctx.from?.id ? String(ctx.from.id) : null;
      if (!this.isOwner(fromId)) return;
      try {
        await ctx.reply('Triggering Daily Reminder...');
        await this.agentRuntime.triggerAgent('daily_reminder', 'MANUAL', { instructions: "Today's status briefing" });
        await ctx.reply('Daily Reminder is running. Results will arrive shortly.');
      } catch (err) {
        await ctx.reply(`Failed: ${(err as Error).message}`);
      }
    });

    this.bot.command('agents', async (ctx) => {
      const fromId = ctx.from?.id ? String(ctx.from.id) : null;
      if (!this.isOwner(fromId)) return;
      try {
        const list = ROUTABLE_AGENTS.map((a) => `• ${a.name} (@${a.key}) — ${a.desc}`).join('\n');
        await ctx.reply(`Agents available\n\n${list}\n\nMention with @<key> to delegate, e.g. "@email_manager draft a reply to Bob".`);
      } catch (err) {
        await ctx.reply(`Error: ${(err as Error).message}`);
      }
    });

    this.bot.command('inbox', async (ctx) => {
      const fromId = ctx.from?.id ? String(ctx.from.id) : null;
      if (!this.isOwner(fromId)) return;
      try {
        const pending = await this.approvalSvc.getPending();
        if (!pending.length) {
          await ctx.reply('No pending approvals.');
          return;
        }
        const lines = pending.slice(0, 10).map((p) => `• ${(p.action as { summary?: string } | null)?.summary ?? p.id}`);
        await ctx.reply(`Pending approvals (${pending.length})\n${lines.join('\n')}`);
      } catch (err) {
        await ctx.reply(`Failed to fetch inbox: ${(err as Error).message}`);
      }
    });

    // Quick-time inline buttons used by the "ask_for_time" reply.
    this.bot.callbackQuery(/^remind_in:(\d+)$/, async (ctx) => {
      const fromId = ctx.from?.id ? String(ctx.from.id) : null;
      if (!this.isOwner(fromId)) {
        await ctx.answerCallbackQuery({ text: 'Unauthorized' });
        return;
      }
      const minutes = parseInt(ctx.match![1], 10);
      await ctx.answerCallbackQuery();
      const tz = (await this.settings.getDecrypted('timezone')) || 'UTC';
      const res = await this.botAgent.resolvePendingReminderWithDelay(fromId ?? 'default', minutes, tz);
      const original = ctx.msg?.text ?? '';
      await ctx.editMessageText(`${original}\n\n${res.reply}`);
    });

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

        try {
          if (action === 'approve') {
            await this.approvalSvc.approve(approvalId);
            await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
            await ctx.reply('Approved.');
          } else if (action === 'reject') {
            const keyboard = new InlineKeyboard()
              .text('Reject silently', `reject:${approvalId}:silent`)
              .text('Reject + reason', `reject:${approvalId}:reason`);
            await ctx.editMessageReplyMarkup({ reply_markup: keyboard });
          } else if (action === 'followup') {
            const prompt = await ctx.api.sendMessage(
              this.ownerChatId!,
              'Reply to this message with your follow-up instruction:',
              { reply_markup: { force_reply: true, selective: true } },
            );
            await this.db.db
              .update(pendingApprovals)
              .set({ telegramThreadId: String(prompt.message_id), status: 'FOLLOWUP' })
              .where(eq(pendingApprovals.id, approvalId));
            await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
          }
        } catch (err) {
          this.logger.error(`approval ${action} failed for ${approvalId}: ${err}`);
          await ctx.reply(`Action failed: ${(err as Error).message}`);
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

        try {
          if (subAction === 'silent') {
            await this.approvalSvc.rejectWithReason(approvalId, null);
            await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
            await ctx.reply('Rejected.');
          } else {
            const prompt = await ctx.api.sendMessage(
              this.ownerChatId!,
              'Reply to this message with your rejection reason:',
              { reply_markup: { force_reply: true, selective: true } },
            );
            await this.db.db
              .update(pendingApprovals)
              .set({ telegramThreadId: `REJECT_REASON:${prompt.message_id}` })
              .where(eq(pendingApprovals.id, approvalId));
            await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
          }
        } catch (err) {
          this.logger.error(`reject sub-action ${subAction} failed for ${approvalId}: ${err}`);
          await ctx.reply(`Action failed: ${(err as Error).message}`);
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

        try {
          if (action === 'approve') {
            await this.selfImproveSvc.approveProposal(proposalId);
            await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
            await ctx.reply('KB proposal accepted and added to Knowledge Base.');
          } else {
            await this.selfImproveSvc.rejectProposal(proposalId);
            await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
            await ctx.reply('KB proposal skipped.');
          }
        } catch (err) {
          this.logger.error(`KB proposal ${action} failed: ${err}`);
          await ctx.reply(`KB proposal action failed: ${(err as Error).message}`);
        }
      },
    );

    // HR: leave approve
    this.bot.callbackQuery(/^hr_leave_approve:(.+)$/, async (ctx) => {
      if (!this.isOwner(ctx.from?.id ? String(ctx.from.id) : null)) {
        await ctx.answerCallbackQuery({ text: 'Unauthorized' });
        return;
      }
      const [, leaveId] = ctx.match!;
      await ctx.answerCallbackQuery();
      try {
        await this.hrm.approveLeave(leaveId);
        await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
        await ctx.reply('Leave approved.');
      } catch (err) {
        await ctx.reply(`Failed: ${(err as Error).message}`);
      }
    });

    // HR: leave reject — ask for reason
    this.bot.callbackQuery(/^hr_leave_reject:(.+)$/, async (ctx) => {
      if (!this.isOwner(ctx.from?.id ? String(ctx.from.id) : null)) {
        await ctx.answerCallbackQuery({ text: 'Unauthorized' });
        return;
      }
      const [, leaveId] = ctx.match!;
      await ctx.answerCallbackQuery();
      await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
      const original = ctx.msg?.text ?? '';
      const prompt = await ctx.api.sendMessage(this.ownerChatId!, 'Reason for rejecting this leave:', {
        reply_markup: { force_reply: true, selective: true },
      });
      this.hrPendingReplies.set(prompt.message_id, {
        type: 'leave_reject',
        xghrmId: leaveId,
        originalMsgId: ctx.msg!.message_id,
        originalText: original,
      });
    });

    // HR: WFH approve
    this.bot.callbackQuery(/^hr_wfh_approve:(.+)$/, async (ctx) => {
      if (!this.isOwner(ctx.from?.id ? String(ctx.from.id) : null)) {
        await ctx.answerCallbackQuery({ text: 'Unauthorized' });
        return;
      }
      const [, wfhId] = ctx.match!;
      await ctx.answerCallbackQuery();
      try {
        await this.hrm.approveWfh(wfhId);
        await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
        await ctx.reply('WFH approved.');
      } catch (err) {
        await ctx.reply(`Failed: ${(err as Error).message}`);
      }
    });

    // HR: WFH reject — ask for reason
    this.bot.callbackQuery(/^hr_wfh_reject:(.+)$/, async (ctx) => {
      if (!this.isOwner(ctx.from?.id ? String(ctx.from.id) : null)) {
        await ctx.answerCallbackQuery({ text: 'Unauthorized' });
        return;
      }
      const [, wfhId] = ctx.match!;
      await ctx.answerCallbackQuery();
      await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
      const original = ctx.msg?.text ?? '';
      const prompt = await ctx.api.sendMessage(this.ownerChatId!, 'Reason for rejecting this WFH:', {
        reply_markup: { force_reply: true, selective: true },
      });
      this.hrPendingReplies.set(prompt.message_id, {
        type: 'wfh_reject',
        xghrmId: wfhId,
        originalMsgId: ctx.msg!.message_id,
        originalText: original,
      });
    });

    // HR: payslip approve
    this.bot.callbackQuery(/^hr_slip_approve:([^:]+):(.+)$/, async (ctx) => {
      if (!this.isOwner(ctx.from?.id ? String(ctx.from.id) : null)) {
        await ctx.answerCallbackQuery({ text: 'Unauthorized' });
        return;
      }
      const [, runId, xghrmId] = ctx.match!;
      await ctx.answerCallbackQuery();
      try {
        await this.hrm.approvePayslip(xghrmId);
        await this.db.db.update(hrPayslipRuns).set({ status: 'approved' }).where(eq(hrPayslipRuns.id, runId));
        await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
        await ctx.reply('Payslip approved.');
        await this.checkPayslipRunComplete(runId);
      } catch (err) {
        await ctx.reply(`Failed: ${(err as Error).message}`);
      }
    });

    // HR: payslip edit — ask for bonus/deductions
    this.bot.callbackQuery(/^hr_slip_edit:([^:]+):(.+)$/, async (ctx) => {
      if (!this.isOwner(ctx.from?.id ? String(ctx.from.id) : null)) {
        await ctx.answerCallbackQuery({ text: 'Unauthorized' });
        return;
      }
      const [, runId, xghrmId] = ctx.match!;
      await ctx.answerCallbackQuery();
      await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
      const prompt = await ctx.api.sendMessage(
        this.ownerChatId!,
        'Enter new values (e.g. bonus=5000 deductions=2000):',
        { reply_markup: { force_reply: true, selective: true } },
      );
      this.hrPendingReplies.set(prompt.message_id, {
        type: 'slip_edit',
        runId,
        xghrmId,
        originalMsgId: ctx.msg!.message_id,
      });
      await this.db.db.update(hrPayslipRuns).set({ status: 'edit_requested' }).where(eq(hrPayslipRuns.id, runId));
    });

    // HR: payslip skip
    this.bot.callbackQuery(/^hr_slip_skip:(.+)$/, async (ctx) => {
      if (!this.isOwner(ctx.from?.id ? String(ctx.from.id) : null)) {
        await ctx.answerCallbackQuery({ text: 'Unauthorized' });
        return;
      }
      const [, runId] = ctx.match!;
      await ctx.answerCallbackQuery();
      await this.db.db.update(hrPayslipRuns).set({ status: 'skipped' }).where(eq(hrPayslipRuns.id, runId));
      await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
      await ctx.reply('Payslip skipped.');
      await this.checkPayslipRunComplete(runId);
    });

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
      await ctx.editMessageText(`Routing to ${agent?.name ?? agentKey}...`);

      try {
        await this.agentRuntime.triggerAgent(agentKey, 'MANUAL', { instructions: pending.text });
        await ctx.editMessageText(`Sent to ${agent?.name ?? agentKey}. Check the run in the dashboard.`);
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

        // HR pending reply (leave reject, WFH reject, payslip edit)
        const hrPending = this.hrPendingReplies.get(replyTo.message_id);
        if (hrPending) {
          this.hrPendingReplies.delete(replyTo.message_id);
          await this.handleHrPendingReply(ctx, hrPending, text);
          return;
        }

        // Reply that doesn't match an approval — treat as a new instruction
      }

      // Conversational routing
      await this.handleConversation(ctx, text, fromId ?? 'default');
    });
  }

  private async handleConversation(
    ctx: { reply: (text: string, opts?: object) => Promise<unknown>; chat?: { id: number }; api?: { sendChatAction: (id: number, action: string) => Promise<unknown> } },
    text: string,
    chatId: string,
  ) {
    const tz = (await this.settings.getDecrypted('timezone')) || 'UTC';

    // Show "typing..." while the LLM thinks.
    if (ctx.chat?.id && ctx.api?.sendChatAction) {
      ctx.api.sendChatAction(ctx.chat.id, 'typing').catch(() => { /* best-effort */ });
    }

    let result;
    try {
      result = await this.botAgent.routeMessage(text, chatId, tz);
    } catch (err) {
      this.logger.warn(`TelegramBotAgent routeMessage failed: ${(err as Error).message}`);
      await this.showAgentPicker(ctx, text);
      return;
    }
    await this.dispatchRouteResult(ctx, result);
  }

  private async dispatchRouteResult(
    ctx: { reply: (text: string, opts?: object) => Promise<unknown> },
    result: Awaited<ReturnType<TelegramBotAgent['routeMessage']>>,
  ) {
    switch (result.kind) {
      case 'smalltalk':
      case 'help':
      case 'cancelled':
      case 'reminder_scheduled':
      case 'time_unparseable':
      case 'clarify':
        await ctx.reply(result.reply);
        return;

      case 'ask_for_time': {
        const kb = new InlineKeyboard()
          .text('In 10 min', 'remind_in:10').text('In 30 min', 'remind_in:30').row()
          .text('In 1 hour', 'remind_in:60').text('In 2 hours', 'remind_in:120').row()
          .text('In 4 hours', 'remind_in:240').text('In 8 hours', 'remind_in:480').row();
        await ctx.reply(result.reply, { reply_markup: kb });
        return;
      }

      case 'mention_route':
      case 'classified_route':
        await ctx.reply(`Routing to ${result.agentName}...`);
        try {
          await this.agentRuntime.triggerAgent(result.agentKey, 'MANUAL', { instructions: result.instructions });
          await ctx.reply(`Done. ${result.agentName} is running — check the dashboard for results.`);
        } catch (err) {
          await ctx.reply(`Failed: ${(err as Error).message}`);
        }
        return;

      case 'show_picker':
        await this.showAgentPicker(ctx, result.text);
        return;
    }
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


  private cleanExpiredRoutes() {
    const now = Date.now();
    for (const [key, val] of this.pendingRoutes) {
      if (now > val.expiresAt) this.pendingRoutes.delete(key);
    }
  }

  private async resolveOwnerChatId(): Promise<string | null> {
    if (!this.ownerChatId) {
      this.ownerChatId = await this.settings.getDecrypted('telegram_owner_chat_id');
    }
    return this.ownerChatId;
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
      `${agentName} proposes:`,
      action.summary,
      '',
      `Run: ${runId}`,
      `Action: ${action.type}`,
      `Risk: ${risk} ${action.riskLevel}`,
    ].join('\n');
  }

  private async handleHrPendingReply(
    ctx: { reply: (t: string, o?: object) => Promise<unknown>; api: { editMessageText: (chatId: string, msgId: number, text: string, opts?: object) => Promise<unknown>; editMessageReplyMarkup: (chatId: string, msgId: number, opts: object) => Promise<unknown> } },
    pending: HrPendingReply,
    text: string,
  ) {
    if (pending.type === 'leave_reject') {
      try {
        await this.hrm.rejectLeave(pending.xghrmId, text);
        await ctx.api.editMessageReplyMarkup(this.ownerChatId!, pending.originalMsgId, { reply_markup: { inline_keyboard: [] } });
        await ctx.reply(`Leave rejected. Reason: ${text}`);
      } catch (err) {
        await ctx.reply(`Failed to reject leave: ${(err as Error).message}`);
      }
      return;
    }

    if (pending.type === 'wfh_reject') {
      try {
        await this.hrm.rejectWfh(pending.xghrmId, text);
        await ctx.api.editMessageReplyMarkup(this.ownerChatId!, pending.originalMsgId, { reply_markup: { inline_keyboard: [] } });
        await ctx.reply(`WFH rejected. Reason: ${text}`);
      } catch (err) {
        await ctx.reply(`Failed to reject WFH: ${(err as Error).message}`);
      }
      return;
    }

    if (pending.type === 'slip_edit') {
      // Parse "bonus=5000 deductions=2000" — fields are optional
      const bonusMatch = text.match(/bonus\s*=\s*(\d+)/i);
      const deductMatch = text.match(/deductions?\s*=\s*(\d+)/i);
      if (!bonusMatch && !deductMatch) {
        await ctx.reply('Could not parse values. Use format: bonus=5000 deductions=2000');
        return;
      }
      const data: { bonus?: number; deductions?: number } = {};
      if (bonusMatch) data.bonus = parseInt(bonusMatch[1], 10);
      if (deductMatch) data.deductions = parseInt(deductMatch[1], 10);
      try {
        const updated = await this.hrm.updatePayslip(pending.xghrmId, data);
        await this.db.db.update(hrPayslipRuns)
          .set({ netSalary: Math.round(updated.netSalary), status: 'tg_sent' })
          .where(eq(hrPayslipRuns.id, pending.runId));
        const kb = new InlineKeyboard()
          .text('Approve', `hr_slip_approve:${pending.runId}:${pending.xghrmId}`)
          .text('Edit again', `hr_slip_edit:${pending.runId}:${pending.xghrmId}`)
          .text('Skip', `hr_slip_skip:${pending.runId}`);
        const updatedText =
          `Payslip — ${updated.employeeName}\n` +
          `Month: ${updated.month}\n` +
          `Base: ${updated.currency} ${Number(updated.baseSalary).toLocaleString()}\n` +
          `Bonus: ${updated.currency} ${Number(updated.bonus).toLocaleString()}\n` +
          `Deductions: ${updated.currency} ${Number(updated.deductions).toLocaleString()}\n` +
          `Net: ${updated.currency} ${Number(updated.netSalary).toLocaleString()}`;
        await ctx.api.editMessageReplyMarkup(this.ownerChatId!, pending.originalMsgId, { reply_markup: kb });
        await ctx.reply(updatedText);
      } catch (err) {
        await ctx.reply(`Failed to update payslip: ${(err as Error).message}`);
      }
    }
  }

  private async checkPayslipRunComplete(runId: string) {
    const [run] = await this.db.db.select().from(hrPayslipRuns).where(eq(hrPayslipRuns.id, runId)).limit(1);
    if (!run) return;

    const remaining = await this.db.db
      .select()
      .from(hrPayslipRuns)
      .where(
        and(
          eq(hrPayslipRuns.month, run.month),
          not(inArray(hrPayslipRuns.status, ['approved', 'skipped'])),
        ),
      );

    if (remaining.length === 0) {
      const csvUrl = await this.hrm.exportPayslipsCsvUrl(run.month);
      await this.sendMessage(`Payslip run complete for ${run.month}.\nDownload CSV: ${csvUrl}`);
    }
  }
}
