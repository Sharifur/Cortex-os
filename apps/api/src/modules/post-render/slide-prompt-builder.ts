import type { DesignDNA, FilledSlide } from './types';

const BG_STYLE_MAP: Record<string, string> = {
  'solid-light': 'solid light',
  'solid-dark': 'solid dark',
  'gradient-dark': 'dark gradient',
  'gradient-light': 'light gradient',
  'textured': 'textured',
  'photo': 'photographic',
  'illustrated': 'illustrated',
};

const FONT_WEIGHT_MAP: Record<string, string> = {
  'thin': 'ultra-thin/light weight',
  'regular': 'regular weight',
  'medium': 'medium weight',
  'semibold': 'semibold',
  'bold': 'bold',
  'black': 'ultra-heavy black weight',
  'extrabold': 'extra-bold weight',
};

const FONT_SIZE_MAP: Record<string, string> = {
  'small': 'small compact text',
  'medium': 'medium-sized text',
  'large': 'large prominent text',
  'xlarge': 'very large text',
  'huge': 'huge oversized display text',
  'display': 'display-size oversized text filling most of the slide',
};

const FONT_STYLE_MAP: Record<string, string> = {
  'modern-sans': 'modern sans-serif',
  'classic-serif': 'classic serif',
  'geometric': 'geometric sans-serif',
  'rounded': 'rounded sans-serif',
  'slab-serif': 'slab serif',
  'monospace': 'monospace',
  'display': 'poster display font',
};

function shapePositionDesc(x: number, y: number): string {
  const h = x > 70 ? 'right edge' : x > 50 ? 'right side' : x < 10 ? 'left edge' : x < 30 ? 'left side' : 'center';
  const v = y < 15 ? 'top' : y > 70 ? 'bottom' : 'middle';
  return `${v}-${h}`;
}

function shapeSize(w: number): string {
  if (w > 50) return 'very large';
  if (w > 35) return 'large';
  if (w > 20) return 'medium';
  return 'small';
}

