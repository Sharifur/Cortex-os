import { Injectable, Logger } from '@nestjs/common';
import type { ResolvedBrand, ThemeContract, PostFormat, DominantDNA } from './types';

function luminance(hex: string): number {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const toLinear = (v: number) => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

function pickTextColor(background: string): string {
  return contrastRatio(background, '#ffffff') >= 4.5 ? '#ffffff' : '#111111';
}

function darken(hex: string, amount = 0.15): string {
  const c = hex.replace('#', '');
  const r = Math.max(0, Math.round(parseInt(c.slice(0, 2), 16) * (1 - amount)));
  const g = Math.max(0, Math.round(parseInt(c.slice(2, 4), 16) * (1 - amount)));
  const b = Math.max(0, Math.round(parseInt(c.slice(4, 6), 16) * (1 - amount)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

@Injectable()
export class ThemeContractService {
  private readonly logger = new Logger(ThemeContractService.name);

  derive(brand: ResolvedBrand, format: PostFormat, dna?: DominantDNA | null): ThemeContract {
    const MIN_SAMPLES_FOR_LEARNED_COLORS = 20;
    const useLearned = !!(dna && dna.sampleCount >= MIN_SAMPLES_FOR_LEARNED_COLORS);

    // Background colors — prefer learned per-slide-type hex when enough samples exist
    const coverBg = useLearned
      ? (dna!.slide_type_colors?.['cover']?.bg || dna!.dominant_primary_color || brand.palette[0] || '#1e1b4b')
      : (brand.palette[0] ?? '#1e1b4b');

    const contentBg = useLearned
      ? (dna!.slide_type_colors?.['content']?.bg || '#ffffff')
      : '#ffffff';

    const ctaBg = useLearned
      ? (dna!.slide_type_colors?.['cta']?.bg || dna!.dominant_primary_color || brand.palette[1] || darken(coverBg, 0.1))
      : (brand.palette[1] ?? darken(coverBg, 0.1));

    const accent = useLearned
      ? (dna!.dominant_accent_color || brand.palette[2] || brand.palette[1] || '#6366f1')
      : (brand.palette[2] ?? brand.palette[1] ?? '#6366f1');

    const headlineColor = pickTextColor(contentBg);
    const bodyColor = headlineColor === '#ffffff' ? '#cccccc' : '#444444';
    const subtextColor = headlineColor === '#ffffff' ? '#aaaaaa' : '#888888';

    // Heading size from DNA font_size_heading
    const headingSizeMap: Record<string, number> = {
      small: 36, medium: 44, large: 52, xlarge: 64, huge: 76, display: 92,
    };
    const headingSize = headingSizeMap[dna?.font_size_heading ?? ''] ?? 52;

    // Padding from DNA whitespace
    const paddingMap: Record<string, number> = { tight: 40, moderate: 56, generous: 72 };
    const padding = paddingMap[dna?.whitespace ?? ''] ?? 56;

    // Accent bar position from dominant accent_elements
    const accentEls = dna?.accent_elements ?? [];
    const accentBarPosition: 'top' | 'left' | 'none' =
      accentEls.includes('left-stripe') || accentEls.includes('right-stripe') ? 'left' :
      accentEls.includes('top-bar') || accentEls.includes('bottom-bar') ? 'top' :
      accentEls.includes('none') || accentEls.length === 0 ? 'none' : 'top';

    // Logo position from DNA logo_placement
    const logoPositionMap: Record<string, 'bottom-left' | 'bottom-right'> = {
      'bottom-left': 'bottom-left', 'bottom-right': 'bottom-right',
      'top-left': 'bottom-left', 'top-right': 'bottom-right',
    };
    const logoPosition = logoPositionMap[dna?.logo_placement ?? ''] ?? 'bottom-left';

    // Border radius from DNA border_radius_style
    const borderRadiusMap: Record<string, number> = {
      sharp: 0, 'slightly-rounded': 6, rounded: 14, pill: 999,
    };
    const borderRadius = borderRadiusMap[dna?.border_radius_style ?? ''] ?? 10;

    // CTA style from DNA
    const ctaStyle = (dna?.cta_style && dna.cta_style !== 'none')
      ? dna.cta_style
      : 'pill-button' as const;

    // Body size: slightly larger for display/huge, smaller for tight whitespace
    const bodySize = headingSize >= 76 ? 18 : headingSize >= 64 ? 20 : 22;

    const totalSlides = format.slides.length;

    const contract: ThemeContract = {
      backgroundCover: coverBg,
      backgroundContent: contentBg,
      backgroundCta: ctaBg,
      accentColor: accent,
      headlineColor,
      bodyColor,
      subtextColor,

      headingFont: brand.headingFont,
      bodyFont: brand.bodyFont,
      headingFontData: brand.headingFontData,
      bodyFontData: brand.bodyFontData,
      headingSize,
      bodySize,
      lineHeight: dna?.whitespace === 'tight' ? 1.25 : 1.4,

      paddingX: padding,
      paddingY: padding,
      accentBar: { position: accentBarPosition, thickness: 6, color: accent },
      logo: brand.logoBase64
        ? { position: logoPosition, heightPx: 22, base64: brand.logoBase64 }
        : null,
      indicator: { position: 'bottom-right', format: 'N/T' },

      headlineMaxChars: headingSize >= 76 ? 45 : 65,
      bodyMaxChars: 220,
      listItemsMax: 6,

      totalSlides,
      brand: brand.name,
      formatId: format.id,
      generatedAt: new Date().toISOString(),

      borderRadius,
      ctaStyle,
      contentTone: dna?.content_tone ?? 'professional',
      moodKeywords: dna?.mood_keywords ?? [],
      iconStyle: dna?.icon_style ?? 'none',
      illustrationStyle: dna?.illustration_style ?? 'none',
      photographyStyle: dna?.photography_style ?? 'none',
      decorations: (dna?.representative_shapes ?? []).map(s => ({
        shape_type: s.shape_type,
        fill_type: s.fill_type,
        fill_colors: s.fill_colors,
        gradient_angle: s.gradient_angle,
        stroke_color: s.stroke_color,
        stroke_width: s.stroke_width,
        opacity: Math.min(s.opacity, 0.18), // cap opacity so decorations don't overwhelm content
        x: s.x, y: s.y, w: s.w, h: s.h,
        border_radius: s.border_radius,
      })),
    };

    this.logger.log(
      `Theme locked: ${brand.headingFont} accent:${accent} cover:${coverBg} content:${contentBg} cta:${ctaBg} ` +
      `radius:${borderRadius} cta-style:${ctaStyle} tone:${contract.contentTone}` +
      (dna ? ` [${dna.sampleCount} samples${useLearned ? ' - learned colors' : ''}]` : ' [no samples]'),
    );
    return contract;
  }
}
