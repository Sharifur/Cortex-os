import type { ThemeContract, FilledSlide, StyleRules } from '../types';

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
