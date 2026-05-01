import { Injectable, Logger } from '@nestjs/common';
import type { VisitorIntent } from './livechat-intent.service';
import { LivechatService } from './livechat.service';

/**
 * Escalation triggers — flip a session to needs_human BEFORE the AI runs
 * its next reply, so the operator gets notified and the AI stops looping.
 *
 * Cheap heuristics, computed from the session's recent message history and
 * the just-classified intent. Returning a non-null reason short-circuits the
 * agent's reply path; the caller posts the fallback "human will reply"
 * message and pushes a Telegram notification.
 */
@Injectable()
export class LivechatEscalationService {
  private readonly logger = new Logger(LivechatEscalationService.name);

  constructor(private readonly livechat: LivechatService) {}

  async shouldEscalate(input: {
    sessionId: string;
    intent: VisitorIntent;
    sentiment: number;
    visitorMessage: string;
    currentPageUrl: string | null;
    /** ISO string. */
    sessionStartedAt: Date;
  }): Promise<{ reason: string } | null> {
    // 1. Explicit visitor request — always honoured.
    if (input.intent === 'human_request') {
      return { reason: 'visitor_asked_for_human' };
    }

    // 2. Strong negative sentiment — don't push the AI on someone already
    //    upset. Threshold is conservative so a single grumpy word doesn't trip.
    if (input.sentiment <= -0.6) {
      return { reason: `negative_sentiment(${input.sentiment.toFixed(2)})` };
    }

    // 3. Three consecutive AI turns with no progress — visitor keeps asking
    //    the same kind of clarifying question. Looks like a loop.
    if (input.intent === 'clarification') {
      const last20: Awaited<ReturnType<LivechatService['getRecentMessages']>> = await this.livechat
        .getRecentMessages(input.sessionId, 20)
        .catch(() => [] as Awaited<ReturnType<LivechatService['getRecentMessages']>>);
      const visitorTurns = last20.filter((m) => m.role === 'visitor').slice(0, 3);
      if (visitorTurns.length === 3) {
        // If all three are short / repetitive, escalate. We approximate
        // "stuck" with: avg length < 80 chars + at least 2 share a token.
        const texts = visitorTurns.map((m) => String(m.content).toLowerCase().trim());
        const avgLen = texts.reduce((s, t) => s + t.length, 0) / texts.length;
        if (avgLen < 80 && hasOverlap(texts)) {
          return { reason: 'three_clarifications_no_progress' };
        }
      }
    }

    // 4. High-value-page dwell — visitor is on /pricing or /checkout and
    //    has been chatting for over 2 minutes without resolution. Escalate
    //    eagerly so the human can close the deal.
    const hvPath = input.currentPageUrl ? hasHighValuePath(input.currentPageUrl) : false;
    if (hvPath) {
      const ageMs = Date.now() - input.sessionStartedAt.getTime();
      if (ageMs > 2 * 60_000) {
        return { reason: 'pricing_or_checkout_dwell' };
      }
    }

    return null;
  }
}

const HIGH_VALUE_PATTERNS = [
  /\/pricing/i,
  /\/plans/i,
  /\/checkout/i,
  /\/upgrade/i,
  /\/buy/i,
];

function hasHighValuePath(url: string): boolean {
  try {
    const path = new URL(url).pathname;
    return HIGH_VALUE_PATTERNS.some((re) => re.test(path));
  } catch {
    return false;
  }
}

/** Cheap "do these strings share content words" check — escalation only fires when at least 2 of 3 messages overlap on a non-trivial token. */
function hasOverlap(texts: string[]): boolean {
  const stop = new Set(['the', 'a', 'an', 'is', 'are', 'do', 'i', 'you', 'me', 'my', 'we', 'it', 'to', 'of', 'and', 'for', 'on', 'in', 'with', 'how', 'what', 'why', 'can', 'this', 'that']);
  const tokens = texts.map((t) => new Set(
    t.split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !stop.has(w))
  ));
  let pairsOverlapping = 0;
  for (let i = 0; i < tokens.length; i++) {
    for (let j = i + 1; j < tokens.length; j++) {
      const intersect = [...tokens[i]].some((t) => tokens[j].has(t));
      if (intersect) pairsOverlapping++;
    }
  }
  return pairsOverlapping >= 2;
}
