import { Injectable, Logger } from '@nestjs/common';
import { LlmRouterService } from '../llm/llm-router.service';
import type { FilledSlide, ThemeContract, SlideVisualSpec } from './types';

const TAG_RE = /^\[([A-Z_]+)\]/;
const VISUAL_TAGS = new Set(['BACKGROUND', 'COLOR', 'SHAPE', 'LAYOUT', 'COMPOSITION', 'STYLE', 'BRANDING', 'GRID', 'SPACING']);

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

    const patternBlock = Object.entries(groups)
      .map(([tag, rules]) => `[${tag}]\n${rules.slice(0, 8).map(r => `  ${r}`).join('\n')}`)
      .join('\n\n');

    const slideList = filledSlides
      .map(s => {
        const headline = s.slots['headline'];
        const preview = typeof headline === 'string' ? headline.slice(0, 50) : '';
        return `${s.slideIndex} (${s.role}): "${preview}"`;
      })
      .join('\n');

    const systemPrompt = 'You are a graphic designer generating per-slide visual specs for carousel rendering. Translate brand pattern rules into concrete color and shape data. Be faithful to the pattern rules — use the exact hex colors and shapes described.';

    const userPrompt = [
      'Brand design pattern rules:',
      patternBlock,
      '',
      `Brand base colors — cover bg: ${contract.backgroundCover}, accent: ${contract.accentColor}, content bg: ${contract.backgroundContent}`,
      '',
      'Slides to style:',
      slideList,
      '',
      'For each slide produce:',
      '- bgColor: hex background (use pattern rules; null to keep brand default)',
      '- accentColor: hex accent override (null to keep brand default)',
      '- decorations: up to 3 shapes. Positions are % of canvas (0-100). Negative values allowed for partial visibility.',
      '  Shape types: circle, rectangle, rounded-rect, ellipse',
      '  Fill types: solid, linear-gradient, none',
      '  Keep opacity low (0.05-0.15) so shapes are subtle decorative elements.',
      '',
      'Return ONLY valid JSON (no markdown):',
      '{"slides":[{"slideIndex":0,"bgColor":"#hex","accentColor":"#hex","decorations":[{"shape_type":"circle","fill_type":"solid","fill_colors":["#hex"],"opacity":0.08,"x":70,"y":-15,"w":55,"h":55}]}]}',
    ].join('\n');

    let raw = '';
    try {
      const res = await this.llm.complete({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        maxTokens: 1800,
        temperature: 0.3,
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
        decorations: (s.decorations ?? []).map(d => ({
          ...d,
          opacity: Math.min(Math.max(d.opacity, 0.03), 0.2),
        })),
      }));
      this.logger.log(`Visual specs: ${specs.length} slides from ${patternRules.length} patterns`);
      return specs;
    } catch {
      this.logger.warn('Visual spec JSON parse failed — using ThemeContract defaults');
      return [];
    }
  }
}
