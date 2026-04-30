import { Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { llmUsageLogs } from './llm-usage.schema';
import { computeCostUsd } from './pricing';

export interface UsageRecord {
  runId?: string | null;
  agentKey?: string | null;
  provider: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
}

@Injectable()
export class LlmUsageService {
  private readonly logger = new Logger(LlmUsageService.name);

  constructor(private readonly db: DbService) {}

  async record(entry: UsageRecord): Promise<void> {
    try {
      const { costUsd } = computeCostUsd(entry.provider, entry.model, entry);
      await this.db.db.insert(llmUsageLogs).values({
        runId: entry.runId ?? null,
        agentKey: entry.agentKey ?? null,
        provider: entry.provider,
        model: entry.model,
        inputTokens: entry.inputTokens ?? 0,
        outputTokens: entry.outputTokens ?? 0,
        cachedInputTokens: entry.cachedInputTokens ?? 0,
        costUsd: costUsd.toFixed(8),
      });
    } catch (err) {
      // Logging usage must never break the LLM call path.
      this.logger.warn(`failed to record LLM usage: ${(err as Error).message}`);
    }
  }

  async totals(opts: { sinceHours?: number } = {}): Promise<{
    calls: number;
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens: number;
    costUsd: number;
  }> {
    const where = this.timeWhere(opts);
    const [row] = await this.db.db.execute<{
      calls: string;
      input_tokens: string | null;
      output_tokens: string | null;
      cached_input_tokens: string | null;
      cost_usd: string | null;
    }>(sql`
      SELECT
        COUNT(*)::int                                AS calls,
        COALESCE(SUM(input_tokens), 0)::bigint       AS input_tokens,
        COALESCE(SUM(output_tokens), 0)::bigint      AS output_tokens,
        COALESCE(SUM(cached_input_tokens), 0)::bigint AS cached_input_tokens,
        COALESCE(SUM(cost_usd), 0)::numeric          AS cost_usd
      FROM llm_usage_logs
      ${where}
    `);
    return {
      calls: Number(row?.calls ?? 0),
      inputTokens: Number(row?.input_tokens ?? 0),
      outputTokens: Number(row?.output_tokens ?? 0),
      cachedInputTokens: Number(row?.cached_input_tokens ?? 0),
      costUsd: Number(row?.cost_usd ?? 0),
    };
  }

  async byModel(opts: { sinceHours?: number; limit?: number } = {}) {
    const where = this.timeWhere(opts);
    const rows = await this.db.db.execute<{
      provider: string;
      model: string;
      calls: string;
      input_tokens: string;
      output_tokens: string;
      cached_input_tokens: string;
      cost_usd: string;
    }>(sql`
      SELECT
        provider,
        model,
        COUNT(*)::int                                AS calls,
        COALESCE(SUM(input_tokens), 0)::bigint       AS input_tokens,
        COALESCE(SUM(output_tokens), 0)::bigint      AS output_tokens,
        COALESCE(SUM(cached_input_tokens), 0)::bigint AS cached_input_tokens,
        COALESCE(SUM(cost_usd), 0)::numeric          AS cost_usd
      FROM llm_usage_logs
      ${where}
      GROUP BY provider, model
      ORDER BY cost_usd DESC
      LIMIT ${opts.limit ?? 50}
    `);
    return rows.map((r) => ({
      provider: r.provider,
      model: r.model,
      calls: Number(r.calls),
      inputTokens: Number(r.input_tokens),
      outputTokens: Number(r.output_tokens),
      cachedInputTokens: Number(r.cached_input_tokens),
      costUsd: Number(r.cost_usd),
    }));
  }

  async byAgent(opts: { sinceHours?: number; limit?: number } = {}) {
    const where = this.timeWhere(opts);
    const rows = await this.db.db.execute<{
      agent_key: string | null;
      calls: string;
      input_tokens: string;
      output_tokens: string;
      cached_input_tokens: string;
      cost_usd: string;
    }>(sql`
      SELECT
        agent_key,
        COUNT(*)::int                                AS calls,
        COALESCE(SUM(input_tokens), 0)::bigint       AS input_tokens,
        COALESCE(SUM(output_tokens), 0)::bigint      AS output_tokens,
        COALESCE(SUM(cached_input_tokens), 0)::bigint AS cached_input_tokens,
        COALESCE(SUM(cost_usd), 0)::numeric          AS cost_usd
      FROM llm_usage_logs
      ${where}
      GROUP BY agent_key
      ORDER BY cost_usd DESC
      LIMIT ${opts.limit ?? 50}
    `);
    return rows.map((r) => ({
      agentKey: r.agent_key,
      calls: Number(r.calls),
      inputTokens: Number(r.input_tokens),
      outputTokens: Number(r.output_tokens),
      cachedInputTokens: Number(r.cached_input_tokens),
      costUsd: Number(r.cost_usd),
    }));
  }

  /** Daily cost totals (UTC) for the last N days. */
  async daily(opts: { days?: number } = {}) {
    const days = Math.max(1, Math.min(opts.days ?? 30, 180));
    const rows = await this.db.db.execute<{
      day: string;
      calls: string;
      input_tokens: string;
      output_tokens: string;
      cost_usd: string;
    }>(sql`
      SELECT
        date_trunc('day', created_at)::date AS day,
        COUNT(*)::int                       AS calls,
        COALESCE(SUM(input_tokens), 0)::bigint  AS input_tokens,
        COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
        COALESCE(SUM(cost_usd), 0)::numeric AS cost_usd
      FROM llm_usage_logs
      WHERE created_at >= NOW() - (${days}::int || ' days')::interval
      GROUP BY 1
      ORDER BY 1 DESC
    `);
    return rows.map((r) => ({
      day: typeof r.day === 'string' ? r.day : new Date(r.day).toISOString().slice(0, 10),
      calls: Number(r.calls),
      inputTokens: Number(r.input_tokens),
      outputTokens: Number(r.output_tokens),
      costUsd: Number(r.cost_usd),
    }));
  }

  async recent(limit = 100) {
    const safeLimit = Math.min(Math.max(limit, 1), 500);
    return this.db.db
      .select()
      .from(llmUsageLogs)
      .orderBy(desc(llmUsageLogs.createdAt))
      .limit(safeLimit);
  }

  private timeWhere(opts: { sinceHours?: number }) {
    if (!opts.sinceHours) return sql``;
    const cutoff = new Date(Date.now() - opts.sinceHours * 60 * 60 * 1000);
    return sql`WHERE created_at >= ${cutoff}`;
  }
}

// Re-export so call-sites have a single import surface.
export { computeCostUsd, getModelPrice, listKnownModels } from './pricing';
// Used in queries above; keep the symbols imported so the linter doesn't strip them.
void [and, eq, gte];
