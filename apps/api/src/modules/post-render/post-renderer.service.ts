import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { createId } from '@paralleldrive/cuid2';
import { eq, sql } from 'drizzle-orm';

const LOCAL_RENDERS_DIR = path.join(os.homedir(), 'Designs', 'AI-Agent', 'Renders');
import { DbService } from '../../db/db.service';
import { StorageService } from '../storage/storage.service';
import { AgentLogService } from '../agents/runtime/agent-log.service';
import { LlmUsageService } from '../llm/llm-usage.service';
import { postRenders } from './schema';
import { PostBrandService } from './post-brand.service';
import { PostContentService } from './post-content.service';
import { PostVisualService } from './post-visual.service';
import { ThemeContractService } from './theme-contract.service';
import { ConsistencyValidator } from './consistency-validator';
import { ImageGenService } from './image-gen.service';
import { DesignPatternService } from './design-pattern.service';
import { UnsplashService } from './unsplash.service';
import { getFormat } from './post-format.registry';
import { centeredLayout } from './layouts/centered.layout';
import { leftAlignedLayout } from './layouts/left-aligned.layout';
import { splitPanelLayout } from './layouts/split-panel.layout';
import { overlayLayout } from './layouts/overlay.layout';
import { listLayout } from './layouts/list.layout';
import type { RenderRequest, RenderResult, FilledSlide, ThemeContract, LayoutType, DominantDNA, SlideVisualSpec } from './types';

const LAYOUT_MAP: Record<LayoutType, (props: import('./layouts/layout.types').LayoutProps) => object> = {
  'centered': centeredLayout,
  'left-aligned': leftAlignedLayout,
  'split-panel': splitPanelLayout,
  'overlay': overlayLayout,
  'list-layout': listLayout,
};

// Compatible layout options per slide role — used for randomised layout selection
const ROLE_LAYOUT_POOL: Record<string, LayoutType[]> = {
  cover:   ['centered', 'left-aligned', 'overlay'],
  content: ['centered', 'left-aligned', 'split-panel'],
  stat:    ['split-panel', 'centered', 'left-aligned'],
  list:    ['list-layout', 'left-aligned'],
  cta:     ['centered', 'left-aligned', 'overlay'],
  quote:   ['centered', 'left-aligned'],
};

function pickLayout(role: string, dominant: LayoutType | undefined): LayoutType {
  const pool = ROLE_LAYOUT_POOL[role] ?? ['centered', 'left-aligned'];
  if (!dominant || !pool.includes(dominant)) {
    return pool[Math.floor(Math.random() * pool.length)];
  }
  // 60 % dominant, 40 % random pick from the rest
  if (Math.random() < 0.6) return dominant;
  const others = pool.filter(l => l !== dominant);
  return others.length ? others[Math.floor(Math.random() * others.length)] : dominant;
}

@Injectable()
export class PostRendererService {
  private readonly logger = new Logger(PostRendererService.name);

  constructor(
    private readonly db: DbService,
    private readonly storage: StorageService,
    private readonly logSvc: AgentLogService,
    private readonly usageSvc: LlmUsageService,
    private readonly brandSvc: PostBrandService,
    private readonly contentSvc: PostContentService,
    private readonly visualSvc: PostVisualService,
    private readonly themeSvc: ThemeContractService,
    private readonly validator: ConsistencyValidator,
    private readonly imageGen: ImageGenService,
    private readonly designPattern: DesignPatternService,
    private readonly unsplash: UnsplashService,
  ) {}

  async render(req: RenderRequest, runId?: string): Promise<RenderResult> {
    try {
      return await this._render(req, runId);
    } catch (err) {
      const e = err as Error;
      await this.logSvc.error(runId ?? 'post-render',
        `Render failed: ${e.message}`,
        { event_type: 'post_render_error', error: e.message, format_id: req.formatId, brand: req.brand },
      ).catch(() => {});
      throw err;
    }
  }

