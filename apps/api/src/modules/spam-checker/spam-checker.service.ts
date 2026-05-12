import { Injectable, Logger } from '@nestjs/common';
import { promises as dns } from 'dns';

// ─── Public types ────────────────────────────────────────────────────────────

export type SpamGrade = 'INBOX_STRONG' | 'INBOX_LIKELY' | 'PROMOTIONS_RISK' | 'SPAM_RISK' | 'BLOCK';

export interface SpamIssue {
  ruleId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  suggestedFix: string;
}

export interface CategoryBreakdown {
  score: number;        // 0–100 normalised within the category
  weight: number;       // SRS-defined category weight (all weights sum to 100)
  contribution: number; // (score / 100) * weight — raw points in total score
  issues: SpamIssue[];
  criticalFailure?: string;
}

export interface SpamScoreResult {
  score: number;
  grade: SpamGrade;
  breakdown: {
    authentication: CategoryBreakdown;
    reputation: CategoryBreakdown;
    listHygiene: CategoryBreakdown;
    content: CategoryBreakdown;
    technical: CategoryBreakdown;
    compliance: CategoryBreakdown;
  };
  issues: SpamIssue[];
  criticalFailures: string[];
  sanitizedSubject: string;
  modelVersion: string;
}

export interface SpamCheckInput {
  subject: string;
  textBody: string;
  htmlBody?: string;
  fromAddress: string;
  fromDomain: string;
  recipient: string;
  headers?: Record<string, string>;
  isTransactional?: boolean;
}

// ─── Content rules ───────────────────────────────────────────────────────────

interface ContentRule {
  ruleId: string;
  scope: 'subject' | 'body' | 'both';
  pattern: RegExp;
  severity: 'critical' | 'high' | 'medium' | 'low';
  deduction: number;
  message: string;
  fix: string;
}

