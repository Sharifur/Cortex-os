import { Injectable } from '@nestjs/common';
import { DbService } from '../../db/db.service';
import { sql } from 'drizzle-orm';

@Injectable()
export class NotificationsService {
  constructor(private db: DbService) {}

  async getSummary() {
    const [waiting] = await this.db.db.execute(sql`
      SELECT COUNT(DISTINCT s.id)::int AS count
      FROM livechat_sessions s
      WHERE s.status = 'open'
        AND (
          SELECT role FROM livechat_messages m
          WHERE m.session_id = s.id
          ORDER BY m.created_at DESC
          LIMIT 1
        ) = 'visitor'
    `);

    const [approvals] = await this.db.db.execute(sql`
      SELECT COUNT(*)::int AS count FROM pending_approvals WHERE status = 'PENDING'
    `);

    const [failures] = await this.db.db.execute(sql`
      SELECT COUNT(*)::int AS count FROM agent_runs
      WHERE status = 'failed'
        AND started_at >= NOW() - INTERVAL '24 hours'
    `);

    const [proposals] = await this.db.db.execute(sql`
      SELECT COUNT(*)::int AS count FROM kb_proposals WHERE status = 'pending'
    `);

    const waitingChats = Number((waiting as any)?.count ?? 0);
    const pendingApprovals = Number((approvals as any)?.count ?? 0);
    const agentFailures = Number((failures as any)?.count ?? 0);
    const kbProposals = Number((proposals as any)?.count ?? 0);

    return {
      waitingChats,
      pendingApprovals,
      agentFailures,
      kbProposals,
      total: waitingChats + pendingApprovals + agentFailures + kbProposals,
    };
  }
}
