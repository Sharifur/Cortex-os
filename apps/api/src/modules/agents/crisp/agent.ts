import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { agents } from '../../../db/schema';
import { crispConversations } from './schema';
import { CrispService } from './crisp.service';
import { AgentRegistryService } from '../runtime/agent-registry.service';
import { AgentLogService } from '../runtime/agent-log.service';
import { LlmRouterService } from '../../llm/llm-router.service';
import { TelegramService } from '../../telegram/telegram.service';
import { KnowledgeBaseService } from '../../knowledge-base/knowledge-base.service';
import { PurchaseVerifyService } from '../purchase-verify/purchase-verify.service';
import { SettingsService } from '../../settings/settings.service';
import { ContactsService } from '../../contacts/contacts.service';
import { hmacHex, safeEqualHex } from '../../../common/webhooks/verify';
import { agentLlmOpts } from '../runtime/llm-config.util';
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

interface CrispConfig {
  replyTone: string;
  productContext: string;
  maxConversationsPerRun: number;
  autoReply: boolean;
  debugWebhooks: boolean;
  llm?: { provider?: string; model?: string };
}

interface CrispSnapshot {
  newMessages: any[];
  config: CrispConfig;
  threadHistory?: Record<string, { role: 'customer' | 'agent'; text: string }[]>;
  runId: string;
}

const DEFAULT_CONFIG: CrispConfig = {
  replyTone: 'friendly, concise, and helpful — like a knowledgeable founder replying to a customer',
  productContext: 'Taskip is a project management SaaS for teams.',
  maxConversationsPerRun: 10,
  autoReply: true,
  debugWebhooks: false,
};

@Injectable()
export class CrispAgent implements IAgent, OnModuleInit {
  readonly key = 'crisp';
  readonly name = 'Crisp AI Agent';
  private readonly logger = new Logger(CrispAgent.name);

