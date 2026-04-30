import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { eq, desc } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { agents } from '../../../db/schema';
import { shortsScripts } from './schema';
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
import { agentLlmOpts } from '../runtime/llm-config.util';

interface ShortsConfig {
  brands: string[];
  topics: string[];
  targetDurationSecs: number;
  videosPerRun: number;
  contentStyle: string;
  llm?: { provider?: string; model?: string };
}

interface ShortsSnapshot {
  config: ShortsConfig;
  taskMode?: boolean;
  instructions?: string;
}

interface ShortScript {
  title: string;
  hook: string;
  voiceover: string;
  visualBrief: string;
  canvaDesignBrief: string;
  brand: string;
  topic: string;
}

const DEFAULT_CONFIG: ShortsConfig = {
  brands: ['taskip', 'xgenious'],
  topics: ['productivity tips', 'SaaS behind the scenes', 'project management hacks', 'founder life'],
  targetDurationSecs: 30,
  videosPerRun: 3,
  contentStyle: 'educational, punchy, relatable — for SaaS founders and developers',
};

const SHORTS_SYSTEM = `You are a YouTube Shorts / Reels content creator.
Create scripts that stop the scroll and deliver real value in under 60 seconds.
Target audience: SaaS founders, developers, project managers.
No fluff. No filler. Hook hard in the first 3 seconds.

For each video, return a JSON object:
{
  "title": "Thumbnail text — max 6 words, punchy",
  "hook": "Opening 3-5 seconds — must grab attention immediately",
  "voiceover": "Full narration script (reads in ~${0} seconds at normal pace)",
  "visualBrief": "Screen directions: text overlays, b-roll, transitions, on-screen text",
  "canvaDesignBrief": "Design brief: background color, accent color, font style, key text for thumbnail/opening card",
  "brand": "taskip or xgenious",
  "topic": "the topic this covers"
}`;

@Injectable()
export class ShortsAgent implements IAgent, OnModuleInit {
  readonly key = 'shorts';
  readonly name = 'YouTube Shorts Creator';
  private readonly logger = new Logger(ShortsAgent.name);