  private async _render(req: RenderRequest, runId?: string): Promise<RenderResult> {
    const format = getFormat(req.formatId);
    if (!format) throw new Error(`Unknown format: ${req.formatId}`);

    const renderId = createId();

    await this.logSvc.info(runId ?? 'post-render',
      `Post render: ${format.name} for ${req.brand}`,
      { event_type: 'post_render_start', format_id: format.id, brand: req.brand, topic: req.topic, slide_count: format.slides.length, render_id: renderId },
    ).catch(() => {});

    // Resolve brand identity and dominant design DNA in parallel
    const [brandRaw, dominantDNA, patternsBySlideType] = await Promise.all([
      this.brandSvc.resolve(req.brand),
      this.designPattern.getDominantDNA(req.brand).catch(() => null as DominantDNA | null),
      req.patternConsistency
        ? this.designPattern.getPatternsBySlideType(req.brand).catch(() => ({} as Record<string, string[]>))
        : Promise.resolve(null as Record<string, string[]> | null),
    ]);

    // Feature 3: apply learned font pairing when brand uses default Inter fonts
    const useLearned = !!(dominantDNA && dominantDNA.sampleCount >= 20);
    const brand = useLearned && dominantDNA!.font_style
      ? await this.brandSvc.applyFontDNA(brandRaw, dominantDNA!.font_style)
      : brandRaw;

    if (dominantDNA) {
      await this.logSvc.debug(runId ?? 'post-render',
        `Design DNA loaded: ${dominantDNA.sampleCount} samples — tone:${dominantDNA.content_tone} cta:${dominantDNA.cta_style} radius:${dominantDNA.border_radius_style} icons:${dominantDNA.icon_style} font:${dominantDNA.font_style}`,
        { event_type: 'post_dna_loaded', sample_count: dominantDNA.sampleCount, content_tone: dominantDNA.content_tone, cta_style: dominantDNA.cta_style, font_style: dominantDNA.font_style },
      ).catch(() => {});
    }

    // Derive ThemeContract (locked for all slides) — applies learned DNA
    const contract = this.themeSvc.derive(brand, format, dominantDNA);

    await this.logSvc.debug(runId ?? 'post-render',
      `Theme locked: ${contract.headingFont} accent:${contract.accentColor} bg:${contract.backgroundCover}`,
      { event_type: 'post_theme_derived', headingFont: contract.headingFont, accentColor: contract.accentColor, backgroundContent: contract.backgroundContent, headingSize: contract.headingSize },
    ).catch(() => {});

    // Generate content (AI fills slots)
    await this.logSvc.debug(runId ?? 'post-render',
      `Generating content: ${format.slides.reduce((sum, s) => sum + s.slots.length, 0)} slots across ${format.slides.length} slides`,
      { event_type: 'post_content_start', slot_count: format.slides.reduce((sum, s) => sum + s.slots.length, 0), format_id: format.id },
    ).catch(() => {});

    const t0Content = Date.now();
    const filledSlides = await this.contentSvc.fill(format, contract, {
      topic: req.topic,
      intent: req.intent,
      voiceProfile: brand.voiceProfile,
      contentTone: dominantDNA?.content_tone,
      moodKeywords: dominantDNA?.mood_keywords,
      patternRules: dominantDNA?.pattern_rules,
      patternsBySlideType: patternsBySlideType ?? undefined,
      designContext: dominantDNA?.banner_brief || undefined,
      runId,
    });

    // Feature 1: per-slide layout — 60 % dominant learned, 40 % random compatible variant
    for (const slide of filledSlides) {
      const dominant = useLearned ? dominantDNA!.slide_role_layouts?.[slide.role] : undefined;
      slide.layout = pickLayout(slide.role, dominant);
    }

    await this.logSvc.info(runId ?? 'post-render',
      `Content ready: ${filledSlides.length} slides filled`,
      { event_type: 'post_content_end', duration_ms: Date.now() - t0Content, slide_count: filledSlides.length },
    ).catch(() => {});

    // Phase 2: Generate per-slide visual specs from pattern rules
    const visualSpecs: SlideVisualSpec[] = dominantDNA?.pattern_rules?.length
      ? await this.visualSvc.generateSpecs(filledSlides, dominantDNA.pattern_rules, contract, { runId })
        .catch(() => [] as SlideVisualSpec[])
      : [];
    const visualSpecMap = new Map(visualSpecs.map(s => [s.slideIndex, s]));

    await this.logSvc.debug(runId ?? 'post-render',
      `Visual specs: ${visualSpecs.length} slides styled from ${dominantDNA?.pattern_rules?.length ?? 0} patterns`,
      { event_type: 'post_visual_specs', spec_count: visualSpecs.length },
    ).catch(() => {});

    // Consistency validation
    const validation = await this.validator.validate(filledSlides, contract);

    await this.logSvc.info(runId ?? 'post-render',
      `Consistency: ${validation.ok ? filledSlides.length : filledSlides.length - validation.errors.length}/${filledSlides.length} slides passed`,
      { event_type: 'post_consistency_check', passed: validation.ok, total: filledSlides.length, warnings: validation.warnings },
    ).catch(() => {});

    if (!validation.ok) {
      this.logger.warn(`Consistency errors: ${validation.errors.join('; ')}`);
    }

    // Render slides to PNG
    const slideUrls: string[] = [];
    const t0Upload = Date.now();
    const storageConfigured = await this.storage.isConfigured();
    if (!storageConfigured) {
      await fs.mkdir(path.join(LOCAL_RENDERS_DIR, renderId), { recursive: true });
    }

    await this.logSvc.debug(runId ?? 'post-render',
      `Uploading ${filledSlides.length} slides to storage`,
      { event_type: 'post_upload_start', slide_count: filledSlides.length },
    ).catch(() => {});

    for (let i = 0; i < filledSlides.length; i++) {
      const slide = filledSlides[i];
      const schema = format.slides[i];
      const t0Slide = Date.now();

      await this.logSvc.debug(runId ?? 'post-render',
        `Rendering slide ${i + 1}/${filledSlides.length}: ${slide.layout} layout`,
        { event_type: 'post_render_slide', slide_index: i, layout: slide.layout },
      ).catch(() => {});

      let backgroundImageBase64: string | undefined;
      if (schema.styleRules.backgroundType === 'ai-image') {
        const imgPrompt = (slide.slots['image_prompt'] as string | undefined) ??
          this._buildImagePrompt(req.topic, contract, dominantDNA);
        const t0Img = Date.now();

        // Try Unsplash first when the DNA suggests real photography
        const needsRealPhoto = dominantDNA?.photography_style &&
          dominantDNA.photography_style !== 'none' &&
          dominantDNA.illustration_style === 'none';

        let usedUnsplash = false;
        if (needsRealPhoto) {
          try {
            const unsplashConfigured = await this.unsplash.isConfigured();
            if (unsplashConfigured) {
              await this.logSvc.info(runId ?? 'post-render',
                `Unsplash photo: "${req.topic ?? 'business'}" style:${dominantDNA!.photography_style} — slide ${i + 1}`,
                { event_type: 'post_image_gen_start', provider: 'unsplash', slide_index: i },
              ).catch(() => {});
              const query = this._buildUnsplashQuery(req.topic, dominantDNA);
              const result = await this.unsplash.fetchAsBuffer(query, format.dimensions);
              if (result) {
                backgroundImageBase64 = `data:image/png;base64,${result.buffer.toString('base64')}`;
                usedUnsplash = true;
                await this.logSvc.info(runId ?? 'post-render',
                  `Unsplash photo ready: ${result.photo.id} by ${result.photo.user.name} — ${Date.now() - t0Img}ms`,
                  { event_type: 'post_image_gen_end', provider: 'unsplash', model: 'unsplash-photo', estimated_cost_usd: 0, duration_ms: Date.now() - t0Img, size_bytes: result.buffer.length },
                ).catch(() => {});
              }
            }
          } catch (err) {
            this.logger.warn(`Unsplash failed for slide ${i}, falling back to AI: ${(err as Error).message}`);
          }
        }

        // Fall back to AI image generation if Unsplash was not used
        if (!usedUnsplash) {
          try {
            await this.logSvc.info(runId ?? 'post-render',
              `Image gen: ${req.imageProvider ?? 'auto'} — slide ${i + 1}`,
              { event_type: 'post_image_gen_start', provider: req.imageProvider ?? 'auto', slide_index: i },
            ).catch(() => {});
            const { buffer, provider, model, estimatedCostUsd } = await this.imageGen.generate(imgPrompt, format.dimensions, req.imageProvider);
            if (buffer.length > 0) {
              backgroundImageBase64 = `data:image/png;base64,${buffer.toString('base64')}`;
            }
            await this.logSvc.info(runId ?? 'post-render',
              `Image ready: ${model} ${Date.now() - t0Img}ms ~$${estimatedCostUsd.toFixed(4)}`,
              { event_type: 'post_image_gen_end', provider, model, estimated_cost_usd: estimatedCostUsd, duration_ms: Date.now() - t0Img, size_bytes: buffer.length },
            ).catch(() => {});
            if (estimatedCostUsd > 0) {
              void this.usageSvc.record({
                runId: runId ?? null, agentKey: 'canva', provider, model,
                inputTokens: 0, outputTokens: 0, costUsdOverride: estimatedCostUsd,
              }).catch(() => {});
            }
          } catch (err) {
            this.logger.warn(`image gen failed for slide ${i}: ${(err as Error).message}`);
            await this.logSvc.warn(runId ?? 'post-render',
              `Image gen failed — using gradient background`,
              { event_type: 'post_image_gen_fallback', slide_index: i, error: (err as Error).message },
            ).catch(() => {});
          }
        }
      }

      const pngBuffer = await this.renderSlide(slide, contract, format.dimensions, i + 1, backgroundImageBase64, visualSpecMap.get(i));

      await this.logSvc.debug(runId ?? 'post-render',
        `Slide ${i + 1} rendered: ${Math.round(pngBuffer.length / 1024)}KB PNG`,
        { event_type: 'post_render_slide_done', slide_index: i, size_bytes: pngBuffer.length, duration_ms: Date.now() - t0Slide },
      ).catch(() => {});

      if (storageConfigured) {
        const stored = await this.storage.upload({
          module: 'post-render',
          refKey: `${req.brand}/${format.id}`,
          body: pngBuffer,
          declaredMime: 'image/png',
          originalFilename: `slide-${i + 1}.png`,
        });
        slideUrls.push(stored.url);
      } else {
        const localFile = path.join(LOCAL_RENDERS_DIR, renderId, `slide-${i + 1}.png`);
        await fs.writeFile(localFile, pngBuffer);
        slideUrls.push(`/posts/renders/${renderId}/slides/${i + 1}/png`);
        this.logger.warn(`Storage not configured — saved slide ${i + 1} locally: ${localFile}`);
      }
    }
    const filledContent: Record<string, Record<string, string | string[]>> = {};
    for (const s of filledSlides) {
      filledContent[`slide_${s.slideIndex}`] = s.slots;
    }

    await this.db.db.insert(postRenders).values({
      id: renderId,
      formatId: format.id,
      brand: req.brand,
      topic: req.topic ?? null,
      intent: req.intent ?? null,
      filledContent,
      slideUrls,
      status: 'draft',
    });

    const totalBytes = slideUrls.length * 1024; // approximate
    await this.logSvc.info(runId ?? 'post-render',
      `Render complete: ${slideUrls.length} slides uploaded`,
      { event_type: 'post_upload_done', render_id: renderId, duration_ms: Date.now() - t0Upload, total_bytes: totalBytes, slide_urls: slideUrls },
    ).catch(() => {});

    return {
      id: renderId,
      formatId: format.id,
      brand: req.brand,
      slideUrls,
      status: 'draft',
      filledContent,
      createdAt: new Date(),
    };
  }

