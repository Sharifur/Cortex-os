import { Injectable, Logger } from '@nestjs/common';
import { and, eq, or, sql } from 'drizzle-orm';
import { LlmRouterService } from '../llm/llm-router.service';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';
import { DbService } from '../../db/db.service';
import { knowledgeEntries } from '../knowledge-base/schema';
import type { DesignDNA, DominantDNA, LayoutType } from './types';

const MIN_SAMPLES_FOR_CLUSTERING = 3;

@Injectable()
export class DesignPatternService {
  private readonly logger = new Logger(DesignPatternService.name);

  private clusteringStatus = new Map<string, {
    phase: string;
    pass: number;
    totalPasses: number;
    patternsFound: number;
    sampleCount: number;
    dnaCount: number;
    running: boolean;
  }>();

  constructor(
    private readonly llm: LlmRouterService,
    private readonly kb: KnowledgeBaseService,
    private readonly db: DbService,
  ) {}

  getClusteringStatus(brand: string) {
    return this.clusteringStatus.get(brand) ?? { phase: 'idle', pass: 0, totalPasses: 0, patternsFound: 0, sampleCount: 0, dnaCount: 0, running: false };
  }

  private buildAggregation(list: Record<string, unknown>[]) {
    const freq = (field: string) => {
      const counts: Record<string, number> = {};
      for (const d of list) {
        const val = d[field];
        const vals = Array.isArray(val) ? val : [String(val ?? '')];
        for (const v of vals) { if (v) counts[v] = (counts[v] ?? 0) + 1; }
      }
      return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([v, n]) => `${v}(${n})`).join(', ');
    };

