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

export type ImageProvider = 'auto' | 'openai' | 'gemini' | 'stability' | 'dalle2';
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

  // Visual DNA applied from learned design samples (defaults used when no samples)
  borderRadius: number;           // px: 0=sharp, 6=slightly-rounded, 14=rounded, 999=pill
  ctaStyle: 'pill-button' | 'flat-button' | 'outlined-button' | 'text-link' | 'arrow-link';
  contentTone: string;
  moodKeywords: string[];
  iconStyle: string;
  illustrationStyle: string;
  photographyStyle: string;
  decorations: Array<{
    shape_type: string;
    fill_type: string;
    fill_colors: string[];
    gradient_angle?: number;
    stroke_color?: string;
    stroke_width?: number;
    opacity: number;
    x: number; y: number; w: number; h: number;
    border_radius?: number;
  }>;
}

// Aggregated dominant values across all design samples for a brand
export interface DominantDNA {
  sampleCount: number;
  layout_type: DesignDNA['layout_type'];
  whitespace: DesignDNA['whitespace'];
  text_alignment: DesignDNA['text_alignment'];
  accent_elements: string[];
  brand_bar: DesignDNA['brand_bar'];
  logo_placement: DesignDNA['logo_placement'];
  border_radius_style: DesignDNA['border_radius_style'];
  shadow_usage: DesignDNA['shadow_usage'];
  cta_style: DesignDNA['cta_style'];
  font_size_heading: DesignDNA['font_size_heading'];
  font_weight_heading: DesignDNA['font_weight_heading'];
  font_style: DesignDNA['font_style'];
  icon_style: DesignDNA['icon_style'];
  icon_count: DesignDNA['icon_count'];
  icon_size: DesignDNA['icon_size'];
  illustration_style: DesignDNA['illustration_style'];
  photography_style: DesignDNA['photography_style'];
  content_tone: DesignDNA['content_tone'];
  mood_keywords: string[];
  decoration_elements: string[];
  background_style: DesignDNA['background_style'];
  representative_shapes: DesignDNA['shape_elements'];
  pattern_rules: string[];
  banner_brief: string;
}

// Design DNA extracted from a sample image by vision LLM
export interface DesignDNA {
  // Layout & composition
  layout_type: 'centered' | 'left-aligned' | 'split-panel' | 'overlay' | 'grid' | 'diagonal' | 'asymmetric';
  composition: 'rule-of-thirds' | 'center-weighted' | 'edge-anchored' | 'full-bleed' | 'diagonal' | 'Z-pattern';
  text_alignment: 'left' | 'center' | 'right' | 'mixed';
  whitespace: 'generous' | 'moderate' | 'tight';
  element_density: 'minimal' | 'moderate' | 'rich';
  visual_hierarchy: string[];      // elements listed top-to-bottom order
  text_layers_count: 'single' | 'two' | 'three-plus';

  // Color
  primary_color: string;           // hex
  accent_color: string;            // hex
  secondary_colors: string[];      // additional hex colors present
  color_count: 'monochrome' | 'duotone' | 'tricolor' | 'full-palette';
  background_style: 'solid-light' | 'solid-dark' | 'gradient-dark' | 'gradient-light' | 'textured' | 'photo' | 'illustrated';
  background_image_used: boolean;
  background_texture: 'none' | 'grain' | 'noise' | 'grid' | 'dots' | 'lines' | 'organic' | 'geometric-pattern';

  // Typography
  font_weight_heading: 'thin' | 'regular' | 'medium' | 'semibold' | 'bold' | 'black' | 'extrabold';
  font_size_heading: 'small' | 'medium' | 'large' | 'xlarge' | 'huge' | 'display';
  font_style: 'modern-sans' | 'classic-serif' | 'geometric' | 'rounded' | 'slab-serif' | 'monospace' | 'display';
  body_font_style: 'modern-sans' | 'classic-serif' | 'geometric' | 'rounded';
  number_stat_style: 'none' | 'large-display-number' | 'badge' | 'inline-text';

