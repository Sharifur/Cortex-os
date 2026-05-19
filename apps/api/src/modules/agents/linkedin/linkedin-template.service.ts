import { Injectable, Logger } from '@nestjs/common';
import { eq, and, isNull, or } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { LlmRouterService } from '../../llm/llm-router.service';
import { linkedinTemplates } from '../../../db/schema';

export interface ProspectContext {
  firstName: string;
  lastName?: string;
  company?: string;
  headline?: string;
  stage: 'connection' | 'dm1' | 'dm2' | 'dm3' | 'dm4' | 'breakup' | 'reengagement';
  targetRole?: string;
  industry?: string;
  topic?: string;
  yourCompany?: string;
  extraContext?: string;
}

@Injectable()
export class LinkedInTemplateService {
  private readonly logger = new Logger(LinkedInTemplateService.name);

  constructor(
    private readonly db: DbService,
    private readonly llm: LlmRouterService,
  ) {}

  async selectAndRender(prospect: ProspectContext): Promise<string> {
    const candidates = await this.fetchCandidates(prospect);
    if (candidates.length === 0) {
      throw new Error(`No templates found for stage=${prospect.stage}`);
    }

    const chosen = candidates.length === 1
      ? candidates[0]
      : await this.pickBest(candidates, prospect);

    return this.renderTemplate(chosen.body, prospect);
  }

  private async fetchCandidates(prospect: ProspectContext) {
    const conditions = [
      eq(linkedinTemplates.stage, prospect.stage),
      eq(linkedinTemplates.isActive, true),
    ];

    // Build role/industry filter: match targetRole or industry, or templates with neither set
    const roleMatch = prospect.targetRole
      ? eq(linkedinTemplates.targetRole, prospect.targetRole)
      : null;
    const industryMatch = prospect.industry
      ? eq(linkedinTemplates.industry, prospect.industry)
      : null;

    if (roleMatch || industryMatch) {
      const specifics = [roleMatch, industryMatch].filter(Boolean) as any[];
      conditions.push(or(
        ...specifics,
        and(isNull(linkedinTemplates.targetRole), isNull(linkedinTemplates.industry)),
      ) as any);
    }

    const rows = await this.db.db
      .select()
      .from(linkedinTemplates)
      .where(and(...conditions))
      .limit(6);

    type Row = typeof linkedinTemplates.$inferSelect;
    const specific = rows.filter((r: Row) => r.targetRole || r.industry);
    const generic = rows.filter((r: Row) => !r.targetRole && !r.industry);

    const pool = specific.length >= 3 ? specific : [...specific, ...generic];
    return pool.slice(0, 5);
  }

  private async pickBest(
    candidates: typeof linkedinTemplates.$inferSelect[],
    prospect: ProspectContext,
  ): Promise<typeof linkedinTemplates.$inferSelect> {
    const numbered = candidates.map((t, i) => `[${i + 1}] Template ${t.templateNumber} (${t.category}):\n${t.body}`).join('\n\n---\n\n');

    const res = await this.llm.complete({
      messages: [
        {
          role: 'system',
          content: `You are selecting the best LinkedIn outreach template for a specific prospect.

Prospect:
- Name: ${prospect.firstName} ${prospect.lastName ?? ''}
- Headline: ${prospect.headline ?? 'unknown'}
- Company: ${prospect.company ?? 'unknown'}
- Stage: ${prospect.stage}
${prospect.extraContext ? `- Context: ${prospect.extraContext}` : ''}

Pick the template that best fits this prospect's role, situation, and the message stage.
Reply with ONLY a single digit: the template number you chose (1-${candidates.length}).`,
        },
        { role: 'user', content: numbered },
      ],
      agentKey: 'linkedin',
      maxTokens: 10,
    });

    const idx = parseInt(res.content.trim(), 10) - 1;
    const chosen = candidates[idx] ?? candidates[0];
    this.logger.log(`Template selected: #${chosen.templateNumber} (${chosen.category})`);
    return chosen;
  }

  // Matches both {placeholder} and [placeholder] styles, case-insensitive
  private readonly PLACEHOLDER_RE = /\{[^}]{1,60}\}|\[[^\]]{1,60}\]/gi;

  private hasPlaceholders(text: string): boolean {
    return this.PLACEHOLDER_RE.test(text);
  }

  private stripRemainingPlaceholders(text: string): string {
    // Remove any unfilled placeholder and collapse double-spaces left behind
    return text
      .replace(this.PLACEHOLDER_RE, '')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private async renderTemplate(body: string, prospect: ProspectContext): Promise<string> {
    // Static fills — known variables
    let draft = body
      .replace(/\{firstName\}|\[First Name\]|\[first name\]/gi, prospect.firstName)
      .replace(/\{lastName\}|\[Last Name\]|\[last name\]/gi, prospect.lastName ?? '')
      .replace(/\{company\}|\[Company\]|\[company name\]/gi, prospect.company ?? '')
      .replace(/\{yourCompany\}|\[Your Company\]/gi, prospect.yourCompany ?? '')
      .replace(/\{headline\}|\[Headline\]/gi, prospect.headline ?? '')
      .replace(/\{topic\}|\[Topic\]|\[Niche\]/gi, prospect.topic ?? '')
      .replace(/\{targetRole\}|\[Target Role\]|\[Role\]/gi, prospect.targetRole ?? '')
      .replace(/\{industry\}|\[Industry\]/gi, prospect.industry ?? '');

    // Reset lastIndex (stateful regex)
    this.PLACEHOLDER_RE.lastIndex = 0;

    if (this.hasPlaceholders(draft)) {
      this.PLACEHOLDER_RE.lastIndex = 0;
      const res = await this.llm.complete({
        messages: [
          {
            role: 'system',
            content: `You are filling in placeholders in a LinkedIn outreach message.

Prospect:
- Name: ${prospect.firstName} ${prospect.lastName ?? ''}
- Headline: ${prospect.headline ?? 'unknown'}
- Company: ${prospect.company ?? 'unknown'}
${prospect.topic ? `- Topic/niche: ${prospect.topic}` : ''}
${prospect.extraContext ? `- Extra context: ${prospect.extraContext}` : ''}

Rules:
- Replace every placeholder (both {curly} and [square] bracket styles) with a specific, natural-sounding value
- If you cannot determine a plausible value for a placeholder, remove it entirely — never leave a placeholder in the output
- Keep filled values short and concrete — no generic filler
- Do NOT add explanations or commentary
- Return only the completed message, nothing else`,
          },
          { role: 'user', content: `Message to complete:\n\n${draft}` },
        ],
        agentKey: 'linkedin',
        maxTokens: 400,
      });
      draft = res.content.trim();
    }

    // Final safety pass — strip any placeholder the LLM missed
    this.PLACEHOLDER_RE.lastIndex = 0;
    if (this.hasPlaceholders(draft)) {
      this.PLACEHOLDER_RE.lastIndex = 0;
      draft = this.stripRemainingPlaceholders(draft);
    }

    return draft;
  }
}
