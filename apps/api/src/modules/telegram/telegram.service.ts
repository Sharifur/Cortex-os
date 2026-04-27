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
import { DbService } from '../../db/db.service';
import { pendingApprovals } from '../../db/schema';
import { SelfImprovementService, KbProposalNotifyEvent } from '../knowledge-base/self-improvement.service';
import type { ApprovalCreatedEvent } from './telegram.types';
import { TELEGRAM_EVENTS } from './telegram.types';
import type { ProposedAction } from '../agents/runtime/types';

const RISK_EMOJI: Record<string, string> = {
  low: '🟢',
  medium: '🟡',
  high: '🔴',
};

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private bot: Bot | null = null;
  private ownerChatId: string | null = null;

  constructor(
    private readonly settings: SettingsService,
    private readonly approvalSvc: ApprovalService,
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
      .text('✅ Approve', `approval:${event.approvalId}:approve`)
      .text('❌ Reject', `approval:${event.approvalId}:reject`)
      .text('💬 Follow up', `approval:${event.approvalId}:followup`);

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
          await ctx.answerCallbackQuery({ text: '⛔ Unauthorized' });
          return;
        }

        const [, approvalId, action] = ctx.match!;
        await ctx.answerCallbackQuery();

        const originalText = ctx.msg?.text ?? '';

        if (action === 'approve') {
          await this.approvalSvc.approve(approvalId);
          await ctx.editMessageText(`${originalText}\n\n✅ *Approved*`, {
            parse_mode: 'Markdown',
          });
        } else if (action === 'reject') {
          const keyboard = new InlineKeyboard()
            .text('🚫 Reject silently', `reject:${approvalId}:silent`)
            .text('📝 Reject + reason', `reject:${approvalId}:reason`);
          await ctx.editMessageText(`${originalText}\n\n❌ Rejected — add a reason?`, {
            reply_markup: keyboard,
          });
        } else if (action === 'followup') {
          await ctx.editMessageText(
            `${originalText}\n\n💬 _Awaiting follow\\-up instruction\\.\\.\\._`,
            { parse_mode: 'MarkdownV2' },
          );
          const prompt = await ctx.api.sendMessage(
            this.ownerChatId!,
            '📝 Reply to this message with your follow\\-up instruction:',
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
          await ctx.answerCallbackQuery({ text: '⛔ Unauthorized' });
          return;
        }

        const [, approvalId, subAction] = ctx.match!;
        await ctx.answerCallbackQuery();
        const originalText = ctx.msg?.text ?? '';

        if (subAction === 'silent') {
          await this.approvalSvc.rejectWithReason(approvalId, null);
          await ctx.editMessageText(`${originalText}\n\n❌ *Rejected*`, { parse_mode: 'Markdown' });
        } else {
          await ctx.editMessageText(`${originalText}\n\n❌ _Awaiting rejection reason\\.\\.\\._`, {
            parse_mode: 'MarkdownV2',
          });
          const prompt = await ctx.api.sendMessage(
            this.ownerChatId!,
            '📝 Reply to this message with your rejection reason:',
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

    // KB proposal callbacks: kbproposal:<proposalId>:approve|reject
    this.bot.callbackQuery(
      /^kbproposal:([^:]+):(approve|reject)$/,
      async (ctx) => {
        const fromId = ctx.from?.id ? String(ctx.from.id) : null;
        if (!this.isOwner(fromId)) {
          await ctx.answerCallbackQuery({ text: '⛔ Unauthorized' });
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

    // Handle text replies (follow-up instructions + rejection reasons)
    this.bot.on('message:text', async (ctx) => {
      const replyTo = ctx.message.reply_to_message;
      if (!replyTo) return;

      const fromId = ctx.from?.id ? String(ctx.from.id) : null;
      if (!this.isOwner(fromId)) return;

      const replyToMsgId = String(replyTo.message_id);

      // Check for follow-up reply
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
        await this.approvalSvc.followup(followupApproval.id, ctx.message.text);
        await ctx.reply('✅ Follow\\-up received\\. Re\\-evaluating\\.\\.\\.', {
          parse_mode: 'MarkdownV2',
        });
        return;
      }

      // Check for rejection reason reply
      const [rejectApproval] = await this.db.db
        .select()
        .from(pendingApprovals)
        .where(eq(pendingApprovals.telegramThreadId, `REJECT_REASON:${replyToMsgId}`))
        .limit(1);

      if (rejectApproval) {
        await this.approvalSvc.rejectWithReason(rejectApproval.id, ctx.message.text);
        await ctx.reply('✅ Rejected with reason recorded\\.', { parse_mode: 'MarkdownV2' });
      }
    });
  }

  private isOwner(fromId: string | null): boolean {
    return !!fromId && !!this.ownerChatId && fromId === this.ownerChatId;
  }

  private buildApprovalText(
    agentName: string,
    action: ProposedAction,
    runId: string,
  ): string {
    const risk = RISK_EMOJI[action.riskLevel] ?? '⚪';
    return [
      `🤖 *${agentName}* proposes:`,
      `_${action.summary}_`,
      '',
      `Run: \`${runId}\``,
      `Action: \`${action.type}\``,
      `Risk: ${risk} ${action.riskLevel}`,
    ].join('\n');
  }
}
