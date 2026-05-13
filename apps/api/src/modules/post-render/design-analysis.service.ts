import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { createId } from '@paralleldrive/cuid2';
import { and, eq, like, sql } from 'drizzle-orm';
import { LlmRouterService } from '../llm/llm-router.service';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';
import { StorageService } from '../storage/storage.service';
import { DbService } from '../../db/db.service';
import { knowledgeEntries } from '../knowledge-base/schema';
import type { DesignDNA } from './types';

const LOCAL_SAMPLES_DIR = path.join(os.homedir(), 'Designs', 'AI-Agent', 'DesignSamples');

const DNA_PROMPT = `You are an expert design analyst. Study every pixel of this image and extract a complete design DNA. Return ONLY valid JSON — no markdown fences, no explanation.

Use exactly this JSON structure (choose the closest enum value where applicable):

{
  "layout_type": "centered|left-aligned|split-panel|overlay|grid|diagonal|asymmetric",
  "composition": "rule-of-thirds|center-weighted|edge-anchored|full-bleed|diagonal|Z-pattern",
  "text_alignment": "left|center|right|mixed",
  "whitespace": "generous|moderate|tight",
  "element_density": "minimal|moderate|rich",
  "visual_hierarchy": ["list every visual zone top-to-bottom, e.g. logo, eyebrow-label, headline, subtext, icon-row, cta-button, brand-bar"],
  "text_layers_count": "single|two|three-plus",

  "primary_color": "#hexcode — dominant background or fill color",
  "accent_color": "#hexcode — strongest contrast or call-to-action color",
  "secondary_colors": ["#hex — every other distinct color visible, empty array if none"],
  "color_count": "monochrome|duotone|tricolor|full-palette",
  "background_style": "solid-light|solid-dark|gradient-dark|gradient-light|textured|photo|illustrated",
  "background_image_used": true or false,
  "background_texture": "none|grain|noise|grid|dots|lines|organic|geometric-pattern",

  "font_weight_heading": "thin|regular|medium|semibold|bold|black|extrabold",
  "font_size_heading": "small|medium|large|xlarge|huge|display",
  "font_style": "modern-sans|classic-serif|geometric|rounded|slab-serif|monospace|display",
  "body_font_style": "modern-sans|classic-serif|geometric|rounded",
  "number_stat_style": "none|large-display-number|badge|inline-text",

  "icon_style": "none|flat-filled|flat-outlined|duotone|gradient|hand-drawn|emoji|custom-illustration",
  "icon_count": "none|single|few-2-4|many-5-plus",
  "icon_size": "none|small-inline|medium-decorative|large-hero",

  "illustration_style": "none|vector-flat|vector-3d|hand-drawn|isometric|abstract-shape|pattern-based|character",
  "photography_style": "none|lifestyle|product|abstract|corporate|conceptual|mockup",

  "decoration_elements": ["list every decorative shape/element visible: circles, geometric-shapes, gradient-blobs, confetti, lines, dots-grid, wave, divider-bar, noise-texture — use 'none' if absent"],
  "accent_elements": ["visible structural accents: top-bar, bottom-bar, left-stripe, right-stripe, underline, badge, quote-mark, number-label, corner-shape — use 'none' if absent"],
  "border_radius_style": "sharp|slightly-rounded|rounded|pill",
  "shadow_usage": "none|subtle-text|card-shadow|dramatic",
  "divider_style": "none|line|gradient-line|space-only",

  "logo_placement": "none|top-left|top-right|bottom-left|bottom-right|center",
  "brand_bar": "none|top|bottom|left|right",
  "cta_style": "none|pill-button|flat-button|outlined-button|text-link|arrow-link",

  "slide_type": "cover|content|cta|quote|stat|list|testimonial",
  "content_tone": "formal|casual|punchy|educational|inspirational|promotional",
  "mood_keywords": ["3–6 single words describing the visual feel, e.g. bold, premium, clean, energetic"],
  "platform_fit": ["linkedin", "instagram", "twitter", "facebook"],

  "shape_elements": [
    {
      "shape_type": "circle|ellipse|rectangle|rounded-rect|polygon|diagonal-cut|wave|blob|ring|arc|custom-path",
      "fill_type": "solid|linear-gradient|radial-gradient|none",
      "fill_colors": ["#hex"],
      "gradient_angle": 135,
      "stroke_color": "#hex or omit",
      "stroke_width": 2,
      "opacity": 0.15,
      "x": 60, "y": 0, "w": 40, "h": 40,
      "border_radius": 50,
      "svg_hint": "Large semi-transparent circle at top-right, accent color, decorative only"
    }
  ],
  "grid_columns": 1,
  "content_zone": { "x": 5, "y": 10, "w": 90, "h": 80 },
  "element_positions": [
    {
      "name": "logo",
      "type": "logo",
      "x": 5, "y": 5, "w": 20, "h": 8,
      "align": "left",
      "z_layer": "foreground"
    },
    {
      "name": "headline",
      "type": "text",
      "x": 5, "y": 30, "w": 90, "h": 18,
      "align": "left",
      "z_layer": "foreground"
    }
  ],

  "typography": {
    "heading_case": "uppercase|title-case|sentence-case|mixed",
    "heading_letter_spacing": "tight|normal|wide|very-wide",
    "heading_line_height": "tight|normal|relaxed",
    "heading_word_count_typical": "1-3|4-6|7-10|10+",
    "uses_eyebrow_label": true or false,
    "eyebrow_style": "none|uppercase-small-caps|colored-label|outlined-tag",
    "body_present": true or false,
    "body_line_count_typical": "1|2-3|4-6|block",
    "font_mix": "single-font|two-fonts|three-plus-fonts",
    "heading_estimated_size_px": 72,
    "body_estimated_size_px": 18,
    "uses_highlight_text": true or false,
    "highlight_style": "none|colored-word|underline|background-highlight|bold-word"
  },

  "spacing": {
    "outer_padding_style": "tight-5|medium-8|comfortable-10|generous-12-plus",
    "headline_to_body_gap": "tight|medium|large",
    "element_vertical_rhythm": "tight|even|spacious",
    "cta_margin_top": "tight|medium|large",
    "logo_margin": "flush|small|medium|large"
  },

  "color_usage": {
    "background_hex": "#hex — exact background color",
    "headline_text_hex": "#hex — exact headline text color",
    "body_text_hex": "#hex — body text color, omit if same as headline",
    "cta_background_hex": "#hex — CTA button fill, omit if no CTA",
    "cta_text_hex": "#hex — CTA text color, omit if no CTA",
    "accent_bar_hex": "#hex — color of any accent stripe/bar, omit if none",
    "icon_color_hex": "#hex — icon color, omit if no icons"
  },

  "text_content_pattern": {
    "headline_starts_with": "number|question|verb|noun|adjective|proper-noun",
    "uses_brand_name_in_headline": true or false,
    "has_social_handle": true or false,
    "has_url": true or false,
    "has_tagline": true or false,
    "has_copyright": true or false
  },

  "pattern_notes": "Two to three concise sentences describing any unique or notable design details not captured by the fields above — pay special attention to spacing rhythms, color combinations, and typography choices. Empty string if nothing notable."
}

Rules for shape_elements:
- List every distinct decorative or structural shape: background blobs, corner circles, diagonal cuts, waves, stripes, rings, etc.
- Ignore pure text elements — only capture actual shapes and graphic elements.
- fill_colors: for gradients list [start_color, end_color]; for solid list [color].
- svg_hint: write enough to reconstruct the shape programmatically — mention position (e.g. top-right corner), approximate size relative to canvas, color, opacity, and any notable property like whether it's clipped/masked.
- Empty array if there are no decorative shapes.

Rules for element_positions:
- List EVERY distinct visual element you can see: logo, eyebrow-label, headline, subheadline, body-text, icon (one entry per icon grouping), cta-button, brand-bar, left-stripe, top-bar, background-shape, decoration-circle, photo, illustration, stat-number, stat-label, list-item-group, quote-text, attribution-text, slide-number, divider.
- x, y, w, h are ALL percentages of the canvas dimensions (0–100). Estimate carefully by looking at where the element starts and ends relative to the full canvas edges.
- z_layer: background = behind content, mid = between bg and text, foreground = top-most layer.
- grid_columns: count the number of equal columns the layout uses (1 for single-column, 2 for side-by-side, 3 for 3-column grid, etc.)
- content_zone: the bounding box of the main content area, excluding any full-bleed backgrounds.`;

