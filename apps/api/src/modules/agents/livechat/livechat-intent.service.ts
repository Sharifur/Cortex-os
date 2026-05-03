import { Injectable, Logger } from '@nestjs/common';
import { LlmRouterService } from '../../llm/llm-router.service';

export type VisitorIntent =
  | 'greeting'
  | 'new_question'
  | 'clarification'
  | 'affirmation'
  | 'objection'
  | 'thanks'
  | 'leaving'
  | 'human_request'
  | 'unknown';

export interface IntentResult {
  intent: VisitorIntent;
  /** -1 to +1; negative = frustrated/upset, positive = happy. */
  sentiment: number;
}

const HUMAN_REGEX = /\b(human|real person|agent|someone real|talk to (a |an )?person|speak to|customer (service|support))\b/i;
const AFFIRM_REGEX = /^(yes|yeah|yep|yup|sure|ok(ay)?|please|go ahead|sounds good|why not|of course|definitely|absolutely|do it|list (them|it)|show me|tell me( more)?|continue|proceed|👍|✅|y)$/i;
const THANKS_REGEX = /^(thanks|thank you|ty|thx|cheers|appreciate it|got it|cool|nice|great)\.?\s*[!.]*$/i;
const LEAVING_REGEX = /^(bye|goodbye|cya|see ya|later|gotta go|brb|nvm|nevermind|never mind)\.?\s*[!.]*$/i;
const GREETING_REGEX = /^(hi|hello|hey|yo|howdy|good (morning|afternoon|evening)|hola|sup)\b/i;

/**
 * Cheap, fast intent + sentiment tag for the visitor's current message.
 * Tries a regex pass first (covers ~70% of short replies for free), falls
 * back to a tiny gpt-4o-mini call only when the regex pass yields nothing
 * useful AND the message is long enough to be ambiguous. Worst case ~50
 * input tokens, ~20 output — runs in parallel with KB retrieval so it
 * adds no measurable latency.
 */
@Injectable()
export class LivechatIntentService {
  private readonly logger = new Logger(LivechatIntentService.name);

  constructor(private readonly llm: LlmRouterService) {}

  async classify(message: string, recentTurns: { role: 'customer' | 'agent'; text: string }[]): Promise<IntentResult> {
    const text = (message ?? '').trim();
    if (!text) return { intent: 'unknown', sentiment: 0 };

    // Cheap regex shortcuts first.
    if (HUMAN_REGEX.test(text)) return { intent: 'human_request', sentiment: -0.2 };
    if (AFFIRM_REGEX.test(text)) return { intent: 'affirmation', sentiment: 0.2 };
    if (THANKS_REGEX.test(text)) return { intent: 'thanks', sentiment: 0.6 };
    if (LEAVING_REGEX.test(text)) return { intent: 'leaving', sentiment: 0 };
    if (GREETING_REGEX.test(text) && text.length < 40) return { intent: 'greeting', sentiment: 0.2 };

    // Anything longer / unclear → ask the LLM. Tight prompt, JSON output.
    const lastAgent = [...recentTurns].reverse().find((m) => m.role === 'agent')?.text ?? '';
    try {
      const res = await this.llm.complete({
        provider: 'openai',
        model: 'gpt-4o-mini',
        agentKey: 'livechat',
        maxTokens: 60,
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: `Classify the visitor's most recent message in a live-chat conversation.
Return ONLY JSON: {"intent":"<label>","sentiment":<-1..1>}.
Labels: greeting, new_question, clarification, affirmation, objection, thanks, leaving, human_request.
- "clarification" = same topic as the previous agent reply, asking for more detail.
- "new_question" = different topic from the previous reply.
- "objection" = pushback, doubt, complaint, or unhappy reaction.
- Sentiment is -1 (frustrated) to +1 (happy), 0 = neutral.`,
          },
          {
            role: 'user',
            content: `Previous agent reply: "${lastAgent.slice(0, 200)}"\nVisitor message: "${text.slice(0, 400)}"`,
          },
        ],
      });
      const parsed = JSON.parse(res.content);
      const intent = (parsed?.intent ?? 'unknown') as VisitorIntent;
      const sentiment = clamp(Number(parsed?.sentiment ?? 0), -1, 1);
      return { intent, sentiment };
    } catch (err) {
      this.logger.debug(`intent classify fell back: ${(err as Error).message}`);
      return { intent: 'new_question', sentiment: 0 };
    }
  }
}

function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(hi, Math.max(lo, n));
}
