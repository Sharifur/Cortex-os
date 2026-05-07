import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Bot, ArrowLeft, ChevronRight, ChevronDown, Save, Play,
  ToggleLeft, ToggleRight, Settings, List,
  Mail, Cpu, Layers, Info, BookOpen,
  CheckCircle2, Circle, MessageSquare,
  Bug, AlertTriangle, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/authStore';
import { agentColor } from '@/lib/agent-colors';
import { getAgentSuggestions } from '@/lib/agentTaskSuggestions';
import { isGreetingExact } from '@/lib/greetings';

interface AgentDetail {
  id: string;
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  registered: boolean;
  config: Record<string, unknown> | null;
  triggers: { type: string; cron?: string; webhookPath?: string }[];
  mcpTools: { name: string; description: string }[];
  apiRoutes: { method: string; path: string }[];
}

interface Run {
  id: string;
  triggerType: string;
  status: string;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

interface TaskipConfig {
  segments: Record<string, { enabled: boolean; templatePromptId: string }>;
  llm: { provider: string; model: string };
  emailProvider: 'gmail' | 'ses';
  gmail: { from: string };
  ses: { from: string; configurationSet?: string };
  dailyCap: number;
  maxFollowupsPerEmail: number;
}

interface DailyReminderConfig {
  morningCron: string;
  eveningCron: string;
  enableMorning: boolean;
  enableEvening: boolean;
  llm: { provider: string; model: string };
}

const STATUS_CLS: Record<string, string> = {
  PENDING: 'text-muted-foreground bg-muted/50',
  RUNNING: 'text-blue-400 bg-blue-500/10',
  AWAITING_APPROVAL: 'text-yellow-400 bg-yellow-500/10',
  APPROVED: 'text-green-400 bg-green-500/10',
  EXECUTED: 'text-green-500 bg-green-500/10',
  REJECTED: 'text-red-400 bg-red-500/10',
  FAILED: 'text-red-500 bg-red-500/10',
  FOLLOWUP: 'text-purple-400 bg-purple-500/10',
};

const SEGMENT_LABELS: Record<string, string> = {
  trial_day_3: 'Trial Day 3',
  trial_day_5_low_activity: 'Trial Day 5 — Low Activity',
  trial_expiring_24h: 'Trial Expiring (24 h)',
  paid_at_risk: 'Paid At Risk',
  churned_30d: 'Churned 30 Days',
};

const LLM_PROVIDERS = ['openai', 'gemini', 'deepseek', 'auto'];

function relTime(iso: string) {
  const diff = Math.abs(Date.now() - new Date(iso).getTime());
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600_000) {
    const m = Math.floor(diff / 60_000);
    const s = Math.floor((diff % 60_000) / 1000);
    return s > 0 ? `${m}m ${s}s ago` : `${m}m ago`;
  }
  if (diff < 86400_000) {
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    return m > 0 ? `${h}h ${m}m ago` : `${h}h ago`;
  }
  return new Date(iso).toLocaleDateString();
}

function duration(start: string, end: string | null) {
  if (!end) return '—';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

function RunRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5">
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3.5 w-24 rounded" />
          <Skeleton className="h-5 w-20 rounded" />
          <Skeleton className="h-3.5 w-14 rounded" />
        </div>
      </div>
      <div className="text-right shrink-0 space-y-1">
        <Skeleton className="h-3.5 w-16 rounded ml-auto" />
        <Skeleton className="h-3.5 w-10 rounded ml-auto" />
      </div>
      <Skeleton className="w-4 h-4 rounded shrink-0" />
    </div>
  );
}

async function apiFetch(token: string, path: string, opts?: RequestInit) {
  const res = await fetch(path, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...opts?.headers },
  });
  if (!res.ok) throw new Error('Request failed');
  return res.json();
}

function BigToggle({ enabled, onClick, disabled }: { enabled: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
    >
      {enabled
        ? <ToggleRight className="w-11 h-11 text-primary" />
        : <ToggleLeft className="w-11 h-11" />}
    </button>
  );
}

function SaveRow({ isPending, isSuccess, onClick }: { isPending: boolean; isSuccess: boolean; onClick: () => void }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <Button size="sm" onClick={onClick} disabled={isPending}>
        <Save className="w-3.5 h-3.5" />
        {isPending ? 'Saving…' : 'Save'}
      </Button>
      {isSuccess && <span className="text-xs text-green-500">Saved</span>}
    </div>
  );
}

// ─── Runs tab ────────────────────────────────────────────────────────────────

const LOG_LEVEL_CFG = {
  DEBUG: { icon: <Bug className="w-3.5 h-3.5" />, cls: 'text-muted-foreground bg-muted/50' },
  INFO: { icon: <Info className="w-3.5 h-3.5" />, cls: 'text-blue-400 bg-blue-500/10' },
  WARN: { icon: <AlertTriangle className="w-3.5 h-3.5" />, cls: 'text-yellow-400 bg-yellow-500/10' },
  ERROR: { icon: <AlertCircle className="w-3.5 h-3.5" />, cls: 'text-red-400 bg-red-500/10' },
} as const;

