import { Injectable } from '@nestjs/common';
import { GeoIpService, GeoLookup } from './geoip.service';
import { UaParserService, UaLookup } from './ua-parser.service';

export interface EnrichedVisitor extends GeoLookup, UaLookup {
  ip: string | null;
  uaRaw: string | null;
  language: string | null;
}

@Injectable()
export class EnrichmentService {
  constructor(private geo: GeoIpService, private ua: UaParserService) {}

  enrich(ip: string | null | undefined, uaRaw: string | null | undefined, acceptLanguage: string | null | undefined): EnrichedVisitor {
    return {
      ip: ip ?? null,
      uaRaw: uaRaw ?? null,
      language: this.firstLocale(acceptLanguage),
      ...this.geo.lookup(ip),
      ...this.ua.parse(uaRaw),
    };
  }

  lookupIp(ip: string | null | undefined): GeoLookup {
    return this.geo.lookup(ip);
  }

  debugLookup(ip: string | null | undefined): { dbLoaded: boolean; ip: string | null } & GeoLookup {
    return {
      dbLoaded: this.geo.isLoaded(),
      ip: ip ?? null,
      ...this.geo.lookup(ip),
    };
  }

  private firstLocale(header: string | null | undefined): string | null {
    if (!header) return null;
    const first = header.split(',')[0]?.split(';')[0]?.trim();
    return first || null;
  }
}
