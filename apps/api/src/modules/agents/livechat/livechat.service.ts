import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { eq, sql, desc, and, inArray, gte } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import {
  livechatSites,
  livechatVisitors,
  livechatPageviews,
  livechatSessions,
  livechatMessages,
} from './schema';
import { EnrichmentService, EnrichedVisitor } from '../../../common/visitor-enrichment/enrichment.service';
import { LivechatOriginCache } from './livechat-origin.cache';
import { ContactsService } from '../../contacts/contacts.service';

export type WidgetPosition = 'bottom-right' | 'bottom-left';

export interface LivechatSiteRow {
  id: string;
  key: string;
  label: string;
  origin: string;
  enabled: boolean;
  productContext: string | null;
  replyTone: string | null;
  trackBots: boolean;
  autoApprove: boolean;
  botName: string | null;
  botSubtitle: string | null;
  welcomeMessage: string | null;
  brandColor: string | null;
  position: WidgetPosition;
  llmProvider: string | null;
  llmModel: string | null;
  transcriptEnabled: boolean;
  transcriptBcc: string | null;
  transcriptFrom: string | null;
  createdAt: Date;
}

export interface CreateSiteDto {
  key: string;
  label: string;
  origin: string;
  productContext?: string | null;
  replyTone?: string | null;
  trackBots?: boolean;
  autoApprove?: boolean;
  botName?: string | null;
  botSubtitle?: string | null;
  welcomeMessage?: string | null;
  brandColor?: string | null;
  position?: WidgetPosition;
  llmProvider?: string | null;
  llmModel?: string | null;
  transcriptEnabled?: boolean;
  transcriptBcc?: string | null;
  transcriptFrom?: string | null;
}

export interface UpdateSiteDto {
  label?: string;
  origin?: string;
  enabled?: boolean;
  productContext?: string | null;
  replyTone?: string | null;
  trackBots?: boolean;
  autoApprove?: boolean;
  botName?: string | null;
  botSubtitle?: string | null;
  welcomeMessage?: string | null;
  brandColor?: string | null;
  position?: WidgetPosition;
  llmProvider?: string | null;
  llmModel?: string | null;
  transcriptEnabled?: boolean;
  transcriptBcc?: string | null;
  transcriptFrom?: string | null;
}

export interface VisitorContext {
  site: LivechatSiteRow;
  visitorPk: string;
  isNew: boolean;
}

export interface SessionContext {
  sessionId: string;
  isNew: boolean;
}

@Injectable()
export class LivechatService {
  private readonly logger = new Logger(LivechatService.name);

  constructor(
    private db: DbService,
    private enrichment: EnrichmentService,
    private originCache: LivechatOriginCache,
    private contactsSvc: ContactsService,
  ) {}

  /**
   * Upsert a Contact for a live-chat visitor and link the session row.
   * Identity rule: sourceRef is `${siteKey}:${visitorId}` (stable for the
   * visitor's localStorage UUID). Email/displayName are patched in when learned.
   */
  async upsertContactForLivechat(input: {
    siteKey: string;
    visitorId: string;
    websiteTag?: string | null;
    email?: string | null;
    displayName?: string | null;
  }): Promise<string> {
    const contact = await this.contactsSvc.upsertBySource({
      source: 'livechat',
      sourceRef: `${input.siteKey}:${input.visitorId}`,
      websiteTag: input.websiteTag ?? input.siteKey,
      email: input.email ?? null,
      displayName: input.displayName ?? null,
    });
    return contact.id;
  }

  async listSites(): Promise<LivechatSiteRow[]> {
    const rows = await this.db.db.select().from(livechatSites).orderBy(livechatSites.createdAt);
    return rows.map((r) => this.toSiteRow(r));
  }

  async getSiteById(id: string): Promise<LivechatSiteRow> {
    const [row] = await this.db.db.select().from(livechatSites).where(eq(livechatSites.id, id));
    if (!row) throw new NotFoundException(`Live chat site not found: ${id}`);
    return this.toSiteRow(row);
  }