  private _buildUnsplashQuery(topic: string | undefined, dna: DominantDNA | null): string {
    const parts: string[] = [];

    if (topic) parts.push(topic);

    if (dna?.photography_style && dna.photography_style !== 'none') {
      const styleKeywords: Record<string, string> = {
        lifestyle: 'lifestyle people',
        product: 'product minimal',
        abstract: 'abstract texture',
        corporate: 'business office professional',
        conceptual: 'creative concept',
        mockup: 'device mockup technology',
      };
      parts.push(styleKeywords[dna.photography_style] ?? dna.photography_style);
    }

    if (dna?.mood_keywords?.length) {
      parts.push(...dna.mood_keywords.slice(0, 2));
    }

    return parts.filter(Boolean).join(' ') || 'business professional';
  }

  private _buildImagePrompt(topic: string | undefined, contract: ThemeContract, dna: DominantDNA | null): string {
    const parts: string[] = [];

    // Subject from topic
    parts.push(`Background image for a social media post about "${topic ?? 'business'}"`);

    // Visual style from DNA
    if (dna?.photography_style && dna.photography_style !== 'none') {
      const styleMap: Record<string, string> = {
        lifestyle: 'lifestyle photography, candid and warm',
        product: 'clean product photography, studio lighting',
        abstract: 'abstract photography, artistic',
        corporate: 'corporate photography, professional setting',
        conceptual: 'conceptual photography, creative metaphor',
        mockup: 'device mockup, clean background',
      };
      parts.push(styleMap[dna.photography_style] ?? dna.photography_style);
    } else if (dna?.illustration_style && dna.illustration_style !== 'none') {
      const styleMap: Record<string, string> = {
        'vector-flat': 'flat vector illustration, clean shapes',
        'vector-3d': '3D vector illustration, depth and shadows',
        'hand-drawn': 'hand-drawn illustration style',
        isometric: 'isometric illustration, geometric 3D',
        'abstract-shape': 'abstract geometric shapes, minimal',
        'pattern-based': 'repeating geometric pattern, decorative',
        character: 'character illustration, friendly',
      };
      parts.push(styleMap[dna.illustration_style] ?? dna.illustration_style);
    } else {
      parts.push('abstract minimal background, geometric shapes');
    }

    // Background tone
    if (dna?.background_style) {
      if (dna.background_style.includes('dark')) parts.push('dark background');
      else if (dna.background_style.includes('light')) parts.push('light background');
      else if (dna.background_style === 'gradient-dark') parts.push('dark gradient background');
    }

    // Colors
    parts.push(`brand color palette: ${contract.accentColor}, ${contract.backgroundCover}`);

    // Mood
    if (dna?.mood_keywords?.length) {
      parts.push(dna.mood_keywords.slice(0, 3).join(', '));
    }

    // Constraints
    parts.push('no text, no logos, no faces, no watermarks, suitable as background');

    return parts.join('. ');
  }

