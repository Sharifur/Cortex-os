import { Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { canvaBrands } from '../agents/canva/schema';
import type { ResolvedBrand } from './types';

const INTER_URL = 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff';
const FONT_CACHE = new Map<string, ArrayBuffer>();
const LOGO_CACHE = new Map<string, string>();

async function fetchFontData(family: string, weight = 400): Promise<ArrayBuffer> {
  const cacheKey = `${family}:${weight}`;
  if (FONT_CACHE.has(cacheKey)) return FONT_CACHE.get(cacheKey)!;

  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`;
    const css = await fetch(cssUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }).then(r => r.text());
    const urlMatch = css.match(/url\((https:\/\/fonts\.gstatic\.com[^)]+\.(?:ttf|woff2?))\)/);
    if (urlMatch) {
      const buf = await fetch(urlMatch[1]).then(r => r.arrayBuffer());
      FONT_CACHE.set(cacheKey, buf);
      return buf;
    }
  } catch {
    // fall through to Inter fallback
  }

  // Fallback: Inter from gstatic
  const interKey = `Inter:${weight}`;
  if (!FONT_CACHE.has(interKey)) {
    const buf = await fetch(INTER_URL).then(r => r.arrayBuffer());
    FONT_CACHE.set(interKey, buf);
  }
  const fallback = FONT_CACHE.get(interKey)!;
  FONT_CACHE.set(cacheKey, fallback);
  return fallback;
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