  async getSiteByKey(key: string): Promise<LivechatSiteRow | null> {
    const [row] = await this.db.db.select().from(livechatSites).where(eq(livechatSites.key, key));
    return row ? this.toSiteRow(row) : null;
  }

  async getSiteByOrigin(origin: string): Promise<LivechatSiteRow | null> {
    const normalized = this.normalizeOrigin(origin);
    if (!normalized) return null;
    const [row] = await this.db.db.select().from(livechatSites).where(eq(livechatSites.origin, normalized));
    return row ? this.toSiteRow(row) : null;
  }

  /** Validate that the request's Origin header matches the site row, then return the site. */
  async resolveSiteForRequest(siteKey: string, requestOrigin: string | null | undefined): Promise<LivechatSiteRow> {
    const site = await this.getSiteByKey(siteKey);
    if (!site) throw new NotFoundException(`Unknown site: ${siteKey}`);
    if (!site.enabled) throw new ForbiddenException(`Site disabled: ${siteKey}`);
    const normalized = this.normalizeOrigin(requestOrigin ?? null);
    if (!normalized || normalized !== site.origin) {
      throw new ForbiddenException(`Origin not allowed for site ${siteKey}`);
    }
    return site;
  }

  /** Upsert a visitor row, refreshing enrichment fields and lastSeenAt. */
  async upsertVisitor(input: {
    siteId: string;
    visitorId: string;
    enrichment: EnrichedVisitor;
  }): Promise<VisitorContext['visitorPk']> {
    const enriched = input.enrichment;
    const [existing] = await this.db.db
      .select({ id: livechatVisitors.id })
      .from(livechatVisitors)
      .where(and(eq(livechatVisitors.siteId, input.siteId), eq(livechatVisitors.visitorId, input.visitorId)))
      .limit(1);

    if (existing) {
      await this.db.db
        .update(livechatVisitors)
        .set({
          lastSeenAt: new Date(),
          ip: enriched.ip,
          ipCountry: enriched.country,
          ipCountryName: enriched.countryName,
          ipRegion: enriched.region,
          ipCity: enriched.city,
          ipLat: enriched.lat,
          ipLon: enriched.lon,
          ipTimezone: enriched.timezone,
          uaRaw: enriched.uaRaw,
          browserName: enriched.browserName,
          browserVersion: enriched.browserVersion,
          osName: enriched.osName,
          osVersion: enriched.osVersion,
          deviceType: enriched.deviceType,
          deviceBrand: enriched.deviceBrand,
          deviceModel: enriched.deviceModel,
          language: enriched.language,
        })
        .where(eq(livechatVisitors.id, existing.id));
      return existing.id;
    }

    const [row] = await this.db.db
      .insert(livechatVisitors)
      .values({
        siteId: input.siteId,
        visitorId: input.visitorId,
        ip: enriched.ip,
        ipCountry: enriched.country,
        ipCountryName: enriched.countryName,
        ipRegion: enriched.region,
        ipCity: enriched.city,
        ipLat: enriched.lat,
        ipLon: enriched.lon,
        ipTimezone: enriched.timezone,
        uaRaw: enriched.uaRaw,
        browserName: enriched.browserName,
        browserVersion: enriched.browserVersion,
        osName: enriched.osName,
        osVersion: enriched.osVersion,
        deviceType: enriched.deviceType,
        deviceBrand: enriched.deviceBrand,
        deviceModel: enriched.deviceModel,
        language: enriched.language,
      })
      .returning({ id: livechatVisitors.id });
    return row.id;
  }

