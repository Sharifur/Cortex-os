import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '../../db/db.service';
import { tasks } from '../../db/schema';
import { LlmRouterService } from '../llm/llm-router.service';

export interface ParsedReminder {
  message: string;
  sendAt: Date;
  sendAtLabel: string;
}

export interface ScheduleInput {
  message: string;
  sendAt: Date;
}

const MAX_DELAY_MINUTES = 60 * 24 * 7;

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly db: DbService,
    private readonly llm: LlmRouterService,
  ) {}

  async schedule(input: ScheduleInput): Promise<void> {
    await this.db.db.insert(tasks).values({
      title: 'Reminder',
      instructions: `REMINDER: ${input.message}`,
      agentKey: 'daily_reminder',
      status: 'pending',
      nextRunAt: input.sendAt,
    });
  }

  formatLocal(sendAt: Date, tz: string): string {
    return sendAt.toLocaleString('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  /**
   * Parse text like "in 30 min", "after 2 hours", "tomorrow at 9am", "8pm".
   * Falls through to LLM for natural language times. Returns null if the
   * text doesn't contain a parseable reminder time.
   */
  async parse(text: string, tz: string, now: Date = new Date()): Promise<ParsedReminder | null> {
    const rel = this.parseRelativeDuration(text);
    if (rel) {
      const sendAt = new Date(now.getTime() + rel.minutes * 60 * 1000);
      return {
        message: rel.message,
        sendAt,
        sendAtLabel:
          sendAt.toLocaleString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: true }) +
          ` (in ${rel.minutes} min)`,
      };
    }

    const nowLocal = now.toLocaleString('en-US', { timeZone: tz, hour12: false });
    const response = await this.llm.complete({
      messages: [
        {
          role: 'system',
          content: `You detect timed reminders in user messages. Current UTC time: ${now.toISOString()}. User timezone: ${tz}, local time now: ${nowLocal}.

If a reminder, output ONE of:
(a) absolute: {"isReminder": true, "kind": "absolute", "message": "<clean reminder text>", "targetLocalHHMM": "HH:MM", "sendMinutesBefore": 0}
(b) relative: {"isReminder": true, "kind": "relative", "message": "<clean reminder text>", "delayMinutes": 5}

Otherwise: {"isReminder": false}
ONLY JSON, no prose.`,
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
        sendMinutesBefore?: number;
        delayMinutes?: number;
      };
      if (!parsed.isReminder || !parsed.message) return null;

      if (parsed.kind === 'relative' && parsed.delayMinutes && parsed.delayMinutes > 0) {
        const sendAt = new Date(now.getTime() + parsed.delayMinutes * 60 * 1000);
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
        const sendAt = this.computeNextLocalTimeUtc(hh, mm, tz, now, sendBefore);
        const localLabel = sendAt.toLocaleString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: true });
        return { message: parsed.message, sendAt, sendAtLabel: localLabel };
      }
      return null;
    } catch (err) {
      this.logger.warn(`Reminder LLM parse failed: ${(err as Error).message}`);
      return null;
    }
  }

  /** Strip task-intent prefixes ("remind me to ...", "set a reminder about ..."). */
  stripTaskIntent(text: string): string {
    return text
      .replace(/^(please\s+)?(can\s+you\s+|could\s+you\s+|will\s+you\s+)?/i, '')
      .replace(/\b(remind\s+me\s+(to\s+|about\s+)?|set\s+(a\s+|me\s+a\s+)?reminder\s+(to\s+|about\s+|for\s+)?|give\s+me\s+(a\s+)?reminder\s+(to\s+|about\s+|for\s+)?|create\s+(a\s+)?(reminder|task|alarm)\s+(to\s+|for\s+)?|add\s+(a\s+)?(reminder|task)\s+(to\s+|for\s+)?|schedule\s+(a\s+|me\s+a\s+)?(reminder|task|message|notification)\s+(to\s+|about\s+|for\s+)?|alert\s+me\s+(to\s+|about\s+)?|new\s+(reminder|task)\s+(to\s+|about\s+|for\s+)?)/i, '')
      .trim()
      .replace(/^["'`]+|["'`]+$/g, '')
      .replace(/^[.,;:\s]+|[.,;:\s]+$/g, '');
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private parseRelativeDuration(text: string): { minutes: number; message: string } | null {
    const m = text.match(/\b(?:in|after|after\s+next|in\s+next)\s+(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours)\b/i);
    if (!m) return null;
    const value = parseInt(m[1], 10);
    const unit = m[2].toLowerCase();
    let minutes: number;
    if (/^(s|sec|secs|second|seconds)$/.test(unit)) minutes = Math.max(1, Math.round(value / 60));
    else if (/^(h|hr|hrs|hour|hours)$/.test(unit)) minutes = value * 60;
    else minutes = value;
    if (minutes < 1 || minutes > MAX_DELAY_MINUTES) return null;

    let message = text.replace(m[0], '').trim();
    message = message.replace(/^(please\s+)?(can\s+you\s+)?(send|remind|tell|message|text|give)\s+me\s+(a\s+)?(reminder\s+)?(to\s+|about\s+|for\s+)?/i, '').trim();
    message = message.replace(/^(a|an)\s+/i, '').trim();
    if (!message) message = text.trim();
    message = message.charAt(0).toUpperCase() + message.slice(1);
    return { minutes, message };
  }

  private computeNextLocalTimeUtc(hh: number, mm: number, tz: string, now: Date, minutesBefore: number): Date {
    const nowParts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(now);
    const get = (k: string) => Number(nowParts.find((p) => p.type === k)?.value ?? '0');
    const localY = get('year');
    const localMo = get('month');
    const localD = get('day');
    const localH = get('hour');
    const localMi = get('minute');

    const offsetMin = (localH * 60 + localMi) - (now.getUTCHours() * 60 + now.getUTCMinutes());
    let candidateUtc = Date.UTC(localY, localMo - 1, localD, hh, mm, 0) - offsetMin * 60 * 1000;
    const nowMs = now.getTime();
    if (candidateUtc - minutesBefore * 60 * 1000 <= nowMs) {
      candidateUtc += 24 * 60 * 60 * 1000;
    }
    return new Date(candidateUtc - minutesBefore * 60 * 1000);
  }
}