export function buildStylePromptBase(dna: DesignDNA): string {
  const bg = dna.color_usage?.background_hex || dna.primary_color || '#1e1e2e';
  const accent = dna.accent_color || '#ffffff';
  const headlineHex = dna.color_usage?.headline_text_hex || '#ffffff';
  const bodyHex = dna.color_usage?.body_text_hex || headlineHex;

  const parts: string[] = [];

  // Background
  const bgDesc = BG_STYLE_MAP[dna.background_style] ?? 'solid';
  parts.push(`Background: ${bgDesc} background color ${bg}.`);

  // Brand bar
  if (dna.brand_bar && dna.brand_bar !== 'none') {
    const barColor = dna.color_usage?.accent_bar_hex || accent;
    parts.push(`Thin ${dna.brand_bar} accent bar in ${barColor}.`);
  }

  // Typography
  const fontWeight = FONT_WEIGHT_MAP[dna.font_weight_heading] ?? 'bold';
  const fontSizeDesc = FONT_SIZE_MAP[dna.font_size_heading] ?? 'large text';
  const fontStyleDesc = FONT_STYLE_MAP[dna.font_style] ?? 'sans-serif';
  const textCase = dna.typography?.heading_case === 'uppercase' ? 'ALL CAPS'
    : dna.typography?.heading_case === 'title-case' ? 'title case'
    : 'sentence case';
  const letterSpacing = dna.typography?.heading_letter_spacing === 'very-wide' ? ', very wide letter spacing'
    : dna.typography?.heading_letter_spacing === 'wide' ? ', wide letter spacing'
    : '';
  parts.push(`Heading typography: ${fontWeight} ${fontStyleDesc}, ${fontSizeDesc}, ${textCase}${letterSpacing}, color ${headlineHex}.`);
  parts.push(`Body text color: ${bodyHex}.`);
  parts.push(`Text alignment: ${dna.text_alignment || 'left'}.`);

  if (dna.whitespace === 'generous') parts.push('Generous whitespace between elements.');

  // Eyebrow label
  if (dna.typography?.uses_eyebrow_label && dna.typography.eyebrow_style && dna.typography.eyebrow_style !== 'none') {
    parts.push(`Eyebrow label above headline in ${dna.typography.eyebrow_style} style.`);
  }

  // Word highlight style (from text_elements)
  const hlElem = (dna.text_elements ?? []).find(t => t.role === 'headline' && t.word_highlights && t.word_highlights.length > 0);
  if (hlElem?.word_highlights?.length) {
    const wh = hlElem.word_highlights[0];
    parts.push(`Key word(s) in headline have a ${wh.background_shape} colored background highlight in ${wh.background_hex}.`);
  }

  // Decorative geometric shapes (top 4)
  const shapes = (dna.shape_elements ?? []).slice(0, 4);
  if (shapes.length) {
    const shapeDescs = shapes.map(s => {
      const color = s.fill_colors[0] ?? accent;
      const clipped = s.clipped_at_edge ? ', clipped at edge' : '';
      return `${shapeSize(s.w)} ${s.shape_type} in ${color} at ${shapePositionDesc(s.x, s.y)} (opacity ${s.opacity.toFixed(2)}${clipped})`;
    });
    parts.push(`Geometric decorations: ${shapeDescs.join('; ')}.`);
  }

  // Accent elements
  const accents = (dna.accent_elements ?? []).filter(a => a && a !== 'none');
  if (accents.length) parts.push(`Design accents: ${accents.join(', ')}.`);

  // CTA style
  if (dna.cta_style && dna.cta_style !== 'none') {
    const ctaBg = dna.color_usage?.cta_background_hex || accent;
    const ctaText = dna.color_usage?.cta_text_hex || '#ffffff';
    parts.push(`CTA button: ${dna.cta_style}, background ${ctaBg}, text ${ctaText}.`);
  }

  // Border radius
  const radiusDesc = dna.border_radius_style === 'pill' ? 'Pill/fully-rounded shapes'
    : dna.border_radius_style === 'rounded' ? 'Rounded corners on shapes'
    : dna.border_radius_style === 'slightly-rounded' ? 'Slightly rounded corners'
    : 'Sharp corners';
  parts.push(`${radiusDesc}.`);

  // Color palette extras
  const extraColors = (dna.secondary_colors ?? []).slice(0, 2);
  if (extraColors.length) parts.push(`Additional palette colors: ${extraColors.join(', ')}.`);

  // Mood
  const moodWords = (dna.mood_keywords ?? []).slice(0, 3);
  if (dna.content_tone || moodWords.length) {
    parts.push(`Visual mood: ${[dna.content_tone, ...moodWords].filter(Boolean).join(', ')}.`);
  }

  return parts.filter(Boolean).join(' ');
}

export function buildSlideImagePrompt(
  base: string,
  slide: FilledSlide,
  dna: DesignDNA,
  slideNumber: number,
  totalSlides: number,
): string {
  const parts: string[] = [
    `Create a professional social media carousel slide image. Slide ${slideNumber} of ${totalSlides}.`,
    base,
  ];

  const headline = String(slide.slots['headline'] || '');
  if (headline) {
    const displayHeadline = dna.typography?.heading_case === 'uppercase' ? headline.toUpperCase() : headline;
    parts.push(`Headline text: "${displayHeadline}".`);
  }

  const body = String(slide.slots['body'] || '');
  if (body) parts.push(`Body text: "${body}".`);

  const rawList = slide.slots['list_items'];
  const listItems: string[] = Array.isArray(rawList)
    ? (rawList as string[])
    : typeof rawList === 'string'
      ? (rawList as string).split('\n').filter(Boolean)
      : [];
  if (listItems.length) {
    parts.push(`List items: ${listItems.map((item, i) => `${i + 1}. ${item}`).join(' | ')}.`);
  }

  const cta = String(slide.slots['cta'] || '');
  if (cta) parts.push(`CTA text: "${cta}".`);

  parts.push(`Slide counter "${slideNumber}/${totalSlides}" in a bottom corner.`);
  parts.push('No stock photos, no human faces, no external brand logos. Render all text exactly as written.');

  return parts.join(' ');
}
