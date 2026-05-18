import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { eq, and, gte, inArray, sql } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { agents } from '../../../db/schema';
import { writingSamples } from '../../knowledge-base/schema';
import {
  linkedinPosts, linkedinLeads, linkedinAccounts, linkedinNiches, linkedinConnectionRequests, linkedinDmSequences,
} from './schema';
import { LinkedInService } from './linkedin.service';
import { LinkedInCommentService } from './linkedin-comment.service';
import { LinkedInConnectionService } from './linkedin-connection.service';
import { LinkedInDmService } from './linkedin-dm.service';
import { LinkedInTemplateService } from './linkedin-template.service';
import { AgentRegistryService } from '../runtime/agent-registry.service';
import { AgentLogService } from '../runtime/agent-log.service';
import { LlmRouterService } from '../../llm/llm-router.service';
import { TelegramService } from '../../telegram/telegram.service';
import { KnowledgeBaseService } from '../../knowledge-base/knowledge-base.service';
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

interface LinkedInConfig {
  targetTopics: string[];
  maxCommentsPerRun: number;
  maxDMsPerRun: number;
  maxConnectionRequestsPerRun: number;
  commentTone: string;
  icpScoreThreshold: number;
  blockedCountries?: string[];
  llm?: { provider?: string; model?: string };
}

type LinkedInActionType = 'comments' | 'connections' | 'dms' | 'all';

interface LinkedInSnapshot {
  feedPosts: any[];
  config: LinkedInConfig;
  accounts: any[];
  niches: any[];
  taskMode?: boolean;
  instructions?: string;
  runId?: string;
  actionType: LinkedInActionType;
}

// ─── Post Category System ─────────────────────────────────────────────────────

type PostCategory =
  | 'job_new'          // "Excited to join..." — person announcing a new role
  | 'hiring'           // "We're hiring..." — company/person recruiting
  | 'success_milestone'// "We just hit X users / $X revenue..."
  | 'design_creative'  // Sharing a design, UI screenshot, visual work
  | 'question'         // Asking for advice, opinions, or a poll
  | 'insight'          // Sharing a lesson, framework, hot take, opinion
  | 'personal_story'   // Career journey, personal reflection, life event
  | 'product_launch'   // Launching or announcing a product/feature
  | 'event'            // Webinar, conference, virtual event
  | 'other';

function classifyPost(content: string): PostCategory {
  const t = content.toLowerCase();

  const matchesAny = (terms: string[]) => terms.some(k => t.includes(k));

  if (matchesAny(['excited to join', "i'm joining", "i've joined", 'thrilled to announce i', 'starting my new role', 'first day at', 'new chapter', 'new position at', 'new role at']))
    return 'job_new';

  if (matchesAny(["we're hiring", 'we are hiring', "i'm hiring", 'looking for a', 'open role', 'job opening', 'apply now', 'join our team', 'seeking a', 'we have an opening']))
    return 'hiring';

  if (matchesAny(['just hit', 'just crossed', 'we reached', 'milestone', 'users', 'mrr', 'revenue', 'customers', '1k', '10k', '100k', '1m', 'sold out', 'launched and']))
    return 'success_milestone';

  if (matchesAny(['product launch', 'announcing', 'we just launched', 'now available', 'introducing', 'releasing', 'ship', 'beta is live', 'go live']))
    return 'product_launch';

  if (matchesAny(['webinar', 'conference', 'event', 'meetup', 'summit', 'workshop', 'register', 'rsvp', 'join us on', 'join us for']))
    return 'event';

  if (matchesAny(['designed', 'redesigned', 'ui', 'ux', 'design', 'figma', 'mockup', 'wireframe', 'visual', 'illustration', 'branding', 'color palette', 'typography']))
    return 'design_creative';

  if (matchesAny(['what do you think', 'thoughts?', 'agree?', 'disagree?', 'your experience', 'poll:', 'question:', 'asking', "what's your", 'how do you', 'anyone else']))
    return 'question';

  if (matchesAny(['i learned', "here's what", 'lesson:', 'unpopular opinion', 'hot take', 'truth:', 'reality:', 'mistake i made', 'i used to', 'stop doing', 'start doing', 'tip:', 'framework']))
    return 'insight';

  if (matchesAny(['my journey', 'my story', 'personal', 'vulnerable', 'i want to share', 'two years ago', 'a year ago', 'looking back', 'gratitude', 'grateful', 'burnout', 'mental health']))
    return 'personal_story';

  return 'other';
}

const CATEGORY_COMMENT_RULES: Record<PostCategory, string> = {
  job_new: `This is a new job announcement. Rules for this category:
- Congratulate warmly and specifically (mention the company or role if visible)
- Do NOT pitch any product or service
- Do NOT ask generic questions like "what will you be working on?" — they just told you
- Keep it to 1 sentence, warm and personal`,

  hiring: `This is a hiring post. Rules for this category:
- Acknowledge what they are looking for
- You may reference your product only if the role directly involves it (e.g. hiring a dev tool user)
- Do NOT pitch your product or redirect the conversation
- Keep it brief and supportive`,

  success_milestone: `This is a milestone or success announcement. Rules for this category:
- Celebrate genuinely — be specific about what you find impressive
- Do NOT pitch your product or claim credit
- Do NOT use generic phrases like "Congrats!" alone — add something specific
- 1-2 sentences max`,

  design_creative: `This is a design or creative post. Rules for this category:
- Comment on the visual or creative aspect specifically
- Reference what you notice from the description (style, approach, problem solved)
- Do NOT pitch any product
- Avoid generic "Looks great!" — say WHY it works`,

  question: `This is a question or poll post. Rules for this category:
- Answer the question directly if you have relevant insight
- Add your own short perspective or experience
- Do NOT start with "Great question!"
- 1-2 sentences — direct and useful`,

  insight: `This is a thought-leadership or insight post. Rules for this category:
- Engage with the idea — agree, respectfully challenge, or extend it with your own take
- You may briefly reference a related experience
- Do NOT just validate — add something substantive
- 1-2 sentences`,

  personal_story: `This is a personal story or reflection. Rules for this category:
- Respond on a human level — empathy first
- Do NOT pitch any product
- Do NOT give unsolicited advice
- 1 short sentence that acknowledges what they shared`,

  product_launch: `This is a product launch or feature announcement. Rules for this category:
- Congratulate and ask one specific genuine question about the product
- Do NOT compare to or mention your own product
- Do NOT say "I'd love to collaborate" or redirect to yourself
- 1-2 sentences`,

  event: `This is an event announcement. Rules for this category:
- Express genuine interest or ask about one specific aspect of the event
- Do NOT redirect to your own product or event
- Keep it brief`,

  other: `Rules for this post:
- Give a genuine, specific reaction based on what was actually written
- Do NOT start with generic openers like "Great post!" or "So true!"
- No self-promotion. 1-2 sentences`,
};

const CATEGORY_VALIDATION_PHRASES: Partial<Record<PostCategory, string[]>> = {
  job_new: ['our product', 'check out', 'try', 'visit', 'sign up', 'join our', 'book a demo', 'free trial'],
  hiring: [],
  success_milestone: ['our product', 'check out', 'try our', 'we can help', 'book a demo'],
  personal_story: ['our product', 'check out', 'try our', 'we can help', 'book a demo', 'by the way'],
};

function validateCommentForCategory(comment: string, category: PostCategory): string | null {
  const blocked = CATEGORY_VALIDATION_PHRASES[category] ?? [];
  const lower = comment.toLowerCase();
  const found = blocked.find(p => lower.includes(p));
  return found ? `Contains disallowed phrase for ${category}: "${found}"` : null;
}

// Detects posts with explicit CTA like: comment "LINKEDIN", comment 'FREE', comment WORD
// Returns the keyword to post verbatim, or null if no CTA found.
function detectCtaKeyword(content: string): string | null {
  const dq = content.match(/(?:comment|type|reply|say)\s+["“”]([^"“”]{1,30})["“”]/i);
  if (dq) return dq[1].trim();
  const sq = content.match(/(?:comment|type|reply|say)\s+'([^']{1,30})'/i);
  if (sq) return sq[1].trim();
  const caps = content.match(/\bcomment\s+([A-Z]{3,15})\b/);
  if (caps) return caps[1].trim();
  return null;
}