  constructor(
    private db: DbService,
    private llm: LlmRouterService,
    private telegram: TelegramService,
    private crisp: CrispService,
    private registry: AgentRegistryService,
    private kb: KnowledgeBaseService,
    private purchaseVerify: PurchaseVerifyService,
    private settings: SettingsService,
    private contactsSvc: ContactsService,
    private agentLog: AgentLogService,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  triggers(): TriggerSpec[] {
    return [
      { type: 'CRON', cron: '*/15 * * * *' },
      { type: 'WEBHOOK', webhookPath: '/crisp/webhook' },
      { type: 'MANUAL' },
    ];
  }

  async buildContext(trigger: TriggerEvent, run: RunContext): Promise<AgentContext> {
    const config = await this.getConfig();
    const newMessages: any[] = [];

    if (trigger.type === 'WEBHOOK' && trigger.payload) {
      const payload = trigger.payload as any;
      const event = payload?.event ?? 'unknown';

      if (config.debugWebhooks) {
        await this.agentLog.info(run.id, `Crisp webhook payload (event=${event})`, { event, payload });
      }

      const parsed = this.crisp.parseWebhookMessageDetailed(payload);
      if (!parsed.message) {
        await this.agentLog.info(run.id, `Crisp webhook ignored: ${parsed.reason}`, { event });
      } else {
        const msg = parsed.message;
        await this.agentLog.info(run.id, `Crisp webhook parsed OK (sessionId=${msg.sessionId.slice(-8)})`, {
          sessionId: msg.sessionId,
          websiteId: msg.websiteId,
          visitorEmail: msg.visitorEmail ?? null,
          visitorNickname: msg.visitorNickname ?? null,
          contentChars: (msg.content ?? '').length,
        });
        const [existing] = await this.db.db
          .select({ lastMessage: crispConversations.lastMessage })
          .from(crispConversations)
          .where(eq(crispConversations.sessionId, msg.sessionId))
          .limit(1);
        if (existing && existing.lastMessage === msg.content) {
          await this.agentLog.info(run.id, `Crisp webhook deduped (sessionId=${msg.sessionId.slice(-8)} same lastMessage)`);
        } else {
          newMessages.push(msg);
        }
      }
    } else {
      const conversations = await this.crisp.getOpenConversations(config.maxConversationsPerRun);
      for (const conv of conversations) {
        const [existing] = await this.db.db
          .select({ lastMessage: crispConversations.lastMessage })
          .from(crispConversations)
          .where(eq(crispConversations.sessionId, conv.sessionId))
          .limit(1);
        if (!existing || existing.lastMessage !== conv.content) {
          newMessages.push(conv);
        }
      }
    }

    return { source: trigger, snapshot: { newMessages, config, runId: run.id }, followups: [] };
  }

  async decide(ctx: AgentContext): Promise<ProposedAction[]> {
    const { newMessages, config, runId } = ctx.snapshot as CrispSnapshot;
    if (!newMessages.length) {
      return [{ type: 'noop', summary: 'No new Crisp conversations.', payload: {}, riskLevel: 'low' }];
    }

    // Parallel KB fetch (cached where possible)
    const [alwaysOn, samples, blocklist, rejections] = await Promise.all([
      this.kb.getAlwaysOnContext(this.key),
      this.kb.getWritingSamples(this.key),
      this.kb.getBlocklistRules(this.key),
      this.kb.getRecentRejections(this.key, 3),
    ]);

    const template = await this.kb.getPromptTemplate(this.key);

    const actions: ProposedAction[] = [];

    for (const msg of newMessages) {
      const sid = msg.sessionId.slice(-8);
      const stepStart = Date.now();
      const t = (): number => Date.now() - stepStart;
      try {
        await this.agentLog.info(runId, `[crisp ${sid}] step 1/7: fetching KB + thread + overrides`, {
          sessionId: msg.sessionId,
          websiteId: msg.websiteId,
          visitorEmail: msg.visitorEmail ?? null,
          visitorNickname: msg.visitorNickname ?? null,
          contentPreview: (msg.content ?? '').slice(0, 200),
        });

        // Per-message: FTS search + visitor memory + conversation thread + per-site overrides (parallel)
        const [references, previousReplies, threadHistory, overrides] = await Promise.all([
          this.kb.searchEntries(msg.content ?? '', this.key, 5).catch((e: Error) => {
            void this.agentLog.warn(runId, `[crisp ${sid}] KB search failed (continuing without): ${e.message}`);
            return [];
          }),
          this.getVisitorHistory(msg.visitorEmail, msg.visitorNickname).catch((e: Error) => {
            void this.agentLog.warn(runId, `[crisp ${sid}] visitor history failed (continuing without): ${e.message}`);
            return [];
          }),
          this.crisp.getSessionThread(msg.sessionId, msg.websiteId, 5).catch((e: Error) => {
            void this.agentLog.warn(runId, `[crisp ${sid}] session thread fetch failed (continuing without): ${e.message}`);
            return [];
          }),
          this.crisp.getOverridesForWebsite(msg.websiteId).catch((e: Error) => {
            void this.agentLog.warn(runId, `[crisp ${sid}] site overrides fetch failed (continuing without): ${e.message}`);
            return { productContext: undefined, replyTone: undefined };
          }),
        ]);

        await this.agentLog.info(runId, `[crisp ${sid}] step 2/7: context built (+${t()}ms)`, {
          referencesCount: references.length,
          previousRepliesCount: previousReplies.length,
          threadTurns: threadHistory.length,
          hasSiteProductContext: !!overrides.productContext,
          hasSiteReplyTone: !!overrides.replyTone,
        });

        const productContext = overrides.productContext || config.productContext;
        const replyTone = overrides.replyTone || config.replyTone;

        const kbBlock = this.kb.buildKbPromptBlock({
          voiceProfile: alwaysOn.find(e => e.entryType === 'voice_profile') ?? null,
          facts: alwaysOn.filter(e => e.entryType === 'fact'),
          references,
          positiveSamples: samples.filter(s => s.polarity === 'positive'),
          negativeSamples: samples.filter(s => s.polarity === 'negative'),
          rejections,
          threadHistory,
        });

        const visitorMemory = previousReplies.length
          ? `\n\nPrevious interactions with this visitor:\n${previousReplies
              .map(r => `Customer: "${r.msg?.slice(0, 150)}" → You replied: "${r.draft?.slice(0, 150)}"`)
              .join('\n')}`
          : '';

        let purchaseBlock = '';
        const purchaseCodes = PurchaseVerifyService.extractPurchaseCodes(msg.content ?? '');
        if (purchaseCodes.length && PurchaseVerifyService.hasSupportIntent(msg.content ?? '')) {
          const verifyResult = await this.purchaseVerify.verify(purchaseCodes[0]).catch((e: Error) => {
            void this.agentLog.warn(runId, `[crisp ${sid}] purchase-verify failed (continuing without): ${e.message}`);
            return null;
          });
          if (verifyResult) purchaseBlock = PurchaseVerifyService.buildVerifyPromptBlock(verifyResult);
        }

        // Persist the conversation + contact FIRST so they exist even if the
        // LLM later fails. The draft starts empty and gets filled in once the
        // model replies.
        const receivedAt = new Date(msg.timestamp ? msg.timestamp * 1000 : Date.now());
        await this.db.db
          .insert(crispConversations)
          .values({
            sessionId: msg.sessionId,
            websiteId: msg.websiteId,
            visitorEmail: msg.visitorEmail ?? null,
            visitorNickname: msg.visitorNickname ?? null,
            lastMessage: msg.content.slice(0, 2000),
            status: 'new',
            receivedAt,
          })
          .onConflictDoUpdate({
            target: crispConversations.sessionId,
            set: {
              lastMessage: msg.content.slice(0, 2000),
              visitorEmail: msg.visitorEmail ?? null,
              visitorNickname: msg.visitorNickname ?? null,
              status: 'new',
              receivedAt,
              repliedAt: null,
            },
          });
        await this.agentLog.info(runId, `[crisp ${sid}] step 3/7: conversation row upserted (+${t()}ms)`);

        try {
          const contactId = await this.crisp.upsertContactForCrisp({
            sessionId: msg.sessionId,
            websiteId: msg.websiteId,
            email: msg.visitorEmail,
            nickname: msg.visitorNickname,
          });
          await this.contactsSvc.addActivity(
            contactId,
            'crisp_message',
            `Crisp message: "${msg.content.slice(0, 200)}"`,
            { refId: msg.sessionId, meta: { websiteId: msg.websiteId } },
          );
          await this.agentLog.info(runId, `[crisp ${sid}] step 4/7: contact upserted (+${t()}ms)`, { contactId });
        } catch (err) {
          this.logger.warn(`Failed to upsert contact for Crisp ${msg.sessionId}: ${(err as Error).message}`);
          await this.agentLog.warn(runId, `[crisp ${sid}] step 4/7 contact upsert FAILED (continuing): ${(err as Error).message}`);
        }

        const defaultSystem = `You are a customer support agent. Context: ${productContext}\nTone: ${replyTone}\nWrite a direct reply to the customer message. 2-4 sentences max. No greetings like "Dear" or closings like "Best regards". Just the reply.`;
        const systemPrompt = (template?.system ?? defaultSystem) + kbBlock + visitorMemory + purchaseBlock;

        const llmOpts = agentLlmOpts(config);
        await this.agentLog.info(runId, `[crisp ${sid}] step 5/7: calling LLM`, {
          provider: llmOpts.provider ?? '(global default)',
          model: llmOpts.model ?? '(provider default)',
          systemPromptChars: systemPrompt.length,
          userPromptChars: (msg.content ?? '').length,
        });

        const llmStart = Date.now();
        let response;
        try {
          response = await this.llm.complete({
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: msg.content },
            ],
            ...llmOpts,
            maxTokens: 200,
          });
        } catch (err) {
          const m = (err as Error)?.message ?? String(err);
          await this.agentLog.error(runId, `[crisp ${sid}] step 5/7 LLM call FAILED (+${Date.now() - llmStart}ms): ${m}`, {
            provider: llmOpts.provider ?? '(global default)',
            model: llmOpts.model ?? '(provider default)',
            stack: (err as Error)?.stack?.split('\n').slice(0, 5).join('\n'),
          });
          throw err;
        }

        let draft = response.content.trim();
        await this.agentLog.info(runId, `[crisp ${sid}] step 5/7: LLM returned (+${Date.now() - llmStart}ms)`, {
          draftLength: draft.length,
          draftPreview: draft.slice(0, 200),
          provider: response.provider,
          model: response.model,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
        });
        if (!draft) {
          await this.agentLog.warn(runId, `[crisp ${sid}] LLM returned empty draft — skipping`);
          continue;
        }

        // Self-critique for medium/high risk (always medium for customer replies)
        try {
          const before = draft;
          draft = await this.selfCritique(draft, alwaysOn.find(e => e.entryType === 'voice_profile')?.content, blocklist);
          await this.agentLog.info(runId, `[crisp ${sid}] step 6/7: self-critique done (changed=${before !== draft})`);
        } catch (err) {
          await this.agentLog.warn(runId, `[crisp ${sid}] step 6/7 self-critique FAILED (using original draft): ${(err as Error).message}`);
        }

        // Blocklist check
        const violation = blocklist.find(p => draft.toLowerCase().includes(p.toLowerCase()));
        if (violation) {
          await this.agentLog.warn(runId, `[crisp ${sid}] blocklist hit: "${violation}" — risk=high`);
        }

        // Now that the draft exists, attach it to the conversation row.
        await this.db.db
          .update(crispConversations)
          .set({ draftReply: draft })
          .where(eq(crispConversations.sessionId, msg.sessionId));

        const visitorLabel = msg.visitorNickname ?? msg.visitorEmail ?? msg.sessionId.slice(-8);
        const willAutoReply = config.autoReply ?? true;

        actions.push({
          type: 'send_reply',
          summary: `Reply to ${visitorLabel}: "${draft.slice(0, 80)}"${violation ? ` [Blocklist: "${violation}"]` : ''}`,
          payload: { sessionId: msg.sessionId, websiteId: msg.websiteId, visitorLabel, message: msg.content, draft, autoReply: willAutoReply },
          riskLevel: violation ? 'high' : 'medium',
        });
        await this.agentLog.info(runId, `[crisp ${sid}] step 7/7: action queued (autoReply=${willAutoReply}, total=${t()}ms)`);
      } catch (err) {
        const message = (err as Error)?.message ?? String(err);
        const stack = (err as Error)?.stack;
        this.logger.warn(`Failed to draft Crisp reply: ${message}`);
        await this.agentLog.error(runId, `[crisp ${sid}] draft loop ABORTED: ${message}`, {
          sessionId: msg.sessionId,
          websiteId: msg.websiteId,
          stack: stack?.split('\n').slice(0, 8).join('\n'),
        });
      }
    }

