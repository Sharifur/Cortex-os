import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { agents } from '../../../db/schema';
import { contentIdeas } from './schema';
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

interface CanvaConfig {
  brands: string[];
  formats: string[];
  targetCount: number;
  brandVoice: string;
  llm: { provider: string; model: string };
}

interface CanvaSnapshot {
  month: string;
  config: CanvaConfig;
  existingCount: number;
}

const DEFAULT_CONFIG: CanvaConfig = {
  brands: ['taskip', 'xgenious'],
  formats: ['carousel', 'reel', 'post', 'story', 'youtube'],
  targetCount: 30,
  brandVoice: 'educational, relatable, and slightly witty — for SaaS founders and project managers',
  llm: { provider: 'auto', model: 'gpt-4o' },
};

const CALENDAR_PROMPT = (month: string, brandVoice: string, count: number, brands: string[], formats: string[]) =>
  `Generate a ${count}-idea social media content calendar for ${month}.

Brand voice: ${brandVoice}
Brands: ${brands.join(', ')}
Formats: ${formats.join(', ')}
Platforms: Facebook, Instagram, X/Twitter, LinkedIn, YouTube

For each idea return valid JSON (array of objects):
{
  "format": "...",
  "hook": "...",
  "body": "brief content description in 1-2 sentences",
  "cta": "...",
  "platform": "...",
  "brand": "..."
}

Return only the JSON array, no markdown, no explanation.`;

@Injectable()
export class CanvaAgent implements IAgent, OnModuleInit {
  readonly key = 'canva';
  readonly name = 'Canva + Social Content Agent';
  private readonly logger = new Logger(CanvaAgent.name);

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
      { type: 'CRON', cron: '0 8 1 * *' }, // 1st of each month at 08:00
      { type: 'MANUAL' },
    ];
  }

  async buildContext(trigger: TriggerEvent, run: RunContext): Promise<AgentContext> {
    const config = await this.getConfig();
    const month = new Date().toISOString().slice(0, 7);

    const existing = await this.db.db
      .select()
      .from(contentIdeas)
      .where(eq(contentIdeas.month, month));

    return {
      source: trigger,
      snapshot: { month, config, existingCount: existing.length },
      followups: [],
    };
  }

  async decide(ctx: AgentContext): Promise<ProposedAction[]> {
    const { month, config, existingCount } = ctx.snapshot as CanvaSnapshot;

    if (existingCount >= config.targetCount) {
      return [{
        type: 'noop',
        summary: `Content calendar for ${month} already has ${existingCount} ideas.`,
        payload: {},
        riskLevel: 'low',
      }];
    }

    try {
      const response = await this.llm.complete({
        messages: [
          { role: 'user', content: CALENDAR_PROMPT(month, config.brandVoice, config.targetCount, config.brands, config.formats) },
        ],
        provider: config.llm.provider as any,
        model: config.llm.model,
        maxTokens: 4000,
      });

      let ideas: any[];
      try {
        const raw = response.content.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
        ideas = JSON.parse(raw);
      } catch {
        this.logger.warn('Failed to parse content calendar JSON');
        return [{ type: 'noop', summary: 'LLM returned unparseable calendar', payload: {}, riskLevel: 'low' }];
      }

      return [{
        type: 'approve_calendar_batch',
        summary: `Approve ${ideas.length}-idea content calendar for ${month}`,
        payload: { month, ideas },
        riskLevel: 'medium',
      }];
    } catch (err) {
      this.logger.warn(`Failed to generate content calendar: ${err}`);
      return [{ type: 'noop', summary: 'Failed to generate calendar', payload: {}, riskLevel: 'low' }];
    }
  }

  requiresApproval(action: ProposedAction): boolean {
    return action.type === 'approve_calendar_batch';
  }

  async execute(action: ProposedAction): Promise<ActionResult> {
    if (action.type === 'noop') return { success: true };
    const p = action.payload as any;

    if (action.type === 'approve_calendar_batch') {
      const rows = (p.ideas as any[]).map((idea) => ({
        month: p.month,
        format: idea.format,
        hook: idea.hook,
        body: idea.body,
        cta: idea.cta,
        platform: idea.platform ?? null,
        brand: idea.brand ?? null,
      }));

      for (const row of rows) {
        await this.db.db.insert(contentIdeas).values(row).onConflictDoNothing();
      }

      await this.telegram.sendMessage(
        `Content calendar for ${p.month} saved — ${rows.length} ideas ready for design.`,
      );
      return { success: true, data: { month: p.month, count: rows.length } };
    }

    return { success: true };
  }

  mcpTools(): McpToolDefinition[] {
    return [
      {
        name: 'generate_calendar',
        description: 'Generate a monthly content calendar with ideas for all platforms',
        inputSchema: {
          type: 'object',
          properties: { month: { type: 'string' }, count: { type: 'number' } },
          required: ['month'],
        },
        handler: async (input) => {
          const { month, count = 30 } = input as any;
          return this.db.db.select().from(contentIdeas).where(eq(contentIdeas.month, month)).limit(count);
        },
      },
      {
        name: 'draft_reel_script',
        description: 'LLM-draft a short reel/video script from a content idea',
        inputSchema: {
          type: 'object',
          properties: { ideaId: { type: 'string' } },
          required: ['ideaId'],
        },
        handler: async (input) => {
          const [idea] = await this.db.db.select().from(contentIdeas).where(eq(contentIdeas.id, (input as any).ideaId));
          if (!idea) return null;
          const config = await this.getConfig();
          const response = await this.llm.complete({
            messages: [
              { role: 'system', content: 'Write a short 30-second reel script. Hook (5 sec), body (20 sec), CTA (5 sec). No emojis. Just the script.' },
              { role: 'user', content: `Hook: ${idea.hook}\nBody: ${idea.body}\nCTA: ${idea.cta}` },
            ],
            provider: config.llm.provider as any,
            model: config.llm.model,
            maxTokens: 300,
          });
          return { ideaId: idea.id, script: response.content.trim() };
        },
      },
    ];
  }

  apiRoutes(): AgentApiRoute[] {
    return [
      {
        method: 'POST',
        path: '/canva/generate-month',
        requiresAuth: true,
        handler: async (body) => {
          const month = (body as any).month ?? new Date().toISOString().slice(0, 7);
          const existing = await this.db.db.select().from(contentIdeas).where(eq(contentIdeas.month, month));
          return { month, count: existing.length, ideas: existing };
        },
      },
      {
        method: 'GET',
        path: '/canva/calendar/:month',
        requiresAuth: true,
        handler: async (body) => {
          const month = (body as any).month;
          return this.db.db.select().from(contentIdeas).where(eq(contentIdeas.month, month));
        },
      },
    ];
  }

  private async getConfig(): Promise<CanvaConfig> {
    const [row] = await this.db.db.select().from(agents).where(eq(agents.key, this.key));
    return { ...DEFAULT_CONFIG, ...(row?.config as Partial<CanvaConfig> ?? {}) };
  }
}
