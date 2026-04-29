import { Injectable } from '@nestjs/common';
import { sql, eq, desc, gte, count } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { agents, agentRuns, pendingApprovals } from '../../db/schema';

@Injectable()
export class DashboardService {
  constructor(private db: DbService) {}

  async getStats() {
    const db = this.db.db;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const since24hIso = since24h.toISOString();
    const since7dIso = since7d.toISOString();

    const [
      totalRunsRow,
      runsTodayRow,
      pendingApprovalsRow,
      failedRuns24hRow,
      totalAgentsRow,
      enabledAgentsRow,
      statusBreakdown,
      topAgents,
      recentRuns,
    ] = await Promise.all([
      db.select({ n: count() }).from(agentRuns),

      db.select({ n: count() }).from(agentRuns)
        .where(gte(agentRuns.startedAt, startOfToday)),

      db.select({ n: count() }).from(pendingApprovals)
        .where(eq(pendingApprovals.status, 'PENDING')),

      db.select({ n: count() }).from(agentRuns)
        .where(sql`${agentRuns.status} = 'FAILED' AND ${agentRuns.startedAt} >= ${since24hIso}::timestamp`),

      db.select({ n: count() }).from(agents),

      db.select({ n: count() }).from(agents)
        .where(eq(agents.enabled, true)),

      db.execute(sql`
        SELECT status, COUNT(*)::int AS n
        FROM agent_runs
        WHERE started_at >= ${since7dIso}::timestamp
        GROUP BY status
        ORDER BY n DESC
      `),

      db.execute(sql`
        SELECT a.key, a.name, COUNT(r.id)::int AS runs,
               SUM(CASE WHEN r.status = 'FAILED' THEN 1 ELSE 0 END)::int AS failures
        FROM agents a
        LEFT JOIN agent_runs r ON r.agent_id = a.id AND r.started_at >= ${since7dIso}::timestamp
        GROUP BY a.id, a.key, a.name
        ORDER BY runs DESC
        LIMIT 8
      `),

      db.select({
        id: agentRuns.id,
        status: agentRuns.status,
        triggerType: agentRuns.triggerType,
        startedAt: agentRuns.startedAt,
        finishedAt: agentRuns.finishedAt,
        agentKey: agents.key,
        agentName: agents.name,
      })
        .from(agentRuns)
        .innerJoin(agents, eq(agentRuns.agentId, agents.id))
        .orderBy(desc(agentRuns.startedAt))
        .limit(10),
    ]);

    return {
      totalRuns: totalRunsRow[0].n,
      runsToday: runsTodayRow[0].n,
      pendingApprovals: pendingApprovalsRow[0].n,
      failedRuns24h: failedRuns24hRow[0].n,
      totalAgents: totalAgentsRow[0].n,
      enabledAgents: enabledAgentsRow[0].n,
      statusBreakdown: statusBreakdown as unknown as { status: string; n: number }[],
      topAgents: topAgents as unknown as { key: string; name: string; runs: number; failures: number }[],
      recentRuns,
    };
  }
}