  /** Insert a pageview row + bump visitor.totalPageviews + update session.currentPage if a session exists. */
  async recordPageview(input: {
    siteId: string;
    visitorPk: string;
    visitorId: string;
    sessionId: string | null;
    url: string;
    path: string | null;
    title: string | null;
    referrer: string | null;
  }): Promise<{ pageviewId: string }> {
    const [{ count }] = await this.db.db
      .select({ count: sql<number>`count(*)::int` })
      .from(livechatPageviews)
      .where(eq(livechatPageviews.visitorPk, input.visitorPk));

    const [pv] = await this.db.db
      .insert(livechatPageviews)
      .values({
        visitorPk: input.visitorPk,
        sessionId: input.sessionId,
        url: input.url,
        path: input.path,
        title: input.title,
        referrer: input.referrer,
        seq: (count ?? 0) + 1,
      })
      .returning({ id: livechatPageviews.id });

    await this.db.db
      .update(livechatVisitors)
      .set({ totalPageviews: sql`${livechatVisitors.totalPageviews} + 1`, lastSeenAt: new Date() })
      .where(eq(livechatVisitors.id, input.visitorPk));

    if (input.sessionId) {
      await this.db.db
        .update(livechatSessions)
        .set({ currentPageUrl: input.url, currentPageTitle: input.title, lastSeenAt: new Date() })
        .where(eq(livechatSessions.id, input.sessionId));
    }

    return { pageviewId: pv.id };
  }

  async recordPageviewLeave(pageviewId: string): Promise<void> {
    const [pv] = await this.db.db
      .select({ arrivedAt: livechatPageviews.arrivedAt, leftAt: livechatPageviews.leftAt })
      .from(livechatPageviews)
      .where(eq(livechatPageviews.id, pageviewId))
      .limit(1);
    if (!pv || pv.leftAt) return;
    const now = new Date();
    const durationMs = Math.max(0, now.getTime() - pv.arrivedAt.getTime());
    await this.db.db
      .update(livechatPageviews)
      .set({ leftAt: now, durationMs })
      .where(eq(livechatPageviews.id, pageviewId));
  }

  /** Get-or-create the open session for a visitor; on creation, bump visitor.totalSessions and upsert a Contact. */
  async getOrCreateSession(input: {
    siteId: string;
    siteKey: string;
    visitorPk: string;
    visitorId: string;
  }): Promise<SessionContext> {
    const [existing] = await this.db.db
      .select({ id: livechatSessions.id })
      .from(livechatSessions)
      .where(and(eq(livechatSessions.siteId, input.siteId), eq(livechatSessions.visitorId, input.visitorId)))
      .limit(1);
    if (existing) return { sessionId: existing.id, isNew: false };

    const contactId = await this.upsertContactForLivechat({
      siteKey: input.siteKey,
      visitorId: input.visitorId,
    });

    const [row] = await this.db.db
      .insert(livechatSessions)
      .values({
        siteId: input.siteId,
        visitorPk: input.visitorPk,
        visitorId: input.visitorId,
        contactId,
        status: 'open',
      })
      .returning({ id: livechatSessions.id });

    await this.db.db
      .update(livechatVisitors)
      .set({ totalSessions: sql`${livechatVisitors.totalSessions} + 1` })
      .where(eq(livechatVisitors.id, input.visitorPk));

    return { sessionId: row.id, isNew: true };
  }

  async setVisitorIdentity(input: {
    siteId: string;
    siteKey: string;
    visitorId: string;
    email?: string | null;
    name?: string | null;
  }): Promise<void> {
    const set: Record<string, unknown> = { lastSeenAt: new Date() };
    if (input.email !== undefined) set.visitorEmail = input.email;
    if (input.name !== undefined) set.visitorName = input.name;
    if (Object.keys(set).length <= 1) return;
    await this.db.db
      .update(livechatSessions)
      .set(set)
      .where(and(eq(livechatSessions.siteId, input.siteId), eq(livechatSessions.visitorId, input.visitorId)));

    if (input.email || input.name) {
      const contactId = await this.upsertContactForLivechat({
        siteKey: input.siteKey,
        visitorId: input.visitorId,
        email: input.email ?? null,
        displayName: input.name ?? null,
      });
      await this.db.db
        .update(livechatSessions)
        .set({ contactId })
        .where(and(eq(livechatSessions.siteId, input.siteId), eq(livechatSessions.visitorId, input.visitorId)));
    }
  }

