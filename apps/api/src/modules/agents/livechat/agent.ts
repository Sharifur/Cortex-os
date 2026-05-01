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
    const [alwaysOn, samples, blocklist, rejections, references, recentMessages, recentPageviews, visitor] = await Promise.all([
      this.kb.getAlwaysOnContext(this.key, siteKey),
      this.kb.getWritingSamples(this.key, siteKey),
      this.kb.getBlocklistRules(this.key, siteKey),
      this.kb.getRecentRejections(this.key, 3),
      this.kb.searchEntries(input.visitorMessage, this.key, 5, siteKey).catch((e: Error) => {
        this.logger.warn(`KB search failed: ${e.message}`);
        return [];
      }),
      this.livechat.getRecentMessages(input.sessionId, 10),
      this.livechat.getRecentPageviews(session.visitorPk, 5),
      this.livechat.getVisitor(session.visitorPk),
    ]);

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

    const botPersona = site?.botName ? `You are ${site.botName}, a live chat assistant. ` : 'You are a live chat assistant on the website. ';
    const defaultSystem = `${botPersona}${productContext ? `Product context: ${productContext}\n` : ''}Tone: ${replyTone}\nWrite a direct reply to the visitor. 2-4 sentences max. No greetings like "Dear" or closings like "Best regards". When the visitor's current page is relevant (pricing, docs, a specific feature), reference it naturally. Just the reply.`;
    const systemPrompt = (template?.system ?? defaultSystem) + kbBlock + visitorBlock;

    // Per-site LLM override beats the agent-level config.
    const baseLlmOpts = agentLlmOpts(config);
    const llmOpts: typeof baseLlmOpts = { ...baseLlmOpts };
    if (site?.llmProvider) llmOpts.provider = site.llmProvider as typeof baseLlmOpts.provider;
    if (site?.llmModel) llmOpts.model = site.llmModel;

    const retries = Math.max(0, Math.min(2, config.selfCritiqueRetries ?? 1));
    let draft: string;
    try {
      const response = await this.llm.complete({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: input.visitorMessage },
        ],
        ...llmOpts,
        maxTokens: 220,
      });
      draft = response.content.trim();
    } catch (err) {
      this.logger.warn(`Live chat LLM call failed: ${(err as Error).message}`);
      return this.postFallback(input.sessionId);
    }

    if (!draft) return this.postFallback(input.sessionId);

    const voiceProfile = alwaysOn.find((e) => e.entryType === 'voice_profile')?.content;
    let critiquePassed = false;
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

    const violation = blocklist.find((p) => draft.toLowerCase().includes(p.toLowerCase()));
    if (violation) {
      this.logger.warn(`Live chat blocklist hit: "${violation}" — escalating to needs_human`);
      return this.postFallback(input.sessionId);
    }

    const autoApprove = site?.autoApprove ?? true;
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
      this.stream.publish(input.sessionId, {
        type: 'message',
        sessionId: input.sessionId,
        role: 'agent',
        content: draft,
        messageId: agentMsg.id,
        createdAt: agentMsg.createdAt.toISOString(),
      });
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
