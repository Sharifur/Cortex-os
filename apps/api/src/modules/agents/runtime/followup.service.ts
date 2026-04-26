import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { agentRuns, pendingApprovals } from '../../../db/schema';

@Injectable()
export class FollowupService {
  constructor(private db: DbService) {}

  async getRunWithFollowups(runId: string) {
    const [run] = await this.db.db
      .select()
      .from(agentRuns)
      .where(eq(agentRuns.id, runId));
    return run ?? null;
  }

  async getActiveFollowupApproval(runId: string) {
    const approvals = await this.db.db
      .select()
      .from(pendingApprovals)
      .where(eq(pendingApprovals.runId, runId));

    return approvals.find((a) => a.status === 'FOLLOWUP') ?? null;
  }

  async countFollowupsForRun(runId: string): Promise<number> {
    const run = await this.getRunWithFollowups(runId);
    if (!run?.context) return 0;
    const ctx = run.context as { followups?: unknown[] };
    return ctx.followups?.length ?? 0;
  }
}
