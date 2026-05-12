import { Injectable, Logger } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { LlmRouterService } from '../llm/llm-router.service';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';
import { DbService } from '../../db/db.service';
import { knowledgeEntries } from '../knowledge-base/schema';
import type { DesignDNA, DominantDNA } from './types';

const MIN_SAMPLES_FOR_CLUSTERING = 3;

@Injectable()
export class DesignPatternService {
  private readonly logger = new Logger(DesignPatternService.name);

  constructor(
    private readonly llm: LlmRouterService,
    private readonly kb: KnowledgeBaseService,
    private readonly db: DbService,
  ) {}

  async cluster(brand: string): Promise<{ patternCount: number; patterns: string[]; bannerBrief: string }> {
    const effectiveBrand = brand || 'default';

    const designSamples = await this.db.db
      .select({ id: knowledgeEntries.id, content: knowledgeEntries.content })
      .from(knowledgeEntries)
      .where(and(
        eq(knowledgeEntries.entryType, 'design_sample'),
        eq(knowledgeEntries.agentKeys, 'canva'),
        eq(knowledgeEntries.siteKeys, effectiveBrand),
      ));

    if (designSamples.length < MIN_SAMPLES_FOR_CLUSTERING) {
      this.logger.warn(`Not enough samples for clustering: ${designSamples.length}/${MIN_SAMPLES_FOR_CLUSTERING} for brand=${effectiveBrand}`);
      return { patternCount: 0, patterns: [], bannerBrief: '' };
    }

    this.logger.log(`Clustering ${designSamples.length} samples for brand: ${effectiveBrand}`);

    // Extract DNA JSON blobs from each sample
    const dnaList: Record<string, unknown>[] = [];
    for (const s of designSamples.slice(0, 100)) {
      const match = s.content.match(/DNA JSON: (\{[\s\S]+\})\s*$/m);
      if (match) {
        try { dnaList.push(JSON.parse(match[1])); } catch { /* skip malformed */ }
      }
    }

    // Aggregate frequency counts for key fields
    const freq = (field: string) => {
      const counts: Record<string, number> = {};
      for (const d of dnaList) {
        const val = d[field];
        const vals = Array.isArray(val) ? val : [String(val ?? '')];
        for (const v of vals) { if (v) counts[v] = (counts[v] ?? 0) + 1; }
      }
      return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([v, n]) => `${v}(${n})`).join(', ');
    };

    const aggregateSummary = [
      `Samples analysed: ${dnaList.length}`,
      `layout_type: ${freq('layout_type')}`,
      `composition: ${freq('composition')}`,
      `background_style: ${freq('background_style')}`,
      `background_texture: ${freq('background_texture')}`,
      `color_count: ${freq('color_count')}`,
      `font_style: ${freq('font_style')}`,
      `font_weight_heading: ${freq('font_weight_heading')}`,
      `font_size_heading: ${freq('font_size_heading')}`,
      `icon_style: ${freq('icon_style')}`,
      `icon_count: ${freq('icon_count')}`,
      `icon_size: ${freq('icon_size')}`,
      `illustration_style: ${freq('illustration_style')}`,
      `photography_style: ${freq('photography_style')}`,
      `decoration_elements: ${freq('decoration_elements')}`,
      `accent_elements: ${freq('accent_elements')}`,
      `border_radius_style: ${freq('border_radius_style')}`,
      `shadow_usage: ${freq('shadow_usage')}`,
      `cta_style: ${freq('cta_style')}`,
      `content_tone: ${freq('content_tone')}`,
      `mood_keywords: ${freq('mood_keywords')}`,
      `text_alignment: ${freq('text_alignment')}`,
      `whitespace: ${freq('whitespace')}`,
      `slide_type: ${freq('slide_type')}`,
    ].join('\n');

