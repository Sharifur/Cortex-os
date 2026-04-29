import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { CrispService } from './crisp.service';
import { TelegramService } from '../../telegram/telegram.service';

@Injectable()
export class CrispFollowUpSweeper implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(CrispFollowUpSweeper.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private crisp: CrispService,
    private telegram: TelegramService,
  ) {}

  onApplicationBootstrap() {
    // Check every 60s. Lightweight indexed query; no queue needed.
    this.timer = setInterval(() => void this.sweep(), 60_000);
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  private async sweep(): Promise<void> {
    try {
      const due = await this.crisp.listDueFollowUps(new Date());
      for (const conv of due) {
        const visitor =
          conv.visitorNickname || conv.visitorEmail || conv.sessionId.slice(-8);
        const note = conv.followUpNote ? `\n_${conv.followUpNote}_` : '';
        const dueLabel = conv.followUpDueAt
          ? new Date(conv.followUpDueAt).toLocaleString('en-US', { hour12: false })
          : 'now';
        try {
          await this.telegram.sendMessage(
            `Crisp follow-up due — *${visitor}* (${conv.websiteId})\nDue: ${dueLabel}${note}\nLast: "${conv.lastMessage.slice(0, 200)}"`,
          );
          await this.crisp.markFollowUpNotified(conv.sessionId);
        } catch (err) {
          this.logger.warn(`Failed to notify follow-up for ${conv.sessionId}: ${(err as Error).message}`);
        }
      }
    } catch (err) {
      this.logger.warn(`Crisp follow-up sweep failed: ${(err as Error).message}`);
    }
  }
}
