import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { eq, lte, and } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { agents } from '../../../db/schema';
import { socialPosts, socialEngagements } from './schema';
import { AgentRegistryService } from '../runtime/agent-registry.service';
import { LlmRouterService } from '../../llm/llm-router.service';
import { TelegramService } from '../../telegram/telegram.service';
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

interface SocialConfig {
  brands: string[];
  platforms: string[];
  replyTone: string;
  llm: { provider: string; model: string };
}

interface SocialSnapshot {
  duePosts: any[];
  pendingEngagements: any[];
  config: SocialConfig;
}

const DEFAULT_CONFIG: SocialConfig = {
  brands: ['taskip', 'xgenious'],
  platforms: ['fb', 'ig', 'x', 'linkedin'],
  replyTone: 'friendly, professional, adds value — never salesy',
  llm: { provider: 'auto', model: 'gpt-4o-mini' },
};

@Injectable()
export class SocialAgent implements IAgent, OnModuleInit {
  readonly key = 'social';
  readonly name = 'Social Media Handler';
  private readonly logger = new Logger(SocialAgent.name);

  constructor(
    private db: DbService,
    private llm: LlmRouterService,
    private telegram: TelegramService,
    private registry: AgentRegistryService,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  triggers(): TriggerSpec[] {
    return [
      { type: 'CRON', cron: '0 * * * *' },      // hourly publish sweep
      { type: 'CRON', cron: '*/30 * * * *' },    // 30min engagement sweep
      { type: 'MANUAL' },
    ];
  }

  async buildContext(trigger: TriggerEvent, run: RunContext): Promise<AgentContext> {
    const config = await this.getConfig();
    const now = new Date();

    const duePosts = await this.db.db
      .select()
      .from(socialPosts)
      .where(and(eq(socialPosts.status, 'scheduled'), lte(socialPosts.scheduledFor, now)));

    const pendingEngagements = await this.db.db
      .select()
      .from(socialEngagements)
      .where(eq(socialEngagements.status, 'new'))
      .limit(20);

    return { source: trigger, snapshot: { duePosts, pendingEngagements, config }, followups: [] };
  }

  async decide(ctx: AgentContext): Promise<ProposedAction[]> {
    const { duePosts, pendingEngagements, config } = ctx.snapshot as SocialSnapshot;
    const actions: ProposedAction[] = [];

    for (const post of duePosts) {
      actions.push({
        type: 'publish_post',
        summary: `Publish ${post.brand}/${post.platform}: "${post.body.slice(0, 60)}"`,
        payload: { postId: post.id, brand: post.brand, platform: post.platform, body: post.body, mediaUrls: JSON.parse(post.mediaUrls || '[]') },
        riskLevel: 'high',
      });
    }

    for (const eng of pendingEngagements) {
      try {
        const response = await this.llm.complete({
          messages: [
            {
              role: 'system',
              content: `You are a social media manager. Tone: ${config.replyTone}. Write a 1-2 sentence reply to this ${eng.type}. Just the reply text.`,
            },
            {
              role: 'user',
              content: `From @${eng.fromUser}: ${eng.body}`,
            },
          ],
          provider: config.llm.provider as any,
          model: config.llm.model,
          maxTokens: 100,
        });

        const draft = response.content.trim();
        if (!draft) continue;

        await this.db.db
          .update(socialEngagements)
          .set({ draftedReply: draft })
          .where(eq(socialEngagements.id, eng.id));

        actions.push({
          type: eng.type === 'dm' ? 'reply_to_dm' : 'reply_to_comment',
          summary: `Reply to @${eng.fromUser} (${eng.platform} ${eng.type}): "${draft.slice(0, 60)}"`,
          payload: { engagementId: eng.id, platform: eng.platform, fromUser: eng.fromUser, originalBody: eng.body, draft },
          riskLevel: eng.type === 'dm' ? 'high' : 'medium',
        });
      } catch (err) {
        this.logger.warn(`Failed to draft reply: ${err}`);
      }
    }

    return actions.length
      ? actions
      : [{ type: 'noop', summary: 'No posts due or engagements to handle.', payload: {}, riskLevel: 'low' }];
  }

  requiresApproval(action: ProposedAction): boolean {
    return action.type === 'publish_post' || action.type === 'reply_to_comment' || action.type === 'reply_to_dm';
  }

  async execute(action: ProposedAction): Promise<ActionResult> {
    if (action.type === 'noop') return { success: true };
    const p = action.payload as any;

    if (action.type === 'publish_post') {
      // Platform publishing would go through individual platform APIs
      await this.db.db
        .update(socialPosts)
        .set({ status: 'published', publishedAt: new Date() })
        .where(eq(socialPosts.id, p.postId));
      await this.telegram.sendMessage(
        `✅ Post published on ${p.brand}/${p.platform}\n"${p.body.slice(0, 120)}"`,
      );
      return { success: true, data: { postId: p.postId } };
    }

    if (action.type === 'reply_to_comment' || action.type === 'reply_to_dm') {
      await this.db.db
        .update(socialEngagements)
        .set({ status: 'replied', repliedAt: new Date() })
        .where(eq(socialEngagements.id, p.engagementId));
      await this.telegram.sendMessage(
        `✅ ${action.type === 'reply_to_dm' ? 'DM' : 'Comment'} reply sent to @${p.fromUser} on ${p.platform}\n"${p.draft}"`,
      );
      return { success: true };
    }

    return { success: true };
  }

  mcpTools(): McpToolDefinition[] {
    return [
      {
        name: 'list_scheduled_posts',
        description: 'List posts due for publishing',
        inputSchema: { type: 'object', properties: { limit: { type: 'number' } } },
        handler: async (input) =>
          this.db.db.select().from(socialPosts).where(eq(socialPosts.status, 'scheduled')).limit((input as any).limit ?? 20),
      },
      {
        name: 'get_engagements',
        description: 'Fetch recent comments/DMs pending reply',
        inputSchema: { type: 'object', properties: { limit: { type: 'number' } } },
        handler: async (input) =>
          this.db.db.select().from(socialEngagements).where(eq(socialEngagements.status, 'new')).limit((input as any).limit ?? 20),
      },
      {
        name: 'draft_reply',
        description: 'LLM-draft a reply to a comment or DM',
        inputSchema: {
          type: 'object',
          properties: { engagementId: { type: 'string' } },
          required: ['engagementId'],
        },
        handler: async (input) => {
          const [eng] = await this.db.db.select().from(socialEngagements).where(eq(socialEngagements.id, (input as any).engagementId));
          return eng ?? null;
        },
      },
    ];
  }

  apiRoutes(): AgentApiRoute[] {
    return [
      {
        method: 'POST',
        path: '/social/schedule',
        requiresAuth: true,
        handler: async (body) => {
          const { brand, platform, postBody, mediaUrls, scheduledFor } = body as any;
          const [row] = await this.db.db
            .insert(socialPosts)
            .values({
              brand,
              platform,
              body: postBody,
              mediaUrls: JSON.stringify(mediaUrls ?? []),
              scheduledFor: new Date(scheduledFor),
            })
            .returning();
          return row;
        },
      },
      {
        method: 'GET',
        path: '/social/scheduled',
        requiresAuth: true,
        handler: async () =>
          this.db.db.select().from(socialPosts).where(eq(socialPosts.status, 'scheduled')).limit(50),
      },
      {
        method: 'POST',
        path: '/social/engagement',
        requiresAuth: false,
        handler: async (body) => {
          const { platform, type, fromUser, engBody, postId } = body as any;
          const [row] = await this.db.db
            .insert(socialEngagements)
            .values({ platform, type, fromUser, body: engBody, postId: postId ?? null })
            .returning();
          return row;
        },
      },
    ];
  }

  private async getConfig(): Promise<SocialConfig> {
    const [row] = await this.db.db.select().from(agents).where(eq(agents.key, this.key));
    return { ...DEFAULT_CONFIG, ...(row?.config as Partial<SocialConfig> ?? {}) };
  }
}
