import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { agents } from '../../../db/schema';
import { contentIdeas, canvaCandidates, canvaSessions, canvaDebugLog } from './schema';
import { AgentRegistryService } from '../runtime/agent-registry.service';
import { LlmRouterService } from '../../llm/llm-router.service';
import { TelegramService } from '../../telegram/telegram.service';
import { ConceptParserService } from './concept-parser.service';
import { PlannerService } from './planner.service';
import { SkillLoaderService } from './skill-loader.service';
import { CandidateAggregatorService } from './candidate-aggregator.service';
import { ApprovalManagerService } from './approval-manager.service';
import { CanvaMcpService } from './canva-mcp.service';
import { CanvaBrandsService } from './canva-brands.service';
import { CanvaDebugService } from './canva-debug.service';
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

interface CanvaConfig {
  brands: string[];
  formats: string[];
  targetCount: number;
  brandVoice: string;
  debugMode?: boolean;
  maxCostUsd?: number;
  llm?: { provider?: string; model?: string };
}

const DEFAULT_CONFIG: CanvaConfig = {
  brands: ['taskip', 'xgenious'],
  formats: ['carousel', 'reel', 'post', 'story', 'youtube'],
  targetCount: 30,
  brandVoice: 'educational, relatable, and slightly witty — for SaaS founders and project managers',
  debugMode: false,
  maxCostUsd: 5.0,
};

@Injectable()
export class CanvaAgent implements IAgent, OnModuleInit {
  readonly key = 'canva';
  readonly name = 'Canva + Social Content Agent';
  private readonly logger = new Logger(CanvaAgent.name);

