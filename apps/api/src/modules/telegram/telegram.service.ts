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
          await this.approvalSvc.reject(approvalId);
          await ctx.editMessageText(`${originalText}\n\n❌ *Rejected*`, {
            parse_mode: 'Markdown',
          });
        } else if (action === 'followup') {
          // Edit original message to remove keyboard and show followup note
          await ctx.editMessageText(
            `${originalText}\n\n💬 _Awaiting follow\\-up instruction\\.\\.\\._`,
            { parse_mode: 'MarkdownV2' },
          );
          // Send a separate force-reply prompt
          const prompt = await ctx.api.sendMessage(
            this.ownerChatId!,
            '📝 Reply to this message with your follow\\-up instruction:',
            {
              parse_mode: 'MarkdownV2',
              reply_markup: { force_reply: true, selective: true },
            },
          );
          // Store both message ids for follow-up matching
          await this.db.db
            .update(pendingApprovals)
            .set({
              telegramThreadId: String(prompt.message_id),
              status: 'FOLLOWUP',
            })
            .where(eq(pendingApprovals.id, approvalId));
        }
      },
    );

    // Handle follow-up text replies
    this.bot.on('message:text', async (ctx) => {
      const replyTo = ctx.message.reply_to_message;
      if (!replyTo) return;

      const fromId = ctx.from?.id ? String(ctx.from.id) : null;
      if (!this.isOwner(fromId)) return;

      const replyToMsgId = String(replyTo.message_id);

      const [approval] = await this.db.db
        .select()
        .from(pendingApprovals)
        .where(
          and(
            eq(pendingApprovals.telegramThreadId, replyToMsgId),
            eq(pendingApprovals.status, 'FOLLOWUP'),
          ),
        )
        .limit(1);

      if (!approval) return;

      await this.approvalSvc.followup(approval.id, ctx.message.text);
      await ctx.reply('✅ Follow\\-up received\\. Re\\-evaluating\\.\\.\\.', {
        parse_mode: 'MarkdownV2',
      });
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