    const freqNested = (path: string) => {
      const parts = path.split('.');
      const counts: Record<string, number> = {};
      for (const d of list) {
        let val: unknown = d;
        for (const p of parts) val = (val as Record<string, unknown>)?.[p];
        const vals = Array.isArray(val) ? val : [String(val ?? '')];
        for (const v of vals) { if (v && v !== 'undefined' && v !== 'null') counts[v] = (counts[v] ?? 0) + 1; }
      }
      return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([v, n]) => `${v}(${n})`).join(', ');
    };

    const collectHexFreq = (field: string) => {
      const counts: Record<string, number> = {};
      for (const d of list) {
        const val = (d['color_usage'] as Record<string, string> | undefined)?.[field] ?? (d[field] as string | undefined) ?? '';
        if (val && val.startsWith('#')) counts[val.toLowerCase()] = (counts[val.toLowerCase()] ?? 0) + 1;
      }
      return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([v, n]) => `${v}(${n})`).join(', ');
    };

    const shapeFreq: Record<string, number> = {};
    for (const d of list) {
      for (const s of (d['shape_elements'] as Array<{ shape_type: string }> | undefined) ?? []) {
        shapeFreq[s.shape_type] = (shapeFreq[s.shape_type] ?? 0) + 1;
      }
    }

    const svgHints = list
      .flatMap(d => (d['shape_elements'] as Array<{ svg_hint: string }> | undefined) ?? [])
      .map(s => s.svg_hint).filter(h => h && h.length > 5).slice(0, 30).map(h => `- ${h}`).join('\n');

    const illustrationSubjects = list
      .flatMap(d => (d['decorative_illustrations'] as Array<{ subject: string; subject_description: string }> | undefined) ?? [])
      .map(i => `${i.subject}: ${i.subject_description}`).filter(Boolean).slice(0, 40).map(i => `- ${i}`).join('\n');

    const summary = [
      `Samples: ${list.length}`,
      `layout_type: ${freq('layout_type')}`,
      `composition: ${freq('composition')}`,
      `text_alignment: ${freq('text_alignment')}`,
      `whitespace: ${freq('whitespace')}`,
      `element_density: ${freq('element_density')}`,
      `grid_columns: ${freq('grid_columns')}`,
      `background_style: ${freq('background_style')}`,
      `background_texture: ${freq('background_texture')}`,
      `background_image_used: ${freq('background_image_used')}`,
      `color_count: ${freq('color_count')}`,
      `primary_color: ${collectHexFreq('primary_color')}`,
      `accent_color: ${collectHexFreq('accent_color')}`,
      `background_hex: ${collectHexFreq('background_hex')}`,
      `headline_text_hex: ${collectHexFreq('headline_text_hex')}`,
      `cta_background_hex: ${collectHexFreq('cta_background_hex')}`,
      `accent_bar_hex: ${collectHexFreq('accent_bar_hex')}`,
      `font_style: ${freq('font_style')}`,
      `body_font_style: ${freq('body_font_style')}`,
      `font_weight_heading: ${freq('font_weight_heading')}`,
      `font_size_heading: ${freq('font_size_heading')}`,
      `heading_case: ${freqNested('typography.heading_case')}`,
      `heading_letter_spacing: ${freqNested('typography.heading_letter_spacing')}`,
      `heading_line_height: ${freqNested('typography.heading_line_height')}`,
      `heading_word_count_typical: ${freqNested('typography.heading_word_count_typical')}`,
      `uses_eyebrow_label: ${freqNested('typography.uses_eyebrow_label')}`,
      `eyebrow_style: ${freqNested('typography.eyebrow_style')}`,
      `body_present: ${freqNested('typography.body_present')}`,
      `body_line_count_typical: ${freqNested('typography.body_line_count_typical')}`,
      `font_mix: ${freqNested('typography.font_mix')}`,
      `uses_highlight_text: ${freqNested('typography.uses_highlight_text')}`,
      `highlight_style: ${freqNested('typography.highlight_style')}`,
      `number_stat_style: ${freq('number_stat_style')}`,
      `outer_padding_style: ${freqNested('spacing.outer_padding_style')}`,
      `headline_to_body_gap: ${freqNested('spacing.headline_to_body_gap')}`,
      `element_vertical_rhythm: ${freqNested('spacing.element_vertical_rhythm')}`,
      `cta_margin_top: ${freqNested('spacing.cta_margin_top')}`,
      `icon_style: ${freq('icon_style')}`,
      `icon_count: ${freq('icon_count')}`,
      `icon_size: ${freq('icon_size')}`,
      `illustration_style: ${freq('illustration_style')}`,
      `photography_style: ${freq('photography_style')}`,
      `decoration_elements: ${freq('decoration_elements')}`,
      `accent_elements: ${freq('accent_elements')}`,
      `border_radius_style: ${freq('border_radius_style')}`,
      `shadow_usage: ${freq('shadow_usage')}`,
      `divider_style: ${freq('divider_style')}`,
      `brand_bar: ${freq('brand_bar')}`,
      `logo_placement: ${freq('logo_placement')}`,
      `cta_style: ${freq('cta_style')}`,
      `content_tone: ${freq('content_tone')}`,
      `mood_keywords: ${freq('mood_keywords')}`,
      `slide_type: ${freq('slide_type')}`,
      `text_layers_count: ${freq('text_layers_count')}`,
      `headline_starts_with: ${freqNested('text_content_pattern.headline_starts_with')}`,
      `shape_types: ${Object.entries(shapeFreq).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([v, n]) => `${v}(${n})`).join(', ') || 'none'}`,
    ].join('\n');

    return { summary, svgHints, illustrationSubjects };
  }

  private extractPatterns(text: string): string[] {
    return text
      .split('\n')
      .filter(line => /^(\*{1,2})?\d+\./.test(line.trim()))
      .map(line => line.replace(/^(\*{1,2})?\d+\.\*{0,2}\s*/, '').trim())
      .filter(Boolean);
  }

  async cluster(brand: string): Promise<{ patternCount: number; patterns: string[]; bannerBrief: string }> {
    const effectiveBrand = brand || 'default';

    const MAIN_PASSES = [
      {
        label: 'Structure & Layout',
        categories: '[LAYOUT] [COMPOSITION] [HIERARCHY] [SPACING] [GRID] [CONTENT-ZONE]',
        focus: `Focus on spatial and structural patterns only. Include: dominant layout type, composition rule, grid columns, content zone position (x/y/w/h%), visual reading order top-to-bottom, outer padding tier, headline-to-body gap px equivalent, element vertical rhythm, CTA bottom margin. Generate minimum 50 rules — cover every distinct layout variant found in the data.`,
      },
      {
        label: 'Color System',
        categories: '[COLOR] [BACKGROUND] [GRADIENT] [OVERLAY] [TEXTURE] [COLOR-CONTRAST] [SECONDARY-PALETTE]',
        focus: `Focus on color patterns only. State exact hex codes for: primary background, content slide background, CTA slide background, headline text, body text, accent/brand color, CTA button fill, CTA text. Describe gradients with angle and stops. Note overlay opacity. Describe the full palette system — which colors coexist. Generate minimum 50 rules — every unique color combination found across samples counts as a distinct rule.`,
      },
      {
        label: 'Typography',
        categories: '[TYPOGRAPHY] [HEADING-STYLE] [BODY-TEXT] [TEXT-PATTERN] [HIGHLIGHT-TEXT] [EYEBROW-LABEL] [STAT-NUMBER]',
        focus: `Focus on typography patterns only. Include: dominant font weight and size tier for headings, letter spacing (tight/normal/wide), line height, text case (uppercase/title/sentence), typical heading word count, whether eyebrow labels appear and their visual style (pill/badge/plain/none), body text presence and line count, inline word highlights with background color/shape, large stat number style. Generate minimum 50 rules — cover every typographic variant.`,
      },
      {
        label: 'Visual Elements',
        categories: '[ICONS] [ILLUSTRATION] [PHOTOGRAPHY] [SHAPES] [DECORATION] [ACCENT-ELEMENTS] [LAYERING]',
        focus: `Focus on visual element patterns only. For shapes: every recurring type with canvas position (x/y % from top-left), fill color/opacity, and minimal SVG: <circle cx="85%" cy="5%" r="25%" fill="#hex" opacity="0.15"/>. For illustrations: subject types, render style, placement. For photography: style and framing. For icons: style, count, size tier. For layering/z-index: describe how elements overlap. Generate minimum 50 rules — each distinct shape variant, illustration subject, and icon type is a separate rule.`,
      },
      {
        label: 'Brand Identity & Content',
        categories: '[BRAND-BAR] [LOGO] [CTA] [CONTENT-TONE] [PLATFORM] [MOOD] [SLIDE-INDICATOR] [BADGE] [WATERMARK]',
        focus: `Focus on brand and content patterns only. CTA: button shape, fill color, text color, y-position %, typical label text style. Logo: placement, height estimate. Brand bar: position (top/bottom/left/right), color, thickness. Slide indicator: position, format (N/T or dot). Content tone: formal/casual/punchy breakdown. Mood keywords: list recurring emotional descriptors. Platform-specific rules if data differs by platform. Generate minimum 40 rules.`,
      },
    ];

    // Pass 6: one rule set per slide type
    const SLIDE_TYPES = ['cover', 'content', 'cta', 'stat', 'list', 'quote', 'testimonial'];

    const TOTAL_PASSES = MAIN_PASSES.length + 1; // 5 dimension passes + 1 slide-type pass

    const status = {
      phase: 'Loading samples',
      pass: 0,
      totalPasses: TOTAL_PASSES,
      patternsFound: 0,
      sampleCount: 0,
      dnaCount: 0,
      running: true,
    };
    this.clusteringStatus.set(effectiveBrand, status);
    try {

    const designSamples = await this.db.db
      .select({ id: knowledgeEntries.id, content: knowledgeEntries.content })
      .from(knowledgeEntries)
      .where(and(
        eq(knowledgeEntries.entryType, 'design_sample'),
        eq(knowledgeEntries.agentKeys, 'canva'),
        eq(knowledgeEntries.siteKeys, effectiveBrand),
      ));

    status.sampleCount = designSamples.length;

    if (designSamples.length < MIN_SAMPLES_FOR_CLUSTERING) {
      status.phase = 'done';
      status.running = false;
      this.logger.warn(`Not enough samples: ${designSamples.length}/${MIN_SAMPLES_FOR_CLUSTERING} for brand=${effectiveBrand}`);
      return { patternCount: 0, patterns: [], bannerBrief: '' };
    }

    status.phase = 'Aggregating DNA';
    const dnaList: Record<string, unknown>[] = [];
    for (const s of designSamples) {
      const match = s.content.match(/DNA JSON: (\{[\s\S]+\})\s*$/m);
      if (match) {
        try { dnaList.push(JSON.parse(match[1])); } catch { /* skip malformed */ }
      }
    }

    status.dnaCount = dnaList.length;
    this.logger.log(`DNA parsed: ${dnaList.length}/${designSamples.length} samples for brand=${effectiveBrand}`);

    if (dnaList.length < MIN_SAMPLES_FOR_CLUSTERING) {
      status.phase = 'done';
      status.running = false;
      this.logger.warn(`Too few valid DNA entries (${dnaList.length}) — check that samples have been re-analysed with a sufficient maxTokens setting`);
      return { patternCount: 0, patterns: [], bannerBrief: '' };
    }

    const { summary: globalSummary, svgHints, illustrationSubjects } = this.buildAggregation(dnaList);

    const sampleNotes = dnaList
      .map(d => d['pattern_notes'] as string | undefined)
      .filter(n => n && n.length > 5).slice(0, 40).map(n => `- ${n}`).join('\n');

    const allPatterns: string[] = [];

    // Passes 1–5: dimension-focused
    for (let i = 0; i < MAIN_PASSES.length; i++) {
      const pass = MAIN_PASSES[i];
      status.pass = i + 1;
      status.phase = `Pass ${i + 1}/${TOTAL_PASSES}: ${pass.label}`;
      this.logger.log(`Clustering pass ${i + 1}/${TOTAL_PASSES}: ${pass.label} for brand=${effectiveBrand}`);

      const res = await this.llm.complete({
        messages: [
          {
            role: 'system',
            content: `You are a senior design strategist extracting specific design patterns from aggregated DNA data. Be precise — use exact hex codes, percentages, and measured values from the data.`,
          },
          {
            role: 'user',
            content: [
              `Brand: ${effectiveBrand}`,
              `Pass focus: ${pass.label}`,
              `Categories for this pass (use ONLY these prefixes): ${pass.categories}`,
              ``,
              `Aggregated DNA frequencies (${dnaList.length} samples):`,
              globalSummary,
              svgHints ? `\nRecurring shape hints:\n${svgHints}` : '',
              illustrationSubjects ? `\nIllustration subjects found:\n${illustrationSubjects}` : '',
              sampleNotes ? `\nSample observations:\n${sampleNotes}` : '',
              ``,
              pass.focus,
              ``,
              `Rules:`,
              `- Use ONLY the category prefixes listed above — no other categories`,
              `- Number each rule starting from 1`,
              `- No preamble, no explanations — just the numbered rules`,
              `- Format: N. [CATEGORY] Rule text`,
            ].join('\n'),
          },
        ],
        maxTokens: 8000,
        temperature: 0.2,
        agentKey: 'canva',
      });

      const passPatterns = this.extractPatterns(res.content);
      allPatterns.push(...passPatterns);
      status.patternsFound = allPatterns.length;
      this.logger.log(`Pass ${i + 1} complete: ${passPatterns.length} patterns (total: ${allPatterns.length})`);
    }

    // Pass 6: per slide-type rules
    status.pass = MAIN_PASSES.length + 1;
    status.phase = `Pass ${MAIN_PASSES.length + 1}/${TOTAL_PASSES}: Per Slide Type`;
    this.logger.log(`Clustering pass ${MAIN_PASSES.length + 1}/${TOTAL_PASSES}: Per Slide Type for brand=${effectiveBrand}`);

    const bySlideType: Record<string, Record<string, unknown>[]> = {};
    for (const d of dnaList) {
      const t = String(d['slide_type'] ?? 'content');
      bySlideType[t] ??= [];
      bySlideType[t].push(d);
    }

    const slideTypeSummaries = SLIDE_TYPES
      .filter(t => (bySlideType[t]?.length ?? 0) >= 2)
      .map(t => {
        const list = bySlideType[t];
        const { summary } = this.buildAggregation(list);
        return `=== ${t.toUpperCase()} (${list.length} samples) ===\n${summary}`;
      })
      .join('\n\n');

    if (slideTypeSummaries) {
      const res = await this.llm.complete({
        messages: [
          {
            role: 'system',
            content: `You are a senior design strategist. Extract per-slide-type design patterns. Each rule must specify which slide type it applies to.`,
          },
          {
            role: 'user',
            content: [
              `Brand: ${effectiveBrand}`,
              ``,
              `Per-slide-type aggregated DNA:`,
              slideTypeSummaries,
              ``,
              `Write 20+ specific design rules per slide type that has enough samples.`,
              `Use category prefix format: [COVER] [CONTENT-SLIDE] [CTA-SLIDE] [STAT-SLIDE] [LIST-SLIDE] [QUOTE-SLIDE] [TESTIMONIAL-SLIDE]`,
              `Each rule must be specific to that slide type — background color, layout, text treatment, shapes, hierarchy, padding.`,
              `Include rules that differ from the global brand pattern — capture what makes each slide type visually distinct.`,
              `Numbered list starting from 1. Format: N. [SLIDE-TYPE] Rule.`,
              `No preamble. Minimum 15 rules per slide type present.`,
            ].join('\n'),
          },
        ],
        maxTokens: 8000,
        temperature: 0.2,
        agentKey: 'canva',
      });

      const slideTypePatterns = this.extractPatterns(res.content);
      allPatterns.push(...slideTypePatterns);
      status.patternsFound = allPatterns.length;
      this.logger.log(`Slide-type pass complete: ${slideTypePatterns.length} patterns (total: ${allPatterns.length})`);
    }

    // Banner brief
    status.phase = 'Generating banner brief';
    const briefRes = await this.llm.complete({
      messages: [
        {
          role: 'system',
          content: `You are a senior art director. Write a single cohesive banner design brief a developer can use to recreate the brand's visual identity. Be specific and concise — 3-5 sentences.`,
        },
        {
          role: 'user',
          content: [
            `Brand: ${effectiveBrand} — ${dnaList.length} design samples analysed`,
            ``,
            globalSummary,
            svgHints ? `\nShapes:\n${svgHints}` : '',
            ``,
            `Write one paragraph (3-5 sentences) as "Banner Brief:" covering: layout type, background and primary colors, typography style and weight, icons/illustrations/photography used, decorative shapes with positions, CTA style, overall tone. No bullet points.`,
          ].join('\n'),
        },
      ],
      maxTokens: 500,
      temperature: 0.3,
      agentKey: 'canva',
    });

    const bannerBrief = briefRes.content.replace(/^Banner Brief:\s*/i, '').trim();

    // Save: delete old, write new (one entry per pass group + one header entry with banner brief)
    status.phase = 'Saving patterns';
    this.logger.log(`Clustering produced ${allPatterns.length} patterns for brand=${effectiveBrand}`);

    if (allPatterns.length === 0) {
      status.phase = 'done';
      status.running = false;
      this.logger.warn(`Clustering produced 0 patterns — old patterns preserved for brand=${effectiveBrand}`);
      return { patternCount: 0, patterns: [], bannerBrief: '' };
    }

    const oldEntries = await this.db.db
      .select({ id: knowledgeEntries.id })
      .from(knowledgeEntries)
      .where(and(
        eq(knowledgeEntries.entryType, 'design_pattern'),
        eq(knowledgeEntries.agentKeys, 'canva'),
        eq(knowledgeEntries.siteKeys, effectiveBrand),
      ));
    for (const old of oldEntries) {
      await this.kb.deleteEntry(old.id).catch(() => {});
    }

    // Store in chunks of 100 rules per KB entry so content stays retrievable
    const CHUNK_SIZE = 100;
    const date = new Date().toISOString().slice(0, 10);
    for (let i = 0; i < allPatterns.length; i += CHUNK_SIZE) {
      const chunk = allPatterns.slice(i, i + CHUNK_SIZE);
      const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1;
      const totalChunks = Math.ceil(allPatterns.length / CHUNK_SIZE);
      const content = [
        `Learned design patterns for brand: ${effectiveBrand} (part ${chunkIndex}/${totalChunks})`,
        `Based on ${designSamples.length} samples — ${allPatterns.length} total patterns.`,
        chunkIndex === 1 ? `\nBanner Brief: ${bannerBrief}\n` : '',
        chunk.map((p, j) => `${i + j + 1}. ${p}`).join('\n'),
      ].join('\n');

      await this.kb.createEntry({
        title: `Design Patterns — ${effectiveBrand} — ${date} — part ${chunkIndex}/${totalChunks}`,
        content,
        entryType: 'design_pattern',
        agentKeys: 'canva',
        siteKeys: effectiveBrand,
        category: 'design',
        sourceType: 'clustering',
      });
    }

      status.phase = 'done';
      status.running = false;
      this.logger.log(`Clustering complete: ${allPatterns.length} patterns across ${TOTAL_PASSES} passes for brand=${effectiveBrand}`);
      return { patternCount: allPatterns.length, patterns: allPatterns, bannerBrief };
    } catch (err) {
      status.phase = 'error';
      status.running = false;
      this.logger.error(`Clustering failed for brand=${effectiveBrand}: ${(err as Error).message}`);
      throw err;
    }
  }

  async getDominantDNA(brand: string): Promise<DominantDNA | null> {
    const effectiveBrand = brand || 'default';
    const brandFilter = effectiveBrand === 'default'
      ? eq(knowledgeEntries.siteKeys, 'default')
      : or(eq(knowledgeEntries.siteKeys, effectiveBrand), eq(knowledgeEntries.siteKeys, 'default'))!;

    const samples = await this.db.db
      .select({ content: knowledgeEntries.content })
      .from(knowledgeEntries)
      .where(and(
        eq(knowledgeEntries.entryType, 'design_sample'),
        eq(knowledgeEntries.agentKeys, 'canva'),
        brandFilter,
      ));

    if (!samples.length) return null;

    const dnaList: DesignDNA[] = [];
    for (const s of samples) {
      const match = s.content.match(/DNA JSON: (\{[\s\S]+\})\s*$/m);
      if (match) {
        try { dnaList.push(JSON.parse(match[1]) as DesignDNA); } catch { /* skip */ }
      }
    }

    if (!dnaList.length) return null;

    const dominant = <K extends keyof DesignDNA>(field: K): DesignDNA[K] => {
      const counts: Record<string, number> = {};
      for (const d of dnaList) {
        const val = String(d[field] ?? '');
        if (val && val !== 'undefined') counts[val] = (counts[val] ?? 0) + 1;
      }
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
      return (top ?? '') as DesignDNA[K];
    };

    const dominantArray = (field: keyof DesignDNA, topN = 4): string[] => {
      const counts: Record<string, number> = {};
      for (const d of dnaList) {
        const arr = Array.isArray(d[field]) ? d[field] as string[] : [];
        for (const v of arr) { if (v && v !== 'none') counts[v] = (counts[v] ?? 0) + 1; }
      }
      return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, topN).map(([v]) => v);
    };

    // Representative shapes — top 8 most frequent types, preserving original opacity
    const shapeTypeCount: Record<string, number> = {};
    const shapeByType = new Map<string, DesignDNA['shape_elements'][0]>();
    for (const d of dnaList) {
      for (const s of d.shape_elements ?? []) {
        shapeTypeCount[s.shape_type] = (shapeTypeCount[s.shape_type] ?? 0) + 1;
        // Keep the shape with the median opacity (not just the first one)
        if (!shapeByType.has(s.shape_type)) shapeByType.set(s.shape_type, s);
      }
    }
    const representativeShapes = Object.entries(shapeTypeCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([type]) => shapeByType.get(type)!)
      .filter(Boolean);

    // Dominant hex colors — extracted directly from raw DNA values
    const dominantHex = (field: 'primary_color' | 'accent_color'): string => {
      const counts: Record<string, number> = {};
      for (const d of dnaList) {
        const val = String(d[field] ?? '');
        if (val && val.startsWith('#') && val.length >= 7) counts[val.toLowerCase()] = (counts[val.toLowerCase()] ?? 0) + 1;
      }
      return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    };

    const dominantHexFromColorUsage = (field: string): string => {
      const counts: Record<string, number> = {};
      for (const d of dnaList) {
        const cu = (d as unknown as Record<string, unknown>)['color_usage'] as Record<string, string> | undefined;
        const val = cu?.[field] ?? '';
        if (val && val.startsWith('#') && val.length >= 7) counts[val.toLowerCase()] = (counts[val.toLowerCase()] ?? 0) + 1;
      }
      return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    };

    // Per-slide-type dominant colors
    const slideTypeColors: Record<string, { bg: string; accent: string; textHex: string }> = {};
    for (const slideType of ['cover', 'content', 'cta', 'stat', 'list', 'quote', 'testimonial']) {
      const subset = dnaList.filter(d => String(d.slide_type) === slideType);
      if (subset.length < 3) continue;
      const bgCounts: Record<string, number> = {};
      const accentCounts: Record<string, number> = {};
      const textCounts: Record<string, number> = {};
      for (const d of subset) {
        const bg = String(d.primary_color ?? '');
        if (bg.startsWith('#')) bgCounts[bg.toLowerCase()] = (bgCounts[bg.toLowerCase()] ?? 0) + 1;
        const ac = String(d.accent_color ?? '');
        if (ac.startsWith('#')) accentCounts[ac.toLowerCase()] = (accentCounts[ac.toLowerCase()] ?? 0) + 1;
        const cu = (d as unknown as Record<string, unknown>)['color_usage'] as Record<string, string> | undefined;
        const tx = cu?.['headline_text_hex'] ?? '';
        if (tx.startsWith('#')) textCounts[tx.toLowerCase()] = (textCounts[tx.toLowerCase()] ?? 0) + 1;
      }
      const topBg = Object.entries(bgCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
      const topAccent = Object.entries(accentCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
      const topText = Object.entries(textCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
      if (topBg) slideTypeColors[slideType] = { bg: topBg, accent: topAccent || topBg, textHex: topText };
    }

    // Per-slide-role dominant layout type
    const LAYOUT_REMAP: Record<string, LayoutType> = {
      centered: 'centered', 'left-aligned': 'left-aligned',
      'split-panel': 'split-panel', overlay: 'overlay',
      grid: 'list-layout', diagonal: 'left-aligned', asymmetric: 'split-panel',
    };
    const slideRoleLayouts: Partial<Record<string, LayoutType>> = {};
    const roleLayoutCounts: Record<string, Record<string, number>> = {};
    for (const d of dnaList) {
      const role = String(d.slide_type || '');
      const layout = String(d.layout_type || '');
      if (!role || !layout) continue;
      if (!roleLayoutCounts[role]) roleLayoutCounts[role] = {};
      roleLayoutCounts[role][layout] = (roleLayoutCounts[role][layout] ?? 0) + 1;
    }
    for (const [role, counts] of Object.entries(roleLayoutCounts)) {
      const top = Object.entries(counts).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1])[0];
      if (!top) continue;
      const mapped = LAYOUT_REMAP[top[0]];
      if (mapped) {
        // Never force list-layout on non-list roles; never force overlay on cover/cta
        if (mapped === 'list-layout' && role !== 'list') continue;
        if (mapped === 'overlay' && (role === 'cover' || role === 'cta')) continue;
        slideRoleLayouts[role] = mapped;
      }
    }

    // Most common gradient angle
    const gradientAngles = dnaList
      .flatMap(d => (d.shape_elements ?? []).map(s => s.gradient_angle).filter(a => a != null)) as number[];
    const gradientAngle = gradientAngles.length
      ? Math.round(gradientAngles.reduce((sum, a) => sum + a, 0) / gradientAngles.length)
      : 135;

    // Use per-image patterns (design_sample) with frequency dedup; fall back to batch-clustered entries
    const samplePatternRows = await this.db.db
      .select({ content: knowledgeEntries.content })
      .from(knowledgeEntries)
      .where(and(
        eq(knowledgeEntries.entryType, 'design_sample'),
        eq(knowledgeEntries.agentKeys, 'canva'),
        brandFilter,
      ));

    let patternRules: string[];
    if (samplePatternRows.length > 0) {
      const freq = new Map<string, number>();
      for (const row of samplePatternRows) {
        const section = row.content.split('-- Design Patterns --')[1]?.split('DNA JSON:')[0] ?? '';
        section.split('\n').filter(l => /^\d+\./.test(l.trim()))
          .map(l => l.replace(/^\d+\.\s*/, '').trim()).filter(Boolean)
          .forEach(r => freq.set(r, (freq.get(r) ?? 0) + 1));
      }
      patternRules = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([r]) => r);
    } else {
      const patternEntries = await this.db.db
        .select({ content: knowledgeEntries.content })
        .from(knowledgeEntries)
        .where(and(
          eq(knowledgeEntries.entryType, 'design_pattern'),
          eq(knowledgeEntries.agentKeys, 'canva'),
          eq(knowledgeEntries.siteKeys, effectiveBrand),
        ));
      patternRules = patternEntries.flatMap(e =>
        e.content.split('\n').filter(l => /^\d+\./.test(l.trim())).map(l => l.replace(/^\d+\.\s*/, '').trim()).filter(Boolean)
      );
    }

    const bannerBriefEntry = await this.db.db
      .select({ content: knowledgeEntries.content })
      .from(knowledgeEntries)
      .where(and(
        eq(knowledgeEntries.entryType, 'design_pattern'),
        eq(knowledgeEntries.agentKeys, 'canva'),
        eq(knowledgeEntries.siteKeys, effectiveBrand),
      ))
      .limit(1);

    const bannerBriefMatch = (bannerBriefEntry[0]?.content ?? '').match(/^Banner Brief:\s*(.+)$/m);
    const bannerBrief = bannerBriefMatch?.[1]?.trim() ?? '';

    return {
      sampleCount: dnaList.length,
      layout_type: dominant('layout_type') || 'left-aligned',
      whitespace: dominant('whitespace') || 'moderate',
      text_alignment: dominant('text_alignment') || 'left',
      accent_elements: dominantArray('accent_elements'),
      brand_bar: dominant('brand_bar') || 'none',
      logo_placement: dominant('logo_placement') || 'bottom-left',
      border_radius_style: dominant('border_radius_style') || 'rounded',
      shadow_usage: dominant('shadow_usage') || 'none',
      cta_style: dominant('cta_style') || 'pill-button',
      font_size_heading: dominant('font_size_heading') || 'large',
      font_weight_heading: dominant('font_weight_heading') || 'bold',
      font_style: dominant('font_style') || 'modern-sans',
      icon_style: dominant('icon_style') || 'none',
      icon_count: dominant('icon_count') || 'none',
      icon_size: dominant('icon_size') || 'none',
      illustration_style: dominant('illustration_style') || 'none',
      photography_style: dominant('photography_style') || 'none',
      content_tone: dominant('content_tone') || 'professional',
      mood_keywords: dominantArray('mood_keywords', 5),
      decoration_elements: dominantArray('decoration_elements'),
      background_style: dominant('background_style') || 'solid-dark',
      representative_shapes: representativeShapes,
      pattern_rules: patternRules,
      banner_brief: bannerBrief,
      dominant_primary_color: dominantHex('primary_color'),
      dominant_accent_color: dominantHex('accent_color'),
      dominant_headline_hex: dominantHexFromColorUsage('headline_text_hex'),
      dominant_cta_hex: dominantHexFromColorUsage('cta_background_hex'),
      background_gradient_angle: gradientAngle,
      slide_type_colors: slideTypeColors,
      slide_role_layouts: slideRoleLayouts,
    };
  }

  async listSampleMeta(brand: string): Promise<Array<{ id: string; title: string }>> {
    const effectiveBrand = brand || 'default';
    const brandFilter = effectiveBrand === 'default'
      ? eq(knowledgeEntries.siteKeys, 'default')
      : or(eq(knowledgeEntries.siteKeys, effectiveBrand), eq(knowledgeEntries.siteKeys, 'default'))!;
    return this.db.db
      .select({ id: knowledgeEntries.id, title: knowledgeEntries.title })
      .from(knowledgeEntries)
      .where(and(
        eq(knowledgeEntries.entryType, 'design_sample'),
        eq(knowledgeEntries.agentKeys, 'canva'),
        brandFilter,
      ))
      .orderBy(knowledgeEntries.createdAt) as Promise<Array<{ id: string; title: string }>>;
  }

  async getDNAForEntry(entryId: string): Promise<DesignDNA | null> {
    const [row] = await this.db.db
      .select({ content: knowledgeEntries.content })
      .from(knowledgeEntries)
      .where(eq(knowledgeEntries.id, entryId))
      .limit(1);
    if (!row) return null;
    const match = row.content.match(/DNA JSON: (\{[\s\S]+\})\s*$/m);
    if (!match) return null;
    try { return JSON.parse(match[1]) as DesignDNA; } catch { return null; }
  }

  async getRandomSampleDNA(brand: string): Promise<DesignDNA | null> {
    const effectiveBrand = brand || 'default';
    const brandFilter = effectiveBrand === 'default'
      ? eq(knowledgeEntries.siteKeys, 'default')
      : or(eq(knowledgeEntries.siteKeys, effectiveBrand), eq(knowledgeEntries.siteKeys, 'default'))!;
    const samples = await this.db.db
      .select({ content: knowledgeEntries.content })
      .from(knowledgeEntries)
      .where(and(
        eq(knowledgeEntries.entryType, 'design_sample'),
        eq(knowledgeEntries.agentKeys, 'canva'),
        brandFilter,
      ));
    if (!samples.length) return null;
    const dnaList: DesignDNA[] = [];
    for (const s of samples) {
      const match = s.content.match(/DNA JSON: (\{[\s\S]+\})\s*$/m);
      if (match) {
        try { dnaList.push(JSON.parse(match[1]) as DesignDNA); } catch { /* skip */ }
      }
    }
    if (!dnaList.length) return null;
    return dnaList[Math.floor(Math.random() * dnaList.length)];
  }

  async getPatternsBySlideType(brand?: string): Promise<Record<string, string[]>> {
    const effectiveBrand = brand || 'default';
    const brandFilter = effectiveBrand === 'default'
      ? eq(knowledgeEntries.siteKeys, 'default')
      : or(eq(knowledgeEntries.siteKeys, effectiveBrand), eq(knowledgeEntries.siteKeys, 'default'))!;
    const sampleRows = await this.db.db
      .select({ content: knowledgeEntries.content })
      .from(knowledgeEntries)
      .where(and(
        eq(knowledgeEntries.entryType, 'design_sample'),
        eq(knowledgeEntries.agentKeys, 'canva'),
        brandFilter,
      ));

    const byType: Record<string, Map<string, number>> = {};
    for (const row of sampleRows) {
      const patternSection = row.content.split('-- Design Patterns --')[1]?.split('DNA JSON:')[0] ?? '';
      const rules = patternSection
        .split('\n')
        .filter(line => /^\d+\./.test(line.trim()))
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
        .filter(Boolean);
      if (!rules.length) continue;

      // Extract slide_type from DNA JSON
      const dnaMatch = row.content.match(/DNA JSON: (\{[\s\S]+\})\s*$/m);
      let slideType = 'content';
      if (dnaMatch) {
        try {
          const dna = JSON.parse(dnaMatch[1]) as { slide_type?: string };
          slideType = dna.slide_type ?? 'content';
        } catch { /* keep default */ }
      }

      if (!byType[slideType]) byType[slideType] = new Map();
      const freq = byType[slideType];
      for (const r of rules) freq.set(r, (freq.get(r) ?? 0) + 1);
    }

    const result: Record<string, string[]> = {};
    for (const [type, freq] of Object.entries(byType)) {
      result[type] = [...freq.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([rule]) => rule);
    }
    return result;
  }

  async getBannerBrief(brand?: string): Promise<string> {
    const effectiveBrand = brand || 'default';
    const rows = await this.db.db
      .select({ content: knowledgeEntries.content })
      .from(knowledgeEntries)
      .where(and(
        eq(knowledgeEntries.entryType, 'design_pattern'),
        eq(knowledgeEntries.agentKeys, 'canva'),
        eq(knowledgeEntries.siteKeys, effectiveBrand),
      ))
      .limit(1);
    const content = rows[0]?.content ?? '';
    const match = content.match(/^Banner Brief:\s*(.+)$/m);
    return match?.[1]?.trim() ?? '';
  }

  async clearPatterns(brand?: string): Promise<{ samplesUpdated: number }> {
    const effectiveBrand = brand || 'default';

    await this.db.db.delete(knowledgeEntries).where(and(
      eq(knowledgeEntries.entryType, 'design_pattern'),
      eq(knowledgeEntries.agentKeys, 'canva'),
      eq(knowledgeEntries.siteKeys, effectiveBrand),
    ));

    const sampleRows = await this.db.db
      .select({ id: knowledgeEntries.id, content: knowledgeEntries.content })
      .from(knowledgeEntries)
      .where(and(
        eq(knowledgeEntries.entryType, 'design_sample'),
        eq(knowledgeEntries.agentKeys, 'canva'),
        eq(knowledgeEntries.siteKeys, effectiveBrand),
      ));

    let samplesUpdated = 0;
    for (const row of sampleRows) {
      if (!row.content.includes('-- Design Patterns --')) continue;
      const newContent = row.content.replace(/\n-- Design Patterns --\n[\s\S]*?(?=\nDNA JSON:)/, '');
      if (newContent !== row.content) {
        await this.db.db.execute(sql`
          UPDATE knowledge_entries SET content = ${newContent}, updated_at = NOW() WHERE id = ${row.id}
        `);
        samplesUpdated++;
      }
    }
    this.logger.log(`Cleared patterns for brand=${effectiveBrand}: ${samplesUpdated} samples updated`);
    return { samplesUpdated };
  }

  async removePatternItem(pattern: string, brand?: string): Promise<{ samplesUpdated: number }> {
    const effectiveBrand = brand || 'default';

    const sampleRows = await this.db.db
      .select({ id: knowledgeEntries.id, content: knowledgeEntries.content })
      .from(knowledgeEntries)
      .where(and(
        eq(knowledgeEntries.entryType, 'design_sample'),
        eq(knowledgeEntries.agentKeys, 'canva'),
        eq(knowledgeEntries.siteKeys, effectiveBrand),
      ));

    let samplesUpdated = 0;
    for (const row of sampleRows) {
      if (!row.content.includes(pattern)) continue;
      const newContent = row.content
        .split('\n')
        .filter(line => line.replace(/^\d+\.\s*/, '').trim() !== pattern)
        .join('\n');
      if (newContent !== row.content) {
        await this.db.db.execute(sql`
          UPDATE knowledge_entries SET content = ${newContent}, updated_at = NOW() WHERE id = ${row.id}
        `);
        samplesUpdated++;
      }
    }
    this.logger.log(`Removed pattern "${pattern.slice(0, 60)}" from ${samplesUpdated} samples`);
    return { samplesUpdated };
  }

  async getPatterns(brand?: string): Promise<string[]> {
    const effectiveBrand = brand || 'default';

    // Primary source: per-image patterns embedded in design_sample entries
    const sampleRows = await this.db.db
      .select({ content: knowledgeEntries.content })
      .from(knowledgeEntries)
      .where(and(
        eq(knowledgeEntries.entryType, 'design_sample'),
        eq(knowledgeEntries.agentKeys, 'canva'),
        eq(knowledgeEntries.siteKeys, effectiveBrand),
      ));

    if (sampleRows.length > 0) {
      const freq = new Map<string, number>();
      for (const row of sampleRows) {
        const section = row.content.split('-- Design Patterns --')[1]?.split('DNA JSON:')[0] ?? '';
        const rules = section
          .split('\n')
          .filter(line => /^\d+\./.test(line.trim()))
          .map(line => line.replace(/^\d+\.\s*/, '').trim())
          .filter(Boolean);
        for (const r of rules) freq.set(r, (freq.get(r) ?? 0) + 1);
      }
      if (freq.size > 0) {
        return [...freq.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([rule]) => rule);
      }
    }

    // Fallback: batch-clustered design_pattern entries (legacy)
    const patternRows = await this.db.db
      .select({ content: knowledgeEntries.content })
      .from(knowledgeEntries)
      .where(and(
        eq(knowledgeEntries.entryType, 'design_pattern'),
        eq(knowledgeEntries.agentKeys, 'canva'),
        eq(knowledgeEntries.siteKeys, effectiveBrand),
      ));
    if (!patternRows.length) return [];
    return patternRows.flatMap(r =>
      r.content
        .split('\n')
        .filter(line => /^\d+\./.test(line.trim()))
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
        .filter(Boolean),
    );
  }
}