const DEFAULT_CONFIG: LinkedInConfig = {
  targetTopics: [
    'digital agency', 'marketing agency', 'web agency', 'agency growth',
    'freelancing', 'freelance developer', 'freelance designer', 'independent consultant',
    'client management', 'project management', 'scaling agency', 'SaaS tools for agencies',
  ],
  maxCommentsPerRun: 3,
  maxDMsPerRun: 3,
  maxConnectionRequestsPerRun: 3,
  commentTone: 'helpful, insight-driven — speaks to agency owners and freelancers, positions Taskip as a tool for scaling without adding headcount, never promotional',
  icpScoreThreshold: 0.65,
};

@Injectable()
export class LinkedInAgent implements IAgent, OnModuleInit {
  readonly key = 'linkedin';
  readonly name = 'LinkedIn AI Agent';
  private readonly logger = new Logger(LinkedInAgent.name);

  constructor(
    private db: DbService,
    private llm: LlmRouterService,
    private telegram: TelegramService,
    private li: LinkedInService,
    private liComment: LinkedInCommentService,
    private liConnection: LinkedInConnectionService,
    private liDm: LinkedInDmService,
    private liTemplate: LinkedInTemplateService,
    private registry: AgentRegistryService,
    private kb: KnowledgeBaseService,
    private logSvc: AgentLogService,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  triggers(): TriggerSpec[] {
    return [
      // Staggered daily schedule — each action runs independently, hours apart
      { type: 'CRON', cron: '23 9 * * *',  payload: { actionType: 'comments' } },
      { type: 'CRON', cron: '41 11 * * *', payload: { actionType: 'connections' } },
      { type: 'CRON', cron: '17 14 * * *', payload: { actionType: 'dms' } },
      { type: 'MANUAL' },
    ];
  }

  async buildContext(trigger: TriggerEvent, run: RunContext): Promise<AgentContext> {
    const config = await this.getConfig();
    const payload = trigger.payload as Record<string, unknown> | null;

    if (payload?._taskId) {
      return {
        source: trigger,
        snapshot: { taskMode: true, instructions: (payload.instructions as string) ?? '', config, feedPosts: [], accounts: [], niches: [], runId: run.id, actionType: 'all' },
        followups: [],
      };
    }

    const actionType = (payload?.actionType as LinkedInActionType | undefined) ?? 'all';

    const [accounts, niches] = await Promise.all([
      this.db.db.select().from(linkedinAccounts).where(eq(linkedinAccounts.isActive, true)),
      this.db.db.select().from(linkedinNiches).where(eq(linkedinNiches.isActive, true)),
    ]);

    const primaryAccountId = accounts[0]?.unipileAccountId;

    // Only fetch feed when the run will actually process comments.
    // Native feed returns Unipile-internal post IDs which work with the comment API.
    // Voyager feed returns activity URNs which the comment API cannot resolve — used only as fallback.
    let feedPosts: any[] = [];
    if ((actionType === 'comments' || actionType === 'all') && primaryAccountId) {
      const nativeResult = await this.li.getNativeFeedPosts(primaryAccountId, 20);
      if (nativeResult.posts.length) {
        feedPosts = nativeResult.posts;
        await this.logSvc.info(run.id, 'LinkedIn feed (native)', { posts: feedPosts.length });
      } else {
        // Native returned nothing — fall back to Voyager proxy (commenting may fail for these)
        const voyagerResult = await this.li.getFeedWithDiagnostics(20, primaryAccountId);
        feedPosts = voyagerResult.posts;
        await this.logSvc.info(run.id, 'LinkedIn feed (Voyager fallback)', {
          status: voyagerResult.status,
          posts: voyagerResult.posts.length,
          error: voyagerResult.error,
          nativeRaw: nativeResult.raw,
        });
      }
    }

    await this.logSvc.info(run.id, `LinkedIn context [action: ${actionType}]`, {
      accounts: accounts.length,
      primaryAccountId: primaryAccountId ?? null,
      feedPosts: feedPosts.length,
      niches: niches.length,
    });

    return { source: trigger, snapshot: { feedPosts, config, accounts, niches, runId: run.id, actionType }, followups: [] };
  }

  async decide(ctx: AgentContext): Promise<ProposedAction[]> {
    const snap = ctx.snapshot as LinkedInSnapshot;
    if (snap.taskMode) {
      const followupNote = ctx.followups?.at(-1)?.text;
      return this.decideTaskMode(snap.config, snap.instructions ?? '', followupNote);
    }

    const at = snap.actionType ?? 'all';
    const runId = snap.runId ?? '';

    const [commentActions, connectionActions, dmActions] = await Promise.all([
      at === 'comments' || at === 'all'
        ? this.decideFeedComments(snap.feedPosts, snap.accounts, snap.niches, snap.config, runId)
        : Promise.resolve([]),
      at === 'connections' || at === 'all'
        ? this.decideConnectionRequests(snap.accounts, snap.niches, snap.config, runId)
        : Promise.resolve([]),
      at === 'dms' || at === 'all'
        ? this.decideDMs(snap.accounts, snap.config, runId)
        : Promise.resolve([]),
    ]);

    const all = [...commentActions, ...connectionActions, ...dmActions];
    return all.length ? all : [{ type: 'noop', summary: `No actionable items for action: ${at}`, payload: {}, riskLevel: 'low' }];
  }

  requiresApproval(action: ProposedAction): boolean {
    return action.type === 'post_comment'
      || action.type === 'send_dm'
      || action.type === 'publish_post'
      || action.type === 'send_connection_request';
  }

  async execute(action: ProposedAction): Promise<ActionResult> {
    if (action.type === 'noop') return { success: true };
    const p = action.payload as any;

    if (action.type === 'post_comment') {
      try {
        await this.liComment.postComment(p.postId, p.comment, p.accountId);
        await this.db.db
          .update(linkedinPosts)
          .set({ status: 'posted', postedAt: new Date(), accountId: p.dbAccountId ?? null })
          .where(eq(linkedinPosts.externalId, p.postId));
        await this.telegram.sendMessage(`LinkedIn comment posted on ${p.authorName}'s post:\n${p.comment}`);
      } catch (err) {
        const msg = (err as Error).message;
        this.logger.warn(`post_comment skipped for ${p.postId}: ${msg}`);
        await this.db.db
          .update(linkedinPosts)
          .set({ status: 'failed' })
          .where(eq(linkedinPosts.externalId, p.postId));
        await this.telegram.sendMessage(`Comment failed on ${p.authorName ?? 'unknown'}'s post:\n${msg.slice(0, 300)}`);
        return { success: false, error: msg };
      }
      return { success: true, data: { postId: p.postId } };
    }

    if (action.type === 'send_connection_request') {
      await this.db.db
        .update(linkedinConnectionRequests)
        .set({ status: 'sending' as any })
        .where(eq(linkedinConnectionRequests.id, p.requestId));
      try {
        await this.liConnection.sendConnectionRequest(p.accountId, p.profileId, p.note);
        await this.db.db
          .update(linkedinConnectionRequests)
          .set({ status: 'sent', sentAt: new Date() })
          .where(eq(linkedinConnectionRequests.id, p.requestId));
        await this.db.db
          .update(linkedinLeads)
          .set({ connectionStatus: 'pending' })
          .where(eq(linkedinLeads.profileId, p.profileId));
        await this.telegram.sendMessage(
          `LinkedIn connection request sent to ${p.profileName}\nHeadline: ${p.profileHeadline ?? '—'}\nNiche: ${p.nicheName ?? '—'}\nScore: ${p.icpScore ?? '—'}\nNote: ${p.note}`,
        );
      } catch (err) {
        await this.db.db
          .update(linkedinConnectionRequests)
          .set({ status: 'failed' })
          .where(eq(linkedinConnectionRequests.id, p.requestId));
        throw err;
      }
      return { success: true };
    }

    if (action.type === 'send_dm') {
      await this.liDm.sendDM(p.profileId, p.message, p.accountId);
      if (p.leadId) {
        const nextStep: number = (p.nextDmStep ?? 0) + 1;
        const exhausted = p.totalSteps && nextStep >= p.totalSteps;
        try {
          const leadUpdate: Record<string, any> = {
            lastContactedAt: new Date(),
            dmStep: nextStep,
            status: exhausted ? 'dm_exhausted' : 'dm_sent',
          };
          if (p.sequenceId) leadUpdate['dmSequenceId'] = p.sequenceId;
          await this.db.db
            .update(linkedinLeads)
            .set(leadUpdate)
            .where(eq(linkedinLeads.id, p.leadId));
        } catch (updateErr: any) {
          // Migration 0082 may not have run yet — fall back to basic update
          if (String(updateErr?.message).includes('dm_step') || String(updateErr?.message).includes('dm_sequence_id')) {
            await this.db.db
              .update(linkedinLeads)
              .set({ lastContactedAt: new Date(), status: 'dm_sent' })
              .where(eq(linkedinLeads.id, p.leadId));
            this.logger.warn(`send_dm: dm_step column missing — run migration 0082. Basic lead update applied.`);
          } else {
            throw updateErr;
          }
        }
      }
      const stepLabel = p.nextDmStep ? ` (step ${p.nextDmStep}/${p.totalSteps ?? '?'})` : '';
      await this.telegram.sendMessage(`LinkedIn DM sent to ${p.name ?? p.profileId}${stepLabel}:\n${p.message.slice(0, 200)}`);
      return { success: true };
    }

    if (action.type === 'publish_post') {
      await this.li.publishPost(p.draft, p.accountId);
      await this.telegram.sendMessage(`LinkedIn post published:\n\n${p.draft.slice(0, 300)}`);
      return { success: true, data: { published: true } };
    }

    return { success: true };
  }

  // ─── Rate-limit helper ─────────────────────────────────────────────────────

  private async accountQuota(
    accountId: string,
    dailyLimit: number | null | undefined,
    fallback: number,
    countFn: (since: Date) => Promise<number>,
  ): Promise<number> {
    const limit = dailyLimit ?? fallback;
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const n = await countFn(dayStart);
    return Math.max(0, limit - n);
  }

  // ─── Feed comments ─────────────────────────────────────────────────────────

  private async decideFeedComments(feedPosts: any[], accounts: any[], niches: any[], config: LinkedInConfig, runId: string): Promise<ProposedAction[]> {
    if (!feedPosts.length) {
      await this.logSvc.warn(runId, 'Feed comments: no posts returned from Unipile — check Unipile API key and DSN in Settings');
      return [];
    }

    const commentingAccounts = accounts.filter(a => a.isActive && a.enableComments !== false);
    if (!commentingAccounts.length) {
      await this.logSvc.warn(runId, 'Feed comments: no accounts have comments enabled');
      return [];
    }

    const quotas = await Promise.all(commentingAccounts.map(a =>
      this.accountQuota(a.id, a.dailyCommentsLimit, 10, (since) =>
        this.db.db.select({ id: linkedinPosts.id }).from(linkedinPosts)
          .where(and(
            eq(linkedinPosts.accountId, a.id),
            eq(linkedinPosts.status, 'posted'),
            gte(linkedinPosts.postedAt, since),
          ))
          .then(r => r.length),
      ),
    ));
    const limit = Math.min(quotas.reduce((s, q) => s + q, 0), config.maxCommentsPerRun);

    const knownIds = await this.db.db
      .select({ externalId: linkedinPosts.externalId })
      .from(linkedinPosts);
    const seenSet = new Set(knownIds.map(r => r.externalId));

    const nicheKeywords = niches.flatMap(n => n.keywords ?? []);
    const allTopics = [...config.targetTopics, ...nicheKeywords];

    const unseen = feedPosts.filter(p => !seenSet.has(p.id));

    const fresh = unseen
      .filter(p => !allTopics.length || allTopics.some(t => p.content?.toLowerCase().includes(t.toLowerCase())))
      .slice(0, limit);

    await this.logSvc.info(runId, 'Feed comments filter', {
      feedPosts: feedPosts.length,
      commentingAccounts: commentingAccounts.length,
      quotaLimit: limit,
      alreadySeen: feedPosts.length - unseen.length,
      unseenPosts: unseen.length,
      afterTopicFilter: fresh.length,
      topics: allTopics,
      sampleUnseenContent: unseen[0]?.content?.slice(0, 120) ?? null,
    });

    if (!fresh.length) {
      await this.logSvc.warn(runId, `Feed comments: 0 posts matched keywords. Topics: [${allTopics.join(', ')}]. Sample unseen post: "${unseen[0]?.content?.slice(0, 120) ?? 'none'}"`);
      return [];
    }

    const [alwaysOn, samples, blocklist, rejections] = await Promise.all([
      this.kb.getAlwaysOnContext(this.key),
      this.kb.getWritingSamples(this.key),
      this.kb.getBlocklistRules(this.key),
      this.kb.getRecentRejections(this.key, 3),
    ]);
    const template = await this.kb.getPromptTemplate(this.key);
    const actions: ProposedAction[] = [];

    const defaultAccount = commentingAccounts[0];

    for (const post of fresh) {
      try {
        const ctaKeyword = detectCtaKeyword(post.content ?? '');
        if (ctaKeyword) {
          await this.db.db.insert(linkedinPosts).values({
            externalId: post.id,
            accountId: defaultAccount?.id ?? null,
            authorName: post.authorName,
            content: post.content.slice(0, 2000),
            draftComment: ctaKeyword,
          }).onConflictDoNothing();
          const postSnippet = post.content.slice(0, 200).trim();
          const postUrl = post.url || '';
          actions.push({
            type: 'post_comment',
            summary: [
              `Comment on ${post.authorName}'s post [cta_keyword]:`,
              '',
              `"${postSnippet}${post.content.length > 200 ? '...' : ''}"`,
              postUrl || null,
              '',
              `Proposed comment: "${ctaKeyword}" (CTA keyword from post)`,
            ].filter(l => l !== null).join('\n'),
            payload: {
              postId: post.id,
              authorName: post.authorName,
              comment: ctaKeyword,
              postUrl,
              accountId: defaultAccount?.unipileAccountId ?? null,
              dbAccountId: defaultAccount?.id ?? null,
            },
            riskLevel: 'low',
          });
          continue;
        }

        const category = classifyPost(post.content ?? '');
        const categoryRules = CATEGORY_COMMENT_RULES[category];

        const references = await this.kb.searchEntries(post.content?.slice(0, 300) ?? '', this.key, 3);
        const kbBlock = this.kb.buildKbPromptBlock({
          voiceProfile: alwaysOn.find(e => e.entryType === 'voice_profile') ?? null,
          facts: alwaysOn.filter(e => e.entryType === 'fact'),
          catalog: alwaysOn.filter(e => e.entryType === 'product' || e.entryType === 'service' || e.entryType === 'offer'),
          references,
          positiveSamples: samples.filter(s => s.polarity === 'positive'),
          negativeSamples: samples.filter(s => s.polarity === 'negative'),
          rejections,
        });
        const defaultSystem = `You write LinkedIn comments. Tone: ${config.commentTone}.

${categoryRules}

General rules (apply to all categories):
- Use simple everyday words — write like a real person, not a marketer
- Never start with “Great post!”, “Love this!”, “So true!”, “Congratulations!” alone
- No emojis. No corporate speak
- Sound like someone who actually read the post and has a genuine take
- Do NOT wrap your reply in quotes
- Return only the comment text`;
        const response = await this.llm.complete({
          messages: [
            { role: 'system', content: (template?.system ?? defaultSystem) + kbBlock },
            { role: 'user', content: `Post type: ${category}\nPost by ${post.authorName}:\n\n${post.content.slice(0, 600)}` },
          ],
          ...agentLlmOpts(config),
          agentKey: this.key,
          maxTokens: 120,
        });

        let comment = response.content.trim().replace(/^[“'`””]+|[“'`””]+$/g, '').trim();
        if (!comment) continue;
        comment = await this.selfCritique(comment, alwaysOn.find(e => e.entryType === 'voice_profile')?.content, blocklist);

        const categoryViolation = validateCommentForCategory(comment, category);
        if (categoryViolation) {
          await this.logSvc.warn(runId, `Comment skipped (category rule): ${categoryViolation}. Post: “${post.content?.slice(0, 80)}”`);
          continue;
        }

        const violation = blocklist.find(b => comment.toLowerCase().includes(b.toLowerCase()));

        await this.db.db.insert(linkedinPosts).values({
          externalId: post.id,
          accountId: defaultAccount?.id ?? null,
          authorName: post.authorName,
          content: post.content.slice(0, 2000),
          draftComment: comment,
        }).onConflictDoNothing();

        const postSnippet = post.content.slice(0, 200).trim();
        const postUrl = post.url || '';
        const summary = [
          `Comment on ${post.authorName}'s post [${category}]:`,
          '',
          `"${postSnippet}${post.content.length > 200 ? '...' : ''}"`,
          postUrl ? postUrl : null,
          '',
          `Proposed comment: "${comment.slice(0, 120)}"`,
        ].filter(l => l !== null).join('\n');

        actions.push({
          type: 'post_comment',
          summary,
          payload: {
            postId: post.id,
            authorName: post.authorName,
            comment,
            postUrl,
            accountId: defaultAccount?.unipileAccountId ?? null,
            dbAccountId: defaultAccount?.id ?? null,
          },
          riskLevel: violation ? 'high' : 'medium',
        });
      } catch (err) {
        this.logger.warn(`Failed to draft comment: ${err}`);
      }
    }
    return actions;
  }

  // ─── Connection requests ────────────────────────────────────────────────────

  private async decideConnectionRequests(
    accounts: any[],
    niches: any[],
    config: LinkedInConfig,
    runId: string,
  ): Promise<ProposedAction[]> {
    if (!accounts.length || !niches.length) {
      await this.logSvc.warn(runId, `Connections: bailed — accounts=${accounts.length} niches=${niches.length}`);
      return [];
    }

    const [alwaysOn] = await Promise.all([this.kb.getAlwaysOnContext(this.key)]);
    const voiceProfile = alwaysOn.find(e => e.entryType === 'voice_profile')?.content ?? '';

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const actions: ProposedAction[] = [];

    for (const niche of niches) {
      const account = accounts.find(a => a.id === niche.accountId) ?? accounts[0];
      if (!account) {
        await this.logSvc.warn(runId, `Connections: niche "${niche.name}" — no matching account found`);
        continue;
      }
      if (account.enableConnections === false) {
        await this.logSvc.warn(runId, `Connections: niche "${niche.name}" — connections disabled on account "${account.label}"`);
        continue;
      }

      const sentToday = await this.db.db
        .select({ id: linkedinConnectionRequests.id })
        .from(linkedinConnectionRequests)
        .where(
          and(
            eq(linkedinConnectionRequests.nicheId, niche.id),
            gte(linkedinConnectionRequests.createdAt, todayStart),
            inArray(linkedinConnectionRequests.status, ['pending', 'sent']),
          ),
        );

      const nicheRemaining = niche.dailyConnectLimit - sentToday.length;
      if (nicheRemaining <= 0) {
        await this.logSvc.warn(runId, `Connections: niche "${niche.name}" daily limit reached (${sentToday.length}/${niche.dailyConnectLimit})`);
        continue;
      }

      const accountQuota = await this.accountQuota(
        account.id,
        account.dailyConnectionsLimit,
        5,
        (since) => this.db.db.select({ id: linkedinConnectionRequests.id }).from(linkedinConnectionRequests)
          .where(and(
            eq(linkedinConnectionRequests.accountId, account.id),
            gte(linkedinConnectionRequests.sentAt, since),
            inArray(linkedinConnectionRequests.status, ['sent', 'accepted', 'declined']),
          ))
          .then(r => r.length),
      );

      const remaining = Math.min(nicheRemaining, accountQuota);
      if (remaining <= 0) {
        await this.logSvc.warn(runId, `Connections: account "${account.label}" quota exhausted (nicheRemaining=${nicheRemaining} accountQuota=${accountQuota})`);
        continue;
      }

      const keywords = (niche.keywords ?? []).join(' ');
      if (!keywords) {
        await this.logSvc.warn(runId, `Connections: niche "${niche.name}" has NO keywords — add keywords in the Niches tab to enable people search`);
        continue;
      }

      await this.logSvc.info(runId, `Connections: searching LinkedIn for niche "${niche.name}"`, { keywords, remaining });
      const candidates = await this.liConnection.searchPeople(
        account.unipileAccountId,
        keywords,
        { jobTitles: niche.targetJobTitles ?? [], industries: niche.targetIndustries ?? [] },
      );
      await this.logSvc.info(runId, `Connections: search returned ${candidates.length} candidates`, { keywords });
      if (!candidates.length) {
        await this.logSvc.warn(runId, `Connections: Unipile search returned 0 results for keywords "${keywords}" — check Unipile LinkedIn search API`);
        continue;
      }

      const existingProfileIds = await this.db.db
        .select({ profileId: linkedinConnectionRequests.profileId })
        .from(linkedinConnectionRequests)
        .where(eq(linkedinConnectionRequests.accountId, account.id));
      const contacted = new Set(existingProfileIds.map(r => r.profileId));

      const accountBlocked = (account.blockedCountries as string[] | null) ?? [];
      const blockedLower = [...(config.blockedCountries ?? []), ...accountBlocked]
        .map(c => c.toLowerCase())
        .filter((v, i, a) => a.indexOf(v) === i);
      const fresh = candidates
        .filter(c => c.id && !contacted.has(c.id))
        .filter(c => {
          if (!blockedLower.length || !c.location) return true;
          const loc = c.location.toLowerCase();
          return !blockedLower.some(bc => loc.includes(bc));
        })
        .slice(0, remaining);
      if (!fresh.length) {
        await this.logSvc.warn(runId, `Connections: 0 fresh candidates for niche "${niche.name}" after dedup + country filter (blockedCountries: [${blockedLower.join(', ')}])`);
        continue;
      }
      await this.logSvc.info(runId, `Connections: ${fresh.length} fresh candidates for niche "${niche.name}"`, { blockedCountries: blockedLower })

      const icpPrompt = `You are scoring LinkedIn profiles against an Ideal Customer Profile (ICP).

ICP Description: ${niche.icpDescription ?? niche.description ?? ''}

Score each profile 0.0–1.0 (1.0 = perfect match). Return JSON array only:
[{"id":"<profile_id>","score":0.0,"reason":"one sentence"}]`;

      const profileList = fresh.map(p => `id:${p.id} | ${p.first_name} ${p.last_name} | ${p.headline}`).join('\n');

      let scored: Array<{ id: string; score: number; reason: string }> = [];
      try {
        const res = await this.llm.complete({
          messages: [
            { role: 'system', content: icpPrompt },
            { role: 'user', content: profileList },
          ],
          agentKey: this.key,
          maxTokens: 800,
        });
        // Strip markdown code fences the LLM sometimes wraps around JSON
        const raw = res.content.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
        try {
          scored = JSON.parse(raw);
        } catch (parseErr) {
          await this.logSvc.warn(runId, `Connections: batch ICP JSON parse failed — falling back to individual scoring. Raw: ${raw.slice(0, 300)}`);
          // Score each profile individually to avoid batch parse failures
          scored = await Promise.all(fresh.map(async p => {
            try {
              const r = await this.llm.complete({
                messages: [
                  { role: 'system', content: `Score this LinkedIn profile 0.0–1.0 against the ICP. ICP: ${niche.icpDescription ?? niche.description ?? ''}. Return JSON only: {"score":0.0,"reason":"one sentence"}` },
                  { role: 'user', content: `${p.first_name} ${p.last_name} | ${p.headline}` },
                ],
                agentKey: this.key,
                maxTokens: 80,
              });
              const parsed = JSON.parse(r.content.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim());
              return { id: p.id, score: Number(parsed.score) || 0.5, reason: parsed.reason ?? '' };
            } catch {
              return { id: p.id, score: 0.5, reason: 'parse error' };
            }
          }));
        }
      } catch (err) {
        await this.logSvc.warn(runId, `Connections: ICP scoring LLM call failed — ${(err as Error).message}`);
        scored = fresh.map(p => ({ id: p.id, score: 0.5, reason: 'llm error' }));
      }

      const aboveThreshold = scored.filter(s => s.score >= config.icpScoreThreshold);
      await this.logSvc.info(runId, `Connections: ICP scored ${scored.length} profiles`, {
        threshold: config.icpScoreThreshold,
        aboveThreshold: aboveThreshold.length,
        scores: scored.map(s => ({ id: s.id, score: s.score, reason: s.reason })),
      });
      if (!aboveThreshold.length) {
        await this.logSvc.warn(runId, `Connections: 0 profiles passed ICP threshold ${config.icpScoreThreshold} for niche "${niche.name}". Lower icpScoreThreshold in Config tab or improve niche ICP description.`);
      }

      for (const score of scored) {
        if (score.score < config.icpScoreThreshold) continue;
        const profile = fresh.find(p => p.id === score.id);
        if (!profile) continue;

        const noteRes = await this.llm.complete({
          messages: [
            {
              role: 'system',
              content: `Write a LinkedIn connection request note. Max 190 characters.
Rules:
- Use the person's actual first name — never write [Name] or any placeholder
- Sound like a real person, not a sales pitch
- Mention something specific about their role or what they do
- Simple, plain words — no jargon, no "synergy", no "reaching out"
- Voice: ${voiceProfile || 'direct and genuine'}
- Do NOT wrap your reply in quotes
- Return only the note text`,
            },
            {
              role: 'user',
              content: `First name: ${profile.first_name}\nFull name: ${profile.first_name} ${profile.last_name}\nHeadline: ${profile.headline}\nNiche: ${niche.name}`,
            },
          ],
          agentKey: this.key,
          maxTokens: 80,
        });
        const note = noteRes.content.trim()
          .replace(/^["'`""]+|["'`""]+$/g, '')
          .replace(/\[name\]/gi, profile.first_name)
          .trim().slice(0, 190);

        const [req] = await this.db.db.insert(linkedinConnectionRequests).values({
          accountId: account.id,
          nicheId: niche.id,
          profileId: profile.id,
          profileName: `${profile.first_name} ${profile.last_name}`,
          profileHeadline: profile.headline,
          profileUrl: profile.profile_url,
          icpScore: score.score,
          icpReason: score.reason,
          noteSent: note,
          status: 'pending',
        }).returning();

        await this.db.db.insert(linkedinLeads).values({
          accountId: account.id,
          nicheId: niche.id,
          profileId: profile.id,
          profileUrl: profile.profile_url,
          name: `${profile.first_name} ${profile.last_name}`,
          headline: profile.headline,
          icpScore: score.score,
          icpReason: score.reason,
          connectionStatus: 'none',
        }).onConflictDoNothing();

        actions.push({
          type: 'send_connection_request',
          summary: [
            `Connect with ${profile.first_name} ${profile.last_name}`,
            profile.profile_url ?? null,
            profile.headline ? `Role: ${profile.headline}` : null,
            `Niche: ${niche.name} | ICP score: ${score.score.toFixed(2)}`,
            `Note: "${note.slice(0, 100)}"`,
          ].filter(Boolean).join('\n'),
          payload: {
            requestId: req.id,
            accountId: account.unipileAccountId,
            profileId: profile.id,
            profileName: `${profile.first_name} ${profile.last_name}`,
            profileHeadline: profile.headline,
            nicheName: niche.name,
            icpScore: score.score,
            icpReason: score.reason,
            note,
          },
          riskLevel: 'medium',
        });
      }
    }

    return actions.slice(0, config.maxConnectionRequestsPerRun ?? 3);
  }

  // ─── DM outreach ───────────────────────────────────────────────────────────

  private async decideDMs(accounts: any[], config: LinkedInConfig, runId: string): Promise<ProposedAction[]> {
    if (!accounts.length) {
      await this.logSvc.warn(runId, 'DMs: no accounts found');
      return [];
    }

    const dmAccounts = accounts.filter(a => a.isActive && a.enableDMs !== false);
    if (!dmAccounts.length) {
      await this.logSvc.warn(runId, `DMs: no accounts with DMs enabled (total accounts: ${accounts.length})`);
      return [];
    }

    const dmQuotas = await Promise.all(dmAccounts.map(a =>
      this.accountQuota(a.id, a.dailyDmsLimit, 5, (since) =>
        this.db.db.select({ id: linkedinLeads.id }).from(linkedinLeads)
          .where(and(eq(linkedinLeads.accountId, a.id), gte(linkedinLeads.lastContactedAt, since)))
          .then(r => r.length),
      ),
    ));
    const dmLimit = Math.min(dmQuotas.reduce((s, q) => s + q, 0), config.maxDMsPerRun);
    if (dmLimit <= 0) {
      await this.logSvc.warn(runId, `DMs: daily quota exhausted (quotas: [${dmQuotas.join(', ')}] maxPerRun: ${config.maxDMsPerRun})`);
      return [];
    }

    const [alwaysOn, samples, blocklist, rejections] = await Promise.all([
      this.kb.getAlwaysOnContext(this.key),
      this.kb.getWritingSamples(this.key),
      this.kb.getBlocklistRules(this.key),
      this.kb.getRecentRejections(this.key, 3),
    ]);

    const kbBlock = this.kb.buildKbPromptBlock({
      voiceProfile: alwaysOn.find(e => e.entryType === 'voice_profile') ?? null,
      facts: alwaysOn.filter(e => e.entryType === 'fact'),
      catalog: alwaysOn.filter(e => e.entryType === 'product' || e.entryType === 'service' || e.entryType === 'offer'),
      references: [],
      positiveSamples: samples.filter(s => s.polarity === 'positive'),
      negativeSamples: samples.filter(s => s.polarity === 'negative'),
      rejections,
    });

    const actions: ProposedAction[] = [];

    for (const account of dmAccounts) {
      if (actions.length >= dmLimit) break;

      // Load active sequence for this account
      // Falls back to null if migration 0082 (linkedin_dm_sequences table) not yet applied
      let sequence: any = null;
      try {
        const [row] = await this.db.db
          .select()
          .from(linkedinDmSequences)
          .where(and(eq(linkedinDmSequences.accountId, account.id), eq(linkedinDmSequences.isActive, true)))
          .limit(1);
        sequence = row ?? null;
      } catch (tableErr: any) {
        if (String(tableErr?.message).includes('linkedin_dm_sequences')) {
          await this.logSvc.warn(runId, `DMs: migration 0082 not applied — linkedin_dm_sequences table missing. Call POST /linkedin/apply-migration-0082 to apply it, then create a sequence in the DM Sequences tab.`);
        } else {
          throw tableErr;
        }
      }

      const steps: Array<{ stepNumber: number; delayDays: number; instruction: string }> =
        (sequence?.steps as any[] ?? []).sort((a, b) => a.stepNumber - b.stepNumber);

      if (!steps.length) {
        await this.logSvc.warn(runId, `DMs: account ${account.label} has no active sequence — skipping. Create one in the DM Sequences tab.`);
        continue;
      }

      const now = new Date();

      // Step 1 candidates: connected leads not yet contacted
      // NOTE: falls back to status-only query if migration 0082 (dm_step column) not yet applied
      let freshLeads: any[] = [];
      try {
        freshLeads = await this.db.db
          .select()
          .from(linkedinLeads)
          .where(
            and(
              eq(linkedinLeads.accountId, account.id),
              eq(linkedinLeads.connectionStatus, 'connected'),
              eq(linkedinLeads.dmStep, 0),
              eq(linkedinLeads.status, 'new'),
            ),
          )
          .limit(dmLimit - actions.length);
      } catch (colErr: any) {
        if (String(colErr?.message).includes('dm_step') || String(colErr?.message).includes('dm_sequence_id')) {
          await this.logSvc.warn(runId, 'DMs: migration 0082 not yet applied (dm_step column missing). Restart the API server to run migrations, then DM sequences will work. Falling back to status-based lead query.');
          freshLeads = await this.db.db
            .select()
            .from(linkedinLeads)
            .where(
              and(
                eq(linkedinLeads.accountId, account.id),
                eq(linkedinLeads.connectionStatus, 'connected'),
                eq(linkedinLeads.status, 'new'),
              ),
            )
            .limit(dmLimit - actions.length);
        } else {
          throw colErr;
        }
      }

      // Follow-up candidates: leads mid-sequence whose delay has elapsed
      let allLeadsInSequence: any[] = [];
      try {
        allLeadsInSequence = await this.db.db
          .select()
          .from(linkedinLeads)
          .where(
            and(
              eq(linkedinLeads.accountId, account.id),
              eq(linkedinLeads.connectionStatus, 'connected'),
              eq(linkedinLeads.dmSequenceId, sequence.id),
            ),
          );
      } catch {
        // dm_sequence_id column not yet available — skip follow-up step
        allLeadsInSequence = [];
      }

      const followupLeads = allLeadsInSequence.filter(lead => {
        if (!lead.dmStep || lead.dmStep === 0 || lead.dmStep >= steps.length) return false;
        const nextStep = steps[lead.dmStep]; // 0-indexed; dmStep=1 means step 1 sent, next is steps[1]
        if (!nextStep) return false;
        const delayMs = nextStep.delayDays * 24 * 60 * 60 * 1000;
        return lead.lastContactedAt && (now.getTime() - lead.lastContactedAt.getTime()) >= delayMs;
      }).slice(0, dmLimit - actions.length - freshLeads.length);

      await this.logSvc.info(runId, `DMs: account ${account.label}`, {
        sequenceName: sequence.name,
        totalSteps: steps.length,
        freshLeads: freshLeads.length,
        followupLeads: followupLeads.length,
      });

      const candidatePairs: Array<{ lead: typeof freshLeads[0]; step: typeof steps[0] }> = [
        ...freshLeads.map(lead => ({ lead, step: steps[0] })),
        ...followupLeads.map(lead => ({ lead, step: steps[lead.dmStep] })),
      ];

      for (const { lead, step } of candidatePairs) {
        if (actions.length >= dmLimit) break;
        try {
          let message: string;

          if (step.stepNumber === 1) {
            // Fresh lead first DM — use template system
            const nameParts = (lead.name ?? '').split(' ');
            message = await this.liTemplate.selectAndRender({
              firstName: nameParts[0] || 'there',
              lastName: nameParts.slice(1).join(' ') || undefined,
              headline: lead.headline ?? undefined,
              stage: 'dm1',
              extraContext: lead.icpReason ?? undefined,
            });
          } else {
            // Follow-up DM — use sequence step instruction via LLM
            const response = await this.llm.complete({
              messages: [
                {
                  role: 'system',
                  content: `You are writing a LinkedIn DM on behalf of a founder.

Sequence goal: ${sequence.goal ?? 'Build a genuine connection'}
This message is step ${step.stepNumber} of ${steps.length} in a conversation sequence.

Your task for this step:
${step.instruction}

Rules:
- 2-3 short sentences max
- Write like a real person — conversational, no corporate speak
- Do NOT mention you are following a sequence
- Do NOT wrap your reply in quotes
- Return only the message text${kbBlock}`,
                },
                {
                  role: 'user',
                  content: `Name: ${lead.name ?? 'there'}\nHeadline: ${lead.headline ?? ''}\nICP reason: ${lead.icpReason ?? ''}`,
                },
              ],
              agentKey: this.key,
              maxTokens: 180,
            });
            message = response.content.trim().replace(/^["'`""]+|["'`""]+$/g, '').trim();
          }

          if (!message) continue;
          message = await this.selfCritique(message, alwaysOn.find(e => e.entryType === 'voice_profile')?.content, blocklist);
          const violation = blocklist.find(b => message.toLowerCase().includes(b.toLowerCase()));

          const profileLink = lead.profileUrl ?? (lead.profileId ? `https://www.linkedin.com/in/${lead.profileId}` : null);
          const summaryLines = [
            `DM to ${lead.name ?? 'unknown'} — Step ${step.stepNumber}/${steps.length} (${sequence.name})`,
            profileLink ?? null,
            lead.headline ? `Role: ${lead.headline}` : null,
            `Message: "${message.slice(0, 120)}"`,
          ].filter(Boolean).join('\n');

          actions.push({
            type: 'send_dm',
            summary: summaryLines,
            payload: {
              leadId: lead.id,
              profileId: lead.profileId ?? lead.profileUrl,
              accountId: account.unipileAccountId,
              name: lead.name,
              message,
              nextDmStep: step.stepNumber,
              sequenceId: sequence.id,
              totalSteps: steps.length,
            },
            riskLevel: violation ? 'high' : 'medium',
          });
        } catch (err) {
          this.logger.warn(`Failed to draft DM for lead ${lead.id}: ${err}`);
        }
      }
    }

    return actions;
  }

  // ─── Task mode ─────────────────────────────────────────────────────────────

  private async decideTaskMode(config: LinkedInConfig, instructions: string, followupNote?: string): Promise<ProposedAction[]> {
    const [alwaysOn, samples, blocklist, rejections] = await Promise.all([
      this.kb.getAlwaysOnContext(this.key),
      this.kb.getWritingSamples(this.key),
      this.kb.getBlocklistRules(this.key),
      this.kb.getRecentRejections(this.key, 3),
    ]);
    const template = await this.kb.getPromptTemplate(this.key);
    const kbBlock = this.kb.buildKbPromptBlock({
      voiceProfile: alwaysOn.find(e => e.entryType === 'voice_profile') ?? null,
      facts: alwaysOn.filter(e => e.entryType === 'fact'),
      catalog: alwaysOn.filter(e => e.entryType === 'product' || e.entryType === 'service' || e.entryType === 'offer'),
      references: [],
      positiveSamples: samples.filter(s => s.polarity === 'positive'),
      negativeSamples: samples.filter(s => s.polarity === 'negative'),
      rejections,
    });
    const effectiveInstructions = followupNote ? `${instructions}\n\nAdditional note: ${followupNote}` : instructions;
    const defaultSystem = `You are writing a LinkedIn post for a SaaS founder. Write engaging, authentic content. No hashtag spam. No corporate jargon. 150-300 words. Return just the post text.`;
    const response = await this.llm.complete({
      messages: [
        { role: 'system', content: (template?.system ?? defaultSystem) + kbBlock },
        { role: 'user', content: effectiveInstructions },
      ],
      ...agentLlmOpts(config),
      agentKey: this.key,
      maxTokens: 600,
    });
    let draft = response.content.trim();
    if (!draft) return [{ type: 'noop', summary: 'No draft generated.', payload: {}, riskLevel: 'low' }];
    draft = await this.selfCritique(draft, alwaysOn.find(e => e.entryType === 'voice_profile')?.content, blocklist);
    const violation = blocklist.find(p => draft.toLowerCase().includes(p.toLowerCase()));
    return [{
      type: 'publish_post',
      summary: `LinkedIn post draft: "${draft.slice(0, 80)}"`,
      payload: { draft },
      riskLevel: violation ? 'high' : 'medium',
    }];
  }

  // ─── MCP tools ─────────────────────────────────────────────────────────────

  mcpTools(): McpToolDefinition[] {
    return [
      {
        name: 'get_feed',
        description: 'Fetch recent LinkedIn feed posts',
        inputSchema: { type: 'object', properties: { limit: { type: 'number' }, accountId: { type: 'string' } } },
        handler: async (input) => this.li.getFeedPosts((input as any).limit ?? 10, (input as any).accountId),
      },
      {
        name: 'get_lead_profile',
        description: 'Get a lead by profile URL',
        inputSchema: { type: 'object', properties: { profileUrl: { type: 'string' } }, required: ['profileUrl'] },
        handler: async (input) => {
          const [lead] = await this.db.db
            .select()
            .from(linkedinLeads)
            .where(eq(linkedinLeads.profileUrl, (input as any).profileUrl));
          return lead ?? null;
        },
      },
      {
        name: 'search_people',
        description: 'Search LinkedIn for people matching keywords',
        inputSchema: {
          type: 'object',
          properties: {
            accountId: { type: 'string' },
            keywords: { type: 'string' },
            jobTitles: { type: 'array', items: { type: 'string' } },
          },
          required: ['accountId', 'keywords'],
        },
        handler: async (input) => {
          const i = input as any;
          return this.li.searchPeople(i.accountId, i.keywords, { jobTitles: i.jobTitles });
        },
      },
      {
        name: 'draft_dm',
        description: 'LLM-draft a direct message for a LinkedIn lead',
        inputSchema: {
          type: 'object',
          properties: { name: { type: 'string' }, headline: { type: 'string' }, context: { type: 'string' } },
          required: ['name'],
        },
        handler: async (input) => {
          const { name, headline = '', context = '' } = input as any;
          const response = await this.llm.complete({
            messages: [
              { role: 'system', content: 'Write a brief, genuine LinkedIn DM intro. 2-3 sentences. No templates. No sales pitches.' },
              { role: 'user', content: `Name: ${name}\nHeadline: ${headline}\nContext: ${context}` },
            ],
            agentKey: this.key,
            maxTokens: 120,
          });
          return { draft: response.content.trim() };
        },
      },
    ];
  }

  // ─── API routes ────────────────────────────────────────────────────────────

  apiRoutes(): AgentApiRoute[] {
    return [
      {
        method: 'GET',
        path: '/linkedin/accounts',
        requiresAuth: true,
        handler: async () => this.db.db.select().from(linkedinAccounts).orderBy(linkedinAccounts.createdAt),
      },
      {
        method: 'POST',
        path: '/linkedin/accounts/sync',
        requiresAuth: true,
        handler: async () => {
          const unipileAccounts = await this.li.getUnipileAccounts();
          for (const ua of unipileAccounts) {
            await this.db.db.insert(linkedinAccounts).values({
              unipileAccountId: ua.id,
              label: ua.name ?? ua.id,
            }).onConflictDoNothing();
          }
          return { synced: unipileAccounts.length };
        },
      },
      {
        method: 'PATCH',
        path: '/linkedin/accounts/:id',
        requiresAuth: true,
        handler: async (params) => {
          const { id, ...body } = params as any;
          await this.db.db.update(linkedinAccounts).set(body).where(eq(linkedinAccounts.id, id));
          return { ok: true };
        },
      },
      {
        // Import existing LinkedIn connections as leads so DMs can be sent to them.
        // Upserts on profileUrl — sets connectionStatus=connected for newly-imported leads.
        method: 'POST',
        path: '/linkedin/connections/import',
        requiresAuth: true,
        handler: async (body) => {
          const targetAccountId = (body as any).unipileAccountId as string | undefined;
          const accounts = targetAccountId
            ? await this.db.db.select().from(linkedinAccounts).where(eq(linkedinAccounts.unipileAccountId, targetAccountId))
            : await this.db.db.select().from(linkedinAccounts).where(eq(linkedinAccounts.isActive, true));

          let imported = 0;
          for (const account of accounts) {
            const connections = await this.liConnection.getConnections(account.unipileAccountId, 200);
            for (const conn of connections) {
              if (!conn.profile_url) continue;
              await this.db.db.insert(linkedinLeads).values({
                accountId: account.id,
                profileId: conn.id || null,
                profileUrl: conn.profile_url,
                name: `${conn.first_name} ${conn.last_name}`.trim() || null,
                headline: conn.headline || null,
                connectionStatus: 'connected',
                status: 'new',
              }).onConflictDoUpdate({
                target: linkedinLeads.profileUrl,
                set: { connectionStatus: 'connected', accountId: account.id },
              });
              imported++;
            }
          }
          return { imported, accounts: accounts.length };
        },
      },
      {
        method: 'GET',
        path: '/linkedin/niches',
        requiresAuth: true,
        handler: async () => this.db.db.select().from(linkedinNiches).orderBy(linkedinNiches.createdAt),
      },
      {
        method: 'POST',
        path: '/linkedin/niches',
        requiresAuth: true,
        handler: async (body) => {
          const b = body as any;
          const [row] = await this.db.db.insert(linkedinNiches).values({
            accountId: b.accountId,
            name: b.name,
            description: b.description ?? null,
            targetJobTitles: b.targetJobTitles ?? [],
            targetIndustries: b.targetIndustries ?? [],
            keywords: b.keywords ?? [],
            icpDescription: b.icpDescription ?? null,
            dailyConnectLimit: b.dailyConnectLimit ?? 5,
            isActive: b.isActive ?? true,
          }).returning();
          return row;
        },
      },
      {
        method: 'PATCH',
        path: '/linkedin/niches/:id',
        requiresAuth: true,
        handler: async (params) => {
          const { id, ...body } = params as any;
          await this.db.db.update(linkedinNiches).set(body).where(eq(linkedinNiches.id, id));
          return { ok: true };
        },
      },
      {
        method: 'DELETE',
        path: '/linkedin/niches/:id',
        requiresAuth: true,
        handler: async (params) => {
          await this.db.db.delete(linkedinNiches).where(eq(linkedinNiches.id, (params as any).id));
          return { ok: true };
        },
      },
      {
        method: 'GET',
        path: '/linkedin/leads',
        requiresAuth: true,
        handler: async () => this.db.db.select().from(linkedinLeads).orderBy(linkedinLeads.createdAt),
      },
      {
        method: 'POST',
        path: '/linkedin/leads',
        requiresAuth: true,
        handler: async (body) => {
          const b = body as any;
          const [row] = await this.db.db.insert(linkedinLeads).values({
            accountId: b.accountId ?? null,
            profileUrl: b.profileUrl,
            name: b.name ?? null,
            headline: b.headline ?? null,
            notes: b.notes ?? null,
          }).onConflictDoNothing().returning();
          return row;
        },
      },
      {
        method: 'GET',
        path: '/linkedin/connection-requests',
        requiresAuth: true,
        handler: async () =>
          this.db.db.select().from(linkedinConnectionRequests)
            .orderBy(sql`${linkedinConnectionRequests.createdAt} DESC`).limit(200),
      },
      {
        method: 'GET',
        path: '/linkedin/posts',
        requiresAuth: true,
        handler: async () =>
          this.db.db.select().from(linkedinPosts)
            .orderBy(sql`${linkedinPosts.createdAt} DESC`).limit(100),
      },
      {
        method: 'POST',
        path: '/linkedin/posts/:id/approve',
        requiresAuth: true,
        handler: async (params) => {
          const { id } = params as any;
          const [post] = await this.db.db.select().from(linkedinPosts).where(eq(linkedinPosts.id, id));
          if (!post) return { error: 'Comment not found' };
          if (post.status === 'posted') return { error: 'Already posted' };
          if (!post.draftComment) return { error: 'No draft comment to post' };

          const account = post.accountId
            ? (await this.db.db.select().from(linkedinAccounts).where(eq(linkedinAccounts.id, post.accountId)))[0]
            : (await this.db.db.select().from(linkedinAccounts).where(eq(linkedinAccounts.isActive, true)).limit(1))[0];

          await this.liComment.postComment(post.externalId, post.draftComment, account?.unipileAccountId);
          await this.db.db.update(linkedinPosts)
            .set({ status: 'posted', postedAt: new Date() })
            .where(eq(linkedinPosts.id, id));
          return { ok: true, posted: post.draftComment };
        },
      },
      {
        method: 'POST',
        path: '/linkedin/posts/:id/reject',
        requiresAuth: true,
        handler: async (params) => {
          const { id } = params as any;
          await this.db.db.update(linkedinPosts)
            .set({ status: 'skipped' })
            .where(eq(linkedinPosts.id, id));
          return { ok: true };
        },
      },
      {
        // Save manually-pasted LinkedIn posts/comments as persona writing samples.
        // body.texts: string[] — each element is one post/comment block.
        method: 'POST',
        path: '/linkedin/persona/train-manual',
        requiresAuth: true,
        handler: async (body) => {
          const texts: string[] = ((body as any).texts ?? []).filter((t: string) => t?.trim()?.length > 20);
          if (!texts.length) return { saved: 0 };

          await this.db.db.delete(writingSamples).where(
            and(
              eq(writingSamples.agentKeys, this.key),
              eq(writingSamples.context, 'LinkedIn persona — own post'),
            ),
          );

          for (const text of texts) {
            await this.db.db.insert(writingSamples).values({
              context: 'LinkedIn persona — own post',
              sampleText: text.slice(0, 2000),
              polarity: 'positive',
              agentKeys: this.key,
            });
          }
          return { saved: texts.length };
        },
      },
      {
        method: 'GET',
        path: '/linkedin/debug/persona',
        requiresAuth: true,
        handler: async (params) => {
          const accountId = (params as any).accountId as string | undefined;
          const id = accountId ?? (await this.db.db.select().from(linkedinAccounts).limit(1))[0]?.unipileAccountId;
          if (!id) return { error: 'No account found' };
          return this.li.debugPersonaFetch(id);
        },
      },
      {
        method: 'GET',
        path: '/linkedin/debug/posts',
        requiresAuth: true,
        handler: async (params) => {
          const accountId = (params as any).accountId as string | undefined;
          const { unipileKey, unipileDsn } = await this.li.getCredentials();
          if (!unipileKey || !unipileDsn) return { error: 'Unipile not configured' };
          const id = accountId ?? (await this.db.db.select().from(linkedinAccounts).limit(1))[0]?.unipileAccountId;
          if (!id) return { error: 'No account found' };
          const res = await fetch(`https://${unipileDsn}/api/v1/posts?account_id=${encodeURIComponent(id)}&limit=5`, {
            headers: { 'X-API-KEY': unipileKey, 'Content-Type': 'application/json' },
          });
          const raw = await res.text();
          let parsed: any = null;
          try { parsed = JSON.parse(raw); } catch { /* ignore */ }
          return { status: res.status, accountId: id, raw: raw.slice(0, 2000), parsed };
        },
      },
      {
        method: 'GET',
        path: '/linkedin/reports/daily',
        requiresAuth: true,
        handler: async () => {
          const since = new Date();
          since.setDate(since.getDate() - 13);
          since.setHours(0, 0, 0, 0);

          const [accounts, connections, comments, dms] = await Promise.all([
            this.db.db.select().from(linkedinAccounts),
            // Count only actually-sent requests (sentAt set by execute)
            this.db.db.select({ accountId: linkedinConnectionRequests.accountId, sentAt: linkedinConnectionRequests.sentAt })
              .from(linkedinConnectionRequests)
              .where(and(
                gte(linkedinConnectionRequests.sentAt, since),
                inArray(linkedinConnectionRequests.status, ['sent', 'accepted', 'declined']),
              )),
            // Count only actually-posted comments (postedAt set by execute, status = posted)
            this.db.db.select({ accountId: linkedinPosts.accountId, postedAt: linkedinPosts.postedAt })
              .from(linkedinPosts)
              .where(and(
                gte(linkedinPosts.postedAt, since),
                eq(linkedinPosts.status, 'posted'),
              )),
            // Count leads where DM was actually sent
            this.db.db.select({ accountId: linkedinLeads.accountId, lastContactedAt: linkedinLeads.lastContactedAt })
              .from(linkedinLeads)
              .where(and(
                gte(linkedinLeads.lastContactedAt, since),
                inArray(linkedinLeads.status, ['dm_sent', 'replied', 'converted']),
              )),
          ]);

          const dateKey = (d: Date) => d.toISOString().slice(0, 10);
          const map: Record<string, Record<string, { connections: number; comments: number; dms: number }>> = {};
          const entry = (aId: string, date: string) => {
            if (!map[aId]) map[aId] = {};
            if (!map[aId][date]) map[aId][date] = { connections: 0, comments: 0, dms: 0 };
            return map[aId][date];
          };

          for (const r of connections) { if (r.accountId && r.sentAt) entry(r.accountId, dateKey(r.sentAt)).connections++; }
          for (const r of comments)    { if (r.accountId && r.postedAt) entry(r.accountId, dateKey(r.postedAt)).comments++; }
          for (const r of dms)         { if (r.accountId && r.lastContactedAt) entry(r.accountId, dateKey(r.lastContactedAt)).dms++; }

          const accountMap = Object.fromEntries(accounts.map(a => [a.id, a.label]));
          const rows: any[] = [];
          for (const [accountId, dates] of Object.entries(map)) {
            for (const [date, counts] of Object.entries(dates)) {
              rows.push({ accountId, accountLabel: accountMap[accountId] ?? accountId, date, ...counts });
            }
          }
          return rows.sort((a, b) => b.date.localeCompare(a.date) || a.accountLabel.localeCompare(b.accountLabel));
        },
      },
      {
        method: 'POST',
        path: '/linkedin/draft-outreach',
        requiresAuth: true,
        handler: async (body) => {
          const { name, headline, context } = body as any;
          const response = await this.llm.complete({
            messages: [
              { role: 'system', content: 'Write a brief, genuine LinkedIn DM. 2-3 sentences.' },
              { role: 'user', content: `Name: ${name}\nHeadline: ${headline ?? ''}\nContext: ${context ?? ''}` },
            ],
            agentKey: this.key,
            maxTokens: 120,
          });
          return { draft: response.content.trim() };
        },
      },
      {
        // Train AI persona from a specific LinkedIn account's own posts.
        // unipileAccountId: the Unipile account ID (from the accounts list).
        // Deletes old persona samples for this agent then re-inserts fresh ones.
        method: 'POST',
        path: '/linkedin/persona/train',
        requiresAuth: true,
        handler: async (body) => {
          const unipileAccountId = (body as any).unipileAccountId as string | undefined;
          const account = unipileAccountId
            ? (await this.db.db.select().from(linkedinAccounts).where(eq(linkedinAccounts.unipileAccountId, unipileAccountId)).limit(1))[0]
            : (await this.db.db.select().from(linkedinAccounts).where(eq(linkedinAccounts.isActive, true)).limit(1))[0];

          if (!account?.unipileAccountId) return { error: 'No active LinkedIn account found' };

          const posts = await this.li.fetchOwnPosts(account.unipileAccountId);
          if (!posts.length) return { saved: 0, total: 0, note: 'No recent posts found on your profile — check Voyager proxy access' };

          // Replace old samples for this agent to avoid accumulating stale duplicates
          await this.db.db.delete(writingSamples).where(
            and(
              eq(writingSamples.agentKeys, this.key),
              eq(writingSamples.context, 'LinkedIn persona — own post'),
            ),
          );

          let saved = 0;
          for (const post of posts) {
            if (!post.trim() || post.length < 30) continue;
            await this.db.db.insert(writingSamples).values({
              context: 'LinkedIn persona — own post',
              sampleText: post.slice(0, 2000),
              polarity: 'positive',
              agentKeys: this.key,
            });
            saved++;
          }
          return { saved, total: posts.length, account: account.label };
        },
      },
      {
        method: 'GET',
        path: '/linkedin/persona/samples',
        requiresAuth: true,
        handler: async () => {
          const samples = await this.db.db
            .select()
            .from(writingSamples)
            .where(eq(writingSamples.agentKeys, this.key))
            .orderBy(sql`${writingSamples.createdAt} DESC`)
            .limit(50);
          return samples;
        },
      },

      // ─── Migration helper ────────────────────────────────────────────────────
      {
        method: 'POST',
        path: '/linkedin/apply-migration-0082',
        requiresAuth: true,
        handler: async () => {
          try {
            await this.db.db.execute(sql`
              CREATE TABLE IF NOT EXISTS linkedin_dm_sequences (
                id text PRIMARY KEY,
                account_id text NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
                name text NOT NULL,
                goal text,
                steps jsonb NOT NULL DEFAULT '[]',
                is_active boolean NOT NULL DEFAULT true,
                created_at timestamp NOT NULL DEFAULT NOW()
              )
            `);
            await this.db.db.execute(sql`
              ALTER TABLE linkedin_leads ADD COLUMN IF NOT EXISTS dm_step integer NOT NULL DEFAULT 0
            `);
            await this.db.db.execute(sql`
              ALTER TABLE linkedin_leads ADD COLUMN IF NOT EXISTS dm_sequence_id text REFERENCES linkedin_dm_sequences(id)
            `);
            return { ok: true, message: 'Migration 0082 applied successfully' };
          } catch (err) {
            return { ok: false, error: (err as Error).message };
          }
        },
      },

      // ─── DM Sequences ───────────────────────────────────────────────────────
      {
        method: 'GET',
        path: '/linkedin/dm-sequences',
        requiresAuth: true,
        handler: async () =>
          this.db.db.select().from(linkedinDmSequences).orderBy(linkedinDmSequences.createdAt),
      },
      {
        method: 'POST',
        path: '/linkedin/dm-sequences',
        requiresAuth: true,
        handler: async (body) => {
          const b = body as any;
          const [row] = await this.db.db.insert(linkedinDmSequences).values({
            accountId: b.accountId,
            name: b.name,
            goal: b.goal ?? null,
            steps: b.steps ?? [],
          }).returning();
          return row;
        },
      },
      {
        method: 'PATCH',
        path: '/linkedin/dm-sequences/:id',
        requiresAuth: true,
        handler: async (params) => {
          const { id, ...body } = params as any;
          await this.db.db.update(linkedinDmSequences).set(body).where(eq(linkedinDmSequences.id, id));
          return { ok: true };
        },
      },
      {
        method: 'DELETE',
        path: '/linkedin/dm-sequences/:id',
        requiresAuth: true,
        handler: async (params) => {
          await this.db.db.delete(linkedinDmSequences).where(eq(linkedinDmSequences.id, (params as any).id));
          return { ok: true };
        },
      },
    ];
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async selfCritique(draft: string, voiceProfile?: string, blocklist?: string[]): Promise<string> {
    try {
      const critique = await this.llm.complete({
        messages: [
          {
            role: 'system',
            content: `You are a strict editor. Review this LinkedIn content draft.
Voice: ${voiceProfile ?? 'professional, concise, adds value'}
Avoid: ${blocklist?.join(', ') || 'none specified'}
If the draft is good, return: {"ok":true}
If not, rewrite and return: {"ok":false,"revised":"improved text here"}`,
          },
          { role: 'user', content: `Draft: "${draft}"` },
        ],
        agentKey: this.key,
        maxTokens: 200,
      });
      const result = JSON.parse(critique.content);
      if (!result.ok && result.revised) return result.revised.trim();
    } catch {
      // fail-open
    }
    return draft;
  }

  private async getConfig(): Promise<LinkedInConfig> {
    const [row] = await this.db.db.select().from(agents).where(eq(agents.key, this.key));
    return { ...DEFAULT_CONFIG, ...(row?.config as Partial<LinkedInConfig> ?? {}) };
  }
}
