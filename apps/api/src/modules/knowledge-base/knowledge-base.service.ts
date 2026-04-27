import { Injectable } from '@nestjs/common';
import { eq, and, desc, inArray, sql, or } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { knowledgeEntries, writingSamples, promptTemplates, pendingApprovals, agentRuns, agents } from '../../db/schema';
import { KnowledgeBaseCacheService } from './knowledge-base-cache.service';
import { createId } from '@paralleldrive/cuid2';

export type KnowledgeEntry = typeof knowledgeEntries.$inferSelect;
export type WritingSample = typeof writingSamples.$inferSelect;

export interface KbPromptBlockParams {
  voiceProfile: KnowledgeEntry | null;
  facts: KnowledgeEntry[];
  references: KnowledgeEntry[];
  positiveSamples: WritingSample[];
  negativeSamples: WritingSample[];
  rejections: string[];
  threadHistory?: { role: 'customer' | 'agent'; text: string }[];
}

@Injectable()
export class KnowledgeBaseService {
  constructor(
    private readonly db: DbService,
    private readonly cache: KnowledgeBaseCacheService,
  ) {}

  // ─── Agent key filtering ───────────────────────────────────────────────────

  private agentKeyWhere(agentKey?: string) {
    if (!agentKey) return sql`1=1`;
    return sql`(agent_keys IS NULL
      OR agent_keys = ${agentKey}
      OR agent_keys LIKE ${agentKey + ',%'}
      OR agent_keys LIKE ${'%,' + agentKey}
      OR agent_keys LIKE ${'%,' + agentKey + ',%'})`;
  }

  // ─── Knowledge Entries ─────────────────────────────────────────────────────

  async listEntries(agentKey?: string, entryType?: string) {
    const rows = await this.db.db
      .select()
      .from(knowledgeEntries)
      .where(
        entryType
          ? sql`${this.agentKeyWhere(agentKey)} AND entry_type = ${entryType}`
          : this.agentKeyWhere(agentKey),
      )
      .orderBy(desc(knowledgeEntries.priority), desc(knowledgeEntries.createdAt));
    return rows;
  }

  async searchEntries(query: string, agentKey?: string, limit = 5): Promise<KnowledgeEntry[]> {
    const q = query?.trim();
    if (!q) {
      return this.db.db
        .select()
        .from(knowledgeEntries)
        .where(
          sql`${this.agentKeyWhere(agentKey)} AND entry_type = 'reference'`,
        )
        .orderBy(desc(knowledgeEntries.priority))
        .limit(limit);
    }
    return this.db.db
      .select()
      .from(knowledgeEntries)
      .where(
        sql`${this.agentKeyWhere(agentKey)}
          AND entry_type = 'reference'
          AND to_tsvector('english', title || ' ' || content) @@ plainto_tsquery('english', ${q})`,
      )
      .orderBy(desc(knowledgeEntries.priority))
      .limit(limit);
  }

  async getAlwaysOnContext(agentKey?: string): Promise<KnowledgeEntry[]> {
    const loader = () =>
      this.db.db
        .select()
        .from(knowledgeEntries)
        .where(
          sql`${this.agentKeyWhere(agentKey)} AND entry_type IN ('fact', 'voice_profile')`,
        )
        .orderBy(desc(knowledgeEntries.priority));

    return this.cache.getOrSet(this.cache.alwaysOnKey(agentKey ?? 'global'), loader);
  }

  async getBlocklistRules(agentKey?: string): Promise<string[]> {
    const loader = async () => {
      const rows = await this.db.db
        .select({ content: knowledgeEntries.content })
        .from(knowledgeEntries)
        .where(
          sql`${this.agentKeyWhere(agentKey)} AND entry_type = 'blocklist'`,
        );
      return rows.map(r => r.content);
    };
    return this.cache.getOrSet(this.cache.blocklistKey(agentKey ?? 'global'), loader);
  }

