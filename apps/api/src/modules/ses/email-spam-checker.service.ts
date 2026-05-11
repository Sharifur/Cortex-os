import { Injectable, Logger } from '@nestjs/common';

export interface SpamCheckResult {
  score: number;
  blockers: string[];
  warnings: string[];
  sanitizedSubject: string;
}

const SUBJECT_SPAM_PHRASES = [
  'invoice out',
  'invoice overdue',
  'payment due',
  'unpaid',
  'outstanding',
  'reminder',
  'following up',
  'overdue',
  'get paid',
  'money owed',
  'pay now',
  'urgent',
  '100% free',
  'act now',
  'limited time',
  'click here',
  'free offer',
  'guaranteed',
  'no obligation',
  'winner',
];

const BODY_SPAM_PHRASES = [
  'get what you\'re owed',
  'ensure you get',
  'what you\'re owed',
  'following up could help',
  'speed up the process',
  'outstanding invoice',
  'overdue',
  'unpaid invoice',
  'payment is due',
  'reminder to pay',
  'click here',
  'unsubscribe',
  'this is not spam',
  'cash bonus',
  'earn money',
  '100% free',
  'guaranteed',
  'you have been selected',
  'dear friend',
  'final notice',
  'last chance',
  'act immediately',
  'limited time offer',
];

// Characters that cause encoding corruption in email headers
const NON_ASCII_REPLACEMENTS: [RegExp, string][] = [
  [/—/g, '-'],  // em dash
  [/–/g, '-'],  // en dash
  [/‘|’/g, "'"],  // smart single quotes
  [/“|”/g, '"'],  // smart double quotes
  [/…/g, '...'],  // ellipsis
  [/ /g, ' '],  // non-breaking space
  [/•/g, '-'],  // bullet
  [/[-]/g, ''],  // C1 control chars
];

@Injectable()
export class EmailSpamCheckerService {
  private readonly logger = new Logger(EmailSpamCheckerService.name);

  check(subject: string, body: string): SpamCheckResult {
    const blockers: string[] = [];
    const warnings: string[] = [];
    let score = 0;

    const subjectLower = subject.toLowerCase();
    const bodyLower = body.toLowerCase();

    for (const phrase of SUBJECT_SPAM_PHRASES) {
      if (subjectLower.includes(phrase)) {
        blockers.push(`Subject contains spam phrase: "${phrase}"`);
        score += 20;
      }
    }

    for (const phrase of BODY_SPAM_PHRASES) {
      if (bodyLower.includes(phrase)) {
        blockers.push(`Body contains spam phrase: "${phrase}"`);
        score += 15;
      }
    }

    if (/[^\x00-\x7F]/.test(subject)) {
      warnings.push('Subject contains non-ASCII characters — will be sanitized to prevent encoding corruption');
      score += 10;
    }

    if (subject.length > 70) {
      warnings.push(`Subject too long (${subject.length} chars) — keep under 70`);
      score += 5;
    }

    if (/!{2,}|[?!]{3,}/.test(subject)) {
      warnings.push('Subject has excessive punctuation');
      score += 10;
    }

    if (/\b(FREE|URGENT|ACT NOW|CLICK HERE)\b/.test(subject.toUpperCase())) {
      blockers.push('Subject contains all-caps spam trigger word');
      score += 25;
    }

    const sanitizedSubject = this.sanitizeSubject(subject);

    if (score > 0) {
      this.logger.warn(`Spam check — score: ${score} | blockers: ${blockers.length} | subject: "${subject.slice(0, 60)}"`);
    }

    return { score, blockers, warnings, sanitizedSubject };
  }

  sanitizeSubject(subject: string): string {
    let s = subject;
    for (const [pattern, replacement] of NON_ASCII_REPLACEMENTS) {
      s = s.replace(pattern, replacement);
    }
    // Replace any remaining non-ASCII with empty string
    s = s.replace(/[^\x00-\x7F]/g, '');
    return s.trim();
  }
}
