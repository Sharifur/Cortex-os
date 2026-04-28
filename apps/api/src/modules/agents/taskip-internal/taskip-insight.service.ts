import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

export type InsightCohort =
  | 'serious_trial'
  | 'looking_trial'
  | 'ignore_trial'
  | 'healthy_paid'
  | 'expanding_paid'
  | 'at_risk_paid'
  | 'dormant_paid';

export interface InsightWorkspaceOverview {
  schema_version: number;
  workspace: {
    uuid: string;
    url: string;
    name: string;
    created_at: string;
    days_since_signup: number;
  };
  plan: {
    is_trial: boolean;
    trial_ends_at: string | null;
    plan_name: string | null;
  };
  cohort: InsightCohort | null;
  score: number | null;
  signals: Array<{ key: string; value: number; threshold?: number }>;
  recent_activities: Array<{
    activity_type: number;
    module_category: number;
    subject_type: string;
    occurred_at: string;
  }>;
  evaluated_at: string;
}

export interface InsightCohortListItem {
  uuid: string;
  url: string;
  name: string;
  score: number;
  score_delta_14d: number;
  previous_cohort: InsightCohort | null;
  cohort_assigned_at: string;
  last_seen_at: string;
  plan_mrr_usd: number;
  primary_signal_key: string;
}

export interface InsightCohortListResponse {
  schema_version: number;
  cohort: InsightCohort;
  workspaces: InsightCohortListItem[];
  pagination: {
    per_page: number;
    next_cursor: string | null;
    has_more: boolean;
  };
}

export interface InsightRecommendedAction {
  template_key: string;
  title: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_in_hours: number;
  channel_hint: 'email' | 'inapp' | 'push';
  evidence: Array<{ key: string; value: number; threshold?: number }>;
  prompt: string;
}

export interface InsightMarketingSuggestion {
  workspace_uuid: string;
  template_key: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  channel: 'email' | 'inapp' | 'push';
  recommended_due_at: string;
  idempotency_key: string;
  evidence?: Array<{ key: string; value: number }>;
}

export interface InsightAgentActionLog {
  action_type: string;
  result: 'success' | 'failed' | 'skipped';
  reason?: string | null;
  payload: Record<string, unknown>;
}

export interface InsightStatus {
  configured: boolean;
  baseUrl: string | null;
  hasPrimary: boolean;
  hasSecondary: boolean;
  reachable: boolean;
  schemaVersion: number | null;
  error?: string;
}

export class InsightApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly endpoint: string,
    message: string,
    public readonly retryAfterSeconds?: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'InsightApiError';
  }
}

@Injectable()
export class TaskipInsightService {
  private readonly logger = new Logger(TaskipInsightService.name);

  private get baseUrl(): string | null {
    const raw = process.env.INSIGHT_BASE_URL?.trim();
    return raw ? raw.replace(/\/$/, '') : null;
  }

  private get keys(): string[] {
    return [
      process.env.INSIGHT_AGENT_KEY_PRIMARY,
      process.env.INSIGHT_AGENT_KEY_SECONDARY,
    ].filter((k): k is string => typeof k === 'string' && k.length > 0);
  }

  isConfigured(): boolean {
    return !!this.baseUrl && this.keys.length > 0;
  }

  async getOverview(workspaceUuid: string): Promise<InsightWorkspaceOverview> {
    return this.request<InsightWorkspaceOverview>('GET', `/workspaces/${encodeURIComponent(workspaceUuid)}/overview`);
  }

  async listCohort(
    cohort: InsightCohort,
    opts: { perPage?: number; cursor?: string; minScore?: number; updatedAfter?: string } = {},
  ): Promise<InsightCohortListResponse> {
    const qs = new URLSearchParams();
    if (opts.perPage) qs.set('per_page', String(opts.perPage));
    if (opts.cursor) qs.set('cursor', opts.cursor);
    if (typeof opts.minScore === 'number') qs.set('min_score', String(opts.minScore));
    if (opts.updatedAfter) qs.set('updated_after', opts.updatedAfter);
    const path = `/cohorts/${encodeURIComponent(cohort)}/workspaces${qs.toString() ? `?${qs}` : ''}`;
    return this.request<InsightCohortListResponse>('GET', path);
  }