  // Icons
  icon_style: 'none' | 'flat-filled' | 'flat-outlined' | 'duotone' | 'gradient' | 'hand-drawn' | 'emoji' | 'custom-illustration';
  icon_count: 'none' | 'single' | 'few-2-4' | 'many-5-plus';
  icon_size: 'none' | 'small-inline' | 'medium-decorative' | 'large-hero';

  // Illustrations & photography
  illustration_style: 'none' | 'vector-flat' | 'vector-3d' | 'hand-drawn' | 'isometric' | 'abstract-shape' | 'pattern-based' | 'character';
  photography_style: 'none' | 'lifestyle' | 'product' | 'abstract' | 'corporate' | 'conceptual' | 'mockup';

  // Decoration & visual details
  decoration_elements: string[];   // e.g. ['circles', 'gradient-blobs', 'wave', 'none']
  accent_elements: string[];       // e.g. ['top-bar', 'left-stripe', 'underline', 'badge']
  border_radius_style: 'sharp' | 'slightly-rounded' | 'rounded' | 'pill';
  shadow_usage: 'none' | 'subtle-text' | 'card-shadow' | 'dramatic';
  divider_style: 'none' | 'line' | 'gradient-line' | 'space-only';

  // Branding & structure
  logo_placement: 'none' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  brand_bar: 'none' | 'top' | 'bottom' | 'left' | 'right';
  cta_style: 'none' | 'pill-button' | 'flat-button' | 'outlined-button' | 'text-link' | 'arrow-link';

  // Content & tone
  slide_type: SlideRole | 'cover' | 'content' | 'testimonial';
  content_tone: 'formal' | 'casual' | 'punchy' | 'educational' | 'inspirational' | 'promotional';
  mood_keywords: string[];
  platform_fit: PostPlatform[];

  // Decorative shape details — enough info to regenerate via SVG
  shape_elements: Array<{
    shape_type: 'circle' | 'ellipse' | 'rectangle' | 'rounded-rect' | 'polygon' | 'diagonal-cut' | 'wave' | 'blob' | 'ring' | 'arc' | 'custom-path';
    fill_type: 'solid' | 'linear-gradient' | 'radial-gradient' | 'none';
    fill_colors: string[];          // hex colors; two entries for gradients
    gradient_angle?: number;        // degrees for linear gradients
    stroke_color?: string;          // hex, if outlined
    stroke_width?: number;          // px estimate
    opacity: number;                // 0–1
    x: number; y: number; w: number; h: number;  // % of canvas
    border_radius?: number;         // % of element size, for rounded shapes
    svg_hint: string;               // brief description to reconstruct, e.g. "circle fill #6366f1 opacity 0.15 at top-right corner, roughly 40% canvas width"
  }>;

  // Spatial layout — Elementor-style element positions (percentage of canvas width/height)
  element_positions: Array<{
    name: string;         // e.g. "logo", "eyebrow", "headline", "body", "icon", "cta-button", "brand-bar", "decoration-circle"
    type: 'text' | 'icon' | 'illustration' | 'photo' | 'button' | 'shape' | 'logo' | 'bar' | 'divider';
    x: number;            // left edge, 0–100% of canvas width
    y: number;            // top edge, 0–100% of canvas height
    w: number;            // width, 0–100% of canvas width
    h: number;            // height, 0–100% of canvas height
    align: 'left' | 'center' | 'right';
    z_layer: 'background' | 'mid' | 'foreground';
  }>;
  grid_columns: 1 | 2 | 3 | 4;   // column grid structure of the layout
  content_zone: {                   // main content bounding box as % of canvas
    x: number; y: number; w: number; h: number;
  };

  // Free-text observations
  pattern_notes: string;           // any notable detail not captured by fields above
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