    return actions.length
      ? actions
      : [{ type: 'noop', summary: 'No actionable conversations.', payload: {}, riskLevel: 'low' }];
  }

  requiresApproval(action: ProposedAction): boolean {
    if (action.type === 'send_reply') {
      return !(action.payload as any).autoReply;
    }
    return false;
  }

  async execute(action: ProposedAction): Promise<ActionResult> {
    if (action.type === 'noop') return { success: true };
    const p = action.payload as any;

    if (action.type === 'send_reply') {
      await this.crisp.sendReply(p.sessionId, p.websiteId, p.draft);
      await this.db.db
        .update(crispConversations)
        .set({ status: 'replied', repliedAt: new Date() })
        .where(eq(crispConversations.sessionId, p.sessionId));
      await this.telegram.sendMessage(
        `Crisp [auto-sent] to ${p.visitorLabel}\n\nCustomer: "${p.message.slice(0, 200)}"\n\nReply: "${p.draft}"`,
      );
      return { success: true, data: { sessionId: p.sessionId } };
    }

    return { success: true };
  }

  mcpTools(): McpToolDefinition[] {
    return [
      {
        name: 'get_open_conversations',
        description: 'Fetch recent open Crisp chat conversations',
        inputSchema: { type: 'object', properties: { limit: { type: 'number' } } },
        handler: async (input) => this.crisp.getOpenConversations((input as any).limit ?? 10),
      },
      {
        name: 'get_crisp_thread',
        description: 'Get a tracked conversation from DB by sessionId',
        inputSchema: { type: 'object', properties: { sessionId: { type: 'string' } }, required: ['sessionId'] },
        handler: async (input) => {
          const [row] = await this.db.db
            .select()
            .from(crispConversations)
            .where(eq(crispConversations.sessionId, (input as any).sessionId));
          return row ?? null;
        },
      },
    ];
  }

  apiRoutes(): AgentApiRoute[] {
    return [
      {
        method: 'GET',
        path: '/crisp/conversations',
        requiresAuth: true,
        handler: async () => this.db.db.select().from(crispConversations).limit(50),
      },
      {
        method: 'POST',
        path: '/crisp/webhook',
        requiresAuth: false,
        verifySignature: async (rawBody, headers, query) => {
          // Defense in depth: the payload must reference a website_id we know
          // about. Stops random POSTs from being treated as Crisp events.
          let payloadOk = true;
          try {
            const parsed = rawBody ? JSON.parse(rawBody) : {};
            const websiteId = parsed?.website_id as string | undefined;
            if (websiteId) {
              const creds = await this.crisp.getCredentialsForWebsite(websiteId);
              payloadOk = !!creds;
              if (!payloadOk) {
                this.logger.warn(`Crisp webhook for unknown website_id=${websiteId} — rejecting.`);
              }
            }
          } catch {
            payloadOk = false;
          }
          if (!payloadOk) return false;

          // Mode 1 — URL token (?t=<token>). Use this when Crisp does not
          // expose a signing secret. Generate a random string and append to
          // the hook URL configured in Crisp (e.g. /crisp/webhook?t=abc123).
          const token = await this.settings.getDecrypted('crisp_webhook_token');
          if (token) {
            const provided = (query?.t ?? '').toString();
            if (provided === token) return true;
            this.logger.warn('Crisp webhook ?t=<token> mismatch — rejecting.');
            return false;
          }

          // Mode 2 — HMAC signature (Crisp plans that expose a signing secret).
          const secret = await this.settings.getDecrypted('crisp_webhook_signing_secret');
          if (secret) {
            const sig = (headers['x-crisp-signature'] as string | undefined)?.trim();
            if (!sig) {
              this.logger.warn('Crisp webhook missing X-Crisp-Signature header — rejecting.');
              return false;
            }
            const expected = hmacHex('sha256', secret, rawBody);
            const ok = safeEqualHex(sig, expected);
            if (!ok) this.logger.warn('Crisp webhook HMAC mismatch — rejecting.');
            return ok;
          }

          // Mode 3 — fallback. No token + no secret. Accept (the website_id
          // check above is the only gate). Log a clear warning so the
          // operator knows to configure crisp_webhook_token.
          this.logger.warn(
            'Crisp webhook accepted without auth — set crisp_webhook_token (or crisp_webhook_signing_secret) to harden this endpoint.',
          );
          return true;
        },
        handler: async (body) => {
          // Log the inbound event so the user can see it in Debug Logs even
          // before the agent runtime kicks off the actual run.
          const event = (body as { event?: string } | undefined)?.event ?? 'unknown';
          const session = (body as { data?: { session_id?: string } } | undefined)?.data?.session_id ?? '';
          this.logger.log(`Crisp webhook received: event=${event} session=${session}`);
          return { received: true };
        },
      },
    ];
  }

  private async getConfig(): Promise<CrispConfig> {
    const [row] = await this.db.db.select().from(agents).where(eq(agents.key, this.key));
    return { ...DEFAULT_CONFIG, ...(row?.config as Partial<CrispConfig> ?? {}) };
  }

  private async getVisitorHistory(visitorEmail?: string | null, visitorNickname?: string | null) {
    if (!visitorEmail && !visitorNickname) return [];
    try {
      return this.db.db
        .select({ draft: crispConversations.draftReply, msg: crispConversations.lastMessage })
        .from(crispConversations)
        .where(
          and(
            visitorEmail ? eq(crispConversations.visitorEmail, visitorEmail) : eq(crispConversations.visitorNickname, visitorNickname!),
            eq(crispConversations.status, 'replied'),
          ),
        )
        .limit(2)
        .orderBy(desc(crispConversations.repliedAt));
    } catch {
      return [];
    }
  }

  private async selfCritique(draft: string, voiceProfile?: string, blocklist?: string[]): Promise<string> {
    try {
      const critique = await this.llm.complete({
        messages: [
          {
            role: 'system',
            content: `You are a strict editor. Review this draft reply.
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
      if (!result.ok && result.revised) return result.revised.trim();
    } catch {
      // fail-open: use original draft
    }
    return draft;
  }
}