  async getRecommendedActions(workspaceUuid: string): Promise<{ workspace_uuid: string; actions: InsightRecommendedAction[] }> {
    return this.request('GET', `/workspaces/${encodeURIComponent(workspaceUuid)}/recommended-actions`);
  }

  async submitMarketingSuggestion(payload: InsightMarketingSuggestion): Promise<{ id: number; status: string; created_at: string }> {
    return this.request('POST', '/marketing-suggestions', payload);
  }

  async logAgentAction(workspaceUuid: string, payload: InsightAgentActionLog): Promise<{ logged_at: string }> {
    return this.request('POST', `/workspaces/${encodeURIComponent(workspaceUuid)}/agent-actions`, payload);
  }

  async status(probeWorkspaceUuid?: string): Promise<InsightStatus> {
    const status: InsightStatus = {
      configured: this.isConfigured(),
      baseUrl: this.baseUrl,
      hasPrimary: !!process.env.INSIGHT_AGENT_KEY_PRIMARY,
      hasSecondary: !!process.env.INSIGHT_AGENT_KEY_SECONDARY,
      reachable: false,
      schemaVersion: null,
    };
    if (!status.configured) {
      status.error = 'INSIGHT_BASE_URL or INSIGHT_AGENT_KEY_PRIMARY not set';
      return status;
    }
    if (!probeWorkspaceUuid) {
      status.error = 'No probe workspace UUID supplied';
      return status;
    }
    try {
      const { headers } = await this.rawRequest('GET', `/workspaces/${encodeURIComponent(probeWorkspaceUuid)}/overview`);
      status.reachable = true;
      const v = headers.get('x-insight-schema-version');
      status.schemaVersion = v ? Number(v) : null;
    } catch (err) {
      status.error = (err as Error).message;
    }
    return status;
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const { json } = await this.rawRequest(method, path, body);
    if (!json || typeof json !== 'object' || !('data' in (json as object))) {
      throw new InsightApiError(0, path, 'Unexpected response shape', undefined, json);
    }
    return (json as { data: T }).data;
  }

  private async rawRequest(method: 'GET' | 'POST', path: string, body?: unknown): Promise<{ status: number; headers: Headers; json: unknown }> {
    if (!this.baseUrl) {
      throw new InsightApiError(0, path, 'INSIGHT_BASE_URL not configured');
    }
    const keys = this.keys;
    if (keys.length === 0) {
      throw new InsightApiError(0, path, 'No INSIGHT_AGENT_KEY_PRIMARY/SECONDARY configured');
    }

    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const requestId = randomUUID();
    let lastErr: InsightApiError | null = null;

    for (const key of keys) {
      const headers: Record<string, string> = {
        'X-Insight-Agent-Key': key,
        'X-Request-Id': requestId,
        Accept: 'application/json',
      };
      if (body !== undefined) headers['Content-Type'] = 'application/json';

      let res: Response;
      try {
        res = await fetch(url, {
          method,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
      } catch (err) {
        throw new InsightApiError(0, path, `Network error: ${(err as Error).message}`);
      }

      const text = await res.text();
      let json: unknown = null;
      if (text) {
        try { json = JSON.parse(text); } catch { json = text; }
      }

      if (res.status === 401) {
        lastErr = new InsightApiError(401, path, 'Unauthorized — key rejected', undefined, json);
        continue;
      }

      if (!res.ok) {
        const retry = res.headers.get('retry-after');
        throw new InsightApiError(
          res.status,
          path,
          `Insight API ${res.status}: ${typeof json === 'object' && json && 'message' in json ? (json as { message?: string }).message : res.statusText}`,
          retry ? Number(retry) : undefined,
          json,
        );
      }

      return { status: res.status, headers: res.headers, json };
    }

    throw lastErr ?? new InsightApiError(401, path, 'Unauthorized');
  }
}
