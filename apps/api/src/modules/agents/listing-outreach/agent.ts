import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { eq, gte, sql } from 'drizzle-orm';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { createId } from '@paralleldrive/cuid2';
import { DbService } from '../../../db/db.service';
import { agents } from '../../../db/schema';
import { listingProspects } from './schema';
import { AgentRegistryService } from '../runtime/agent-registry.service';
import { LlmRouterService } from '../../llm/llm-router.service';
import { TelegramService } from '../../telegram/telegram.service';
import { KnowledgeBaseService } from '../../knowledge-base/knowledge-base.service';
import { SettingsService } from '../../settings/settings.service';
import { BraveSearchService } from '../../brave-search/brave-search.service';
import { TaskipInternalEmailService } from '../taskip-internal/taskip-internal-email.service';
import { GmailService } from '../../gmail/gmail.service';
import { agentLlmOpts } from '../runtime/llm-config.util';
import type {
  IAgent,
  TriggerSpec,
  TriggerEvent,
  RunContext,
  AgentContext,
  ProposedAction,
  ActionResult,
  McpToolDefinition,
  AgentApiRoute,
} from '../runtime/types';

interface ProductTarget {
  domain: string;
  name: string;
  queries: string[];
  outreachGoal?: 'listed' | 'partnership' | 'both';
}

interface ListingConfig {
  products: ProductTarget[];
  monthlyLimit: number;
  perRunLimit: number;
  minScore: number;
  cooldownDays: number;
  llm?: { provider?: string; model?: string };
}

interface ResearchedProspect {
  id: string;
  domain: string;
  productDomain: string;
  productName: string;
  outreachGoal: 'listed' | 'partnership' | 'both';
  siteName: string;
  siteUrl: string;
  description: string;
  contactEmail: string | null;
  linkedinProfileUrl: string | null;
  submitUrl: string | null;
  contactFormUrl: string | null;
  qualityScore: number;
  openPageRank: number | null;
  searchRank: number;
  searchQuery: string;
  gmailAccountEmail: string;
  gmailAccountId: string | null;
}

interface ListingSnapshot {
  prospects: ResearchedProspect[];
  config: ListingConfig;
  atLimit: boolean;
  monthlyCount: number;
}

// Well-known domains with near-zero chance of accepting cold outreach.
const ENTERPRISE_DOMAIN_BLOCKLIST = new Set([
  // Atlassian suite
  'trello.com', 'atlassian.com', 'jira.com', 'confluence.com', 'bitbucket.org',
  // Automation / integration platforms
  'zapier.com', 'make.com', 'integromat.com', 'n8n.io', 'workato.com',
  // CRM / support giants
  'zendesk.com', 'salesforce.com', 'hubspot.com', 'intercom.com', 'freshdesk.com',
  'freshworks.com', 'zoho.com', 'pipedrive.com', 'monday.com',
  // Project management incumbents
  'asana.com', 'notion.com', 'clickup.com', 'basecamp.com', 'wrike.com',
  'airtable.com', 'smartsheet.com', 'teamwork.com', 'linear.app',
  // Dev / productivity platforms
  'github.com', 'gitlab.com', 'slack.com', 'discord.com', 'microsoft.com',
  'google.com', 'apple.com', 'amazon.com', 'shopify.com', 'stripe.com',
  'twilio.com', 'sendgrid.com', 'mailchimp.com', 'convertkit.com',
  // Other big SaaS
  'dropbox.com', 'box.com', 'evernote.com', 'todoist.com', 'things.app',
  'miro.com', 'figma.com', 'canva.com', 'loom.com', 'calendly.com',
  'typeform.com', 'surveymonkey.com', 'docusign.com', 'webflow.com',
  // News / media — filter 3
  'techcrunch.com', 'forbes.com', 'wired.com', 'venturebeat.com', 'inc.com',
  'entrepreneur.com', 'businessinsider.com', 'theverge.com', 'mashable.com',
  'zdnet.com', 'cnet.com', 'pcmag.com', 'infoq.com', 'thenextweb.com',
  'siliconangle.com', 'techradar.com', 'computerworld.com', 'infoworld.com',
  'fastcompany.com', 'hbr.org', 'bloomberg.com', 'reuters.com', 'nytimes.com',
  'wsj.com', 'ft.com', 'economist.com',
  // Social platforms — filter 4
  'twitter.com', 'x.com', 'linkedin.com', 'youtube.com', 'facebook.com',
  'instagram.com', 'tiktok.com', 'reddit.com', 'pinterest.com', 'quora.com',
  'medium.com', 'substack.com', 'producthunt.com', 'appsumo.com',
  'indiehackers.com', 'hackernews.com', 'ycombinator.com',
]);