  private async renderSlide(
    slide: FilledSlide,
    contract: ThemeContract,
    dims: { width: number; height: number },
    slideNumber: number,
    backgroundImageBase64?: string,
    visualSpec?: SlideVisualSpec,
  ): Promise<Buffer> {
    const satori = (await import('satori')).default;
    const { Resvg } = await import('@resvg/resvg-js');

    const layoutFn = LAYOUT_MAP[slide.layout] ?? centeredLayout;
    const jsxTree = layoutFn({ slide, contract, width: dims.width, height: dims.height, slideNumber, backgroundImageBase64, visualSpec });

    const fonts: Array<{ name: string; data: ArrayBuffer; weight: 100|200|300|400|500|600|700|800|900; style: 'normal' | 'italic' }> = [
      { name: contract.headingFont, data: contract.headingFontData, weight: 700, style: 'normal' },
      { name: contract.bodyFont, data: contract.bodyFontData, weight: 400, style: 'normal' },
    ];
    // De-duplicate if heading/body are the same font
    const uniqueFonts = fonts.filter((f, i, arr) => arr.findIndex(x => x.name === f.name && x.weight === f.weight) === i);

    let svg: string;
    try {
      svg = await satori(jsxTree as Parameters<typeof satori>[0], {
        width: dims.width,
        height: dims.height,
        fonts: uniqueFonts,
      });
    } catch (err) {
      const e = err as Error;
      this.logger.error(`satori crash on slide ${slideNumber}: ${e.message}\n${e.stack ?? ''}\njsxTree=${JSON.stringify(jsxTree).slice(0, 500)}`);
      throw err;
    }

    const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: dims.width } });
    return Buffer.from(resvg.render().asPng());
  }

  async getById(id: string): Promise<typeof postRenders.$inferSelect | null> {
    const [row] = await this.db.db.select().from(postRenders).where(eq(postRenders.id, id)).limit(1);
    return row ?? null;
  }

  async list(opts: { brand?: string; status?: string; limit?: number } = {}) {
    const limit = Math.min(opts.limit ?? 20, 100);
    try {
      const rows = await this.db.db.select().from(postRenders)
        .orderBy(sql`created_at DESC`)
        .limit(limit);
      return rows.filter(r => {
        if (opts.brand && r.brand !== opts.brand) return false;
        if (opts.status && r.status !== opts.status) return false;
        return true;
      });
    } catch (err) {
      this.logger.error(`postRenders SELECT failed — limit=${limit} brand=${opts.brand ?? '-'} status=${opts.status ?? '-'}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.db.db.update(postRenders).set({ status }).where(eq(postRenders.id, id));
  }
}
