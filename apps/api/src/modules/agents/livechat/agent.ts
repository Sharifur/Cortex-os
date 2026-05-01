import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { agents } from '../../../db/schema';
import { AgentRegistryService } from '../runtime/agent-registry.service';
import { LlmRouterService } from '../../llm/llm-router.service';
import { KnowledgeBaseService } from '../../knowledge-base/knowledge-base.service';
import { agentLlmOpts } from '../runtime/llm-config.util';
import { LivechatService } from './livechat.service';
import { LivechatStreamService } from './livechat-stream.service';
import { LivechatRateLimitService } from './livechat-rate-limit.service';
import { LivechatIntentService, type VisitorIntent } from './livechat-intent.service';
import { LivechatEscalationService } from './livechat-escalation.service';
import type {
  IAgent,
  TriggerSpec,
  TriggerEvent,
  RunContext,
  AgentContext,
  ProposedAction,
  ActionResult,
  McpToolDefinition,
  AgentApiRoute,
} from '../runtime/types';

interface LivechatConfig {
  replyTone: string;
  productContext: string;
  selfCritiqueRetries: number;
  llm?: { provider?: string; model?: string };
}

const DEFAULT_CONFIG: LivechatConfig = {
  replyTone: 'friendly, concise, and helpful — like a knowledgeable founder replying to a customer',
  productContext: '',
  selfCritiqueRetries: 1,
};

const FALLBACK_REPLY = 'Let me get someone from the team to help with that — they will reply here shortly.';

/** Cheap heuristic: trailing "?", or sentence-final imperative like "let me know", "should we". */
function looksLikeQuestion(text: string): boolean {
  const t = text.trim();
  if (t.endsWith('?')) return true;
  return /\b(want me to|should i|should we|would you like|let me know|do you want|are you|can i|can we|happy to)\b/i.test(t);
}

export interface HandleVisitorMessageResult {
  ok: boolean;
  status: 'replied' | 'pending_approval' | 'skipped_taken_over' | 'skipped_needs_human' | 'fallback_needs_human' | 'error';
  agentMessageId?: string;
  reply?: string;
}

@Injectable()
export class LivechatAgent implements IAgent, OnModuleInit {
  readonly key = 'livechat';
  readonly name = 'Live Chat Agent';
  private readonly logger = new Logger(LivechatAgent.name);

