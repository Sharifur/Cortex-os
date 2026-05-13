import { Injectable, Logger } from '@nestjs/common';
import { LlmRouterService } from '../llm/llm-router.service';
import { SpamCheckerService } from '../spam-checker/spam-checker.service';
import type { PostFormat, FilledSlide, ThemeContract } from './types';

@Injectable()
export class PostContentService {
  private readonly logger = new Logger(PostContentService.name);

  constructor(
    private readonly llm: LlmRouterService,
    private readonly spam: SpamCheckerService,
  ) {}

  async fill(
    format: PostFormat,
    contract: ThemeContract,
    opts: {
      topic?: string;
      intent?: string;
      voiceProfile?: string;
      designContext?: string;
      contentTone?: string;
      moodKeywords?: string[];
      patternRules?: string[];
      runId?: string;
    },
  ): Promise<FilledSlide[]> {
    const slotSchemas = format.slides.map((s, i) => ({
      slideIndex: i,
      role: s.role,
      slots: s.slots.map(slot => ({
        id: slot.id,
        type: slot.type,
        required: slot.required,
        maxChars: slot.maxChars,
        constraints: slot.constraints,
        hint: slot.hint,
        isList: slot.type === 'list_items',
      })),
    }));

    const toneInstruction = opts.contentTone
      ? `Content tone: ${opts.contentTone}${opts.moodKeywords?.length ? ` — mood: ${opts.moodKeywords.join(', ')}` : ''}`
      : '';

    // Filter pattern rules: prioritise copy/text rules, then per-slide-type rules, then a few visual
    const COPY_KEYWORDS = /headline|body\s+text|copy|word|sentence|cta|tone|length|brief|punchy|concise|short|hook|question|number|stat|list item|bullet/i;
    const SLIDE_TYPE_KEYWORDS = /cover slide|content slide|cta slide|stat slide|list slide|quote slide/i;
    const rules = opts.patternRules ?? [];
    const copyRules = rules.filter(r => COPY_KEYWORDS.test(r)).slice(0, 20);
    const slideTypeRules = rules.filter(r => SLIDE_TYPE_KEYWORDS.test(r)).slice(0, 8);
    const remainingRules = rules.filter(r => !COPY_KEYWORDS.test(r) && !SLIDE_TYPE_KEYWORDS.test(r)).slice(0, 5);
    const selectedRules = [...copyRules, ...slideTypeRules, ...remainingRules];
    const patternContext = selectedRules.length
      ? `Learned brand content patterns — apply to copy style and length:\n${selectedRules.map((r, i) => `${i + 1}. ${r}`).join('\n')}`
      : '';

    const systemPrompt = [
      `You are a professional social media content strategist specialising in ${format.platform} ${format.category} posts.`,
      opts.voiceProfile ? `Brand voice: ${opts.voiceProfile}` : '',
      toneInstruction,
      patternContext,
      opts.designContext ? `Design context: ${opts.designContext}` : '',
    ].filter(Boolean).join('\n');

    const userPrompt = [
      `Create content for a ${format.name} about: "${opts.topic ?? 'our product'}"`,
      opts.intent ? `Intent: ${opts.intent}` : '',
      '',
      'Fill every slot below. Return ONLY valid JSON with this shape:',
      '{ "slides": [ { "slideIndex": N, "slots": { "slotId": "value" } }, ... ] }',
      '',
      'Slot specs:',
      JSON.stringify(slotSchemas, null, 2),
      '',
      'Rules:',
      `- Never exceed maxChars per slot`,
      `- list_items slots: return an array of strings, not a single string`,
      `- Match the brand voice exactly`,
      `- No hashtags, no emoji, no markdown formatting in values`,
      `- Headlines must be punchy, direct, no clickbait filler`,
    ].filter(Boolean).join('\n');

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
      throw new Error(`LLM slot fill failed: ${(err as Error).message}`);
    }

    // Extract JSON from markdown code fences if needed
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]+?)\s*```/) ?? raw.match(/(\{[\s\S]+\})/);
    const jsonStr = jsonMatch?.[1] ?? raw;

    let parsed: { slides: Array<{ slideIndex: number; slots: Record<string, string | string[]> }> };
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      throw new Error(`LLM returned invalid JSON for slot fill`);
    }

    const filledSlides: FilledSlide[] = format.slides.map((schema, i) => {
      const aiSlide = parsed.slides.find(s => s.slideIndex === i) ?? { slideIndex: i, slots: {} };
      return {
        slideIndex: i,
        role: schema.role,
        layout: schema.layout,
        styleRules: schema.styleRules,
        slots: aiSlide.slots ?? {},
      };
    });

    // Enforce maxChars and truncate
    for (const slide of filledSlides) {
      const schema = format.slides[slide.slideIndex];
      for (const slotDef of schema.slots) {
        const val = slide.slots[slotDef.id];
        if (typeof val === 'string' && val.length > slotDef.maxChars) {
          slide.slots[slotDef.id] = val.slice(0, slotDef.maxChars).trimEnd();
          this.logger.warn(`truncated slot ${slotDef.id} on slide ${slide.slideIndex}`);
        }
      }
    }

    // Spam check all text values (public-facing)
    await this.spamCheckSlides(filledSlides);

    return filledSlides;
  }

  private async spamCheckSlides(slides: FilledSlide[]): Promise<void> {
    const texts = slides.flatMap(s =>
      Object.values(s.slots)
        .filter((v): v is string => typeof v === 'string')
        .map(v => v.trim())
        .filter(v => v.length > 10),
    );
    if (!texts.length) return;

    try {
      const combined = texts.join(' ');
      const result = await this.spam.score({ subject: '', textBody: combined, fromDomain: 'internal', fromAddress: 'internal@internal', recipient: 'check@internal' });
      if (result.score > 70) {
        this.logger.warn(`content spam score ${result.score} — proceeding but flagged`);
      }
    } catch {
      // Non-fatal — spam check is best-effort for image content
    }
  }
}