  async appendMessage(input: {
    sessionId: string;
    role: 'visitor' | 'agent' | 'operator' | 'system';
    content: string;
    pendingApproval?: boolean;
  }): Promise<{ id: string; createdAt: Date; pendingApproval: boolean; duplicate?: boolean }> {
    // Dedupe identical visitor messages within a 5-second window.
    // Catches double-clicks, network retries, and the same content arriving
    // via two paths (REST + email-to-thread) at near-the-same time.
    if (input.role === 'visitor') {
      const fiveSecondsAgo = new Date(Date.now() - 5_000);
      const [recent] = await this.db.db
        .select({
          id: livechatMessages.id,
          createdAt: livechatMessages.createdAt,
          pendingApproval: livechatMessages.pendingApproval,
        })
        .from(livechatMessages)
        .where(
          and(
            eq(livechatMessages.sessionId, input.sessionId),
            eq(livechatMessages.role, 'visitor'),
            eq(livechatMessages.content, input.content),
            gte(livechatMessages.createdAt, fiveSecondsAgo),
          ),
        )
        .orderBy(desc(livechatMessages.createdAt))
        .limit(1);
      if (recent) {
        return { id: recent.id, createdAt: recent.createdAt, pendingApproval: recent.pendingApproval, duplicate: true };
      }
    }

    const [row] = await this.db.db
      .insert(livechatMessages)
      .values({
        sessionId: input.sessionId,
        role: input.role,
        content: input.content,
        pendingApproval: input.pendingApproval ?? false,
      })
      .returning({ id: livechatMessages.id, createdAt: livechatMessages.createdAt, pendingApproval: livechatMessages.pendingApproval });

    const [session] = await this.db.db
      .select({ visitorPk: livechatSessions.visitorPk, contactId: livechatSessions.contactId })
      .from(livechatSessions)
      .where(eq(livechatSessions.id, input.sessionId))
      .limit(1);

    if (session) {
      await this.db.db
        .update(livechatSessions)
        .set({ lastSeenAt: new Date() })
        .where(eq(livechatSessions.id, input.sessionId));
      await this.db.db
        .update(livechatVisitors)
        .set({ totalMessages: sql`${livechatVisitors.totalMessages} + 1`, lastSeenAt: new Date() })
        .where(eq(livechatVisitors.id, session.visitorPk));

      if (session.contactId && input.role === 'visitor') {
        await this.contactsSvc
          .addActivity(session.contactId, 'livechat_message', input.content.slice(0, 300), {
            refId: input.sessionId,
          })
          .catch((err) => this.logger.debug(`addActivity failed: ${(err as Error).message}`));
      }
    }
    return row;
  }

  async getRecentMessages(sessionId: string, limit = 50) {
    // Exclude pending drafts — agent context should reflect what the visitor actually saw.
    return this.db.db
      .select()
      .from(livechatMessages)
      .where(and(eq(livechatMessages.sessionId, sessionId), eq(livechatMessages.pendingApproval, false)))
      .orderBy(desc(livechatMessages.createdAt))
      .limit(limit);
  }

  async getMessagesForSession(sessionId: string) {
    return this.db.db
      .select()
      .from(livechatMessages)
      .where(eq(livechatMessages.sessionId, sessionId))
      .orderBy(livechatMessages.createdAt);
  }

  async getSession(sessionId: string) {
    const [row] = await this.db.db
      .select()
      .from(livechatSessions)
      .where(eq(livechatSessions.id, sessionId))
      .limit(1);
    return row ?? null;
  }

  async getVisitor(visitorPk: string) {
    const [row] = await this.db.db
      .select()
      .from(livechatVisitors)
      .where(eq(livechatVisitors.id, visitorPk))
      .limit(1);
    return row ?? null;
  }

  async getRecentPageviews(visitorPk: string, limit = 5) {
    return this.db.db
      .select()
      .from(livechatPageviews)
      .where(eq(livechatPageviews.visitorPk, visitorPk))
      .orderBy(desc(livechatPageviews.arrivedAt))
      .limit(limit);
  }

