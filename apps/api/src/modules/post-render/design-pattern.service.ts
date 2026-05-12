import { Injectable, Logger } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { LlmRouterService } from '../llm/llm-router.service';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';
import { DbService } from '../../db/db.service';
import { knowledgeEntries } from '../knowledge-base/schema';

const MIN_SAMPLES_FOR_CLUSTERING = 3;

@Injectable()
export class DesignPatternService {
  private readonly logger = new Logger(DesignPatternService.name);

  constructor(
    private readonly llm: LlmRouterService,
    private readonly kb: KnowledgeBaseService,
    private readonly db: DbService,
  ) {}

  async cluster(brand: string): Promise<{ patternCount: number; patterns: string[] }> {
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
      return { patternCount: 0, patterns: [] };
    }

    this.logger.log(`Clustering ${designSamples.length} samples for brand: ${effectiveBrand}`);

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
            `Brand: ${effectiveBrand}`,
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

    const patternContent = [
      `Learned design patterns for brand: ${effectiveBrand}`,
      `Based on ${designSamples.length} sample images.`,
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
    return { patternCount: patterns.length, patterns };
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