  constructor(
    private db: DbService,
    private llm: LlmRouterService,
    private telegram: TelegramService,
    private registry: AgentRegistryService,
    private kb: KnowledgeBaseService,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  triggers(): TriggerSpec[] {
    return [
      { type: 'CRON', cron: '0 9 * * 1' }, // Monday 9am
      { type: 'MANUAL' },
    ];
  }

  async buildContext(trigger: TriggerEvent, _run: RunContext): Promise<AgentContext> {
    const config = await this.getConfig();
    const payload = trigger.payload as Record<string, unknown> | null;
    if (payload?._taskId) {
      return {
        source: trigger,
        snapshot: { taskMode: true, instructions: (payload.instructions as string) ?? '', config },
        followups: [],
      };
    }
    return { source: trigger, snapshot: { config }, followups: [] };
  }

  async decide(ctx: AgentContext): Promise<ProposedAction[]> {
    const snap = ctx.snapshot as ShortsSnapshot;
    const { config } = snap;
    const topicOverride = snap.taskMode ? snap.instructions : undefined;

    const [alwaysOn, samples, rejections] = await Promise.all([
      this.kb.getAlwaysOnContext(this.key),
      this.kb.getWritingSamples(this.key),
      this.kb.getRecentRejections(this.key, 3),
    ]);
    const template = await this.kb.getPromptTemplate(this.key);

    const topicList = topicOverride ?? config.topics.join(', ');
    const searchQuery = topicOverride ?? `YouTube Shorts content ${config.brands.join(' ')} ${config.topics[0]}`;
    const references = await this.kb.searchEntries(searchQuery, this.key, 5);

    const kbBlock = this.kb.buildKbPromptBlock({
      voiceProfile: alwaysOn.find(e => e.entryType === 'voice_profile') ?? null,
      facts: alwaysOn.filter(e => e.entryType === 'fact'),
      references,
      positiveSamples: samples.filter(s => s.polarity === 'positive'),
      negativeSamples: samples.filter(s => s.polarity === 'negative'),
      rejections,
    });

    const baseSystem = template?.system
      ?? SHORTS_SYSTEM.replace('${0}', String(config.targetDurationSecs));

    const userPrompt = topicOverride
      ? `Generate ${config.videosPerRun} YouTube Shorts scripts on this topic/style: ${topicOverride}
Brands: ${config.brands.join(', ')}
Duration: ~${config.targetDurationSecs} seconds each
Style: ${config.contentStyle}

Return a JSON array of ${config.videosPerRun} script objects. No markdown, no explanation — only the JSON array.`
      : `Generate ${config.videosPerRun} YouTube Shorts scripts.
Topics to choose from: ${topicList}
Brands: ${config.brands.join(', ')}
Duration: ~${config.targetDurationSecs} seconds each
Style: ${config.contentStyle}

Return a JSON array of ${config.videosPerRun} script objects. No markdown, no explanation — only the JSON array.`;

    try {
      const response = await this.llm.complete({
        messages: [
          { role: 'system', content: baseSystem + kbBlock },
          { role: 'user', content: userPrompt },
        ],
        ...agentLlmOpts(config),
        maxTokens: 3000,
        temperature: 0.8,
      });

      let scripts: ShortScript[];
      try {
        const raw = response.content.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
        const parsed = JSON.parse(raw);
        scripts = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        this.logger.warn('Failed to parse shorts scripts JSON');
        return [{ type: 'noop', summary: 'LLM returned unparseable scripts', payload: {}, riskLevel: 'low' }];
      }

      return scripts.map(script => ({
        type: 'approve_short_script',
        summary: `Short: "${script.title}" (${script.brand} · ${script.topic})`,
        payload: { script },
        riskLevel: 'high' as const,
      }));
    } catch (err) {
      this.logger.warn(`Shorts script generation failed: ${err}`);
      return [{ type: 'noop', summary: 'Failed to generate scripts', payload: {}, riskLevel: 'low' }];
    }
  }

  requiresApproval(action: ProposedAction): boolean {
    return action.type === 'approve_short_script';
  }

  async execute(action: ProposedAction): Promise<ActionResult> {
    if (action.type === 'noop') return { success: true };

    if (action.type === 'approve_short_script') {
      const { script } = action.payload as { script: ShortScript };
      const config = await this.getConfig();

      const [row] = await this.db.db
        .insert(shortsScripts)
        .values({
          title: script.title,
          hook: script.hook,
          voiceover: script.voiceover,
          visualBrief: script.visualBrief,
          brand: script.brand ?? config.brands[0],
          topic: script.topic,
          durationSecs: config.targetDurationSecs,
          status: 'approved',
        })
        .returning();

      await this.telegram.sendMessage(
        `*Short script saved*\n\n` +
        `*${script.title}*\n\n` +
        `Hook: ${script.hook}\n\n` +
        `Script: ${script.voiceover.slice(0, 300)}${script.voiceover.length > 300 ? '...' : ''}\n\n` +
        `Canva brief: ${(script.canvaDesignBrief ?? '').slice(0, 200)}\n\n` +
        `ID: \`${row.id}\``,
      );

      return { success: true, data: { id: row.id } };
    }

    return { success: true };
  }

  mcpTools(): McpToolDefinition[] {
    return [
      {
        name: 'list_scripts',
        description: 'List saved YouTube Shorts scripts',
        inputSchema: { type: 'object', properties: { status: { type: 'string' }, limit: { type: 'number' } } },
        handler: async (input) => {
          const { status, limit = 20 } = input as any;
          const query = this.db.db.select().from(shortsScripts).orderBy(desc(shortsScripts.createdAt)).limit(limit);
          if (status) return query.where(eq(shortsScripts.status, status));
          return query;
        },
      },
      {
        name: 'get_script',
        description: 'Get a shorts script by ID',
        inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
        handler: async (input) => {
          const [row] = await this.db.db.select().from(shortsScripts).where(eq(shortsScripts.id, (input as any).id));
          return row ?? null;
        },
      },
      {
        name: 'update_canva_design',
        description: 'Link a Canva design to a shorts script',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string' }, canvaDesignId: { type: 'string' }, canvaDesignUrl: { type: 'string' } },
          required: ['id'],
        },
        handler: async (input) => {
          const { id, canvaDesignId, canvaDesignUrl } = input as any;
          const [row] = await this.db.db
            .update(shortsScripts)
            .set({ canvaDesignId, canvaDesignUrl })
            .where(eq(shortsScripts.id, id))
            .returning();
          return row;
        },
      },
    ];
  }

  apiRoutes(): AgentApiRoute[] {
    return [
      {
        method: 'GET',
        path: '/shorts/scripts',
        requiresAuth: true,
        handler: async () =>
          this.db.db.select().from(shortsScripts).orderBy(desc(shortsScripts.createdAt)).limit(50),
      },
      {
        method: 'PATCH',
        path: '/shorts/scripts/:id/canva',
        requiresAuth: true,
        handler: async (body) => {
          const { id, canvaDesignId, canvaDesignUrl } = body as any;
          const [row] = await this.db.db
            .update(shortsScripts)
            .set({ canvaDesignId, canvaDesignUrl, status: 'in_production' })
            .where(eq(shortsScripts.id, id))
            .returning();
          return row;
        },
      },
      {
        method: 'PATCH',
        path: '/shorts/scripts/:id/publish',
        requiresAuth: true,
        handler: async (body) => {
          const { id } = body as any;
          const [row] = await this.db.db
            .update(shortsScripts)
            .set({ status: 'published' })
            .where(eq(shortsScripts.id, id))
            .returning();
          return row;
        },
      },
    ];
  }

  private async getConfig(): Promise<ShortsConfig> {
    const [row] = await this.db.db.select().from(agents).where(eq(agents.key, this.key));
    return { ...DEFAULT_CONFIG, ...(row?.config as Partial<ShortsConfig> ?? {}) };
  }
}