  async createEntry(dto: {
    title: string;
    content: string;
    category?: string;
    entryType?: string;
    priority?: number;
    agentKeys?: string;
    sourceType?: string;
    sourceUrl?: string;
    parentDocId?: string;
  }) {
    const [row] = await this.db.db
      .insert(knowledgeEntries)
      .values({
        id: createId(),
        title: dto.title,
        content: dto.content,
        category: dto.category ?? 'general',
        entryType: dto.entryType ?? 'reference',
        priority: dto.priority ?? 50,
        agentKeys: dto.agentKeys ?? null,
        sourceType: dto.sourceType ?? 'manual',
        sourceUrl: dto.sourceUrl ?? null,
        parentDocId: dto.parentDocId ?? null,
      })
      .returning();
    await this.invalidateCacheForEntry(row);
    return row;
  }

  async updateEntry(id: string, dto: Partial<{
    title: string;
    content: string;
    category: string;
    entryType: string;
    priority: number;
    agentKeys: string | null;
  }>) {
    const [row] = await this.db.db
      .update(knowledgeEntries)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(knowledgeEntries.id, id))
      .returning();
    if (row) await this.invalidateCacheForEntry(row);
    return row;
  }

  async deleteEntry(id: string) {
    // Cascade-delete all chunks that reference this parent first
    await this.db.db
      .delete(knowledgeEntries)
      .where(eq(knowledgeEntries.parentDocId, id));
    const [row] = await this.db.db
      .delete(knowledgeEntries)
      .where(eq(knowledgeEntries.id, id))
      .returning();
    if (row) await this.invalidateCacheForEntry(row);
    return row;
  }

  async countChunks(parentDocId: string) {
    const rows = await this.db.db
      .select({ id: knowledgeEntries.id })
      .from(knowledgeEntries)
      .where(eq(knowledgeEntries.parentDocId, parentDocId));
    return rows.length;
  }

  // ─── Writing Samples ───────────────────────────────────────────────────────

  async getWritingSamples(agentKey?: string): Promise<WritingSample[]> {
    const loader = () =>
      this.db.db
        .select()
        .from(writingSamples)
        .where(this.agentKeyWhere(agentKey))
        .orderBy(writingSamples.polarity, desc(writingSamples.createdAt));

    return this.cache.getOrSet(this.cache.samplesKey(agentKey ?? 'global'), loader);
  }

  async listSamples(agentKey?: string) {
    return this.db.db
      .select()
      .from(writingSamples)
      .where(this.agentKeyWhere(agentKey))
      .orderBy(writingSamples.polarity, desc(writingSamples.createdAt));
  }

  async createSample(dto: { context: string; sampleText: string; polarity?: string; agentKeys?: string }) {
    const [row] = await this.db.db
      .insert(writingSamples)
      .values({
        id: createId(),
        context: dto.context,
        sampleText: dto.sampleText,
        polarity: dto.polarity ?? 'positive',
        agentKeys: dto.agentKeys ?? null,
      })
      .returning();
    await this.invalidateSamplesCache(row.agentKeys);
    return row;
  }

  async updateSample(id: string, dto: Partial<{ context: string; sampleText: string; polarity: string; agentKeys: string | null }>) {
    const [row] = await this.db.db
      .update(writingSamples)
      .set(dto)
      .where(eq(writingSamples.id, id))
      .returning();
    if (row) await this.invalidateSamplesCache(row.agentKeys);
    return row;
  }

  async deleteSample(id: string) {
    const [row] = await this.db.db
      .delete(writingSamples)
      .where(eq(writingSamples.id, id))
      .returning();
    if (row) await this.invalidateSamplesCache(row.agentKeys);
    return row;
  }

  // ─── Prompt Templates ─────────────────────────────────────────────────────

  async getPromptTemplate(agentKey: string) {
    const cacheKey = this.cache.templateKey(`${agentKey}.reply`);
    return this.cache.getOrSet(cacheKey, async () => {
      const [row] = await this.db.db
        .select()
        .from(promptTemplates)
        .where(eq(promptTemplates.key, `${agentKey}.reply`));
      return row ?? null;
    });
  }

  async listTemplates() {
    return this.db.db
      .select()
      .from(promptTemplates)
      .orderBy(promptTemplates.key);
  }

  async createTemplate(dto: { key: string; system: string; userTemplate: string }) {
    const [row] = await this.db.db
      .insert(promptTemplates)
      .values({ id: createId(), ...dto })
      .returning();
    await this.cache.invalidateTemplate(dto.key);
    return row;
  }

  async updateTemplate(id: string, dto: Partial<{ system: string; userTemplate: string }>) {
    const [row] = await this.db.db
      .update(promptTemplates)
      .set({ ...dto, version: sql`version + 1` })
      .where(eq(promptTemplates.id, id))
      .returning();
    if (row) await this.cache.invalidateTemplate(row.key);
    return row;
  }

  async deleteTemplate(id: string) {
    const [row] = await this.db.db
      .delete(promptTemplates)
      .where(eq(promptTemplates.id, id))
      .returning();
    if (row) await this.cache.invalidateTemplate(row.key);
    return row;
  }

  // ─── Rejection history ─────────────────────────────────────────────────────

  async getRecentRejections(agentKey: string, limit = 3): Promise<string[]> {
    const rows = await this.db.db
      .select({ reason: pendingApprovals.rejectionReason })
      .from(pendingApprovals)
      .innerJoin(agentRuns, eq(pendingApprovals.runId, agentRuns.id))
      .innerJoin(agents, eq(agentRuns.agentId, agents.id))
      .where(
        and(
          eq(agents.key, agentKey),
          sql`${pendingApprovals.rejectionReason} IS NOT NULL`,
        ),
      )
      .orderBy(desc(pendingApprovals.createdAt))
      .limit(limit);
    return rows.map(r => r.reason!);
  }

  // ─── KB prompt block builder ───────────────────────────────────────────────

  buildKbPromptBlock(params: KbPromptBlockParams): string {
    const { voiceProfile, facts, references, positiveSamples, negativeSamples, rejections, threadHistory } = params;
    const parts: string[] = [];

    if (voiceProfile) {
      parts.push(`\n\n## Your Voice & Style\n${trunc(voiceProfile.content, 600)}`);
    }

    if (facts.length) {
      const factText = facts
        .map(f => `- **${f.title}**: ${trunc(f.content, 200)}`)
        .join('\n')
        .slice(0, 800);
      parts.push(`\n\n## Key Facts (always apply)\n${factText}`);
    }

    if (references.length) {
      const refText = references.slice(0, 3)
        .map(r => `### ${r.title}\n${trunc(r.content, 600)}`)
        .join('\n\n');
      parts.push(`\n\n## Relevant Knowledge\n${refText}`);
    }

    if (positiveSamples.length) {
      const pos = positiveSamples.slice(0, 3)
        .map(s => `[${s.context}]: "${trunc(s.sampleText, 400)}"`)
        .join('\n\n');
      parts.push(`\n\n## Write Like This (examples)\n${pos}`);
    }

    if (negativeSamples.length) {
      const neg = negativeSamples.slice(0, 2)
        .map(s => `[${s.context}]: "${trunc(s.sampleText, 200)}"`)
        .join('\n\n');
      parts.push(`\n\n## Never Write Like This\n${neg}`);
    }

    if (rejections.length) {
      const rejText = rejections.slice(0, 3)
        .map(r => `- ${trunc(r, 150)}`)
        .join('\n');
      parts.push(`\n\n## Avoid These Past Mistakes\n${rejText}`);
    }

    if (threadHistory?.length) {
      const thread = threadHistory.slice(-5)
        .map(m => `${m.role === 'customer' ? 'Customer' : 'Agent'}: "${trunc(m.text, 300)}"`)
        .join('\n');
      parts.push(`\n\n## Conversation Thread\n${thread}`);
    }

    if (parts.length) {
      parts.push('\n\n---\n**Response rule**: Be concise and direct. No preamble, no filler phrases, no unnecessary explanation. Get straight to the point.');
    }

    return parts.join('');
  }

  // ─── Cache helpers ─────────────────────────────────────────────────────────

  private async invalidateCacheForEntry(entry: KnowledgeEntry) {
    if (!entry.agentKeys) {
      await this.cache.invalidateGlobal();
    } else {
      const keys = entry.agentKeys.split(',').map(k => k.trim());
      await Promise.all(keys.map(k => this.cache.invalidateAgent(k)));
    }
  }

  private async invalidateSamplesCache(agentKeys: string | null) {
    if (!agentKeys) {
      await this.cache.invalidateGlobal();
    } else {
      const keys = agentKeys.split(',').map(k => k.trim());
      await Promise.all(keys.map(k => this.cache.invalidateAgent(k)));
    }
  }
}

function trunc(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}