// Keywords in title/description that indicate non-directory content (filter 5)
const REJECT_TITLE_KEYWORDS = [
  'news', 'magazine', 'journal', 'jobs', 'careers', 'hiring', 'recruitment',
  'podcast', 'webinar', 'conference', 'event', 'press release', 'blog post',
  'breaking', 'report', 'study', 'research paper',
];

// Keywords that confirm the page is a directory/listing site (filter 5 positive)
const REQUIRE_CONTENT_KEYWORDS = [
  'directory', 'listing', 'tools', 'alternatives', 'top ', 'best ', 'reviews',
  'compare', 'software', 'saas', 'apps', 'productivity', 'platform', 'solution',
];

function isLikelyDirectory(title: string, description: string): boolean {
  const combined = (title + ' ' + description).toLowerCase();
  const hasReject = REJECT_TITLE_KEYWORDS.some(kw => combined.includes(kw));
  if (hasReject) return false;
  return REQUIRE_CONTENT_KEYWORDS.some(kw => combined.includes(kw));
}

function isLikelyEnglish(text: string): boolean {
  if (!text || text.length < 20) return true;
  const ascii = text.split('').filter(c => c.charCodeAt(0) < 128).length;
  return ascii / text.length >= 0.7;
}

const DEFAULT_CONFIG: ListingConfig = {
  products: [
    {
      domain: 'taskip.net',
      name: 'Taskip',
      queries: [
        'top project management SaaS tools 2025',
        'best SaaS tools for teams directory',
        'client portal software list',
        'best client portal software 2025',
        'project management tool directory',
      ],
      outreachGoal: 'both',
    },
    {
      domain: 'xgenious.com',
      name: 'Xgenious',
      queries: [
        'top web development agencies directory 2025',
        'best Laravel development companies list',
        'software development agency directory',
        'hire web developers directory',
        'top custom software development companies',
      ],
      outreachGoal: 'partnership',
    },
  ],
  monthlyLimit: 20,
  perRunLimit: 10,
  minScore: 30,
  cooldownDays: 30,
};

@Injectable()
export class ListingOutreachAgent implements IAgent, OnModuleInit {
  readonly key = 'listing_outreach';
  readonly name = 'Listing Outreach Agent';
  private readonly logger = new Logger(ListingOutreachAgent.name);

