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
import { PostRendererService } from '../../post-render/post-renderer.service';
import { DesignPatternService } from '../../post-render/design-pattern.service';
import { listFormats } from '../../post-render/post-format.registry';
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
  patternConsistency?: boolean;
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
  readonly name = 'Social Media Banner Design Agent';
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
    private readonly renderer: PostRendererService,
    private readonly designPattern: DesignPatternService,
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

    // Chat-sourced triggers: respond conversationally, never auto-generate a calendar
    if (payload?.source === 'chat' || (payload?.query && !taskMode)) {
      return {
        source: trigger,
        snapshot: { mode: 'chat', query: payload.query ?? '', history: payload.history ?? '', sampleId: payload.sampleId ?? null, config },
        followups: (run.context as AgentContext | null)?.followups ?? [],
      };
    }

    if (taskMode === 'generate_design') {
      return {
        source: trigger,
        snapshot: { mode: 'design', concept: payload.concept ?? '', config },
        followups: [],
      };
    }

    // Default: content calendar mode (CRON or explicit task trigger)
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

    if (snap.mode === 'chat') {
      return this.decideChat(snap.query, config, snap.history, snap.sampleId ?? undefined);
    }
    if (snap.mode === 'design') {
      return this.decideDesign(snap.concept, config);
    }
    return this.decideCalendar(snap.month, config, snap.existingCount);
  }

  private async decideChat(query: string, config: CanvaConfig, history?: string, sampleId?: string): Promise<ProposedAction[]> {
    if (!query?.trim()) {
      return [{ type: 'notify_result', summary: 'No query', payload: { message: 'What would you like help with?' }, riskLevel: 'low' }];
    }

    // Hard-coded render trigger: "generate a <format-id> for brand <brand> about "..."
    const renderMatch = query.match(
      /generate\s+an?\s+([\w-]+)\s+for\s+brand\s+(\w+)(?:\s+about\s+"([^"]+)")?(?:\s+intent\s+([\w\s]+))?/i,
    );
    if (renderMatch) {
      const formatId = renderMatch[1].toLowerCase();
      const brand = renderMatch[2].toLowerCase();
      const topic = renderMatch[3]?.trim() || undefined;
      const intent = renderMatch[4]?.trim() || undefined;
      const validFormats = new Set(listFormats().map(f => f.id));
      if (validFormats.has(formatId)) {
        return [{
          type: 'post_render',
          summary: `Render ${formatId} for ${brand}`,
          payload: { formatId, brand, topic, intent },
          riskLevel: 'low',
        }];
      }
    }

    const firstBrand = (config.brands?.[0] ?? 'taskip').toLowerCase();
    const trainingSamples = await this.designPattern.listSampleMeta(firstBrand).catch(() => [] as Array<{ id: string; title: string; thumbUrl?: string }>);

    const toneInstructions: Record<string, string> = {
      'bold-punchy':        'Bold punchy style — max 6 words per headline, heavy font weight, very high contrast backgrounds (dark or vivid), large corner decorations, 1-2 word highlights per slide.',
      'clean-minimal':      'Clean minimal style — generous whitespace, soft muted backgrounds, no decorations except a single thin accent bar, body text is the hero.',
      'warm-professional':  'Warm professional style — earthy or navy tones, rounded shapes, approachable body copy length (2-3 sentences), subtle circle decorations at corners.',
      'dark-dramatic':      'Dark dramatic style — very dark backgrounds (#0f0f0f or deep navy), vivid accent colors (electric blue, neon green, bright orange), large bold shapes, high-contrast text.',
      'energetic-colorful': 'Energetic colorful style — saturated backgrounds (yellow, coral, electric purple), white text, multiple overlapping shapes, bold decorations at every corner.',
    };

    const classifyPrompt = `You are classifying a chat message sent to a social media carousel design agent.

Available brands: taskip (project management SaaS), xgenious (premium WordPress/CodeIgniter themes)

Format ID mapping — match user's content type choice to the EXACT format ID:
  "Tips carousel" | "Tips (5 slides)" | "tips list"  → linkedin-tips-carousel
  "How-To guide" | "Step-by-step" | "how-to"         → linkedin-howto-carousel
  "Listicle" | "Numbered list" | "list"               → linkedin-list-carousel
  "Stat card" | "Single stat" | "data point"          → linkedin-stat-single
  "Quote card" | "testimonial" | "quote"              → linkedin-quote-single
  "Instagram" | "edu carousel"                        → instagram-carousel-edu
  "Infographic"                                       → generic-infographic
  "Checklist"                                         → generic-checklist

Visual tone ID mapping:
  "Bold & Punchy" | "bold" | "punchy"                → bold-punchy
  "Clean & Minimal" | "minimal" | "clean"            → clean-minimal
  "Warm & Professional" | "warm" | "professional"    → warm-professional
  "Dark & Dramatic" | "dark" | "dramatic"            → dark-dramatic
  "Bright & Colorful" | "colorful" | "vibrant"       → energetic-colorful

Recent conversation (last 6 messages, may be empty):
${history || '(no history)'}

Current user message: "${query}"

Return JSON only (no markdown):
{
  "intent": "design-generate" | "questions-answered" | "content-confirmed" | "style-selected" | "general-chat",
  "topic": "extracted content topic, else null",
  "brand": "taskip" | "xgenious" | null,
  "formatId": "exact format ID from the mapping above, or null",
  "visualTone": "bold-punchy" | "clean-minimal" | "warm-professional" | "dark-dramatic" | "energetic-colorful" | null,
  "audience": "target audience if mentioned, else null",
  "styleNumber": "number string if user picked a style reference (e.g. '2'), else null"
}

Rules:
- "design-generate": user wants to create a carousel/banner (even natural phrasing like "make a post about X")
- "questions-answered": agent asked clarifying questions about brand/tone/format AND user answered all three — NOT approving a content plan
- "content-confirmed": agent just showed a numbered slide content plan AND user approved it ("yes", "looks good", "ok", "proceed", "Looks good!", "confirm", "go ahead", "good")
- "style-selected": agent showed style thumbnails/numbered list AND user replied with a number or "random"
- "general-chat": advice, brainstorm, feedback, anything else`;

    let classification: { intent: string; topic?: string; brand?: string; formatId?: string; visualTone?: string; audience?: string; styleNumber?: string } = { intent: 'general-chat' };
    try {
      const classRes = await this.llm.complete({
        messages: [{ role: 'user', content: classifyPrompt }],
        agentKey: this.key,
        maxTokens: 200,
        temperature: 0.1,
      });
      const raw = classRes.content.replace(/```(?:json)?\s*/g, '').replace(/```/g, '').trim();
      classification = JSON.parse(raw);
    } catch { /* fall through to general-chat */ }

    // BRANCH A: user wants to generate
    if (classification.intent === 'design-generate') {
      const topic = classification.topic ?? query.trim();
      const validFormats = new Set(listFormats().map(f => f.id));
      const hasFormat = !!(classification.formatId && validFormats.has(classification.formatId));
      const hasBrand = !!classification.brand;

      // Full prompt (topic + format + brand given) → generate content draft first
      if (topic && hasFormat && hasBrand) {
        return this.generateContentDraft(
          topic,
          classification.formatId!,
          classification.brand!.toLowerCase(),
          classification.visualTone ?? 'bold-punchy',
          toneInstructions,
          config,
          trainingSamples,
        );
      }

      // Partial prompt — ask 3 clarifying questions
      const brands = (config.brands ?? ['taskip', 'xgenious']).join(' / ');
      const message = [
        `I'll create a social media design on: "${topic}"`,
        '',
        'Quick questions before I start:',
        '',
        `1. Brand — ${brands}?`,
        `2. Visual style — Bold & Punchy / Clean & Minimal / Warm & Professional / Dark & Dramatic / Bright & Colorful?`,
        `3. Content type — Tips (5 slides) / How-To Guide / Listicle / Stat Card / Quote Card?`,
        '',
        'Brand is optional — skip it to use the default brand.',
      ].join('\n');

      return [{ type: 'notify_result', summary: 'Clarifying questions', payload: { message, query }, riskLevel: 'low' }];
    }

    // BRANCH B: user answered clarifying questions → generate content draft for confirmation
    if (classification.intent === 'questions-answered') {
      const topic = classification.topic ?? '';
      const brand = (classification.brand ?? firstBrand).toLowerCase();
      const tone = classification.visualTone ?? 'bold-punchy';
      const validFormats = new Set(listFormats().map(f => f.id));
      const formatId = (classification.formatId && validFormats.has(classification.formatId))
        ? classification.formatId
        : 'linkedin-tips-carousel';

      return this.generateContentDraft(topic, formatId, brand, tone, toneInstructions, config, trainingSamples);
    }

    // BRANCH B1: user confirmed content → show style picker
    if (classification.intent === 'content-confirmed') {
      let formatId = 'linkedin-tips-carousel';
      let brand = firstBrand;
      let topic = '';
      let intentStr = '';
      let slides: Array<{ slideLabel?: string; headline: string; body?: string }> = [];

      const lastPendingIdx = (history ?? '').lastIndexOf('[pending:');
      if (lastPendingIdx !== -1) {
        const tail = (history ?? '').slice(lastPendingIdx);
        const m = tail.match(/^\[pending:(\{.+\})\]/);
        if (m) {
          try {
            const p = JSON.parse(m[1]) as { formatId?: string; brand?: string; topic?: string; intentStr?: string; slides?: Array<{ slideLabel?: string; headline: string; body?: string }> };
            if (p.formatId) formatId = p.formatId;
            if (p.brand) brand = p.brand;
            if (p.topic) topic = p.topic;
            if (p.intentStr) intentStr = p.intentStr;
            if (p.slides?.length) slides = p.slides;
          } catch { /* ignore */ }
        }
      }

      if (trainingSamples.length > 0) {
        const stylesPayload = JSON.stringify({
          samples: trainingSamples.map((s, i) => ({ num: String(i + 1), id: s.id, title: s.title || `Sample ${i + 1}`, thumb: s.thumbUrl ?? null })),
        });
        const msg = [
          `Content confirmed — now choose a layout style for "${topic || formatId}":`,
          '',
          'Choose a style reference:',
          `[styles:${stylesPayload}]`,
          `[pending:${JSON.stringify({ formatId, brand, topic, intentStr, slides })}]`,
        ].join('\n');
        return [{ type: 'notify_result', summary: 'Style selection', payload: { message: msg, query }, riskLevel: 'low' }];
      }

      // No training samples — render directly with the confirmed content
      const exactContentIntent = slides.length
        ? `Use EXACTLY these slide headlines and bodies:\n${slides.map((s, i) => `Slide ${i + 1}: headline="${s.headline}"${s.body ? `, body="${s.body}"` : ''}`).join('\n')}\n\n${intentStr}`
        : intentStr;
      return [{
        type: 'post_render',
        summary: `Render ${formatId} for ${brand}`,
        payload: { formatId, brand, topic, intent: exactContentIntent || undefined, sampleId: sampleId || undefined },
        riskLevel: 'low',
      }];
    }

    // BRANCH B2: user picked a style → extract confirmed content from history and fire render
    if (classification.intent === 'style-selected') {
      const styleNum = parseInt(classification.styleNumber ?? '0', 10);
      const pickedSample = styleNum > 0 ? (trainingSamples[styleNum - 1] ?? null) : null;
      const resolvedSampleId = pickedSample?.id ?? sampleId ?? undefined;

      let pendingFormatId = 'linkedin-tips-carousel';
      let pendingBrand = firstBrand;
      let pendingTopic = '';
      let pendingIntentStr = '';
      let pendingSlides: Array<{ slideLabel?: string; headline: string; body?: string }> = [];

      const lastPendingIdx = (history ?? '').lastIndexOf('[pending:');
      if (lastPendingIdx !== -1) {
        const tail = (history ?? '').slice(lastPendingIdx);
        const m = tail.match(/^\[pending:(\{.+\})\]/);
        if (m) {
          try {
            const p = JSON.parse(m[1]) as { formatId?: string; brand?: string; topic?: string; intentStr?: string; slides?: Array<{ slideLabel?: string; headline: string; body?: string }> };
            if (p.formatId) pendingFormatId = p.formatId;
            if (p.brand) pendingBrand = p.brand;
            if (p.topic) pendingTopic = p.topic;
            if (p.intentStr) pendingIntentStr = p.intentStr;
            if (p.slides?.length) pendingSlides = p.slides;
          } catch { /* ignore */ }
        }
      }

      const exactContentPrefix = pendingSlides.length
        ? `Use EXACTLY these slide headlines and bodies (do not change them):\n${pendingSlides.map((s, i) => `Slide ${i + 1}: headline="${s.headline}"${s.body ? `, body="${s.body}"` : ''}`).join('\n')}\n\n`
        : '';
      const fullIntent = exactContentPrefix + pendingIntentStr;

      return [{
        type: 'post_render',
        summary: `Render ${pendingFormatId} for ${pendingBrand}${pickedSample ? ` (style: ${pickedSample.title})` : ''}`,
        payload: {
          formatId: pendingFormatId,
          brand: pendingBrand,
          topic: pendingTopic,
          intent: fullIntent || undefined,
          sampleId: resolvedSampleId,
        },
        riskLevel: 'low',
      }];
    }

    // BRANCH C: general chat — conversational response
    const systemPrompt = `You are a social media design assistant for Sharifur Rahman, founder of Taskip and Xgenious.
You help with: design prompts, content ideas, carousel layouts, caption writing, platform-specific advice, and content strategy.
Be concise and practical. No filler. No emojis.`;

    try {
      const result = await this.llm.complete({
        messages: [
          { role: 'system', content: systemPrompt },
          ...(history ? [{ role: 'user' as const, content: `Conversation so far:\n${history}` }] : []),
          { role: 'user', content: query },
        ],
        ...agentLlmOpts(config),
        agentKey: this.key,
        maxTokens: 800,
        temperature: 0.4,
      });
      return [{ type: 'notify_result', summary: 'Chat response', payload: { message: result.content.trim(), query }, riskLevel: 'low' }];
    } catch (err) {
      return [{ type: 'notify_result', summary: 'Chat response', payload: { message: `Error: ${(err as Error).message}`, query }, riskLevel: 'low' }];
    }
  }

  private async generateContentDraft(
    topic: string,
    formatId: string,
    brand: string,
    tone: string,
    toneInstructions: Record<string, string>,
    config: CanvaConfig,
    trainingSamples: Array<{ id: string; title: string; thumbUrl?: string }>,
  ): Promise<ProposedAction[]> {
    const intentStr = toneInstructions[tone] ?? toneInstructions['bold-punchy'];
    const brandDesc = brand === 'xgenious'
      ? 'Xgenious (premium WordPress/CodeIgniter themes and scripts)'
      : 'Taskip (project management SaaS for teams)';

    const slideCountMap: Record<string, number> = {
      'linkedin-tips-carousel': 5,
      'linkedin-howto-carousel': 6,
      'linkedin-list-carousel': 5,
      'linkedin-stat-single': 2,
      'linkedin-quote-single': 1,
      'instagram-carousel-edu': 6,
      'generic-infographic': 4,
      'generic-checklist': 5,
    };
    const slideCount = slideCountMap[formatId] ?? 5;

    const draftPrompt = `You are a social media copywriter for ${brandDesc}.

Write a ${slideCount}-slide ${formatId} about: "${topic}"
Visual tone: ${intentStr}

Return ONLY valid JSON (no markdown):
{
  "slides": [
    { "slideLabel": "Cover", "headline": "hook headline max 8 words", "body": "" },
    { "slideLabel": "Point 1", "headline": "...", "body": "1-2 sentences" },
    { "slideLabel": "CTA", "headline": "call-to-action max 8 words", "body": "" }
  ]
}

Rules:
- Exactly ${slideCount} slides
- First slide: powerful hook headline, leave body empty
- Middle slides: one concrete idea per slide, specific and actionable
- Last slide: CTA pointing to ${brand}
- No emojis
- Headlines max 8 words`;

    let slides: Array<{ slideLabel?: string; headline: string; body?: string }> = [];
    try {
      const res = await this.llm.complete({
        messages: [{ role: 'user', content: draftPrompt }],
        agentKey: this.key,
        maxTokens: 1000,
        temperature: 0.5,
      });
      const raw = res.content.replace(/```(?:json)?\s*/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(raw) as { slides?: Array<{ slideLabel?: string; headline: string; body?: string }> };
      slides = parsed.slides ?? [];
    } catch {
      slides = Array.from({ length: slideCount }, (_, i) => ({
        slideLabel: i === 0 ? 'Cover' : i === slideCount - 1 ? 'CTA' : `Point ${i}`,
        headline: i === 0 ? topic : i === slideCount - 1 ? `Try ${brand} today` : `Key insight ${i}`,
        body: '',
      }));
    }

    const slideDisplay = slides.map((s, i) => {
      const label = s.slideLabel ? ` (${s.slideLabel})` : '';
      const lines = [`Slide ${i + 1}${label}: "${s.headline}"`];
      if (s.body?.trim()) lines.push(`  ${s.body.trim()}`);
      return lines.join('\n');
    }).join('\n\n');

    const pendingJson = JSON.stringify({ formatId, brand, topic, intentStr, slides });

    const msg = [
      `Here is the content plan for your ${formatId}:`,
      `Topic: "${topic}" | Brand: ${brand}`,
      '',
      slideDisplay,
      '',
      'Quick questions before I start:',
      '',
      '1. Content — Looks good! / Revise it?',
      '',
      `[pending:${pendingJson}]`,
    ].join('\n');

    return [{ type: 'notify_result', summary: 'Content draft', payload: { message: msg, query: topic }, riskLevel: 'low' }];
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
      const backend = await this.canvaMcp.resolveBackend();
      const plan = this.planner.plan('pending', brief, skillNames, backend);

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
    if (action.type === 'notify_result') return { success: true, data: { message: (action.payload as any).message } };

    if (action.type === 'approve_calendar_batch') {
      return this.executeCalendar(action.payload as any);
    }

    if (action.type === 'generate_designs') {
      return this.executeDesignGeneration(action.payload as any);
    }

    if (action.type === 'post_render') {
      const { formatId, brand, topic, intent, sampleId, _runId } = action.payload as any;
      try {
        const config = await this.getConfig();
        const result = await this.renderer.render({ formatId, brand, topic, intent, sampleId: sampleId || undefined, patternConsistency: config.patternConsistency }, _runId as string | undefined);
        const slideList = result.slideUrls.map((u, i) => `Slide ${i + 1}: ${u}`).join('\n');
        const message = `Render complete — ${result.slideUrls.length} slides generated\n\n${slideList}\n\nExports:\nPPTX (Canva layers): /posts/renders/${result.id}/pptx\nCSV (Bulk Create): /posts/renders/${result.id}/canva-csv\nPlain text: /posts/renders/${result.id}/text-export`;
        return { success: true, data: { message, slideUrls: result.slideUrls, renderId: result.id } };
      } catch (err) {
        const e = err as Error;
        this.logger.error(`post_render failed: ${e.message}\n${e.stack ?? ''}`);
        return { success: true, data: { message: `Render failed: ${e.message}` } };
      }
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
          const backend = await this.canvaMcp.resolveBackend();
          const plan = this.planner.plan('mcp', brief, matched.map((s) => s.skill.name), backend);
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
          const backend = await this.canvaMcp.resolveBackend();
          const plan = this.planner.plan('api', brief, matched.map((s) => s.skill.name), backend);
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
          const backend = await this.canvaMcp.resolveBackend();
          const plan = this.planner.plan('chat', brief, matched.map((s) => s.skill.name), backend);
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
      // Brand management (T29) — static paths before :name param routes
      {
        method: 'GET',
        path: '/canva/brands',
        requiresAuth: true,
        handler: async () => this.brands.list(),
      },
      {
        method: 'POST',
        path: '/canva/brands/import-from-url',
        requiresAuth: true,
        handler: async (body) => {
          const { url } = body as any;
          if (!url) throw new Error('url is required');
          return this.importBrandFromUrl(url);
        },
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
      {
        method: 'DELETE',
        path: '/canva/brands/:name',
        requiresAuth: true,
        handler: async (body) => {
          const { name } = body as any;
          await this.brands.delete(name);
          return { ok: true };
        },
      },
      // Candidate thumbnail — serves PNG bytes for ai_image candidates
      {
        method: 'GET',
        path: '/canva/thumbnail/:id',
        requiresAuth: false,
        handler: async (body, reply) => {
          const { id } = body as any;
          const rows = await this.db.db
            .select({ thumbnailPath: canvaCandidates.thumbnailPath, filePath: canvaCandidates.filePath })
            .from(canvaCandidates)
            .where(eq(canvaCandidates.id, id))
            .limit(1);
          const row = rows[0];
          if (!row) { (reply as any).code(404).send({ error: 'not found' }); return; }
          const imgPath = row.thumbnailPath ?? row.filePath;
          if (!imgPath) { (reply as any).code(404).send({ error: 'no image' }); return; }
          const { readFile } = await import('fs/promises');
          try {
            const bytes = await readFile(imgPath);
            (reply as any).header('Content-Type', 'image/png').send(bytes);
          } catch {
            (reply as any).code(404).send({ error: 'file not found' });
          }
        },
      },
    ];
  }

  private async importBrandFromUrl(url: string): Promise<{
    displayName: string | null;
    voiceProfile: string | null;
    palette: string[];
    fonts: string[];
  }> {
    const cheerio = await import('cheerio');
    const axios = (await import('axios')).default;

    const res = await axios.get(url, {
      timeout: 10_000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CortexBot/1.0)' },
      maxRedirects: 5,
    });
    const $ = cheerio.load(res.data as string);

    const displayName =
      $('meta[property="og:site_name"]').attr('content') ||
      $('meta[name="application-name"]').attr('content') ||
      $('title').text().split(/[-|]/)[0]?.trim() ||
      null;

    const descriptionText =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      '';

    // Extract hex colors from inline styles and CSS
    const colorSet = new Set<string>();
    const hexRe = /#([0-9a-fA-F]{6})\b/g;
    const html = res.data as string;
    let m: RegExpExecArray | null;
    // eslint-disable-next-line no-cond-assign
    while ((m = hexRe.exec(html)) !== null) {
      colorSet.add(`#${m[1].toLowerCase()}`);
      if (colorSet.size >= 6) break;
    }

    // Extract fonts from Google Fonts CDN links
    const fontSet = new Set<string>();
    $('link[href*="fonts.googleapis.com"]').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      const match = href.match(/family=([^&:]+)/);
      if (match) {
        match[1].split('|').forEach((f) => fontSet.add(decodeURIComponent(f.replace(/\+/g, ' '))));
      }
    });

    let voiceProfile: string | null = null;
    if (descriptionText) {
      const llmRes = await this.llm.complete({
        messages: [
          { role: 'system', content: 'You extract brand voice profiles. Given a website description, write 1-2 sentences describing the brand tone, audience, and personality. Be concise and specific.' },
          { role: 'user', content: `Website: ${url}\nDescription: ${descriptionText}\n\nWrite a voice profile:` },
        ],
        agentKey: this.key,
        maxTokens: 120,
      });
      voiceProfile = llmRes.content.trim();
    }

    return {
      displayName,
      voiceProfile,
      palette: [...colorSet].slice(0, 5),
      fonts: [...fontSet].slice(0, 3),
    };
  }

  private async getConfig(): Promise<CanvaConfig> {
    const [row] = await this.db.db.select().from(agents).where(eq(agents.key, this.key));
    return { ...DEFAULT_CONFIG, ...(row?.config as Partial<CanvaConfig> ?? {}) };
  }
}
