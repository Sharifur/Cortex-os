import { Injectable, Logger, OnModuleInit, BadRequestException } from '@nestjs/common';
import { Reader, ReaderModel } from '@maxmind/geoip2-node';
import path from 'path';
import fs from 'fs';
import https from 'https';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface GeoLookup {
  country: string | null;
  countryName: string | null;
  region: string | null;
  city: string | null;
  lat: string | null;
  lon: string | null;
  timezone: string | null;
}

@Injectable()
export class GeoIpService implements OnModuleInit {
  private readonly logger = new Logger(GeoIpService.name);
  private reader: ReaderModel | null = null;

  async onModuleInit() {
    const candidates = [
      process.env.MAXMIND_DB_PATH,
      path.resolve(process.cwd(), 'data', 'GeoLite2-City.mmdb'),
      path.resolve(__dirname, '..', '..', '..', 'data', 'GeoLite2-City.mmdb'),
      path.resolve(__dirname, '..', '..', '..', '..', 'data', 'GeoLite2-City.mmdb'),
    ].filter((p): p is string => Boolean(p));

    for (const p of candidates) {
      if (!fs.existsSync(p)) continue;
      try {
        this.reader = await Reader.open(p);
        this.logger.log(`GeoLite2-City.mmdb loaded from ${p}`);
        return;
      } catch (err) {
        this.logger.warn(`Failed to open ${p}: ${(err as Error).message}`);
      }
    }
    this.logger.warn(
      'GeoLite2-City.mmdb not found. Visitor enrichment will skip GeoIP fields. See apps/api/data/README.md for download instructions.',
    );
  }

  isLoaded(): boolean {
    return this.reader !== null;
  }

  async downloadAndReload(accountId: string, licenseKey: string): Promise<void> {
    if (!accountId || !licenseKey) {
      throw new BadRequestException('maxmind_account_id and maxmind_license_key must be set in Settings');
    }
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const tmpPath = path.join(dataDir, '_geo_download.tar.gz');

    const downloadUrl = 'https://download.maxmind.com/geoip/databases/GeoLite2-City/download?suffix=tar.gz';
    const auth = `Basic ${Buffer.from(`${accountId}:${licenseKey}`).toString('base64')}`;

    await new Promise<void>((resolve, reject) => {
      const doDownload = (url: string, redirects = 0) => {
        if (redirects > 5) { reject(new Error('Too many redirects')); return; }
        const fileStream = fs.createWriteStream(tmpPath);
        https.get(url, { headers: { Authorization: auth } }, (res) => {
          if (res.statusCode === 301 || res.statusCode === 302) {
            fileStream.destroy();
            doDownload(res.headers.location!, redirects + 1);
            return;
          }
          if (!res.statusCode || res.statusCode >= 400) {
            reject(new Error(`MaxMind returned HTTP ${res.statusCode ?? 'unknown'} — check account ID and license key`));
            return;
          }
          res.pipe(fileStream);
          fileStream.on('finish', () => { fileStream.close(); resolve(); });
          fileStream.on('error', reject);
        }).on('error', reject);
      };
      doDownload(downloadUrl);
    });

    try {
      // GNU tar: strip the dated directory, extract only the .mmdb file.
      await execAsync(`tar -xzf "${tmpPath}" --strip-components=1 -C "${dataDir}"`);
    } finally {
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    }

    this.reader = null;
    await this.onModuleInit();
    this.logger.log('GeoLite2-City.mmdb downloaded and reloaded successfully');
  }

  async saveAndReload(buffer: Buffer): Promise<void> {
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'GeoLite2-City.mmdb'), buffer);
    this.reader = null;
    await this.onModuleInit();
    this.logger.log('GeoLite2-City.mmdb saved from upload and reloaded');
  }

  lookup(ip: string | null | undefined): GeoLookup {
    const empty: GeoLookup = {
      country: null,
      countryName: null,
      region: null,
      city: null,
      lat: null,
      lon: null,
      timezone: null,
    };
    if (!ip || !this.reader) return empty;
    if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.')) {
      return empty;
    }
    try {
      const r = this.reader.city(ip);
      return {
        country: r.country?.isoCode ?? null,
        countryName: r.country?.names?.en ?? null,
        region: r.subdivisions?.[0]?.names?.en ?? null,
        city: r.city?.names?.en ?? null,
        lat: r.location?.latitude !== undefined ? r.location.latitude.toFixed(5) : null,
        lon: r.location?.longitude !== undefined ? r.location.longitude.toFixed(5) : null,
        timezone: r.location?.timeZone ?? null,
      };
    } catch {
      return empty;
    }
  }
}
