import { Injectable, Logger } from '@nestjs/common';
import type { FilledSlide, ThemeContract, ValidationResult } from './types';
import { LlmRouterService } from '../llm/llm-router.service';

@Injectable()
export class ConsistencyValidator {
  private readonly logger = new Logger(ConsistencyValidator.name);

  constructor(private readonly llm: LlmRouterService) {}

  async validate(slides: FilledSlide[], contract: ThemeContract): Promise<ValidationResult> {
    const warnings: string[] = [];
    const errors: string[] = [];
    let corrected = false;

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];

      // Slot completeness
      const headline = slide.slots['headline'];
      if (!headline && slide.role !== 'stat') {
        errors.push(`slide ${i}: missing required headline`);
      }

      // Headline length
      if (typeof headline === 'string' && headline.length > contract.headlineMaxChars) {
        warnings.push(`slide ${i}: headline truncated (${headline.length} > ${contract.headlineMaxChars})`);
        slide.slots['headline'] = headline.slice(0, contract.headlineMaxChars).trimEnd();
      }

      // Body length
      const body = slide.slots['body'];
      if (typeof body === 'string' && body.length > contract.bodyMaxChars) {
        warnings.push(`slide ${i}: body truncated (${body.length} > ${contract.bodyMaxChars})`);
        slide.slots['body'] = body.slice(0, contract.bodyMaxChars).trimEnd();
      }

      // List items count
      const listItems = slide.slots['list_items'];
      if (Array.isArray(listItems) && listItems.length > contract.listItemsMax) {
        warnings.push(`slide ${i}: list_items trimmed to ${contract.listItemsMax}`);
        slide.slots['list_items'] = listItems.slice(0, contract.listItemsMax);
      }
    }

    // Headline uniqueness among content slides
    const contentHeadlines = slides
      .filter(s => s.role === 'content' || s.role === 'list')
      .map(s => (s.slots['headline'] as string ?? '').toLowerCase().trim());
    const seen = new Set<string>();
    for (const h of contentHeadlines) {
      if (h && seen.has(h)) {
        warnings.push(`duplicate headline detected: "${h}"`);
      }
      seen.add(h);
    }

    // Count integrity — cover headline should not claim more tips than content slides exist
    const coverHeadline = slides[0]?.slots['headline'] as string | undefined;
    if (coverHeadline) {
      const numMatch = coverHeadline.match(/\b(\d+)\b/);
      if (numMatch) {
        const claimedCount = parseInt(numMatch[1], 10);
        const contentCount = slides.filter(s => s.role === 'content' || s.role === 'list').length;
        if (claimedCount !== contentCount && claimedCount > 1 && contentCount > 0) {
          warnings.push(`count mismatch: cover says "${claimedCount}" but ${contentCount} content slides exist`);
          // Run LLM correction
          try {
            const fixed = await this.fixCountMismatch(slides, claimedCount, contentCount, contract);
            if (fixed) {
              slides[0].slots['headline'] = fixed;
              corrected = true;
            }
          } catch (err) {
            this.logger.warn(`LLM count fix failed: ${(err as Error).message}`);
          }
        }
      }
    }

    const ok = errors.length === 0;
    return { ok, warnings, errors, corrected };
  }

  private async fixCountMismatch(
    slides: FilledSlide[],
    claimedCount: number,
    actualCount: number,
    contract: ThemeContract,
  ): Promise<string | null> {
    const coverHeadline = slides[0]?.slots['headline'] as string;
    const prompt = `The cover headline says "${coverHeadline}" but there are ${actualCount} content slides (not ${claimedCount}).
Rewrite the cover headline to correctly say "${actualCount}" instead. Keep all other words the same.
Reply with ONLY the corrected headline, no quotes, no explanation.`;

    const result = await this.llm.complete({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 80,
      temperature: 0.2,
    });
    const fixed = result.content?.trim();
    if (fixed && fixed.length > 0 && fixed.length <= contract.headlineMaxChars) return fixed;
    return null;
  }
}
