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
  backgroundCover: string;          // hex — used for text color computation
  backgroundContent: string;        // hex
  backgroundCta: string;            // hex
  backgroundCoverGradient?: string; // CSS gradient override for rendering
  backgroundCtaGradient?: string;   // CSS gradient override for rendering
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
  // Learned hex colors — extracted from dominant DNA samples
  dominant_primary_color: string;    // most frequent primary_color hex across all samples
  dominant_accent_color: string;     // most frequent accent_color hex
  dominant_headline_hex: string;     // most frequent headline text color
  dominant_cta_hex: string;          // most frequent CTA button background
  background_gradient_angle?: number; // angle when background_style includes 'gradient'
  // Per-slide-type learned backgrounds (only set when enough samples per type exist)
  slide_type_colors: Record<string, { bg: string; accent: string; textHex: string }>;
  // Per-slide-role dominant layout (only set when 3+ samples per role exist)
  slide_role_layouts: Partial<Record<string, LayoutType>>;
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
    shape_type: 'circle' | 'ellipse' | 'rectangle' | 'rounded-rect' | 'polygon' | 'diagonal-cut' | 'wave' | 'blob' | 'ring' | 'arc' | 'radial-glow' | 'custom-path';
    fill_type: 'solid' | 'linear-gradient' | 'radial-gradient' | 'none';
    fill_colors: string[];
    gradient_angle?: number;
    stroke_color?: string;
    stroke_width?: number;
    opacity: number;
    x: number; y: number; w: number; h: number;
    border_radius?: number;
    clipped_at_edge?: boolean;
    visible_arc?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'full' | 'top-half' | 'bottom-half';
    svg_hint: string;
  }>;

  // Overall illustration/scene narrative
  scene_composition?: {
    type: 'unified-scene' | 'scattered-icons' | 'single-character' | 'none';
    theme: 'business-growth' | 'ecommerce' | 'communication' | 'finance' | 'education' | 'health' | 'technology' | 'lifestyle' | 'custom';
    narrative: string;
    characters_present: string[];
    props_present: string[];
    element_relationships: Array<{
      element_a: string;
      relationship: 'inside' | 'riding' | 'holding' | 'pointing-at' | 'overlapping' | 'emerging-from' | 'connected-to' | 'standing-next-to';
      element_b: string;
      notes?: string;
    }>;
    scene_region?: { x: number; y: number; w: number; h: number };
  };

  // Recognisable illustrative / icon elements (not geometric shapes)
  decorative_illustrations?: Array<{
    subject: 'paper-plane' | 'geometric-arrow' | 'curved-arrow' | 'motion-lines' | 'dollar-sign' | 'dollar-sign-circle' | 'shopping-cart' | 'person-character' | 'star' | 'star-burst' | 'lightbulb' | 'leaf' | 'flower' | 'checkmark' | 'checkmark-circle' | 'quote-marks' | 'confetti' | 'lightning' | 'heart' | 'sparkle' | 'hand' | 'eye' | 'megaphone' | 'target' | 'clock' | 'growth-chart' | 'bar-chart' | 'pie-chart' | 'envelope' | 'phone' | 'lock' | 'globe' | 'trophy' | 'crown' | 'rocket' | 'coin' | 'badge' | 'tag' | 'speech-bubble' | 'custom';
    subject_description: string;
    render_style: 'outline-stroke' | 'filled-flat' | 'filled-gradient' | 'duotone' | 'hand-drawn' | 'emoji' | 'silhouette' | 'mixed';
    stroke_color?: string;
    fill_color?: string;
    stroke_width_style: 'hairline' | 'thin' | 'medium' | 'thick';
    opacity: number;
    semantic_role: 'decorative' | 'bullet-point' | 'cta-indicator' | 'brand-element' | 'section-divider' | 'scene-prop' | 'scene-character' | 'motion-indicator';
    scene_group?: 'main-scene' | 'scattered' | 'standalone';
    instances: Array<{
      x: number; y: number; w: number; h: number;
      rotation_deg?: number;
      size_relative: 'small' | 'medium' | 'large';
      z_index?: number;
      interacts_with?: string[];
    }>;
  }>;

  // Person, product, or object photos used as design elements
  photo_subjects?: Array<{
    subject_type: 'person-portrait' | 'person-halfbody' | 'person-fullbody' | 'person-group' | 'product' | 'object' | 'hands' | 'face-closeup';
    treatment: 'cutout' | 'full-frame' | 'circle-mask' | 'shape-mask' | 'blurred-bg';
    position_alignment: 'right-anchored' | 'left-anchored' | 'center' | 'bottom-anchored' | 'top-anchored' | 'corner-bottom-right' | 'corner-bottom-left';
    body_framing?: 'head-only' | 'head-shoulders' | 'waist-up' | 'full-body';
    x: number; y: number; w: number; h: number;
    z_index?: number;
    z_layer: 'background' | 'mid' | 'foreground';
    overlaps_with?: string[];
    description?: string;
  }>;

  // Painting order: element names from bottom layer to top layer (back → front)
  layer_stack?: string[];

  // Spatial layout — Elementor-style element positions (percentage of canvas width/height)
  element_positions: Array<{
    name: string;
    type: 'text' | 'icon' | 'illustration' | 'photo' | 'button' | 'shape' | 'logo' | 'bar' | 'divider';
    x: number;
    y: number;
    w: number;
    h: number;
    align: 'left' | 'center' | 'right';
    rotation_deg?: number;
    z_index?: number;
    z_layer: 'background' | 'mid' | 'foreground';
    overlaps_with?: string[];
  }>;

  // Per-text-layer detail — one entry per visually distinct text block
  text_elements?: Array<{
    role: 'eyebrow' | 'headline' | 'subheadline' | 'body' | 'caption' | 'stat-number' | 'stat-label' | 'list-item' | 'cta-label' | 'attribution' | 'slide-number' | 'tag' | 'watermark';
    content_preview: string;
    x: number;
    y: number;
    w: number;
    h: number;
    align: 'left' | 'center' | 'right';
    rotation_deg: number;
    font_weight: 'thin' | 'regular' | 'medium' | 'semibold' | 'bold' | 'black' | 'extrabold';
    font_style?: 'normal' | 'italic' | 'oblique';
    font_family_style?: 'modern-sans' | 'classic-serif' | 'geometric' | 'rounded' | 'slab-serif' | 'monospace' | 'display' | 'script';
    estimated_size_px: number;
    color_hex: string;
    background_hex: string;
    background_shape?: 'none' | 'rectangle' | 'rounded-rect' | 'pill' | 'squircle';
    background_rotation_deg?: number;
    letter_spacing: 'tight' | 'normal' | 'wide' | 'very-wide';
    line_height: 'tight' | 'normal' | 'relaxed';
    case_style: 'uppercase' | 'title-case' | 'sentence-case' | 'lowercase' | 'mixed';
    decoration: 'none' | 'underline' | 'strikethrough' | 'highlight-bg' | 'outline-stroke';
    is_multiline: boolean;
    line_count: number;
    opacity: number;
    z_index?: number;
    z_layer: 'background' | 'mid' | 'foreground';
    overlaps_with?: string[];
    word_highlights?: Array<{
      word_or_phrase: string;
      background_hex: string;
      background_shape: 'rectangle' | 'rounded-rect' | 'pill' | 'underline-bar';
      rotation_deg?: number;
      padding_h_px?: number;
      padding_v_px?: number;
      spans_line_width?: boolean;
    }>;
  }>;

  // Explicit overlap/layering relationships between elements
  composite_effects?: Array<{
    type: 'number-as-background' | 'word-highlight-shape' | 'layered-eyebrow' | 'inline-badge' | 'text-overlap' | 'shape-behind-text' | 'photo-behind-text';
    description: string;
    elements_involved: string[];
    bottom_element: string;
    top_element: string;
    overlap_region?: { x: number; y: number; w: number; h: number };
  }>;

  grid_columns: 1 | 2 | 3 | 4;
  content_zone: {
    x: number; y: number; w: number; h: number;
  };

  // Extended typography metadata
  typography?: {
    heading_case: 'uppercase' | 'title-case' | 'sentence-case' | 'mixed';
    heading_letter_spacing: 'tight' | 'normal' | 'wide' | 'very-wide';
    heading_line_height: 'tight' | 'normal' | 'relaxed';
    heading_word_count_typical: '1-3' | '4-6' | '7-10' | '10+';
    uses_eyebrow_label: boolean;
    eyebrow_style: 'none' | 'uppercase-small-caps' | 'colored-label' | 'outlined-tag';
    body_present: boolean;
    body_line_count_typical: '1' | '2-3' | '4-6' | 'block';
    font_mix: 'single-font' | 'two-fonts' | 'three-plus-fonts';
    heading_estimated_size_px: number;
    body_estimated_size_px: number;
    uses_highlight_text: boolean;
    highlight_style: 'none' | 'colored-word' | 'underline' | 'background-highlight' | 'bold-word';
  };

  // Spacing rhythm metadata
  spacing?: {
    outer_padding_style: 'tight-5' | 'medium-8' | 'comfortable-10' | 'generous-12-plus';
    headline_to_body_gap: 'tight' | 'medium' | 'large';
    element_vertical_rhythm: 'tight' | 'even' | 'spacious';
    cta_margin_top: 'tight' | 'medium' | 'large';
    logo_margin: 'flush' | 'small' | 'medium' | 'large';
  };

  // Exact hex values per role
  color_usage?: {
    background_hex?: string;
    headline_text_hex?: string;
    body_text_hex?: string;
    cta_background_hex?: string;
    cta_text_hex?: string;
    accent_bar_hex?: string;
    icon_color_hex?: string;
  };

  // Content pattern analysis
  text_content_pattern?: {
    headline_starts_with: 'number' | 'question' | 'verb' | 'noun' | 'adjective' | 'proper-noun';
    uses_brand_name_in_headline: boolean;
    has_social_handle: boolean;
    has_url: boolean;
    has_tagline: boolean;
    has_copyright: boolean;
  };

  // Free-text observations
  pattern_notes: string;

  // Set when this DNA represents a full multi-slide carousel rather than a single slide
  carousel_slide_count?: number;
  carousel_slide_urls?: string[];  // R2 URLs for each slide in order (index 0 = cover)
}

export interface WordHighlight {
  word: string;
  bgColor: string;
  textColor?: string;
  borderRadius?: number;
}

export interface SlideVisualSpec {
  slideIndex: number;
  bgColor?: string;
  bgGradient?: string;
  accentColor?: string | null;
  wordHighlights?: WordHighlight[];
  decorations?: Array<{
    shape_type: string;
    fill_type: 'solid' | 'linear-gradient' | 'radial-gradient' | 'none';
    fill_colors: string[];
    gradient_angle?: number;
    stroke_color?: string;
    stroke_width?: number;
    opacity: number;
    x: number; y: number; w: number; h: number;
    border_radius?: number;
  }>;
}

export interface RenderRequest {
  formatId: string;
  brand: string;
  topic?: string;
  intent?: string;
  imageProvider?: ImageProvider;
  patternConsistency?: boolean;
  sampleId?: string;  // KB entry ID of a specific training sample — pins that sample's DNA for all slides
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
