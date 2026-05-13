import { Injectable, Logger } from '@nestjs/common';
import { LlmRouterService } from '../llm/llm-router.service';
import type { FilledSlide, ThemeContract, SlideVisualSpec } from './types';

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
    opts: { runId?: string } = {},
  ): Promise<SlideVisualSpec[]> {
    const groups: Record<string, string[]> = {};
    for (const r of patternRules) {
      const tag = r.match(TAG_RE)?.[1] ?? 'OTHER';
      if (VISUAL_TAGS.has(tag)) {
        (groups[tag] ??= []).push(r);
      }
    }

    if (!Object.keys(groups).length) return [];

    // Shuffle each tag's rules so different patterns are emphasised on every render
    const patternBlock = Object.entries(groups)
      .map(([tag, rules]) => `[${tag}]\n${shuffle(rules).slice(0, 6).map(r => `  ${r}`).join('\n')}`)
      .join('\n\n');

    const slideList = filledSlides
      .map(s => {
        const headline = s.slots['headline'];
        const preview = typeof headline === 'string' ? headline.slice(0, 50) : '';
        return `${s.slideIndex} (${s.role}): "${preview}"`;
      })
      .join('\n');

    // Nudge with a random seed phrase so the LLM does not repeat a cached answer
    const nudge = Math.random().toString(36).slice(2, 8);

    const systemPrompt = [
      'You are a graphic designer generating per-slide visual specs for carousel rendering.',
      'Translate brand pattern rules into concrete color and shape data.',
      'Be faithful to the brand palette and shapes described in the patterns.',
      'Vary decoration placement, size, and combination per slide — do not repeat the same shape on every slide.',
      `Session seed: ${nudge}`,
    ].join(' ');

    const userPrompt = [
      'Brand design pattern rules (randomly sampled subset — use these to drive the visual design):',
      patternBlock,
      '',
      `Brand base colors — cover bg: ${contract.backgroundCover}, accent: ${contract.accentColor}, content bg: ${contract.backgroundContent}`,
      '',
      'Slides to style:',
      slideList,
      '',
      'For each slide produce:',
      '- bgColor: hex background derived from the pattern rules (use exact hex values from [COLOR] or [BACKGROUND] rules)',
      '- accentColor: hex accent override (null to keep brand default; use hex from [COLOR] rules when available)',
      '- decorations: 1-4 shapes per slide. Use [SHAPE] pattern rules for inspiration.',
      '  Positions are % of canvas (0-100). Negative x/y allowed for partial-edge shapes.',
      '  Shape types: circle, rectangle, rounded-rect, ellipse',
      '  Fill types: solid, linear-gradient, none',
      '  Vary placement: top-right corner, bottom-left bleed, center-background, left-edge strip, etc.',
      '  Opacity: 0.05-0.18 (subtle decorative — should not obscure text).',
      '  Each slide should have a distinct shape arrangement.',
      '',
      'Return ONLY valid JSON (no markdown, no explanation):',
      '{"slides":[{"slideIndex":0,"bgColor":"#hex","accentColor":"#hex","decorations":[{"shape_type":"circle","fill_type":"solid","fill_colors":["#hex"],"opacity":0.08,"x":70,"y":-15,"w":55,"h":55}]}]}',
    ].join('\n');

    let raw = '';
    try {
      const res = await this.llm.complete({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        maxTokens: 2000,
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
      const specs = (parsed.slides ?? []).map(s => ({
        ...s,
        accentColor: s.accentColor || undefined,
        decorations: (s.decorations ?? []).slice(0, 4).map(d => ({
          ...d,
          opacity: Math.min(Math.max(d.opacity, 0.03), 0.18),
        })),
      }));
      this.logger.log(`Visual specs: ${specs.length} slides, ${specs.reduce((n, s) => n + (s.decorations?.length ?? 0), 0)} decorations from ${patternRules.length} patterns`);
      return specs;
    } catch {
      this.logger.warn('Visual spec JSON parse failed — using ThemeContract defaults');
      return [];
    }
  }
}
