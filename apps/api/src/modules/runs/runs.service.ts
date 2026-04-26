import { Injectable, NotFoundException } from '@nestjs/common';
import { eq, desc, gt } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { agentRuns, agentLogs } from '../../db/schema';

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
    const [run] = await this.db.db
      .select()
      .from(agentRuns)
      .where(eq(agentRuns.id, id));

    if (!run) throw new NotFoundException(`Run not found: ${id}`);
    return run;
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

  async isRunFinished(runId: string): Promise<boolean> {
    const [run] = await this.db.db
      .select({ status: agentRuns.status })
      .from(agentRuns)
      .where(eq(agentRuns.id, runId));

    if (!run) return true;
    return ['EXECUTED', 'FAILED', 'REJECTED'].includes(run.status);
  }
}
