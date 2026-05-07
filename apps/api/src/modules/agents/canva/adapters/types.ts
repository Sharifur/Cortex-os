export type BackendType = 'canva' | 'ai_image' | 'local';

export type ContentCategory =
  | 'business'
  | 'marketing'
  | 'infographic'
  | 'announcement'
  | 'educational'
  | 'social_proof'
  | 'product'
  | 'seasonal';

export interface CarouselSlide {
  slideNumber: number;
  role: 'cover' | 'content' | 'cta';
  label: string;            // e.g. "Cover: Bold claim"
  headline: string;         // exact headline text for this slide
  body?: string;            // supporting text for this slide
  cta?: string;             // CTA text (on cta slides)
  visualFocus: string;      // what Canva should show visually on this slide
  elements: string[];       // specific visual elements for this slide
  colorAccent?: string;     // per-slide accent color override if needed
}

export type DesignIntent =
  | 'social_post'
  | 'presentation'
  | 'marketing_banner'
  | 'logo'
  | 'infographic'
  | 'print'
  | 'illustration'
  | 'custom';

export type CandidateStatus = 'pending' | 'approved' | 'rejected' | 'revised' | 'failed';
export type OutputFormat = 'png' | 'pdf' | 'svg' | 'jpg';

export interface DesignBrand {
  name?: string;       // taskip | xgenious
  kitId?: string;      // Canva brand kit ID
  palette?: string[];  // hex colors
  fonts?: string[];
  voiceProfile?: string;
}

export interface FacebookMarketingCopy {
  primaryText: string;         // main post copy shown above the image (125 chars optimal)
  headline: string;            // bold text in the link preview / ad card (40 chars max)
  description?: string;        // secondary line below headline (30 chars max)
  cta?: string;                // button label: "Shop Now" | "Learn More" | "Sign Up" | "Get Offer" | "Book Now"
  offerDetails?: string;       // e.g. "50% off this week only — use code LAUNCH50"
  socialProof?: string;        // e.g. "Trusted by 10,000+ teams"
  urgency?: string;            // e.g. "Offer ends Sunday"
  targetingNote?: string;      // copy angle hint, e.g. "speaking to pain of manual reporting"
}

export interface DesignBrief {
  intent: DesignIntent;
  subject: string;
  audience?: string;
  tone: string[];
  dimensions: { width: number; height: number; unit: 'px' };
  format: OutputFormat;
  brand: DesignBrand;
  copy?: {
    headline?: string;
    subheadline?: string;
    body?: string;
    cta?: string;
    disclaimer?: string;
    hashtags?: string[];
    // Facebook-specific copy fields
    facebook?: FacebookMarketingCopy;
  };
  references?: Array<{ type: 'image' | 'url' | 'design_id'; value: string }>;
  constraints?: string[];
  nCandidates: number;
  briefHash?: string;
  // Canva-specific rich design directions
  visualStyle?: string;           // e.g. "minimalist bold typography", "vibrant gradient"
  layoutDescription?: string;     // e.g. "hero image top half, headline centered, CTA bottom"
  elements?: string[];            // specific visual items: ["product mockup", "price badge", "star rating"]
  colorDirections?: string;       // e.g. "dominant #4F46E5 indigo, accent #F59E0B amber, white text"
  typographySuggestions?: string; // e.g. "bold 48px headline, regular 16px body, avoid serif"
  backgroundDescription?: string; // e.g. "dark navy gradient top-left to bottom-right"
  compositionNotes?: string;      // e.g. "rule of thirds, product left, text right, breathing room"
  moodKeywords?: string[];        // e.g. ["energetic", "trustworthy", "premium", "approachable"]
  platformContext?: string;       // e.g. "Instagram feed — needs to stop scroll in 0.5s"
  designDirections?: string[];    // explicit rules: ["no stock photo clipart", "use geometric shapes"]
  // Category & carousel
  category?: ContentCategory;
  isCarousel?: boolean;
  carouselSlides?: CarouselSlide[];
}

export interface GenerationTask {
  id: string;
  backend: BackendType;
  skill: string;
  brief: DesignBrief;
  variant?: string;   // A | B | C
  rationale: string;
}

export interface GenerationPlan {
  sessionId: string;
  brief: DesignBrief;
  tasks: GenerationTask[];
}

export interface Candidate {
  id: string;
  sessionId: string;
  backend: BackendType;
  tool: string;
  filePath?: string;
  format: OutputFormat;
  width?: number;
  height?: number;
  sizeBytes?: number;
  sha256?: string;
  phash?: string;
  parentCandidateId?: string;
  iteration: number;
  costUsd: number;
  rationale: string;
  canvaDesignId?: string;
  canvaEditUrl?: string;
  thumbnailPath?: string;
  status: CandidateStatus;
  error?: string;
}

export interface ImageRequest {
  prompt: string;
  negativePrompt?: string;
  size: { width: number; height: number };
  n: number;
  style?: 'natural' | 'vivid' | 'illustration' | 'photo-realistic';
  seed?: number;
  referenceImagePath?: string;
}

export interface ImageResult {
  bytes: Buffer;
  provider: string;
  model: string;
  seed?: number;
  costUsd: number;
}

export interface BackendAdapter {
  generate(task: GenerationTask): Promise<Candidate>;
}
