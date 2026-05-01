import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { agents } from '../../../db/schema';
import { AgentRegistryService } from '../runtime/agent-registry.service';
import { LlmRouterService } from '../../llm/llm-router.service';
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
import { agentLlmOpts } from '../runtime/llm-config.util';
import { TelegramChatStateService } from '../../telegram/telegram-chat-state.service';
import { RemindersService } from '../../reminders/reminders.service';

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

export type TelegramRouteResult =
  | { kind: 'smalltalk'; reply: string }
  | { kind: 'help'; reply: string }
  | { kind: 'cancelled'; reply: string }
  | { kind: 'reminder_scheduled'; reply: string }
  | { kind: 'ask_for_time'; reply: string; pendingMessage: string }
  | { kind: 'time_unparseable'; reply: string }
  | { kind: 'mention_route'; agentKey: string; agentName: string; instructions: string }
  | { kind: 'classified_route'; agentKey: string; agentName: string; instructions: string }
  | { kind: 'clarify'; reply: string }
  | { kind: 'show_picker'; text: string };

type IntentDecision =
  | { kind: 'smalltalk'; reply: string }
  | { kind: 'reminder'; message: string; whenIso?: string }
  | { kind: 'route'; agentKey: string; instructions: string; confidence: number }
  | { kind: 'continue'; followup: string }
  | { kind: 'clarify'; question: string };

interface TelegramBotConfig {
  llm?: { provider?: string; model?: string };
  helpReply: string;
  reminderFollowupPrompt: string;
}

const DEFAULT_CONFIG: TelegramBotConfig = {
  helpReply: 'Hi. I route messages to your agents. Try things like:\n• `remind me to drink water in 5 minutes`\n• `draft a reply to the latest email`\n• `give me today\'s status`\n• `@linkedin connect with the new sign-ups`',
  reminderFollowupPrompt: 'When should I trigger it? Reply with something like `in 20 min`, `tomorrow at 9am`, or `8pm`.',
};

@Injectable()
export class TelegramBotAgent implements IAgent, OnModuleInit {
  readonly key = 'telegram_bot';
  readonly name = 'Telegram Bot';
  private readonly logger = new Logger(TelegramBotAgent.name);

  // In-memory intent cache keyed by exact text — repeated phrases never
  // hit the LLM. Stays per-process since it's a perf optimization;
  // pending reminders, by contrast, live in Postgres so they survive restarts.
  private intentCache = new Map<string, { decision: IntentDecision; expiresAt: number }>();
  private static INTENT_CACHE_TTL_MS = 60 * 60 * 1000;
  private static CLASSIFIER_TIMEOUT_MS = 3_000;
  private static ROUTE_CONFIDENCE_THRESHOLD = 0.55;
  private static PENDING_REMINDER_TTL_MS = 5 * 60 * 1000;