@Injectable()
export class DesignAnalysisService {
  private readonly logger = new Logger(DesignAnalysisService.name);

  constructor(
    private readonly llm: LlmRouterService,
    private readonly kb: KnowledgeBaseService,
    private readonly storage: StorageService,
    private readonly db: DbService,
  ) {}

  async analyzeAndStore(
    imageBuffer: Buffer,
    opts: { brand: string; filename: string },
  ): Promise<{ dna: DesignDNA; kbEntryId: string; storageUrl: string }> {
    // Upload sample image to storage, fall back to local disk when R2 is not configured
    let storageResult: { url: string };
    const isConfigured = await this.storage.isConfigured();
    if (isConfigured) {
      storageResult = await this.storage.upload({
        module: 'post-render/design-samples',
        refKey: opts.brand,
        body: imageBuffer,
        declaredMime: 'image/png',
        originalFilename: opts.filename,
      });
    } else {
      const dir = path.join(LOCAL_SAMPLES_DIR, opts.brand);
      await fs.mkdir(dir, { recursive: true });
      const ext = path.extname(opts.filename) || '.png';
      const localFile = path.join(dir, `${createId()}${ext}`);
      await fs.writeFile(localFile, imageBuffer);
      storageResult = { url: `local://${localFile}` };
      this.logger.warn(`Storage not configured — saved design sample locally: ${localFile}`);
    }

    // Extract DNA via vision LLM
    const imageBase64 = imageBuffer.toString('base64');
    const res = await this.llm.complete({
      messages: [
        { role: 'user', content: DNA_PROMPT },
      ],
      imageBase64,
      imageMimeType: 'image/png',
      maxTokens: 2000,
      temperature: 0.1,
      agentKey: 'canva',
    });

    let dna: DesignDNA;
    try {
      const jsonMatch = res.content.match(/```(?:json)?\s*([\s\S]+?)\s*```/) ?? res.content.match(/(\{[\s\S]+\})/);
      dna = JSON.parse(jsonMatch?.[1] ?? res.content);
    } catch {
      throw new Error(`Vision LLM returned invalid JSON for design DNA`);
    }

    // Build KB entry content
    const embeddingText = [
      dna.layout_type,
      dna.composition,
      dna.font_style,
      dna.icon_style,
      dna.illustration_style,
      dna.photography_style,
      dna.content_tone,
      ...dna.mood_keywords,
      dna.slide_type,
      ...dna.platform_fit,
      ...dna.visual_hierarchy,
      dna.whitespace,
      dna.background_style,
      dna.cta_style,
      dna.border_radius_style,
      ...(dna.decoration_elements ?? []),
      ...(dna.accent_elements ?? []),
    ].filter(Boolean).join(' ');

    const content = [
      `Design Sample Analysis`,
      ``,
      `-- Layout & Composition --`,
      `Layout: ${dna.layout_type}`,
      `Composition: ${dna.composition}`,
      `Text alignment: ${dna.text_alignment}`,
      `Whitespace: ${dna.whitespace}`,
      `Element density: ${dna.element_density}`,
      `Text layers: ${dna.text_layers_count}`,
      `Visual hierarchy (top to bottom): ${dna.visual_hierarchy.join(' > ')}`,
      ``,
      `-- Color --`,
      `Background: ${dna.background_style}${dna.background_image_used ? ' (photo/image used)' : ''}`,
      `Background texture: ${dna.background_texture}`,
      `Primary color: ${dna.primary_color}`,
      `Accent color: ${dna.accent_color}`,
      `Secondary colors: ${(dna.secondary_colors ?? []).join(', ') || 'none'}`,
      `Color palette: ${dna.color_count}`,
      ``,
      `-- Typography --`,
      `Heading: ${dna.font_weight_heading} weight, ${dna.font_size_heading} size, ${dna.font_style} style`,
      `Body: ${dna.body_font_style} style`,
      `Stat/number display: ${dna.number_stat_style}`,
      ``,
      `-- Icons --`,
      `Icon style: ${dna.icon_style}`,
      `Icon count: ${dna.icon_count}`,
      `Icon size: ${dna.icon_size}`,
      ``,
      `-- Illustrations & Photography --`,
      `Illustration style: ${dna.illustration_style}`,
      `Photography style: ${dna.photography_style}`,
      ``,
      `-- Decoration & Visual Details --`,
      `Decoration elements: ${(dna.decoration_elements ?? []).join(', ')}`,
      `Accent elements: ${(dna.accent_elements ?? []).join(', ')}`,
      `Border radius: ${dna.border_radius_style}`,
      `Shadows: ${dna.shadow_usage}`,
      `Divider: ${dna.divider_style}`,
      ``,
      `-- Branding & Structure --`,
      `Logo placement: ${dna.logo_placement}`,
      `Brand bar: ${dna.brand_bar}`,
      `CTA style: ${dna.cta_style}`,
      ``,
      `-- Content & Tone --`,
      `Slide type: ${dna.slide_type}`,
      `Content tone: ${dna.content_tone}`,
      `Mood: ${dna.mood_keywords.join(', ')}`,
      `Platform fit: ${dna.platform_fit.join(', ')}`,
      ``,
      `-- Spatial Layout --`,
      `Grid columns: ${dna.grid_columns ?? 1}`,
      `Content zone: x=${dna.content_zone?.x}% y=${dna.content_zone?.y}% w=${dna.content_zone?.w}% h=${dna.content_zone?.h}%`,
      `Elements (${(dna.element_positions ?? []).length}): ${(dna.element_positions ?? []).map(e => `${e.name}[${e.type}] x=${e.x}% y=${e.y}% w=${e.w}% h=${e.h}% ${e.align} ${e.z_layer}`).join(' | ')}`,
      ``,
      `-- Shape Elements (${(dna.shape_elements ?? []).length}) --`,
      ...(dna.shape_elements ?? []).map(s =>
        `${s.shape_type} fill:${s.fill_type}(${s.fill_colors.join('->')}) opacity:${s.opacity} x:${s.x}% y:${s.y}% w:${s.w}% h:${s.h}%${s.gradient_angle != null ? ` angle:${s.gradient_angle}deg` : ''}${s.border_radius != null ? ` r:${s.border_radius}%` : ''} — ${s.svg_hint}`
      ),
      ...(dna.pattern_notes ? [``, `Notes: ${dna.pattern_notes}`] : []),
      ``,
      `DNA JSON: ${JSON.stringify(dna)}`,
    ].join('\n');

    const kbRow = await this.kb.createEntry({
      title: `Design Sample — ${dna.slide_type} — ${dna.platform_fit[0] ?? 'any'} — ${Date.now()}`,
      content,
      entryType: 'design_sample',
      agentKeys: 'canva',
      siteKeys: opts.brand,
      category: 'design',
      sourceType: 'image_upload',
      sourceUrl: storageResult.url,
    });
    const kbEntryId = kbRow.id;

    this.logger.log(`Design DNA extracted: ${dna.layout_type} ${dna.mood_keywords.join(',')} → kb:${kbEntryId}`);

    return { dna, kbEntryId, storageUrl: storageResult.url };
  }

