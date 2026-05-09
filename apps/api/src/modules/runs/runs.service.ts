import { Injectable, NotFoundException } from '@nestjs/common';
import { eq, desc, lt, sql } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { agentRuns, agentLogs, agents } from '../../db/schema';
import { llmUsageLogs } from '../llm/llm-usage.schema';

@Injectable()
export class RunsService {
  constructor(private db: DbService) {}

  async findAll(limit = 50) {
    return this.db.db
      .select()
      .from(agentRuns)
      .orderBy(desc(agentRuns.startedAt))
      .limit(limit);
  }

  async findById(id: string) {
    const [row] = await this.db.db
      .select({
        id: agentRuns.id,
        agentId: agentRuns.agentId,
        agentKey: agents.key,
        agentName: agents.name,
        triggerType: agentRuns.triggerType,
        triggerPayload: agentRuns.triggerPayload,
        status: agentRuns.status,
        context: agentRuns.context,
        proposedActions: agentRuns.proposedActions,
        result: agentRuns.result,
        error: agentRuns.error,
        startedAt: agentRuns.startedAt,
        finishedAt: agentRuns.finishedAt,
      })
      .from(agentRuns)
      .innerJoin(agents, eq(agentRuns.agentId, agents.id))
      .where(eq(agentRuns.id, id));

    if (!row) throw new NotFoundException(`Run not found: ${id}`);
    return row;
  }

  async getLogs(runId: string, afterId?: string) {
    const query = this.db.db
      .select()
      .from(agentLogs)
      .where(
        afterId
          ? eq(agentLogs.runId, runId)
          : eq(agentLogs.runId, runId),
      )
      .orderBy(agentLogs.createdAt);

    return query;
  }

  async getRecentLogs(opts: number | { limit?: number; before?: Date } = 100) {
    const { limit = 100, before } = typeof opts === 'number' ? { limit: opts } : opts;
    const q = this.db.db
      .select({
        id: agentLogs.id,
        level: agentLogs.level,
        message: agentLogs.message,
        meta: agentLogs.meta,
        createdAt: agentLogs.createdAt,
        runId: agentLogs.runId,
        agentName: agents.name,
        agentKey: agents.key,
        runStatus: agentRuns.status,
      })
      .from(agentLogs)
      .innerJoin(agentRuns, eq(agentLogs.runId, agentRuns.id))
      .innerJoin(agents, eq(agentRuns.agentId, agents.id));
    const filtered = before ? q.where(lt(agentLogs.createdAt, before)) : q;
    return filtered.orderBy(desc(agentLogs.createdAt)).limit(limit);
  }

  async getRunUsage(runId: string): Promise<{ calls: number; inputTokens: number; outputTokens: number; costUsd: number }> {
    const [row] = await this.db.db.execute<{
      calls: string;
      input_tokens: string | null;
      output_tokens: string | null;
      cost_usd: string | null;
    }>(sql`
      SELECT
        COUNT(*)::int                          AS calls,
        COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
        COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
        COALESCE(SUM(cost_usd), 0)::numeric    AS cost_usd
      FROM llm_usage_logs
      WHERE run_id = ${runId}
    `);
    void llmUsageLogs;
    return {
      calls: Number(row?.calls ?? 0),
      inputTokens: Number(row?.input_tokens ?? 0),
      outputTokens: Number(row?.output_tokens ?? 0),
      costUsd: Number(row?.cost_usd ?? 0),
    };
  }

  async isRunFinished(runId: string): Promise<boolean> {
    const [run] = await this.db.db
      .select({ status: agentRuns.status })
      .from(agentRuns)
      .where(eq(agentRuns.id, runId));

    if (!run) return true;
    return ['EXECUTED', 'FAILED', 'REJECTED'].includes(run.status);
  }
}
