import { Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { canvaBrands } from '../agents/canva/schema';
import type { ResolvedBrand } from './types';

const FONT_CACHE = new Map<string, ArrayBuffer>();
const LOGO_CACHE = new Map<string, string>();

const VALID_FONT_SIGNATURES = [
  '00010000', // TTF
  '4f54544f', // OTF ('OTTO')
  '774f4646', // WOFF ('wOFF')
  '774f4632', // WOFF2 ('wOF2')
  '74727565', // TrueType ('true')
];

function isValidFontBuffer(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 4) return false;
  const bytes = new Uint8Array(buf, 0, 4);
  const sig = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return VALID_FONT_SIGNATURES.includes(sig);
}

async function fetchFontFromGoogleCss(family: string, weight: number): Promise<ArrayBuffer | null> {
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`;
  const cssRes = await fetch(cssUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; node-fetch)' } });
  if (!cssRes.ok) return null;
  const css = await cssRes.text();
  const match = css.match(/url\((https:\/\/fonts\.gstatic\.com[^)]+)\)/);
  if (!match) return null;
  const fontRes = await fetch(match[1]);
  if (!fontRes.ok) return null;
  const buf = await fontRes.arrayBuffer();
  return isValidFontBuffer(buf) ? buf : null;
}

async function fetchFontData(family: string, weight = 400): Promise<ArrayBuffer> {
  const cacheKey = `${family}:${weight}`;
  if (FONT_CACHE.has(cacheKey)) return FONT_CACHE.get(cacheKey)!;

  // Try requested font
  try {
    const buf = await fetchFontFromGoogleCss(family, weight);
    if (buf) {
      FONT_CACHE.set(cacheKey, buf);
      return buf;
    }
  } catch {
    // fall through
  }

  // Try same font at weight 400 if non-400 weight failed (some fonts are regular-only)
  if (weight !== 400) {
    try {
      const buf = await fetchFontFromGoogleCss(family, 400);
      if (buf) {
        FONT_CACHE.set(cacheKey, buf);
        return buf;
      }
    } catch {
      // fall through
    }
  }

  // Final fallback: Inter via Google Fonts CSS (reliable, always TTF/WOFF2)
  const interKey = `Inter:${weight}`;
  if (!FONT_CACHE.has(interKey)) {
    const interWeight = weight >= 600 ? 700 : 400;
    const buf = await fetchFontFromGoogleCss('Inter', interWeight).catch(() => null);
    if (buf) FONT_CACHE.set(interKey, buf);
  }
  const fallback = FONT_CACHE.get(interKey);
  if (fallback) {
    FONT_CACHE.set(cacheKey, fallback);
    return fallback;
  }

  throw new Error(`Failed to load font: ${family} ${weight} — no valid font data from any source`);
}

async function fetchLogoBase64(logoUrl: string): Promise<string> {
  if (LOGO_CACHE.has(logoUrl)) return LOGO_CACHE.get(logoUrl)!;
  try {
    const buf = await fetch(logoUrl).then(r => r.arrayBuffer());
    const b64 = `data:image/png;base64,${Buffer.from(buf).toString('base64')}`;
    LOGO_CACHE.set(logoUrl, b64);
    return b64;
  } catch {
    return '';
  }
}

@Injectable()
export class PostBrandService {
  private readonly logger = new Logger(PostBrandService.name);

  constructor(private readonly db: DbService) {}

  async resolve(brandName: string): Promise<ResolvedBrand> {
    const [row] = await this.db.db.select().from(canvaBrands).where(eq(canvaBrands.name, brandName)).limit(1);
    if (!row) throw new Error(`brand not found: ${brandName}`);
    const brand = {
      name: row.name,
      displayName: row.displayName,
      voiceProfile: row.voiceProfile ?? '',
      palette: (row.palette as string[] | null) ?? [],
      fonts: (row.fonts as string[] | null) ?? [],
      logoUrl: row.logoUrl ?? null,
    };

    const headingFont = brand.fonts?.[0] ?? 'Inter';
    const bodyFont = brand.fonts?.[1] ?? headingFont;
    const palette = brand.palette?.length ? brand.palette : ['#1e1b4b', '#3730a3', '#6366f1', '#c7d2fe', '#ffffff'];

    const [headingFontData, bodyFontData] = await Promise.all([
      fetchFontData(headingFont, 700),
      fetchFontData(bodyFont, 400),
    ]);

    let logoBase64: string | undefined;
    if (brand.logoUrl) {
      try {
        logoBase64 = await fetchLogoBase64(brand.logoUrl);
      } catch (err) {
        this.logger.warn(`logo fetch failed: ${(err as Error).message}`);
      }
    }

    return {
      name: brand.name,
      palette,
      headingFont,
      bodyFont,
      headingFontData,
      bodyFontData,
      logoBase64: logoBase64 || undefined,
      voiceProfile: brand.voiceProfile,
    };
  }
}