  constructor(
    private db: DbService,
    private llm: LlmRouterService,
    private registry: AgentRegistryService,
    private chatState: TelegramChatStateService,
    private reminders: RemindersService,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  triggers(): TriggerSpec[] {
    return [{ type: 'MANUAL' }];
  }

  async buildContext(trigger: TriggerEvent, _run: RunContext): Promise<AgentContext> {
    return { source: trigger, snapshot: { trigger }, followups: [] };
  }

  async decide(_ctx: AgentContext): Promise<ProposedAction[]> {
    // Routing happens synchronously via routeMessage() so the bot can reply in
    // sub-second time. The runtime path is just here so the agent appears in
    // /agents and can be configured.
    return [{ type: 'noop', summary: 'Routing handled inline by TelegramService.', payload: {}, riskLevel: 'low' }];
  }

  requiresApproval(_action: ProposedAction): boolean {
    return false;
  }

  async execute(_action: ProposedAction): Promise<ActionResult> {
    return { success: true };
  }

  mcpTools(): McpToolDefinition[] { return []; }
  apiRoutes(): AgentApiRoute[] { return []; }

  // ── Public conversational API used by TelegramService ────────────────────

  /**
   * Decide what to do with an inbound Telegram message and return a result the
   * transport layer (TelegramService) can act on. Stateless except for the
   * pending-reminder map keyed by chat id.
   */
  async routeMessage(text: string, chatId: string, tz: string): Promise<TelegramRouteResult> {
    const trimmed = text.trim();

    // Explicit cancel — clears any pending state and acknowledges.
    if (/^(\/cancel|cancel|nvm|never\s*mind|forget\s+(it|that))$/i.test(trimmed)) {
      const had = await this.chatState.clearPendingReminder(chatId);
      return {
        kind: 'cancelled',
        reply: had ? 'Cancelled — what else?' : 'Nothing pending. What would you like to do?',
      };
    }

    // /help and /start — explicit help.
    if (/^\/(help|start|menu|about)\b/i.test(trimmed)) {
      return { kind: 'help', reply: this.helpReply() };
    }

    // 0a. Pending reminder waiting for time?
    const pending = await this.chatState.getPendingReminder(chatId);
    if (pending) {
      await this.chatState.clearPendingReminder(chatId);
      try {
        const reminder = await this.reminders.parse(`${pending.message} ${text}`, tz);
        if (reminder) {
          await this.reminders.schedule(reminder);
          return {
            kind: 'reminder_scheduled',
            reply: `Reminder scheduled for *${reminder.sendAtLabel}*\n_"${reminder.message}"_`,
          };
        }
      } catch (err) {
        this.logger.warn(`Pending reminder time-parse failed: ${(err as Error).message}`);
      }
      await this.chatState.setPendingReminder(chatId, pending.message, TelegramBotAgent.PENDING_REMINDER_TTL_MS);
      return {
        kind: 'time_unparseable',
        reply: `I couldn't understand that as a time. Reply with something like \`in 20 min\`, \`tomorrow at 9am\`, or \`8pm\`.`,
      };
    }

    // 1. @mention fast-path (exact, no LLM)
    const mentionMatch = text.match(/^@(\S+)\s+([\s\S]+)/i);
    if (mentionMatch) {
      const [, mention, instruction] = mentionMatch;
      const target = this.resolveAgentByAlias(mention.toLowerCase());
      if (target) {
        const mentionResult: TelegramRouteResult = {
          kind: 'mention_route',
          agentKey: target.key,
          agentName: target.name,
          instructions: instruction.trim(),
        };
        void this.chatState.logRouting({
          chatId,
          inboundText: text,
          decidedKind: mentionResult.kind,
          decidedAgentKey: mentionResult.agentKey,
          latencyMs: 0,
        });
        await this.chatState.appendTurn(chatId, 'user', text, 'mention');
        await this.chatState.appendTurn(chatId, 'assistant', `→ ${mentionResult.agentName}: ${mentionResult.instructions}`, 'mention_route');
        void this.chatState.setLastRoute(chatId, mentionResult.agentKey, mentionResult.instructions, null);
        return mentionResult;
      }
    }

    // 2. Single schema-constrained classifier (with cache + timeout)
    let decision: IntentDecision | null = null;
    const startedAt = Date.now();
    try {
      decision = await this.decideIntent(text, chatId, tz);
    } catch (err) {
      this.logger.warn(`Intent classifier failed: ${(err as Error).message}`);
    }
    const latencyMs = Date.now() - startedAt;
    this.logger.log(`route chatId=${chatId} kind=${decision?.kind ?? 'null'} latency=${latencyMs}ms`);

    // Compute the final TelegramRouteResult from the decision.
    const result: TelegramRouteResult = await this.applyDecision(text, chatId, tz, decision);

    // Persist routing log + rolling-context turns + last-route for follow-ups.
    void this.chatState.logRouting({
      chatId,
      inboundText: text,
      decidedKind: result.kind,
      decidedAgentKey:
        result.kind === 'classified_route' || result.kind === 'mention_route'
          ? (result as { agentKey: string }).agentKey
          : null,
      confidence: decision?.kind === 'route' ? decision.confidence : null,
      latencyMs,
    });
    await this.chatState.appendTurn(chatId, 'user', text, decision?.kind ?? 'unknown');
    const assistantTurn = this.summarizeResult(result);
    if (assistantTurn) await this.chatState.appendTurn(chatId, 'assistant', assistantTurn, result.kind);
    if (result.kind === 'classified_route') {
      void this.chatState.setLastRoute(chatId, result.agentKey, result.instructions, null);
    }
    return result;
  }

  private summarizeResult(result: TelegramRouteResult): string {
    switch (result.kind) {
      case 'smalltalk':
      case 'help':
      case 'cancelled':
      case 'reminder_scheduled':
      case 'time_unparseable':
      case 'clarify':
        return result.reply.slice(0, 400);
      case 'ask_for_time':
        return `(asking for reminder time) ${result.pendingMessage}`.slice(0, 400);
      case 'mention_route':
      case 'classified_route':
        return `→ ${result.agentName}: ${result.instructions.slice(0, 200)}`;
      case 'show_picker':
        return `(showed picker) ${result.text.slice(0, 200)}`;
    }
  }

  private async applyDecision(
    text: string,
    chatId: string,
    tz: string,
    decision: IntentDecision | null,
  ): Promise<TelegramRouteResult> {
    if (decision) {
      switch (decision.kind) {
        case 'smalltalk':
          return { kind: 'smalltalk', reply: decision.reply || this.helpReply() };

        case 'reminder': {
          if (decision.whenIso) {
            const sendAt = new Date(decision.whenIso);
            if (!isNaN(sendAt.getTime())) {
              const message = decision.message || text;
              try {
                await this.reminders.schedule({ message, sendAt });
                return {
                  kind: 'reminder_scheduled',
                  reply: `Reminder scheduled for *${this.reminders.formatLocal(sendAt, tz)}*\n_"${message}"_`,
                };
              } catch (err) {
                this.logger.warn(`Schedule reminder failed: ${(err as Error).message}`);
              }
            }
          }
          // Reminder intent without a parseable time → ask for it.
          const cleaned = decision.message || this.reminders.stripTaskIntent(text) || text;
          await this.chatState.setPendingReminder(chatId, cleaned, TelegramBotAgent.PENDING_REMINDER_TTL_MS);
          return {
            kind: 'ask_for_time',
            pendingMessage: cleaned,
            reply: `Got it — I'll set a reminder for: _"${cleaned}"_\n\nWhen should I trigger it? Reply with something like \`in 20 min\`, \`tomorrow at 9am\`, or \`8pm\`.`,
          };
        }

        case 'route': {
          const meta = ROUTABLE_AGENTS.find((a) => a.key === decision.agentKey);
          if (meta && decision.confidence >= TelegramBotAgent.ROUTE_CONFIDENCE_THRESHOLD) {
            return {
              kind: 'classified_route',
              agentKey: meta.key,
              agentName: meta.name,
              instructions: decision.instructions || text,
            };
          }
          return {
            kind: 'clarify',
            reply: meta
              ? `Did you mean *${meta.name}*? Reply 'yes' to confirm or describe what you want.`
              : `I'm not sure which agent fits. Could you give me a bit more detail?`,
          };
        }

        case 'continue': {
          const last = await this.chatState.getLastRoute(chatId);
          if (!last || !last.agentKey) {
            return {
              kind: 'clarify',
              reply: `I don't have a previous task to follow up on. Tell me what you'd like to do?`,
            };
          }
          const meta = ROUTABLE_AGENTS.find((a) => a.key === last.agentKey);
          if (!meta) {
            return { kind: 'clarify', reply: `The previous agent isn't available anymore. What should I do?` };
          }
          const composed = last.instructions
            ? `${last.instructions}\n\nFollow-up from the user: ${decision.followup || text}`
            : decision.followup || text;
          return {
            kind: 'classified_route',
            agentKey: meta.key,
            agentName: meta.name,
            instructions: composed,
          };
        }

        case 'clarify':
          return { kind: 'clarify', reply: decision.question || `Could you tell me a little more?` };
      }
    }

    // Classifier failed AND text is short → safest fallback is smalltalk
    if (text.trim().length < 30 && text.trim().split(/\s+/).length <= 3) {
      return { kind: 'smalltalk', reply: this.smalltalkReply(text) };
    }

    return { kind: 'show_picker', text };
  }

  // ── Schema-constrained classifier ────────────────────────────────────────

  private async decideIntent(text: string, chatId: string, tz: string): Promise<IntentDecision | null> {
    // Cache by exact text only when we have no recent turns — context-free
    // messages like "status" / "hello" repeat constantly and should never
    // re-hit the LLM. Once a conversation has context, the same text can
    // mean different things, so skip the cache.
    const recentTurns = await this.chatState.getRecentTurns(chatId);
    const lastRoute = await this.chatState.getLastRoute(chatId);

    const cacheKey = text.trim();
    if (recentTurns.length === 0) {
      const cached = this.intentCache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) return cached.decision;
    }

    const config = await this.getConfig();
    const nowUtc = new Date();
    const nowLocal = nowUtc.toLocaleString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: true, weekday: 'short', month: 'short', day: 'numeric' });
    const agentList = ROUTABLE_AGENTS.map((a) => `- ${a.key}: ${a.desc}`).join('\n');

    const tools = [
      {
        name: 'decide',
        description: 'Decide what to do with the user message. Call exactly once.',
        parameters: {
          type: 'object',
          properties: {
            kind: { type: 'string', enum: ['smalltalk', 'reminder', 'route', 'continue', 'clarify'] },
            // smalltalk
            smalltalk_reply: { type: 'string', description: 'Short friendly reply when kind=smalltalk. Required.' },
            // reminder
            reminder_message: { type: 'string', description: 'What to remind about (no time words). Required when kind=reminder.' },
            reminder_when_iso: { type: 'string', description: 'ISO 8601 UTC datetime to fire the reminder. OMIT if user did not specify a time.' },
            // route
            agent_key: { type: 'string', enum: ROUTABLE_AGENTS.map((a) => a.key) },
            instructions: { type: 'string', description: 'Forwarded as the agent prompt. Defaults to the original message.' },
            confidence: { type: 'number', description: '0..1 confidence in the agent choice. Use <0.55 if unsure.' },
            // continue
            continue_followup: { type: 'string', description: 'When kind=continue, the follow-up instruction to apply to the previous task (e.g. "make it shorter", "add another bullet"). Required.' },
            // clarify
            clarify_question: { type: 'string', description: 'A short question to ask the user when uncertain.' },
          },
          required: ['kind'],
        },
      },
    ];

    const turnsBlock = recentTurns.length
      ? `Recent conversation (oldest → newest):\n${recentTurns.map((t) => `[${t.role}${t.kind ? `:${t.kind}` : ''}] ${t.text}`).join('\n')}\n\n`
      : '';
    const lastRouteBlock = lastRoute?.agentKey
      ? `Last task: agent="${lastRoute.agentKey}", instructions="${(lastRoute.instructions ?? '').slice(0, 200)}".\n\n`
      : '';

    const systemPrompt = `You classify a single Telegram message from the bot's owner and decide one of: smalltalk, reminder, route, continue, clarify. ALWAYS call the "decide" tool exactly once.

Guidelines:
- smalltalk: greetings, thanks, vibes, casual chat. Provide a brief friendly smalltalk_reply (under 20 words).
- reminder: the message asks to be reminded / scheduled. Set reminder_message. If a time is given, set reminder_when_iso. Otherwise omit reminder_when_iso so the bot can ask.
- route: the message is a NEW task that fits one of the available agents. Set agent_key, instructions (rephrase if needed), and confidence (0..1). If confidence < 0.55 prefer clarify instead.
- continue: the message is a follow-up that modifies the LAST task ("make it shorter", "do it again", "add another bullet", "not that one, the other one"). Only use this when there IS a "Last task" below. Set continue_followup.
- clarify: ambiguous or out-of-scope. Set clarify_question (under 20 words).

Available agents:
${agentList}

${turnsBlock}${lastRouteBlock}Current local time: ${nowLocal} (${tz}). Current UTC: ${nowUtc.toISOString()}.`;

    const completion = this.llm.completeWithTools({
      ...agentLlmOpts(config),
      tools,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      maxTokens: 300,
      temperature: 0.1,
    });

    const result = await Promise.race([
      completion,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('classifier timeout')), TelegramBotAgent.CLASSIFIER_TIMEOUT_MS),
      ),
    ]);

    if (result.type !== 'tool_calls' || result.tool_calls.length === 0) return null;

    let args: Record<string, unknown>;
    try {
      args = JSON.parse(result.tool_calls[0].arguments);
    } catch {
      return null;
    }

    const decision = this.normalizeDecision(args);
    // Only cache stable, context-free decisions. Skip 'continue' (depends on
    // last route) and any decision whose meaning depended on recent turns.
    if (decision && decision.kind !== 'continue' && recentTurns.length === 0) {
      this.intentCache.set(cacheKey, { decision, expiresAt: Date.now() + TelegramBotAgent.INTENT_CACHE_TTL_MS });
    }
    return decision;
  }

  private normalizeDecision(args: Record<string, unknown>): IntentDecision | null {
    const kind = args.kind as string;
    switch (kind) {
      case 'smalltalk':
        return { kind: 'smalltalk', reply: String(args.smalltalk_reply ?? '').trim() };
      case 'reminder':
        return {
          kind: 'reminder',
          message: String(args.reminder_message ?? '').trim(),
          ...(args.reminder_when_iso ? { whenIso: String(args.reminder_when_iso) } : {}),
        };
      case 'route': {
        const agentKey = String(args.agent_key ?? '').trim();
        if (!agentKey) return null;
        const confidenceRaw = typeof args.confidence === 'number' ? args.confidence : 0.5;
        return {
          kind: 'route',
          agentKey,
          instructions: String(args.instructions ?? '').trim(),
          confidence: Math.max(0, Math.min(1, confidenceRaw)),
        };
      }
      case 'continue':
        return { kind: 'continue', followup: String(args.continue_followup ?? '').trim() };
      case 'clarify':
        return { kind: 'clarify', question: String(args.clarify_question ?? '').trim() };
      default:
        return null;
    }
  }

  // Used by TelegramService when the user taps a quick-time inline button:
  // schedules immediately if pending intent exists, otherwise no-op.
  async resolvePendingReminderWithDelay(chatId: string, delayMinutes: number, tz: string): Promise<{ scheduled: boolean; reply: string }> {
    const pending = await this.chatState.getPendingReminder(chatId);
    if (!pending) {
      return { scheduled: false, reply: 'No pending reminder — start with `remind me to ...`.' };
    }
    await this.chatState.clearPendingReminder(chatId);
    const sendAt = new Date(Date.now() + delayMinutes * 60 * 1000);
    await this.reminders.schedule({ message: pending.message, sendAt });
    const sendAtLabel =
      sendAt.toLocaleString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: true }) +
      ` (in ${delayMinutes} min)`;
    return {
      scheduled: true,
      reply: `Reminder scheduled for *${sendAtLabel}*\n_"${pending.message}"_`,
    };
  }

  /** Pre-set a pending reminder (used by /remind <text>). */
  async setPendingReminder(chatId: string, message: string): Promise<void> {
    await this.chatState.setPendingReminder(chatId, message, TelegramBotAgent.PENDING_REMINDER_TTL_MS);
  }

  // ── Internal helpers ─────────────────────────────────────────────────────

  private async getConfig(): Promise<TelegramBotConfig> {
    try {
      const [row] = await this.db.db.select().from(agents).where(eq(agents.key, this.key));
      return { ...DEFAULT_CONFIG, ...((row?.config as Partial<TelegramBotConfig>) ?? {}) };
    } catch {
      return DEFAULT_CONFIG;
    }
  }

  // ── Smalltalk fallback (used when the LLM classifier times out) ──────────

  private smalltalkReply(text: string): string {
    const t = text.trim().toLowerCase();
    if (/^(thanks|thank\s+you|thx|thnx|tnx|ty|tysm|cheers)\b/i.test(t)) return 'You got it.';
    if (/^(bye|goodbye|cya|ttyl|peace|later|see\s+(you|ya|u)|take\s+care)\b/i.test(t)) return 'Talk later.';
    if (/^(ok+|okay|kk|alright|sure|fine|cool|nice|great|noted|yep|yeah|yup|yes|no|nope|nah)\b/i.test(t)) return 'Noted.';
    return this.helpReply();
  }

  helpReply(): string {
    const agentList = ROUTABLE_AGENTS.map((a) => `• *${a.name}* — ${a.desc}`).join('\n');
    return [
      '*What I can do*',
      '',
      '*Reminders & tasks*',
      '• `remind me to drink water in 5 minutes`',
      '• `set a reminder for 8pm tomorrow about the call`',
      '• `give me a reminder after 30 min`',
      '_Type the action and I\'ll ask for the time if you skip it._',
      '',
      '*Agent shortcuts (slash commands)*',
      '• /remind `<what>` — schedule a reminder',
      '• /status — today\'s briefing from Daily Reminder',
      '• /agents — list all agents',
      '• /inbox — pending approvals',
      '• /cancel — cancel the pending reminder I asked you about',
      '• /help — show this menu',
      '',
      '*Direct delegation*',
      '• `@email_manager draft a reply to Bob`',
      '• `@linkedin connect with the new sign-ups`',
      '_Or just describe it — I\'ll pick the right agent._',
      '',
      '*Stop me*',
      '• `cancel`, `nvm`, `never mind` — clears any pending question',
      '',
      '*Agents available*',
      agentList,
    ].join('\n');
  }

  // ── @mention resolver ────────────────────────────────────────────────────

  private resolveAgentByAlias(input: string): typeof ROUTABLE_AGENTS[0] | null {
    const normalized = input.replace(/_/g, '').toLowerCase();
    return (
      ROUTABLE_AGENTS.find(
        (a) =>
          a.key === input ||
          a.key.replace(/_/g, '') === normalized ||
          a.aliases.some((alias) => alias === normalized || alias === input),
      ) ?? null
    );
  }

}