const CONTENT_RULES: ContentRule[] = [
  // Phishing-mimic — critical
  { ruleId: 'PHISH_ACCOUNT_CLOSED',  scope: 'both',    pattern: /\byour\s+account\s+(will\s+be|has\s+been)\s+closed/i,         severity: 'critical', deduction: 30, message: 'Phishing-mimic: account closure threat',        fix: 'Remove account-threat language' },
  { ruleId: 'PHISH_PAYMENT_DECLINED',scope: 'both',    pattern: /\bpayment\s+declined\b/i,                                      severity: 'critical', deduction: 30, message: 'Phishing-mimic: payment declined',             fix: 'Remove payment-declined language' },
  { ruleId: 'PHISH_VERIFY',          scope: 'both',    pattern: /\bverify\s+your\s+(identity|account|password)\b/i,             severity: 'critical', deduction: 30, message: 'Phishing-mimic: verify identity/account',      fix: 'Rephrase without "verify your…"' },
  { ruleId: 'PHISH_UPDATE_INFO',     scope: 'both',    pattern: /\bupdate\s+your\s+(payment|billing|credit|account)\s+info/i,   severity: 'critical', deduction: 30, message: 'Phishing-mimic: update payment info',          fix: 'Remove payment-update language' },
  { ruleId: 'PHISH_SUSPICIOUS',      scope: 'both',    pattern: /\bsuspicious\s+activity\b/i,                                   severity: 'critical', deduction: 25, message: 'Phishing-mimic: suspicious activity',          fix: 'Remove suspicious activity phrasing' },
  { ruleId: 'SPAM_NOT_SPAM',         scope: 'both',    pattern: /\bthis\s+is\s+not\s+spam\b/i,                                  severity: 'critical', deduction: 40, message: 'Self-identifying as spam — guaranteed filter', fix: 'Remove entirely' },

  // Debt-collection — high (our primary failure mode)
  { ruleId: 'DEBT_OWED',            scope: 'both',    pattern: /\b(get|ensure\s+you\s+get)\s+what\s+you'?re\s+owed\b/i,       severity: 'high', deduction: 20, message: 'Debt-collection: "get what you\'re owed"',      fix: 'Frame as owner following up with their client, not collecting debt' },
  { ruleId: 'DEBT_ENSURE',          scope: 'both',    pattern: /\bensure\s+you\s+get\b/i,                                      severity: 'low',  deduction:  5, message: 'Mild debt tone: "ensure you get"',              fix: 'Consider rephrasing — can read as debt-collection' },
  { ruleId: 'DEBT_SPEED_UP',        scope: 'both',    pattern: /\bspeed\s+up\s+the\s+process\b/i,                              severity: 'medium', deduction: 8, message: 'Spam trigger: "speed up the process"',           fix: 'Remove — high-frequency spam phrase' },
  { ruleId: 'DEBT_FOLLOWUP_HELP',   scope: 'both',    pattern: /\bfollowing\s+up\s+could\s+help\b/i,                           severity: 'medium', deduction: 8, message: 'Mild debt tone: "following up could help"',    fix: 'Reframe as direct question instead' },
  { ruleId: 'DEBT_OUTSTANDING_INV', scope: 'both',    pattern: /\boutstanding\s+invoice\b/i,                                   severity: 'high', deduction: 20, message: 'Debt trigger: outstanding invoice',              fix: 'Say "invoice your client hasn\'t paid yet"' },
  { ruleId: 'DEBT_UNPAID_INV',      scope: 'both',    pattern: /\bunpaid\s+invoice\b/i,                                        severity: 'high', deduction: 20, message: 'Debt trigger: unpaid invoice',                   fix: 'Use "invoice from [ClientName] that hasn\'t been paid"' },
  { ruleId: 'DEBT_PAYMENT_DUE',     scope: 'both',    pattern: /\bpayment\s+is\s+due\b/i,                                      severity: 'high', deduction: 20, message: 'Debt trigger: payment is due',                   fix: 'Remove — implies recipient owes money' },
  { ruleId: 'DEBT_REMINDER_PAY',    scope: 'both',    pattern: /\breminder\s+to\s+pay\b/i,                                     severity: 'high', deduction: 20, message: 'Debt trigger: reminder to pay',                  fix: 'Ask "have you sent your client a reminder?" instead' },
  { ruleId: 'DEBT_FINAL_NOTICE',    scope: 'both',    pattern: /\bfinal\s+notice\b/i,                                          severity: 'high', deduction: 25, message: 'Debt-collection: final notice',                  fix: 'Remove entirely — very strong spam signal' },
  { ruleId: 'DEBT_OVERDUE',         scope: 'body',    pattern: /\boverdue\b/i,                                                 severity: 'high', deduction: 15, message: 'Debt trigger: overdue (body)',                   fix: 'Replace with "hasn\'t been paid yet"' },

  // Financial promises — high
  { ruleId: 'FIN_EARN_CASH',        scope: 'both',    pattern: /\b(earn|make)\s+\$+/i,                                         severity: 'high', deduction: 20, message: 'Financial spam: earn/make $$$ claim',            fix: 'Remove dollar-sign money claims' },
  { ruleId: 'FIN_INSTANT_CASH',     scope: 'both',    pattern: /\binstant\s+(cash|money|profit)\b/i,                           severity: 'high', deduction: 20, message: 'Financial spam: instant cash/money',             fix: 'Remove' },
  { ruleId: 'FIN_GUARANTEED_INC',   scope: 'both',    pattern: /\bguaranteed\s+income\b/i,                                     severity: 'high', deduction: 20, message: 'Financial spam: guaranteed income',              fix: 'Remove' },
  { ruleId: 'FIN_DOUBLE_MONEY',     scope: 'both',    pattern: /\bdouble\s+your\s+money\b/i,                                   severity: 'high', deduction: 25, message: 'Financial spam: double your money',              fix: 'Remove' },
  { ruleId: 'FIN_DEBT_RELIEF',      scope: 'both',    pattern: /\bdebt\s+relief\b/i,                                           severity: 'high', deduction: 20, message: 'Financial spam: debt relief',                    fix: 'Remove' },
  { ruleId: 'FIN_LOTTERY',          scope: 'both',    pattern: /\blottery\s+(winner|winnings)\b/i,                             severity: 'high', deduction: 30, message: 'Financial spam: lottery winner',                 fix: 'Remove' },

  // Too-good-to-be-true — medium
  { ruleId: 'TGBT_100_FREE',        scope: 'both',    pattern: /\b100%\s+free\b/i,                                             severity: 'medium', deduction: 12, message: 'TGTBT: 100% free',                             fix: 'Remove' },
  { ruleId: 'TGBT_RISK_FREE',       scope: 'both',    pattern: /\brisk[\s-]?free\b/i,                                          severity: 'medium', deduction: 10, message: 'TGTBT: risk-free',                             fix: 'Remove' },
  { ruleId: 'TGBT_NO_STRINGS',      scope: 'both',    pattern: /\bno\s+strings\s+attached\b/i,                                 severity: 'medium', deduction: 12, message: 'TGTBT: no strings attached',                   fix: 'Remove' },
  { ruleId: 'TGBT_WINNER',          scope: 'both',    pattern: /\byou'?(?:re| are)\s+a\s+winner\b/i,                           severity: 'high',   deduction: 25, message: 'TGTBT: you\'re a winner',                      fix: 'Remove' },
  { ruleId: 'TGBT_SELECTED',        scope: 'both',    pattern: /\byou'?(?:ve| have)\s+been\s+selected\b/i,                     severity: 'high',   deduction: 20, message: 'TGTBT: you\'ve been selected',                 fix: 'Remove' },
  { ruleId: 'TGBT_FREE_GIFT',       scope: 'both',    pattern: /\bfree\s+(gift|offer|money|prize)\b/i,                         severity: 'medium', deduction: 15, message: 'TGTBT: free gift/offer/prize',                 fix: 'Remove' },
  { ruleId: 'TGBT_GUARANTEED',      scope: 'both',    pattern: /\bguaranteed\b/i,                                              severity: 'medium', deduction: 10, message: 'Spam trigger: guaranteed',                     fix: 'Replace with specific evidence or testimonial' },

  // Urgency / pressure — medium
  { ruleId: 'URG_ACT_NOW',          scope: 'both',    pattern: /\bact\s+now\b/i,                                               severity: 'medium', deduction: 12, message: 'Urgency trigger: act now',                     fix: 'Remove pressure language' },
  { ruleId: 'URG_LIMITED_TIME',     scope: 'both',    pattern: /\blimited[\s-]time\b/i,                                        severity: 'medium', deduction: 10, message: 'Urgency trigger: limited time',                fix: 'Use a specific date instead' },
  { ruleId: 'URG_LAST_CHANCE',      scope: 'both',    pattern: /\blast\s+chance\b/i,                                           severity: 'medium', deduction: 12, message: 'Urgency trigger: last chance',                 fix: 'Remove' },
  { ruleId: 'URG_EXPIRES',          scope: 'both',    pattern: /\bexpires?\s+(today|soon|now|shortly)\b/i,                     severity: 'medium', deduction: 10, message: 'Urgency trigger: expires soon',                fix: 'Use a specific date ("by Friday") instead' },
  { ruleId: 'URG_DONT_DELAY',       scope: 'both',    pattern: /\bdon'?t\s+delay\b/i,                                          severity: 'medium', deduction: 10, message: 'Urgency trigger: don\'t delay',               fix: 'Remove' },
  { ruleId: 'URG_TIME_SENSITIVE',   scope: 'both',    pattern: /\btime[\s-]?sensitive\b/i,                                     severity: 'medium', deduction: 10, message: 'Urgency trigger: time-sensitive',              fix: 'Replace with specific reason for urgency' },

  // Generic spam — medium/low
  { ruleId: 'SPAM_CLICK_HERE',      scope: 'both',    pattern: /\bclick\s+here\b/i,                                            severity: 'medium', deduction: 12, message: 'Spam trigger: click here',                     fix: 'Use descriptive anchor text ("view invoice")' },
  { ruleId: 'SPAM_DEAR_FRIEND',     scope: 'both',    pattern: /\bdear\s+friend\b/i,                                           severity: 'high',   deduction: 20, message: 'Spam opener: dear friend',                     fix: 'Use recipient\'s actual first name' },
  { ruleId: 'SPAM_UNSUBSCRIBE_S',   scope: 'subject', pattern: /\bunsubscribe\b/i,                                             severity: 'medium', deduction: 15, message: 'Spam trigger in subject: unsubscribe',          fix: 'Remove from subject (required in body, not subject)' },
  { ruleId: 'SPAM_REMINDER_S',      scope: 'subject', pattern: /\breminder\b/i,                                                severity: 'medium', deduction: 12, message: 'Subject trigger: reminder',                    fix: 'Replace with specific observation ("1 invoice waiting")' },
  { ruleId: 'SPAM_FOLLOWUP_S',      scope: 'subject', pattern: /\bfollowing\s+up\b/i,                                          severity: 'medium', deduction: 12, message: 'Subject trigger: following up',                 fix: 'Replace with a specific question' },
  { ruleId: 'SPAM_INVOICE_OUT_S',   scope: 'subject', pattern: /\binvoice\s+out\b/i,                                           severity: 'high',   deduction: 20, message: 'Subject trigger: invoice out',                  fix: 'Rephrase as client-behaviour question' },
  { ruleId: 'SPAM_OUTSTANDING_S',   scope: 'subject', pattern: /\boutstanding\b/i,                                             severity: 'medium', deduction: 12, message: 'Subject trigger: outstanding',                  fix: 'Remove word "outstanding" from subject' },
  { ruleId: 'SPAM_PAYMENT_DUE_S',   scope: 'subject', pattern: /\bpayment\s+due\b/i,                                           severity: 'high',   deduction: 20, message: 'Subject trigger: payment due',                  fix: 'Rephrase entirely — implies recipient owes money' },

  // Clickbait — low
  { ruleId: 'BAIT_WONT_BELIEVE',    scope: 'both',    pattern: /\byou\s+won'?t\s+believe\b/i,                                  severity: 'low', deduction: 8, message: 'Clickbait: you won\'t believe',                   fix: 'Remove' },
  { ruleId: 'BAIT_SECRET',          scope: 'both',    pattern: /\bsecret\s+revealed\b/i,                                       severity: 'low', deduction: 8, message: 'Clickbait: secret revealed',                       fix: 'Remove' },
];

// ─── Static lists ─────────────────────────────────────────────────────────────

const NON_ASCII_MAP: [RegExp, string][] = [
  [/—/g, '-'], [/–/g, '-'],
  [/'|'/g, "'"], [/"|"/g, '"'],
  [/…/g, '...'], [/ /g, ' '], [/•/g, '-'],
];

const URL_SHORTENERS = new Set([
  'bit.ly', 't.co', 'tinyurl.com', 'goo.gl', 'ow.ly', 'is.gd',
  'buff.ly', 'short.io', 'rebrand.ly', 'cutt.ly', 'tiny.cc',
  'shorten.io', 'snip.ly', 'smarturl.it',
]);

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'icloud.com', 'live.com', 'msn.com', 'protonmail.com', 'ymail.com',
  'me.com', 'mac.com', 'inbox.com',
]);

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwaway.email',
  'yopmail.com', 'fakeinbox.com', 'sharklasers.com', 'grr.la', 'spam4.me',
  'trashmail.com', '10minutemail.com', 'temp-mail.org', 'maildrop.cc',
  'dispostable.com', 'mailnull.com', 'spamgourmet.com',
]);