    // Aggregate shape types
    const shapeFreq: Record<string, number> = {};
    for (const d of dnaList) {
      const shapes = d['shape_elements'] as Array<{ shape_type: string; svg_hint: string }> | undefined;
      for (const s of shapes ?? []) {
        shapeFreq[s.shape_type] = (shapeFreq[s.shape_type] ?? 0) + 1;
      }
    }
    const topShapes = Object.entries(shapeFreq).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([v, n]) => `${v}(${n})`).join(', ');

    // Aggregate icon sizes and common element positions
    const iconSizeFreq = freq('icon_size');
    const gridColFreq = freq('grid_columns');

    // Sample svg hints for recurring shapes
    const svgHints = dnaList
      .flatMap(d => (d['shape_elements'] as Array<{ svg_hint: string }> | undefined) ?? [])
      .map(s => s.svg_hint)
      .filter(h => h && h.length > 5)
      .slice(0, 15)
      .map(h => `- ${h}`)
      .join('\n');

    const extendedSummary = [
      `shape_types: ${topShapes || 'none'}`,
      `icon_size: ${iconSizeFreq}`,
      `grid_columns: ${gridColFreq}`,
    ].join('\n');

    const sampleNotes = dnaList
      .map(d => d['pattern_notes'] as string | undefined)
      .filter(n => n && n.length > 5)
      .slice(0, 20)
      .map(n => `- ${n}`)
      .join('\n');

    const res = await this.llm.complete({
      messages: [
        {
          role: 'system',
          content: `You are a senior design strategist. Extract actionable, specific design patterns from aggregated design DNA data. Be precise — name exact colors when consistent, exact icon styles, exact layout choices.`,
        },
        {
          role: 'user',
          content: [
            `Brand: ${effectiveBrand}`,
            ``,
            `Aggregated DNA frequencies (field: value(count)):`,
            aggregateSummary,
            extendedSummary,
            sampleNotes ? `\nNotable observations from samples:\n${sampleNotes}` : '',
            svgHints ? `\nRecurring shape hints:\n${svgHints}` : '',
            ``,
            `Write 8–12 specific, reusable design pattern rules grouped into these categories:`,
            `LAYOUT, COLOR, TYPOGRAPHY, ICONS, ILLUSTRATION & PHOTO, SHAPES & DECORATION, CONTENT TONE, CTA`,
            ``,
            `For SHAPES & DECORATION rules: describe the shape type, position, color/opacity, and include a brief SVG reconstruction note so a developer can rebuild it programmatically.`,
            `Format each rule as:`,
            `[CATEGORY] Rule text. Be specific: mention exact values (e.g. "flat-outlined icons at medium-decorative size at y=10%", "semi-transparent circle blob top-right #6366f1 opacity 0.12", "pill-button CTA at y=82% accent color").`,
            `Numbered list. No preamble. No category headers — just the [CATEGORY] prefix.`,
          ].join('\n'),
        },
      ],
      maxTokens: 900,
      temperature: 0.3,
      agentKey: 'canva',
    });

    const patterns = res.content
      .split('\n')
      .filter(line => /^\d+\./.test(line.trim()))
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      .filter(Boolean);

    // Generate a combined banner brief — one holistic paragraph synthesizing all learned elements
    const briefRes = await this.llm.complete({
      messages: [
        {
          role: 'system',
          content: `You are a senior art director. Write a single cohesive banner design brief that a developer can follow to recreate the brand's visual identity from scratch. Be specific and concise — 3-5 sentences max.`,
        },
        {
          role: 'user',
          content: [
            `Brand: ${effectiveBrand}`,
            ``,
            `Aggregated design DNA (${dnaList.length} samples):`,
            aggregateSummary,
            extendedSummary,
            svgHints ? `\nRecurring shapes:\n${svgHints}` : '',
            ``,
            `Write one paragraph (3–5 sentences) called "Banner Brief" that synthesizes:`,
            `layout type + composition, background style and primary colors, typography style and weight,`,
            `whether icons/illustrations/photography are used and what kind,`,
            `decorative shapes and their positions, CTA style, and overall tone/mood.`,
            `Make it actionable enough to hand to a renderer. No bullet points. Start with "Banner Brief:"`,
          ].join('\n'),
        },
      ],
      maxTokens: 300,
      temperature: 0.3,
      agentKey: 'canva',
    });

    const bannerBrief = briefRes.content.replace(/^Banner Brief:\s*/i, '').trim();

    const patternContent = [
      `Learned design patterns for brand: ${effectiveBrand}`,
      `Based on ${designSamples.length} design samples (${dnaList.length} with full DNA).`,
      '',
      `Banner Brief: ${bannerBrief}`,
      '',
      patterns.map((p, i) => `${i + 1}. ${p}`).join('\n'),
    ].join('\n');

    // Remove old pattern entries for this brand
    const oldPatterns = await this.db.db
      .select({ id: knowledgeEntries.id })
      .from(knowledgeEntries)
      .where(and(
        eq(knowledgeEntries.entryType, 'design_pattern'),
        eq(knowledgeEntries.agentKeys, 'canva'),
        eq(knowledgeEntries.siteKeys, effectiveBrand),
      ));
    for (const old of oldPatterns) {
      await this.kb.deleteEntry(old.id).catch(() => {});
    }

    await this.kb.createEntry({
      title: `Design Patterns — ${effectiveBrand} — ${new Date().toISOString().slice(0, 10)}`,
      content: patternContent,
      entryType: 'design_pattern',
      agentKeys: 'canva',
      siteKeys: effectiveBrand,
      category: 'design',
      sourceType: 'clustering',
    });

    this.logger.log(`Clustering complete: ${patterns.length} patterns for ${effectiveBrand}`);
    return { patternCount: patterns.length, patterns, bannerBrief };
  }

  async getDominantDNA(brand: string): Promise<DominantDNA | null> {
    const effectiveBrand = brand || 'default';

    const samples = await this.db.db
      .select({ content: knowledgeEntries.content })
      .from(knowledgeEntries)
      .where(and(
        eq(knowledgeEntries.entryType, 'design_sample'),
        eq(knowledgeEntries.agentKeys, 'canva'),
        eq(knowledgeEntries.siteKeys, effectiveBrand),
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

    // Collect representative shapes — one per shape_type, most frequent types first
    const shapeTypeCount: Record<string, number> = {};
    const shapeByType = new Map<string, DesignDNA['shape_elements'][0]>();
    for (const d of dnaList) {
      for (const s of d.shape_elements ?? []) {
        shapeTypeCount[s.shape_type] = (shapeTypeCount[s.shape_type] ?? 0) + 1;
        if (!shapeByType.has(s.shape_type)) shapeByType.set(s.shape_type, s);
      }
    }
    const representativeShapes = Object.entries(shapeTypeCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type]) => shapeByType.get(type)!)
      .filter(Boolean);

    const patternEntry = await this.db.db
      .select({ content: knowledgeEntries.content })
      .from(knowledgeEntries)
      .where(and(
        eq(knowledgeEntries.entryType, 'design_pattern'),
        eq(knowledgeEntries.agentKeys, 'canva'),
        eq(knowledgeEntries.siteKeys, effectiveBrand),
      ))
      .limit(1);

    const patternContent = patternEntry[0]?.content ?? '';

    const patternRules = patternContent
      .split('\n')
      .filter(l => /^\d+\./.test(l.trim()))
      .map(l => l.replace(/^\d+\.\s*/, '').trim())
      .filter(Boolean);

    // Extract banner brief from pattern content (stored as "Banner Brief: ..." line)
    const bannerBriefMatch = patternContent.match(/^Banner Brief:\s*(.+)$/m);
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
    };
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

  async getPatterns(brand?: string): Promise<string[]> {
    const effectiveBrand = brand || 'default';
    const rows = await this.db.db
      .select({ content: knowledgeEntries.content })
      .from(knowledgeEntries)
      .where(and(
        eq(knowledgeEntries.entryType, 'design_pattern'),
        eq(knowledgeEntries.agentKeys, 'canva'),
        eq(knowledgeEntries.siteKeys, effectiveBrand),
      ));
    if (!rows.length) return [];
    // Extract numbered list items from the stored pattern content
    return rows.flatMap(r =>
      r.content
        .split('\n')
        .filter(line => /^\d+\./.test(line.trim()))
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
        .filter(Boolean),
    );
  }
}
