import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { agents } from '../../../db/schema';
import { redditThreads, redditKeywords } from './schema';
import { RedditService } from './reddit.service';
import { AgentRegistryService } from '../runtime/agent-registry.service';
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

interface RedditConfig {
  defaultKeywords: string[];
  maxPostsPerKeyword: number;
  commentTone: string;
  llm: { provider: string; model: string };
}

interface RedditSnapshot {
  newPosts: any[];
  config: RedditConfig;
}

const DEFAULT_CONFIG: RedditConfig = {
  defaultKeywords: ['Taskip', 'project management tool', 'task management SaaS'],
  maxPostsPerKeyword: 5,
  commentTone: 'helpful and genuine — add value, no promotion, no spam',
  llm: { provider: 'auto', model: 'gpt-4o-mini' },
};

@Injectable()
export class RedditAgent implements IAgent, OnModuleInit {
  readonly key = 'reddit';
  readonly name = 'Reddit Followup Agent';
  private readonly logger = new Logger(RedditAgent.name);

  constructor(
    private db: DbService,
    private llm: LlmRouterService,
    private telegram: TelegramService,
    private reddit: RedditService,
    private registry: AgentRegistryService,
    private kb: KnowledgeBaseService,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  triggers(): TriggerSpec[] {
    return [{ type: 'CRON', cron: '0 */2 * * *' }];
  }

  async buildContext(trigger: TriggerEvent, run: RunContext): Promise<AgentContext> {
    const config = await this.getConfig();

    const trackedKeywords = await this.db.db
      .select()
      .from(redditKeywords)
      .where(eq(redditKeywords.active, 'true'));

    const keywords = trackedKeywords.length
      ? trackedKeywords.map((k) => ({ keyword: k.keyword, subreddits: k.subreddits }))
      : config.defaultKeywords.map((k) => ({ keyword: k, subreddits: null as string | null }));

    const newPosts: any[] = [];

    for (const kw of keywords) {
      const subredditList = kw.subreddits?.split(',').filter(Boolean) ?? [undefined];
      for (const sub of subredditList as (string | undefined)[]) {
        const posts = await this.reddit.searchPosts(kw.keyword, sub, config.maxPostsPerKeyword);
        for (const post of posts) {
          const existing = await this.db.db
            .select()
            .from(redditThreads)
            .where(eq(redditThreads.threadId, post.id))
            .limit(1);
          if (!existing.length) {
            newPosts.push({ ...post, matchedKeyword: kw.keyword });
          }
        }
      }
    }

    return { source: trigger, snapshot: { newPosts, config }, followups: [] };
  }

  async decide(ctx: AgentContext): Promise<ProposedAction[]> {
    const { newPosts, config } = ctx.snapshot as RedditSnapshot;
    if (!newPosts.length) return [{ type: 'noop', summary: 'No new Reddit mentions.', payload: {}, riskLevel: 'low' }];

    const [alwaysOn, samples, blocklist, rejections] = await Promise.all([
      this.kb.getAlwaysOnContext(this.key),
      this.kb.getWritingSamples(this.key),
      this.kb.getBlocklistRules(this.key),
      this.kb.getRecentRejections(this.key, 3),
    ]);
    const template = await this.kb.getPromptTemplate(this.key);

    const actions: ProposedAction[] = [];

    for (const post of newPosts) {
      try {
        const references = await this.kb.searchEntries(`${post.title} ${post.body?.slice(0, 200) ?? ''}`, this.key, 3);
        const kbBlock = this.kb.buildKbPromptBlock({
          voiceProfile: alwaysOn.find(e => e.entryType === 'voice_profile') ?? null,
          facts: alwaysOn.filter(e => e.entryType === 'fact'),
          references,
          positiveSamples: samples.filter(s => s.polarity === 'positive'),
          negativeSamples: samples.filter(s => s.polarity === 'negative'),
          rejections,
        });
        const defaultSystem = `You are writing a Reddit comment. Tone: ${config.commentTone}. 2-3 sentences max. Must add genuine value. No links. No self-promotion. Just the comment text.`;

        const response = await this.llm.complete({
          messages: [
            {
              role: 'system',
              content: (template?.system ?? defaultSystem) + kbBlock,
            },
            {
              role: 'user',
              content: `Subreddit: r/${post.subreddit}\nTitle: ${post.title}\n\n${post.body?.slice(0, 500) ?? ''}`,
            },
          ],
          provider: config.llm.provider as any,
          model: config.llm.model,
          maxTokens: 150,
        });

        let comment = response.content.trim();
        if (!comment) continue;

        comment = await this.selfCritique(comment, alwaysOn.find(e => e.entryType === 'voice_profile')?.content, blocklist);
        const violation = blocklist.find(p => comment.toLowerCase().includes(p.toLowerCase()));

        await this.db.db
          .insert(redditThreads)
          .values({
            threadId: post.id,
            subreddit: post.subreddit,
            title: post.title,
            url: post.url,
            body: post.body?.slice(0, 2000) ?? '',
            draftComment: comment,
          })
          .onConflictDoNothing();

        actions.push({
          type: 'post_comment',
          summary: `Reply in r/${post.subreddit}: "${post.title.slice(0, 60)}"${violation ? ` - Blocklist: "${violation}"` : ''}`,
          payload: { threadId: post.id, subreddit: post.subreddit, title: post.title, url: post.url, comment },
          riskLevel: violation ? 'high' : 'medium',
        });
      } catch (err) {
        this.logger.warn(`Failed to draft Reddit comment: ${err}`);
      }
    }

    return actions.length ? actions : [{ type: 'noop', summary: 'No actionable mentions found.', payload: {}, riskLevel: 'low' }];
  }

  requiresApproval(action: ProposedAction): boolean {
    return action.type === 'post_comment' || action.type === 'reply_to_comment';
  }

  async execute(action: ProposedAction): Promise<ActionResult> {
    if (action.type === 'noop') return { success: true };
    const p = action.payload as any;

    if (action.type === 'post_comment' || action.type === 'reply_to_comment') {
      await this.reddit.postComment(p.threadId, p.comment);
      await this.db.db
        .update(redditThreads)
        .set({ status: 'posted', lastEngagedAt: new Date() })
        .where(eq(redditThreads.threadId, p.threadId));
      await this.telegram.sendMessage(
        `✅ Reddit comment posted in r/${p.subreddit}\n${p.url}\n\n"${p.comment}"`,
      );
      return { success: true, data: { threadId: p.threadId } };
    }

    if (action.type === 'upvote') {
      await this.reddit.upvote(p.threadId);
      return { success: true };
    }

    return { success: true };
  }

  mcpTools(): McpToolDefinition[] {
    return [
      {
        name: 'search_reddit',
        description: 'Search for keyword mentions on Reddit',
        inputSchema: {
          type: 'object',
          properties: { query: { type: 'string' }, subreddit: { type: 'string' }, limit: { type: 'number' } },
          required: ['query'],
        },
        handler: async (input) => {
          const { query, subreddit, limit = 10 } = input as any;
          return this.reddit.searchPosts(query, subreddit, limit);
        },
      },
      {
        name: 'get_thread',
        description: 'Fetch a tracked thread from DB by threadId',
        inputSchema: { type: 'object', properties: { threadId: { type: 'string' } }, required: ['threadId'] },
        handler: async (input) => {
          const [thread] = await this.db.db
            .select()
            .from(redditThreads)
            .where(eq(redditThreads.threadId, (input as any).threadId));
          return thread ?? null;
        },
      },
      {
        name: 'track_keyword',
        description: 'Add a keyword to track on Reddit',
        inputSchema: {
          type: 'object',
          properties: { keyword: { type: 'string' }, subreddits: { type: 'string' } },
          required: ['keyword'],
        },
        handler: async (input) => {
          const { keyword, subreddits } = input as any;
          return this.trackKeyword(keyword, subreddits);
        },
      },
    ];
  }

  apiRoutes(): AgentApiRoute[] {
    return [
      {
        method: 'POST',
        path: '/reddit/track-keyword',
        requiresAuth: true,
        handler: async (body) => {
          const { keyword, subreddits } = body as any;
          return this.trackKeyword(keyword, subreddits);
        },
      },
      {
        method: 'GET',
        path: '/reddit/threads',
        requiresAuth: true,
        handler: async () => this.db.db.select().from(redditThreads).limit(50),
      },
    ];
  }

  async trackKeyword(keyword: string, subreddits?: string) {
    const [row] = await this.db.db
      .insert(redditKeywords)
      .values({ keyword, subreddits: subreddits ?? null })
      .onConflictDoNothing()
      .returning();
    return row;
  }

  private async selfCritique(draft: string, voiceProfile?: string, blocklist?: string[]): Promise<string> {
    try {
      const critique = await this.llm.complete({
        messages: [
          {
            role: 'system',
            content: `You are a strict editor. Review this Reddit comment draft.
Voice: ${voiceProfile ?? 'helpful, genuine, no promotion'}
Avoid: ${blocklist?.join(', ') || 'none specified'}
If the draft is good, return: {"ok":true}
If not, rewrite and return: {"ok":false,"revised":"improved comment here"}`,
          },
          { role: 'user', content: `Draft: "${draft}"` },
        ],
        provider: 'auto',
        model: 'gpt-4o-mini',
        maxTokens: 200,
      });
      const result = JSON.parse(critique.content);
      if (!result.ok && result.revised) return result.revised.trim();
    } catch {
      // fail-open
    }
    return draft;
  }

  private async getConfig(): Promise<RedditConfig> {
    const [row] = await this.db.db.select().from(agents).where(eq(agents.key, this.key));
    return { ...DEFAULT_CONFIG, ...(row?.config as Partial<RedditConfig> ?? {}) };
  }
}
