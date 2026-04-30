import { Injectable } from '@nestjs/common';
import { UAParser } from 'ua-parser-js';

export interface UaLookup {
  browserName: string | null;
  browserVersion: string | null;
  osName: string | null;
  osVersion: string | null;
  deviceType: string | null;
  deviceBrand: string | null;
  deviceModel: string | null;
}

@Injectable()
export class UaParserService {
  parse(ua: string | null | undefined): UaLookup {
    const empty: UaLookup = {
      browserName: null,
      browserVersion: null,
      osName: null,
      osVersion: null,
      deviceType: null,
      deviceBrand: null,
      deviceModel: null,
    };
    if (!ua) return empty;
    try {
      const r = new UAParser(ua).getResult();
      const isBot = /bot|crawler|spider|crawl/i.test(ua);
      return {
        browserName: r.browser.name ?? null,
        browserVersion: r.browser.version ?? null,
        osName: r.os.name ?? null,
        osVersion: r.os.version ?? null,
        deviceType: isBot ? 'bot' : (r.device.type ?? 'desktop'),
        deviceBrand: r.device.vendor ?? null,
        deviceModel: r.device.model ?? null,
      };
    } catch {
      return empty;
    }
  }
}
