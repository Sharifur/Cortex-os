import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { agents, tasks } from '../../../db/schema';
import { AgentRegistryService } from '../runtime/agent-registry.service';
import { LlmRouterService } from '../../llm/llm-router.service';
import { GREETING_SET, normalizeForGreeting } from '../../telegram/greetings';
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

const ROUTABLE_AGENTS = [
  { key: 'daily_reminder', name: 'Daily Reminder', aliases: ['daily', 'reminder', 'brief', 'status'], desc: 'Status updates, pending tasks, daily briefs, system status' },
  { key: 'email_manager', name: 'Email Manager', aliases: ['email', 'gmail', 'inbox', 'mail'], desc: 'Email inbox, draft replies, Gmail' },
  { key: 'crisp', name: 'Crisp', aliases: ['crisp', 'support', 'chat', 'customer'], desc: 'Customer support chats, Crisp live chat conversations' },
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
  | { kind: 'show_picker'; text: string };

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

  // Per-chat pending reminder waiting for the user to reply with a time.
  private pendingReminders = new Map<string, { message: string; expiresAt: number }>();

  constructor(
    private db: DbService,
    private llm: LlmRouterService,
    private registry: AgentRegistryService,
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
      const had = this.pendingReminders.delete(chatId);
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
    const pending = this.pendingReminders.get(chatId);
    if (pending && Date.now() < pending.expiresAt) {
      this.pendingReminders.delete(chatId);
      try {
        const reminder = await this.detectReminder(`${pending.message} ${text}`, tz);
        if (reminder) {
          await this.scheduleReminder(reminder);
          return {
            kind: 'reminder_scheduled',
            reply: `Reminder scheduled for *${reminder.sendAtLabel}*\n_"${reminder.message}"_`,
          };
        }
      } catch (err) {
        this.logger.warn(`Pending reminder time-parse failed: ${(err as Error).message}`);
      }
      this.pendingReminders.set(chatId, { ...pending, expiresAt: Date.now() + 5 * 60_000 });
      return {
        kind: 'time_unparseable',
        reply: `I couldn't understand that as a time. Reply with something like \`in 20 min\`, \`tomorrow at 9am\`, or \`8pm\`.`,
      };
    }

    // 0b. Smalltalk
    if (this.isSmalltalk(text)) {
      return { kind: 'smalltalk', reply: this.smalltalkReply(text) };
    }

    // 1. Reminder with explicit time
    try {
      const reminder = await this.detectReminder(text, tz);
      if (reminder) {
        await this.scheduleReminder(reminder);
        return {
          kind: 'reminder_scheduled',
          reply: `Reminder scheduled for *${reminder.sendAtLabel}*\n_"${reminder.message}"_`,
        };
      }
    } catch (err) {
      this.logger.warn(`Reminder detection failed: ${(err as Error).message}`);
    }

    // 1b. Reminder/task INTENT but no time — ask for it
    if (this.hasTaskIntent(text)) {
      const cleaned = this.stripTaskIntent(text);
      this.pendingReminders.set(chatId, {
        message: cleaned || text,
        expiresAt: Date.now() + 5 * 60_000,
      });
      return {
        kind: 'ask_for_time',
        pendingMessage: cleaned || text,
        reply: `Got it — I'll set a reminder for: _"${cleaned || text}"_\n\nWhen should I trigger it? Reply with something like \`in 20 min\`, \`tomorrow at 9am\`, or \`8pm\`.`,
      };
    }

    // 2. @mention
    const mentionMatch = text.match(/^@(\S+)\s+([\s\S]+)/i);
    if (mentionMatch) {
      const [, mention, instruction] = mentionMatch;
      const target = this.resolveAgentByAlias(mention.toLowerCase());
      if (target) {
        return {
          kind: 'mention_route',
          agentKey: target.key,
          agentName: target.name,
          instructions: instruction.trim(),
        };
      }
    }

    // 3. LLM classifier
    try {
      const agentKey = await this.classifyWithLlm(text);
      if (agentKey) {
        const meta = ROUTABLE_AGENTS.find((a) => a.key === agentKey)!;
        return {
          kind: 'classified_route',
          agentKey,
          agentName: meta.name,
          instructions: text,
        };
      }
    } catch (err) {
      this.logger.warn(`LLM routing failed: ${(err as Error).message}`);
    }

    // 4. Short/casual messages with no classifier match → smalltalk fallback
    // rather than confusing the user with the picker. A 1-3 word message
    // under 30 chars almost never represents an agent task.
    const wordCount = text.trim().split(/\s+/).length;
    if (text.trim().length < 30 && wordCount <= 3) {
      return { kind: 'smalltalk', reply: this.smalltalkReply(text) };
    }

    return { kind: 'show_picker', text };
  }

  // Used by TelegramService when the user taps a quick-time inline button:
  // schedules immediately if pending intent exists, otherwise no-op.
  async resolvePendingReminderWithDelay(chatId: string, delayMinutes: number, tz: string): Promise<{ scheduled: boolean; reply: string }> {
    const pending = this.pendingReminders.get(chatId);
    if (!pending || Date.now() >= pending.expiresAt) {
      return { scheduled: false, reply: 'No pending reminder — start with `remind me to ...`.' };
    }
    this.pendingReminders.delete(chatId);
    const sendAt = new Date(Date.now() + delayMinutes * 60 * 1000);
    await this.scheduleReminder({ message: pending.message, sendAt });
    const sendAtLabel =
      sendAt.toLocaleString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: true }) +
      ` (in ${delayMinutes} min)`;
    return {
      scheduled: true,
      reply: `Reminder scheduled for *${sendAtLabel}*\n_"${pending.message}"_`,
    };
  }

  /** Pre-set a pending reminder (used by /remind <text>). */
  setPendingReminder(chatId: string, message: string): void {
    this.pendingReminders.set(chatId, {
      message,
      expiresAt: Date.now() + 5 * 60_000,
    });
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

  private async scheduleReminder(reminder: { message: string; sendAt: Date }): Promise<void> {
    await this.db.db.insert(tasks).values({
      title: 'Reminder',
      instructions: `REMINDER: ${reminder.message}`,
      agentKey: 'daily_reminder',
      status: 'pending',
      nextRunAt: reminder.sendAt,
    });
  }

  // ── Smalltalk ────────────────────────────────────────────────────────────

  private static SMALLTALK_PHRASES: readonly RegExp[] = [
    /^good\s*(morning|afternoon|evening|night|day)$/i,
    /^how\s+(are|r)\s+(you|u|ya|yall|y'all)\b.*$/i,
    /^how(\s+are)?\s+things\b.*$/i,
    /^how(\s+is|'s|s)\s+it\s+going\b.*$/i,
    /^how\s+do\s+you\s+do\b.*$/i,
    /^what'?s\s+up\b.*$/i,
    /^thank\s+you(\s+(so\s+much|very\s+much|kindly))?$/i,
    /^thanks\s+(a\s+lot|a\s+ton|a\s+bunch|so\s+much|very\s+much)$/i,
    /^see\s+(you|ya|u)(\s+(later|soon|tomorrow))?$/i,
    /^talk\s+(to\s+you\s+)?later$/i,
    /^take\s+care$/i,
    /^have\s+a\s+(good|great|nice)\s+(day|one|night|evening)$/i,
    /^what\s+can\s+you\s+do\b.*$/i,
    /^who\s+(are|r)\s+you\b.*$/i,
  ];

  private isSmalltalk(text: string): boolean {
    const normalized = normalizeForGreeting(text);
    if (!normalized || normalized.length === 1) return true;
    if (GREETING_SET.has(normalized)) return true;
    if (/^\/(start|help|menu|about)\b/i.test(text.trim())) return true;
    for (const re of TelegramBotAgent.SMALLTALK_PHRASES) {
      if (re.test(normalized)) return true;
    }
    return false;
  }

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

  // ── Task-intent detection ────────────────────────────────────────────────

  private hasTaskIntent(text: string): boolean {
    return /\b(remind\s+me|set\s+(a\s+|me\s+a\s+)?reminder|give\s+me\s+(a\s+)?reminder|create\s+(a\s+)?(reminder|task|alarm)|add\s+(a\s+)?(reminder|task)|schedule\s+(a\s+|me\s+a\s+)?(reminder|task|message|notification)|alert\s+me|set\s+(a\s+|an\s+)?alarm|set\s+(a\s+)?task|new\s+(reminder|task))\b/i.test(text);
  }

  private stripTaskIntent(text: string): string {
    return text
      .replace(/^(please\s+)?(can\s+you\s+|could\s+you\s+|will\s+you\s+)?/i, '')
      .replace(/\b(remind\s+me\s+(to\s+|about\s+)?|set\s+(a\s+|me\s+a\s+)?reminder\s+(to\s+|about\s+|for\s+)?|give\s+me\s+(a\s+)?reminder\s+(to\s+|about\s+|for\s+)?|create\s+(a\s+)?(reminder|task|alarm)\s+(to\s+|for\s+)?|add\s+(a\s+)?(reminder|task)\s+(to\s+|for\s+)?|schedule\s+(a\s+|me\s+a\s+)?(reminder|task|message|notification)\s+(to\s+|about\s+|for\s+)?|alert\s+me\s+(to\s+|about\s+)?|new\s+(reminder|task)\s+(to\s+|about\s+|for\s+)?)/i, '')
      .trim()
      .replace(/^["'`]+|["'`]+$/g, '')
      .replace(/^[.,;:\s]+|[.,;:\s]+$/g, '');
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

  // ── LLM classifier ───────────────────────────────────────────────────────

  private async classifyWithLlm(text: string): Promise<string | null> {
    const config = await this.getConfig();
    const agentList = ROUTABLE_AGENTS.map((a) => `- ${a.key}: ${a.desc}`).join('\n');

    const response = await this.llm.complete({
      ...agentLlmOpts(config),
      messages: [
        {
          role: 'system',
          content: `You route a single user message to ONE agent in an AI agent platform.

Available agents:
${agentList}

Decision rules:
- Pick the single best-matching agent. Bias toward picking an agent rather than null.
- Reminders, motivational messages, daily briefs, status checks → daily_reminder
- Emails, inbox, drafting replies, Gmail → email_manager
- Customer support / live chat / Crisp → crisp
- LinkedIn connections, outreach, DMs, posts → linkedin
- Reddit threads, comments, monitoring keywords → reddit
- Twitter/X, Facebook, social posts, scheduling → social
- WhatsApp messages → whatsapp
- Trial signups, onboarding emails for Taskip → taskip_trial
- Leave / salary / payroll / employee questions → hr
- Designs, banners, posters, Canva → canva
- YouTube Shorts, video scripts → shorts

Output ONLY JSON: {"agent": "<agent_key>", "confidence": "high|medium|low"}
Use {"agent": null, "confidence": "low"} only for greetings or unrelated chatter.`,
        },
        { role: 'user', content: text },
      ],
      maxTokens: 60,
      temperature: 0,
    });

    try {
      const raw = response.content.trim().replace(/^```json\s*|```$/g, '');
      const parsed = JSON.parse(raw) as { agent: string | null; confidence: string };
      if ((parsed.confidence === 'high' || parsed.confidence === 'medium') && parsed.agent) {
        const valid = ROUTABLE_AGENTS.find((a) => a.key === parsed.agent);
        return valid ? valid.key : null;
      }
    } catch {
      // ignore parse errors
    }
    return null;
  }

  // ── Reminder detection (relative + absolute) ─────────────────────────────

  private async detectReminder(text: string, tz: string): Promise<{ message: string; sendAt: Date; sendAtLabel: string } | null> {
    const nowUtc = new Date();
    const nowLocal = nowUtc.toLocaleString('en-US', { timeZone: tz, hour12: false });

    const rel = this.parseRelativeDuration(text);
    if (rel) {
      const sendAt = new Date(nowUtc.getTime() + rel.minutes * 60 * 1000);
      return {
        message: rel.message,
        sendAt,
        sendAtLabel:
          sendAt.toLocaleString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: true }) +
          ` (in ${rel.minutes} min)`,
      };
    }

    const config = await this.getConfig();
    const response = await this.llm.complete({
      ...agentLlmOpts(config),
      messages: [
        {
          role: 'system',
          content: `You detect timed reminders in user messages. Current UTC time: ${nowUtc.toISOString()}. User timezone: ${tz}, local time now: ${nowLocal}.

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
        const sendAt = new Date(nowUtc.getTime() + parsed.delayMinutes * 60 * 1000);
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
        const sendAt = this.computeNextLocalTimeUtc(hh, mm, tz, nowUtc, sendBefore);
        const localLabel = sendAt.toLocaleString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: true });
        return { message: parsed.message, sendAt, sendAtLabel: localLabel };
      }
      return null;
    } catch {
      return null;
    }
  }

  private parseRelativeDuration(text: string): { minutes: number; message: string } | null {
    const m = text.match(/\b(?:in|after|after\s+next|in\s+next)\s+(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours)\b/i);
    if (!m) return null;
    const value = parseInt(m[1], 10);
    const unit = m[2].toLowerCase();
    let minutes: number;
    if (/^(s|sec|secs|second|seconds)$/.test(unit)) minutes = Math.max(1, Math.round(value / 60));
    else if (/^(h|hr|hrs|hour|hours)$/.test(unit)) minutes = value * 60;
    else minutes = value;
    if (minutes < 1 || minutes > 60 * 24 * 7) return null;

    let message = text.replace(m[0], '').trim();
    message = message.replace(/^(please\s+)?(can\s+you\s+)?(send|remind|tell|message|text|give)\s+me\s+(a\s+)?(reminder\s+)?(to\s+|about\s+|for\s+)?/i, '').trim();
    message = message.replace(/^(a|an)\s+/i, '').trim();
    if (!message) message = text.trim();
    message = message.charAt(0).toUpperCase() + message.slice(1);
    return { minutes, message };
  }

  private computeNextLocalTimeUtc(hh: number, mm: number, tz: string, now: Date, minutesBefore: number): Date {
    const nowParts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(now);
    const get = (k: string) => Number(nowParts.find((p) => p.type === k)?.value ?? '0');
    const localY = get('year'), localMo = get('month'), localD = get('day');
    const localH = get('hour'), localMi = get('minute');

    const offsetMin = (localH * 60 + localMi) - (now.getUTCHours() * 60 + now.getUTCMinutes());
    let candidateUtc = Date.UTC(localY, localMo - 1, localD, hh, mm, 0) - offsetMin * 60 * 1000;
    const nowMs = now.getTime();
    if (candidateUtc - minutesBefore * 60 * 1000 <= nowMs) {
      candidateUtc += 24 * 60 * 60 * 1000;
    }
    return new Date(candidateUtc - minutesBefore * 60 * 1000);
  }
}
