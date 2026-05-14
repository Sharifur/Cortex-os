import { Injectable, Logger } from '@nestjs/common';
import { LlmRouterService } from '../llm/llm-router.service';
import type { FilledSlide, ThemeContract, SlideVisualSpec, DesignDNA } from './types';

const TAG_RE = /^\[([A-Z_]+)\]/;
const VISUAL_TAGS = new Set(['BACKGROUND', 'COLOR', 'SHAPE', 'LAYOUT', 'COMPOSITION', 'STYLE', 'BRANDING', 'GRID', 'SPACING']);

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

@Injectable()
export class PostVisualService {
  private readonly logger = new Logger(PostVisualService.name);

  constructor(private readonly llm: LlmRouterService) {}

  async generateSpecs(
    filledSlides: FilledSlide[],
    patternRules: string[],
    contract: ThemeContract,
    opts: { runId?: string; sampledDNA?: DesignDNA; perSlideDNAs?: (DesignDNA | null)[] } = {},
  ): Promise<SlideVisualSpec[]> {
    const { sampledDNA, perSlideDNAs } = opts;

    const groups: Record<string, string[]> = {};
    for (const r of patternRules) {
      const tag = r.match(TAG_RE)?.[1] ?? 'OTHER';
      if (VISUAL_TAGS.has(tag)) {
        (groups[tag] ??= []).push(r);
      }
    }

    const hasPatterns = Object.keys(groups).length > 0;
    const hasSampledDNA = !!(sampledDNA?.primary_color || sampledDNA?.accent_color);
    const hasPerSlide = !!(perSlideDNAs?.some(d => d?.primary_color || d?.accent_color));

    if (!hasPatterns && !hasSampledDNA && !hasPerSlide) return [];

    const patternBlock = hasPatterns
      ? Object.entries(groups)
        .map(([tag, rules]) => `[${tag}]\n${shuffle(rules).slice(0, 6).map(r => `  ${r}`).join('\n')}`)
        .join('\n\n')
      : '';

    const slideList = filledSlides
      .map(s => {
        const headline = s.slots['headline'];
        const preview = typeof headline === 'string' ? headline.slice(0, 50) : '';
        return `${s.slideIndex} (${s.role}): "${preview}"`;
      })
      .join('\n');

    // Per-slide color table — each slide gets a different training sample's colors
    const perSlideColorTable = (perSlideDNAs?.length)
      ? [
        'PER-SLIDE TRAINING COLORS (MANDATORY — use EXACTLY these colors, one per slide index):',
        ...filledSlides.map((slide, i) => {
          const dna = perSlideDNAs[i];
          const bg = dna?.primary_color || sampledDNA?.primary_color || contract.backgroundCover;
          const acc = dna?.accent_color || sampledDNA?.accent_color || contract.accentColor;
          const shapes = dna?.shape_elements?.slice(0, 2).map(s => s.shape_type).join(', ') || '';
          return `  Slide ${slide.slideIndex} (${slide.role}): bg=${bg} accent=${acc}${shapes ? ` shapes=[${shapes}]` : ''}`;
        }),
        '',
        'Each slide MUST use the bgColor specified for its index above. Do NOT repeat colors across slides.',
      ].join('\n')
      : '';

    // Fallback single-sample anchor block (used when no per-slide DNAs available)
    const sampledBlock = (!perSlideDNAs?.length && sampledDNA) ? [
      'TRAINING SAMPLE COLORS (use these as your primary color palette for this render):',
      `  background: ${sampledDNA.primary_color || contract.backgroundCover}`,
      `  accent: ${sampledDNA.accent_color || contract.accentColor}`,
      sampledDNA.secondary_colors?.length
        ? `  secondary: ${sampledDNA.secondary_colors.slice(0, 3).join(', ')}`
        : '',
      sampledDNA.shape_elements?.length
        ? `  shapes in sample: ${sampledDNA.shape_elements.slice(0, 3).map(s => s.shape_type).join(', ')}`
        : '',
    ].filter(Boolean).join('\n') : '';

    const nudge = Math.random().toString(36).slice(2, 8);

    const systemPrompt = [
      'You are a graphic designer generating per-slide visual specs for social media carousel rendering.',
      'Your job is to apply the training sample colors and brand patterns to make every slide visually rich and distinct.',
      'NEVER return null or "#ffffff" for bgColor — every slide must have a real color from the training data.',
      `Session seed: ${nudge}`,
    ].join(' ');

    const userPrompt = [
      perSlideColorTable || sampledBlock,
      '',
      hasPatterns ? `Brand design pattern rules (randomly sampled subset):\n${patternBlock}` : '',
      '',
      `Brand base colors — cover: ${contract.backgroundCover}, accent: ${contract.accentColor}, content: ${contract.backgroundContent}`,
      '',
      'Slides to style:',
      slideList,
      '',
      'For each slide produce:',
      '- bgColor: hex background — USE THE EXACT COLOR ASSIGNED TO THAT SLIDE INDEX ABOVE. Must be non-null and different for each slide.',
      '- accentColor: hex accent — use the assigned accent or a complementary color. Must be non-null.',
      '- decorations: 1-4 shapes per slide inspired by the training sample shapes.',
      '  Positions are % of canvas (0-100). Negative values OK for partial-edge shapes.',
      '  Shape types: circle, rectangle, rounded-rect, ellipse',
      '  Fill types: solid, linear-gradient, none',
      '  Opacity: 0.06-0.20. Vary placement: top-right corner, bottom-left bleed, center-background, etc.',
      '  Each slide should have a DIFFERENT shape arrangement.',
      '- wordHighlights: pick 1-2 words from the headline to receive a colored badge background.',
      '  Use the accent color or a contrasting color from the palette. Format: [{word, bgColor, textColor}].',
      '  Leave empty array [] if the headline is too short (under 4 words).',
      '',
      'Return ONLY valid JSON (no markdown):',
      '{"slides":[{"slideIndex":0,"bgColor":"#hex","accentColor":"#hex","decorations":[{"shape_type":"circle","fill_type":"solid","fill_colors":["#hex"],"opacity":0.1,"x":70,"y":-10,"w":50,"h":50}],"wordHighlights":[{"word":"target","bgColor":"#hex","textColor":"#fff"}]}]}',
    ].filter(Boolean).join('\n');

    let raw = '';
    try {
      const res = await this.llm.complete({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        maxTokens: 2200,
        temperature: 0.7,
        agentKey: 'canva',
        runId: opts.runId,
      });
      raw = res.content;
    } catch (err) {
      this.logger.warn(`Visual spec LLM call failed — using ThemeContract defaults: ${(err as Error).message}`);
      return [];
    }

    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]+?)\s*```/) ?? raw.match(/(\{[\s\S]+\})/);
    const jsonStr = jsonMatch?.[1] ?? raw;

    try {
      const parsed = JSON.parse(jsonStr) as { slides: SlideVisualSpec[] };

      const specs = (parsed.slides ?? []).map(s => {
        const slideIdx = s.slideIndex ?? 0;
        const perDNA = perSlideDNAs?.[slideIdx] ?? null;
        const fallbackBg = perDNA?.primary_color || sampledDNA?.primary_color || contract.backgroundCover;
        const fallbackAccent = perDNA?.accent_color || sampledDNA?.accent_color || contract.accentColor;
        return {
          ...s,
          // Enforce non-null colors — fall back to per-slide DNA colors, never white
          bgColor: (s.bgColor && s.bgColor !== '#ffffff' && s.bgColor !== '#fff') ? s.bgColor : fallbackBg,
          accentColor: s.accentColor || fallbackAccent,
          decorations: (s.decorations ?? []).slice(0, 4).map(d => ({
            ...d,
            opacity: Math.min(Math.max(d.opacity, 0.12), 0.35),
          })),
          wordHighlights: (s.wordHighlights ?? []).slice(0, 2),
        };
      });
      this.logger.log(
        `Visual specs: ${specs.length} slides, ` +
        `${specs.reduce((n, s) => n + (s.decorations?.length ?? 0), 0)} shapes, ` +
        `${specs.reduce((n, s) => n + (s.wordHighlights?.length ?? 0), 0)} word highlights`,
      );
      return specs;
    } catch {
      this.logger.warn('Visual spec JSON parse failed — using ThemeContract defaults');
      return [];
    }
  }
}