  async listSamples(opts: { brand?: string; platform?: string; slideType?: string } = {}) {
    const conditions = [
      eq(knowledgeEntries.entryType, 'design_sample'),
      eq(knowledgeEntries.agentKeys, 'canva'),
    ];
    if (opts.brand) conditions.push(eq(knowledgeEntries.siteKeys, opts.brand));
    if (opts.platform) conditions.push(like(knowledgeEntries.content, `%${opts.platform}%`));
    if (opts.slideType) conditions.push(like(knowledgeEntries.content, `%${opts.slideType}%`));

    return this.db.db
      .select({
        id: knowledgeEntries.id,
        title: knowledgeEntries.title,
        content: knowledgeEntries.content,
        category: knowledgeEntries.category,
        sourceUrl: knowledgeEntries.sourceUrl,
        siteKeys: knowledgeEntries.siteKeys,
        createdAt: knowledgeEntries.createdAt,
      })
      .from(knowledgeEntries)
      .where(and(...conditions))
      .orderBy(knowledgeEntries.createdAt);
  }

  async countSamples(brand: string): Promise<number> {
    const rows = await this.db.db
      .select({ id: knowledgeEntries.id })
      .from(knowledgeEntries)
      .where(and(
        eq(knowledgeEntries.entryType, 'design_sample'),
        eq(knowledgeEntries.agentKeys, 'canva'),
        eq(knowledgeEntries.siteKeys, brand),
      ));
    return rows.length;
  }