  constructor(
    private db: DbService,
    private registry: AgentRegistryService,
    private llm: LlmRouterService,
    private kb: KnowledgeBaseService,
    private livechat: LivechatService,
    private stream: LivechatStreamService,
    private rateLimit: LivechatRateLimitService,
    private intent: LivechatIntentService,
    private escalation: LivechatEscalationService,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  triggers(): TriggerSpec[] {
    return [{ type: 'MANUAL' }, { type: 'API' }];
  }

  async buildContext(_trigger: TriggerEvent, _run: RunContext): Promise<AgentContext> {
    return { source: null, snapshot: null, followups: [] };
  }

  async decide(_ctx: AgentContext): Promise<ProposedAction[]> {
    return [{ type: 'noop', summary: 'Live chat replies are handled synchronously per visitor message.', payload: {}, riskLevel: 'low' }];
  }

  requiresApproval(_action: ProposedAction): boolean {
    return false;
  }

  async execute(_action: ProposedAction): Promise<ActionResult> {
    return { success: true };
  }

  mcpTools(): McpToolDefinition[] {
    return [];
  }

  apiRoutes(): AgentApiRoute[] {
    return [];
  }

  /**
   * Synchronous reply path called from LivechatPublicController after a visitor
   * message has been persisted. Returns the agent draft (or null if skipped).
   */
  async handleVisitorMessage(input: {
    sessionId: string;
    visitorMessage: string;
  }): Promise<HandleVisitorMessageResult> {
    const session = await this.livechat.getSession(input.sessionId);
    if (!session) return { ok: false, status: 'error' };

    if (session.status === 'human_taken_over') return { ok: true, status: 'skipped_taken_over' };
    if (session.status === 'needs_human') return { ok: true, status: 'skipped_needs_human' };

    const config = await this.getConfig();
    const site = await this.livechat.getSiteById(session.siteId).catch(() => null);

    // Per-site daily reply cap. When exceeded, post the human-handoff
    // fallback and pause AI for this site for the rest of the day. Caps
    // LLM cost from a runaway spam attack. Cap is settings-driven.
    if (site) {
      const limits = await this.livechat.getLimits();
      const todayCount = await this.rateLimit.readDailyCounter('agent_replies', site.key);
      if (todayCount >= limits.dailyReply) {
        this.logger.warn(`site ${site.key} hit daily agent reply cap (${todayCount}/${limits.dailyReply})`);
        return this.postFallback(input.sessionId);
      }
    }
    const productContext = (site?.productContext?.trim()) || config.productContext;
    const replyTone = (site?.replyTone?.trim()) || config.replyTone;

    const siteKey = site?.key ?? null;
    // Build the thread snapshot up-front so we can hand it to the intent
    // classifier in parallel with KB fetches — same network round-trip cost.
    const recentMessagesForIntent = await this.livechat.getRecentMessages(input.sessionId, 10);
    const intentThread = recentMessagesForIntent
      .slice()
      .reverse()
      .filter((m) => m.role === 'visitor' || m.role === 'agent' || m.role === 'operator')
      .slice(-6, -1)
      .map((m) => ({
        role: m.role === 'visitor' ? ('customer' as const) : ('agent' as const),
        text: String(m.content).slice(0, 240),
      }));

    const [alwaysOn, samples, blocklist, rejections, references, recentMessages, recentPageviews, visitor, intentResult] = await Promise.all([
      this.kb.getAlwaysOnContext(this.key, siteKey),
      this.kb.getWritingSamples(this.key, siteKey),
      this.kb.getBlocklistRules(this.key, siteKey),
      this.kb.getRecentRejections(this.key, 3),
      this.kb.searchEntries(input.visitorMessage, this.key, 5, siteKey).catch((e: Error) => {
        this.logger.warn(`KB search failed: ${e.message}`);
        return [];
      }),
      Promise.resolve(recentMessagesForIntent),
      this.livechat.getRecentPageviews(session.visitorPk, 5),
      this.livechat.getVisitor(session.visitorPk),
      this.intent.classify(input.visitorMessage, intentThread).catch(() => ({ intent: 'new_question' as VisitorIntent, sentiment: 0 })),
    ]);

    // Run escalation rules BEFORE the LLM. If a trigger fires, post the
    // human-handoff fallback and skip the model entirely — saves tokens and
    // gets the operator paged faster.
    const escalation = await this.escalation.shouldEscalate({
      sessionId: input.sessionId,
      intent: intentResult.intent,
      sentiment: intentResult.sentiment,
      visitorMessage: input.visitorMessage,
      currentPageUrl: session.currentPageUrl,
      sessionStartedAt: session.createdAt,
    }).catch(() => null);
    if (escalation) {
      this.logger.log(`Escalating session ${input.sessionId}: ${escalation.reason}`);
      return this.postFallback(input.sessionId);
    }

    const template = await this.kb.getPromptTemplate(this.key);

    const threadHistory = recentMessages
      .reverse()
      .filter((m) => m.role === 'visitor' || m.role === 'agent' || m.role === 'operator')
      .slice(-8, -1) // exclude the current visitor message (just inserted)
      .map((m) => ({
        role: m.role === 'visitor' ? ('customer' as const) : ('agent' as const),
        text: String(m.content).slice(0, 300),
      }));

    const kbBlock = this.kb.buildKbPromptBlock({
      voiceProfile: alwaysOn.find((e) => e.entryType === 'voice_profile') ?? null,
      facts: alwaysOn.filter((e) => e.entryType === 'fact'),
      catalog: alwaysOn.filter((e) => e.entryType === 'product' || e.entryType === 'service' || e.entryType === 'offer'),
      references,
      positiveSamples: samples.filter((s) => s.polarity === 'positive'),
      negativeSamples: samples.filter((s) => s.polarity === 'negative'),
      rejections,
      threadHistory,
    });

    const visitorBlock = this.buildVisitorContextBlock({
      visitor,
      currentPageUrl: session.currentPageUrl,
      currentPageTitle: session.currentPageTitle,
      pageviews: recentPageviews,
    });

    // Operator-voice persona: speak AS the website's owner/team, not as a third-party
    // chatbot helping the user. "We", "our product", confident product knowledge.
    const productLabel = site?.botName?.trim() || site?.label?.trim() || 'our product';
    const operatorPersona = site?.operatorName?.trim()
      ? `You are ${site.operatorName} from the ${productLabel} team, replying to a visitor on ${productLabel}'s website.`
      : `You are part of the ${productLabel} team, replying to a visitor on ${productLabel}'s website.`;
    const defaultSystem = [
      operatorPersona,
      productContext ? `What we make: ${productContext}` : '',
      `Tone: ${replyTone}`,
      `Voice rules:`,
      `- Speak in the first person plural ("we", "our team", "our product"). Never refer to the company in the third person.`,
      `- Never say "let me know if I can help you", "I'm here to assist", "feel free to ask" — those are chatbot tells.`,
      `- Lead with the answer. No "Great question" or "Thanks for reaching out". No greetings, no signatures.`,
      `- 2-4 sentences max. Direct, useful, then optionally one short forward-moving question.`,
      `- Plain text only. Do not use markdown bold/italic/headings — write the actual words instead of wrapping them in **asterisks**.`,
      `- When the visitor's current page is relevant (pricing, docs, a specific feature), reference it naturally.`,
      ``,
      `Conversation continuity rules (read these carefully):`,
      `- The "Conversation Thread" below is the actual recent history with this visitor. Treat it as one continuous conversation.`,
      `- If your previous reply offered to do X (e.g. "Want me to walk you through the package?", "Should I list the features?") and the visitor's current message is an affirmation ("yes", "sure", "okay", "list them", "go ahead", a single word, etc.), DELIVER X NOW. Do not re-offer the same thing in different words.`,
      `- Never repeat an offer the visitor already accepted. Never re-introduce a topic the visitor already knows.`,
      `- If the visitor's message is a follow-up question on something you just said, answer it directly using the relevant facts from "Key Facts" / "Products" / "Relevant Knowledge" below — do not stall with another question.`,
      ``,
      `Output: just the reply text. No labels, no quoting.`,
    ].filter(Boolean).join('\n');
    // Stamp the classified intent into the prompt so the LLM can branch
    // explicitly: affirmations should deliver, objections should de-escalate,
    // human_request triggers a fallback before this even gets here.
    const intentBlock = `\n\n## Visitor Intent (computed)\nIntent: ${intentResult.intent}\nSentiment: ${intentResult.sentiment.toFixed(2)} (${intentResult.sentiment < -0.3 ? 'frustrated' : intentResult.sentiment > 0.3 ? 'positive' : 'neutral'})\n` +
      (intentResult.intent === 'affirmation'
        ? '→ The visitor confirmed your last offer. Deliver the content now (list / explain / show). Do NOT re-offer.\n'
        : intentResult.intent === 'objection'
          ? '→ The visitor is pushing back. Acknowledge their concern in one sentence, then address it directly with facts.\n'
          : intentResult.intent === 'thanks'
            ? '→ Brief, warm acknowledgement (≤1 short sentence). Optionally offer one specific next step.\n'
            : intentResult.intent === 'greeting'
              ? '→ Greet briefly and ask what they need help with — but only if they have not already asked something.\n'
              : intentResult.intent === 'leaving'
                ? '→ Wrap up warmly in one sentence. Do not ask another question.\n'
                : '');
    const systemPrompt = (template?.system ?? defaultSystem) + kbBlock + visitorBlock + intentBlock;

    // Per-site LLM override beats the agent-level config.
    const baseLlmOpts = agentLlmOpts(config);
    const llmOpts: typeof baseLlmOpts = { ...baseLlmOpts };
    if (site?.llmProvider) llmOpts.provider = site.llmProvider as typeof baseLlmOpts.provider;
    if (site?.llmModel) llmOpts.model = site.llmModel;

    const retries = Math.max(0, Math.min(2, config.selfCritiqueRetries ?? 1));
    const autoApprove = site?.autoApprove ?? true;
    // Stream tokens to the visitor in real time when auto-approve is on. In
    // moderation mode we buffer server-side (visitor must not see the draft
    // before the operator approves it), so streaming would be misleading.
    const draftId = `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    if (autoApprove) {
      this.stream.publish(input.sessionId, {
        type: 'agent_stream_start',
        sessionId: input.sessionId,
        draftId,
        createdAt: new Date().toISOString(),
      });
    }
    let draft: string;
    try {
      const response = await this.llm.streamComplete({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: input.visitorMessage },
        ],
        ...llmOpts,
        maxTokens: 220,
        onToken: ({ delta }) => {
          if (!autoApprove) return; // moderation: don't leak partial drafts
          this.stream.publish(input.sessionId, {
            type: 'agent_stream_delta',
            sessionId: input.sessionId,
            draftId,
            delta,
          });
        },
      });
      draft = response.content.trim();
    } catch (err) {
      this.logger.warn(`Live chat LLM call failed: ${(err as Error).message}`);
      return this.postFallback(input.sessionId);
    }

    if (!draft) return this.postFallback(input.sessionId);

    const voiceProfile = alwaysOn.find((e) => e.entryType === 'voice_profile')?.content;
    // Skip the critique round-trip on trivial intents — saves ~300ms and a
    // spare LLM call. Only the substantive answers go through editing.
    const skipCritiqueIntents: VisitorIntent[] = ['affirmation', 'thanks', 'greeting', 'leaving'];
    const skipCritique = skipCritiqueIntents.includes(intentResult.intent);
    let critiquePassed = skipCritique;
    if (!skipCritique) {
      for (let attempt = 0; attempt <= retries; attempt++) {
        const critiqued = await this.selfCritique(draft, voiceProfile, blocklist).catch(() => draft);
        if (critiqued !== draft) {
          draft = critiqued;
        } else {
          critiquePassed = true;
          break;
        }
      }
      if (!critiquePassed && retries > 0) {
        // Used all retries and critique kept rewriting — bail to human.
        return this.postFallback(input.sessionId);
      }
    }

    const violation = blocklist.find((p) => draft.toLowerCase().includes(p.toLowerCase()));
    if (violation) {
      this.logger.warn(`Live chat blocklist hit: "${violation}" — escalating to needs_human`);
      return this.postFallback(input.sessionId);
    }

    const agentMsg = await this.livechat.appendMessage({
      sessionId: input.sessionId,
      role: 'agent',
      content: draft,
      pendingApproval: !autoApprove,
    });

    // Bump the daily reply counter for this site (post-success only).
    if (site) {
      await this.rateLimit.incrDailyCounter('agent_replies', site.key);
    }

    if (autoApprove) {
      // The widget already painted the streamed text into a placeholder bubble
      // keyed by draftId. agent_stream_end carries the real messageId + the
      // post-critique final content so the widget can finalize the bubble.
      this.stream.publish(input.sessionId, {
        type: 'agent_stream_end',
        sessionId: input.sessionId,
        draftId,
        messageId: agentMsg.id,
        content: draft,
      });
      // Operator dashboards also need a regular message event for inbox refresh.
      this.stream.publishToOperators({ type: 'session_upserted', sessionId: input.sessionId });
      // Quick-reply suggestions — fire-and-forget. Only when the reply ends
      // in a question, otherwise chips are noise. ~200ms LLM call, runs after
      // the visitor already has the answer so it doesn't block UX.
      if (looksLikeQuestion(draft)) {
        void this.suggestQuickReplies(draft, intentResult.intent).then((suggestions) => {
          if (!suggestions.length) return;
          this.stream.publish(input.sessionId, {
            type: 'agent_suggestions',
            sessionId: input.sessionId,
            messageId: agentMsg.id,
            suggestions,
          });
        }).catch(() => undefined);
      }
    } else {
      // Moderation mode — visitor must NOT see the draft. Notify operators only.
      this.stream.publishToOperators({ type: 'session_upserted', sessionId: input.sessionId });
    }

    return {
      ok: true,
      status: autoApprove ? 'replied' : 'pending_approval',
      agentMessageId: agentMsg.id,
      reply: draft,
    };
  }

  private async postFallback(sessionId: string): Promise<HandleVisitorMessageResult> {
    await this.livechat.setSessionStatus(sessionId, 'needs_human');
    const msg = await this.livechat.appendMessage({
      sessionId,
      role: 'agent',
      content: FALLBACK_REPLY,
    });
    this.stream.publish(sessionId, {
      type: 'message',
      sessionId,
      role: 'agent',
      content: FALLBACK_REPLY,
      messageId: msg.id,
      createdAt: msg.createdAt.toISOString(),
    });
    this.stream.publish(sessionId, { type: 'session_status', sessionId, status: 'needs_human' });
    this.stream.publishToOperators({ type: 'session_upserted', sessionId });
    return { ok: true, status: 'fallback_needs_human', agentMessageId: msg.id, reply: FALLBACK_REPLY };
  }

  private buildVisitorContextBlock(input: {
    visitor: { ipCountryName: string | null; ipCity: string | null; ipTimezone: string | null; browserName: string | null; browserVersion: string | null; osName: string | null; language: string | null } | null;
    currentPageUrl: string | null;
    currentPageTitle: string | null;
    pageviews: { url: string; path: string | null; title: string | null }[];
  }): string {
    const lines: string[] = [];
    const v = input.visitor;
    if (v?.ipCountryName || v?.ipCity) {
      const loc = [v.ipCity, v.ipCountryName].filter(Boolean).join(', ');
      lines.push(`Visitor location: ${loc}${v.ipTimezone ? ` (${v.ipTimezone})` : ''}`);
    }
    if (v?.browserName || v?.osName) {
      const browser = [v.browserName, v.browserVersion].filter(Boolean).join(' ');
      const os = v.osName ?? '';
      lines.push(`Visitor browser: ${[browser, os].filter(Boolean).join(' on ')}`);
    }
    if (input.currentPageUrl) {
      const title = input.currentPageTitle ? ` ("${input.currentPageTitle}")` : '';
      lines.push(`Currently on: ${input.currentPageUrl}${title}`);
    }
    if (input.pageviews.length > 1) {
      const recent = input.pageviews
        .slice(0, 5)
        .map((p, i) => `  ${i + 1}. ${p.path ?? p.url}${p.title ? ` (${p.title})` : ''}`)
        .join('\n');
      lines.push(`Recent pages (last ${Math.min(input.pageviews.length, 5)}):\n${recent}`);
    }
    if (!lines.length) return '';
    return `\n\n---\nVisitor context:\n${lines.join('\n')}\n---\n`;
  }

  private async selfCritique(draft: string, voiceProfile?: string, blocklist?: string[]): Promise<string> {
    try {
      const critique = await this.llm.complete({
        messages: [
          {
            role: 'system',
            content: `You are a strict editor. Review this draft live chat reply.
Voice: ${voiceProfile ?? 'direct, friendly, no corporate jargon'}
Avoid: ${blocklist?.join(', ') || 'none specified'}
If the draft is good, return: {"ok":true}
If not, rewrite and return: {"ok":false,"revised":"improved reply here"}`,
          },
          { role: 'user', content: `Draft: "${draft}"` },
        ],
        maxTokens: 300,
      });
      const result = JSON.parse(critique.content);
      if (!result.ok && typeof result.revised === 'string') return result.revised.trim();
    } catch {
      // fail-open: use original draft
    }
    return draft;
  }

  /**
   * Tiny LLM call (gpt-4o-mini, ~50 tokens) that returns 2-3 short replies a
   * visitor would plausibly tap as the next message. Returns [] on any failure
   * so the chips just don't appear.
   */
  private async suggestQuickReplies(reply: string, intent: VisitorIntent): Promise<string[]> {
    // Don't bother for non-substantive replies — the bot isn't really asking.
    if (intent === 'thanks' || intent === 'leaving' || intent === 'greeting') return [];
    try {
      const res = await this.llm.complete({
        provider: 'openai',
        model: 'gpt-4o-mini',
        maxTokens: 80,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: `You generate 2-3 ultra-short quick-reply chips a visitor might tap as their next message. JSON output only: {"suggestions":["...","..."]}. Each chip ≤ 4 words, lowercase, no punctuation. If the agent's reply does not actually ask a question or invite a next step, return {"suggestions":[]}.`,
          },
          { role: 'user', content: `Agent's reply: "${reply.slice(0, 400)}"` },
        ],
      });
      const parsed = JSON.parse(res.content);
      const arr = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];
      return arr
        .map((s: unknown) => String(s ?? '').trim())
        .filter((s: string) => s.length > 0 && s.length <= 32)
        .slice(0, 3);
    } catch {
      return [];
    }
  }

  private async getConfig(): Promise<LivechatConfig> {
    try {
      const [row] = await this.db.db.select({ config: agents.config }).from(agents).where(eq(agents.key, this.key)).limit(1);
      const cfg = (row?.config ?? {}) as Partial<LivechatConfig>;
      return { ...DEFAULT_CONFIG, ...cfg };
    } catch {
      return DEFAULT_CONFIG;
    }
  }
}
