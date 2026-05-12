export type PostPlatform = 'linkedin' | 'instagram' | 'twitter' | 'facebook';
export type PostCategory = 'carousel' | 'single' | 'story';
export type SlideRole = 'cover' | 'content' | 'stat' | 'quote' | 'list' | 'cta';
export type LayoutType = 'centered' | 'left-aligned' | 'split-panel' | 'overlay' | 'list-layout';
export type BackgroundVariant = 'brand-primary' | 'brand-secondary' | 'white' | 'dark' | 'gradient';
export type TextColorMode = 'auto' | 'white' | 'dark';
export type AccentType = 'top-bar' | 'bottom-bar' | 'left-stripe' | 'none';
export type ContentSlotType =
  | 'headline'
  | 'body'
  | 'stat_number'
  | 'stat_label'
  | 'list_items'
  | 'cta'
  | 'quote'
  | 'attribution'
  | 'image_prompt';

export type ImageProvider = 'auto' | 'openai' | 'gemini' | 'dalle2';
export type RenderStatus = 'draft' | 'approved' | 'published' | 'rejected';

export interface ContentSlot {
  id: string;
  type: ContentSlotType;
  required: boolean;
  maxChars: number;
  constraints: string[];
  hint: string;
}

export interface StyleRules {
  backgroundVariant: BackgroundVariant;
  backgroundType?: 'solid' | 'gradient' | 'ai-image';
  textPrimary: TextColorMode;
  accentType: AccentType;
  showLogo: boolean;
  showSlideIndicator: boolean;
  showBrandBar: boolean;
}

export interface SlideSchema {
  role: SlideRole;
  layout: LayoutType;
  styleRules: StyleRules;
  slots: ContentSlot[];
}

export interface PostFormat {
  id: string;
  name: string;
  description: string;
  platform: PostPlatform;
  category: PostCategory;
  dimensions: { width: number; height: number };
  slides: SlideSchema[];
}

// Filled by AI for a render session
export interface FilledSlot {
  id: string;
  type: ContentSlotType;
  value: string | string[];
}

export interface FilledSlide {
  slideIndex: number;
  role: SlideRole;
  layout: LayoutType;
  slots: Record<string, string | string[]>;
  styleRules: StyleRules;
}

// Resolved brand identity (loaded from canvaBrands + Google Fonts + Minio logo)
export interface ResolvedBrand {
  name: string;
  palette: string[];           // hex array [primary, secondary, accent, ...]
  headingFont: string;
  bodyFont: string;
  headingFontData: ArrayBuffer;
  bodyFontData: ArrayBuffer;
  logoBase64?: string;         // data:image/png;base64,...
  voiceProfile?: string;
}

// Locked once per render session; all slides read from this
export interface ThemeContract {
  // Colors
  backgroundCover: string;
  backgroundContent: string;
  backgroundCta: string;
  accentColor: string;
  headlineColor: string;
  bodyColor: string;
  subtextColor: string;

  // Typography
  headingFont: string;
  bodyFont: string;
  headingFontData: ArrayBuffer;
  bodyFontData: ArrayBuffer;
  headingSize: number;
  bodySize: number;
  lineHeight: number;

  // Layout
  paddingX: number;
  paddingY: number;
  accentBar: { position: 'top' | 'left' | 'none'; thickness: number; color: string };
  logo: { position: 'bottom-left' | 'bottom-right'; heightPx: number; base64: string } | null;
  indicator: { position: 'bottom-center' | 'bottom-right'; format: 'N/T' | 'dot' };

  // Content constraints
  headlineMaxChars: number;
  bodyMaxChars: number;
  listItemsMax: number;

  // Session metadata
  totalSlides: number;
  brand: string;
  formatId: string;
  generatedAt: string;
}

// Design DNA extracted from a sample image by vision LLM
export interface DesignDNA {
  layout_type: 'centered' | 'left-aligned' | 'split-panel' | 'overlay' | 'grid';
  background_style: 'solid-light' | 'solid-dark' | 'gradient-dark' | 'gradient-light' | 'textured';
  primary_color: string;
  accent_color: string;
  font_weight_heading: 'bold' | 'black' | 'semibold' | 'regular';
  font_size_heading: 'large' | 'xlarge' | 'huge';
  font_style: 'modern-sans' | 'classic-serif' | 'geometric' | 'rounded';
  element_density: 'minimal' | 'moderate' | 'rich';
  visual_hierarchy: string[];
  composition: 'rule-of-thirds' | 'center-weighted' | 'edge-anchored' | 'full-bleed';
  text_alignment: 'left' | 'center' | 'right';
  accent_elements: string[];
  whitespace: 'generous' | 'moderate' | 'tight';
  mood_keywords: string[];
  platform_fit: PostPlatform[];
  slide_type: SlideRole | 'cover' | 'content';
  background_image_used: boolean;
}

export interface RenderRequest {
  formatId: string;
  brand: string;
  topic?: string;
  intent?: string;
  imageProvider?: ImageProvider;
}

export interface RenderResult {
  id: string;
  formatId: string;
  brand: string;
  slideUrls: string[];
  status: RenderStatus;
  filledContent: Record<string, Record<string, string | string[]>>;
  createdAt: Date;
}

export interface ValidationResult {
  ok: boolean;
  warnings: string[];
  errors: string[];
  corrected: boolean;
}