  async reanalyzeSamples(brand: string): Promise<{ reanalyzed: number; failed: number }> {
    const rows = await this.db.db
      .select({
        id: knowledgeEntries.id,
        sourceUrl: knowledgeEntries.sourceUrl,
        siteKeys: knowledgeEntries.siteKeys,
      })
      .from(knowledgeEntries)
      .where(and(
        eq(knowledgeEntries.entryType, 'design_sample'),
        eq(knowledgeEntries.agentKeys, 'canva'),
        eq(knowledgeEntries.siteKeys, brand),
      ));

    let reanalyzed = 0;
    let failed = 0;

    for (const row of rows) {
      const url = row.sourceUrl;
      if (!url || url.startsWith('local://')) {
        failed++;
        continue;
      }
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buffer = Buffer.from(await res.arrayBuffer());

        // Extract fresh DNA via vision LLM
        const imageBase64 = buffer.toString('base64');
        const llmRes = await this.llm.complete({
          messages: [{ role: 'user', content: DNA_PROMPT }],
          imageBase64,
          imageMimeType: 'image/png',
          maxTokens: 2000,
          temperature: 0.1,
          agentKey: 'canva',
        });

        let dna: DesignDNA;
        try {
          const jsonMatch = llmRes.content.match(/```(?:json)?\s*([\s\S]+?)\s*```/) ?? llmRes.content.match(/(\{[\s\S]+\})/);
          dna = JSON.parse(jsonMatch?.[1] ?? llmRes.content);
        } catch {
          failed++;
          continue;
        }

        const content = [
          `Design Sample Analysis`,
          `Layout: ${dna.layout_type}`,
          `Background: ${dna.background_style}`,
          `Colors: primary ${dna.primary_color}, accent ${dna.accent_color}`,
          `Typography: ${dna.font_weight_heading} ${dna.font_size_heading} ${dna.font_style}`,
          `Hierarchy: ${dna.visual_hierarchy?.join(' > ')}`,
          `Composition: ${dna.composition}, alignment: ${dna.text_alignment}`,
          `Whitespace: ${dna.whitespace}, density: ${dna.element_density}`,
          `Mood: ${dna.mood_keywords?.join(', ')}`,
          `Platform: ${dna.platform_fit?.join(', ')}`,
          `Slide type: ${dna.slide_type}`,
          `Accent elements: ${dna.accent_elements?.join(', ')}`,
          ``,
          `DNA JSON: ${JSON.stringify(dna)}`,
        ].join('\n');

        // Update the KB entry content in-place
        await this.db.db.execute(sql`
          UPDATE knowledge_entries SET content = ${content}, updated_at = NOW()
          WHERE id = ${row.id}
        `);

        reanalyzed++;
        this.logger.log(`Reanalyzed sample ${row.id}: ${dna.layout_type} ${dna.mood_keywords?.join(',')}`);
      } catch (err) {
        failed++;
        this.logger.warn(`Failed to reanalyze sample ${row.id}: ${(err as Error).message}`);
      }
    }

    this.logger.log(`Reanalysis complete: ${reanalyzed} reanalyzed, ${failed} failed for brand=${brand}`);
    return { reanalyzed, failed };
  }
}
