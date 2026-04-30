import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Reader, ReaderModel } from '@maxmind/geoip2-node';
import path from 'path';
import fs from 'fs';

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