  /** Quick counters for the inbox header badge. */
  async pendingCounts(): Promise<{ sessions: number; drafts: number }> {
    const [drafts] = await this.db.db
      .select({ count: sql<number>`count(*)::int` })
      .from(livechatMessages)
      .where(eq(livechatMessages.pendingApproval, true));
    const [sessions] = await this.db.db
      .select({ count: sql<number>`count(distinct ${livechatMessages.sessionId})::int` })
      .from(livechatMessages)
      .where(eq(livechatMessages.pendingApproval, true));
    return { sessions: sessions?.count ?? 0, drafts: drafts?.count ?? 0 };
  }

  async getMessageById(id: string) {
    const [row] = await this.db.db.select().from(livechatMessages).where(eq(livechatMessages.id, id)).limit(1);
    return row ?? null;
  }

  async approveMessage(id: string): Promise<void> {
    await this.db.db
      .update(livechatMessages)
      .set({ pendingApproval: false })
      .where(eq(livechatMessages.id, id));
  }

  async deleteMessage(id: string): Promise<void> {
    await this.db.db.delete(livechatMessages).where(eq(livechatMessages.id, id));
  }

  async updateMessageContent(id: string, content: string): Promise<void> {
    await this.db.db.update(livechatMessages).set({ content }).where(eq(livechatMessages.id, id));
  }

  async setSessionStatus(sessionId: string, status: 'open' | 'human_taken_over' | 'needs_human' | 'closed'): Promise<void> {
    await this.db.db
      .update(livechatSessions)
      .set({ status, lastSeenAt: new Date() })
      .where(eq(livechatSessions.id, sessionId));
  }

  async listSessions(opts: { status?: string; siteKey?: string; hasPendingDrafts?: boolean; limit?: number; before?: string } = {}) {
    const limit = Math.min(opts.limit ?? 50, 200);
    const where: ReturnType<typeof eq>[] = [];
    if (opts.status) where.push(eq(livechatSessions.status, opts.status));

    let siteId: string | null = null;
    if (opts.siteKey) {
      const site = await this.getSiteByKey(opts.siteKey);
      if (!site) return [];
      siteId = site.id;
      where.push(eq(livechatSessions.siteId, siteId));
    }

    if (opts.hasPendingDrafts) {
      // Restrict to sessions with at least one pending draft. Subselect avoids
      // a DISTINCT ON over the join.
      const pendingSessionIds = await this.db.db
        .selectDistinct({ sessionId: livechatMessages.sessionId })
        .from(livechatMessages)
        .where(eq(livechatMessages.pendingApproval, true));
      const ids = pendingSessionIds.map((r) => r.sessionId);
      if (!ids.length) return [];
      where.push(inArray(livechatSessions.id, ids));
    }

    const rows = await this.db.db
      .select({
        id: livechatSessions.id,
        siteId: livechatSessions.siteId,
        visitorPk: livechatSessions.visitorPk,
        visitorId: livechatSessions.visitorId,
        contactId: livechatSessions.contactId,
        visitorEmail: livechatSessions.visitorEmail,
        visitorName: livechatSessions.visitorName,
        status: livechatSessions.status,
        currentPageUrl: livechatSessions.currentPageUrl,
        currentPageTitle: livechatSessions.currentPageTitle,
        lastSeenAt: livechatSessions.lastSeenAt,
        createdAt: livechatSessions.createdAt,
        ipCountry: livechatVisitors.ipCountry,
        ipCity: livechatVisitors.ipCity,
        browserName: livechatVisitors.browserName,
        osName: livechatVisitors.osName,
      })
      .from(livechatSessions)
      .leftJoin(livechatVisitors, eq(livechatVisitors.id, livechatSessions.visitorPk))
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(livechatSessions.lastSeenAt))
      .limit(limit);

    const sessionIds = rows.map((r) => r.id);
    const allMessages = sessionIds.length
      ? await this.db.db
          .select({
            sessionId: livechatMessages.sessionId,
            role: livechatMessages.role,
            content: livechatMessages.content,
            createdAt: livechatMessages.createdAt,
            pendingApproval: livechatMessages.pendingApproval,
          })
          .from(livechatMessages)
          .where(inArray(livechatMessages.sessionId, sessionIds))
          .orderBy(desc(livechatMessages.createdAt))
      : [];