  constructor(
    private readonly db: DbService,
    private readonly llm: LlmRouterService,
    private readonly telegram: TelegramService,
    private readonly kb: KnowledgeBaseService,
    private readonly settings: SettingsService,
    private readonly brave: BraveSearchService,
    private readonly emails: TaskipInternalEmailService,
    private readonly gmail: GmailService,
    private readonly registry: AgentRegistryService,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  triggers(): TriggerSpec[] {
    return [{ type: 'CRON', cron: '0 9 * * 1' }];
  }

  async buildContext(_trigger: TriggerEvent, _run: RunContext): Promise<AgentContext> {
    const config = await this.getConfig();

    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    firstOfMonth.setHours(0, 0, 0, 0);

    const monthlyRows = await this.db.db
      .select({ id: listingProspects.id })
      .from(listingProspects)
      .where(gte(listingProspects.lastContactedAt, firstOfMonth));

    const monthlyCount = monthlyRows.length;
    if (monthlyCount >= config.monthlyLimit) {
      await _run.log?.('info', `Monthly limit reached (${monthlyCount}/${config.monthlyLimit}) — skipping run`);
      return {
        source: _trigger,
        snapshot: { prospects: [], config, atLimit: true, monthlyCount },
        followups: [],
      };
    }

    const remaining = Math.min(config.monthlyLimit - monthlyCount, config.perRunLimit);
    const cooldownDate = new Date(Date.now() - config.cooldownDays * 86400000);
    const rejectionCooldownDate = new Date(Date.now() - 90 * 86400000);

    const gmailAccounts = await this.gmail.listAccounts();
    const defaultAccount = gmailAccounts.find((a) => a.isDefault) ?? gmailAccounts[0] ?? null;

    await _run.log?.('info', `Starting discovery for ${config.products.length} product(s) — slots remaining: ${remaining}`);

    const allDiscovered: Array<{
      product: (typeof config.products)[number];
      url: string;
      title: string;
      description: string;
      rank: number;
      query: string;
    }> = [];

    await Promise.allSettled(
      config.products.flatMap((product) =>
        product.queries.map(async (query) => {
          const results = await this.brave.search(query, 10);
          for (const r of results) {
            allDiscovered.push({ product, ...r, query });
          }
        }),
      ),
    );

    await _run.log?.('info', `Brave Search complete — ${allDiscovered.length} raw results across all products`);

    const seenKeys = new Set<string>();
    const toResearch: Array<{
      product: (typeof config.products)[number];
      url: string;
      title: string;
      description: string;
      rank: number;
      query: string;
      domain: string;
    }> = [];

    for (const item of allDiscovered) {
      const domain = this.extractDomain(item.url);
      if (!domain) continue;
      if (ENTERPRISE_DOMAIN_BLOCKLIST.has(domain)) {
        this.logger.log(`Skipping enterprise domain: ${domain}`);
        continue;
      }
      // Filter 5: non-directory content (news, jobs, podcasts, etc.)
      if (!isLikelyDirectory(item.title, item.description)) {
        this.logger.log(`Skipping non-directory content: ${domain} — "${item.title}"`);
        continue;
      }
      // Filter 7: non-English title/description
      if (!isLikelyEnglish(item.title + ' ' + item.description)) {
        this.logger.log(`Skipping non-English domain: ${domain}`);
        continue;
      }
      const key = `${domain}::${item.product.domain}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      const existing = await this.db.db
        .select({ id: listingProspects.id, lastContactedAt: listingProspects.lastContactedAt, status: listingProspects.status, updatedAt: listingProspects.updatedAt })
        .from(listingProspects)
        .where(eq(listingProspects.domain, domain))
        .limit(1);

      if (existing.length) {
        if (existing[0].lastContactedAt && existing[0].lastContactedAt > cooldownDate) continue;
        // Filter 9: rejected cooldown — skip if rejected within 90 days
        if (existing[0].status === 'rejected' && existing[0].updatedAt && existing[0].updatedAt > rejectionCooldownDate) continue;
      }

      toResearch.push({ ...item, domain });
      if (toResearch.length >= remaining * 3) break;
    }

    await _run.log?.('info', `Researching ${toResearch.length} candidate sites (concurrency: 5)`);

    const researched: ResearchedProspect[] = [];
    const chunks: (typeof toResearch)[] = [];
    for (let i = 0; i < toResearch.length; i += 5) {
      chunks.push(toResearch.slice(i, i + 5));
    }

    for (const chunk of chunks) {
      const results = await Promise.allSettled(
        chunk.map(async (item) => {
          const [opr, scraped] = await Promise.all([
            this.brave.getOpenPageRank(item.domain),
            this.scrapeSite(item.url),
          ]);

          // OPR ≥ 7 = high-authority brand (enterprise or major directory that won't accept cold outreach)
          if (opr !== null && opr >= 7) {
            this.logger.log(`Skipping high-authority domain ${item.domain} (OPR: ${opr})`);
            return null;
          }
          // Filter 2: OPR < 0.5 = too small to have meaningful audience
          if (opr !== null && opr < 0.5) {
            this.logger.log(`Skipping low-authority domain ${item.domain} (OPR: ${opr})`);
            return null;
          }
          // Filter 1: no contact path found after scraping
          if (!scraped.contactEmail && !scraped.submitUrl && !scraped.contactFormUrl) {
            this.logger.log(`Skipping no-contact-path domain: ${item.domain}`);
            return null;
          }

          const score = this.calcScore(item.rank, opr, scraped);

          const id = await this.upsertProspect({
            domain: item.domain,
            productDomain: item.product.domain,
            productName: item.product.name,
            outreachGoal: item.product.outreachGoal ?? 'both',
            siteUrl: item.url,
            siteName: item.title,
            description: item.description,
            qualityScore: score,
            openPageRank: opr,
            searchRank: item.rank,
            searchQuery: item.query,
            status: score < config.minScore ? 'discovered' : 'researched',
            gmailAccountId: score < config.minScore ? null : (defaultAccount?.id ?? null),
            ...scraped,
          });

          if (score < config.minScore) return null;

          return {
            id,
            domain: item.domain,
            productDomain: item.product.domain,
            productName: item.product.name,
            outreachGoal: (item.product.outreachGoal ?? 'both') as 'listed' | 'partnership' | 'both',
            siteName: item.title,
            siteUrl: item.url,
            description: item.description,
            contactEmail: scraped.contactEmail,
            linkedinProfileUrl: scraped.linkedinProfileUrl,
            submitUrl: scraped.submitUrl,
            contactFormUrl: scraped.contactFormUrl,
            qualityScore: score,
            openPageRank: opr,
            searchRank: item.rank,
            searchQuery: item.query,
            gmailAccountEmail: defaultAccount?.email ?? '',
            gmailAccountId: defaultAccount?.id ?? null,
          } satisfies ResearchedProspect;
        }),
      );

      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
          researched.push(r.value);
        }
      }

      await _run.log?.('info', `Researched chunk — ${researched.length} qualified prospects so far`);
    }

    researched.sort((a, b) => b.qualityScore - a.qualityScore);
    const prospects = researched.slice(0, remaining);

    await _run.log?.('info', `Discovery complete — ${prospects.length} prospects queued for outreach`);

    return {
      source: _trigger,
      snapshot: { prospects, config, atLimit: false, monthlyCount },
      followups: [],
    };
  }

  async decide(ctx: AgentContext): Promise<ProposedAction[]> {
    const snap = ctx.snapshot as ListingSnapshot;

    if (snap.atLimit) {
      return [{
        type: 'noop',
        summary: `Monthly outreach limit reached (${snap.monthlyCount}/${snap.config.monthlyLimit}). Next run will be next month.`,
        payload: {},
        riskLevel: 'low',
      }];
    }

    if (!snap.prospects.length) {
      return [{ type: 'noop', summary: 'No new listing sites found this run.', payload: {}, riskLevel: 'low' }];
    }

    const [alwaysOn, samples, blocklist, rejections] = await Promise.all([
      this.kb.getAlwaysOnContext(this.key),
      this.kb.getWritingSamples(this.key),
      this.kb.getBlocklistRules(this.key),
      this.kb.getRecentRejections(this.key, 3),
    ]);

    const kbBlock = this.kb.buildKbPromptBlock({
      voiceProfile: alwaysOn.find((e) => e.entryType === 'voice_profile') ?? null,
      facts: alwaysOn.filter((e) => e.entryType === 'fact'),
      catalog: alwaysOn.filter((e) => e.entryType === 'product' || e.entryType === 'service' || e.entryType === 'offer'),
      references: [],
      positiveSamples: samples.filter((s) => s.polarity === 'positive'),
      negativeSamples: samples.filter((s) => s.polarity === 'negative'),
      rejections,
    });

    const actions: ProposedAction[] = [];

    for (const p of snap.prospects) {
      try {
        const goalLabel = p.outreachGoal === 'listed'
          ? `get ${p.productName} listed`
          : p.outreachGoal === 'partnership'
          ? `explore a partnership or backlink opportunity for ${p.productName}`
          : `get ${p.productName} listed and explore partnership possibilities`;

        const emailSystemPrompt = `You write short, direct outreach emails to website editors and founders.
Product: ${p.productName} (${p.productDomain})
Goal: ${goalLabel} on ${p.siteName} (${p.domain}).
Rules: 2-3 short paragraphs max. No fluff. No long intros. Explain briefly what ${p.productName} is and why it fits their audience. End with a clear, low-pressure CTA.
Return ONLY the email body text, no subject line.${kbBlock}`;

        const response = await this.llm.complete({
          messages: [
            { role: 'system', content: emailSystemPrompt },
            { role: 'user', content: `Site: ${p.siteName}\nURL: ${p.siteUrl}\nDescription: ${p.description}\nSearch query: "${p.searchQuery}"` },
          ],
          ...agentLlmOpts(snap.config),
          agentKey: this.key,
          maxTokens: 300,
        });

        let body = response.content.trim();
        if (!body) continue;

        body = await this.selfCritique(body, alwaysOn.find((e) => e.entryType === 'voice_profile')?.content, blocklist);
        const violation = blocklist.find((b) => body.toLowerCase().includes(b.toLowerCase()));

        const subject = `${p.productName} — ${p.outreachGoal === 'listed' ? 'can we get listed on' : 'partnership opportunity with'} ${p.siteName}`;

        const contactLine = p.contactEmail
          ? `Email: ${p.contactEmail}`
          : p.submitUrl
          ? `Submit form: ${p.submitUrl}`
          : p.contactFormUrl
          ? `Contact form: ${p.contactFormUrl}`
          : 'No contact found';

        const linkedinLine = p.linkedinProfileUrl ? `LinkedIn: ${p.linkedinProfileUrl}` : null;

        const summaryParts = [
          `[${p.productName} → ${p.domain}] Score: ${p.qualityScore}/100${p.openPageRank ? ` (OPR: ${p.openPageRank})` : ''} | Rank: #${p.searchRank}`,
          contactLine,
          linkedinLine,
          `From: ${p.gmailAccountEmail}`,
          `---`,
          `Subject: ${subject}`,
          body,
        ].filter(Boolean);

        await this.db.db
          .update(listingProspects)
          .set({ outreachSubject: subject, outreachBody: body, status: 'pending_approval', updatedAt: new Date() })
          .where(eq(listingProspects.id, p.id));

        actions.push({
          type: 'send_listing_outreach',
          summary: summaryParts.join('\n'),
          payload: {
            prospectId: p.id,
            domain: p.domain,
            siteName: p.siteName,
            contactEmail: p.contactEmail,
            submitUrl: p.submitUrl,
            linkedinProfileUrl: p.linkedinProfileUrl,
            gmailAccountId: p.gmailAccountId,
            subject,
            body,
            qualityScore: p.qualityScore,
          },
          riskLevel: violation ? 'high' : 'medium',
        });
      } catch (err) {
        this.logger.warn(`Failed to draft for ${p.domain}: ${err}`);
      }
    }