interface RunLog {
  id: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

function RunRowExpanded({ runId, token }: { runId: string; token: string }) {
  const { data } = useQuery<{ logs: RunLog[]; finished: boolean }>({
    queryKey: ['run-logs', runId],
    queryFn: async () => {
      const res = await fetch(`/runs/${runId}/logs`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    refetchInterval: (q) => (q.state.data?.finished ? false : 2000),
  });

  const logs = data?.logs ?? [];

  if (logs.length === 0) {
    return (
      <div className="px-5 pb-3 pt-1 text-xs text-muted-foreground">
        {data ? 'No log entries for this run.' : 'Loading logs…'}
      </div>
    );
  }

  return (
    <div className="bg-muted/20 border-t border-border divide-y divide-border/50 max-h-72 overflow-auto">
      {logs.map((entry) => {
        const lvl = LOG_LEVEL_CFG[entry.level] ?? LOG_LEVEL_CFG.INFO;
        return (
          <div key={entry.id} className="flex items-start gap-2.5 px-5 py-2">
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono font-medium shrink-0 mt-0.5 ${lvl.cls}`}>
              {lvl.icon}
              {entry.level}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground/90 break-words">{entry.message}</p>
              {entry.meta && Object.keys(entry.meta).length > 0 && (
                <pre className="mt-1 text-[10px] text-muted-foreground bg-muted/40 rounded px-2 py-1 overflow-x-auto">
                  {JSON.stringify(entry.meta, null, 2)}
                </pre>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground font-mono shrink-0 mt-0.5">
              {new Date(entry.createdAt).toLocaleTimeString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface PendingApproval {
  id: string;
  runId: string;
  agentKey: string;
  action: { type: string; summary: string };
  status: string;
}

function RunsTab({ agentKey, token }: { agentKey: string; token: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const qc = useQueryClient();

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const { data: runs, isLoading, isError } = useQuery<Run[]>({
    queryKey: ['agent-runs', agentKey],
    queryFn: async () => {
      const res = await fetch(`/agents/${agentKey}/runs?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    refetchInterval: 10_000,
  });

  const { data: allApprovals } = useQuery<PendingApproval[]>({
    queryKey: ['pending-approvals'],
    queryFn: () => apiFetch(token, '/approvals'),
    refetchInterval: 10_000,
  });

  const approveMutation = useMutation({
    mutationFn: (approvalId: string) =>
      apiFetch(token, `/approvals/${approvalId}/approve`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-approvals'] });
      qc.invalidateQueries({ queryKey: ['agent-runs', agentKey] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (approvalId: string) =>
      apiFetch(token, `/approvals/${approvalId}/reject`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-approvals'] });
      qc.invalidateQueries({ queryKey: ['agent-runs', agentKey] });
    },
  });

  const approvalsByRunId = (allApprovals ?? [])
    .filter((a) => a.agentKey === agentKey)
    .reduce<Record<string, PendingApproval[]>>((acc, a) => {
      (acc[a.runId] ??= []).push(a);
      return acc;
    }, {});

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="divide-y divide-border">
          {Array.from({ length: 6 }).map((_, i) => <RunRowSkeleton key={i} />)}
        </div>
      </div>
    );
  }
  if (isError && !runs) return <p className="text-sm text-destructive">Failed to load runs.</p>;
  if (!runs?.length) {
    return (
      <div className="rounded-xl border border-border bg-card">
        <div className="p-10 text-center">
          <p className="text-sm text-muted-foreground">No runs yet for this agent.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="divide-y divide-border">
        {runs.map((run) => {
          const isExpanded = expandedId === run.id;
          const runApprovals = approvalsByRunId[run.id] ?? [];
          return (
            <div key={run.id}>
              <div className="flex items-start sm:items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 sm:py-3.5 hover:bg-accent/30 transition-colors">
                {/* Expand toggle + run info */}
                <button
                  onClick={() => toggleExpand(run.id)}
                  className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 text-left"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <code className="text-xs font-mono text-muted-foreground">{run.id.slice(0, 12)}</code>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_CLS[run.status] ?? 'text-muted-foreground'}`}>
                        {run.status}
                      </span>
                      <span className="text-xs text-muted-foreground">{run.triggerType}</span>
                    </div>
                    {run.error && <p className="text-xs text-destructive truncate">{run.error}</p>}
                    {/* Approve/Reject per pending approval for AWAITING_APPROVAL runs */}
                    {run.status === 'AWAITING_APPROVAL' && runApprovals.length > 0 && (
                      <div className="mt-2 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                        {runApprovals.map((approval) => (
                          <div key={approval.id} className="flex items-center gap-2 flex-wrap rounded-lg bg-yellow-500/5 border border-yellow-500/20 px-2.5 py-1.5">
                            <span className="text-[11px] text-muted-foreground flex-1 min-w-0 truncate" title={approval.action.summary}>
                              {approval.action.summary}
                            </span>
                            <div className="flex gap-1.5 shrink-0">
                              <button
                                onClick={() => approveMutation.mutate(approval.id)}
                                disabled={approveMutation.isPending || rejectMutation.isPending}
                                className="text-xs px-2.5 py-0.5 rounded bg-green-500/15 text-green-500 hover:bg-green-500/25 transition-colors border border-green-500/30 disabled:opacity-50 font-medium"
                              >
                                {approveMutation.isPending ? '…' : 'Approve'}
                              </button>
                              <button
                                onClick={() => rejectMutation.mutate(approval.id)}
                                disabled={approveMutation.isPending || rejectMutation.isPending}
                                className="text-xs px-2.5 py-0.5 rounded bg-red-500/15 text-red-500 hover:bg-red-500/25 transition-colors border border-red-500/30 disabled:opacity-50 font-medium"
                              >
                                {rejectMutation.isPending ? '…' : 'Reject'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </button>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">{relTime(run.startedAt)}</p>
                  <p className="text-xs text-muted-foreground">{duration(run.startedAt, run.finishedAt)}</p>
                </div>
                <Link
                  to={`/runs/${run.id}`}
                  className="text-xs text-muted-foreground hover:text-foreground shrink-0 px-1.5 py-1 rounded hover:bg-accent"
                  title="Open full run page"
                  onClick={(e) => e.stopPropagation()}
                >
                  Full log
                </Link>
              </div>
              {isExpanded && <RunRowExpanded runId={run.id} token={token} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Settings sub-tabs ───────────────────────────────────────────────────────

const SETTINGS_TABS = [
  { key: 'setup', label: 'Setup', icon: BookOpen },
  { key: 'general', label: 'General', icon: Settings },
  { key: 'segments', label: 'Segments', icon: Layers },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'llm', label: 'LLM', icon: Cpu },
  { key: 'runtime', label: 'Runtime', icon: Info },
] as const;

type SettingsTabKey = typeof SETTINGS_TABS[number]['key'];

function GeneralSubTab({
  agent, config, onChange, token,
}: {
  agent: AgentDetail;
  config: TaskipConfig;
  onChange: (patch: Partial<TaskipConfig>) => void;
  token: string;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description ?? '');

  const metaMutation = useMutation({
    mutationFn: () =>
      apiFetch(token, `/agents/${agent.key}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, description }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent', agent.key] }),
  });

  const toggleMutation = useMutation({
    mutationFn: () =>
      apiFetch(token, `/agents/${agent.key}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !agent.enabled }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent', agent.key] }),
  });

  const configMutation = useMutation({
    mutationFn: (c: TaskipConfig) =>
      apiFetch(token, `/agents/${agent.key}`, {
        method: 'PATCH',
        body: JSON.stringify({ config: c }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent', agent.key] }),
  });

  const triggerMutation = useMutation({
    mutationFn: () =>
      apiFetch(token, `/agents/${agent.key}/trigger`, {
        method: 'POST',
        body: JSON.stringify({ triggerType: 'MANUAL' }),
      }),
    onSuccess: (run: { id: string }) => navigate(`/runs/${run.id}`),
  });

  return (
    <div className="space-y-6">
      {/* Agent meta */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-4">Agent Info</h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Description</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} className="text-sm" />
          </div>
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-medium">Enabled</p>
              <p className="text-xs text-muted-foreground">Allow this agent to run on schedule</p>
            </div>
            <BigToggle enabled={agent.enabled} onClick={() => toggleMutation.mutate()} disabled={toggleMutation.isPending} />
          </div>
          <SaveRow isPending={metaMutation.isPending} isSuccess={metaMutation.isSuccess} onClick={() => metaMutation.mutate()} />
        </div>
      </div>

      {/* Caps */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-4">Rate Limits</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Daily email cap</label>
            <Input
              type="number"
              min={1}
              value={config.dailyCap}
              onChange={(e) => onChange({ dailyCap: parseInt(e.target.value) || 1 })}
              className="text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Max follow-ups per run</label>
            <Input
              type="number"
              min={1}
              max={10}
              value={config.maxFollowupsPerEmail}
              onChange={(e) => onChange({ maxFollowupsPerEmail: parseInt(e.target.value) || 1 })}
              className="text-sm"
            />
          </div>
        </div>
        <SaveRow
          isPending={configMutation.isPending}
          isSuccess={configMutation.isSuccess}
          onClick={() => configMutation.mutate(config)}
        />
      </div>

      {/* Manual trigger */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-1">Manual Trigger</h3>
        <p className="text-xs text-muted-foreground mb-3">Start a run now, bypassing the schedule.</p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => triggerMutation.mutate()}
          disabled={!agent.enabled || !agent.registered || triggerMutation.isPending}
          className="gap-1.5"
        >
          <Play className="w-3.5 h-3.5" />
          {triggerMutation.isPending ? 'Starting…' : 'Run now'}
        </Button>
        {!agent.registered && (
          <p className="text-xs text-yellow-500 mt-2">Agent is not registered in the runtime.</p>
        )}
      </div>
    </div>
  );
}

function SegmentsSubTab({
  agent, config, onChange, token,
}: {
  agent: AgentDetail;
  config: TaskipConfig;
  onChange: (patch: Partial<TaskipConfig>) => void;
  token: string;
}) {
  const qc = useQueryClient();

  const configMutation = useMutation({
    mutationFn: (c: TaskipConfig) =>
      apiFetch(token, `/agents/${agent.key}`, {
        method: 'PATCH',
        body: JSON.stringify({ config: c }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent', agent.key] }),
  });

  function toggleSegment(key: string) {
    const current = config.segments[key];
    onChange({
      segments: {
        ...config.segments,
        [key]: { ...current, enabled: !current.enabled },
      },
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold mb-1">Email Segments</h3>
      <p className="text-xs text-muted-foreground mb-4">Enable or disable each outreach segment.</p>
      <div className="space-y-0 divide-y divide-border">
        {Object.entries(config.segments).map(([key, seg]) => (
          <div key={key} className="flex items-center justify-between py-3.5">
            <div>
              <p className="text-sm font-medium">{SEGMENT_LABELS[key] ?? key}</p>
              <code className="text-xs text-muted-foreground font-mono">{key}</code>
            </div>
            <BigToggle enabled={seg.enabled} onClick={() => toggleSegment(key)} />
          </div>
        ))}
      </div>
      <SaveRow
        isPending={configMutation.isPending}
        isSuccess={configMutation.isSuccess}
        onClick={() => configMutation.mutate(config)}
      />
    </div>
  );
}

function EmailSubTab({
  agent, config, onChange, token,
}: {
  agent: AgentDetail;
  config: TaskipConfig;
  onChange: (patch: Partial<TaskipConfig>) => void;
  token: string;
}) {
  const qc = useQueryClient();

  const configMutation = useMutation({
    mutationFn: (c: TaskipConfig) =>
      apiFetch(token, `/agents/${agent.key}`, {
        method: 'PATCH',
        body: JSON.stringify({ config: c }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent', agent.key] }),
  });

  return (
    <div className="space-y-6">
      {/* Provider selector */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-4">Email Provider</h3>
        <div className="flex gap-2">
          {(['gmail', 'ses'] as const).map((p) => (
            <button
              key={p}
              onClick={() => onChange({ emailProvider: p })}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                config.emailProvider === p
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
              }`}
            >
              {p === 'gmail' ? 'Gmail' : 'AWS SES'}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {config.emailProvider === 'gmail'
            ? 'Uses Gmail OAuth2 credentials set in Settings → Gmail.'
            : 'Uses AWS SES credentials set in Settings → Email (SES).'}
        </p>
      </div>

      {/* Gmail from */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-4">Gmail Settings</h3>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">From address</label>
          <Input
            value={config.gmail?.from ?? ''}
            onChange={(e) => onChange({ gmail: { ...config.gmail, from: e.target.value } })}
            placeholder="Name <email@domain.com>"
            className="text-sm"
          />
        </div>
      </div>

      {/* SES settings */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-4">SES Settings</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">From address</label>
            <Input
              value={config.ses?.from ?? ''}
              onChange={(e) => onChange({ ses: { ...config.ses, from: e.target.value } })}
              placeholder="Name <email@domain.com>"
              className="text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Configuration set</label>
            <Input
              value={config.ses?.configurationSet ?? ''}
              onChange={(e) => onChange({ ses: { ...config.ses, configurationSet: e.target.value } })}
              placeholder="ses-monitoring"
              className="text-sm"
            />
          </div>
        </div>
      </div>

      <SaveRow
        isPending={configMutation.isPending}
        isSuccess={configMutation.isSuccess}
        onClick={() => configMutation.mutate(config)}
      />
    </div>
  );
}

function LlmSubTab({
  agent, config, onChange, token,
}: {
  agent: AgentDetail;
  config: TaskipConfig;
  onChange: (patch: Partial<TaskipConfig>) => void;
  token: string;
}) {
  const qc = useQueryClient();

  const configMutation = useMutation({
    mutationFn: (c: TaskipConfig) =>
      apiFetch(token, `/agents/${agent.key}`, {
        method: 'PATCH',
        body: JSON.stringify({ config: c }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent', agent.key] }),
  });

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold mb-4">LLM Configuration</h3>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-muted-foreground block mb-2">Provider</label>
          <div className="flex flex-wrap gap-2">
            {LLM_PROVIDERS.map((p) => (
              <button
                key={p}
                onClick={() => onChange({ llm: { ...config.llm, provider: p } })}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  config.llm?.provider === p
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
                }`}
              >
                {p === 'auto' ? 'Auto (fallback chain)' : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Model</label>
          <Input
            value={config.llm?.model ?? ''}
            onChange={(e) => onChange({ llm: { ...config.llm, model: e.target.value } })}
            placeholder="gpt-4o-mini"
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground mt-1">
            e.g. gpt-4o-mini, gpt-4o, gemini-1.5-flash, deepseek-chat
          </p>
        </div>
      </div>
      <SaveRow
        isPending={configMutation.isPending}
        isSuccess={configMutation.isSuccess}
        onClick={() => configMutation.mutate(config)}
      />
    </div>
  );
}

function SetupStep({
  n, title, done, children,
}: { n: number; title: string; done?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 mt-0.5">
        {done
          ? <CheckCircle2 className="w-5 h-5 text-green-500" />
          : <Circle className="w-5 h-5 text-muted-foreground/40" />}
      </div>
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-semibold text-muted-foreground">Step {n}</span>
          <p className="text-sm font-medium">{title}</p>
        </div>
        <div className="text-xs text-muted-foreground space-y-1">{children}</div>
      </div>
    </div>
  );
}

function SetupSubTab({ agent, config }: { agent: AgentDetail; config: TaskipConfig }) {
  const hasLlm = false;
  const hasEmail = config.emailProvider === 'gmail' || config.emailProvider === 'ses';
  const isRegistered = agent.registered;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-1">Trial Email Agent — Setup Checklist</h3>
        <p className="text-xs text-muted-foreground mb-5">
          Complete all steps before running this agent in production.
        </p>
        <div className="space-y-5">

          <SetupStep n={1} title="Connect email provider" done={hasEmail}>
            <p>Choose <strong>Gmail</strong> or <strong>AWS SES</strong> in the Email sub-tab above.</p>
            <p className="font-medium text-foreground/70 mt-1">Gmail (recommended — better inbox delivery):</p>
            <ol className="list-decimal list-inside space-y-0.5 ml-1">
              <li>Create OAuth2 credentials in Google Cloud Console</li>
              <li>Enable Gmail API on the project</li>
              <li>Use OAuth Playground to get a refresh token (scope: <code className="bg-muted px-1 rounded">https://mail.google.com/</code>)</li>
              <li>Paste Client ID, Secret, Refresh Token → <strong>Settings → Gmail</strong></li>
            </ol>
            <p className="font-medium text-foreground/70 mt-2">AWS SES:</p>
            <ol className="list-decimal list-inside space-y-0.5 ml-1">
              <li>Create IAM user with <code className="bg-muted px-1 rounded">ses:SendEmail</code> permission</li>
              <li>Verify your sending domain in SES</li>
              <li>Paste Access Key, Secret, Region → <strong>Settings → Email (SES)</strong></li>
            </ol>
          </SetupStep>

          <SetupStep n={2} title="Configure segments and limits" done={isRegistered}>
            <p>Use the <strong>Segments</strong> sub-tab to enable the email sequences you want.</p>
            <p>Set daily cap and follow-up limit in <strong>General</strong>.</p>
          </SetupStep>

          <SetupStep n={3} title="Test with a manual run" done={false}>
            <p>Click <strong>Run now</strong> in the General tab. A Telegram message will arrive asking for approval.</p>
            <p>Approve one email, check that it lands in the inbox, then enable the daily schedule.</p>
          </SetupStep>

        </div>
      </div>

      {/* SES webhook reminder */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
        <p className="text-xs font-medium text-amber-500 mb-1">SES users: wire up bounce handling</p>
        <p className="text-xs text-muted-foreground">
          Go to <strong>Settings → Email (SES)</strong> to find your SNS webhook URL.
          Subscribe your SES Configuration Set SNS topic to it so bounces and complaints are automatically suppressed.
        </p>
      </div>
    </div>
  );
}

function RuntimeSubTab({ agent }: { agent: AgentDetail }) {
  const hasContent = agent.triggers.length > 0 || agent.apiRoutes.length > 0 || agent.mcpTools.length > 0;
  if (!hasContent) {
    return <p className="text-sm text-muted-foreground">No runtime info available.</p>;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-5">
      {agent.triggers.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Triggers</p>
          <div className="flex flex-wrap gap-2">
            {agent.triggers.map((t, i) => (
              <span key={i} className="text-xs bg-muted px-2 py-1 rounded font-mono">
                {t.type}{t.cron ? ` (${t.cron})` : ''}{t.webhookPath ? ` ${t.webhookPath}` : ''}
              </span>
            ))}
          </div>
        </div>
      )}
      {agent.apiRoutes.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">API Routes</p>
          <div className="flex flex-wrap gap-2">
            {agent.apiRoutes.map((r, i) => (
              <span key={i} className="text-xs bg-muted px-2 py-1 rounded font-mono">
                {r.method} {r.path}
              </span>
            ))}
          </div>
        </div>
      )}
      {agent.mcpTools.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">MCP Tools</p>
          <div className="flex flex-wrap gap-2">
            {agent.mcpTools.map((t) => (
              <span key={t.name} className="text-xs bg-muted px-2 py-1 rounded font-mono" title={t.description}>
                {t.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Daily Reminder sub-tabs ─────────────────────────────────────────────────

const DAILY_REMINDER_TABS = [
  { key: 'setup', label: 'Setup', icon: BookOpen },
  { key: 'general', label: 'General', icon: Settings },
  { key: 'schedule', label: 'Schedule', icon: Info },
  { key: 'llm', label: 'LLM', icon: Cpu },
  { key: 'runtime', label: 'Runtime', icon: List },
] as const;

type DailyReminderTabKey = typeof DAILY_REMINDER_TABS[number]['key'];

function DailyReminderSetupSubTab({ agent }: { agent: AgentDetail }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-1">Daily Reminder — Setup Checklist</h3>
        <p className="text-xs text-muted-foreground mb-5">
          This agent sends a morning brief and evening recap to Telegram. It has no external API dependencies beyond
          what you already have configured.
        </p>
        <div className="space-y-5">

          <SetupStep n={1} title="Set your timezone schedule" done={false}>
            <p>
              Default schedule: <strong>08:30 Dhaka (02:30 UTC)</strong> for morning, <strong>21:00 Dhaka (15:00 UTC)</strong> for evening.
            </p>
            <p className="mt-1">Adjust the cron expressions in the <strong>Schedule</strong> sub-tab if needed.</p>
            <p className="mt-1 font-medium text-foreground/70">Cron format: <code className="bg-muted px-1 rounded">MINUTE HOUR * * *</code> (UTC)</p>
          </SetupStep>

          <SetupStep n={2} title="Enable the agent and test" done={agent.enabled}>
            <p>Toggle the agent <strong>Enabled</strong> in the General tab, then click <strong>Run now</strong>.</p>
            <p className="mt-1">You should receive a Telegram message within a few seconds.</p>
          </SetupStep>

        </div>
      </div>
    </div>
  );
}

function DailyReminderGeneralSubTab({
  agent, token,
}: {
  agent: AgentDetail;
  token: string;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description ?? '');

  const metaMutation = useMutation({
    mutationFn: () =>
      apiFetch(token, `/agents/${agent.key}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, description }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent', agent.key] }),
  });

  const toggleMutation = useMutation({
    mutationFn: () =>
      apiFetch(token, `/agents/${agent.key}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !agent.enabled }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent', agent.key] }),
  });

  const triggerMutation = useMutation({
    mutationFn: () =>
      apiFetch(token, `/agents/${agent.key}/trigger`, {
        method: 'POST',
        body: JSON.stringify({ triggerType: 'MANUAL' }),
      }),
    onSuccess: (run: { id: string }) => navigate(`/runs/${run.id}`),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-4">Agent Info</h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Description</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} className="text-sm" />
          </div>
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-medium">Enabled</p>
              <p className="text-xs text-muted-foreground">Allow this agent to run on schedule</p>
            </div>
            <BigToggle enabled={agent.enabled} onClick={() => toggleMutation.mutate()} disabled={toggleMutation.isPending} />
          </div>
          <SaveRow isPending={metaMutation.isPending} isSuccess={metaMutation.isSuccess} onClick={() => metaMutation.mutate()} />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-1">Manual Trigger</h3>
        <p className="text-xs text-muted-foreground mb-3">Send a brief now, bypassing the schedule.</p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => triggerMutation.mutate()}
          disabled={!agent.enabled || !agent.registered || triggerMutation.isPending}
          className="gap-1.5"
        >
          <Play className="w-3.5 h-3.5" />
          {triggerMutation.isPending ? 'Starting…' : 'Send brief now'}
        </Button>
        {!agent.registered && (
          <p className="text-xs text-yellow-500 mt-2">Agent is not registered in the runtime.</p>
        )}
      </div>
    </div>
  );
}

function DailyReminderScheduleSubTab({
  agent, config, onChange, token,
}: {
  agent: AgentDetail;
  config: DailyReminderConfig;
  onChange: (patch: Partial<DailyReminderConfig>) => void;
  token: string;
}) {
  const qc = useQueryClient();

  const configMutation = useMutation({
    mutationFn: (c: DailyReminderConfig) =>
      apiFetch(token, `/agents/${agent.key}`, {
        method: 'PATCH',
        body: JSON.stringify({ config: c }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent', agent.key] }),
  });

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold mb-1">Schedule</h3>
      <p className="text-xs text-muted-foreground mb-5">
        Cron expressions run in <strong>UTC</strong>. Default timezone offset for Dhaka (UTC+6): morning 02:30 UTC = 08:30, evening 15:00 UTC = 21:00.
      </p>
      <div className="space-y-5 divide-y divide-border">
        <div className="pb-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium">Morning Brief</p>
              <p className="text-xs text-muted-foreground">Sent at the start of your day</p>
            </div>
            <BigToggle
              enabled={config.enableMorning}
              onClick={() => onChange({ enableMorning: !config.enableMorning })}
            />
          </div>
          <label className="text-xs text-muted-foreground block mb-1">Cron expression (UTC)</label>
          <Input
            value={config.morningCron}
            onChange={(e) => onChange({ morningCron: e.target.value })}
            placeholder="30 2 * * *"
            className="text-sm font-mono"
          />
        </div>

        <div className="pt-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium">Evening Recap</p>
              <p className="text-xs text-muted-foreground">Sent at the end of your day</p>
            </div>
            <BigToggle
              enabled={config.enableEvening}
              onClick={() => onChange({ enableEvening: !config.enableEvening })}
            />
          </div>
          <label className="text-xs text-muted-foreground block mb-1">Cron expression (UTC)</label>
          <Input
            value={config.eveningCron}
            onChange={(e) => onChange({ eveningCron: e.target.value })}
            placeholder="0 15 * * *"
            className="text-sm font-mono"
          />
        </div>
      </div>
      <SaveRow
        isPending={configMutation.isPending}
        isSuccess={configMutation.isSuccess}
        onClick={() => configMutation.mutate(config)}
      />
    </div>
  );
}

function DailyReminderLlmSubTab({
  agent, config, onChange, token,
}: {
  agent: AgentDetail;
  config: DailyReminderConfig;
  onChange: (patch: Partial<DailyReminderConfig>) => void;
  token: string;
}) {
  const qc = useQueryClient();

  const configMutation = useMutation({
    mutationFn: (c: DailyReminderConfig) =>
      apiFetch(token, `/agents/${agent.key}`, {
        method: 'PATCH',
        body: JSON.stringify({ config: c }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent', agent.key] }),
  });

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold mb-4">LLM Configuration</h3>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-muted-foreground block mb-2">Provider</label>
          <div className="flex flex-wrap gap-2">
            {LLM_PROVIDERS.map((p) => (
              <button
                key={p}
                onClick={() => onChange({ llm: { ...config.llm, provider: p } })}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  config.llm?.provider === p
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
                }`}
              >
                {p === 'auto' ? 'Auto (fallback chain)' : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Model</label>
          <Input
            value={config.llm?.model ?? ''}
            onChange={(e) => onChange({ llm: { ...config.llm, model: e.target.value } })}
            placeholder="gpt-4o-mini"
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground mt-1">
            e.g. gpt-4o-mini, gpt-4o, gemini-1.5-flash, deepseek-chat
          </p>
        </div>
      </div>
      <SaveRow
        isPending={configMutation.isPending}
        isSuccess={configMutation.isSuccess}
        onClick={() => configMutation.mutate(config)}
      />
    </div>
  );
}

function DailyReminderSettingsTab({ agent, token }: { agent: AgentDetail; token: string }) {
  const [activeSub, setActiveSub] = useState<DailyReminderTabKey>('setup');
  const [config, setConfig] = useState<DailyReminderConfig>(
    (agent.config as unknown as DailyReminderConfig) ?? {
      morningCron: '30 2 * * *',
      eveningCron: '0 15 * * *',
      enableMorning: true,
      enableEvening: true,
      llm: { provider: 'auto', model: 'gpt-4o-mini' },
    }
  );

  function handleChange(patch: Partial<DailyReminderConfig>) {
    setConfig((prev) => ({ ...prev, ...patch }));
  }

  return (
    <div>
      <div className="flex items-center gap-1 border border-border rounded-lg p-1 mb-5 bg-muted/30 w-fit">
        {DAILY_REMINDER_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveSub(key)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeSub === key
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {activeSub === 'setup' && <DailyReminderSetupSubTab agent={agent} />}
      {activeSub === 'general' && <DailyReminderGeneralSubTab agent={agent} token={token} />}
      {activeSub === 'schedule' && (
        <DailyReminderScheduleSubTab agent={agent} config={config} onChange={handleChange} token={token} />
      )}
      {activeSub === 'llm' && (
        <DailyReminderLlmSubTab agent={agent} config={config} onChange={handleChange} token={token} />
      )}
      {activeSub === 'runtime' && <RuntimeSubTab agent={agent} />}
    </div>
  );
}

// ─── Email Manager sub-tabs ───────────────────────────────────────────────────

const EMAIL_MANAGER_TABS = [
  { key: 'setup', label: 'Setup', icon: BookOpen },
  { key: 'general', label: 'General', icon: Settings },
  { key: 'filters', label: 'Filters', icon: Layers },
  { key: 'llm', label: 'LLM', icon: Cpu },
  { key: 'runtime', label: 'Runtime', icon: List },
] as const;

type EmailManagerTabKey = typeof EMAIL_MANAGER_TABS[number]['key'];

interface EmailManagerConfig {
  maxEmailsPerRun: number;
  importantSenders: string[];
  autoArchiveDomains: string[];
  llm: { provider: string; model: string };
}

function EmailManagerSetupSubTab({ agent }: { agent: AgentDetail }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-1">Email Manager — Setup Checklist</h3>
        <p className="text-xs text-muted-foreground mb-5">
          This agent polls your Gmail inbox every 30 minutes, classifies emails, auto-archives newsletters, and
          drafts replies for important contacts — waiting for your approval before sending.
        </p>
        <div className="space-y-5">

          <SetupStep n={1} title="Connect Gmail OAuth2" done={agent.registered}>
            <p>The agent reads and sends mail via your Gmail account using OAuth2.</p>
            <ol className="list-decimal list-inside space-y-0.5 ml-1 mt-1">
              <li>Go to <strong>Google Cloud Console</strong> → create a project → enable <strong>Gmail API</strong></li>
              <li>Create <strong>OAuth 2.0 credentials</strong> (Web application type)</li>
              <li>Open <strong>OAuth Playground</strong>, authorise scope: <code className="bg-muted px-1 rounded">https://mail.google.com/</code></li>
              <li>Exchange auth code → copy the <strong>Refresh Token</strong></li>
              <li>Paste Client ID, Client Secret, Refresh Token → <strong>Settings → Gmail</strong></li>
            </ol>
          </SetupStep>

          <SetupStep n={2} title="Set filters" done={false}>
            <p>In the <strong>Filters</strong> tab, add:</p>
            <ul className="list-disc list-inside space-y-0.5 ml-1 mt-1">
              <li><strong>Important senders</strong> — email addresses always classified as must-reply</li>
              <li><strong>Auto-archive domains</strong> — e.g. <code className="bg-muted px-1 rounded">substack.com</code>, <code className="bg-muted px-1 rounded">mailchimp.com</code></li>
            </ul>
          </SetupStep>

          <SetupStep n={3} title="Enable and run a test" done={agent.enabled}>
            <p>Enable the agent in <strong>General</strong>, then click <strong>Run now</strong>.</p>
            <p className="mt-1">The agent will classify your current unread emails. You'll get Telegram notifications for nice-to-reply emails and approval requests for must-reply emails with drafted responses.</p>
          </SetupStep>

        </div>
      </div>
    </div>
  );
}

function EmailManagerGeneralSubTab({ agent, config, onChange, token }: {
  agent: AgentDetail;
  config: EmailManagerConfig;
  onChange: (patch: Partial<EmailManagerConfig>) => void;
  token: string;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description ?? '');

  const metaMutation = useMutation({
    mutationFn: () =>
      apiFetch(token, `/agents/${agent.key}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, description }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent', agent.key] }),
  });

  const toggleMutation = useMutation({
    mutationFn: () =>
      apiFetch(token, `/agents/${agent.key}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !agent.enabled }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent', agent.key] }),
  });

  const configMutation = useMutation({
    mutationFn: (c: EmailManagerConfig) =>
      apiFetch(token, `/agents/${agent.key}`, {
        method: 'PATCH',
        body: JSON.stringify({ config: c }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent', agent.key] }),
  });

  const triggerMutation = useMutation({
    mutationFn: () =>
      apiFetch(token, `/agents/${agent.key}/trigger`, {
        method: 'POST',
        body: JSON.stringify({ triggerType: 'MANUAL' }),
      }),
    onSuccess: (run: { id: string }) => navigate(`/runs/${run.id}`),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-4">Agent Info</h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Description</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} className="text-sm" />
          </div>
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-medium">Enabled</p>
              <p className="text-xs text-muted-foreground">Poll Gmail every 30 minutes</p>
            </div>
            <BigToggle enabled={agent.enabled} onClick={() => toggleMutation.mutate()} disabled={toggleMutation.isPending} />
          </div>
          <SaveRow isPending={metaMutation.isPending} isSuccess={metaMutation.isSuccess} onClick={() => metaMutation.mutate()} />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-4">Limits</h3>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Max emails per run</label>
          <Input
            type="number"
            min={1}
            max={100}
            value={config.maxEmailsPerRun}
            onChange={(e) => onChange({ maxEmailsPerRun: parseInt(e.target.value) || 20 })}
            className="text-sm w-32"
          />
          <p className="text-xs text-muted-foreground mt-1">Emails fetched from unread inbox per CRON tick.</p>
        </div>
        <SaveRow
          isPending={configMutation.isPending}
          isSuccess={configMutation.isSuccess}
          onClick={() => configMutation.mutate(config)}
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-1">Manual Trigger</h3>
        <p className="text-xs text-muted-foreground mb-3">Run a poll cycle now.</p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => triggerMutation.mutate()}
          disabled={!agent.enabled || !agent.registered || triggerMutation.isPending}
          className="gap-1.5"
        >
          <Play className="w-3.5 h-3.5" />
          {triggerMutation.isPending ? 'Starting…' : 'Run now'}
        </Button>
        {!agent.registered && (
          <p className="text-xs text-yellow-500 mt-2">Agent is not registered in the runtime.</p>
        )}
      </div>
    </div>
  );
}

function EmailManagerFiltersSubTab({ agent, config, onChange, token }: {
  agent: AgentDetail;
  config: EmailManagerConfig;
  onChange: (patch: Partial<EmailManagerConfig>) => void;
  token: string;
}) {
  const qc = useQueryClient();
  const [senderInput, setSenderInput] = useState('');
  const [domainInput, setDomainInput] = useState('');

  const configMutation = useMutation({
    mutationFn: (c: EmailManagerConfig) =>
      apiFetch(token, `/agents/${agent.key}`, {
        method: 'PATCH',
        body: JSON.stringify({ config: c }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent', agent.key] }),
  });

  function addSender() {
    const val = senderInput.trim().toLowerCase();
    if (!val || config.importantSenders.includes(val)) return;
    onChange({ importantSenders: [...config.importantSenders, val] });
    setSenderInput('');
  }

  function removeSender(s: string) {
    onChange({ importantSenders: config.importantSenders.filter((x) => x !== s) });
  }

  function addDomain() {
    const val = domainInput.trim().toLowerCase();
    if (!val || config.autoArchiveDomains.includes(val)) return;
    onChange({ autoArchiveDomains: [...config.autoArchiveDomains, val] });
    setDomainInput('');
  }

  function removeDomain(d: string) {
    onChange({ autoArchiveDomains: config.autoArchiveDomains.filter((x) => x !== d) });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-1">Important Senders</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Emails from these addresses (or partial matches) are always classified as <strong>must-reply</strong> and get a drafted response.
        </p>
        <div className="flex gap-2 mb-3">
          <Input
            value={senderInput}
            onChange={(e) => setSenderInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addSender()}
            placeholder="someone@company.com or @company.com"
            className="text-sm"
          />
          <Button size="sm" variant="outline" onClick={addSender}>Add</Button>
        </div>
        {config.importantSenders.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {config.importantSenders.map((s) => (
              <span key={s} className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                {s}
                <button onClick={() => removeSender(s)} className="hover:text-destructive ml-0.5">×</button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">No important senders configured.</p>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-1">Auto-archive Domains</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Emails from these domains are automatically archived without LLM classification.
          Good for newsletters, SaaS updates, and bulk senders.
        </p>
        <div className="flex gap-2 mb-3">
          <Input
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addDomain()}
            placeholder="substack.com"
            className="text-sm"
          />
          <Button size="sm" variant="outline" onClick={addDomain}>Add</Button>
        </div>
        {config.autoArchiveDomains.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {config.autoArchiveDomains.map((d) => (
              <span key={d} className="flex items-center gap-1 text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">
                {d}
                <button onClick={() => removeDomain(d)} className="hover:text-destructive ml-0.5">×</button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">No auto-archive domains configured.</p>
        )}
      </div>

      <SaveRow
        isPending={configMutation.isPending}
        isSuccess={configMutation.isSuccess}
        onClick={() => configMutation.mutate(config)}
      />
    </div>
  );
}

function EmailManagerLlmSubTab({ agent, config, onChange, token }: {
  agent: AgentDetail;
  config: EmailManagerConfig;
  onChange: (patch: Partial<EmailManagerConfig>) => void;
  token: string;
}) {
  const qc = useQueryClient();

  const configMutation = useMutation({
    mutationFn: (c: EmailManagerConfig) =>
      apiFetch(token, `/agents/${agent.key}`, {
        method: 'PATCH',
        body: JSON.stringify({ config: c }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent', agent.key] }),
  });

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold mb-4">LLM Configuration</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Used for email classification (~20 tokens each) and reply drafting (~300 tokens each).
        A cheap model like <code className="bg-muted px-1 rounded">gpt-4o-mini</code> is recommended.
      </p>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-muted-foreground block mb-2">Provider</label>
          <div className="flex flex-wrap gap-2">
            {LLM_PROVIDERS.map((p) => (
              <button
                key={p}
                onClick={() => onChange({ llm: { ...config.llm, provider: p } })}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  config.llm?.provider === p
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
                }`}
              >
                {p === 'auto' ? 'Auto (fallback chain)' : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Model</label>
          <Input
            value={config.llm?.model ?? ''}
            onChange={(e) => onChange({ llm: { ...config.llm, model: e.target.value } })}
            placeholder="gpt-4o-mini"
            className="text-sm"
          />
        </div>
      </div>
      <SaveRow
        isPending={configMutation.isPending}
        isSuccess={configMutation.isSuccess}
        onClick={() => configMutation.mutate(config)}
      />
    </div>
  );
}

function EmailManagerSettingsTab({ agent, token }: { agent: AgentDetail; token: string }) {
  const [activeSub, setActiveSub] = useState<EmailManagerTabKey>('setup');
  const [config, setConfig] = useState<EmailManagerConfig>(
    (agent.config as unknown as EmailManagerConfig) ?? {
      maxEmailsPerRun: 20,
      importantSenders: [],
      autoArchiveDomains: [],
      llm: { provider: 'auto', model: 'gpt-4o-mini' },
    }
  );

  function handleChange(patch: Partial<EmailManagerConfig>) {
    setConfig((prev) => ({ ...prev, ...patch }));
  }

  return (
    <div>
      <div className="flex items-center gap-1 border border-border rounded-lg p-1 mb-5 bg-muted/30 w-fit">
        {EMAIL_MANAGER_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveSub(key)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeSub === key
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {activeSub === 'setup' && <EmailManagerSetupSubTab agent={agent} />}
      {activeSub === 'general' && (
        <EmailManagerGeneralSubTab agent={agent} config={config} onChange={handleChange} token={token} />
      )}
      {activeSub === 'filters' && (
        <EmailManagerFiltersSubTab agent={agent} config={config} onChange={handleChange} token={token} />
      )}
      {activeSub === 'llm' && (
        <EmailManagerLlmSubTab agent={agent} config={config} onChange={handleChange} token={token} />
      )}
      {activeSub === 'runtime' && <RuntimeSubTab agent={agent} />}
    </div>
  );
}

// ─── Taskip Internal sub-tabs ─────────────────────────────────────────────────

const TASKIP_INTERNAL_TABS = [
  { key: 'setup', label: 'Setup', icon: BookOpen },
  { key: 'llm', label: 'LLM', icon: Cpu },
  { key: 'runtime', label: 'Runtime', icon: List },
] as const;

type TaskipInternalTabKey = typeof TASKIP_INTERNAL_TABS[number]['key'];

interface TaskipInternalConfig {
  llm: { provider: string; model: string };
}

function TaskipInternalSetupSubTab({ agent }: { agent: AgentDetail }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-1">Taskip Internal — Setup Checklist</h3>
        <p className="text-xs text-muted-foreground mb-5">
          On-demand assistant for internal Taskip ops. Ask in plain English — it looks up users, subscriptions,
          and invoices, then proposes write actions (extend trial, mark refund, marketing suggestion) for your Telegram approval.
        </p>
        <div className="space-y-5">

          <SetupStep n={1} title="Test with the Chat page" done={agent.enabled}>
            <p>Open the <strong>Chat</strong> page for this agent and type a question, for example:</p>
            <ul className="list-disc list-inside ml-1 mt-1 space-y-0.5">
              <li><em>Look up user john@example.com</em></li>
              <li><em>Show me the last 5 invoices for user abc-123</em></li>
              <li><em>List at_risk_paid workspaces with score below 40</em></li>
              <li><em>Drill into workspace acme and propose a retention outreach</em></li>
            </ul>
            <p className="mt-1">The agent will query the DB / Insight API and send the answer (or an approval request) to Telegram.</p>
          </SetupStep>

        </div>
      </div>

      <TaskipInsightStatusCard />

      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <p className="text-xs font-medium text-muted-foreground mb-1">Platform prerequisites</p>
        <p className="text-xs text-muted-foreground">
          Requires <code className="bg-muted px-1 rounded">TASKIP_DB_URL_READONLY</code> in Coolify env (shared with all Taskip agents).
          Configure the Insight API credentials in <a href="/integrations" className="text-primary hover:underline">Integrations → Taskip Insight</a>.
          LLM provider must be <strong>OpenAI</strong> or <strong>DeepSeek</strong> — set in <strong>Settings → LLM Providers</strong> and the LLM sub-tab (Gemini does not support tool calling).
        </p>
      </div>
    </div>
  );
}

function TaskipInsightStatusCard() {
  const token = useAuthStore((s) => s.token);
  const [probeUuid, setProbeUuid] = useState('');
  const [status, setStatus] = useState<{
    configured: boolean;
    baseUrl: string | null;
    hasPrimary: boolean;
    hasSecondary: boolean;
    reachable: boolean;
    schemaVersion: number | null;
    error?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  async function check() {
    if (!token) return;
    setLoading(true);
    try {
      const qs = probeUuid ? `?workspaceUuid=${encodeURIComponent(probeUuid)}` : '';
      const res = await apiFetch(token, `/taskip-internal/insight/status${qs}`);
      setStatus(res as never);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold mb-1">Insight API connection</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Server-to-server integration with Taskip's Insight module (cohort segmentation, workspace overview, marketing-suggestion writeback).
        Secrets are read from environment variables — values are never returned, only their presence.
      </p>

      <div className="grid grid-cols-2 gap-2 text-xs mb-4">
        <Indicator label="INSIGHT_BASE_URL" on={!!status?.baseUrl} value={status?.baseUrl ?? undefined} />
        <Indicator label="Key — primary" on={!!status?.hasPrimary} />
        <Indicator label="Key — secondary (rotation)" on={!!status?.hasSecondary} optional />
        <Indicator label="Schema version" on={status?.schemaVersion === 1} value={status?.schemaVersion?.toString()} />
      </div>

      <div className="flex gap-2 items-center">
        <Input
          value={probeUuid}
          onChange={(e) => setProbeUuid(e.target.value)}
          placeholder="Sample workspace UUID (optional, e.g. acme)"
          className="text-xs"
        />
        <Button size="sm" onClick={check} disabled={loading || !token}>
          {loading ? 'Checking…' : 'Test connection'}
        </Button>
      </div>

      {status?.error && (
        <p className="text-xs text-destructive mt-3">{status.error}</p>
      )}
      {status?.reachable && (
        <p className="text-xs text-emerald-500 mt-3">
          Reachable. Schema version: {status.schemaVersion ?? 'unknown'}.
        </p>
      )}
    </div>
  );
}

function Indicator({ label, on, value, optional }: { label: string; on: boolean; value?: string; optional?: boolean }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/20">
      <span className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-emerald-400' : optional ? 'bg-slate-500' : 'bg-rose-400'}`}></span>
      <span className="text-muted-foreground">{label}</span>
      {value && <span className="ml-auto font-mono text-[11px] text-foreground/80 truncate max-w-[140px]">{value}</span>}
    </div>
  );
}

function TaskipInternalAskSubTab({ agent, config, token }: {
  agent: AgentDetail;
  config: TaskipInternalConfig;
  token: string;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [greetingNotice, setGreetingNotice] = useState<string | null>(null);

  const triggerMutation = useMutation({
    mutationFn: () =>
      apiFetch(token, `/agents/${agent.key}/trigger`, {
        method: 'POST',
        body: JSON.stringify({ triggerType: 'MANUAL', payload: { query } }),
      }),
    onSuccess: (run: { id: string }) => navigate(`/runs/${run.id}`),
  });

  function runQuery() {
    const q = query.trim();
    if (!q) return;
    if (isGreetingExact(q)) {
      setGreetingNotice(`That looks like a greeting — ask a specific question (e.g. "Look up user john@example.com") so ${agent.name} can do something useful.`);
      return;
    }
    setGreetingNotice(null);
    triggerMutation.mutate();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-1">Ask Taskip Internal</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Ask in plain English. The agent will query the Taskip DB using tools and send the answer to Telegram.
          Write operations (extend trial, mark refund) require your Telegram approval first.
        </p>
        <div className="space-y-3">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Examples:\n• Look up user john@example.com\n• Show invoices for user abc-123\n• Extend the trial for john@example.com by 7 days\n• Mark invoice inv-456 for user abc-123 as refund`}
            rows={5}
            className="w-full font-mono text-sm bg-muted/40 border border-border rounded-lg p-3 resize-none focus:outline-none focus:ring-1 focus:ring-ring text-foreground placeholder:text-muted-foreground/50"
          />
          <Button
            size="sm"
            onClick={runQuery}
            disabled={!query.trim() || !agent.enabled || !agent.registered || triggerMutation.isPending}
            className="gap-1.5"
          >
            <Play className="w-3.5 h-3.5" />
            {triggerMutation.isPending ? 'Starting…' : 'Run query'}
          </Button>
          {greetingNotice && (
            <p className="text-xs text-amber-500">{greetingNotice}</p>
          )}
          {!agent.registered && (
            <p className="text-xs text-yellow-500">Agent is not registered in the runtime.</p>
          )}
          {triggerMutation.isError && (
            <p className="text-xs text-destructive">Failed to start run. Is the API server running?</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-3">Quick queries</h3>
        <div className="flex flex-wrap gap-2">
          {getAgentSuggestions('taskip_internal').map((q) => (
            <button
              key={q}
              onClick={() => setQuery(q)}
              className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TaskipInternalLlmSubTab({ agent, config, onChange, token }: {
  agent: AgentDetail;
  config: TaskipInternalConfig;
  onChange: (patch: Partial<TaskipInternalConfig>) => void;
  token: string;
}) {
  const qc = useQueryClient();

  const configMutation = useMutation({
    mutationFn: (c: TaskipInternalConfig) =>
      apiFetch(token, `/agents/${agent.key}`, {
        method: 'PATCH',
        body: JSON.stringify({ config: c }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent', agent.key] }),
  });

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold mb-2">LLM Configuration</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Only <strong>OpenAI</strong> and <strong>DeepSeek</strong> support tool calling. Gemini is not supported for this agent.
        Use <code className="bg-muted px-1 rounded">gpt-4o</code> for best accuracy.
      </p>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-muted-foreground block mb-2">Provider</label>
          <div className="flex gap-2">
            {(['openai', 'deepseek'] as const).map((p) => (
              <button
                key={p}
                onClick={() => onChange({ llm: { ...config.llm, provider: p } })}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  config.llm?.provider === p
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Model</label>
          <Input
            value={config.llm?.model ?? ''}
            onChange={(e) => onChange({ llm: { ...config.llm, model: e.target.value } })}
            placeholder="gpt-4o"
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Recommended: <code className="bg-muted px-1 rounded">gpt-4o</code> or <code className="bg-muted px-1 rounded">deepseek-chat</code>
          </p>
        </div>
      </div>
      <SaveRow
        isPending={configMutation.isPending}
        isSuccess={configMutation.isSuccess}
        onClick={() => configMutation.mutate(config)}
      />
    </div>
  );
}

function TaskipInternalSettingsTab({ agent, token }: { agent: AgentDetail; token: string }) {
  const [activeSub, setActiveSub] = useState<TaskipInternalTabKey>('setup');
  const [config, setConfig] = useState<TaskipInternalConfig>(
    (agent.config as unknown as TaskipInternalConfig) ?? {
      llm: { provider: 'openai', model: 'gpt-4o' },
    }
  );

  function handleChange(patch: Partial<TaskipInternalConfig>) {
    setConfig((prev) => ({ ...prev, ...patch }));
  }

  return (
    <div>
      <div className="flex items-center gap-1 border border-border rounded-lg p-1 mb-5 bg-muted/30 w-fit">
        {TASKIP_INTERNAL_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveSub(key)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeSub === key
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {activeSub === 'setup' && <TaskipInternalSetupSubTab agent={agent} />}
      {activeSub === 'llm' && (
        <TaskipInternalLlmSubTab agent={agent} config={config} onChange={handleChange} token={token} />
      )}
      {activeSub === 'runtime' && <RuntimeSubTab agent={agent} />}
    </div>
  );
}

// ─── Settings tab (orchestrator) ─────────────────────────────────────────────

function SettingsTab({ agent, token }: { agent: AgentDetail; token: string }) {
  const [activeSub, setActiveSub] = useState<SettingsTabKey>('setup');
  const [config, setConfig] = useState<TaskipConfig>(
    (agent.config as unknown as TaskipConfig) ?? {
      segments: {},
      llm: { provider: 'openai', model: 'gpt-4o-mini' },
      emailProvider: 'gmail',
      gmail: { from: '' },
      ses: { from: '', configurationSet: '' },
      dailyCap: 50,
      maxFollowupsPerEmail: 5,
    }
  );

  function handleChange(patch: Partial<TaskipConfig>) {
    setConfig((prev) => ({ ...prev, ...patch }));
  }

  const isTaskipTrial = agent.key === 'taskip_trial';
  const isDailyReminder = agent.key === 'daily_reminder';
  const isEmailManager = agent.key === 'email_manager';

  if (isDailyReminder) return <DailyReminderSettingsTab agent={agent} token={token} />;
  if (isEmailManager) return <EmailManagerSettingsTab agent={agent} token={token} />;
  if (agent.key === 'taskip_internal') return <TaskipInternalSettingsTab agent={agent} token={token} />;

  if (agent.key === 'livechat') return (
    <Phase4SettingsTab agent={agent} token={token} setupContent={
      <LivechatSetupSubTab agent={agent} />
    } />
  );

  if (agent.key === 'support') return (
    <Phase4SettingsTab agent={agent} token={token} setupContent={
      <SupportSetupSubTab agent={agent} token={token} />
    } />
  );

  if (agent.key === 'whatsapp') return (
    <Phase4SettingsTab agent={agent} token={token} setupContent={
      <Phase4SetupSubTab
        agent={agent}
        title="WhatsApp Business Watcher — Setup Checklist"
        description="Monitors WhatsApp Business messages. Classifies urgency, sends Telegram alerts for important messages, and drafts replies — requiring approval before sending."
        steps={<>
          <SetupStep n={1} title="Connect WhatsApp Business Cloud API" done={agent.registered}>
            <p>In Meta for Developers, create an app and enable WhatsApp Business.</p>
            <ol className="list-decimal list-inside space-y-0.5 ml-1 mt-1">
              <li>Get your <strong>Phone Number ID</strong> and <strong>Permanent Access Token</strong></li>
              <li>Set webhook URL to <code className="bg-muted px-1 rounded">/whatsapp/webhook</code></li>
              <li>Add to Coolify env: <code className="bg-muted px-1 rounded">WHATSAPP_API_TOKEN</code>, <code className="bg-muted px-1 rounded">WHATSAPP_PHONE_NUMBER_ID</code>, <code className="bg-muted px-1 rounded">WHATSAPP_VERIFY_TOKEN</code></li>
            </ol>
          </SetupStep>
          <SetupStep n={2} title="Configure offline hours" done={false}>
            <p>In Config JSON set <code className="bg-muted px-1 rounded">offlineStart</code>, <code className="bg-muted px-1 rounded">offlineEnd</code> (24h format, UTC+6) and <code className="bg-muted px-1 rounded">holdingMessage</code>.</p>
            <p className="mt-1">Default: offline 21:00–10:00 Dhaka time.</p>
          </SetupStep>
          <SetupStep n={3} title="Enable and test" done={agent.enabled}>
            <p>Send a message to your WhatsApp Business number. A Telegram alert should arrive within 10 minutes (CRON sweep).</p>
          </SetupStep>
        </>}
      />
    } />
  );

  if (agent.key === 'linkedin') return (
    <Phase4SettingsTab agent={agent} token={token} setupContent={
      <Phase4SetupSubTab
        agent={agent}
        title="LinkedIn AI Agent — Setup Checklist"
        description="Scans your LinkedIn feed every 4 hours, drafts comments on relevant posts, and prepares outreach DMs — all requiring your approval before posting."
        steps={<>
          <SetupStep n={1} title="Connect LinkedIn via Unipile (recommended)" done={agent.registered}>
            <p>Unipile provides a unified API for LinkedIn actions without needing direct OAuth approval.</p>
            <ol className="list-decimal list-inside space-y-0.5 ml-1 mt-1">
              <li>Sign up at <strong>unipile.com</strong> and connect your LinkedIn account</li>
              <li>Get your API Key and DSN from the dashboard</li>
              <li>Add to Coolify: <code className="bg-muted px-1 rounded">UNIPILE_API_KEY</code>, <code className="bg-muted px-1 rounded">UNIPILE_DSN</code></li>
            </ol>
            <p className="mt-2 font-medium text-foreground/70">Alternative — LinkedIn OAuth2 directly:</p>
            <p className="mt-0.5">Set <code className="bg-muted px-1 rounded">LINKEDIN_ACCESS_TOKEN</code> in Coolify env (requires LinkedIn Developer App with r_liteprofile + w_member_social scopes).</p>
          </SetupStep>
          <SetupStep n={2} title="Set target topics and tone" done={false}>
            <p>In Config JSON set <code className="bg-muted px-1 rounded">targetTopics</code> (array of keywords to match posts) and <code className="bg-muted px-1 rounded">commentTone</code>.</p>
          </SetupStep>
          <SetupStep n={3} title="Enable and test" done={agent.enabled}>
            <p>Enable and trigger manually. The agent will draft comments for relevant posts and send them to Telegram for approval.</p>
          </SetupStep>
        </>}
      />
    } />
  );

  if (agent.key === 'reddit') return (
    <Phase4SettingsTab agent={agent} token={token} setupContent={
      <Phase4SetupSubTab
        agent={agent}
        title="Reddit Followup Agent — Setup Checklist"
        description="Searches Reddit every 2 hours for keyword mentions. Drafts genuine, non-spammy comments and sends them to Telegram for approval before posting."
        steps={<>
          <SetupStep n={1} title="Connect Reddit API" done={agent.registered}>
            <ol className="list-decimal list-inside space-y-0.5 ml-1">
              <li>Go to <strong>reddit.com/prefs/apps</strong> → Create app (script type)</li>
              <li>Copy Client ID (under app name) and Client Secret</li>
              <li>In <strong>Integrations → Reddit</strong> add your credentials</li>
            </ol>
          </SetupStep>
          <SetupStep n={2} title="Set tracked keywords" done={false}>
            <p>In Config JSON set <code className="bg-muted px-1 rounded">defaultKeywords</code> array. Or use the API route <code className="bg-muted px-1 rounded">POST /reddit/track-keyword</code> to add keywords per-subreddit.</p>
          </SetupStep>
          <SetupStep n={3} title="Enable and test" done={agent.enabled}>
            <p>Enable and trigger manually. The agent will search Reddit and draft comments — you'll approve each one via Telegram before it posts.</p>
          </SetupStep>
        </>}
      />
    } />
  );

  if (agent.key === 'hr') return (
    <Phase4SettingsTab agent={agent} token={token} setupContent={
      <HrSetupSubTab agent={agent} token={token} />
    } />
  );

  if (agent.key === 'social') return (
    <Phase4SettingsTab agent={agent} token={token} setupContent={
      <Phase4SetupSubTab
        agent={agent}
        title="Social Media Handler — Setup Checklist"
        description="Publishes scheduled posts and drafts replies to comments/DMs across FB, IG, X, and LinkedIn for Taskip and Xgenious."
        steps={<>
          <SetupStep n={1} title="Schedule posts" done={agent.registered}>
            <p>Use <code className="bg-muted px-1 rounded">POST /social/schedule</code> to queue posts:</p>
            <code className="bg-muted px-1.5 py-0.5 rounded block mt-1 text-xs">
              {"{ brand, platform, postBody, mediaUrls, scheduledFor }"}
            </code>
            <p className="mt-1">The agent publishes due posts on each hourly sweep.</p>
          </SetupStep>
          <SetupStep n={2} title="Push incoming engagements" done={false}>
            <p>POST comments/DMs to <code className="bg-muted px-1 rounded">POST /social/engagement</code> from your social platform webhooks.</p>
            <p className="mt-1">The agent drafts replies every 30 minutes and sends them to Telegram for approval.</p>
          </SetupStep>
          <SetupStep n={3} title="Enable and test" done={agent.enabled}>
            <p>Enable and schedule a test post. Trigger manually to see the agent pick it up and request Telegram approval.</p>
          </SetupStep>
        </>}
      />
    } />
  );

  if (agent.key === 'canva') return <CanvaAgentPage agent={agent} token={token} />;

  if (agent.key === 'shorts') return <ShortsSettingsTab agent={agent} token={token} />;

  return (
    <div>
      {isTaskipTrial ? (
        <>
          {/* Settings sub-tab bar */}
          <div className="flex items-center gap-1 border border-border rounded-lg p-1 mb-5 bg-muted/30 w-fit">
            {SETTINGS_TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveSub(key)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeSub === key
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          {activeSub === 'setup' && <SetupSubTab agent={agent} config={config} />}
          {activeSub === 'general' && (
            <GeneralSubTab agent={agent} config={config} onChange={handleChange} token={token} />
          )}
          {activeSub === 'segments' && (
            <SegmentsSubTab agent={agent} config={config} onChange={handleChange} token={token} />
          )}
          {activeSub === 'email' && (
            <EmailSubTab agent={agent} config={config} onChange={handleChange} token={token} />
          )}
          {activeSub === 'llm' && (
            <LlmSubTab agent={agent} config={config} onChange={handleChange} token={token} />
          )}
          {activeSub === 'runtime' && <RuntimeSubTab agent={agent} />}
        </>
      ) : (
        /* Generic JSON editor for other agents */
        <GenericConfigEditor agent={agent} token={token} />
      )}
    </div>
  );
}

// LLM override card shared by every agent's settings editor. When the toggle
// is off, config.llm is dropped on save and the agent uses the global default
// from Settings → LLM.
function LlmOverrideCard({
  initialLlm,
  overrideLlm,
  setOverrideLlm,
  llmProvider,
  setLlmProvider,
  llmModel,
  setLlmModel,
}: {
  initialLlm?: { provider?: string; model?: string };
  overrideLlm: boolean;
  setOverrideLlm: (v: boolean) => void;
  llmProvider: string;
  setLlmProvider: (v: string) => void;
  llmModel: string;
  setLlmModel: (v: string) => void;
}) {
  void initialLlm;
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold">LLM</h3>
        <BigToggle enabled={overrideLlm} onClick={() => setOverrideLlm(!overrideLlm)} />
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        {overrideLlm
          ? 'Overriding the global LLM defaults for this agent only.'
          : 'Using the global default provider and model from Settings → LLM.'}
      </p>
      {overrideLlm && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Provider</label>
            <select
              value={llmProvider}
              onChange={(e) => setLlmProvider(e.target.value)}
              className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="auto">auto (router fallback)</option>
              <option value="openai">openai</option>
              <option value="gemini">gemini</option>
              <option value="deepseek">deepseek</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Model (blank = provider default)</label>
            <Input value={llmModel} onChange={(e) => setLlmModel(e.target.value)} placeholder="e.g. gpt-4o-mini" className="text-sm" />
          </div>
        </div>
      )}
    </div>
  );
}

function stripLlm<T extends Record<string, unknown>>(cfg: T): { rest: Record<string, unknown>; llm?: { provider?: string; model?: string } } {
  if (!cfg || typeof cfg !== 'object') return { rest: {} };
  const { llm, ...rest } = cfg as { llm?: { provider?: string; model?: string } };
  return { rest, llm };
}

function GenericConfigEditor({ agent, token }: { agent: AgentDetail; token: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const initialCfg = (agent.config ?? {}) as Record<string, unknown>;
  const { rest: initialRest, llm: initialLlm } = stripLlm(initialCfg);
  const [configText, setConfigText] = useState(JSON.stringify(initialRest, null, 2));
  const [configError, setConfigError] = useState<string | null>(null);
  const [overrideLlm, setOverrideLlm] = useState(!!(initialLlm && (initialLlm.provider || initialLlm.model)));
  const [llmProvider, setLlmProvider] = useState(initialLlm?.provider ?? 'auto');
  const [llmModel, setLlmModel] = useState(initialLlm?.model ?? '');

  const configMutation = useMutation({
    mutationFn: (config: Record<string, unknown>) =>
      apiFetch(token, `/agents/${agent.key}`, {
        method: 'PATCH',
        body: JSON.stringify({ config }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent', agent.key] }),
  });

  const triggerMutation = useMutation({
    mutationFn: () =>
      apiFetch(token, `/agents/${agent.key}/trigger`, {
        method: 'POST',
        body: JSON.stringify({ triggerType: 'MANUAL' }),
      }),
    onSuccess: (run: { id: string }) => navigate(`/runs/${run.id}`),
  });

  function handleSave() {
    try {
      const parsed = JSON.parse(configText) as Record<string, unknown>;
      delete (parsed as { llm?: unknown }).llm;
      const merged: Record<string, unknown> = { ...parsed };
      if (overrideLlm && (llmProvider || llmModel)) {
        merged.llm = {
          ...(llmProvider ? { provider: llmProvider } : {}),
          ...(llmModel.trim() ? { model: llmModel.trim() } : {}),
        };
      }
      setConfigError(null);
      configMutation.mutate(merged);
    } catch {
      setConfigError('Invalid JSON — fix the syntax before saving.');
    }
  }

  return (
    <div className="space-y-5">
      <LlmOverrideCard
        initialLlm={initialLlm}
        overrideLlm={overrideLlm}
        setOverrideLlm={setOverrideLlm}
        llmProvider={llmProvider}
        setLlmProvider={setLlmProvider}
        llmModel={llmModel}
        setLlmModel={setLlmModel}
      />
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Other config (JSON)</h3>
          <Button size="sm" onClick={handleSave} disabled={configMutation.isPending}>
            <Save className="w-3.5 h-3.5" />
            {configMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          The <code className="bg-muted px-1 rounded">llm</code> key is managed by the toggle above and ignored here.
        </p>
        {configError && <p className="text-xs text-destructive mb-2">{configError}</p>}
        {configMutation.isSuccess && !configError && <p className="text-xs text-green-500 mb-2">Saved</p>}
        <textarea
          value={configText}
          onChange={(e) => { setConfigText(e.target.value); setConfigError(null); }}
          spellCheck={false}
          className="w-full h-72 font-mono text-xs bg-muted/40 border border-border rounded-lg p-3 resize-none focus:outline-none focus:ring-1 focus:ring-ring text-foreground"
        />
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-1">Manual Trigger</h3>
        <p className="text-xs text-muted-foreground mb-3">Start a run now, bypassing the schedule.</p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => triggerMutation.mutate()}
          disabled={!agent.enabled || !agent.registered || triggerMutation.isPending}
          className="gap-1.5"
        >
          <Play className="w-3.5 h-3.5" />
          {triggerMutation.isPending ? 'Starting…' : 'Run now'}
        </Button>
      </div>
    </div>
  );
}

// ─── Phase 4 Setup sub-tabs (Setup + General + Runtime) ─────────────────────

const PHASE4_TABS = [
  { key: 'setup', label: 'Setup', icon: BookOpen },
  { key: 'general', label: 'General', icon: Settings },
  { key: 'runtime', label: 'Runtime', icon: List },
] as const;
type Phase4TabKey = typeof PHASE4_TABS[number]['key'];

function Phase4SetupSubTab({ agent, title, description, steps }: {
  agent: AgentDetail;
  title: string;
  description: string;
  steps: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground mb-5">{description}</p>
      <div className="space-y-5">{steps}</div>
    </div>
  );
}

function LivechatSetupSubTab({ agent }: { agent: AgentDetail }) {
  return (
    <Phase4SetupSubTab
      agent={agent}
      title="Live Chat Agent — Setup Checklist"
      description="Deploys an AI-powered chat widget on your website. The agent handles visitor questions, escalates to human when needed, and learns from your knowledge base."
      steps={<>
        <SetupStep n={1} title="Add a site and install the widget" done={agent.registered}>
          <p>Go to <a href="/livechat" className="text-primary hover:underline font-medium">Live Chat → Sites</a> and click <strong>New site</strong>.</p>
          <ol className="list-decimal list-inside space-y-0.5 ml-1 mt-1">
            <li>Enter a label, your site's origin (e.g. <code className="bg-muted px-1 rounded">https://yoursite.com</code>), and a brand color</li>
            <li>Save — the install snippet appears automatically</li>
            <li>Paste the <code className="bg-muted px-1 rounded">&lt;script&gt;</code> tag into your site's <code className="bg-muted px-1 rounded">&lt;head&gt;</code> or footer</li>
          </ol>
        </SetupStep>
        <SetupStep n={2} title="Configure the bot persona" done={false}>
          <p>In <a href="/livechat" className="text-primary hover:underline font-medium">Live Chat → Sites</a>, edit your site and set:</p>
          <ul className="list-disc list-inside space-y-0.5 ml-1 mt-1">
            <li><strong>Bot name</strong> — what visitors see as the agent's display name</li>
            <li><strong>Product context</strong> — one-paragraph description of what you sell</li>
            <li><strong>Reply tone</strong> — the voice the agent should use (e.g. "friendly and direct")</li>
            <li><strong>Welcome message</strong> — first message shown when a visitor opens the widget</li>
          </ul>
        </SetupStep>
        <SetupStep n={3} title="Add knowledge base content" done={false}>
          <p>Go to <a href="/knowledge-base" className="text-primary hover:underline font-medium">Knowledge Base</a> and add entries tagged for the <code className="bg-muted px-1 rounded">livechat</code> agent:</p>
          <ul className="list-disc list-inside space-y-0.5 ml-1 mt-1">
            <li><strong>Facts</strong> — pricing, features, policies, FAQs</li>
            <li><strong>Writing samples</strong> — example replies to use as the voice reference</li>
            <li><strong>Prompt templates</strong> — override the default system prompt if needed</li>
          </ul>
        </SetupStep>
        <SetupStep n={4} title="Enable and test" done={agent.enabled}>
          <p>Enable this agent and open your site in a browser. Send a test message in the chat widget — the agent should reply within 2 seconds.</p>
          <p className="mt-1">Check <a href="/livechat" className="text-primary hover:underline font-medium">Live Chat → Conversations</a> to see the session and take over if needed.</p>
        </SetupStep>
      </>}
    />
  );
}

function SupportSetupSubTab({ agent, token }: { agent: AgentDetail; token: string }) {
  const qc = useQueryClient();

  const { data: settings = [] } = useQuery<{ key: string; value: string | null; stored: boolean }[]>({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/settings', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed');
      const all: { key: string; value: string | null; stored: boolean }[] = await res.json();
      return all.filter((s) => s.key.startsWith('support_'));
    },
    staleTime: 30_000,
    select: (all) => all.filter((s) => s.key.startsWith('support_')),
  });

  const getSetting = (key: string) => settings.find((s) => s.key === key);

  const saveSetting = async (key: string, value: string) => {
    await fetch(`/settings/${key}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    });
    qc.invalidateQueries({ queryKey: ['settings'] });
  };

  const webhookUrl = `${window.location.origin}/support/ingest-ticket`;
  const [copied, setCopied] = useState(false);

  function copyWebhookUrl() {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-5">
      <div>
        <h3 className="text-sm font-semibold mb-1">Support Ticket Manager — Setup</h3>
        <p className="text-xs text-muted-foreground">Connects to crm.xgenious.com via webhook. When a new ticket arrives, the AI drafts a reply and sends it to Telegram for approval — then posts it back to the CRM automatically.</p>
      </div>

      <div className="rounded-lg bg-muted/40 border border-border px-4 py-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Prerequisites</p>
        <p>Telegram bot and owner chat ID must be configured in Settings (platform-wide). The CRM API key is issued from <span className="font-mono">crm.xgenious.com → Settings → Public API</span>.</p>
      </div>

      <SetupStep n={1} title="Configure CRM API credentials" done={getSetting('support_crm_base_url')?.stored === true && getSetting('support_crm_api_key')?.stored === true}>
        <div className="space-y-3">
          <HrmSettingField
            label="CRM Base URL"
            settingKey="support_crm_base_url"
            placeholder="https://crm.xgenious.com"
            token={token}
            onSave={saveSetting}
            stored={getSetting('support_crm_base_url')?.stored}
          />
          <HrmSettingField
            label="CRM API Key"
            settingKey="support_crm_api_key"
            placeholder="X-Secret-Key value from CRM"
            token={token}
            onSave={saveSetting}
            stored={getSetting('support_crm_api_key')?.stored}
            isSecret
          />
        </div>
      </SetupStep>

      <SetupStep n={2} title="Configure webhook security" done={getSetting('support_webhook_secret')?.stored === true}>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Set a shared secret. Configure crm.xgenious.com to POST to the webhook URL below with the header <code className="bg-muted px-1 rounded">X-Webhook-Secret: &lt;your-secret&gt;</code>.</p>
          <HrmSettingField
            label="Webhook Secret"
            settingKey="support_webhook_secret"
            placeholder="any strong random string"
            token={token}
            onSave={saveSetting}
            stored={getSetting('support_webhook_secret')?.stored}
            isSecret
          />
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Webhook URL (paste into crm.xgenious.com)</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-background border border-border rounded-md px-3 py-2 truncate">{webhookUrl}</code>
              <button
                onClick={copyWebhookUrl}
                className="shrink-0 text-xs px-3 py-2 rounded-md bg-primary text-primary-foreground"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      </SetupStep>

      <SetupStep n={3} title="Set escalation keywords" done={false}>
        <p className="text-xs text-muted-foreground">In the Config JSON tab, set <code className="bg-muted px-1 rounded">escalateKeywords</code> — tickets containing these words are escalated instead of auto-replied. Default: urgent, lawsuit, refund, legal, fraud.</p>
      </SetupStep>

      <SetupStep n={4} title="Enable and test" done={agent.enabled}>
        <p className="text-xs text-muted-foreground">Enable the agent. Send a test webhook from crm.xgenious.com or use curl. A Telegram message should arrive with the drafted reply and Approve / Reject buttons.</p>
      </SetupStep>
    </div>
  );
}

function HrSetupSubTab({ agent, token }: { agent: AgentDetail; token: string }) {
  const qc = useQueryClient();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; employeeCount?: number; error?: string } | null>(null);

  // Fetch current HR settings so we can pre-fill and show current state.
  const { data: settings = [] } = useQuery<{ key: string; value: string | null; stored: boolean }[]>({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/settings', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed');
      const all: { key: string; value: string | null; stored: boolean }[] = await res.json();
      return all.filter((s) => s.key.startsWith('hrm_'));
    },
    staleTime: 30_000,
    select: (all) => all.filter((s) => s.key.startsWith('hrm_')),
  });

  const getSetting = (key: string) => settings.find((s) => s.key === key);

  const saveSetting = async (key: string, value: string) => {
    await fetch(`/settings/${key}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    });
    qc.invalidateQueries({ queryKey: ['settings'] });
  };

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/hr/test-connection', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setTestResult({ ok: false, error: data.error ?? `HTTP ${res.status}` });
      } else {
        setTestResult(data);
      }
    } catch {
      setTestResult({ ok: false, error: 'Network error — could not reach the server' });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-5">
      <div>
        <h3 className="text-sm font-semibold mb-1">HR Manager Agent — Setup</h3>
        <p className="text-xs text-muted-foreground">Connects to XGHRM via its AI Agent API. Sends daily leave/WFH approval requests and runs the monthly payslip flow on a configurable day.</p>
      </div>

      <div className="rounded-lg bg-muted/40 border border-border px-4 py-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Prerequisites</p>
        <p>Telegram bot and owner chat ID must be configured in Settings (platform-wide). The XGHRM secret is issued from <span className="font-mono">XGHRM Admin → AI Applications → Create Application</span> — copy it from the one-time reveal modal (64-character hex string).</p>
      </div>

      {/* T12: Inline API URL + secret fields */}
      <SetupStep n={1} title="Configure XGHRM API credentials" done={getSetting('hrm_api_base_url')?.stored === true && getSetting('hrm_api_secret')?.stored === true}>
        <div className="space-y-3">
          <HrmSettingField
            label="API Base URL"
            settingKey="hrm_api_base_url"
            placeholder="https://xghrm.yourdomain.com/api/ai-agent"
            token={token}
            onSave={saveSetting}
            stored={getSetting('hrm_api_base_url')?.stored}
          />
          <p className="text-[11px] text-muted-foreground">
            Test connection calls: <code className="font-mono">{(getSetting('hrm_api_base_url')?.value as string | null)?.replace(/\/$/, '') ?? 'https://xghrm.yourdomain.com/api/ai-agent'}/employees?active=true</code>
          </p>
          <HrmSettingField
            label="API Secret"
            settingKey="hrm_api_secret"
            placeholder="64-character hex secret"
            token={token}
            onSave={saveSetting}
            stored={getSetting('hrm_api_secret')?.stored}
            isSecret
          />
        </div>
      </SetupStep>

      <SetupStep n={2} title="Set monthly payslip day (1–28)" done={getSetting('hrm_payslip_day')?.stored === true}>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">The daily CRON at 9 AM checks if today matches this day and triggers the payslip run automatically. Default: 25.</p>
          <HrmSettingField
            label="Payslip day"
            settingKey="hrm_payslip_day"
            placeholder="25"
            token={token}
            onSave={saveSetting}
            stored={getSetting('hrm_payslip_day')?.stored}
            inputType="number"
            inputWidth="w-24"
          />
        </div>
      </SetupStep>

      <SetupStep n={3} title="Test the connection" done={testResult?.ok === true}>
        <p className="mb-2 text-xs text-muted-foreground">Verify the API credentials are correct before enabling the agent.</p>
        <button
          onClick={testConnection}
          disabled={testing}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
        >
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
        {testResult && (
          <div className={`mt-2 text-xs px-3 py-2 rounded-md ${testResult.ok ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-red-500/10 text-red-700 dark:text-red-400'}`}>
            {testResult.ok
              ? `Connected — ${testResult.employeeCount} active employee${testResult.employeeCount !== 1 ? 's' : ''} found`
              : `Failed: ${testResult.error}`}
          </div>
        )}
      </SetupStep>

      <SetupStep n={4} title="Enable and run manually" done={agent.enabled}>
        <p className="text-xs text-muted-foreground">Enable the agent from the General tab, then trigger it manually to confirm the daily digest arrives on Telegram. On a real payslip day, trigger manually to test the full approval flow.</p>
      </SetupStep>
    </div>
  );
}

function HrmSettingField({
  label,
  settingKey,
  placeholder,
  token,
  onSave,
  stored,
  isSecret,
  inputType = 'text',
  inputWidth = 'w-full',
}: {
  label: string;
  settingKey: string;
  placeholder: string;
  token: string;
  onSave: (key: string, value: string) => Promise<void>;
  stored?: boolean;
  isSecret?: boolean;
  inputType?: string;
  inputWidth?: string;
}) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (!value.trim()) return;
    setSaving(true);
    try {
      await onSave(settingKey, value.trim());
      setValue('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground block mb-1">
        {label}
        {stored && <span className="ml-2 text-[10px] text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">saved</span>}
      </label>
      <div className="flex items-center gap-2">
        <input
          type={isSecret ? 'password' : inputType}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={stored ? '(already set — paste to update)' : placeholder}
          className={`${inputWidth} text-xs bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary`}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
        />
        <button
          onClick={handleSave}
          disabled={saving || !value.trim()}
          className="shrink-0 text-xs px-3 py-2 rounded-md bg-primary text-primary-foreground disabled:opacity-50"
        >
          {saved ? 'Saved' : saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function Phase4GeneralSubTab({ agent, token }: { agent: AgentDetail; token: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const initialCfg = (agent.config ?? {}) as Record<string, unknown>;
  const { rest: initialRest, llm: initialLlm } = stripLlm(initialCfg);
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description ?? '');
  const [configText, setConfigText] = useState(JSON.stringify(initialRest, null, 2));
  const [configError, setConfigError] = useState<string | null>(null);
  const [overrideLlm, setOverrideLlm] = useState(!!(initialLlm && (initialLlm.provider || initialLlm.model)));
  const [llmProvider, setLlmProvider] = useState(initialLlm?.provider ?? 'auto');
  const [llmModel, setLlmModel] = useState(initialLlm?.model ?? '');

  const metaMutation = useMutation({
    mutationFn: () =>
      apiFetch(token, `/agents/${agent.key}`, { method: 'PATCH', body: JSON.stringify({ name, description }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent', agent.key] }),
  });

  const toggleMutation = useMutation({
    mutationFn: () =>
      apiFetch(token, `/agents/${agent.key}`, { method: 'PATCH', body: JSON.stringify({ enabled: !agent.enabled }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent', agent.key] }),
  });

  const configMutation = useMutation({
    mutationFn: (config: Record<string, unknown>) =>
      apiFetch(token, `/agents/${agent.key}`, { method: 'PATCH', body: JSON.stringify({ config }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent', agent.key] }),
  });

  const triggerMutation = useMutation({
    mutationFn: () =>
      apiFetch(token, `/agents/${agent.key}/trigger`, { method: 'POST', body: JSON.stringify({ triggerType: 'MANUAL' }) }),
    onSuccess: (run: { id: string }) => navigate(`/runs/${run.id}`),
  });

  function handleSaveConfig() {
    try {
      const parsed = JSON.parse(configText) as Record<string, unknown>;
      delete (parsed as { llm?: unknown }).llm;
      const merged: Record<string, unknown> = { ...parsed };
      if (overrideLlm && (llmProvider || llmModel)) {
        merged.llm = {
          ...(llmProvider ? { provider: llmProvider } : {}),
          ...(llmModel.trim() ? { model: llmModel.trim() } : {}),
        };
      }
      setConfigError(null);
      configMutation.mutate(merged);
    } catch {
      setConfigError('Invalid JSON');
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-4">Agent Info</h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Description</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} className="text-sm" />
          </div>
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-medium">Enabled</p>
              <p className="text-xs text-muted-foreground">Allow this agent to run on schedule</p>
            </div>
            <BigToggle enabled={agent.enabled} onClick={() => toggleMutation.mutate()} disabled={toggleMutation.isPending} />
          </div>
          <SaveRow isPending={metaMutation.isPending} isSuccess={metaMutation.isSuccess} onClick={() => metaMutation.mutate()} />
        </div>
      </div>

      <LlmOverrideCard
        initialLlm={initialLlm}
        overrideLlm={overrideLlm}
        setOverrideLlm={setOverrideLlm}
        llmProvider={llmProvider}
        setLlmProvider={setLlmProvider}
        llmModel={llmModel}
        setLlmModel={setLlmModel}
      />

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Other config (JSON)</h3>
          <Button size="sm" onClick={handleSaveConfig} disabled={configMutation.isPending}>
            <Save className="w-3.5 h-3.5" />
            {configMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          The <code className="bg-muted px-1 rounded">llm</code> key is managed by the LLM card above and ignored here.
        </p>
        {configError && <p className="text-xs text-destructive mb-2">{configError}</p>}
        {configMutation.isSuccess && !configError && <p className="text-xs text-green-500 mb-2">Saved</p>}
        <textarea
          value={configText}
          onChange={(e) => { setConfigText(e.target.value); setConfigError(null); }}
          spellCheck={false}
          className="w-full h-48 font-mono text-xs bg-muted/40 border border-border rounded-lg p-3 resize-none focus:outline-none focus:ring-1 focus:ring-ring text-foreground"
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-1">Manual Trigger</h3>
        <p className="text-xs text-muted-foreground mb-3">Start a run now, bypassing the schedule.</p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => triggerMutation.mutate()}
          disabled={!agent.enabled || !agent.registered || triggerMutation.isPending}
          className="gap-1.5"
        >
          <Play className="w-3.5 h-3.5" />
          {triggerMutation.isPending ? 'Starting…' : 'Run now'}
        </Button>
        {!agent.registered && <p className="text-xs text-yellow-500 mt-2">Agent is not registered.</p>}
      </div>
    </div>
  );
}

// ─── Shorts Settings Tab ──────────────────────────────────────────────────────

const SHORTS_SUBTABS = [
  { key: 'setup', label: 'Setup', icon: BookOpen },
  { key: 'general', label: 'General', icon: Settings },
  { key: 'scripts', label: 'Scripts', icon: List },
] as const;
type ShortsSubTabKey = typeof SHORTS_SUBTABS[number]['key'];

function ShortsScriptsSubTab({ token }: { token: string }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [canvaInputs, setCanvaInputs] = useState<Record<string, { designId: string; designUrl: string }>>({});

  const { data: scripts = [], isLoading } = useQuery<any[]>({
    queryKey: ['shorts-scripts'],
    queryFn: () => apiFetch(token, '/shorts/scripts'),
  });

  const linkCanvaMut = useMutation({
    mutationFn: ({ id, canvaDesignId, canvaDesignUrl }: { id: string; canvaDesignId: string; canvaDesignUrl: string }) =>
      apiFetch(token, `/shorts/scripts/${id}/canva`, {
        method: 'PATCH',
        body: JSON.stringify({ id, canvaDesignId, canvaDesignUrl }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shorts-scripts'] }),
  });

  const publishMut = useMutation({
    mutationFn: (id: string) =>
      apiFetch(token, `/shorts/scripts/${id}/publish`, {
        method: 'PATCH',
        body: JSON.stringify({ id }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shorts-scripts'] }),
  });

  const STATUS_CLS: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground',
    approved: 'bg-green-500/15 text-green-400',
    in_production: 'bg-blue-500/15 text-blue-400',
    published: 'bg-purple-500/15 text-purple-400',
  };

  if (isLoading) return <p className="text-sm text-muted-foreground py-8 text-center">Loading scripts...</p>;
  if (!scripts.length) return (
    <div className="rounded-xl border border-border bg-card p-8 text-center">
      <p className="text-sm text-muted-foreground">No scripts yet.</p>
      <p className="text-xs text-muted-foreground mt-1">Trigger the agent manually from the General tab to generate your first batch.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {scripts.map((script: any) => {
        const isOpen = expanded === script.id;
        const input = canvaInputs[script.id] ?? { designId: script.canvaDesignId ?? '', designUrl: script.canvaDesignUrl ?? '' };
        return (
          <div key={script.id} className="rounded-xl border border-border bg-card overflow-hidden">
            <div
              className="px-5 py-4 flex items-center gap-3 cursor-pointer hover:bg-muted/20 transition-colors"
              onClick={() => setExpanded(isOpen ? null : script.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-medium truncate">{script.title}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_CLS[script.status] ?? STATUS_CLS.draft}`}>
                    {script.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{script.brand} · {script.topic} · {script.durationSecs}s</p>
              </div>
              <ChevronRight className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
            </div>

            {isOpen && (
              <div className="border-t border-border px-5 py-4 space-y-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Hook</p>
                  <p className="text-sm">{script.hook}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Voiceover Script</p>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{script.voiceover}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Visual Brief</p>
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground">{script.visualBrief}</p>
                </div>

                <div className="border-t border-border pt-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Canva Design</p>
                  {script.canvaDesignUrl ? (
                    <div className="flex items-center gap-3 mb-2">
                      <a
                        href={script.canvaDesignUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary underline underline-offset-2 truncate"
                      >
                        {script.canvaDesignUrl}
                      </a>
                      <span className="text-xs text-green-400 shrink-0">Linked</span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mb-2">No Canva design linked yet.</p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className="bg-background border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none"
                      placeholder="Canva design ID"
                      value={input.designId}
                      onChange={e => setCanvaInputs(prev => ({ ...prev, [script.id]: { ...input, designId: e.target.value } }))}
                    />
                    <input
                      className="bg-background border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none"
                      placeholder="Canva design URL"
                      value={input.designUrl}
                      onChange={e => setCanvaInputs(prev => ({ ...prev, [script.id]: { ...input, designUrl: e.target.value } }))}
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => linkCanvaMut.mutate({ id: script.id, canvaDesignId: input.designId, canvaDesignUrl: input.designUrl })}
                      disabled={linkCanvaMut.isPending}
                    >
                      {linkCanvaMut.isPending ? 'Saving...' : 'Link design'}
                    </Button>
                    {script.status !== 'published' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => publishMut.mutate(script.id)}
                        disabled={publishMut.isPending}
                      >
                        Mark published
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ShortsSettingsTab({ agent, token }: { agent: AgentDetail; token: string }) {
  const [activeSub, setActiveSub] = useState<ShortsSubTabKey>('setup');

  return (
    <div>
      <div className="flex items-center gap-1 border border-border rounded-lg p-1 mb-5 bg-muted/30 w-fit">
        {SHORTS_SUBTABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveSub(key)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeSub === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {activeSub === 'setup' && (
        <Phase4SetupSubTab
          agent={agent}
          title="YouTube Shorts Creator — Setup Checklist"
          description="Generates YouTube Shorts / Reels scripts weekly (Monday 9am) or on demand. Each script includes hook, voiceover, visual brief, and Canva design brief — approved before saving."
          steps={<>
            <SetupStep n={1} title="Add content style to Knowledge Base" done={false}>
              <p>Go to <strong>Knowledge Base</strong> and add writing samples for this agent (agent key: <code className="bg-muted px-1 rounded">shorts</code>):</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5 ml-1">
                <li>Add a <strong>Voice Profile</strong> entry describing your brand tone</li>
                <li>Add positive writing samples: examples of content you like</li>
                <li>Add negative samples: content styles to avoid</li>
                <li>Add facts: product names, target audience, key messages</li>
              </ul>
            </SetupStep>
            <SetupStep n={2} title="Configure topics and duration" done={false}>
              <p>In Config JSON set:</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5 ml-1">
                <li><code className="bg-muted px-1 rounded">topics</code>: array of content topics (e.g. "productivity tips", "SaaS behind the scenes")</li>
                <li><code className="bg-muted px-1 rounded">targetDurationSecs</code>: 15, 30, or 60</li>
                <li><code className="bg-muted px-1 rounded">videosPerRun</code>: how many scripts to generate per run (default 3)</li>
                <li><code className="bg-muted px-1 rounded">brands</code>: array of brand names</li>
              </ul>
            </SetupStep>
            <SetupStep n={3} title="Enable and trigger" done={agent.enabled}>
              <p>Enable and trigger manually. Each generated script is sent to Telegram for approval. After approval, view and manage scripts in the Scripts tab.</p>
              <p className="mt-1">The agent runs automatically every Monday at 9am once enabled.</p>
            </SetupStep>
            <SetupStep n={4} title="Link Canva designs" done={false}>
              <p>After creating designs in Canva (use Claude's Canva MCP or design manually), paste the design ID and URL into each script from the Scripts tab.</p>
              <p className="mt-1">Use the <code className="bg-muted px-1 rounded">canvaDesignBrief</code> field in each approved script as the brief for your Canva design.</p>
            </SetupStep>
          </>}
        />
      )}
      {activeSub === 'general' && <Phase4GeneralSubTab agent={agent} token={token} />}
      {activeSub === 'scripts' && <ShortsScriptsSubTab token={token} />}
    </div>
  );
}

function Phase4SettingsTab({ agent, token, setupContent }: {
  agent: AgentDetail;
  token: string;
  setupContent: React.ReactNode;
}) {
  const [activeSub, setActiveSub] = useState<Phase4TabKey>('setup');

  return (
    <div>
      <div className="flex items-center gap-1 border border-border rounded-lg p-1 mb-5 bg-muted/30 w-fit">
        {PHASE4_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveSub(key)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeSub === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>
      {activeSub === 'setup' && setupContent}
      {activeSub === 'general' && <Phase4GeneralSubTab agent={agent} token={token} />}
      {activeSub === 'runtime' && <RuntimeSubTab agent={agent} />}
    </div>
  );
}


// ─── Page ─────────────────────────────────────────────────────────────────────

function AgentDetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-40 rounded" />
          <Skeleton className="h-3.5 w-60 rounded" />
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full rounded" />
        ))}
      </div>
    </div>
  );
}

// ─── Canva Agent Page (T17, T18, T19, T28, T29) ────────────────────────────

type CanvaTab = 'chat' | 'calendar' | 'candidates' | 'brands' | 'settings' | 'setup';

interface CanvaCandidate {
  id: string;
  sessionId: string;
  status: string;
  backend: string;
  tool: string | null;
  filePath: string | null;
  format: string | null;
  width: number | null;
  height: number | null;
  costUsd: number;
  rationale: string | null;
  canvaDesignId: string | null;
  canvaEditUrl: string | null;
  thumbnailPath: string | null;
  error?: string | null;
  createdAt: string;
}

interface CanvaBrand {
  id: string;
  name: string;
  displayName: string;
  voiceProfile: string;
  palette: string[];
  fonts: string[];
  canvaKitId: string | null;
  platforms: string[];
  logoUrl: string | null;
  active: boolean;
}

function CanvaAgentPage({ agent, token }: { agent: AgentDetail; token: string }) {
  const navigate = useNavigate();
  type NonChatTab = Exclude<CanvaTab, 'chat'>;
  const [tab, setTab] = useState<NonChatTab>('calendar');

  const tabs: { key: CanvaTab; label: string }[] = [
    { key: 'chat', label: 'Chat' },
    { key: 'calendar', label: 'Calendar' },
    { key: 'candidates', label: 'Candidates' },
    { key: 'brands', label: 'Brands' },
    { key: 'settings', label: 'Settings' },
    { key: 'setup', label: 'Setup' },
  ];

  function handleTab(key: CanvaTab) {
    if (key === 'chat') {
      navigate(`/agents/${agent.key}/chat`);
    } else {
      setTab(key as NonChatTab);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 border border-border rounded-lg p-1 bg-muted/30 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => handleTab(t.key)}
            className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'calendar' && <CanvaCalendarTab token={token} />}
      {tab === 'candidates' && <CanvaCandidatesTab token={token} />}
      {tab === 'brands' && <CanvaBrandsTab token={token} />}
      {tab === 'settings' && <CanvaSettingsTab agent={agent} token={token} />}
      {tab === 'setup' && <CanvaSetupTab agent={agent} token={token} />}
    </div>
  );
}

// T18: Single candidate card with Edit in Canva, approve/reject/revise
function CanvaCandidateCard({ candidate, sessionId, token }: { candidate: any; sessionId: string; token: string }) {
  const qc = useQueryClient();
  const [reviseText, setReviseText] = useState('');
  const [showRevise, setShowRevise] = useState(false);

  const approveMut = useMutation({
    mutationFn: () => apiFetch(token, `/canva/candidates/${candidate.id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ id: candidate.id, sessionId }),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['canva-candidates'] }),
  });

  const rejectMut = useMutation({
    mutationFn: () => apiFetch(token, `/canva/candidates/${candidate.id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ id: candidate.id, sessionId }),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['canva-candidates'] }),
  });

  const reviseMut = useMutation({
    mutationFn: () => apiFetch(token, `/canva/candidates/${candidate.id}/revise`, {
      method: 'POST',
      body: JSON.stringify({ id: candidate.id, sessionId, feedback: reviseText }),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['canva-candidates'] }); setShowRevise(false); setReviseText(''); },
  });

  const status = candidate.status ?? 'pending';
  const statusColor = status === 'approved' ? 'text-green-600 bg-green-50' : status === 'rejected' ? 'text-muted-foreground bg-muted/50' : 'text-amber-600 bg-amber-50';

  return (
    <div className={`bg-card border border-border rounded-xl p-3 space-y-2 ${status === 'rejected' ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor}`}>{status}</span>
        <span className="text-xs text-muted-foreground">{candidate.backend}</span>
      </div>

      {candidate.thumbnailPath && (
        <div className="aspect-square bg-muted rounded-lg overflow-hidden">
          <img src={`/canva/thumbnail/${candidate.id}`} alt="candidate" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
      )}

      {!candidate.thumbnailPath && (
        <div className="aspect-square bg-muted/30 rounded-lg flex items-center justify-center">
          <span className="text-xs text-muted-foreground">{candidate.format?.toUpperCase() ?? 'PNG'} · {candidate.width}x{candidate.height}</span>
        </div>
      )}

      {candidate.rationale && (
        <p className="text-xs text-muted-foreground line-clamp-2">{candidate.rationale}</p>
      )}

      {candidate.error && (
        <p className="text-xs text-destructive">{candidate.error}</p>
      )}

      {candidate.costUsd > 0 && (
        <p className="text-xs text-muted-foreground">${candidate.costUsd.toFixed(4)}</p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {candidate.canvaEditUrl && (
          <a
            href={candidate.canvaEditUrl}
            target="_blank"
            rel="noreferrer"
            className="px-2.5 py-1 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Edit in Canva
          </a>
        )}
        {candidate.filePath && !candidate.canvaEditUrl && (
          <a
            href={`file://${candidate.filePath}`}
            className="px-2.5 py-1 text-xs border border-border rounded-md hover:bg-muted/50 transition-colors"
          >
            Download
          </a>
        )}
        {status === 'pending' && (
          <>
            <button
              onClick={() => approveMut.mutate()}
              disabled={approveMut.isPending}
              className="px-2.5 py-1 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              Approve
            </button>
            <button
              onClick={() => rejectMut.mutate()}
              disabled={rejectMut.isPending}
              className="px-2.5 py-1 text-xs border border-border rounded-md hover:bg-muted/50 transition-colors disabled:opacity-50"
            >
              Reject
            </button>
            <button
              onClick={() => setShowRevise(!showRevise)}
              className="px-2.5 py-1 text-xs border border-border rounded-md hover:bg-muted/50 transition-colors"
            >
              Revise
            </button>
          </>
        )}
      </div>

      {showRevise && (
        <div className="space-y-1.5">
          <Input
            value={reviseText}
            onChange={(e) => setReviseText(e.target.value)}
            placeholder="What to change?"
            className="text-xs h-8"
          />
          <Button size="sm" onClick={() => reviseMut.mutate()} disabled={!reviseText.trim() || reviseMut.isPending} className="h-7 text-xs">
            Submit revision
          </Button>
        </div>
      )}
    </div>
  );
}

// T18: Candidates tab — session list and candidate gallery
function CanvaCandidatesTab({ token }: { token: string }) {
  const [sessionId, setSessionId] = useState('');

  const { data: candidates, isLoading } = useQuery<CanvaCandidate[]>({
    queryKey: ['canva-candidates', sessionId],
    queryFn: () => apiFetch(token, `/canva/sessions/${sessionId}/candidates`),
    enabled: !!sessionId,
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
          placeholder="Session ID (from chat response or Telegram)"
          className="max-w-xs"
        />
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading candidates...</p>}

      {candidates && candidates.length === 0 && (
        <p className="text-sm text-muted-foreground">No candidates found for this session.</p>
      )}

      {candidates && candidates.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {candidates.map((c) => (
            <CanvaCandidateCard key={c.id} candidate={c} sessionId={sessionId} token={token} />
          ))}
        </div>
      )}
    </div>
  );
}

// T28: Calendar tab — existing content ideas
function CanvaCalendarTab({ token }: { token: string }) {
  const month = new Date().toISOString().slice(0, 7);
  const { data: ideas, isLoading } = useQuery<any[]>({
    queryKey: ['canva-calendar', month],
    queryFn: () => apiFetch(token, `/canva/calendar/${month}`),
  });

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Content ideas for {month}</p>
      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {ideas && ideas.length === 0 && <p className="text-sm text-muted-foreground">No ideas yet. Trigger the agent to generate this month's calendar.</p>}
      {ideas && ideas.length > 0 && (
        <div className="space-y-2">
          {ideas.map((idea: any) => (
            <div key={idea.id} className="bg-card border border-border rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium bg-muted px-1.5 py-0.5 rounded">{idea.format}</span>
                <span className="text-xs text-muted-foreground">{idea.platform} · {idea.brand}</span>
                <span className={`ml-auto text-xs px-1.5 py-0.5 rounded ${idea.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>{idea.status}</span>
              </div>
              <p className="text-sm font-medium">{idea.hook}</p>
              <p className="text-xs text-muted-foreground">{idea.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// T29: Brands tab — per-brand identity management
function CanvaBrandsTab({ token }: { token: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<CanvaBrand | null>(null);
  const [form, setForm] = useState({ name: '', displayName: '', voiceProfile: '', canvaKitId: '', palette: '', fonts: '', platforms: '' });

  const { data: brands, isLoading } = useQuery<CanvaBrand[]>({
    queryKey: ['canva-brands'],
    queryFn: () => apiFetch(token, '/canva/brands'),
  });

  const saveMut = useMutation({
    mutationFn: (data: any) => apiFetch(token, '/canva/brands', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['canva-brands'] }); setEditing(null); setForm({ name: '', displayName: '', voiceProfile: '', canvaKitId: '', palette: '', fonts: '', platforms: '' }); },
  });

  const startEdit = (b: CanvaBrand) => {
    setEditing(b);
    setForm({
      name: b.name,
      displayName: b.displayName,
      voiceProfile: b.voiceProfile,
      canvaKitId: b.canvaKitId ?? '',
      palette: b.palette.join(', '),
      fonts: b.fonts.join(', '),
      platforms: b.platforms.join(', '),
    });
  };

  const handleSave = () => {
    saveMut.mutate({
      name: form.name,
      displayName: form.displayName,
      voiceProfile: form.voiceProfile,
      canvaKitId: form.canvaKitId || undefined,
      palette: form.palette.split(',').map((s) => s.trim()).filter(Boolean),
      fonts: form.fonts.split(',').map((s) => s.trim()).filter(Boolean),
      platforms: form.platforms.split(',').map((s) => s.trim()).filter(Boolean),
    });
  };

  return (
    <div className="space-y-4">
      {isLoading && <p className="text-sm text-muted-foreground">Loading brands...</p>}

      {brands && brands.map((b) => (
        <div key={b.name} className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium">{b.displayName}</p>
              <p className="text-xs text-muted-foreground">{b.name}</p>
            </div>
            <div className="flex gap-1.5">
              {b.palette.map((c) => (
                <div key={c} className="w-4 h-4 rounded-full border border-border/50" style={{ backgroundColor: c }} title={c} />
              ))}
            </div>
          </div>
          {b.voiceProfile && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{b.voiceProfile}</p>}
          <div className="flex items-center gap-3 mt-3">
            {b.canvaKitId && <span className="text-xs text-muted-foreground">Kit: {b.canvaKitId.slice(0, 12)}...</span>}
            <span className="text-xs text-muted-foreground">{b.platforms.join(', ')}</span>
            <button onClick={() => startEdit(b)} className="ml-auto text-xs text-primary hover:underline">Edit</button>
          </div>
        </div>
      ))}

      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <p className="text-sm font-medium">{editing ? `Edit ${editing.displayName}` : 'Add / update brand'}</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Brand key (e.g. taskip)</label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="taskip" disabled={!!editing} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Display name</label>
            <Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="Taskip" />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Voice profile</label>
          <textarea
            value={form.voiceProfile}
            onChange={(e) => setForm({ ...form, voiceProfile: e.target.value })}
            placeholder="Educational, relatable, and slightly witty — for SaaS founders..."
            className="w-full text-sm border border-border rounded-lg p-2 bg-background resize-none h-20"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Palette (hex, comma-separated)</label>
            <Input value={form.palette} onChange={(e) => setForm({ ...form, palette: e.target.value })} placeholder="#6366f1, #4f46e5" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Fonts (comma-separated)</label>
            <Input value={form.fonts} onChange={(e) => setForm({ ...form, fonts: e.target.value })} placeholder="Inter, Geist" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Canva Kit ID (optional)</label>
            <Input value={form.canvaKitId} onChange={(e) => setForm({ ...form, canvaKitId: e.target.value })} placeholder="kit_xxxxxx" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Platforms (comma-separated)</label>
            <Input value={form.platforms} onChange={(e) => setForm({ ...form, platforms: e.target.value })} placeholder="instagram, linkedin" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={!form.name || !form.displayName || saveMut.isPending}>
            {saveMut.isPending ? 'Saving...' : 'Save brand'}
          </Button>
          {editing && <Button variant="outline" onClick={() => { setEditing(null); setForm({ name: '', displayName: '', voiceProfile: '', canvaKitId: '', palette: '', fonts: '', platforms: '' }); }}>Cancel</Button>}
        </div>
      </div>
    </div>
  );
}

// Settings tab — dedicated fields, no raw JSON
const CANVA_FORMATS = ['carousel', 'reel', 'post', 'story', 'youtube'] as const;

function CanvaSettingsTab({ agent, token }: { agent: AgentDetail; token: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const cfg = (agent.config ?? {}) as Record<string, unknown>;
  const { llm: initialLlm } = stripLlm(cfg);

  const [targetCount, setTargetCount] = useState(String(cfg.targetCount ?? 30));
  const [formats, setFormats] = useState<string[]>((cfg.formats as string[]) ?? ['carousel', 'reel', 'post', 'story', 'youtube']);
  const [debugMode, setDebugMode] = useState(!!(cfg.debugMode));
  const [maxCostUsd, setMaxCostUsd] = useState(String(cfg.maxCostUsd ?? 5.0));
  const [overrideLlm, setOverrideLlm] = useState(!!(initialLlm?.provider || initialLlm?.model));
  const [llmProvider, setLlmProvider] = useState(initialLlm?.provider ?? 'auto');
  const [llmModel, setLlmModel] = useState(initialLlm?.model ?? '');

  const { data: brands } = useQuery<CanvaBrand[]>({
    queryKey: ['canva-brands'],
    queryFn: () => apiFetch(token, '/canva/brands'),
  });

  const saveMut = useMutation({
    mutationFn: (config: Record<string, unknown>) =>
      apiFetch(token, `/agents/${agent.key}`, { method: 'PATCH', body: JSON.stringify({ config }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent', agent.key] }),
  });

  const toggleMut = useMutation({
    mutationFn: () =>
      apiFetch(token, `/agents/${agent.key}`, { method: 'PATCH', body: JSON.stringify({ enabled: !agent.enabled }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent', agent.key] }),
  });

  const triggerMut = useMutation({
    mutationFn: () =>
      apiFetch(token, `/agents/${agent.key}/trigger`, { method: 'POST', body: JSON.stringify({ triggerType: 'MANUAL' }) }),
    onSuccess: (run: { id: string }) => navigate(`/runs/${run.id}`),
  });

  const toggleFormat = (f: string) =>
    setFormats((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);

  const handleSave = () => {
    const config: Record<string, unknown> = {
      targetCount: parseInt(targetCount) || 30,
      formats,
      brands: brands?.filter((b) => b.active).map((b) => b.name) ?? (cfg.brands as string[] ?? ['taskip', 'xgenious']),
      debugMode,
      maxCostUsd: parseFloat(maxCostUsd) || 5.0,
    };
    if (overrideLlm && (llmProvider !== 'auto' || llmModel)) {
      config.llm = { ...(llmProvider ? { provider: llmProvider } : {}), ...(llmModel ? { model: llmModel } : {}) };
    }
    saveMut.mutate(config);
  };

  return (
    <div className="space-y-5 max-w-xl">
      {/* Enable / disable */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Agent enabled</p>
            <p className="text-xs text-muted-foreground mt-0.5">Allow this agent to run on schedule (1st of month at 08:00)</p>
          </div>
          <BigToggle enabled={agent.enabled} onClick={() => toggleMut.mutate()} disabled={toggleMut.isPending} />
        </div>
      </div>

      {/* Calendar settings */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        <p className="text-sm font-semibold">Calendar settings</p>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">Ideas per month (target count)</label>
          <Input
            type="number"
            value={targetCount}
            onChange={(e) => setTargetCount(e.target.value)}
            min={5}
            max={100}
            className="w-28 text-sm"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-2">Content formats</label>
          <div className="flex flex-wrap gap-2">
            {CANVA_FORMATS.map((f) => (
              <button
                key={f}
                onClick={() => toggleFormat(f)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${formats.includes(f) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">Active brands</label>
          {brands && brands.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {brands.filter((b) => b.active).map((b) => (
                <span key={b.name} className="px-2.5 py-0.5 text-xs bg-muted rounded-full">{b.displayName}</span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No brands configured — add them in the Brands tab.</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">Manage brands and their voice profiles in the Brands tab.</p>
        </div>
      </div>

      {/* Design generation settings */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        <p className="text-sm font-semibold">Design generation</p>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">Max cost per session (USD)</label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={maxCostUsd}
              onChange={(e) => setMaxCostUsd(e.target.value)}
              min={0.5}
              max={50}
              step={0.5}
              className="w-24 text-sm"
            />
            <span className="text-xs text-muted-foreground">Agent switches from DALL-E to Stability AI when this is exceeded</span>
          </div>
        </div>

        <div className="flex items-center justify-between py-0.5">
          <div>
            <p className="text-sm">Debug mode</p>
            <p className="text-xs text-muted-foreground">Log each pipeline step to database (viewable via Sessions tab)</p>
          </div>
          <BigToggle enabled={debugMode} onClick={() => setDebugMode(!debugMode)} />
        </div>
      </div>

      {/* LLM override */}
      <LlmOverrideCard
        initialLlm={initialLlm}
        overrideLlm={overrideLlm}
        setOverrideLlm={setOverrideLlm}
        llmProvider={llmProvider}
        setLlmProvider={setLlmProvider}
        llmModel={llmModel}
        setLlmModel={setLlmModel}
      />

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saveMut.isPending}>
          {saveMut.isPending ? 'Saving...' : 'Save settings'}
        </Button>
        {saveMut.isSuccess && <span className="text-xs text-green-600">Saved</span>}
        <Button
          variant="outline"
          size="sm"
          onClick={() => triggerMut.mutate()}
          disabled={!agent.enabled || !agent.registered || triggerMut.isPending}
          className="ml-auto gap-1.5"
        >
          <Play className="w-3.5 h-3.5" />
          {triggerMut.isPending ? 'Starting...' : 'Run now'}
        </Button>
      </div>
    </div>
  );
}

// T19: Setup tab — Canva MCP connection guide + verification
function CanvaSetupTab({ agent, token }: { agent: AgentDetail; token: string }) {
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);

  const verify = async () => {
    setVerifying(true);
    try {
      const res = await apiFetch(token, '/canva/verify');
      setVerifyResult(res);
    } catch {
      setVerifyResult({ ok: false, error: 'Request failed — check API connection' });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="bg-muted/40 border border-border rounded-xl p-3 text-sm text-muted-foreground">
        Note: LLM provider, Telegram bot, and database are platform-wide — configure them in Settings, not here.
      </div>

      <div className="space-y-3">

        {/* Step 1: MCP page */}
        <SetupStep n={1} title="Add Canva MCP server" done={false}>
          <p>Go to the <strong>MCP</strong> page and add a new external server:</p>
          <div className="mt-2 bg-muted rounded-lg px-3 py-2 text-xs font-mono space-y-1">
            <div><span className="text-muted-foreground">Name:</span> canva</div>
            <div><span className="text-muted-foreground">URL: </span> https://mcp.canva.com/mcp</div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Enable it after saving. The agent calls this server for all Canva operations.</p>
        </SetupStep>

        {/* Step 2: OAuth */}
        <SetupStep n={2} title="Connect your Canva account (OAuth)" done={false}>
          <p className="font-medium text-sm mb-2">Option A — Claude Desktop / Claude.ai (easiest)</p>
          <ol className="list-decimal list-inside space-y-1 text-sm ml-1">
            <li>Open Claude Desktop → Settings → Connectors</li>
            <li>Find <strong>Canva</strong> and click Connect</li>
            <li>Sign in to Canva and approve the OAuth request</li>
            <li>Token is shared with the agent automatically</li>
          </ol>

          <p className="font-medium text-sm mt-4 mb-2">Option B — Server CLI (for headless/VPS)</p>
          <p className="text-sm mb-1">Run once on the server. A browser link appears — open it and approve:</p>
          <pre className="bg-muted rounded-lg px-3 py-2 text-xs font-mono overflow-x-auto">npx -y mcp-remote https://mcp.canva.com/mcp</pre>
          <p className="mt-1 text-xs text-muted-foreground">Token is cached under <code className="bg-muted px-1 rounded">~/.mcp-auth/</code> and reused on every restart.</p>

          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
            You need a Canva account with MCP access enabled. Free accounts have access; team plans include brand kit features.
          </div>
        </SetupStep>

        {/* Step 3: AI image keys */}
        <SetupStep n={3} title="Add AI image provider keys (for image generation)" done={false}>
          <p>In <strong>Settings → Secrets</strong>, add:</p>
          <div className="mt-2 space-y-1">
            {[
              { key: 'openai_api_key', label: 'OpenAI', note: 'DALL-E 3 — primary image generator ($0.04/image)' },
              { key: 'stability_api_key', label: 'Stability AI', note: 'Fallback when OpenAI quota is exceeded' },
            ].map((item) => (
              <div key={item.key} className="flex items-start gap-2 text-sm">
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs shrink-0 mt-0.5">{item.key}</code>
                <span className="text-muted-foreground">{item.note}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Skip this step if you only need Canva template-based designs (no AI image generation).</p>
        </SetupStep>

        {/* Step 4: Brands */}
        <SetupStep n={4} title="Set up brand identities" done={false}>
          <p>Go to the <strong>Brands</strong> tab and fill in voice profile, color palette, fonts, and Canva Kit ID for each brand.</p>
          <p className="mt-1 text-xs text-muted-foreground">The agent uses the brand's voice and palette automatically when you mention the brand name in the chat.</p>
        </SetupStep>

        {/* Step 5: Verify */}
        <SetupStep n={5} title="Verify connection" done={agent.enabled}>
          <p>Click Verify to check all systems. Then go to the <strong>Chat</strong> tab and type a concept to generate your first design.</p>
          <p className="mt-1 text-sm text-muted-foreground">Example: <em>"Create an Instagram post for taskip spring sale, playful tone"</em></p>
          <div className="mt-3">
            <Button size="sm" onClick={verify} disabled={verifying}>
              {verifying ? 'Verifying...' : 'Verify Canva MCP'}
            </Button>
          </div>
          {verifyResult && (
            <div className={`mt-3 p-3 rounded-lg text-sm font-mono border ${verifyResult.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-destructive/10 border-destructive/20 text-destructive'}`}>
              <div>Status: {verifyResult.ok ? 'OK' : 'FAILED'}</div>
              <div>Tools: {verifyResult.toolsFound ?? 0}/{verifyResult.toolsExpected ?? 32}</div>
              {verifyResult.latencyMs && <div>Latency: {verifyResult.latencyMs}ms</div>}
              {verifyResult.error && <div>Error: {verifyResult.error}</div>}
              {verifyResult.missingTools?.length > 0 && (
                <div className="mt-1">Missing: {verifyResult.missingTools.slice(0, 5).join(', ')}{verifyResult.missingTools.length > 5 ? ` +${verifyResult.missingTools.length - 5} more` : ''}</div>
              )}
              {verifyResult.ok && (
                <div className="mt-1 text-green-700">Canva MCP is connected and ready.</div>
              )}
            </div>
          )}
        </SetupStep>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function AgentDetailPage() {
  const { key } = useParams<{ key: string }>();
  const token = useAuthStore((s) => s.token)!;
  const [activeTab, setActiveTab] = useState<'runs' | 'settings'>('runs');
  const color = agentColor(key!);

  const { data: agent, isLoading, isError } = useQuery<AgentDetail>({
    queryKey: ['agent', key],
    queryFn: async () => {
      const res = await fetch(`/agents/${key}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    refetchInterval: activeTab === 'runs' ? 15_000 : false,
  });

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
      <Link
        to="/agents"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Agents
      </Link>

      {isLoading && !agent && <AgentDetailSkeleton />}
      {isError && !agent && <p className="text-sm text-destructive">Failed to load agent.</p>}

      {agent && (
        <>
          <div className="flex items-start gap-3 mb-6">
            <div className={`w-10 h-10 rounded-xl ${color.iconBg} flex items-center justify-center shrink-0 mt-0.5`}>
              <Bot className={`w-5 h-5 ${color.iconText}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                <h1 className="text-xl font-semibold">{agent.name}</h1>
                <code className={`text-xs px-1.5 py-0.5 rounded ${color.badge} ${color.badgeText}`}>{agent.key}</code>
                {!agent.registered && (
                  <span className="text-xs bg-yellow-500/10 text-yellow-500 px-1.5 py-0.5 rounded">unregistered</span>
                )}
                {agent.enabled
                  ? <span className="text-xs bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded">enabled</span>
                  : <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">disabled</span>
                }
              </div>
              {agent.description && (
                <p className="text-sm text-muted-foreground">{agent.description}</p>
              )}
              <Link
                to={`/agents/${agent.key}/chat`}
                className={`inline-flex items-center gap-1.5 text-xs sm:text-sm px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border transition-colors mt-2 ${color.border} ${color.badgeText} hover:${color.iconBg}`}
              >
                <MessageSquare className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                Chat
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-1 border-b border-border mb-6">
            <button
              onClick={() => setActiveTab('runs')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === 'runs'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <List className="w-4 h-4" />
              Runs
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === 'settings'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
          </div>

          {activeTab === 'runs' && <RunsTab agentKey={key!} token={token} />}
          {activeTab === 'settings' && <SettingsTab agent={agent} token={token} />}
        </>
      )}
    </div>
  );
}
