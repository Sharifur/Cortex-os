import {
  Controller,
  Post,
  Body,
  Headers,
  UnauthorizedException,
  HttpCode,
} from '@nestjs/common';
import type { Update } from 'grammy/types';
import { TelegramService } from './telegram.service';

@Controller('telegram')
export class TelegramWebhookController {
  constructor(private readonly telegram: TelegramService) {}

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Body() update: Update,
    @Headers('x-telegram-bot-api-secret-token') secret: string,
  ) {
    const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (expected && secret !== expected) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    const bot = this.telegram.getBot();
    if (!bot) return { ok: true };

    await bot.handleUpdate(update);
    return { ok: true };
  }
}