const ROLE_PREFIXES = new Set([
  'info', 'admin', 'noreply', 'no-reply', 'support', 'contact', 'sales',
  'help', 'team', 'office', 'hello', 'enquiries', 'enquiry', 'webmaster',
  'postmaster', 'abuse', 'spam', 'marketing', 'newsletter', 'billing',
  'accounts', 'mail', 'mailer', 'hostmaster', 'list', 'news', 'reply',
]);

const DKIM_SELECTORS = [
  'mail', 'email', 'default', 'dkim', 'key1', 'key2',
  'google', 'selector1', 'selector2',
];

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const MODEL_VERSION = '1.0.0';

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class SpamCheckerService {
  private readonly logger = new Logger(SpamCheckerService.name);
  private readonly dnsCache = new Map<string, { value: unknown; expiresAt: number }>();

  // ── Main entry point ───────────────────────────────────────────────────────

  async score(input: SpamCheckInput): Promise<SpamScoreResult> {
    const sanitizedSubject = this.sanitizeSubject(input.subject);

    const [authentication, reputation, listHygiene, technical, compliance] = await Promise.all([
      this.checkAuthentication(input.fromDomain),
      this.checkReputation(input.fromDomain),
      this.checkListHygiene(input.recipient),
      this.checkTechnical(input.subject, input.textBody, input.htmlBody),
      this.checkCompliance(input.textBody, input.htmlBody, input.headers, input.isTransactional),
    ]);
    const content = this.checkContent(input.subject, input.textBody, input.htmlBody);

    const breakdown = { authentication, reputation, listHygiene, content, technical, compliance };

    const criticalFailures: string[] = Object.values(breakdown)
      .map(c => c.criticalFailure)
      .filter((cf): cf is string => !!cf);

    let rawScore = Object.values(breakdown).reduce((sum, cat) => sum + cat.contribution, 0);

    // Critical-failure cap (SRS §5.9)
    if (criticalFailures.length > 0) {
      const hasBlacklist = reputation.criticalFailure?.toLowerCase().includes('blacklist') ||
        reputation.criticalFailure?.toLowerCase().includes('spamhaus');
      rawScore = Math.min(rawScore, hasBlacklist ? 30 : 45);
    }

    const score = Math.round(Math.max(0, Math.min(100, rawScore)));
    const grade = this.resolveGrade(score, criticalFailures);

    const issues: SpamIssue[] = Object.values(breakdown)
      .flatMap(cat => cat.issues)
      .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

    if (score < 75) {
      this.logger.warn(
        `Spam score: ${score} (${grade}) | from: ${input.fromDomain} | to: ${input.recipient} | critical: ${criticalFailures.length} | issues: ${issues.length}`,
      );
    } else {
      this.logger.debug(
        `Spam score: ${score} (${grade}) | from: ${input.fromDomain} | to: ${input.recipient}`,
      );
    }

    return { score, grade, breakdown, issues, criticalFailures, sanitizedSubject, modelVersion: MODEL_VERSION };
  }

  // Domain-only audit (F-3)
  async auditDomain(domain: string): Promise<{
    domain: string;
    authentication: CategoryBreakdown;
    reputation: CategoryBreakdown;
    criticalFailures: string[];
    issues: SpamIssue[];
  }> {
    const [authentication, reputation] = await Promise.all([
      this.checkAuthentication(domain),
      this.checkReputation(domain),
    ]);
    const criticalFailures = [authentication.criticalFailure, reputation.criticalFailure].filter((cf): cf is string => !!cf);
    const issues = [...authentication.issues, ...reputation.issues].sort(
      (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
    );
    return { domain, authentication, reputation, criticalFailures, issues };
  }

  sanitizeSubject(subject: string): string {
    let s = subject;
    for (const [re, replacement] of NON_ASCII_MAP) s = s.replace(re, replacement);
    s = s.replace(/[^\x00-\x7F]/g, '');
    return s.trim();
  }

  // ── Category 1 — Authentication & Alignment (weight 25) ───────────────────

  private async checkAuthentication(fromDomain: string): Promise<CategoryBreakdown> {
    const weight = 25;
    if (!fromDomain) {
      return { score: 100, weight, contribution: weight, issues: [] };
    }
    const issues: SpamIssue[] = [];
    // SPF check omitted — sending provider (Gmail Workspace / SES) handles SPF
    // at the infrastructure level; we cannot know the provider at check time.
    let score = 50;

    // DMARC
    const dmarcRecords = await this.dnsLookupTxt(`_dmarc.${fromDomain}`);
    const dmarc = dmarcRecords?.find(r => r.startsWith('v=DMARC1')) ?? null;
    if (dmarc) {
      score += 25;
      const policy = dmarc.match(/\bp=(quarantine|reject|none)\b/i)?.[1]?.toLowerCase();
      if (policy === 'reject') score += 15;
      else if (policy === 'quarantine') score += 10;
      else {
        issues.push({
          ruleId: 'AUTH_DMARC_NONE',
          severity: 'medium',
          message: 'DMARC policy is p=none — monitoring only, no enforcement',
          suggestedFix: 'Progress to p=quarantine then p=reject after reviewing DMARC reports',
        });
      }
    } else {
      issues.push({
        ruleId: 'AUTH_DMARC_MISSING',
        severity: 'critical',
        message: `No DMARC record at _dmarc.${fromDomain}`,
        suggestedFix: 'Add: v=DMARC1; p=quarantine; rua=mailto:dmarc@' + fromDomain,
      });
    }

    // DKIM — probe common selectors in parallel
    const dkimResults = await Promise.all(
      DKIM_SELECTORS.map(sel => this.dnsLookupTxt(`${sel}._domainkey.${fromDomain}`)),
    );
    const dkimFound = dkimResults.some(recs => recs?.some(r => r.includes('v=DKIM1')));
    if (dkimFound) {
      score += 10;
    } else {
      issues.push({
        ruleId: 'AUTH_DKIM_NOT_FOUND',
        severity: 'low',
        message: `No DKIM public key found on common selectors for ${fromDomain}`,
        suggestedFix: 'Verify domain in AWS SES console to enable Easy DKIM (SES auto-signs with its own selector)',
      });
    }

    const normalizedScore = Math.max(0, Math.min(100, score));
    const criticalFailure = !dmarc
      ? `No DMARC on ${fromDomain} — rejection risk by Gmail/Yahoo/Outlook`
      : undefined;

    return { score: normalizedScore, weight, contribution: (normalizedScore / 100) * weight, issues, criticalFailure };
  }

  // ── Category 2 — Sender & Domain Reputation (weight 25) ───────────────────

  private async checkReputation(fromDomain: string): Promise<CategoryBreakdown> {
    const weight = 25;
    if (!fromDomain) {
      return { score: 100, weight, contribution: weight, issues: [] };
    }
    const issues: SpamIssue[] = [];
    let score = 100;

    // Spamhaus DBL domain check
    const dbl = await this.dnsLookup4(`${fromDomain}.dbl.spamhaus.org`);
    if (dbl !== null) {
      score -= 80;
      issues.push({
        ruleId: 'REP_SPAMHAUS_DBL',
        severity: 'critical',
        message: `${fromDomain} is listed on Spamhaus Domain Blocklist (DBL)`,
        suggestedFix: 'Submit delisting request at https://www.spamhaus.org/lookup/ — investigate sending practices first',
      });
    }

    // Barracuda domain reputation (BRBL)
    const brbl = await this.dnsLookup4(`${fromDomain}.b.barracudacentral.org`);
    if (brbl !== null) {
      score -= 40;
      issues.push({
        ruleId: 'REP_BARRACUDA',
        severity: 'high',
        message: `${fromDomain} found on Barracuda Reputation Blocklist`,
        suggestedFix: 'Request removal at https://www.barracudacentral.org/rbl/removal-request',
      });
    }

    // Free / consumer email domain
    if (FREE_EMAIL_DOMAINS.has(fromDomain)) {
      score -= 30;
      issues.push({
        ruleId: 'REP_FREE_DOMAIN',
        severity: 'high',
        message: `Sending outreach from consumer domain ${fromDomain}`,
        suggestedFix: 'Use a business domain with SPF/DKIM/DMARC — consumer domains have very low bulk-send reputation',
      });
    }

    // Suspicious auto-generated domain pattern
    const hyphenDigitCount = (fromDomain.replace(/\.[^.]+$/, '').match(/[-\d]/g) ?? []).length;
    if (hyphenDigitCount / fromDomain.length > 0.35 && fromDomain.length > 8) {
      score -= 10;
      issues.push({
        ruleId: 'REP_SUSPICIOUS_PATTERN',
        severity: 'low',
        message: `Domain pattern looks auto-generated (high hyphen/digit ratio): ${fromDomain}`,
        suggestedFix: 'Use a clean, human-readable domain for outreach',
      });
    }

    const normalizedScore = Math.max(0, Math.min(100, score));
    const criticalFailure = dbl !== null
      ? `${fromDomain} is on Spamhaus DBL blacklist — critical delivery risk`
      : undefined;

    return { score: normalizedScore, weight, contribution: (normalizedScore / 100) * weight, issues, criticalFailure };
  }

  // ── Category 3 — List & Recipient Hygiene (weight 15) ─────────────────────

  private async checkListHygiene(recipient: string): Promise<CategoryBreakdown> {
    const weight = 15;
    const issues: SpamIssue[] = [];
    let score = 100;

    const atIdx = recipient.indexOf('@');
    const localPart = atIdx >= 0 ? recipient.slice(0, atIdx).toLowerCase() : '';
    const domain = atIdx >= 0 ? recipient.slice(atIdx + 1).toLowerCase() : '';

    // MX record existence
    const mx = await this.dnsLookupMx(domain);
    if (!mx || mx.length === 0) {
      score -= 70;
      issues.push({
        ruleId: 'LIST_NO_MX',
        severity: 'critical',
        message: `No MX record for ${domain} — mail cannot be delivered to this address`,
        suggestedFix: 'Verify the recipient email address before sending',
      });
    }

    // Disposable / temporary email service
    if (DISPOSABLE_DOMAINS.has(domain)) {
      score -= 40;
      issues.push({
        ruleId: 'LIST_DISPOSABLE',
        severity: 'high',
        message: `Recipient uses disposable email service: ${domain}`,
        suggestedFix: 'Remove disposable addresses — they generate bounces and spam complaints',
      });
    }

    // Role / group account prefix
    const localBase = localPart.split('+')[0];
    if (ROLE_PREFIXES.has(localBase)) {
      score -= 20;
      issues.push({
        ruleId: 'LIST_ROLE_ACCOUNT',
        severity: 'medium',
        message: `Recipient appears to be a role address (${localPart}@…) — shared inbox, low engagement`,
        suggestedFix: 'Target a named individual\'s address for better deliverability',
      });
    }

    const normalizedScore = Math.max(0, Math.min(100, score));
    const criticalFailure = (!mx || mx.length === 0) ? `No MX record for recipient domain ${domain}` : undefined;

    return { score: normalizedScore, weight, contribution: (normalizedScore / 100) * weight, issues, criticalFailure };
  }

  // ── Category 4 — Content Quality (weight 20) ──────────────────────────────

  private checkContent(subject: string, textBody: string, htmlBody?: string): CategoryBreakdown {
    const weight = 20;
    const issues: SpamIssue[] = [];
    let score = 100;

    const bodyText = textBody + ' ' + (htmlBody ?? '');

    for (const rule of CONTENT_RULES) {
      const inSubject = rule.scope !== 'body' && rule.pattern.test(subject);
      const inBody = rule.scope !== 'subject' && rule.pattern.test(bodyText);
      if (inSubject || inBody) {
        score -= rule.deduction;
        const where = inSubject && inBody ? 'subject + body' : inSubject ? 'subject' : 'body';
        issues.push({ ruleId: rule.ruleId, severity: rule.severity, message: `${rule.message} (found in ${where})`, suggestedFix: rule.fix });
      }
    }

    // ALL-CAPS word ratio in subject
    const subjectWords = subject.split(/\s+/).filter(w => w.length > 2);
    const capsWords = subjectWords.filter(w => /[A-Z]/.test(w) && w === w.toUpperCase());
    if (subjectWords.length > 0 && capsWords.length / subjectWords.length > 0.3) {
      score -= 15;
      issues.push({
        ruleId: 'CONTENT_CAPS_SUBJECT',
        severity: 'high',
        message: `Subject has excessive ALL-CAPS words (${capsWords.join(', ')})`,
        suggestedFix: 'Use sentence case in subject line — ALL-CAPS is a primary spam signal',
      });
    }

    // Repeated punctuation in subject
    if (/[!?]{2,}/.test(subject)) {
      score -= 10;
      issues.push({
        ruleId: 'CONTENT_PUNCT_EXCESS',
        severity: 'medium',
        message: 'Subject contains repeated !? punctuation',
        suggestedFix: 'Use at most one punctuation mark per subject',
      });
    }

    // Symbol clusters in body ($$$, !!!, ***)
    if (/[$!*]{3,}/.test(bodyText)) {
      score -= 10;
      issues.push({
        ruleId: 'CONTENT_SYMBOL_CLUSTER',
        severity: 'medium',
        message: 'Body contains symbol clusters ($$$ / !!! / ***)',
        suggestedFix: 'Remove repeated symbols',
      });
    }

    // Unrendered template tokens
    if (/\{\{[^}]+\}\}/.test(subject + bodyText)) {
      score -= 30;
      issues.push({
        ruleId: 'CONTENT_TEMPLATE_TOKEN',
        severity: 'critical',
        message: 'Unrendered template token found e.g. {{first_name}} or {{company}}',
        suggestedFix: 'Render all template variables before sending — broken personalisation triggers spam filters',
      });
    }

    // Missing plain-text body
    if (!textBody?.trim()) {
      score -= 20;
      issues.push({
        ruleId: 'CONTENT_NO_PLAINTEXT',
        severity: 'high',
        message: 'No plain-text (text/plain) body provided',
        suggestedFix: 'Always include a text/plain alternative — HTML-only emails score significantly worse',
      });
    }

    // Very short body
    if (textBody.trim().length > 0 && textBody.trim().length < 80) {
      score -= 5;
      issues.push({
        ruleId: 'CONTENT_BODY_TOO_SHORT',
        severity: 'low',
        message: `Body is very short (${textBody.trim().length} chars) — MBPs expect substantive content`,
        suggestedFix: 'Aim for at least 100 words of meaningful content',
      });
    }

    const normalizedScore = Math.max(0, Math.min(100, score));
    return { score: normalizedScore, weight, contribution: (normalizedScore / 100) * weight, issues };
  }

  // ── Category 5 — Technical / HTML Format (weight 10) ──────────────────────

  private checkTechnical(subject: string, textBody: string, htmlBody?: string): CategoryBreakdown {
    const weight = 10;
    const issues: SpamIssue[] = [];
    let score = 100;

    // Non-ASCII characters in subject (encoding corruption risk)
    if (/[^\x00-\x7F]/.test(subject)) {
      score -= 15;
      issues.push({
        ruleId: 'TECH_NONASCII_SUBJECT',
        severity: 'medium',
        message: 'Subject contains non-ASCII characters (em dash, smart quotes, etc.) — auto-sanitized but signals encoding issues',
        suggestedFix: 'Use plain ASCII: hyphen (-) instead of em dash (—), straight quotes instead of curly',
      });
    }

    // Subject length
    if (subject.length > 70) {
      score -= 15;
      issues.push({ ruleId: 'TECH_SUBJECT_LONG', severity: 'medium', message: `Subject is ${subject.length} chars — over 70-char limit`, suggestedFix: 'Trim to under 50 chars for best inbox placement' });
    } else if (subject.length > 50) {
      score -= 5;
      issues.push({ ruleId: 'TECH_SUBJECT_MODERATE', severity: 'low', message: `Subject is ${subject.length} chars — above 50-char ideal`, suggestedFix: 'Keep subjects under 50 chars where possible' });
    }

    // URL shorteners
    const bodyForLinks = htmlBody ?? textBody;
    const urlMatches = [...bodyForLinks.matchAll(/https?:\/\/([^/\s"'>]+)/gi)];
    for (const match of urlMatches) {
      const hostname = match[1].split(':')[0].toLowerCase();
      if (URL_SHORTENERS.has(hostname)) {
        score -= 25;
        issues.push({
          ruleId: 'TECH_URL_SHORTENER',
          severity: 'high',
          message: `URL shortener detected: ${hostname}`,
          suggestedFix: 'Replace with the full destination URL — shorteners are a critical spam signal',
        });
        break;
      }
    }

    // Link density
    const wordCount = textBody.split(/\s+/).filter(Boolean).length;
    const linkCount = (bodyForLinks.match(/https?:\/\//g) ?? []).length;
    if (linkCount > 1 && wordCount > 0 && wordCount / linkCount < 100) {
      score -= 15;
      issues.push({
        ruleId: 'TECH_LINK_DENSITY',
        severity: 'medium',
        message: `Link density too high: ${linkCount} links in ~${wordCount} words (target: 1 link per 200+ words)`,
        suggestedFix: 'Reduce to a single primary link; avoid link lists',
      });
    }

    // Image-heavy with minimal text
    if (htmlBody && textBody.trim().length < 150) {
      const imgCount = (htmlBody.match(/<img/gi) ?? []).length;
      if (imgCount > 0) {
        score -= 25;
        issues.push({
          ruleId: 'TECH_IMAGE_HEAVY',
          severity: 'high',
          message: `Email has ${imgCount} image(s) but only ${textBody.trim().length} chars of text — image-heavy emails fail spam filters`,
          suggestedFix: 'Ensure at least 400 chars of real text; target 60:40 text-to-image ratio',
        });
      }
    }

    const normalizedScore = Math.max(0, Math.min(100, score));
    return { score: normalizedScore, weight, contribution: (normalizedScore / 100) * weight, issues };
  }

  // ── Category 7 — Compliance & Policy (weight 5) ───────────────────────────

  private checkCompliance(
    textBody: string,
    htmlBody?: string,
    headers?: Record<string, string>,
    isTransactional = false,
  ): CategoryBreakdown {
    const weight = 5;
    if (isTransactional) {
      return { score: 100, weight, contribution: weight, issues: [] };
    }

    const issues: SpamIssue[] = [];
    let score = 100;

    // List-Unsubscribe header
    const normalizedHeaders = Object.fromEntries(
      Object.entries(headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
    );
    const hasUnsubHeader = !!normalizedHeaders['list-unsubscribe'];
    if (!hasUnsubHeader) {
      score -= 40;
      issues.push({
        ruleId: 'COMP_NO_UNSUB_HEADER',
        severity: 'high',
        message: 'Missing List-Unsubscribe header — required by Gmail/Yahoo for marketing mail (enforced Nov 2025)',
        suggestedFix: 'Add: List-Unsubscribe: <mailto:unsub@yourdomain.com>, <https://yourdomain.com/unsubscribe>',
      });
    }

    // Unsubscribe link in body
    const bodyAll = (textBody + ' ' + (htmlBody ?? '')).toLowerCase();
    const hasUnsubLink = /unsubscribe|opt.?out|remove\s+(me|from\s+(this\s+)?list)/i.test(bodyAll);
    if (!hasUnsubLink) {
      score -= 35;
      issues.push({
        ruleId: 'COMP_NO_UNSUB_LINK',
        severity: 'high',
        message: 'No unsubscribe / opt-out link found in email body',
        suggestedFix: 'Add a plain-text unsubscribe link to the footer of every marketing email',
      });
    }

    // Physical postal address (CAN-SPAM / CASL)
    const hasAddress =
      /\b\d+\s+\w[\w\s]{1,30}(street|st|avenue|ave|road|rd|blvd|boulevard|drive|dr|lane|ln|court|ct|place|pl)\b/i.test(bodyAll) ||
      /\b(po\s+box|p\.?o\.?\s*box)\b/i.test(bodyAll);
    if (!hasAddress) {
      score -= 25;
      issues.push({
        ruleId: 'COMP_NO_ADDRESS',
        severity: 'medium',
        message: 'No physical postal address in email body (CAN-SPAM / CASL requirement)',
        suggestedFix: 'Add your business postal address to the email footer',
      });
    }

    const normalizedScore = Math.max(0, Math.min(100, score));
    const criticalFailure =
      !hasUnsubHeader && !hasUnsubLink
        ? 'Marketing email missing both List-Unsubscribe header and body unsubscribe link'
        : undefined;

    return { score: normalizedScore, weight, contribution: (normalizedScore / 100) * weight, issues, criticalFailure };
  }

  // ── Grade resolution (SRS §5.9) ───────────────────────────────────────────

  private resolveGrade(score: number, criticalFailures: string[]): SpamGrade {
    if (criticalFailures.length > 0 && score < 60) return score < 40 ? 'BLOCK' : 'SPAM_RISK';
    if (score >= 90) return 'INBOX_STRONG';
    if (score >= 75) return 'INBOX_LIKELY';
    if (score >= 60) return 'PROMOTIONS_RISK';
    if (score >= 40) return 'SPAM_RISK';
    return 'BLOCK';
  }

  // ── DNS helpers with in-memory TTL cache + 3 s timeout ────────────────────

  private async dnsLookupTxt(name: string): Promise<string[] | null> {
    return this.dnsCached(`txt:${name}`, () =>
      dns.resolveTxt(name).then(recs => recs.map(r => r.join(''))),
    );
  }

  private async dnsLookupMx(name: string): Promise<{ priority: number; exchange: string }[] | null> {
    return this.dnsCached(`mx:${name}`, () => dns.resolveMx(name));
  }

  private async dnsLookup4(name: string): Promise<string[] | null> {
    return this.dnsCached(`a4:${name}`, () => dns.resolve4(name));
  }

  private async dnsCached<T>(key: string, fn: () => Promise<T>): Promise<T | null> {
    const hit = this.dnsCache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.value as T;
    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('dns timeout')), 3000)),
      ]);
      this.dnsCache.set(key, { value: result, expiresAt: Date.now() + 24 * 60 * 60_000 });
      return result as T;
    } catch {
      this.dnsCache.set(key, { value: null, expiresAt: Date.now() + 60 * 60_000 });
      return null;
    }
  }
}
