import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, desc, eq, isNotNull, isNull, lte, or, sql } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { SettingsService } from '../../settings/settings.service';
import { ContactsService } from '../../contacts/contacts.service';
import { encrypt, decrypt, maskSecret } from '../../../common/crypto/crypto.util';
import { crispWebsites, crispConversations } from './schema';

export interface CrispMessage {
  sessionId: string;
  websiteId: string;
  visitorEmail?: string;
  visitorNickname?: string;
  content: string;
  timestamp: number;
}

export interface CrispWebsiteRow {
  id: string;
  label: string;
  websiteId: string;
  identifier: string;
  apiKeyMasked: string;
  enabled: boolean;
  productContext: string | null;
  replyTone: string | null;
  createdAt: Date;
}

export interface CrispWebsiteOverrides {
  productContext?: string;
  replyTone?: string;
}

interface CrispCredentials {
  websiteId: string;
  identifier: string;
  key: string;
}

@Injectable()
export class CrispService {
  private readonly logger = new Logger(CrispService.name);

  constructor(
    private db: DbService,
    private settings: SettingsService,
    private contactsSvc: ContactsService,
  ) {}

  // ── Website CRUD ──────────────────────────────────────────────────────────

  async listWebsites(): Promise<CrispWebsiteRow[]> {
    const rows = await this.db.db
      .select()
      .from(crispWebsites)
      .orderBy(crispWebsites.createdAt);
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      websiteId: r.websiteId,
      identifier: r.identifier,
      apiKeyMasked: maskSecret(decrypt(r.apiKey)),
      enabled: r.enabled,
      productContext: r.productContext ?? null,
      replyTone: r.replyTone ?? null,
      createdAt: r.createdAt,
    }));
  }

  async addWebsite(dto: {
    label: string;
    websiteId: string;
    identifier: string;
    apiKey: string;
    productContext?: string;
    replyTone?: string;
  }) {
    const [row] = await this.db.db
      .insert(crispWebsites)
      .values({
        label: dto.label,
        websiteId: dto.websiteId,
        identifier: dto.identifier,
        apiKey: encrypt(dto.apiKey),
        productContext: dto.productContext?.trim() || null,
        replyTone: dto.replyTone?.trim() || null,
      })
      .returning({ id: crispWebsites.id, label: crispWebsites.label, websiteId: crispWebsites.websiteId });
    return row;
  }

  async updateWebsite(
    id: string,
    dto: {
      label?: string;
      websiteId?: string;
      identifier?: string;
      apiKey?: string;
      enabled?: boolean;
      productContext?: string | null;
      replyTone?: string | null;
    },
  ) {
    const [existing] = await this.db.db.select().from(crispWebsites).where(eq(crispWebsites.id, id));
    if (!existing) throw new NotFoundException(`Crisp website not found: ${id}`);
    const set: Record<string, unknown> = {};
    if (dto.label !== undefined) set.label = dto.label;
    if (dto.websiteId !== undefined) set.websiteId = dto.websiteId;
    if (dto.identifier !== undefined) set.identifier = dto.identifier;
    if (dto.apiKey !== undefined && dto.apiKey.length > 0) set.apiKey = encrypt(dto.apiKey);
    if (dto.enabled !== undefined) set.enabled = dto.enabled;
    if (dto.productContext !== undefined) set.productContext = dto.productContext?.trim() || null;
    if (dto.replyTone !== undefined) set.replyTone = dto.replyTone?.trim() || null;
    if (Object.keys(set).length === 0) return;
    await this.db.db.update(crispWebsites).set(set).where(eq(crispWebsites.id, id));
  }

  async getOverridesForWebsite(websiteId: string): Promise<CrispWebsiteOverrides> {
    const [row] = await this.db.db
      .select({ productContext: crispWebsites.productContext, replyTone: crispWebsites.replyTone })
      .from(crispWebsites)
      .where(eq(crispWebsites.websiteId, websiteId));
    return {
      productContext: row?.productContext ?? undefined,
      replyTone: row?.replyTone ?? undefined,
    };
  }

  async deleteWebsite(id: string) {
    await this.db.db.delete(crispWebsites).where(eq(crispWebsites.id, id));
  }

  async testWebsite(id: string): Promise<{ ok: boolean; message: string }> {
    const creds = await this.getCredentialsById(id);
    if (!creds) return { ok: false, message: 'Website not found' };
    return this.callTest(creds);
  }

  // ── Credentials helpers ───────────────────────────────────────────────────

  async getEnabledWebsites(): Promise<CrispCredentials[]> {
    const rows = await this.db.db
      .select()
      .from(crispWebsites)
      .where(eq(crispWebsites.enabled, true));

    if (rows.length) {
      return rows.map((r) => ({ websiteId: r.websiteId, identifier: r.identifier, key: decrypt(r.apiKey) }));
    }

    // Fall back to platform settings (single-site legacy)
    const legacy = await this.getLegacyCredentials();
    return legacy ? [legacy] : [];
  }

  async getCredentialsForWebsite(websiteId: string): Promise<CrispCredentials | null> {
    const [row] = await this.db.db
      .select()
      .from(crispWebsites)
      .where(eq(crispWebsites.websiteId, websiteId));

    if (row) return { websiteId: row.websiteId, identifier: row.identifier, key: decrypt(row.apiKey) };

    // Fall back to platform settings
    const legacy = await this.getLegacyCredentials();
    if (legacy && legacy.websiteId === websiteId) return legacy;
    return null;
  }

  async isConfigured(): Promise<boolean> {
    const sites = await this.getEnabledWebsites();
    return sites.length > 0;
  }

  // ── Crisp API ─────────────────────────────────────────────────────────────

  async getOpenConversations(limitPerSite = 20): Promise<CrispMessage[]> {
    const sites = await this.getEnabledWebsites();
    const results: CrispMessage[] = [];

    await Promise.all(
      sites.map(async (creds) => {
        try {
          const msgs = await this.fetchOpenConversations(creds, limitPerSite);
          results.push(...msgs);
        } catch (err) {
          this.logger.warn(`Failed to fetch conversations for site ${creds.websiteId}: ${err}`);
        }
      }),
    );

    return results;
  }

  async getSessionThread(sessionId: string, websiteId: string, limit = 5): Promise<{ role: 'customer' | 'agent'; text: string }[]> {
    try {
      const creds = await this.getCredentialsForWebsite(websiteId);
      if (!creds) return [];
      const res = await fetch(
        `https://api.crisp.chat/v1/website/${websiteId}/conversation/${sessionId}/messages/1`,
        { headers: { Authorization: this.authHeader(creds.identifier, creds.key), 'X-Crisp-Tier': 'plugin' } },
      );
      if (!res.ok) return [];
      const data = await res.json();
      const msgs: { role: 'customer' | 'agent'; text: string }[] = [];
      for (const m of (data.data ?? []).slice(-limit)) {
        if (m.type !== 'text' || !m.content) continue;
        msgs.push({ role: m.from === 'user' ? 'customer' : 'agent', text: String(m.content).slice(0, 300) });
      }
      return msgs;
    } catch {
      return [];
    }
  }

  async sendReply(sessionId: string, websiteId: string, message: string): Promise<void> {
    const creds = await this.getCredentialsForWebsite(websiteId);
    if (!creds) throw new Error(`No credentials for Crisp website: ${websiteId}`);

    const res = await fetch(
      `https://api.crisp.chat/v1/website/${websiteId}/conversation/${sessionId}/message`,
      {
        method: 'POST',
        headers: {
          Authorization: this.authHeader(creds.identifier, creds.key),
          'X-Crisp-Tier': 'plugin',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'text', from: 'operator', origin: 'chat', content: message }),
      },
    );

    if (!res.ok) throw new Error(`Crisp send reply failed: ${res.status} ${await res.text()}`);
  }

  parseWebhookMessage(body: any): CrispMessage | null {
    return this.parseWebhookMessageDetailed(body).message;
  }

  parseWebhookMessageDetailed(body: any): { message: CrispMessage | null; reason?: string } {
    try {
      const event = body?.event;
      // Crisp inbound visitor messages: typically `message:send` (visitor → us).
      // `message:received` exists in some plans. `message:updated` covers edits.
      if (event !== 'message:received' && event !== 'message:send' && event !== 'message:updated') {
        return { message: null, reason: `event=${event ?? 'missing'} (not a message event)` };
      }
      // Inbound: from the visitor. Outbound (operator/our own replies) would loop back.
      const from = body.data?.from;
      if (from !== 'user') {
        return { message: null, reason: `from=${from ?? 'missing'} (only "user" inbound is replied to)` };
      }
      const type = body.data?.type;
      if (type && type !== 'text') {
        return { message: null, reason: `type=${type} (only text is supported)` };
      }
      const sessionId = body.data?.session_id;
      const websiteId = body.website_id;
      if (!sessionId || !websiteId) {
        return { message: null, reason: `missing session_id or website_id` };
      }
      return {
        message: {
          sessionId,
          websiteId,
          visitorEmail: body.data.user?.email ?? undefined,
          visitorNickname: body.data.user?.nickname ?? undefined,
          content: typeof body.data.content === 'string' ? body.data.content : JSON.stringify(body.data.content ?? ''),
          timestamp: body.data.timestamp,
        },
      };
    } catch (err) {
      return { message: null, reason: `parse threw: ${(err as Error).message}` };
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private authHeader(identifier: string, key: string): string {
    return `Basic ${Buffer.from(`${identifier}:${key}`).toString('base64')}`;
  }

  private async fetchOpenConversations(creds: CrispCredentials, limit: number): Promise<CrispMessage[]> {
    const res = await fetch(
      `https://api.crisp.chat/v1/website/${creds.websiteId}/conversations/1?filter_unread=1`,
      { headers: { Authorization: this.authHeader(creds.identifier, creds.key), 'X-Crisp-Tier': 'plugin' } },
    );

    if (!res.ok) {
      this.logger.warn(`Crisp API error for ${creds.websiteId}: ${res.status} ${await res.text()}`);
      return [];
    }

    const data = await res.json();
    const conversations: CrispMessage[] = [];

    for (const conv of (data.data ?? []).slice(0, limit)) {
      const lastMsg = conv.last_message;
      if (!lastMsg?.content) continue;
      conversations.push({
        sessionId: conv.session_id,
        websiteId: creds.websiteId,
        visitorEmail: conv.meta?.email ?? undefined,
        visitorNickname: conv.meta?.nickname ?? undefined,
        content: typeof lastMsg.content === 'string' ? lastMsg.content : JSON.stringify(lastMsg.content),
        timestamp: lastMsg.timestamp,
      });
    }

    return conversations;
  }

  private async getLegacyCredentials(): Promise<CrispCredentials | null> {
    const [identifier, key, websiteId] = await Promise.all([
      this.settings.getDecrypted('crisp_api_identifier'),
      this.settings.getDecrypted('crisp_api_key'),
      this.settings.getDecrypted('crisp_website_id'),
    ]);
    if (!identifier || !key || !websiteId) return null;
    return { websiteId, identifier, key };
  }

  private async getCredentialsById(id: string): Promise<CrispCredentials | null> {
    const [row] = await this.db.db.select().from(crispWebsites).where(eq(crispWebsites.id, id));
    if (!row) return null;
    return { websiteId: row.websiteId, identifier: row.identifier, key: decrypt(row.apiKey) };
  }

  // ── Conversations / follow-ups ────────────────────────────────────────────

  async listConversations(opts: { followUp?: boolean; status?: string; limit?: number } = {}) {
    const where = [];
    if (opts.followUp === true) where.push(eq(crispConversations.followUp, true));
    if (opts.status) where.push(eq(crispConversations.status, opts.status));
    return this.db.db
      .select()
      .from(crispConversations)
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(crispConversations.receivedAt))
      .limit(Math.min(opts.limit ?? 100, 500));
  }

  async getConversationBySession(sessionId: string) {
    const [row] = await this.db.db
      .select()
      .from(crispConversations)
      .where(eq(crispConversations.sessionId, sessionId))
      .limit(1);
    return row ?? null;
  }

  async setFollowUp(sessionId: string, dto: { followUp: boolean; note?: string | null; dueAt?: string | null }) {
    const conv = await this.getConversationBySession(sessionId);
    if (!conv) throw new NotFoundException(`Crisp conversation not found: ${sessionId}`);

    const due = dto.dueAt ? new Date(dto.dueAt) : null;
    const set: Record<string, unknown> = {
      followUp: dto.followUp,
      followUpNote: dto.note ?? null,
      followUpDueAt: due,
      followUpNotifiedAt: null,
    };
    if (!dto.followUp) {
      set.followUpResolvedAt = new Date();
    } else {
      set.followUpResolvedAt = null;
    }
    await this.db.db.update(crispConversations).set(set).where(eq(crispConversations.sessionId, sessionId));

    if (conv.contactId) {
      await this.contactsSvc.addActivity(
        conv.contactId,
        dto.followUp ? 'follow_up_set' : 'follow_up_resolved',
        dto.followUp
          ? `Follow-up flagged on Crisp conversation${dto.note ? ': ' + dto.note.slice(0, 200) : ''}`
          : 'Follow-up resolved on Crisp conversation',
        { refId: sessionId, meta: { dueAt: dto.dueAt ?? null } },
      );
    }
    return this.getConversationBySession(sessionId);
  }

  async listDueFollowUps(now: Date) {
    return this.db.db
      .select()
      .from(crispConversations)
      .where(
        and(
          eq(crispConversations.followUp, true),
          isNotNull(crispConversations.followUpDueAt),
          lte(crispConversations.followUpDueAt, now),
          or(
            isNull(crispConversations.followUpNotifiedAt),
            // also re-notify if the due time was bumped after the last notification
            sql`${crispConversations.followUpNotifiedAt} < ${crispConversations.followUpDueAt}`,
          )!,
        ),
      )
      .limit(50);
  }

  async markFollowUpNotified(sessionId: string) {
    await this.db.db
      .update(crispConversations)
      .set({ followUpNotifiedAt: new Date() })
      .where(eq(crispConversations.sessionId, sessionId));
  }

  /**
   * Upsert a Contact for a Crisp visitor and link the conversation row.
   * Identity rule: sourceRef is `${websiteId}:${sessionId}` (stable for the
   * Crisp visitor's session). Email/displayName are patched in when learned.
   */
  async upsertContactForCrisp(input: {
    sessionId: string;
    websiteId: string;
    email?: string | null;
    nickname?: string | null;
  }): Promise<string> {
    const contact = await this.contactsSvc.upsertBySource({
      source: 'crisp',
      sourceRef: `${input.websiteId}:${input.sessionId}`,
      websiteTag: input.websiteId,
      email: input.email ?? null,
      displayName: input.nickname ?? null,
    });
    await this.db.db
      .update(crispConversations)
      .set({ contactId: contact.id })
      .where(eq(crispConversations.sessionId, input.sessionId));
    return contact.id;
  }

  private async callTest(creds: CrispCredentials): Promise<{ ok: boolean; message: string }> {
    try {
      const auth = this.authHeader(creds.identifier, creds.key);
      const res = await fetch(`https://api.crisp.chat/v1/website/${creds.websiteId}`, {
        headers: { Authorization: auth, 'X-Crisp-Tier': 'plugin' },
        signal: AbortSignal.timeout(8000),
      });
      const data = await res.json() as any;
      if (!res.ok) return { ok: false, message: data?.reason ?? `HTTP ${res.status}` };
      const siteName = data?.data?.name ?? creds.websiteId;
      return { ok: true, message: `Connected — ${siteName}` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }
}