    const previewBySession = new Map<string, { role: string; content: string; createdAt: Date }>();
    const pendingCountBySession = new Map<string, number>();
    for (const p of allMessages) {
      // Last message preview ignores pending drafts (visitor never saw them).
      if (!previewBySession.has(p.sessionId) && !p.pendingApproval) {
        previewBySession.set(p.sessionId, { role: p.role, content: p.content.slice(0, 140), createdAt: p.createdAt });
      }
      if (p.pendingApproval) {
        pendingCountBySession.set(p.sessionId, (pendingCountBySession.get(p.sessionId) ?? 0) + 1);
      }
    }

    return rows.map((r) => ({
      ...r,
      lastMessage: previewBySession.get(r.id) ?? null,
      pendingDrafts: pendingCountBySession.get(r.id) ?? 0,
    }));
  }

  async getSessionDetail(sessionId: string) {
    const [session] = await this.db.db
      .select()
      .from(livechatSessions)
      .where(eq(livechatSessions.id, sessionId))
      .limit(1);
    if (!session) return null;

    const [visitor] = await this.db.db
      .select()
      .from(livechatVisitors)
      .where(eq(livechatVisitors.id, session.visitorPk))
      .limit(1);

    const messages = await this.getMessagesForSession(sessionId);

    return { session, visitor: visitor ?? null, messages };
  }

  /** Bump the visitor's last_seen_at without inserting a pageview row. */
  async heartbeatVisitor(input: { siteId: string; visitorId: string; currentUrl?: string | null; currentTitle?: string | null }): Promise<void> {
    await this.db.db
      .update(livechatVisitors)
      .set({ lastSeenAt: new Date() })
      .where(and(eq(livechatVisitors.siteId, input.siteId), eq(livechatVisitors.visitorId, input.visitorId)));
    if (input.currentUrl) {
      await this.db.db
        .update(livechatSessions)
        .set({ currentPageUrl: input.currentUrl, currentPageTitle: input.currentTitle ?? null, lastSeenAt: new Date() })
        .where(and(eq(livechatSessions.siteId, input.siteId), eq(livechatSessions.visitorId, input.visitorId)));
    }
  }

  /** All visitors seen in the last `windowSec` seconds, joined with their open session if any. */
  async listLiveVisitors(windowSec = 60) {
    const cutoff = new Date(Date.now() - windowSec * 1000);
    const rows = await this.db.db
      .select({
        visitorPk: livechatVisitors.id,
        visitorId: livechatVisitors.visitorId,
        siteId: livechatVisitors.siteId,
        siteKey: livechatSites.key,
        siteLabel: livechatSites.label,
        ipCountry: livechatVisitors.ipCountry,
        ipCity: livechatVisitors.ipCity,
        browserName: livechatVisitors.browserName,
        osName: livechatVisitors.osName,
        deviceType: livechatVisitors.deviceType,
        lastSeenAt: livechatVisitors.lastSeenAt,
        sessionId: livechatSessions.id,
        sessionStatus: livechatSessions.status,
        currentPageUrl: livechatSessions.currentPageUrl,
        currentPageTitle: livechatSessions.currentPageTitle,
        visitorEmail: livechatSessions.visitorEmail,
        visitorName: livechatSessions.visitorName,
      })
      .from(livechatVisitors)
      .leftJoin(
        livechatSessions,
        and(eq(livechatSessions.siteId, livechatVisitors.siteId), eq(livechatSessions.visitorId, livechatVisitors.visitorId)),
      )
      .leftJoin(livechatSites, eq(livechatSites.id, livechatVisitors.siteId))
      .where(gte(livechatVisitors.lastSeenAt, cutoff))
      .orderBy(desc(livechatVisitors.lastSeenAt))
      .limit(200);

    // Drop bot rows; UI never shows them.
    return rows.filter((r) => r.deviceType !== 'bot');
  }

  /** All past sessions for a visitor across time, with last-message preview + counts. */
  async getVisitorSessions(visitorPk: string, limit = 20) {
    const rows = await this.db.db
      .select({
        id: livechatSessions.id,
        siteId: livechatSessions.siteId,
        siteKey: livechatSites.key,
        siteLabel: livechatSites.label,
        status: livechatSessions.status,
        visitorEmail: livechatSessions.visitorEmail,
        visitorName: livechatSessions.visitorName,
        currentPageUrl: livechatSessions.currentPageUrl,
        currentPageTitle: livechatSessions.currentPageTitle,
        lastSeenAt: livechatSessions.lastSeenAt,
        createdAt: livechatSessions.createdAt,
      })
      .from(livechatSessions)
      .leftJoin(livechatSites, eq(livechatSites.id, livechatSessions.siteId))
      .where(eq(livechatSessions.visitorPk, visitorPk))
      .orderBy(desc(livechatSessions.lastSeenAt))
      .limit(limit);

    const sessionIds = rows.map((r) => r.id);
    const counts = sessionIds.length
      ? await this.db.db
          .select({
            sessionId: livechatMessages.sessionId,
            count: sql<number>`count(*)::int`,
          })
          .from(livechatMessages)
          .where(and(inArray(livechatMessages.sessionId, sessionIds), eq(livechatMessages.pendingApproval, false)))
          .groupBy(livechatMessages.sessionId)
      : [];
    const countBySession = new Map(counts.map((c) => [c.sessionId, c.count]));

    return rows.map((r) => ({ ...r, messageCount: countBySession.get(r.id) ?? 0 }));
  }

  async getVisitorPageviews(visitorPk: string, opts: { limit?: number; before?: string } = {}) {
    const limit = Math.min(opts.limit ?? 50, 500);
    return this.db.db
      .select()
      .from(livechatPageviews)
      .where(eq(livechatPageviews.visitorPk, visitorPk))
      .orderBy(desc(livechatPageviews.arrivedAt))
      .limit(limit);
  }

  async createSite(dto: CreateSiteDto): Promise<LivechatSiteRow> {
    const key = dto.key?.trim().toLowerCase();
    const origin = this.normalizeOrigin(dto.origin);
    if (!key || !/^[a-z0-9_-]+$/.test(key)) {
      throw new BadRequestException('key must be lowercase alphanumeric with optional - or _');
    }
    if (!origin) throw new BadRequestException('origin must be a valid URL like https://example.com');
    if (!dto.label?.trim()) throw new BadRequestException('label is required');

    const existing = await this.getSiteByKey(key);
    if (existing) throw new BadRequestException(`Site key already exists: ${key}`);

    const [row] = await this.db.db
      .insert(livechatSites)
      .values({
        key,
        label: dto.label.trim(),
        origin,
        productContext: dto.productContext?.toString().trim() || null,
        replyTone: dto.replyTone?.toString().trim() || null,
        trackBots: dto.trackBots ?? false,
        autoApprove: dto.autoApprove ?? false,
        botName: dto.botName?.trim() || null,
        botSubtitle: dto.botSubtitle?.trim() || null,
        welcomeMessage: dto.welcomeMessage?.trim() || null,
        brandColor: this.normalizeColor(dto.brandColor),
        position: this.normalizePosition(dto.position),
        llmProvider: dto.llmProvider?.trim() || null,
        llmModel: dto.llmModel?.trim() || null,
        transcriptEnabled: dto.transcriptEnabled ?? false,
        transcriptBcc: dto.transcriptBcc?.trim() || null,
        transcriptFrom: dto.transcriptFrom?.trim() || null,
      })
      .returning();
    await this.originCache.refresh().catch(() => undefined);
    return this.toSiteRow(row);
  }

  async updateSite(id: string, dto: UpdateSiteDto): Promise<LivechatSiteRow> {
    const [existing] = await this.db.db.select().from(livechatSites).where(eq(livechatSites.id, id));
    if (!existing) throw new NotFoundException(`Live chat site not found: ${id}`);

    const set: Record<string, unknown> = {};
    if (dto.label !== undefined) {
      if (!dto.label.trim()) throw new BadRequestException('label cannot be empty');
      set.label = dto.label.trim();
    }
    if (dto.origin !== undefined) {
      const normalized = this.normalizeOrigin(dto.origin);
      if (!normalized) throw new BadRequestException('origin must be a valid URL');
      set.origin = normalized;
    }
    if (dto.enabled !== undefined) set.enabled = dto.enabled;
    if (dto.productContext !== undefined) set.productContext = dto.productContext?.toString().trim() || null;
    if (dto.replyTone !== undefined) set.replyTone = dto.replyTone?.toString().trim() || null;
    if (dto.trackBots !== undefined) set.trackBots = dto.trackBots;
    if (dto.autoApprove !== undefined) set.autoApprove = dto.autoApprove;
    if (dto.botName !== undefined) set.botName = dto.botName?.trim() || null;
    if (dto.botSubtitle !== undefined) set.botSubtitle = dto.botSubtitle?.trim() || null;
    if (dto.welcomeMessage !== undefined) set.welcomeMessage = dto.welcomeMessage?.trim() || null;
    if (dto.brandColor !== undefined) set.brandColor = this.normalizeColor(dto.brandColor);
    if (dto.position !== undefined) set.position = this.normalizePosition(dto.position);
    if (dto.llmProvider !== undefined) set.llmProvider = dto.llmProvider?.trim() || null;
    if (dto.llmModel !== undefined) set.llmModel = dto.llmModel?.trim() || null;
    if (dto.transcriptEnabled !== undefined) set.transcriptEnabled = dto.transcriptEnabled;
    if (dto.transcriptBcc !== undefined) set.transcriptBcc = dto.transcriptBcc?.trim() || null;
    if (dto.transcriptFrom !== undefined) set.transcriptFrom = dto.transcriptFrom?.trim() || null;

    if (Object.keys(set).length === 0) return this.toSiteRow(existing);

    const [row] = await this.db.db.update(livechatSites).set(set).where(eq(livechatSites.id, id)).returning();
    await this.originCache.refresh().catch(() => undefined);
    return this.toSiteRow(row);
  }

  async deleteSite(id: string): Promise<void> {
    const [existing] = await this.db.db.select().from(livechatSites).where(eq(livechatSites.id, id));
    if (!existing) throw new NotFoundException(`Live chat site not found: ${id}`);
    await this.db.db.delete(livechatSites).where(eq(livechatSites.id, id));
    await this.originCache.refresh().catch(() => undefined);
  }

  private normalizeOrigin(origin: string | undefined | null): string | null {
    if (!origin) return null;
    try {
      const u = new URL(origin.trim());
      if (!u.protocol.startsWith('http')) return null;
      return `${u.protocol}//${u.host}`;
    } catch {
      return null;
    }
  }

  private normalizeColor(c: string | null | undefined): string | null {
    if (!c) return null;
    const trimmed = c.trim();
    if (!trimmed) return null;
    if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) return null;
    return trimmed.toLowerCase();
  }

  private normalizePosition(p: string | null | undefined): WidgetPosition {
    return p === 'bottom-left' ? 'bottom-left' : 'bottom-right';
  }

  private toSiteRow(r: typeof livechatSites.$inferSelect): LivechatSiteRow {
    return {
      id: r.id,
      key: r.key,
      label: r.label,
      origin: r.origin,
      enabled: r.enabled,
      productContext: r.productContext,
      replyTone: r.replyTone,
      trackBots: r.trackBots,
      autoApprove: r.autoApprove,
      botName: r.botName,
      botSubtitle: r.botSubtitle,
      welcomeMessage: r.welcomeMessage,
      brandColor: r.brandColor,
      position: (r.position === 'bottom-left' ? 'bottom-left' : 'bottom-right') as WidgetPosition,
      llmProvider: r.llmProvider,
      llmModel: r.llmModel,
      transcriptEnabled: r.transcriptEnabled,
      transcriptBcc: r.transcriptBcc,
      transcriptFrom: r.transcriptFrom,
      createdAt: r.createdAt,
    };
  }
}
