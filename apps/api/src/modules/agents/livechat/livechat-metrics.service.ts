import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';

export interface SiteMetrics {
  siteId: string;
  siteKey: string;
  siteLabel: string;
  windowDays: number;
  sessionsTotal: number;
  sessionsClosed: number;
  sessionsEscalated: number;
  agentReplies: number;
  operatorReplies: number;
  fallbacks: number;
  thumbsUp: number;
  thumbsDown: number;
  csatPct: number | null;
  avgMessagesPerSession: number;
  avgFirstResponseMs: number | null;
}

@Injectable()
export class LivechatMetricsService {
  constructor(private readonly db: DbService) {}

  /** Per-site rollup over the last N days. Default 7. */
  async forSite(siteId: string, windowDays = 7): Promise<SiteMetrics> {
    const days = Math.max(1, Math.min(90, Math.floor(windowDays)));
    const rows = await this.db.db.execute<{
      site_id: string;
      site_key: string;
      site_label: string;
      sessions_total: number;
      sessions_closed: number;
      sessions_escalated: number;
      agent_replies: number;
      operator_replies: number;
      fallbacks: number;
      thumbs_up: number;
      thumbs_down: number;
      avg_messages: number | null;
      avg_first_response_ms: number | null;
    }>(sql`
      WITH win AS (
        SELECT now() - (${days} || ' days')::interval AS since
      ),
      sess AS (
        SELECT s.id, s.site_id, s.status, s.created_at
        FROM livechat_sessions s, win
        WHERE s.site_id = ${siteId} AND s.created_at >= win.since
      ),
      msg_stats AS (
        SELECT
          m.session_id,
          COUNT(*) AS message_count,
          MIN(CASE WHEN m.role IN ('agent','operator') THEN m.created_at END) AS first_reply_at,
          MIN(CASE WHEN m.role = 'visitor' THEN m.created_at END) AS first_visitor_at
        FROM livechat_messages m
        WHERE m.session_id IN (SELECT id FROM sess)
        GROUP BY m.session_id
      ),
      reply_counts AS (
        SELECT
          SUM(CASE WHEN m.role = 'agent' AND m.pending_approval = false THEN 1 ELSE 0 END) AS agent_replies,
          SUM(CASE WHEN m.role = 'operator' THEN 1 ELSE 0 END) AS operator_replies
        FROM livechat_messages m
        WHERE m.session_id IN (SELECT id FROM sess)
      ),
      fb AS (
        SELECT
          SUM(CASE WHEN rating = 'up' THEN 1 ELSE 0 END)::int AS thumbs_up,
          SUM(CASE WHEN rating = 'down' THEN 1 ELSE 0 END)::int AS thumbs_down
        FROM livechat_session_feedback
        WHERE site_id = ${siteId} AND created_at >= (SELECT since FROM win)
      )
      SELECT
        s.id AS site_id,
        s.key AS site_key,
        s.label AS site_label,
        (SELECT COUNT(*)::int FROM sess) AS sessions_total,
        (SELECT COUNT(*)::int FROM sess WHERE status = 'closed') AS sessions_closed,
        (SELECT COUNT(*)::int FROM sess WHERE status IN ('needs_human','human_taken_over')) AS sessions_escalated,
        COALESCE((SELECT agent_replies FROM reply_counts), 0)::int AS agent_replies,
        COALESCE((SELECT operator_replies FROM reply_counts), 0)::int AS operator_replies,
        (SELECT COUNT(*)::int FROM livechat_messages m
          WHERE m.session_id IN (SELECT id FROM sess)
            AND m.role = 'agent'
            AND m.content LIKE 'Let me get someone from the team%') AS fallbacks,
        COALESCE((SELECT thumbs_up FROM fb), 0)::int AS thumbs_up,
        COALESCE((SELECT thumbs_down FROM fb), 0)::int AS thumbs_down,
        (SELECT AVG(message_count)::float FROM msg_stats) AS avg_messages,
        (SELECT AVG(EXTRACT(EPOCH FROM (first_reply_at - first_visitor_at)) * 1000)::float
           FROM msg_stats
          WHERE first_reply_at IS NOT NULL AND first_visitor_at IS NOT NULL) AS avg_first_response_ms
      FROM livechat_sites s
      WHERE s.id = ${siteId}
    `);
    const r = rows[0];
    if (!r) {
      // Site doesn't exist
      return this.empty(siteId, '', '', days);
    }
    const totalRated = (r.thumbs_up ?? 0) + (r.thumbs_down ?? 0);
    return {
      siteId: r.site_id,
      siteKey: r.site_key,
      siteLabel: r.site_label,
      windowDays: days,
      sessionsTotal: r.sessions_total ?? 0,
      sessionsClosed: r.sessions_closed ?? 0,
      sessionsEscalated: r.sessions_escalated ?? 0,
      agentReplies: r.agent_replies ?? 0,
      operatorReplies: r.operator_replies ?? 0,
      fallbacks: r.fallbacks ?? 0,
      thumbsUp: r.thumbs_up ?? 0,
      thumbsDown: r.thumbs_down ?? 0,
      csatPct: totalRated > 0 ? Math.round((r.thumbs_up / totalRated) * 100) : null,
      avgMessagesPerSession: Math.round((r.avg_messages ?? 0) * 10) / 10,
      avgFirstResponseMs: r.avg_first_response_ms != null ? Math.round(r.avg_first_response_ms) : null,
    };
  }

  /** Submit a thumbs rating from the visitor. Idempotent per session. */
  async submitFeedback(input: { sessionId: string; siteId: string; rating: 'up' | 'down'; comment?: string }) {
    await this.db.db.execute(sql`
      INSERT INTO livechat_session_feedback (id, session_id, site_id, rating, comment)
      VALUES (
        ${`fb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`},
        ${input.sessionId}, ${input.siteId}, ${input.rating}, ${input.comment ?? null}
      )
      ON CONFLICT (session_id) DO UPDATE
        SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, created_at = now()
    `);
  }

  private empty(siteId: string, siteKey: string, siteLabel: string, days: number): SiteMetrics {
    return {
      siteId, siteKey, siteLabel, windowDays: days,
      sessionsTotal: 0, sessionsClosed: 0, sessionsEscalated: 0,
      agentReplies: 0, operatorReplies: 0, fallbacks: 0,
      thumbsUp: 0, thumbsDown: 0, csatPct: null,
      avgMessagesPerSession: 0, avgFirstResponseMs: null,
    };
  }
}
