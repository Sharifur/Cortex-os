import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SettingsService } from '../../settings/settings.service';

export type InsightCohort =
  | 'serious_trial'
  | 'looking_trial'
  | 'ignore_trial'
  | 'healthy_paid'
  | 'expanding_paid'
  | 'at_risk_paid'
  | 'dormant_paid'
  | 'trial_ready_free'
  | 'nurture_free'
  | 'ignore_free'
  | 'expired_trial_warm'
  | 'expired_trial_cold'
  | 'uncategorized';

export type InsightLifecycleState =
  | 'free'
  | 'trial'
  | 'expired_trial'
  | 'paid'
  | 'churned';

export type InsightScoreType =
  | 'trial_readiness'
  | 'activation'
  | 'activation_frozen'
  | 'customer_health'
  | 'customer_health_frozen';

export interface InsightVolumeMetrics {
  invoices_total?: number;
  invoices_paid?: number;
  contacts_total?: number;
  leads_total?: number;
  projects_total?: number;
  tasks_total?: number;
  support_tickets_total?: number;
  service_orders_total?: number;
  inbox_connected?: boolean;
  [key: string]: number | boolean | string | null | undefined;
}

export interface InsightSessionBlock {
  last_active_at: string | null;
  last_session_duration_seconds?: number | null;
  last_session_ended_at?: string | null;
  is_active_now?: boolean;
  stats_aggregated_at?: string | null;
  [key: string]: number | string | boolean | null | undefined;
}

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
  previous_cohort?: InsightCohort | null;
  score: number | null;
  score_type?: InsightScoreType;
  score_delta_14d?: number | null;
  activation_event_hit?: boolean;
  signals: Array<{ key: string; value: number | string | boolean; threshold?: number }>;
  cohort_assigned_at?: string | null;
  last_seen_at?: string | null;
  recent_activities: Array<{
    activity_type: number;
    module_category: number;
    subject_type: string;
    occurred_at: string;
  }>;
  volume_metrics?: InsightVolumeMetrics;
  session?: InsightSessionBlock;
  evaluated_at: string;
}

export interface InsightLifecycleSnapshot {
  schema_version: number;
  workspace: {
    uuid: string;
    tenant_id?: string;
    name: string;
    lifecycle_state: InsightLifecycleState;
    cohort: InsightCohort | null;
    meta_audience_tier?: string | null;
    trial_started_at?: string | null;
    trial_ends_at?: string | null;
    activated_at?: string | null;
    last_seen_at?: string | null;
    ai_messaging_paused?: boolean;
  };
  owner: {
    first_name: string;
    last_name?: string;
    email: string;
    locale?: string;
    timezone?: string;
    preferences?: {
      ai_messages_enabled?: boolean;
      marketing_emails_enabled?: boolean;
    };
  };
  score: {
    type: InsightScoreType;
    value: number;
    delta_14d?: number;
    signals: Array<{ key: string; value: number | string | boolean }>;
  };
  recent_messages?: Array<{
    scenario_key: string;
    channel: 'email' | 'inapp' | 'both';
    result: string;
    output_subject?: string;
    created_at: string;
  }>;
}

export interface InsightPendingScenarios {
  schema_version: number;
  eligible: Array<{
    scenario_key: string;
    probe_event: string;
    manual_review: boolean;
    spec: {
      trigger: { event: string; condition: string; threshold?: number };
      channel: 'email' | 'inapp' | 'both';
      tone: string;
      prompt: string;
      allowed_vars: string[];
    };
  }>;
  blocked: Array<{ probe_event: string; reason: string }>;
}

export interface InsightAgentMessage {
  id: number;
  scenario_key: string;
  prompt_version: string;
  channel: 'email' | 'inapp' | 'both';
  result: string;
  output_subject?: string;
  output_body_md?: string;
  output_cta_text?: string;
  output_cta_url?: string;
  failure_reason?: string | null;
  email_sent_at?: string | null;
  inapp_sent_at?: string | null;
  created_at: string;
}

export interface InsightSubmitMessage {
  scenario_key: string;
  channel: 'email' | 'inapp' | 'both';
  subject?: string;
  body_md: string;
  cta_text?: string;
  cta_url?: string;
  force_send?: boolean;
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

  constructor(private readonly settings: SettingsService) {}

  private async getBaseUrl(): Promise<string | null> {
    const raw = (await this.settings.getDecrypted('insight_base_url'))?.trim();
    return raw ? raw.replace(/\/$/, '') : null;
  }

  private async getKeys(): Promise<string[]> {
    const [primary, secondary] = await Promise.all([
      this.settings.getDecrypted('insight_agent_key_primary'),
      this.settings.getDecrypted('insight_agent_key_secondary'),
    ]);
    return [primary, secondary].filter((k): k is string => typeof k === 'string' && k.length > 0);
  }

  async isConfigured(): Promise<boolean> {
    const [base, keys] = await Promise.all([this.getBaseUrl(), this.getKeys()]);
    return !!base && keys.length > 0;
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

  async getLifecycle(workspaceUuid: string): Promise<InsightLifecycleSnapshot> {
    return this.request('GET', `/workspaces/${encodeURIComponent(workspaceUuid)}/lifecycle`);
  }

  async getPendingScenarios(workspaceUuid: string): Promise<InsightPendingScenarios> {
    return this.request('GET', `/workspaces/${encodeURIComponent(workspaceUuid)}/scenarios/pending`);
  }

  async getRecentMessages(workspaceUuid: string): Promise<{ schema_version: number; messages: InsightAgentMessage[] }> {
    return this.request('GET', `/workspaces/${encodeURIComponent(workspaceUuid)}/messages`);
  }

  async submitMessage(workspaceUuid: string, payload: InsightSubmitMessage): Promise<{ id: number; status: string; channel: string; inapp_sent_at?: string | null; email_sent_at?: string | null }> {
    return this.request('POST', `/workspaces/${encodeURIComponent(workspaceUuid)}/messages`, payload);
  }

  async status(probeWorkspaceUuid?: string): Promise<InsightStatus> {
    const [base, primary, secondary] = await Promise.all([
      this.getBaseUrl(),
      this.settings.getDecrypted('insight_agent_key_primary'),
      this.settings.getDecrypted('insight_agent_key_secondary'),
    ]);
    const status: InsightStatus = {
      configured: !!base && !!primary,
      baseUrl: base,
      hasPrimary: !!primary,
      hasSecondary: !!secondary,
      reachable: false,
      schemaVersion: null,
    };
    if (!status.configured) {
      status.error = 'Set Insight base URL and primary key in Settings → Insight';
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
    const [base, keys] = await Promise.all([this.getBaseUrl(), this.getKeys()]);
    if (!base) {
      throw new InsightApiError(0, path, 'Insight base URL not configured (Settings → Insight)');
    }
    if (keys.length === 0) {
      throw new InsightApiError(0, path, 'No Insight agent key configured (Settings → Insight)');
    }

    const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
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
