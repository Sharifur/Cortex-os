import { Injectable, Logger } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import { eq, sql } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { StorageService } from '../storage/storage.service';
import { AgentLogService } from '../agents/runtime/agent-log.service';
import { postRenders } from './schema';
import { PostBrandService } from './post-brand.service';
import { PostContentService } from './post-content.service';
import { ThemeContractService } from './theme-contract.service';
import { ConsistencyValidator } from './consistency-validator';
import { ImageGenService } from './image-gen.service';
import { getFormat } from './post-format.registry';
import { centeredLayout } from './layouts/centered.layout';
import { leftAlignedLayout } from './layouts/left-aligned.layout';
import { splitPanelLayout } from './layouts/split-panel.layout';
import { overlayLayout } from './layouts/overlay.layout';
import { listLayout } from './layouts/list.layout';
import type { RenderRequest, RenderResult, FilledSlide, ThemeContract, LayoutType } from './types';

const LAYOUT_MAP: Record<LayoutType, (props: import('./layouts/layout.types').LayoutProps) => object> = {
  'centered': centeredLayout,
  'left-aligned': leftAlignedLayout,
  'split-panel': splitPanelLayout,
  'overlay': overlayLayout,
  'list-layout': listLayout,
};

@Injectable()
export class PostRendererService {
  private readonly logger = new Logger(PostRendererService.name);

  constructor(
    private readonly db: DbService,
    private readonly storage: StorageService,
    private readonly logSvc: AgentLogService,
    private readonly brandSvc: PostBrandService,
    private readonly contentSvc: PostContentService,
    private readonly themeSvc: ThemeContractService,
    private readonly validator: ConsistencyValidator,
    private readonly imageGen: ImageGenService,
  ) {}

  async render(req: RenderRequest, runId?: string): Promise<RenderResult> {
    const format = getFormat(req.formatId);
    if (!format) throw new Error(`Unknown format: ${req.formatId}`);

    await this.logSvc.info(runId ?? 'post-render',
      `Post render: ${format.name} for ${req.brand}`,
      { event_type: 'post_render_start', format_id: format.id, brand: req.brand, topic: req.topic, slide_count: format.slides.length },
    ).catch(() => {});

    // Resolve brand identity
    const brand = await this.brandSvc.resolve(req.brand);

    // Derive ThemeContract (locked for all slides)
    const contract = this.themeSvc.derive(brand, format);

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
      runId,
    });

    await this.logSvc.info(runId ?? 'post-render',
      `Content ready: ${filledSlides.length} slides filled`,
      { event_type: 'post_content_end', duration_ms: Date.now() - t0Content, slide_count: filledSlides.length },
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
          `Abstract minimal professional background for ${req.topic ?? 'business'}, brand colors, no text, no faces`;
        try {
          await this.logSvc.info(runId ?? 'post-render',
            `Image gen: ${req.imageProvider ?? 'auto'} — slide ${i + 1}`,
            { event_type: 'post_image_gen_start', provider: req.imageProvider ?? 'auto', slide_index: i },
          ).catch(() => {});
          const t0Img = Date.now();
          const { buffer, provider, model, estimatedCostUsd } = await this.imageGen.generate(imgPrompt, format.dimensions, req.imageProvider);
          if (buffer.length > 0) {
            backgroundImageBase64 = `data:image/png;base64,${buffer.toString('base64')}`;
          }
          await this.logSvc.info(runId ?? 'post-render',
            `Image ready: ${model} ${Date.now() - t0Img}ms ~$${estimatedCostUsd.toFixed(4)}`,
            { event_type: 'post_image_gen_end', provider, model, estimated_cost_usd: estimatedCostUsd, duration_ms: Date.now() - t0Img, size_bytes: buffer.length },
          ).catch(() => {});
        } catch (err) {
          this.logger.warn(`image gen failed for slide ${i}: ${(err as Error).message}`);
          await this.logSvc.warn(runId ?? 'post-render',
            `Image gen failed — using gradient background`,
            { event_type: 'post_image_gen_fallback', slide_index: i, error: (err as Error).message },
          ).catch(() => {});
        }
      }

      const pngBuffer = await this.renderSlide(slide, contract, format.dimensions, i + 1, backgroundImageBase64);

      await this.logSvc.debug(runId ?? 'post-render',
        `Slide ${i + 1} rendered: ${Math.round(pngBuffer.length / 1024)}KB PNG`,
        { event_type: 'post_render_slide_done', slide_index: i, size_bytes: pngBuffer.length, duration_ms: Date.now() - t0Slide },
      ).catch(() => {});

      // Upload to Minio
      const stored = await this.storage.upload({
        module: 'post-render',
        refKey: `${req.brand}/${format.id}`,
        body: pngBuffer,
        declaredMime: 'image/png',
        originalFilename: `slide-${i + 1}.png`,
      });
      slideUrls.push(stored.url);
    }

    // Persist render record
    const renderId = createId();
    const filledContent: Record<string, Record<string, string | string[]>> = {};
    for (const s of filledSlides) {
      filledContent[`slide_${s.slideIndex}`] = s.slots;
    }

    await this.db.db.execute(sql`
      INSERT INTO post_renders (id, format_id, brand, topic, intent, filled_content, slide_urls, status, created_at)
      VALUES (${renderId}, ${format.id}, ${req.brand}, ${req.topic ?? null}, ${req.intent ?? null},
              ${JSON.stringify(filledContent)}::jsonb, ${slideUrls}::text[], 'draft', NOW())
    `);

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

  private async renderSlide(
    slide: FilledSlide,
    contract: ThemeContract,
    dims: { width: number; height: number },
    slideNumber: number,
    backgroundImageBase64?: string,
  ): Promise<Buffer> {
    const satori = (await import('satori')).default;
    const { Resvg } = await import('@resvg/resvg-js');

    const layoutFn = LAYOUT_MAP[slide.layout] ?? centeredLayout;
    const jsxTree = layoutFn({ slide, contract, width: dims.width, height: dims.height, slideNumber, backgroundImageBase64 });

    const fonts: Array<{ name: string; data: ArrayBuffer; weight: 100|200|300|400|500|600|700|800|900; style: 'normal' | 'italic' }> = [
      { name: contract.headingFont, data: contract.headingFontData, weight: 700, style: 'normal' },
      { name: contract.bodyFont, data: contract.bodyFontData, weight: 400, style: 'normal' },
    ];
    // De-duplicate if heading/body are the same font
    const uniqueFonts = fonts.filter((f, i, arr) => arr.findIndex(x => x.name === f.name && x.weight === f.weight) === i);

    const svg = await satori(jsxTree as Parameters<typeof satori>[0], {
      width: dims.width,
      height: dims.height,
      fonts: uniqueFonts,
    });

    const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: dims.width } });
    return Buffer.from(resvg.render().asPng());
  }

  async getById(id: string): Promise<typeof postRenders.$inferSelect | null> {
    const [row] = await this.db.db.select().from(postRenders).where(eq(postRenders.id, id)).limit(1);
    return row ?? null;
  }

  async list(opts: { brand?: string; status?: string; limit?: number } = {}) {
    const limit = Math.min(opts.limit ?? 20, 100);
    const rows = await this.db.db.select().from(postRenders)
      .orderBy(sql`created_at DESC`)
      .limit(limit);
    return rows.filter(r => {
      if (opts.brand && r.brand !== opts.brand) return false;
      if (opts.status && r.status !== opts.status) return false;
      return true;
    });
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.db.db.update(postRenders).set({ status }).where(eq(postRenders.id, id));
  }
}
