import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { agents } from '../../../db/schema';
import { linkedinPosts, linkedinLeads } from './schema';
import { LinkedInService } from './linkedin.service';
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

interface LinkedInConfig {
  targetTopics: string[];
  maxCommentsPerRun: number;
  commentTone: string;
  llm: { provider: string; model: string };
}

interface LinkedInSnapshot {
  feedPosts: any[];
  config: LinkedInConfig;
}

const DEFAULT_CONFIG: LinkedInConfig = {
  targetTopics: ['SaaS', 'productivity', 'startup', 'project management'],
  maxCommentsPerRun: 3,
  commentTone: 'professional, concise, adds value — never salesy',
  llm: { provider: 'auto', model: 'gpt-4o-mini' },
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
    private registry: AgentRegistryService,
    private kb: KnowledgeBaseService,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  triggers(): TriggerSpec[] {
    return [
      { type: 'CRON', cron: '0 */4 * * *' },
      { type: 'MANUAL' },
    ];
  }

  async buildContext(trigger: TriggerEvent, run: RunContext): Promise<AgentContext> {
    const config = await this.getConfig();
    const feedPosts = await this.li.getFeedPosts(20);
    return { source: trigger, snapshot: { feedPosts, config }, followups: [] };
  }

  async decide(ctx: AgentContext): Promise<ProposedAction[]> {
    const { feedPosts, config } = ctx.snapshot as LinkedInSnapshot;

    const relevant = feedPosts
      .filter((p) =>
        config.targetTopics.some((t) => p.content?.toLowerCase().includes(t.toLowerCase())),
      )
      .slice(0, config.maxCommentsPerRun);

    if (!relevant.length) return [{ type: 'noop', summary: 'No relevant posts to engage with.', payload: {}, riskLevel: 'low' }];

    const [alwaysOn, samples, blocklist, rejections] = await Promise.all([
      this.kb.getAlwaysOnContext(this.key),
      this.kb.getWritingSamples(this.key),
      this.kb.getBlocklistRules(this.key),
      this.kb.getRecentRejections(this.key, 3),
    ]);
    const template = await this.kb.getPromptTemplate(this.key);

    const actions: ProposedAction[] = [];

    for (const post of relevant) {
      try {
        const references = await this.kb.searchEntries(post.content?.slice(0, 300) ?? '', this.key, 3);
        const kbBlock = this.kb.buildKbPromptBlock({
          voiceProfile: alwaysOn.find(e => e.entryType === 'voice_profile') ?? null,
          facts: alwaysOn.filter(e => e.entryType === 'fact'),
          references,
          positiveSamples: samples.filter(s => s.polarity === 'positive'),
          negativeSamples: samples.filter(s => s.polarity === 'negative'),
          rejections,
        });
        const defaultSystem = `You are writing a LinkedIn comment. Tone: ${config.commentTone}. Write 1-2 sentences max. No emojis. No self-promotion. Respond with just the comment text.`;

        const response = await this.llm.complete({
          messages: [
            {
              role: 'system',
              content: (template?.system ?? defaultSystem) + kbBlock,
            },
            {
              role: 'user',
              content: `Post by ${post.authorName}:\n\n${post.content.slice(0, 600)}`,
            },
          ],
          provider: config.llm.provider as any,
          model: config.llm.model,
          maxTokens: 120,
        });

        let comment = response.content.trim();
        if (!comment) continue;

        comment = await this.selfCritique(comment, alwaysOn.find(e => e.entryType === 'voice_profile')?.content, blocklist);
        const violation = blocklist.find(p => comment.toLowerCase().includes(p.toLowerCase()));

        await this.db.db
          .insert(linkedinPosts)
          .values({
            externalId: post.id,
            authorName: post.authorName,
            content: post.content.slice(0, 2000),
            draftComment: comment,
          })
          .onConflictDoNothing();

        actions.push({
          type: 'post_comment',
          summary: `Comment on ${post.authorName}'s post: "${comment.slice(0, 80)}"${violation ? ` - Blocklist: "${violation}"` : ''}`,
          payload: { postId: post.id, authorName: post.authorName, comment },
          riskLevel: violation ? 'high' : 'medium',
        });
      } catch (err) {
        this.logger.warn(`Failed to draft LinkedIn comment: ${err}`);
      }
    }

    return actions.length ? actions : [{ type: 'noop', summary: 'No actionable posts.', payload: {}, riskLevel: 'low' }];
  }

  requiresApproval(action: ProposedAction): boolean {
    return action.type === 'post_comment' || action.type === 'send_dm' || action.type === 'publish_post';
  }

  async execute(action: ProposedAction): Promise<ActionResult> {
    if (action.type === 'noop') return { success: true };
    const p = action.payload as any;

    if (action.type === 'post_comment') {
      await this.li.postComment(p.postId, p.comment);
      await this.db.db
        .update(linkedinPosts)
        .set({ status: 'posted', postedAt: new Date() })
        .where(eq(linkedinPosts.externalId, p.postId));
      await this.telegram.sendMessage(`✅ LinkedIn comment posted on ${p.authorName}'s post:\n"${p.comment}"`);
      return { success: true, data: { postId: p.postId } };
    }

    if (action.type === 'send_dm') {
      await this.li.sendDM(p.profileId, p.message);
      if (p.leadId) {
        await this.db.db
          .update(linkedinLeads)
          .set({ status: 'messaged', lastContactedAt: new Date() })
          .where(eq(linkedinLeads.id, p.leadId));
      }
      await this.telegram.sendMessage(`✅ LinkedIn DM sent to ${p.name ?? p.profileId}`);
      return { success: true };
    }

    return { success: true };
  }

  mcpTools(): McpToolDefinition[] {
    return [
      {
        name: 'get_feed',
        description: 'Fetch recent LinkedIn feed posts',
        inputSchema: { type: 'object', properties: { limit: { type: 'number' } } },
        handler: async (input) => this.li.getFeedPosts((input as any).limit ?? 10),
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
            maxTokens: 120,
          });
          return { draft: response.content.trim() };
        },
      },
    ];
  }

  apiRoutes(): AgentApiRoute[] {
    return [
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
            maxTokens: 120,
          });
          return { draft: response.content.trim() };
        },
      },
    ];
  }

  private async selfCritique(draft: string, voiceProfile?: string, blocklist?: string[]): Promise<string> {
    try {
      const critique = await this.llm.complete({
        messages: [
          {
            role: 'system',
            content: `You are a strict editor. Review this LinkedIn comment draft.
Voice: ${voiceProfile ?? 'professional, concise, adds value'}
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

  private async getConfig(): Promise<LinkedInConfig> {
    const [row] = await this.db.db.select().from(agents).where(eq(agents.key, this.key));
    return { ...DEFAULT_CONFIG, ...(row?.config as Partial<LinkedInConfig> ?? {}) };
  }
}
