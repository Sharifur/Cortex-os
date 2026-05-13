import type { ThemeContract, FilledSlide, StyleRules, SlideVisualSpec } from '../types';

export function resolveAccent(contract: ThemeContract, visualSpec?: SlideVisualSpec): string {
  return (visualSpec?.accentColor) ?? contract.accentColor;
}

export function resolveVisualBackground(styleRules: StyleRules, contract: ThemeContract, visualSpec?: SlideVisualSpec): string {
  if (visualSpec?.bgColor) return visualSpec.bgColor;
  return resolveBackground(styleRules, contract);
}

export function resolveVisualBackgroundStyle(styleRules: StyleRules, contract: ThemeContract, visualSpec?: SlideVisualSpec): object {
  if (visualSpec?.bgGradient) return { backgroundImage: visualSpec.bgGradient };
  if (visualSpec?.bgColor) return { backgroundColor: visualSpec.bgColor };
  return resolveBackgroundStyle(styleRules, contract);
}

export function renderDecorations(contract: ThemeContract, width: number, height: number, visualSpec?: SlideVisualSpec): object[] {
  const shapes = (visualSpec?.decorations?.length ? visualSpec.decorations : null) ?? contract.decorations ?? [];
  if (!shapes.length) return [];
  return shapes.map(shape => {
    const x = Math.round(shape.x / 100 * width);
    const y = Math.round(shape.y / 100 * height);
    const w = Math.round(shape.w / 100 * width);
    const h = Math.round(shape.h / 100 * height);

    let bgStyle: object;
    if (shape.fill_type === 'linear-gradient' && shape.fill_colors.length >= 2) {
      bgStyle = { backgroundImage: `linear-gradient(${shape.gradient_angle ?? 135}deg, ${shape.fill_colors[0]}, ${shape.fill_colors[1]})` };
    } else if (shape.fill_type === 'none') {
      bgStyle = { backgroundColor: 'transparent' };
    } else {
      bgStyle = { backgroundColor: shape.fill_colors[0] ?? 'transparent' };
    }

    const shapeRadius =
      shape.border_radius != null ? Math.round(shape.border_radius / 100 * Math.min(w, h)) :
      shape.shape_type === 'circle' || shape.shape_type === 'ellipse' ? Math.min(w, h) / 2 :
      shape.shape_type === 'rounded-rect' ? 14 :
      shape.shape_type === 'pill' ? 999 : 0;

    return {
      type: 'div',
      props: {
        style: {
          position: 'absolute' as const,
          left: x, top: y, width: w, height: h,
          ...bgStyle,
          borderRadius: shapeRadius,
          opacity: shape.opacity,
          ...(shape.stroke_color ? { border: `${shape.stroke_width ?? 1}px solid ${shape.stroke_color}` } : {}),
        },
      },
    };
  });
}

export function ctaBorderRadius(contract: ThemeContract): number {
  switch (contract.ctaStyle) {
    case 'pill-button': return 999;
    case 'flat-button': return 4;
    case 'outlined-button': return contract.borderRadius || 8;
    default: return contract.borderRadius || 8;
  }
}

export function ctaStyle(cta: string, contract: ThemeContract, visualSpec?: SlideVisualSpec): object {
  const radius = ctaBorderRadius(contract);
  const accent = resolveAccent(contract, visualSpec);
  if (contract.ctaStyle === 'outlined-button') {
    return {
      marginTop: 32, padding: '12px 28px',
      backgroundColor: 'transparent',
      border: `2px solid ${accent}`,
      color: accent,
      fontWeight: 700, fontSize: 16,
      borderRadius: radius, display: 'flex',
      children: cta,
    };
  }
  if (contract.ctaStyle === 'text-link' || contract.ctaStyle === 'arrow-link') {
    return {
      marginTop: 24, color: accent,
      fontWeight: 700, fontSize: 16,
      display: 'flex',
      children: contract.ctaStyle === 'arrow-link' ? `${cta} →` : cta,
    };
  }
  return {
    marginTop: 32, padding: '12px 28px',
    backgroundColor: accent,
    color: '#ffffff', fontWeight: 700, fontSize: 16,
    borderRadius: radius, display: 'flex',
    children: cta,
  };
}

export function resolveBackground(styleRules: StyleRules, contract: ThemeContract): string {
  switch (styleRules.backgroundVariant) {
    case 'brand-primary': return contract.backgroundCover;
    case 'brand-secondary': return contract.backgroundCta;
    case 'dark': return '#111111';
    case 'white': return contract.backgroundContent;
    case 'gradient': return contract.backgroundCover;
    default: return contract.backgroundContent;
  }
}

export function resolveBackgroundStyle(styleRules: StyleRules, contract: ThemeContract): object {
  const v = styleRules.backgroundVariant;
  if (v === 'brand-primary' || v === 'gradient') {
    if (contract.backgroundCoverGradient) return { backgroundImage: contract.backgroundCoverGradient };
    return { backgroundColor: contract.backgroundCover };
  }
  if (v === 'brand-secondary') {
    if (contract.backgroundCtaGradient) return { backgroundImage: contract.backgroundCtaGradient };
    return { backgroundColor: contract.backgroundCta };
  }
  if (v === 'dark') return { backgroundColor: '#111111' };
  return { backgroundColor: contract.backgroundContent };
}

export function resolveTextColor(bg: string, contract: ThemeContract): string {
  const c = bg.replace('#', '');
  if (c.length < 6) return contract.headlineColor;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance < 128 ? '#ffffff' : '#111111';
}

export function slideIndicatorText(slideNumber: number, total: number): string {
  return `${slideNumber} / ${total}`;
}

export function getSlot(slide: FilledSlide, id: string): string {
  const val = slide.slots[id];
  if (Array.isArray(val)) return val.join('\n');
  return (val as string | undefined) ?? '';
}

export function getListSlot(slide: FilledSlide, id: string): string[] {
  const val = slide.slots[id];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') return val.split('\n').filter(Boolean);
  return [];
}
