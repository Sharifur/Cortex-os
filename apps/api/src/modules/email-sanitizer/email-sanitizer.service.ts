import { Injectable } from '@nestjs/common';

const ASCII_MAP: [RegExp, string][] = [
  [/—/g, '-'],      // em dash
  [/–/g, '-'],      // en dash
  [/‒/g, '-'],      // figure dash
  [/‐/g, '-'],      // hyphen
  [/‑/g, '-'],      // non-breaking hyphen
  [/­/g, ''],       // soft hyphen
  [/‘|’/g, "'"],  // left/right single quotes
  [/“|”/g, '"'],  // left/right double quotes
  [/‚/g, ','],      // single low-9 quotation mark
  [/„/g, '"'],      // double low-9 quotation mark
  [/…/g, '...'],    // horizontal ellipsis
  [/ /g, ' '],      // non-breaking space
  [/ | | /g, ' '], // en/em/thin space
  [/·|•|‣|◦/g, '-'], // bullets/middle dots
  [/ /g, '\n'],     // line separator
  [/ /g, '\n\n'],   // paragraph separator
  [/Â /g, ' '], // double-encoded NBSP
  [/[^\x00-\x7F]/g, ''], // strip any remaining non-ASCII
];

@Injectable()
export class EmailSanitizerService {
  sanitize(text: string): string {
    let s = text;
    for (const [re, rep] of ASCII_MAP) {
      s = s.replace(re, rep);
    }
    return s;
  }

  sanitizeSubject(subject: string): string {
    return this.sanitize(subject).trim();
  }

  sanitizeBody(body: string): string {
    return this.sanitize(body);
  }
}
