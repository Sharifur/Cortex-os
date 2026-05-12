import { Injectable, Logger } from '@nestjs/common';
import { LlmRouterService } from '../llm/llm-router.service';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';

const MIN_SAMPLES_FOR_CLUSTERING = 20;

@Injectable()
export class DesignPatternService {
  private readonly logger = new Logger(DesignPatternService.name);

  constructor(
    private readonly llm: LlmRouterService,
    private readonly kb: KnowledgeBaseService,
  ) {}

  async cluster(brand: string): Promise<{ patternCount: number; patterns: string[] }> {
    const samples = await this.kb.searchEntries('design sample', 'canva', 200, brand);
    const designSamples = samples.filter(s => s.entryType === 'design_sample');

    if (designSamples.length < MIN_SAMPLES_FOR_CLUSTERING) {
      this.logger.warn(`Not enough samples for clustering: ${designSamples.length}/${MIN_SAMPLES_FOR_CLUSTERING}`);
      return { patternCount: 0, patterns: [] };
    }

    this.logger.log(`Clustering ${designSamples.length} samples for brand: ${brand}`);

    const sampleTexts = designSamples.slice(0, 80).map(s => s.content.slice(0, 300)).join('\n---\n');

    const res = await this.llm.complete({
      messages: [
        {
          role: 'system',
          content: `You are a design strategist. Analyse these design sample summaries and extract dominant patterns.`,
        },
        {
          role: 'user',
          content: [
            `Brand: ${brand}`,
            `Samples (${designSamples.length} total, showing ${Math.min(designSamples.length, 80)}):`,
            sampleTexts,
            '',
            'Summarise the dominant design patterns into 3–5 reusable style rules.',
            'Each rule: 1–2 sentences. Be specific about colors, layout, typography, whitespace.',
            'Format: numbered list. No preamble.',
          ].join('\n'),
        },
      ],
      maxTokens: 600,
      temperature: 0.3,
      agentKey: 'canva',
    });

    const patterns = res.content
      .split('\n')
      .filter(line => /^\d+\./.test(line.trim()))
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      .filter(Boolean);

    // Store as design_pattern KB entry (always-on for this brand)
    const patternContent = [
      `Learned design patterns for brand: ${brand}`,
      `Based on ${designSamples.length} sample images.`,
      '',
      patterns.map((p, i) => `${i + 1}. ${p}`).join('\n'),
    ].join('\n');

    // Remove old pattern entry for this brand if it exists
    const oldPatterns = samples.filter(s => s.entryType === 'design_pattern');
    for (const old of oldPatterns) {
      await this.kb.deleteEntry(old.id).catch(() => {});
    }

    await this.kb.createEntry({
      title: `Design Patterns — ${brand} — ${new Date().toISOString().slice(0, 10)}`,
      content: patternContent,
      entryType: 'design_pattern',
      agentKeys: 'canva',
      siteKeys: brand,
      category: 'design',
      sourceType: 'clustering',
    });

    this.logger.log(`Clustering complete: ${patterns.length} patterns for ${brand}`);
    return { patternCount: patterns.length, patterns };
  }

  async getPatterns(brand: string): Promise<string[]> {
    const entries = await this.kb.getAlwaysOnContext('canva', brand);
    const patternEntries = entries.filter((e: { entryType?: string }) => e.entryType === 'design_pattern');
    if (!patternEntries.length) return [];
    return patternEntries.map((e: { content: string }) => e.content);
  }
}
