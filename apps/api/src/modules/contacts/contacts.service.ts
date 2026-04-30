import { Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { contacts, contactActivity } from './contacts.schema';

export type ContactSource = 'crisp' | 'taskip' | 'email' | 'whatsapp' | 'linkedin' | 'manual' | 'livechat';
export type ActivityKind =
  | 'crisp_message'
  | 'livechat_message'
  | 'email_sent'
  | 'email_received'
  | 'note'
  | 'task'
  | 'follow_up_set'
  | 'follow_up_resolved';

export interface UpsertBySourceInput {
  source: ContactSource;
  sourceRef: string;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
  websiteTag?: string | null;
  taskipUserId?: string | null;
}

@Injectable()
export class ContactsService {
  constructor(private db: DbService) {}

  async list(opts: { q?: string; source?: ContactSource; websiteTag?: string; limit?: number } = {}) {
    const limit = Math.min(opts.limit ?? 100, 500);
    const where = [];
    if (opts.source) where.push(eq(contacts.source, opts.source));
    if (opts.websiteTag) where.push(eq(contacts.websiteTag, opts.websiteTag));
    if (opts.q) {
      const like = `%${opts.q}%`;
      where.push(or(
        ilike(contacts.displayName, like),
        ilike(contacts.email, like),
        ilike(contacts.phone, like),
        ilike(contacts.notes, like),
        ilike(contacts.sourceRef, like),
      )!);
    }
    return this.db.db
      .select()
      .from(contacts)
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(contacts.updatedAt))
      .limit(limit);
  }

  async getById(id: string) {
    const [row] = await this.db.db.select().from(contacts).where(eq(contacts.id, id)).limit(1);
    if (!row) throw new NotFoundException(`Contact not found: ${id}`);
    return row;
  }

  async create(data: {
    displayName?: string;
    email?: string;
    phone?: string;
    source?: ContactSource;
    sourceRef?: string;
    websiteTag?: string;
    taskipUserId?: string;
    notes?: string;
    tags?: string[];
  }) {
    const source = data.source ?? 'manual';
    const sourceRef = data.sourceRef ?? `manual:${data.email ?? data.phone ?? Date.now()}`;
    const [row] = await this.db.db
      .insert(contacts)
      .values({
        displayName: data.displayName ?? null,
        email: data.email ?? null,
        phone: data.phone ?? null,
        source,
        sourceRef,
        websiteTag: data.websiteTag ?? null,
        taskipUserId: data.taskipUserId ?? null,
        notes: data.notes ?? null,
        tags: data.tags ?? [],
      })
      .returning();
    return row;
  }

  async update(id: string, data: Partial<{
    displayName: string | null;
    email: string | null;
    phone: string | null;
    notes: string | null;
    tags: string[];
    websiteTag: string | null;
    taskipUserId: string | null;
  }>) {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (data.displayName !== undefined) set.displayName = data.displayName;
    if (data.email !== undefined) set.email = data.email;
    if (data.phone !== undefined) set.phone = data.phone;
    if (data.notes !== undefined) set.notes = data.notes;
    if (data.tags !== undefined) set.tags = data.tags;
    if (data.websiteTag !== undefined) set.websiteTag = data.websiteTag;
    if (data.taskipUserId !== undefined) set.taskipUserId = data.taskipUserId;
    const [row] = await this.db.db.update(contacts).set(set).where(eq(contacts.id, id)).returning();
    if (!row) throw new NotFoundException(`Contact not found: ${id}`);
    return row;
  }

  async delete(id: string) {
    await this.db.db.delete(contactActivity).where(eq(contactActivity.contactId, id));
    await this.db.db.delete(contacts).where(eq(contacts.id, id));
    return { ok: true };
  }

  /**
   * Upsert a contact identified by (source, sourceRef). Returns the contact.
   * Identity-stable: the sourceRef never changes for a given visitor — but
   * when newer info (email, displayName, phone) arrives, we patch the row.
   */
  async upsertBySource(input: UpsertBySourceInput) {
    const [existing] = await this.db.db
      .select()
      .from(contacts)
      .where(and(eq(contacts.source, input.source), eq(contacts.sourceRef, input.sourceRef)))
      .limit(1);

    if (existing) {
      const patch: Record<string, unknown> = {};
      if (input.email && input.email !== existing.email) patch.email = input.email;
      if (input.displayName && input.displayName !== existing.displayName) patch.displayName = input.displayName;
      if (input.phone && input.phone !== existing.phone) patch.phone = input.phone;
      if (input.websiteTag && input.websiteTag !== existing.websiteTag) patch.websiteTag = input.websiteTag;
      if (input.taskipUserId && input.taskipUserId !== existing.taskipUserId) patch.taskipUserId = input.taskipUserId;
      if (Object.keys(patch).length === 0) return existing;
      patch.updatedAt = new Date();
      const [updated] = await this.db.db.update(contacts).set(patch).where(eq(contacts.id, existing.id)).returning();
      return updated;
    }

    const [created] = await this.db.db
      .insert(contacts)
      .values({
        source: input.source,
        sourceRef: input.sourceRef,
        displayName: input.displayName ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        websiteTag: input.websiteTag ?? null,
        taskipUserId: input.taskipUserId ?? null,
      })
      .returning();
    return created;
  }

  async addActivity(contactId: string, kind: ActivityKind, summary: string, opts?: { refId?: string; meta?: Record<string, unknown> }) {
    const [row] = await this.db.db
      .insert(contactActivity)
      .values({
        contactId,
        kind,
        summary: summary.slice(0, 500),
        refId: opts?.refId ?? null,
        meta: opts?.meta ?? null,
      })
      .returning();
    return row;
  }

  async getActivity(contactId: string, limit = 100) {
    return this.db.db
      .select()
      .from(contactActivity)
      .where(eq(contactActivity.contactId, contactId))
      .orderBy(desc(contactActivity.createdAt))
      .limit(Math.min(limit, 500));
  }

  async stats() {
    const [row] = await this.db.db.execute<{ total: number; crisp: number; livechat: number; email: number; manual: number }>(sql`
      SELECT
        COUNT(*)::int AS total,
        SUM(CASE WHEN source = 'crisp' THEN 1 ELSE 0 END)::int AS crisp,
        SUM(CASE WHEN source = 'livechat' THEN 1 ELSE 0 END)::int AS livechat,
        SUM(CASE WHEN source = 'email' THEN 1 ELSE 0 END)::int AS email,
        SUM(CASE WHEN source = 'manual' THEN 1 ELSE 0 END)::int AS manual
      FROM contacts
    `);
    return row ?? { total: 0, crisp: 0, livechat: 0, email: 0, manual: 0 };
  }
}
