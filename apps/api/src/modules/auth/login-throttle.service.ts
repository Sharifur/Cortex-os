import { Injectable, Logger, Optional } from '@nestjs/common';
import { TelegramService } from '../telegram/telegram.service';

interface Bucket {
  fails: number;
  windowStartMs: number;
  lockUntilMs?: number;
  alertedLock?: boolean;
}

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000; // 15 minutes

@Injectable()
export class LoginThrottleService {
  private readonly logger = new Logger(LoginThrottleService.name);
  private readonly buckets = new Map<string, Bucket>();

  constructor(@Optional() private readonly telegram?: TelegramService) {}

  isLocked(key: string): { locked: true; retryAfterSec: number } | { locked: false } {
    const b = this.buckets.get(key);
    if (!b?.lockUntilMs) return { locked: false };
    if (Date.now() >= b.lockUntilMs) {
      this.buckets.delete(key);
      return { locked: false };
    }
    return { locked: true, retryAfterSec: Math.ceil((b.lockUntilMs - Date.now()) / 1000) };
  }

  registerFail(key: string): void {
    const now = Date.now();
    const b = this.buckets.get(key);
    if (!b || now - b.windowStartMs > WINDOW_MS) {
      this.buckets.set(key, { fails: 1, windowStartMs: now });
      return;
    }
    b.fails += 1;
    if (b.fails >= MAX_FAILS && !b.alertedLock) {
      b.lockUntilMs = now + LOCK_MS;
      b.alertedLock = true;
      this.logger.warn(`Locked ${key} for ${LOCK_MS / 60000} min after ${b.fails} failed login attempts`);
      if (this.telegram) {
        void this.telegram.sendMessage(
          `Cortex OS: login lockout triggered\nKey: ${key}\nFails: ${b.fails}\nLocked for ${LOCK_MS / 60000} min`,
        ).catch(() => undefined);
      }
    }
  }

  registerSuccess(key: string): void {
    this.buckets.delete(key);
  }
}
