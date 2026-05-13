import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { eq } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { canvaBrands } from '../agents/canva/schema';
import type { ResolvedBrand } from './types';

const FONTS_DISK_DIR = path.join(os.homedir(), '.cortex', 'fonts-cache');
const FONT_MEM_CACHE = new Map<string, ArrayBuffer>();
const LOGO_CACHE = new Map<string, string>();

function fontDiskPath(family: string, weight: number): string {
  const safe = family.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return path.join(FONTS_DISK_DIR, `${safe}-${weight}.bin`);
}

async function readFontFromDisk(family: string, weight: number): Promise<ArrayBuffer | null> {
  try {
    const buf = await fs.readFile(fontDiskPath(family, weight));
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    return isValidFontBuffer(ab) ? ab : null;
  } catch {
    return null;
  }
}

async function writeFontToDisk(family: string, weight: number, buf: ArrayBuffer): Promise<void> {
  try {
    await fs.mkdir(FONTS_DISK_DIR, { recursive: true });
    await fs.writeFile(fontDiskPath(family, weight), Buffer.from(buf));
  } catch {
    // disk write failure is non-fatal — in-memory cache still works
  }
}

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

  // L1: in-memory
  if (FONT_MEM_CACHE.has(cacheKey)) return FONT_MEM_CACHE.get(cacheKey)!;

  // L2: disk cache (survives restarts)
  const fromDisk = await readFontFromDisk(family, weight);
  if (fromDisk) {
    FONT_MEM_CACHE.set(cacheKey, fromDisk);
    return fromDisk;
  }

  // L3: fetch from Google Fonts, then persist to both caches
  const persist = async (buf: ArrayBuffer, diskFamily: string, diskWeight: number) => {
    FONT_MEM_CACHE.set(cacheKey, buf);
    void writeFontToDisk(diskFamily, diskWeight, buf);
  };

  // Try requested font at requested weight
  try {
    const buf = await fetchFontFromGoogleCss(family, weight);
    if (buf) { await persist(buf, family, weight); return buf; }
  } catch { /* fall through */ }

  // Try same font at weight 400 (some fonts are regular-only, e.g. Instrument Serif)
  if (weight !== 400) {
    try {
      const buf = await fetchFontFromGoogleCss(family, 400);
      if (buf) { await persist(buf, family, 400); return buf; }
    } catch { /* fall through */ }
  }

  // Final fallback: Inter
  const interWeight = weight >= 600 ? 700 : 400;
  const interKey = `Inter:${interWeight}`;
  if (!FONT_MEM_CACHE.has(interKey)) {
    const fromInterDisk = await readFontFromDisk('Inter', interWeight);
    if (fromInterDisk) {
      FONT_MEM_CACHE.set(interKey, fromInterDisk);
    } else {
      const buf = await fetchFontFromGoogleCss('Inter', interWeight).catch(() => null);
      if (buf) {
        FONT_MEM_CACHE.set(interKey, buf);
        void writeFontToDisk('Inter', interWeight, buf);
      }
    }
  }
  const fallback = FONT_MEM_CACHE.get(interKey);
  if (fallback) {
    FONT_MEM_CACHE.set(cacheKey, fallback);
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
