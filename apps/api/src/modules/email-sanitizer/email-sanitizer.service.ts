import { Injectable } from '@nestjs/common';

// All patterns use \uXXXX escapes to keep this file pure ASCII.
// TypeScript treats literal U+2028/U+2029 inside regex literals as line
// terminators, which breaks compilation.
const ASCII_MAP: [RegExp, string][] = [
  [/—/g, '-'],           // em dash
  [/–/g, '-'],           // en dash
  [/‒/g, '-'],           // figure dash
  [/‐/g, '-'],           // hyphen
  [/‑/g, '-'],           // non-breaking hyphen
  [/­/g, ''],            // soft hyphen
  [/‘|’/g, "'"],    // left/right single quotes
  [/“|”/g, '"'],    // left/right double quotes
  [/‚/g, ','],           // single low-9 quotation mark
  [/„/g, '"'],           // double low-9 quotation mark
  [/…/g, '...'],         // horizontal ellipsis
  [/ /g, ' '],           // non-breaking space
  [/ | | /g, ' '], // en/em/thin space
  [/·|•|‣|◦/g, '-'], // bullets/middle dots
  [/\u2028/g, '\n'],          // line separator
  [/\u2029/g, '\n\n'],        // paragraph separator
  [/[^\x00-\x7F]/g, ''],      // strip any remaining non-ASCII
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
