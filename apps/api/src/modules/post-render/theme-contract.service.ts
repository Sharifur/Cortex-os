import { Injectable, Logger } from '@nestjs/common';
import type { ResolvedBrand, ThemeContract, PostFormat } from './types';

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

  derive(brand: ResolvedBrand, format: PostFormat, designContext?: string): ThemeContract {
    const primary = brand.palette[0] ?? '#1e1b4b';
    const secondary = brand.palette[1] ?? darken(primary, 0.1);
    const accent = brand.palette[2] ?? brand.palette[1] ?? '#6366f1';

    const headlineColor = pickTextColor('#ffffff') === '#ffffff' ? '#111111' : '#ffffff';
    const bodyColor = '#444444';
    const subtextColor = '#888888';

    // Derive sizing from design context hints (if available)
    let headingSize = 52;
    let paddingX = 56;
    let paddingY = 56;
    if (designContext) {
      if (designContext.includes('huge') || designContext.includes('xlarge')) headingSize = 68;
      else if (designContext.includes('large')) headingSize = 60;
      if (designContext.includes('tight')) { paddingX = 40; paddingY = 40; }
      else if (designContext.includes('generous')) { paddingX = 64; paddingY = 64; }
    }

    const accentBarPosition: 'top' | 'left' | 'none' =
      designContext?.includes('left-stripe') ? 'left' :
      designContext?.includes('none') ? 'none' : 'top';

    const totalSlides = format.slides.length;

    const contract: ThemeContract = {
      backgroundCover: primary,
      backgroundContent: '#ffffff',
      backgroundCta: secondary,
      accentColor: accent,
      headlineColor,
      bodyColor,
      subtextColor,

      headingFont: brand.headingFont,
      bodyFont: brand.bodyFont,
      headingFontData: brand.headingFontData,
      bodyFontData: brand.bodyFontData,
      headingSize,
      bodySize: 20,
      lineHeight: 1.4,

      paddingX,
      paddingY,
      accentBar: { position: accentBarPosition, thickness: 6, color: accent },
      logo: brand.logoBase64
        ? { position: 'bottom-left', heightPx: 22, base64: brand.logoBase64 }
        : null,
      indicator: { position: 'bottom-right', format: 'N/T' },

      headlineMaxChars: 60,
      bodyMaxChars: 200,
      listItemsMax: 6,

      totalSlides,
      brand: brand.name,
      formatId: format.id,
      generatedAt: new Date().toISOString(),
    };

    this.logger.log(`Theme locked: ${brand.headingFont} accent:${accent} bg:${primary}`);
    return contract;
  }
}