  constructor(
    private readonly db: DbService,
    private readonly llm: LlmRouterService,
    private readonly telegram: TelegramService,
    private readonly registry: AgentRegistryService,
    private readonly conceptParser: ConceptParserService,
    private readonly planner: PlannerService,
    private readonly skills: SkillLoaderService,
    private readonly aggregator: CandidateAggregatorService,
    private readonly approvalManager: ApprovalManagerService,
    private readonly canvaMcp: CanvaMcpService,
    private readonly brands: CanvaBrandsService,
    private readonly debug: CanvaDebugService,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  triggers(): TriggerSpec[] {
    return [
      { type: 'CRON', cron: '0 8 1 * *' }, // 1st of month: content calendar
      { type: 'MANUAL' },
      { type: 'API' },
    ];
  }

  async buildContext(trigger: TriggerEvent, run: RunContext): Promise<AgentContext> {
    const config = await this.getConfig();
    const payload = trigger.payload as any;
    const taskMode = payload?.task ?? null;

    if (taskMode === 'generate_design') {
      return {
        source: trigger,
        snapshot: { mode: 'design', concept: payload.concept ?? '', config },
        followups: [],
      };
    }

    // Default: content calendar mode
    const month = new Date().toISOString().slice(0, 7);
    const existing = await this.db.db.select().from(contentIdeas).where(eq(contentIdeas.month, month));
    return {
      source: trigger,
      snapshot: { mode: 'calendar', month, config, existingCount: existing.length },
      followups: [],
    };
  }

  async decide(ctx: AgentContext): Promise<ProposedAction[]> {
    const snap = ctx.snapshot as any;
    const config: CanvaConfig = snap.config;

    if (snap.mode === 'design') {
      return this.decideDesign(snap.concept, config);
    }
    return this.decideCalendar(snap.month, config, snap.existingCount);
  }

  private async decideDesign(concept: string, config: CanvaConfig): Promise<ProposedAction[]> {
    if (!concept?.trim()) {
      return [{ type: 'noop', summary: 'No concept provided', payload: {}, riskLevel: 'low' }];
    }

    try {
      // T2: Parse concept into structured brief (injects brand identity - T29)
      const brief = await this.conceptParser.parse(concept, { debugMode: config.debugMode });

      // T14: Match skills
      const matched = this.skills.match(brief);
      const skillNames = matched.map((s) => s.skill.name);

      await this.debug.log({
        step: 'skill_match',
        actor: 'CanvaAgent',
        data: { skills: matched.map((s) => ({ name: s.skill.name, score: s.score })) },
        debugMode: config.debugMode ?? false,
      });

      // T8: Build generation plan
      const plan = this.planner.plan('pending', brief, skillNames);

      return [{
        type: 'generate_designs',
        summary: `Generate ${plan.tasks.length} design candidates for: ${brief.subject.slice(0, 60)}`,
        payload: { brief, plan, debugMode: config.debugMode, maxCostUsd: config.maxCostUsd },
        riskLevel: 'medium',
      }];
    } catch (err) {
      this.logger.warn(`decideDesign failed: ${(err as Error).message}`);
      return [{ type: 'noop', summary: 'Failed to parse design concept', payload: {}, riskLevel: 'low' }];
    }
  }

  private async decideCalendar(month: string, config: CanvaConfig, existingCount: number): Promise<ProposedAction[]> {
    if (existingCount >= config.targetCount) {
      return [{ type: 'noop', summary: `Calendar for ${month} already has ${existingCount} ideas`, payload: {}, riskLevel: 'low' }];
    }

    // Use per-brand voices if available, else fall back to global brandVoice
    const brandList = await Promise.all(
      config.brands.map((b) => this.brands.getByName(b)),
    );
    const brandContext = brandList
      .filter(Boolean)
      .map((b) => `${b!.displayName}: ${b!.voiceProfile}`)
      .join('\n');
    const voiceContext = brandContext || config.brandVoice;

    const prompt = `Generate a ${config.targetCount}-idea social media content calendar for ${month}.

Brand voices:
${voiceContext}

Formats: ${config.formats.join(', ')}
Platforms: Facebook, Instagram, X/Twitter, LinkedIn, YouTube

Return ONLY a JSON array (no markdown):
[{ "format": "...", "hook": "...", "body": "1-2 sentence description", "cta": "...", "platform": "...", "brand": "taskip|xgenious" }]`;

    try {
      const response = await this.llm.complete({
        messages: [{ role: 'user', content: prompt }],
        ...agentLlmOpts(config),
        agentKey: this.key,
        maxTokens: 4000,
      });

      const raw = response.content.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
      const ideas = JSON.parse(raw);

      return [{
        type: 'approve_calendar_batch',
        summary: `Approve ${ideas.length}-idea content calendar for ${month}`,
        payload: { month, ideas },
        riskLevel: 'medium',
      }];
    } catch (err) {
      this.logger.warn(`Calendar generation failed: ${(err as Error).message}`);
      return [{ type: 'noop', summary: 'Failed to generate calendar', payload: {}, riskLevel: 'low' }];
    }
  }

  requiresApproval(action: ProposedAction): boolean {
    return action.type === 'approve_calendar_batch' || action.type === 'generate_designs';
  }

  async execute(action: ProposedAction): Promise<ActionResult> {
    if (action.type === 'noop') return { success: true };

    if (action.type === 'approve_calendar_batch') {
      return this.executeCalendar(action.payload as any);
    }

    if (action.type === 'generate_designs') {
      return this.executeDesignGeneration(action.payload as any);
    }

    if (action.type === 'approve_candidate') {
      const { sessionId, candidateId } = action.payload as any;
      await this.approvalManager.approve(sessionId, candidateId);
      return { success: true };
    }

    if (action.type === 'reject_candidate') {
      const { sessionId, candidateId } = action.payload as any;
      await this.approvalManager.reject(sessionId, candidateId);
      return { success: true };
    }

    if (action.type === 'revise_candidate') {
      const { sessionId, candidateId, feedback } = action.payload as any;
      await this.approvalManager.revise(sessionId, candidateId, feedback);
      return { success: true };
    }

    return { success: true };
  }

  private async executeCalendar(p: { month: string; ideas: any[] }): Promise<ActionResult> {
    for (const idea of p.ideas) {
      await this.db.db.insert(contentIdeas).values({
        month: p.month,
        format: idea.format,
        hook: idea.hook,
        body: idea.body,
        cta: idea.cta,
        platform: idea.platform ?? null,
        brand: idea.brand ?? null,
      }).onConflictDoNothing();
    }
    await this.telegram.sendMessage(`Content calendar for ${p.month} saved — ${p.ideas.length} ideas ready for design.`);
    return { success: true, data: { month: p.month, count: p.ideas.length } };
  }

  private async executeDesignGeneration(p: {
    brief: any;
    plan: any;
    debugMode?: boolean;
    maxCostUsd?: number;
  }): Promise<ActionResult> {
    // T15: Aggregate candidates (parallel dispatch + dedup)
    const { sessionId, candidates } = await this.aggregator.run(p.plan, p.brief, p.debugMode);

    // T12: Send Telegram approval message with Edit in Canva links
    await this.approvalManager.sendApprovalMessage(sessionId, candidates);

    const successful = candidates.filter((c) => c.status !== 'failed');
    return {
      success: true,
      data: {
        sessionId,
        candidatesTotal: candidates.length,
        candidatesOk: successful.length,
        totalCostUsd: candidates.reduce((s, c) => s + c.costUsd, 0).toFixed(4),
      },
    };
  }

  mcpTools(): McpToolDefinition[] {
    return [
      {
        name: 'generate_calendar',
        description: 'Return content ideas for a given month',
        inputSchema: { type: 'object', properties: { month: { type: 'string' }, count: { type: 'number' } }, required: ['month'] },
        handler: async (input) => {
          const { month, count = 30 } = input as any;
          return this.db.db.select().from(contentIdeas).where(eq(contentIdeas.month, month)).limit(count);
        },
      },
      {
        name: 'draft_reel_script',
        description: 'LLM-draft a 30-second reel script from a content idea',
        inputSchema: { type: 'object', properties: { ideaId: { type: 'string' } }, required: ['ideaId'] },
        handler: async (input) => {
          const [idea] = await this.db.db.select().from(contentIdeas).where(eq(contentIdeas.id, (input as any).ideaId));
          if (!idea) return null;
          const config = await this.getConfig();
          const response = await this.llm.complete({
            messages: [
              { role: 'system', content: 'Write a short 30-second reel script. Hook (5 sec), body (20 sec), CTA (5 sec). No emojis. Just the script.' },
              { role: 'user', content: `Hook: ${idea.hook}\nBody: ${idea.body}\nCTA: ${idea.cta}` },
            ],
            ...agentLlmOpts(config),
            agentKey: this.key,
            maxTokens: 300,
          });
          return { ideaId: idea.id, script: response.content.trim() };
        },
      },
      {
        name: 'generate_design',
        description: 'Generate a design from a free-form concept brief',
        inputSchema: { type: 'object', properties: { concept: { type: 'string' }, brand: { type: 'string' } }, required: ['concept'] },
        handler: async (input) => {
          const { concept, brand } = input as any;
          const config = await this.getConfig();
          const fullConcept = brand ? `[${brand}] ${concept}` : concept;
          const brief = await this.conceptParser.parse(fullConcept, { debugMode: config.debugMode });
          const matched = this.skills.match(brief);
          const plan = this.planner.plan('mcp', brief, matched.map((s) => s.skill.name));
          const { sessionId, candidates } = await this.aggregator.run(plan, brief, config.debugMode);
          return { sessionId, candidates: candidates.map((c) => ({ id: c.id, status: c.status, backend: c.backend, canvaEditUrl: c.canvaEditUrl, filePath: c.filePath })) };
        },
      },
      {
        name: 'canva_verify',
        description: 'Verify the Canva MCP connection status',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => this.canvaMcp.verify(),
      },
      {
        name: 'list_brands',
        description: 'List all configured brand identities',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => this.brands.list(),
      },
    ];
  }

  apiRoutes(): AgentApiRoute[] {
    return [
      // Calendar routes (existing)
      {
        method: 'GET',
        path: '/canva/calendar/:month',
        requiresAuth: true,
        handler: async (body) => {
          const month = (body as any).month;
          return this.db.db.select().from(contentIdeas).where(eq(contentIdeas.month, month));
        },
      },
      // Design generation
      {
        method: 'POST',
        path: '/canva/generate',
        requiresAuth: true,
        handler: async (body) => {
          const { concept, brand } = body as any;
          if (!concept) return { error: 'concept is required' };
          const config = await this.getConfig();
          const fullConcept = brand ? `[${brand}] ${concept}` : concept;
          const brief = await this.conceptParser.parse(fullConcept, { debugMode: config.debugMode });
          const matched = this.skills.match(brief);
          const plan = this.planner.plan('api', brief, matched.map((s) => s.skill.name));
          const { sessionId, candidates } = await this.aggregator.run(plan, brief, config.debugMode);
          await this.approvalManager.sendApprovalMessage(sessionId, candidates);
          return {
            sessionId,
            brief,
            candidates: candidates.map((c) => ({
              id: c.id,
              status: c.status,
              backend: c.backend,
              canvaDesignId: c.canvaDesignId,
              canvaEditUrl: c.canvaEditUrl,
              filePath: c.filePath,
              thumbnailPath: c.thumbnailPath,
              costUsd: c.costUsd,
              rationale: c.rationale,
            })),
          };
        },
      },
      // Chat endpoint — routes concept or idea request
      {
        method: 'POST',
        path: '/canva/chat',
        requiresAuth: true,
        handler: async (body) => {
          const { message, brand, mode } = body as any;
          if (!message) return { error: 'message is required' };
          const config = await this.getConfig();

          if (mode === 'idea') {
            // Generate a single calendar idea for the given concept
            const prompt = `Generate ONE social media content idea for: "${message}"\nBrand: ${brand ?? config.brands[0]}\n\nReturn JSON: { "format": "...", "hook": "...", "body": "...", "cta": "...", "platform": "..." }`;
            const res = await this.llm.complete({
              messages: [{ role: 'user', content: prompt }],
              agentKey: this.key,
              maxTokens: 400,
            });
            try {
              const raw = res.content.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
              return { type: 'idea', idea: JSON.parse(raw) };
            } catch {
              return { type: 'idea', idea: { body: res.content.trim() } };
            }
          }

          // Default: generate design
          const fullConcept = brand ? `[${brand}] ${message}` : message;
          const brief = await this.conceptParser.parse(fullConcept, { debugMode: config.debugMode });
          const matched = this.skills.match(brief);
          const plan = this.planner.plan('chat', brief, matched.map((s) => s.skill.name));
          const { sessionId, candidates } = await this.aggregator.run(plan, brief, config.debugMode);
          await this.approvalManager.sendApprovalMessage(sessionId, candidates);

          return {
            type: 'design',
            sessionId,
            brief,
            candidates: candidates.map((c) => ({
              id: c.id,
              status: c.status,
              backend: c.backend,
              canvaDesignId: c.canvaDesignId,
              canvaEditUrl: c.canvaEditUrl,
              thumbnailPath: c.thumbnailPath,
              costUsd: c.costUsd,
              rationale: c.rationale,
              error: c.error,
            })),
          };
        },
      },
      // Session candidates
      {
        method: 'GET',
        path: '/canva/sessions/:id/candidates',
        requiresAuth: true,
        handler: async (body) => {
          const sessionId = (body as any).id;
          return this.approvalManager.listSessionCandidates(sessionId);
        },
      },
      // Session debug log (T27)
      {
        method: 'GET',
        path: '/canva/sessions/:id/debug',
        requiresAuth: true,
        handler: async (body) => {
          const sessionId = (body as any).id;
          return this.debug.getSessionLog(sessionId);
        },
      },
      // Candidate approve/reject/revise
      {
        method: 'POST',
        path: '/canva/candidates/:id/approve',
        requiresAuth: true,
        handler: async (body) => {
          const { id, sessionId } = body as any;
          await this.approvalManager.approve(sessionId, id);
          return { success: true };
        },
      },
      {
        method: 'POST',
        path: '/canva/candidates/:id/reject',
        requiresAuth: true,
        handler: async (body) => {
          const { id, sessionId } = body as any;
          await this.approvalManager.reject(sessionId, id);
          return { success: true };
        },
      },
      {
        method: 'POST',
        path: '/canva/candidates/:id/revise',
        requiresAuth: true,
        handler: async (body) => {
          const { id, sessionId, feedback } = body as any;
          await this.approvalManager.revise(sessionId, id, feedback);
          return { success: true };
        },
      },
      // Canva MCP verification (T1)
      {
        method: 'GET',
        path: '/canva/verify',
        requiresAuth: true,
        handler: async () => this.canvaMcp.verify(),
      },
      // Brand management (T29)
      {
        method: 'GET',
        path: '/canva/brands',
        requiresAuth: true,
        handler: async () => this.brands.list(),
      },
      {
        method: 'POST',
        path: '/canva/brands',
        requiresAuth: true,
        handler: async (body) => {
          const data = body as any;
          return this.brands.upsert(data);
        },
      },
      {
        method: 'PATCH',
        path: '/canva/brands/:name',
        requiresAuth: true,
        handler: async (body) => {
          const { name, ...data } = body as any;
          return this.brands.upsert({ name, ...data });
        },
      },
    ];
  }

  private async getConfig(): Promise<CanvaConfig> {
    const [row] = await this.db.db.select().from(agents).where(eq(agents.key, this.key));
    return { ...DEFAULT_CONFIG, ...(row?.config as Partial<CanvaConfig> ?? {}) };
  }
}
