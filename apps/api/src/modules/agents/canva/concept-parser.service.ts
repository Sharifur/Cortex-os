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

const PARSE_SYSTEM = `You are a senior creative director and Canva design specialist. Your job is to extract a deeply detailed design brief from a user's concept text that will be passed directly to Canva's AI design system. The more detail you provide, the better the output design.

Return ONLY valid JSON with this exact shape (no markdown, no explanation):
{
  "intent": "social_post|presentation|marketing_banner|logo|infographic|print|illustration|custom",
  "subject": "specific, detailed description of what the design is about",
  "audience": "precise target audience with demographics and context",
  "tone": ["array", "of", "emotional", "tones"],
  "dimensions": { "width": 1080, "height": 1080, "unit": "px" },
  "format": "png|pdf|svg|jpg",
  "brandName": "detected brand name or null",
  "copy": {
    "headline": "exact headline text — make it punchy and specific",
    "subheadline": "supporting text below headline",
    "body": "any body paragraph text if needed",
    "cta": "exact call-to-action button text",
    "disclaimer": "any fine print or disclaimer text",
    "hashtags": ["#relevant", "#hashtags", "#for", "#platform"],
    "facebook": {
      "primaryText": "main post copy shown above the image — 125 chars optimal, written for FB news feed — hook in first 3 words",
      "headline": "bold text in the link preview or ad card — 40 chars max, benefit-driven",
      "description": "secondary line below headline — 30 chars max",
      "cta": "Shop Now|Learn More|Sign Up|Get Offer|Book Now — pick the most relevant",
      "offerDetails": "specific offer text if applicable, e.g. '50% off this week — code LAUNCH50'",
      "socialProof": "trust signal if applicable, e.g. 'Trusted by 10,000+ teams'",
      "urgency": "urgency line if applicable, e.g. 'Offer ends Sunday midnight'",
      "targetingNote": "copy angle, e.g. 'speaking to pain of manual reporting for SMB owners'"
    }
  },
  "visualStyle": "2–3 sentence description of the visual aesthetic, e.g. 'Clean minimalist layout with bold sans-serif typography. Heavy use of negative space. Single dominant accent color on white background.'",
  "layoutDescription": "Step-by-step layout description, e.g. 'Full-bleed background image with 40% dark overlay. Brand logo top-left corner. Large bold headline centered at 60% height. Subheadline directly below in lighter weight. CTA button bottom-center with 16px padding.'",
  "elements": ["list", "every", "specific", "visual", "element", "to", "include", "e.g.", "product mockup", "star rating badge", "price tag", "brand logo", "background texture", "icon set"],
  "colorDirections": "Specific hex colors and usage rules, e.g. 'Primary: #4F46E5 indigo for backgrounds and buttons. Accent: #F59E0B amber for highlights. Text: #FFFFFF white on dark, #1F2937 dark gray on light. Avoid red entirely.'",
  "typographySuggestions": "Font weight, size hierarchy, and style instructions, e.g. 'Headline: bold/black weight, 52–64px, uppercase tracking. Subheadline: medium weight, 20–24px. Body: regular, 14–16px, line-height 1.6. Prefer geometric sans-serif like Inter, Poppins, or Montserrat.'",
  "backgroundDescription": "Detailed background description, e.g. 'Deep navy (#0F172A) to indigo (#4F46E5) diagonal gradient. Subtle geometric mesh pattern at 8% opacity. No photography.'",
  "compositionNotes": "Layout composition rules, e.g. 'Apply rule of thirds. Product image occupies left two-thirds. Text stack right third with generous padding. Bottom strip in accent color for CTA. Ensure 64px safe margin from all edges for social cropping.'",
  "moodKeywords": ["premium", "trustworthy", "energetic", "list", "3–6", "mood", "words"],
  "platformContext": "Where this will appear and what it must achieve, e.g. 'Instagram feed post — must stop scroll within 0.5 seconds. Will compete with high-production brand content. Viewer is a 25–40 year old SaaS founder on mobile.'",
  "designDirections": ["explicit do/dont rules", "e.g. no clipart or stock illustrations", "real product screenshots only", "keep text under 20 words total", "use only 2 fonts max"],
  "constraints": ["hard constraints the design must respect"],
  "nCandidates": 3
}

Critical rules:
- intent: classify based on the concept text
- dimensions: infer precisely from platform (Instagram square=1080x1080, story/reel=1080x1920, LinkedIn post=1200x627, LinkedIn banner=1584x396, Twitter/X post=1200x675, Facebook cover=820x312, YouTube thumbnail=1280x720, Pinterest=1000x1500). Default 1080x1080
- format: default png unless print context → pdf
- tone: extract emotional descriptors (playful, professional, bold, minimal, urgent, aspirational, friendly, authoritative)
- brandName: detect "taskip", "xgenious", or any other brand name in the text
- copy: write the ACTUAL text content — do not leave placeholders. If user only gave a topic, invent specific high-quality copy appropriate for the brand and platform
- copy.facebook: populate this sub-object ONLY when intent is social_post or marketing_banner AND the platform is Facebook or the user did not specify a platform (default to Facebook-ready copy). Leave null otherwise.
- visualStyle: be specific about design school/movement (flat design, neo-brutalism, glassmorphism, material design, Swiss grid, etc.)
- layoutDescription: describe exactly where each element sits on the canvas
- elements: be exhaustive — list every single visual component that should appear
- colorDirections: always provide specific hex codes when brand colors are known
- nCandidates: default 3, honor if user specified a number
- NEVER leave fields empty — always provide your best creative direction even when user input is sparse`;

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
      maxTokens: 1800,
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
      // Rich Canva-specific fields
      visualStyle: raw.visualStyle || undefined,
      layoutDescription: raw.layoutDescription || undefined,
      elements: Array.isArray(raw.elements) ? raw.elements : undefined,
      colorDirections: raw.colorDirections || undefined,
      typographySuggestions: raw.typographySuggestions || undefined,
      backgroundDescription: raw.backgroundDescription || undefined,
      compositionNotes: raw.compositionNotes || undefined,
      moodKeywords: Array.isArray(raw.moodKeywords) ? raw.moodKeywords : undefined,
      platformContext: raw.platformContext || undefined,
      designDirections: Array.isArray(raw.designDirections) ? raw.designDirections : undefined,
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