    return actions.length
      ? actions
      : [{ type: 'noop', summary: 'All prospects discovered but no email drafts generated.', payload: {}, riskLevel: 'low' }];
  }

  requiresApproval(action: ProposedAction): boolean {
    return action.type === 'send_listing_outreach';
  }

  async execute(action: ProposedAction): Promise<ActionResult> {
    if (action.type === 'noop') return { success: true };

    const p = action.payload as {
      prospectId: string;
      domain: string;
      siteName: string;
      contactEmail: string | null;
      submitUrl: string | null;
      linkedinProfileUrl: string | null;
      gmailAccountId: string | null;
      subject: string;
      body: string;
      qualityScore: number;
    };

    if (p.contactEmail) {
      const result = await this.emails.send({
        purpose: 'other',
        recipient: p.contactEmail,
        subject: p.subject,
        body: p.body,
        accountId: p.gmailAccountId ?? undefined,
      });

      await this.db.db
        .update(listingProspects)
        .set({
          status: 'emailed',
          emailId: result.id,
          lastContactedAt: new Date(),
          nextContactAt: new Date(Date.now() + 30 * 86400000),
          updatedAt: new Date(),
        })
        .where(eq(listingProspects.id, p.prospectId));

      await this.telegram.sendMessage(
        `Outreach sent to ${p.siteName} (${p.domain})\nEmail: ${p.contactEmail}\nScore: ${p.qualityScore}/100`,
      );
    } else {
      await this.db.db
        .update(listingProspects)
        .set({
          status: 'emailed',
          lastContactedAt: new Date(),
          nextContactAt: new Date(Date.now() + 30 * 86400000),
          updatedAt: new Date(),
        })
        .where(eq(listingProspects.id, p.prospectId));

      const note = p.submitUrl
        ? `Submit form: ${p.submitUrl}`
        : p.linkedinProfileUrl
        ? `LinkedIn: ${p.linkedinProfileUrl}`
        : 'No direct contact — fill form manually';

      await this.telegram.sendMessage(
        `Listing outreach approved for ${p.siteName} (${p.domain})\nNo email found — ${note}`,
      );
    }

    return { success: true, data: { domain: p.domain } };
  }

  mcpTools(): McpToolDefinition[] {
    return [];
  }

  apiRoutes(): AgentApiRoute[] {
    return [
      {
        method: 'GET',
        path: '/listing-outreach/prospects',
        requiresAuth: true,
        handler: async (params) => {
          const { status, page, pageSize } = params as { status?: string; page?: string; pageSize?: string };
          const size = Math.min(Number(pageSize) || 20, 100);
          const offset = (Math.max(Number(page) || 1, 1) - 1) * size;
          const where = status ? eq(listingProspects.status, status) : undefined;

          const [rows, countResult] = await Promise.all([
            this.db.db
              .select()
              .from(listingProspects)
              .where(where)
              .orderBy(sql`quality_score DESC NULLS LAST, created_at DESC`)
              .limit(size)
              .offset(offset),
            this.db.db
              .select({ count: sql<string>`COUNT(*)` })
              .from(listingProspects)
              .where(where),
          ]);

          return {
            data: rows,
            total: Number(countResult[0]?.count ?? 0),
            page: Math.max(Number(page) || 1, 1),
            pageSize: size,
          };
        },
      },
      {
        method: 'PATCH',
        path: '/listing-outreach/prospects/:id',
        requiresAuth: true,
        handler: async (params) => {
          const { id, status, notes } = params as { id: string; status?: string; notes?: string };
          await this.db.db
            .update(listingProspects)
            .set({ ...(status ? { status } : {}), ...(notes ? { notes } : {}), updatedAt: new Date() })
            .where(eq(listingProspects.id, id));
          return { ok: true };
        },
      },
      {
        method: 'POST',
        path: '/listing-outreach/prospects/:id/draft',
        requiresAuth: true,
        handler: async (params) => {
          const { id } = params as { id: string };
          const [prospect] = await this.db.db.select().from(listingProspects).where(eq(listingProspects.id, id)).limit(1);
          if (!prospect) throw new Error('Prospect not found');

          const [agentRow] = await this.db.db.select().from(agents).where(eq(agents.key, this.key)).limit(1);
          const config: ListingConfig = { ...DEFAULT_CONFIG, ...((agentRow?.config as Partial<ListingConfig>) ?? {}) };

          const [alwaysOn, samples, blocklist, rejections] = await Promise.all([
            this.kb.getAlwaysOnContext(this.key),
            this.kb.getWritingSamples(this.key),
            this.kb.getBlocklistRules(this.key),
            this.kb.getRecentRejections(this.key, 3),
          ]);

          const kbBlock = this.kb.buildKbPromptBlock({
            voiceProfile: alwaysOn.find((e) => e.entryType === 'voice_profile') ?? null,
            facts: alwaysOn.filter((e) => e.entryType === 'fact'),
            catalog: alwaysOn.filter((e) => e.entryType === 'product' || e.entryType === 'service' || e.entryType === 'offer'),
            references: [],
            positiveSamples: samples.filter((s) => s.polarity === 'positive'),
            negativeSamples: samples.filter((s) => s.polarity === 'negative'),
            rejections,
          });

          const product = config.products.find((pr) => pr.domain === prospect.productDomain) ?? config.products[0];
          const productName = prospect.productName ?? product.name;
          const outreachGoal = prospect.outreachGoal as 'listed' | 'partnership' | 'both';
          const siteName = prospect.siteName ?? prospect.domain;

          const goalLabel = outreachGoal === 'listed'
            ? `get ${productName} listed`
            : outreachGoal === 'partnership'
            ? `explore a partnership or backlink opportunity for ${productName}`
            : `get ${productName} listed and explore partnership possibilities`;

          const emailSystemPrompt = `You write short, direct outreach emails to website editors and founders.
Product: ${productName} (${prospect.productDomain})
Goal: ${goalLabel} on ${siteName} (${prospect.domain}).
Rules: 2-3 short paragraphs max. No fluff. No long intros. Explain briefly what ${productName} is and why it fits their audience. End with a clear, low-pressure CTA.
Return ONLY the email body text, no subject line.${kbBlock}`;

          const response = await this.llm.complete({
            messages: [
              { role: 'system', content: emailSystemPrompt },
              { role: 'user', content: `Site: ${siteName}\nURL: ${prospect.siteUrl}\nDescription: ${prospect.description ?? ''}\nSearch query: "${prospect.searchQuery ?? ''}"` },
            ],
            ...agentLlmOpts(config),
            agentKey: this.key,
            maxTokens: 300,
          });

          let body = response.content.trim();
          if (!body) throw new Error('LLM returned empty draft');

          body = await this.selfCritique(body, alwaysOn.find((e) => e.entryType === 'voice_profile')?.content, blocklist);
          const subject = `${productName} — ${outreachGoal === 'listed' ? 'can we get listed on' : 'partnership opportunity with'} ${siteName}`;

          await this.db.db
            .update(listingProspects)
            .set({ outreachSubject: subject, outreachBody: body, updatedAt: new Date() })
            .where(eq(listingProspects.id, id));

          return { ok: true, subject, body };
        },
      },
      {
        method: 'POST',
        path: '/listing-outreach/prospects/:id/send',
        requiresAuth: true,
        handler: async (params) => {
          const { id } = params as { id: string };
          const [prospect] = await this.db.db.select().from(listingProspects).where(eq(listingProspects.id, id)).limit(1);
          if (!prospect) throw new Error('Prospect not found');
          if (!prospect.contactEmail) throw new Error('No contact email on this prospect');
          if (!prospect.outreachSubject || !prospect.outreachBody) throw new Error('No outreach draft — run the agent first');

          const result = await this.emails.send({
            purpose: 'other',
            recipient: prospect.contactEmail,
            subject: prospect.outreachSubject,
            body: prospect.outreachBody,
            accountId: prospect.gmailAccountId ?? undefined,
          });

          await this.db.db
            .update(listingProspects)
            .set({
              status: 'emailed',
              emailId: result.id,
              lastContactedAt: new Date(),
              nextContactAt: new Date(Date.now() + 30 * 86400000),
              updatedAt: new Date(),
            })
            .where(eq(listingProspects.id, id));

          return { ok: true, emailId: result.id };
        },
      },
      {
        method: 'DELETE',
        path: '/listing-outreach/prospects/:id',
        requiresAuth: true,
        handler: async (params) => {
          const { id } = params as { id: string };
          await this.db.db.delete(listingProspects).where(eq(listingProspects.id, id));
          return { ok: true };
        },
      },
    ];
  }

  private async scrapeSite(url: string): Promise<{
    contactEmail: string | null;
    linkedinProfileUrl: string | null;
    submitUrl: string | null;
    contactFormUrl: string | null;
  }> {
    const result = { contactEmail: null as string | null, linkedinProfileUrl: null as string | null, submitUrl: null as string | null, contactFormUrl: null as string | null };

    const pagesToTry = ['', '/contact', '/about', '/submit-tool'];

    for (const path of pagesToTry) {
      if (result.contactEmail) break;
      try {
        const target = path ? new URL(path, url).href : url;
        const res = await axios.get(target, {
          timeout: 5000,
          maxContentLength: 1_500_000,
          headers: { 'User-Agent': 'CortexBot/1.0' },
          validateStatus: (s) => s < 400,
        });
        const $ = cheerio.load(res.data as string);

        $('a[href^="mailto:"]').each((_, el) => {
          if (!result.contactEmail) {
            const email = $(el).attr('href')?.replace('mailto:', '').split('?')[0].trim();
            if (email && email.includes('@')) result.contactEmail = email;
          }
        });

        $('a[href*="linkedin.com/in/"]').each((_, el) => {
          if (!result.linkedinProfileUrl) {
            const href = $(el).attr('href') ?? '';
            const match = href.match(/linkedin\.com\/in\/[^/?#"'\s]+/);
            if (match) result.linkedinProfileUrl = `https://${match[0]}`;
          }
        });

        if (!result.submitUrl) {
          $('a').each((_, el) => {
            const href = ($(el).attr('href') ?? '').toLowerCase();
            const text = ($(el).text() ?? '').toLowerCase();
            if (!result.submitUrl && (href.includes('submit') || href.includes('add-tool') || text.includes('submit') || text.includes('add listing'))) {
              const full = $(el).attr('href') ?? '';
              if (full && !full.startsWith('mailto:')) {
                try { result.submitUrl = new URL(full, target).href; } catch {}
              }
            }
          });
        }

        if (!result.contactFormUrl) {
          $('a').each((_, el) => {
            const href = ($(el).attr('href') ?? '').toLowerCase();
            const text = ($(el).text() ?? '').toLowerCase();
            if (!result.contactFormUrl && (href.includes('contact') || text.includes('contact us'))) {
              const full = $(el).attr('href') ?? '';
              if (full && !full.startsWith('mailto:')) {
                try { result.contactFormUrl = new URL(full, target).href; } catch {}
              }
            }
          });
        }
      } catch {
        // skip unreachable pages
      }
    }

    return result;
  }

  private calcScore(rank: number, opr: number | null, scraped: { contactEmail: string | null; submitUrl: string | null }): number {
    const rankScore = Math.max(3, 30 - (rank - 1) * 3);
    const oprScore = opr !== null ? Math.round((opr / 10) * 40) : 0;
    const emailBonus = scraped.contactEmail ? 15 : 0;
    const submitBonus = scraped.submitUrl ? 10 : 0;
    return Math.min(100, rankScore + oprScore + emailBonus + submitBonus);
  }

  private extractDomain(url: string): string | null {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
  }

  private async upsertProspect(data: {
    domain: string;
    productDomain: string;
    productName: string;
    outreachGoal: 'listed' | 'partnership' | 'both';
    siteUrl: string;
    siteName: string;
    description: string;
    qualityScore: number;
    openPageRank: number | null;
    searchRank: number;
    searchQuery: string;
    status: string;
    contactEmail?: string | null;
    linkedinProfileUrl?: string | null;
    submitUrl?: string | null;
    contactFormUrl?: string | null;
    gmailAccountId?: string | null;
  }): Promise<string> {
    const existing = await this.db.db
      .select({ id: listingProspects.id })
      .from(listingProspects)
      .where(sql`domain = ${data.domain} AND product_domain = ${data.productDomain}`)
      .limit(1);

    if (existing.length) {
      await this.db.db
        .update(listingProspects)
        .set({
          siteName: data.siteName,
          productName: data.productName,
          outreachGoal: data.outreachGoal,
          description: data.description,
          qualityScore: data.qualityScore,
          openPageRank: data.openPageRank?.toString() ?? null,
          searchRank: data.searchRank,
          searchQuery: data.searchQuery,
          status: data.status,
          contactEmail: data.contactEmail ?? null,
          linkedinProfileUrl: data.linkedinProfileUrl ?? null,
          submitUrl: data.submitUrl ?? null,
          contactFormUrl: data.contactFormUrl ?? null,
          gmailAccountId: data.gmailAccountId ?? null,
          updatedAt: new Date(),
        })
        .where(eq(listingProspects.id, existing[0].id));
      return existing[0].id;
    }

    const id = createId();
    await this.db.db.insert(listingProspects).values({
      id,
      domain: data.domain,
      productDomain: data.productDomain,
      productName: data.productName,
      outreachGoal: data.outreachGoal,
      siteUrl: data.siteUrl,
      siteName: data.siteName,
      description: data.description,
      qualityScore: data.qualityScore,
      openPageRank: data.openPageRank?.toString() ?? null,
      searchRank: data.searchRank,
      searchQuery: data.searchQuery,
      status: data.status,
      contactEmail: data.contactEmail ?? null,
      linkedinProfileUrl: data.linkedinProfileUrl ?? null,
      submitUrl: data.submitUrl ?? null,
      contactFormUrl: data.contactFormUrl ?? null,
      gmailAccountId: data.gmailAccountId ?? null,
    });
    return id;
  }

  private async selfCritique(draft: string, voiceProfile?: string, blocklist?: string[]): Promise<string> {
    try {
      const critique = await this.llm.complete({
        messages: [
          {
            role: 'system',
            content: `You are a strict editor reviewing an outreach email draft.
Voice: ${voiceProfile ?? 'direct, professional, no hype'}
Avoid: ${blocklist?.join(', ') || 'spam phrases, excessive praise'}
If good: return {"ok":true}
If not: rewrite and return {"ok":false,"revised":"improved email body"}`,
          },
          { role: 'user', content: `Draft: "${draft}"` },
        ],
        agentKey: this.key,
        maxTokens: 350,
      });
      const result = JSON.parse(critique.content);
      if (!result.ok && result.revised) return result.revised.trim();
    } catch {
      // fail-open
    }
    return draft;
  }

  @OnEvent('kb.rejection')
  async onRejection(event: { agentKey: string; draft: string; reason: string }): Promise<void> {
    if (event.agentKey !== this.key) return;

    // Summary format: "[ProductName → domain] ..."
    const match = event.draft.match(/\[.+?\s*→\s*([^\]\s]+)\]/);
    if (!match) return;
    const domain = match[1].trim();

    const [prospect] = await this.db.db
      .select()
      .from(listingProspects)
      .where(eq(listingProspects.domain, domain))
      .limit(1);

    if (!prospect) return;

    await this.db.db
      .update(listingProspects)
      .set({ status: 'rejected', notes: event.reason, updatedAt: new Date() })
      .where(eq(listingProspects.id, prospect.id));

    try {
      const [agentRow] = await this.db.db.select().from(agents).where(eq(agents.key, this.key)).limit(1);
      const config: ListingConfig = { ...DEFAULT_CONFIG, ...((agentRow?.config as Partial<ListingConfig>) ?? {}) };

      const [alwaysOn, samples, blocklist] = await Promise.all([
        this.kb.getAlwaysOnContext(this.key),
        this.kb.getWritingSamples(this.key),
        this.kb.getBlocklistRules(this.key),
      ]);

      const kbBlock = this.kb.buildKbPromptBlock({
        voiceProfile: alwaysOn.find((e) => e.entryType === 'voice_profile') ?? null,
        facts: alwaysOn.filter((e) => e.entryType === 'fact'),
        catalog: alwaysOn.filter((e) => e.entryType === 'product' || e.entryType === 'service' || e.entryType === 'offer'),
        references: [],
        positiveSamples: samples.filter((s) => s.polarity === 'positive'),
        negativeSamples: samples.filter((s) => s.polarity === 'negative'),
        rejections: [],
      });

      const productName = prospect.productName ?? 'Taskip';
      const siteName = prospect.siteName ?? domain;
      const outreachGoal = prospect.outreachGoal as 'listed' | 'partnership' | 'both';

      const goalLabel = outreachGoal === 'listed'
        ? `get ${productName} listed`
        : outreachGoal === 'partnership'
        ? `explore a partnership or backlink opportunity for ${productName}`
        : `get ${productName} listed and explore partnership possibilities`;

      const response = await this.llm.complete({
        messages: [
          {
            role: 'system',
            content: `You write short, direct outreach emails to website editors and founders.
Product: ${productName} (${prospect.productDomain})
Goal: ${goalLabel} on ${siteName} (${domain}).
The previous draft was rejected. Rejection reason: "${event.reason}"
Address the feedback directly. Rules: 2-3 short paragraphs max. No fluff. No long intros.
Return ONLY the email body text, no subject line.${kbBlock}`,
          },
          {
            role: 'user',
            content: `Site: ${siteName}\nURL: ${prospect.siteUrl}\nDescription: ${prospect.description ?? ''}\nPrevious draft:\n${prospect.outreachBody ?? ''}`,
          },
        ],
        ...agentLlmOpts(config),
        agentKey: this.key,
        maxTokens: 300,
      });

      const body = response.content.trim();
      if (!body) return;

      await this.db.db
        .update(listingProspects)
        .set({ outreachBody: body, status: 'researched', updatedAt: new Date() })
        .where(eq(listingProspects.id, prospect.id));

      await this.telegram.sendMessage(
        `Re-drafted outreach for ${siteName} (${domain})\nRejection reason: "${event.reason}"\n---\n${body}`,
      );
    } catch (err) {
      this.logger.warn(`Re-draft failed for ${domain}: ${err}`);
    }
  }

  private async getConfig(): Promise<ListingConfig> {
    const [row] = await this.db.db.select().from(agents).where(eq(agents.key, this.key));
    const cfg = (row?.config as Partial<ListingConfig> | null) ?? {};

    const [monthlyLimit, perRunLimit, minScore] = await Promise.all([
      this.settings.getDecrypted('listing_outreach_monthly_limit').catch(() => null),
      this.settings.getDecrypted('listing_outreach_per_run_limit').catch(() => null),
      this.settings.getDecrypted('listing_outreach_min_score').catch(() => null),
    ]);

    return {
      ...DEFAULT_CONFIG,
      ...cfg,
      products: cfg.products ?? DEFAULT_CONFIG.products,
      monthlyLimit: cfg.monthlyLimit ?? (monthlyLimit ? Number(monthlyLimit) : DEFAULT_CONFIG.monthlyLimit),
      perRunLimit: cfg.perRunLimit ?? (perRunLimit ? Number(perRunLimit) : DEFAULT_CONFIG.perRunLimit),
      minScore: cfg.minScore ?? (minScore ? Number(minScore) : DEFAULT_CONFIG.minScore),
    };
  }
}
