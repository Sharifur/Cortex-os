import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { LlmRouterService } from '../../llm/llm-router.service';
import { CanvaBrandsService } from './canva-brands.service';
import { CanvaDebugService } from './canva-debug.service';
import type { DesignBrief, DesignIntent, OutputFormat } from './adapters/types';

const INTENT_KEYWORDS: Record<DesignIntent, string[]> = {
  social_post: ['post', 'instagram', 'facebook', 'tweet', 'x post', 'story', 'reel', 'tiktok', 'social'],
  presentation: ['slide', 'deck', 'presentation', 'pitch', 'keynote', 'powerpoint'],
  marketing_banner: ['banner', 'hero', 'ad', 'advertisement', 'web banner', 'header image', 'linkedin banner'],
  logo: ['logo', 'brand mark', 'icon', 'wordmark', 'logotype'],
  infographic: ['infographic', 'chart', 'data visual', 'timeline', 'stats'],
  print: ['print', 'flyer', 'brochure', 'poster', 'business card', 'pdf'],
  illustration: ['illustration', 'artwork', 'drawing', 'graphic', 'visual'],
  custom: [],
};

const DIMENSION_PRESETS: Record<string, { width: number; height: number }> = {
  '1080x1080': { width: 1080, height: 1080 },
  '1080x1920': { width: 1080, height: 1920 },
  '1920x1080': { width: 1920, height: 1080 },
  '1200x628':  { width: 1200, height: 628 },
  '1200x627':  { width: 1200, height: 627 },
  '800x800':   { width: 800, height: 800 },
  '1280x720':  { width: 1280, height: 720 },
};

const PARSE_SYSTEM = `You extract a structured design brief from a user's concept text.

Return ONLY valid JSON with this exact shape (no markdown, no explanation):
{
  "intent": "social_post|presentation|marketing_banner|logo|infographic|print|illustration|custom",
  "subject": "what the design is about",
  "audience": "target audience (optional)",
  "tone": ["array", "of", "tones"],
  "dimensions": { "width": 1080, "height": 1080, "unit": "px" },
  "format": "png|pdf|svg|jpg",
  "brandName": "detected brand name or null",
  "copy": { "headline": "optional", "subheadline": "optional", "cta": "optional" },
  "constraints": ["optional list of constraints"],
  "nCandidates": 3
}

Rules:
- intent: classify based on the concept text
- dimensions: infer from context (Instagram=1080x1080, LinkedIn banner=1200x628, story=1080x1920). Default 1080x1080
- format: default png unless print context → pdf
- tone: extract from adjectives (playful, professional, bold, minimal, etc.)
- brandName: extract "taskip" or "xgenious" or any other brand name mentioned
- nCandidates: default 3, honor if user specified a number`;

@Injectable()
export class ConceptParserService {
  private readonly logger = new Logger(ConceptParserService.name);

  constructor(
    private readonly llm: LlmRouterService,
    private readonly brands: CanvaBrandsService,
    private readonly debug: CanvaDebugService,
  ) {}

  async parse(
    conceptText: string,
    opts: { sessionId?: string; debugMode?: boolean } = {},
  ): Promise<DesignBrief> {
    const t0 = Date.now();

    const hintedIntent = this.hintIntent(conceptText);

    const res = await this.llm.complete({
      messages: [
        { role: 'system', content: PARSE_SYSTEM },
        { role: 'user', content: conceptText },
      ],
      agentKey: 'canva',
      maxTokens: 600,
    });

    let raw: any;
    try {
      const cleaned = res.content.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
      raw = JSON.parse(cleaned);
    } catch {
      this.logger.warn('ConceptParser: LLM returned invalid JSON, using fallback brief');
      raw = {
        intent: hintedIntent,
        subject: conceptText.slice(0, 100),
        tone: ['professional'],
        dimensions: { width: 1080, height: 1080, unit: 'px' },
        format: 'png',
        nCandidates: 3,
      };
    }

    // Validate/normalize intent
    const intent: DesignIntent = this.validIntent(raw.intent) ? raw.intent : hintedIntent;

    // Normalize dimensions
    const dims = this.normalizeDims(raw.dimensions);

    // Load brand identity if a brand name was detected
    const brandName: string | null = raw.brandName ?? null;
    let brandData: { kitId?: string; palette?: string[]; fonts?: string[]; voiceProfile?: string } = {};
    if (brandName) {
      const b = await this.brands.getByName(brandName.toLowerCase());
      if (b) {
        brandData = {
          kitId: b.canvaKitId ?? undefined,
          palette: b.palette,
          fonts: b.fonts,
          voiceProfile: b.voiceProfile,
        };
      }
    }

    const brief: DesignBrief = {
      intent,
      subject: String(raw.subject ?? conceptText.slice(0, 200)),
      audience: raw.audience || undefined,
      tone: Array.isArray(raw.tone) ? raw.tone : ['professional'],
      dimensions: dims,
      format: this.validFormat(raw.format) ? raw.format : 'png',
      brand: {
        name: brandName ?? undefined,
        ...brandData,
      },
      copy: raw.copy || undefined,
      constraints: Array.isArray(raw.constraints) ? raw.constraints : [],
      nCandidates: Math.min(Math.max(Number(raw.nCandidates) || 3, 1), 6),
    };

    // Compute brief hash for dedup/audit
    brief.briefHash = crypto.createHash('sha256').update(JSON.stringify(brief)).digest('hex');

    await this.debug.log({
      sessionId: opts.sessionId,
      step: 'parse',
      actor: 'ConceptParserService',
      data: { input: conceptText.slice(0, 300), output: brief },
      latencyMs: Date.now() - t0,
      debugMode: opts.debugMode ?? false,
    });

    return brief;
  }

  private hintIntent(text: string): DesignIntent {
    const lower = text.toLowerCase();
    for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS) as [DesignIntent, string[]][]) {
      if (keywords.some((k) => lower.includes(k))) return intent;
    }
    return 'custom';
  }

  private validIntent(v: unknown): v is DesignIntent {
    return typeof v === 'string' && Object.keys(INTENT_KEYWORDS).includes(v);
  }

  private validFormat(v: unknown): v is OutputFormat {
    return typeof v === 'string' && ['png', 'pdf', 'svg', 'jpg'].includes(v);
  }

  private normalizeDims(raw: any): { width: number; height: number; unit: 'px' } {
    if (raw && typeof raw.width === 'number' && typeof raw.height === 'number') {
      return { width: raw.width, height: raw.height, unit: 'px' };
    }
    const key = `${raw?.width}x${raw?.height}`;
    return DIMENSION_PRESETS[key] ? { ...DIMENSION_PRESETS[key], unit: 'px' } : { width: 1080, height: 1080, unit: 'px' };
  }
}
