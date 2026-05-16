import { useState, useCallback, useEffect, useRef } from 'react';
import { getRealtimeSocket } from '@/lib/realtime';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Bot, ArrowLeft, ChevronRight, ChevronDown, Save, Play,
  ToggleLeft, ToggleRight, Settings, List,
  Mail, Cpu, Layers, Info, BookOpen,
  CheckCircle2, Circle, MessageSquare,
  Bug, AlertTriangle, AlertCircle,
  Plus, Loader2, RefreshCw, Radio,
  CalendarClock, Zap, RotateCcw, ListTodo, ExternalLink,
  ImageIcon, Upload, ChevronLeft, X, Copy, Check, Download, Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/authStore';
import { agentColor } from '@/lib/agent-colors';
import { getAgentSuggestions } from '@/lib/agentTaskSuggestions';
import { isGreetingExact } from '@/lib/greetings';
import { NICHE_TEMPLATES, NICHE_CATEGORIES, type NicheTemplate } from '@/lib/linkedinNicheTemplates';

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
  llm?: { provider?: string; model?: string } | null;
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
  llm?: { provider?: string; model?: string } | null;
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

const _API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const apiHref = (path: string) => `${_API_BASE}${path}`;

async function apiFetch(token: string, path: string, opts?: RequestInit) {
  const res = await fetch(path, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...opts?.headers },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error ?? data?.message ?? `Request failed (${res.status})`);
  }
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
  const navigate = useNavigate();

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const retryMutation = useMutation({
    mutationFn: () =>
      apiFetch(token, `/agents/${agentKey}/trigger`, {
        method: 'POST',
        body: JSON.stringify({ triggerType: 'MANUAL' }),
      }),
    onSuccess: (run: { id: string }) => navigate(`/runs/${run.id}`),
  });

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

  const [allApprovals, setAllApprovals] = useState<PendingApproval[]>([]);

  useEffect(() => {
    const socket = getRealtimeSocket(token);
    const subscribe = () => socket.emit('approvals:subscribe');
    const onSnapshot = (rows: PendingApproval[]) => setAllApprovals(rows ?? []);
    const onCreated = (a: PendingApproval) => setAllApprovals((prev) => [a, ...prev.filter((x) => x.id !== a.id)]);
    const onRemoved = (p: { id: string }) => setAllApprovals((prev) => prev.filter((a) => a.id !== p.id));

    socket.on('approvals:snapshot', onSnapshot);
    socket.on('approval:created', onCreated);
    socket.on('approval:removed', onRemoved);
    socket.on('connect', subscribe);
    if (socket.connected) subscribe();

    return () => {
      socket.emit('approvals:unsubscribe');
      socket.off('approvals:snapshot', onSnapshot);
      socket.off('approval:created', onCreated);
      socket.off('approval:removed', onRemoved);
      socket.off('connect', subscribe);
    };
  }, [token]);

  const approveMutation = useMutation({
    mutationFn: (approvalId: string) =>
      apiFetch(token, `/approvals/${approvalId}/approve`, { method: 'POST' }),
    onSuccess: (_data, approvalId) => {
      setAllApprovals((prev) => prev.filter((a) => a.id !== approvalId));
      qc.invalidateQueries({ queryKey: ['agent-runs', agentKey] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (approvalId: string) =>
      apiFetch(token, `/approvals/${approvalId}/reject`, { method: 'POST' }),
    onSuccess: (_data, approvalId) => {
      setAllApprovals((prev) => prev.filter((a) => a.id !== approvalId));
      qc.invalidateQueries({ queryKey: ['agent-runs', agentKey] });
    },
  });

  const approvalsByRunId = allApprovals
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
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Run history</span>
        <button
          onClick={() => retryMutation.mutate()}
          disabled={retryMutation.isPending}
          className="flex items-center gap-1.5 text-xs bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50"
        >
          <Play className={`w-3.5 h-3.5 ${retryMutation.isPending ? 'animate-spin' : ''}`} />
          {retryMutation.isPending ? 'Starting…' : 'Run now'}
        </button>
      </div>
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
                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {run.status === 'FAILED' && (
                    <button
                      onClick={() => retryMutation.mutate()}
                      disabled={retryMutation.isPending}
                      className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 px-1.5 py-1 rounded hover:bg-red-500/10 transition-colors disabled:opacity-50"
                      title="Retry this run"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${retryMutation.isPending ? 'animate-spin' : ''}`} />
                      Retry
                    </button>
                  )}
                  <Link
                    to={`/runs/${run.id}`}
                    className="text-xs text-muted-foreground hover:text-foreground px-1.5 py-1 rounded hover:bg-accent"
                    title="Open full run page"
                  >
                    Full log
                  </Link>
                </div>
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

  const useDefault = !config.llm?.provider;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold mb-4">LLM Configuration</h3>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-muted-foreground block mb-2">Provider</label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onChange({ llm: null })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                useDefault
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
              }`}
            >
              Default (from Settings)
            </button>
            {LLM_PROVIDERS.filter((p) => p !== 'auto').map((p) => (
              <button
                key={p}
                onClick={() => onChange({ llm: { provider: p, model: config.llm?.model ?? '' } })}
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
        {!useDefault && (
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
        )}
        {useDefault && (
          <p className="text-xs text-muted-foreground">
            Using platform default — provider and model are read from{' '}
            <a href="/settings" className="text-primary hover:underline">Settings → LLM</a> at runtime.
          </p>
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

  const useDefault = !config.llm?.provider;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold mb-4">LLM Configuration</h3>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-muted-foreground block mb-2">Provider</label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onChange({ llm: null })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                useDefault
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
              }`}
            >
              Default (from Settings)
            </button>
            {LLM_PROVIDERS.filter((p) => p !== 'auto').map((p) => (
              <button
                key={p}
                onClick={() => onChange({ llm: { provider: p, model: config.llm?.model ?? '' } })}
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
        {!useDefault && (
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
        )}
        {useDefault && (
          <p className="text-xs text-muted-foreground">
            Using platform default — provider and model are read from{' '}
            <a href="/settings" className="text-primary hover:underline">Settings → LLM</a> at runtime.
          </p>
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

function DailyReminderSettingsTab({ agent, token }: { agent: AgentDetail; token: string }) {
  const [activeSub, setActiveSub] = useState<DailyReminderTabKey>('setup');
  const [config, setConfig] = useState<DailyReminderConfig>(
    (agent.config as unknown as DailyReminderConfig) ?? {
      morningCron: '30 2 * * *',
      eveningCron: '0 15 * * *',
      enableMorning: true,
      enableEvening: true,
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
  llm?: { provider?: string; model?: string } | null;
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

  const useDefault = !config.llm?.provider;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold mb-4">LLM Configuration</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Used for email classification (~20 tokens each) and reply drafting (~300 tokens each).
        Select <strong>Default</strong> to inherit platform LLM settings.
      </p>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-muted-foreground block mb-2">Provider</label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onChange({ llm: null })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                useDefault
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
              }`}
            >
              Default (from Settings)
            </button>
            {LLM_PROVIDERS.filter((p) => p !== 'auto').map((p) => (
              <button
                key={p}
                onClick={() => onChange({ llm: { provider: p, model: config.llm?.model ?? '' } })}
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
        {!useDefault && (
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Model</label>
            <Input
              value={config.llm?.model ?? ''}
              onChange={(e) => onChange({ llm: { ...config.llm, model: e.target.value } })}
              placeholder="gpt-4o-mini"
              className="text-sm"
            />
          </div>
        )}
        {useDefault && (
          <p className="text-xs text-muted-foreground">
            Using platform default — provider and model are read from{' '}
            <a href="/settings" className="text-primary hover:underline">Settings → LLM</a> at runtime.
          </p>
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

function EmailManagerSettingsTab({ agent, token }: { agent: AgentDetail; token: string }) {
  const [activeSub, setActiveSub] = useState<EmailManagerTabKey>('setup');
  const [config, setConfig] = useState<EmailManagerConfig>(
    (agent.config as unknown as EmailManagerConfig) ?? {
      maxEmailsPerRun: 20,
      importantSenders: [],
      autoArchiveDomains: [],
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
  { key: 'suggestions', label: 'Suggestions', icon: Mail },
  { key: 'tasks', label: 'Tasks', icon: ListTodo },
  { key: 'setup', label: 'Setup', icon: BookOpen },
  { key: 'llm', label: 'LLM', icon: Cpu },
  { key: 'runtime', label: 'Runtime', icon: List },
] as const;

type TaskipInternalTabKey = typeof TASKIP_INTERNAL_TABS[number]['key'];

interface TaskipInternalConfig {
  llm?: { provider?: string; model?: string } | null;
}

// ─── Tasks sub-tab data ───────────────────────────────────────────────────────

const DAILY_SWEEP_TASKS = [
  {
    cohort: 'at_risk_paid',
    cohortColor: 'bg-red-100 text-red-700',
    schedule: 'Daily 9 am',
    action: 'insight_submit_message',
    actionColor: 'bg-blue-100 text-blue-700',
    scenario: 'retention_nudge',
    description: 'Find paid workspaces with CHS below 40 and propose a retention message before churn.',
  },
  {
    cohort: 'dormant_paid',
    cohortColor: 'bg-orange-100 text-orange-700',
    schedule: 'Daily 9 am',
    action: 'insight_submit_message',
    actionColor: 'bg-blue-100 text-blue-700',
    scenario: 'win_back',
    description: 'Identify paid workspaces with no activity in 30+ days and propose a win-back message.',
  },
  {
    cohort: 'trial_ready_free',
    cohortColor: 'bg-green-100 text-green-700',
    schedule: 'Daily 10 am',
    action: 'send_email',
    actionColor: 'bg-purple-100 text-purple-700',
    scenario: 'upgrade_prompt',
    description: 'Free workspaces with TRS above 70 — propose a personal upgrade email from Gmail.',
  },
  {
    cohort: 'serious_trial',
    cohortColor: 'bg-yellow-100 text-yellow-700',
    schedule: 'Daily 10 am',
    action: 'send_email',
    actionColor: 'bg-purple-100 text-purple-700',
    scenario: 'rescue_stalled',
    description: 'Active trials with THS below 40 that have stalled mid-setup — propose a rescue email.',
  },
  {
    cohort: 'healthy_paid',
    cohortColor: 'bg-emerald-100 text-emerald-700',
    schedule: 'Daily 11 am',
    action: 'insight_submit_message',
    actionColor: 'bg-blue-100 text-blue-700',
    scenario: 'celebrate_activation',
    description: 'Paid workspaces that hit their activation milestone in the last 24h — send a congratulation.',
  },
  {
    cohort: 'expired_trial_warm',
    cohortColor: 'bg-slate-100 text-slate-700',
    schedule: 'Every 3 days',
    action: 'send_email',
    actionColor: 'bg-purple-100 text-purple-700',
    scenario: 'invite_to_trial',
    description: 'Expired trials that were recently active — propose a re-engagement email with a limited offer.',
  },
];

const ONDEMAND_TASKS = [
  {
    label: 'Drill into a workspace',
    query: 'Show full overview and suggest outreach for workspace ',
    hint: 'append workspace UUID',
  },
  {
    label: 'Review user before a call',
    query: 'Look up  and summarize their history, subscriptions, and invoices',
    hint: 'insert email address',
  },
  {
    label: 'Check recent outreach for a workspace',
    query: 'Show suggestion activity and sent email history for workspace ',
    hint: 'append workspace UUID',
  },
  {
    label: 'Find all at-risk paid workspaces now',
    query: 'List at_risk_paid workspaces with CHS below 40 and propose retention outreach for the top 3',
    hint: 'runs immediately',
  },
  {
    label: 'Find free workspaces ready to upgrade',
    query: 'List trial_ready_free workspaces with TRS above 70 and propose upgrade emails',
    hint: 'runs immediately',
  },
  {
    label: 'Check hot leads in trial funnel',
    query: 'Find serious_trial workspaces with high activation score and propose follow-up',
    hint: 'runs immediately',
  },
  {
    label: 'Extend trial for a user',
    query: 'Look up  and extend their trial by 14 days',
    hint: 'insert email address — requires approval',
  },
  {
    label: 'Sync replies on sent emails',
    query: 'Sync replies for email ',
    hint: 'append email ID from inbox',
  },
];

const WEEKLY_TASKS = [
  {
    day: 'Monday',
    label: 'Health scan report',
    description: 'List all at_risk_paid and dormant_paid workspaces, count pending suggestions, and summarize emails sent this week.',
    query: 'Generate a weekly health scan: list at_risk_paid and dormant_paid workspaces, count of pending suggestions, and total emails sent this week',
  },
  {
    day: 'Wednesday',
    label: 'Conversion funnel check',
    description: 'List trial_ready_free workspaces with TRS above 60, show how many were contacted, and flag unconverted high-score workspaces.',
    query: 'Check the conversion funnel: list trial_ready_free workspaces with TRS above 60 and show which have been contacted and which have not',
  },
  {
    day: 'Friday',
    label: 'Suppression audit',
    description: 'List workspaces marked sweep_ignored after 3 consecutive skips. Decide whether any should be un-suppressed.',
    query: 'List workspaces that are suppressed (sweep_ignored) and show their skip history so I can decide which to un-suppress',
  },
];

function TaskipInternalTasksSubTab({ agentKey }: { agentKey: string }) {
  const navigate = useNavigate();

  function openChat(query: string) {
    navigate(`/agents/${agentKey}/chat`, { state: { query } });
  }

  return (
    <div className="space-y-6">

      {/* Daily automated sweeps */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <CalendarClock className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Daily automated sweeps</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          These run via the 6-hour BullMQ cron. Results appear in the Suggestions tab awaiting your approval — nothing is sent automatically.
        </p>
        <div className="space-y-3">
          {DAILY_SWEEP_TASKS.map((t) => (
            <div key={t.cohort} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/10 hover:bg-muted/20 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${t.cohortColor}`}>{t.cohort}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${t.actionColor}`}>{t.action}</span>
                  <span className="text-xs text-muted-foreground">scenario: {t.scenario}</span>
                </div>
                <p className="text-xs text-muted-foreground">{t.description}</p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0 pt-0.5">{t.schedule}</span>
            </div>
          ))}
        </div>
      </div>

      {/* On-demand tasks */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">On-demand tasks</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Click any task to open the chat with the query pre-filled. Edit it before sending.
        </p>
        <div className="space-y-2">
          {ONDEMAND_TASKS.map((t) => (
            <button
              key={t.label}
              onClick={() => openChat(t.query)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-border bg-muted/10 hover:bg-muted/30 transition-colors text-left group"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{t.label}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{t.hint}</p>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
            </button>
          ))}
        </div>
      </div>

      {/* Weekly reviews */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <RotateCcw className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Weekly reviews</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Run once a week in chat to get a structured report. Each opens chat with the query ready.
        </p>
        <div className="space-y-3">
          {WEEKLY_TASKS.map((t) => (
            <button
              key={t.label}
              onClick={() => openChat(t.query)}
              className="w-full flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/10 hover:bg-muted/30 transition-colors text-left group"
            >
              <span className="text-xs font-medium bg-muted px-1.5 py-0.5 rounded shrink-0 mt-0.5">{t.day}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{t.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors mt-0.5" />
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}

function TaskipInternalSetupSubTab({ agent }: { agent: AgentDetail }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-1">Taskip Internal — Setup Checklist</h3>
        <p className="text-xs text-muted-foreground mb-5">
          Two modes in one agent: (1) on-demand chat assistant — ask in plain English to look up users, subscriptions,
          invoices, or propose write actions; (2) proactive suggestion sweep — runs every 6 hours, scans Insight cohorts,
          generates LLM draft emails, and queues them here for your approval before anything is sent.
        </p>
        <div className="space-y-5">

          <SetupStep n={1} title="Configure Insight API credentials" done={agent.enabled}>
            <p>
              Go to <a href="/integrations" className="text-primary hover:underline"><strong>Integrations → Taskip Insight</strong></a> and set:
            </p>
            <ul className="list-disc list-inside ml-1 mt-1 space-y-0.5">
              <li><code className="bg-muted px-1 rounded text-xs">insight_base_url</code> — full module base URL including path, e.g. <code className="bg-muted px-1 rounded text-xs">https://api.taskip.net/api/internal/insight</code> (no trailing slash). All endpoints are appended to this, e.g. <code className="bg-muted px-1 rounded text-xs">/search?email=</code> or <code className="bg-muted px-1 rounded text-xs">/workspaces/uuid/overview</code>.</li>
              <li><code className="bg-muted px-1 rounded text-xs">insight_agent_key_primary</code> — primary agent key (X-Insight-Agent-Key header)</li>
              <li><code className="bg-muted px-1 rounded text-xs">insight_agent_key_secondary</code> — optional rotation key</li>
            </ul>
            <p className="mt-1">Use the <strong>Test connection</strong> button below to verify the API is reachable.</p>
          </SetupStep>

          <SetupStep n={2} title="Connect Gmail for personal outreach" done={false}>
            <p>
              Trial and free-tier suggestions are sent via Gmail (personal founder outreach).
              Go to <a href="/integrations" className="text-primary hover:underline"><strong>Integrations → Gmail</strong></a> and connect your Google Workspace account via OAuth.
            </p>
            <p className="mt-1">
              Paid-tier suggestions (at_risk_paid, dormant_paid) use Taskip's own messaging system — no Gmail needed for those.
            </p>
          </SetupStep>

          <SetupStep n={3} title="Trigger a manual sweep to verify end-to-end" done={false}>
            <p>
              Open the <strong>Suggestions</strong> tab and click <strong>Run sweep now</strong>.
              Within a few seconds you should see draft suggestion cards appear. Approve one to verify the Gmail
              and Taskip system send paths both work.
            </p>
            <ul className="list-disc list-inside ml-1 mt-1 space-y-0.5">
              <li>Gmail path: check Gmail Sent folder + <strong>Suggestions</strong> tab shows status Sent</li>
              <li>Taskip system path: check Insight AI messages log + status shows Sent</li>
            </ul>
          </SetupStep>

          <SetupStep n={4} title="Test the chat assistant" done={agent.enabled}>
            <p>Open the <strong>Chat</strong> page and type a question, for example:</p>
            <ul className="list-disc list-inside ml-1 mt-1 space-y-0.5">
              <li><em>Look up user john@example.com</em></li>
              <li><em>List at_risk_paid workspaces with score below 40</em></li>
              <li><em>Drill into workspace acme and propose a retention outreach</em></li>
            </ul>
          </SetupStep>

        </div>
      </div>

      <TaskipInsightStatusCard />

      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <p className="text-xs font-medium text-muted-foreground mb-1">Platform note</p>
        <p className="text-xs text-muted-foreground">
          Taskip DB read-only connection: set <code className="bg-muted px-1 rounded">taskip_db_url_readonly</code> in{' '}
          <a href="/settings" className="text-primary hover:underline">Settings</a> (shared with Taskip Trial agent).
          LLM provider is configured in the <strong>LLM</strong> sub-tab. OpenAI or DeepSeek are required — Gemini does not support tool calling. Leave on Default to inherit platform Settings.
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
        Server-to-server integration with Taskip's Insight module (cohort segmentation, workspace lifecycle, pending scenarios, message delivery).
        Credentials are read from <strong>Settings</strong> (<code className="bg-muted px-1 rounded text-xs">insight_base_url</code> and <code className="bg-muted px-1 rounded text-xs">insight_agent_key_primary</code>) — values are never returned here, only their presence is shown.
      </p>

      <div className="grid grid-cols-2 gap-2 text-xs mb-4">
        <Indicator label="insight_base_url" on={!!status?.baseUrl} value={status?.baseUrl ?? undefined} />
        <Indicator label="insight_agent_key_primary" on={!!status?.hasPrimary} />
        <Indicator label="insight_agent_key_secondary" on={!!status?.hasSecondary} optional />
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

  const useDefault = !config.llm?.provider;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold mb-2">LLM Configuration</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Only <strong>OpenAI</strong> and <strong>DeepSeek</strong> support tool calling — Gemini does not.
        Select <strong>Default</strong> to inherit the platform LLM settings ({' '}
        <a href="/settings" className="text-primary hover:underline">Settings → LLM</a>).
      </p>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-muted-foreground block mb-2">Provider</label>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => onChange({ llm: null })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                useDefault
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
              }`}
            >
              Default (from Settings)
            </button>
            {(['openai', 'deepseek'] as const).map((p) => (
              <button
                key={p}
                onClick={() => onChange({ llm: { provider: p, model: config.llm?.model ?? '' } })}
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
        {!useDefault && (
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
        )}
        {useDefault && (
          <p className="text-xs text-muted-foreground">
            Using platform default — provider and model are read from{' '}
            <a href="/settings" className="text-primary hover:underline">Settings → LLM</a> at runtime.
          </p>
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

// ─── Cohort tier colors ───────────────────────────────────────────────────────

const TIER_COLORS: Record<number, string> = {
  1: 'bg-red-100 text-red-700',
  2: 'bg-amber-100 text-amber-700',
  3: 'bg-blue-100 text-blue-700',
  4: 'bg-green-100 text-green-700',
};

const TIER_LABELS: Record<number, string> = {
  1: 'Cold',
  2: 'Warming',
  3: 'Active',
  4: 'Hot',
};

interface Suggestion {
  id: string;
  workspaceUuid: string;
  ownerEmail: string;
  ownerName: string;
  cohort: string;
  scenarioKey: string;
  score: number;
  scoreTier: number;
  lifecycleState: string;
  daysSinceSignup: number;
  subject: string;
  bodyMd: string;
  ctaText: string | null;
  ctaUrl: string | null;
  channel: string;
  status: string;
  failedReason: string | null;
  createdAt: string;
  recentActivity: { activityType: string; notes: string | null; createdAt: string }[];
}

function SuggestionsSubTab({ token }: { token: string }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'pending' | 'sent' | 'skipped' | 'failed'>('pending');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ subject: string; bodyMd: string; ctaText: string; ctaUrl: string } | null>(null);
  const [sweeping, setSweeping] = useState(false);

  const { data: suggestions = [], isLoading } = useQuery<Suggestion[]>({
    queryKey: ['taskip-suggestions', filter],
    queryFn: () => apiFetch(token, `/taskip-internal/suggestions?status=${filter}`),
    refetchInterval: 30_000,
  });

  const pending = suggestions.filter((s) => s.status === 'pending').length;

  async function runSweep() {
    setSweeping(true);
    try {
      await apiFetch(token, '/taskip-internal/suggestions/sweep', { method: 'POST' });
      setTimeout(() => qc.invalidateQueries({ queryKey: ['taskip-suggestions'] }), 3000);
    } finally {
      setSweeping(false);
    }
  }

  async function approve(id: string) {
    await apiFetch(token, `/taskip-internal/suggestions/${id}/approve`, { method: 'POST' });
    qc.invalidateQueries({ queryKey: ['taskip-suggestions'] });
  }

  async function skip(id: string) {
    await apiFetch(token, `/taskip-internal/suggestions/${id}/skip`, { method: 'POST' });
    qc.invalidateQueries({ queryKey: ['taskip-suggestions'] });
  }

  async function saveEdit(id: string) {
    if (!editDraft) return;
    await apiFetch(token, `/taskip-internal/suggestions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editDraft),
    });
    setEditing(null);
    setEditDraft(null);
    qc.invalidateQueries({ queryKey: ['taskip-suggestions'] });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Suggestions</span>
          {pending > 0 && (
            <span className="bg-primary text-primary-foreground text-xs font-semibold px-2 py-0.5 rounded-full">
              {pending}
            </span>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={runSweep} disabled={sweeping}>
          {sweeping ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
          Run sweep now
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex gap-1 flex-wrap">
        {(['all', 'pending', 'sent', 'skipped', 'failed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              filter === f
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : suggestions.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">No suggestions found.</div>
      ) : (
        <div className="space-y-3">
          {suggestions.map((s) => (
            <div key={s.id} className="border border-border rounded-xl bg-card overflow-hidden">
              {/* Card header */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TIER_COLORS[s.scoreTier] ?? 'bg-muted text-muted-foreground'}`}>
                      Tier {s.scoreTier} — {TIER_LABELS[s.scoreTier]}
                    </span>
                    <span className="text-xs border border-border rounded-full px-2 py-0.5 text-muted-foreground">
                      {s.cohort.replace(/_/g, ' ')}
                    </span>
                    <span className={`text-xs border rounded-full px-2 py-0.5 ${
                      s.channel === 'gmail' ? 'border-blue-300 text-blue-700' : 'border-purple-300 text-purple-700'
                    }`}>
                      {s.channel === 'gmail' ? 'Gmail' : 'Taskip System'}
                    </span>
                    <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                      s.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      s.status === 'sent' ? 'bg-green-100 text-green-700' :
                      s.status === 'skipped' ? 'bg-muted text-muted-foreground' :
                      s.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground'
                    }`}>
                      {s.status}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-semibold">{s.score}/100</div>
                    <div className="text-xs text-muted-foreground">{s.daysSinceSignup}d in {s.lifecycleState}</div>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground mb-2">
                  {s.ownerName} &lt;{s.ownerEmail}&gt;
                </div>

                {editing === s.id && editDraft ? (
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Subject</label>
                      <Input
                        value={editDraft.subject}
                        onChange={(e) => setEditDraft({ ...editDraft, subject: e.target.value })}
                        className="mt-0.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Body</label>
                      <textarea
                        value={editDraft.bodyMd}
                        onChange={(e) => setEditDraft({ ...editDraft, bodyMd: e.target.value })}
                        rows={6}
                        className="mt-0.5 w-full text-sm border border-input rounded-md px-3 py-2 bg-background resize-y"
                      />
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground">CTA text</label>
                        <Input
                          value={editDraft.ctaText}
                          onChange={(e) => setEditDraft({ ...editDraft, ctaText: e.target.value })}
                          className="mt-0.5 text-sm"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground">CTA URL</label>
                        <Input
                          value={editDraft.ctaUrl}
                          onChange={(e) => setEditDraft({ ...editDraft, ctaUrl: e.target.value })}
                          className="mt-0.5 text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="outline" onClick={() => { setEditing(null); setEditDraft(null); }}>Cancel</Button>
                      <Button size="sm" variant="outline" onClick={() => saveEdit(s.id)}>Save draft</Button>
                      <Button size="sm" onClick={() => saveEdit(s.id).then(() => approve(s.id))}>Save and approve</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-semibold mb-1">{s.subject}</p>
                    <p
                      className={`text-xs text-muted-foreground whitespace-pre-wrap ${expanded === s.id ? '' : 'line-clamp-2'}`}
                    >
                      {s.bodyMd}
                    </p>
                    {s.bodyMd.length > 120 && (
                      <button
                        onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                        className="text-xs text-primary mt-1"
                      >
                        {expanded === s.id ? 'Show less' : 'Show more'}
                      </button>
                    )}
                    {s.failedReason && (
                      <p className="text-xs text-red-600 mt-1">{s.failedReason}</p>
                    )}
                  </>
                )}

                {/* Action buttons */}
                {s.status === 'pending' && editing !== s.id && (
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" onClick={() => approve(s.id)}>Approve and send</Button>
                    <Button size="sm" variant="outline" onClick={() => {
                      setEditing(s.id);
                      setEditDraft({ subject: s.subject, bodyMd: s.bodyMd, ctaText: s.ctaText ?? '', ctaUrl: s.ctaUrl ?? '' });
                    }}>Edit</Button>
                    <Button size="sm" variant="outline" onClick={() => skip(s.id)}>Skip</Button>
                  </div>
                )}
              </div>

              {/* Activity section */}
              {s.recentActivity.length > 0 && (
                <div className="border-t border-border bg-muted/30 px-4 py-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Recent activity</p>
                  <div className="space-y-1">
                    {s.recentActivity.map((a, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <span className="shrink-0">{new Date(a.createdAt).toLocaleDateString()}</span>
                        <span>{a.activityType.replace(/_/g, ' ')}</span>
                        {a.notes && <span className="text-muted-foreground/70">— {a.notes}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskipInternalSettingsTab({ agent, token }: { agent: AgentDetail; token: string }) {
  const [activeSub, setActiveSub] = useState<TaskipInternalTabKey>('suggestions');
  const [config, setConfig] = useState<TaskipInternalConfig>(
    (agent.config as unknown as TaskipInternalConfig) ?? {}
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

      {activeSub === 'suggestions' && <SuggestionsSubTab token={token} />}
      {activeSub === 'tasks' && <TaskipInternalTasksSubTab agentKey={agent.key} />}
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

  if (agent.key === 'linkedin') return <LinkedInSettingsTab agent={agent} token={token} />;

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
  const apiOrigin = ((import.meta.env.VITE_API_URL ?? '') as string).replace(/\/$/, '') || window.location.origin;
  const inboundUrl = `${apiOrigin}/livechat/inbound?t=<livechat_inbound_token>`;
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
        <SetupStep n={5} title="Enable email reply-to-thread (optional)" done={false}>
          <p>When enabled, visitors who receive a conversation transcript can reply by email — the reply lands back in the live chat session automatically.</p>
          <p className="mt-2 font-medium">1. Configure three settings in <a href="/integrations?tab=ses" className="text-primary hover:underline">Integrations → Email (SES)</a>:</p>
          <ul className="list-disc list-inside space-y-1 ml-1 mt-1 text-xs">
            <li><strong>Reply Domain</strong> — subdomain where SES receives inbound email (e.g. <code className="bg-muted px-1 rounded">reply.taskip.net</code>). MX record must point to the AWS SES inbound SMTP endpoint for your region.</li>
            <li><strong>Reply HMAC Secret</strong> — any random 32+ character string. Signs reply addresses so they cannot be forged.</li>
            <li><strong>Inbound Webhook Token</strong> — any random string. Becomes the <code className="bg-muted px-1 rounded">?t=</code> query parameter on the SNS endpoint below.</li>
          </ul>
          <p className="mt-2 font-medium">2. Create an SES Receipt Rule:</p>
          <ol className="list-decimal list-inside space-y-0.5 ml-1 mt-1 text-xs">
            <li>In SES → Configuration → Email receiving, add a receipt rule for <code className="bg-muted px-1 rounded">transcript+*@&lt;Reply Domain&gt;</code></li>
            <li>Add an <strong>SNS</strong> action — subscribe to an SNS topic with an HTTPS endpoint pointing at:</li>
          </ol>
          <div className="flex items-center gap-2 bg-muted/60 border border-border rounded-lg px-3 py-2 mt-1">
            <code className="text-xs font-mono flex-1 break-all text-foreground">{inboundUrl}</code>
            <button
              onClick={() => navigator.clipboard.writeText(inboundUrl)}
              className="shrink-0 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border bg-background"
            >Copy</button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Replace <code className="bg-muted px-1 rounded">&lt;livechat_inbound_token&gt;</code> with the actual value you set above. Enable "Include original headers" in the SES action.</p>
        </SetupStep>
      </>}
    />
  );
}

function SupportKbImportSection({ token }: { token: string }) {
  const [ticketId, setTicketId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; title?: string; entryId?: string; error?: string } | null>(null);

  async function handleImport() {
    if (!ticketId.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/support/kb-import', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ crmTicketId: Number(ticketId.trim()) }),
      });
      const data = await res.json();
      setResult(data);
      if (data.ok) setTicketId('');
    } catch (err) {
      setResult({ ok: false, error: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4 space-y-3">
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Feed KB from CRM Ticket</p>
        <p className="text-xs text-muted-foreground mt-1">Enter a resolved CRM ticket ID. The agent will fetch the full conversation and generate a Q&A knowledge base entry from it.</p>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={ticketId}
          onChange={e => setTicketId(e.target.value)}
          placeholder="CRM ticket ID (e.g. 1445)"
          className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
          onKeyDown={e => e.key === 'Enter' && handleImport()}
        />
        <button
          onClick={handleImport}
          disabled={loading || !ticketId.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          {loading ? 'Importing...' : 'Import to KB'}
        </button>
      </div>
      {result && (
        result.ok ? (
          <div className="text-xs text-emerald-400">
            Saved: <span className="font-medium">{result.title}</span>
          </div>
        ) : (
          <div className="text-xs text-red-400">{result.error}</div>
        )
      )}
    </div>
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

      <SetupStep n={1} title="Configure CRM API credentials" done={getSetting('support_crm_base_url')?.stored === true && getSetting('support_crm_api_key')?.stored === true && getSetting('support_agent_id')?.stored === true}>
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
          <HrmSettingField
            label="Agent ID"
            settingKey="support_agent_id"
            placeholder="Numeric agent/operator ID from CRM (required for replies)"
            token={token}
            onSave={saveSetting}
            stored={getSetting('support_agent_id')?.stored}
          />
          {!getSetting('support_agent_id')?.stored && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
              Agent ID is required — without it all CRM replies will fail. Find it in crm.xgenious.com under your agent/operator profile.
            </div>
          )}
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

      <SupportKbImportSection token={token} />
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


// ─── LinkedIn Account Card ────────────────────────────────────────────────────

function AccountCard({ acc, todayRow, onPatch }: { acc: any; todayRow: any; onPatch: (body: Record<string, any>) => void }) {
  const [limits, setLimits] = useState({
    dailyConnectionsLimit: acc.dailyConnectionsLimit ?? '',
    dailyCommentsLimit: acc.dailyCommentsLimit ?? '',
    dailyDmsLimit: acc.dailyDmsLimit ?? '',
  });
  const [dirty, setDirty] = useState(false);

  function handleLimitChange(key: string, value: string) {
    setLimits(l => ({ ...l, [key]: value }));
    setDirty(true);
  }

  function saveLimits() {
    const body: Record<string, number | null> = {};
    for (const [k, v] of Object.entries(limits)) {
      body[k] = v === '' ? null : Number(v);
    }
    onPatch(body);
    setDirty(false);
  }

  const ACTIONS = [
    { enableKey: 'enableConnections', label: 'Connections', dailyKey: 'dailyConnectionsLimit', defaultVal: 5, statKey: 'connections' },
    { enableKey: 'enableComments',   label: 'Feed comments', dailyKey: 'dailyCommentsLimit',   defaultVal: 10, statKey: 'comments' },
    { enableKey: 'enableDMs',        label: 'DM outreach',  dailyKey: 'dailyDmsLimit',         defaultVal: 5, statKey: 'dms' },
  ] as const;

  return (
    <div className="rounded-lg border border-border bg-background/50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div>
          <p className="text-sm font-medium">{acc.label}</p>
          <p className="text-xs text-muted-foreground">{acc.unipileAccountId}</p>
        </div>
        <button
          onClick={() => onPatch({ isActive: !acc.isActive })}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${acc.isActive ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20' : 'border-border bg-muted text-muted-foreground hover:bg-muted/80'}`}
        >
          {acc.isActive ? 'Active' : 'Inactive'}
        </button>
      </div>

      <div className="grid grid-cols-3 divide-x divide-border/50 border-b border-border/50">
        {ACTIONS.map(({ enableKey, label }) => {
          const enabled = acc[enableKey] !== false;
          return (
            <button
              key={enableKey}
              onClick={() => onPatch({ [enableKey]: !enabled })}
              className={`flex flex-col items-center gap-1 px-3 py-2.5 text-xs transition-colors ${enabled ? 'text-foreground hover:bg-muted/30' : 'text-muted-foreground hover:bg-muted/30'}`}
            >
              <span className={`w-7 h-3.5 rounded-full relative transition-colors ${enabled ? 'bg-primary' : 'bg-muted'}`}>
                <span className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-background shadow transition-all ${enabled ? 'left-[calc(100%-11px)]' : 'left-0.5'}`} />
              </span>
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      <div className="px-4 py-3">
        <div className="grid grid-cols-3 gap-3 text-xs mb-3">
          {ACTIONS.map(({ dailyKey, label, defaultVal, statKey }) => {
            const cap = limits[dailyKey] !== '' ? Number(limits[dailyKey]) : defaultVal;
            const used = todayRow?.[statKey] ?? 0;
            const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
            const full = used >= cap;
            return (
              <div key={dailyKey}>
                <label className="text-muted-foreground block mb-1">{label} / day</label>
                <input
                  type="number"
                  min={1}
                  placeholder={String(defaultVal)}
                  value={limits[dailyKey]}
                  onChange={e => handleLimitChange(dailyKey, e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-2 py-1 text-center text-xs"
                />
                <div className="mt-1.5 flex items-center gap-1.5">
                  <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${full ? 'bg-red-500' : 'bg-primary'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className={`text-[10px] tabular-nums ${full ? 'text-red-400' : 'text-muted-foreground'}`}>
                    {used}/{cap}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        {dirty && (
          <button
            onClick={saveLimits}
            className="text-xs px-3 py-1 rounded-md bg-primary text-primary-foreground hover:opacity-90"
          >
            Save limits
          </button>
        )}
      </div>
    </div>
  );
}

// ─── LinkedIn Settings Tab ────────────────────────────────────────────────────

type LinkedInTab = 'accounts' | 'niches' | 'leads' | 'connections' | 'posts' | 'reports' | 'docs' | 'config';

function LinkedInSettingsTab({ agent, token }: { agent: AgentDetail; token: string }) {
  const [tab, setTab] = useState<LinkedInTab>('accounts');
  const qc = useQueryClient();

  const { data: accounts = [] } = useQuery<any[]>({
    queryKey: ['linkedin-accounts'],
    queryFn: () => apiFetch(token, '/linkedin/accounts'),
  });
  const { data: niches = [], refetch: refetchNiches } = useQuery<any[]>({
    queryKey: ['linkedin-niches'],
    queryFn: () => apiFetch(token, '/linkedin/niches'),
  });
  const { data: leads = [] } = useQuery<any[]>({
    queryKey: ['linkedin-leads'],
    queryFn: () => apiFetch(token, '/linkedin/leads'),
  });
  const { data: connections = [] } = useQuery<any[]>({
    queryKey: ['linkedin-connections'],
    queryFn: () => apiFetch(token, '/linkedin/connection-requests'),
  });
  const { data: posts = [] } = useQuery<any[]>({
    queryKey: ['linkedin-posts'],
    queryFn: () => apiFetch(token, '/linkedin/posts'),
  });
  const { data: dailyReport = [] } = useQuery<any[]>({
    queryKey: ['linkedin-reports-daily'],
    queryFn: () => apiFetch(token, '/linkedin/reports/daily'),
    enabled: tab === 'reports' || tab === 'accounts',
    refetchInterval: 60_000,
  });

  const navigate = useNavigate();
  const [syncResult, setSyncResult] = useState<{ synced: number } | null>(null);
  const syncMutation = useMutation({
    mutationFn: () => apiFetch(token, '/linkedin/accounts/sync', { method: 'POST' }),
    onSuccess: (data: any) => {
      setSyncResult({ synced: data?.synced ?? 0 });
      qc.invalidateQueries({ queryKey: ['linkedin-accounts'] });
    },
  });

  const [runningAction, setRunningAction] = useState<string | null>(null);
  const triggerAction = async (actionType: 'comments' | 'connections' | 'dms') => {
    setRunningAction(actionType);
    try {
      const run = await apiFetch(token, `/agents/${agent.key}/trigger`, {
        method: 'POST',
        body: JSON.stringify({ triggerType: 'MANUAL', payload: { actionType } }),
      });
      navigate(`/runs/${(run as any).id}`);
    } finally {
      setRunningAction(null);
    }
  };

  const patchAccountMutation = useMutation({
    mutationFn: ({ id, ...body }: any) => apiFetch(token, `/linkedin/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['linkedin-accounts'] }),
  });

  const [newNiche, setNewNiche] = useState({ name: '', description: '', icpDescription: '', keywords: '', targetJobTitles: '', dailyConnectLimit: 5, accountId: '' });
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateCategory, setTemplateCategory] = useState<string>(NICHE_CATEGORIES[0]);
  const [templateSearch, setTemplateSearch] = useState('');

  const applyTemplate = (tpl: NicheTemplate) => {
    setNewNiche(n => ({
      ...n,
      name: tpl.name,
      description: tpl.description,
      icpDescription: tpl.icpDescription,
      keywords: tpl.keywords.join(', '),
      targetJobTitles: tpl.targetJobTitles.join(', '),
      dailyConnectLimit: tpl.dailyConnectLimit,
    }));
    setShowTemplates(false);
  };

  const filteredTemplates = NICHE_TEMPLATES.filter(t => {
    const matchesCat = t.category === templateCategory;
    if (!templateSearch) return matchesCat;
    const q = templateSearch.toLowerCase();
    return matchesCat && (t.name.toLowerCase().includes(q) || t.keywords.some(k => k.includes(q)));
  });

  const createNicheMutation = useMutation({
    mutationFn: (data: any) => apiFetch(token, '/linkedin/niches', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { refetchNiches(); setNewNiche({ name: '', description: '', icpDescription: '', keywords: '', targetJobTitles: '', dailyConnectLimit: 5, accountId: '' }); },
  });

  const deleteNicheMutation = useMutation({
    mutationFn: (id: string) => apiFetch(token, `/linkedin/niches/${id}`, { method: 'DELETE' }),
    onSuccess: () => refetchNiches(),
  });

  const TABS: { key: LinkedInTab; label: string }[] = [
    { key: 'accounts', label: 'Accounts' },
    { key: 'niches', label: 'Niches' },
    { key: 'leads', label: 'Leads' },
    { key: 'connections', label: 'Connections' },
    { key: 'posts', label: 'Posts' },
    { key: 'reports', label: 'Reports' },
    { key: 'config', label: 'Config' },
    { key: 'docs', label: 'Docs' },
  ];

  const STATUS_COLORS: Record<string, string> = {
    pending: 'bg-yellow-500/15 text-yellow-300',
    sent: 'bg-blue-500/15 text-blue-300',
    accepted: 'bg-emerald-500/15 text-emerald-300',
    declined: 'bg-red-500/15 text-red-300',
    failed: 'bg-red-500/15 text-red-300',
    new: 'bg-sky-500/15 text-sky-300',
    dm_sent: 'bg-violet-500/15 text-violet-300',
    connected: 'bg-emerald-500/15 text-emerald-300',
    none: 'bg-muted text-muted-foreground',
    posted: 'bg-emerald-500/15 text-emerald-300',
    skipped: 'bg-muted text-muted-foreground',
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'accounts' && (
        <div className="space-y-4">

          {/* Manual action triggers */}
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground mb-3">Run individual action now — each fires independently, same Telegram approval flow</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { actionType: 'comments' as const,    label: 'Run Comments',    desc: 'Scan feed + draft 3 comments' },
                { actionType: 'connections' as const, label: 'Run Connections', desc: 'Search people + send up to 3 invites' },
                { actionType: 'dms' as const,         label: 'Run DMs',         desc: 'Message up to 3 connected leads' },
              ]).map(({ actionType, label, desc }) => (
                <button
                  key={actionType}
                  onClick={() => triggerAction(actionType)}
                  disabled={!!runningAction || !agent.enabled}
                  className="flex flex-col gap-0.5 rounded-lg border border-border bg-background/50 px-3 py-2.5 text-left text-xs transition-colors hover:bg-muted/30 disabled:opacity-50"
                >
                  <span className="font-medium flex items-center gap-1.5">
                    {runningAction === actionType && <span className="inline-block w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />}
                    {label}
                  </span>
                  <span className="text-muted-foreground">{desc}</span>
                </button>
              ))}
            </div>
            {!agent.enabled && (
              <p className="text-xs text-amber-400 mt-2">Enable the agent in the General tab before running.</p>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">LinkedIn Accounts</h3>
              <Button size="sm" variant="outline" onClick={() => { setSyncResult(null); syncMutation.mutate(); }} disabled={syncMutation.isPending}>
                {syncMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                <span className="ml-1.5">Sync from Unipile</span>
              </Button>
            </div>
            {syncMutation.isError && (
              <p className="text-xs text-destructive mb-3">{(syncMutation.error as Error)?.message ?? 'Sync failed'}</p>
            )}
            {syncResult && syncResult.synced === 0 && accounts.length === 0 && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 mb-3 text-xs text-amber-300">
                No LinkedIn accounts found in Unipile. Go to{' '}
                <a href="https://app.unipile.com" target="_blank" rel="noopener noreferrer" className="underline">app.unipile.com</a>
                {' '}and connect your LinkedIn account first, then sync again.
              </div>
            )}
            {syncResult && syncResult.synced > 0 && (
              <p className="text-xs text-emerald-400 mb-3">{syncResult.synced} account{syncResult.synced !== 1 ? 's' : ''} synced.</p>
            )}
            {accounts.length === 0 && !syncResult ? (
              <p className="text-sm text-muted-foreground">No accounts synced yet. Click "Sync from Unipile" to import your connected LinkedIn accounts.</p>
            ) : accounts.length === 0 ? null : (
              <div className="space-y-3">
                {accounts.map((acc: any) => {
                  const today = new Date().toISOString().slice(0, 10);
                  const todayRow = dailyReport.find((r: any) => r.accountId === acc.id && r.date === today) ?? null;
                  return <AccountCard key={acc.id} acc={acc} todayRow={todayRow} onPatch={(body) => patchAccountMutation.mutate({ id: acc.id, ...body })} />;
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'niches' && (
        <div className="space-y-4">
          {showTemplates ? (
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold">Choose a Template</h3>
                <button onClick={() => setShowTemplates(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <Input
                value={templateSearch}
                onChange={e => setTemplateSearch(e.target.value)}
                placeholder="Search templates..."
                className="text-sm mb-3"
              />
              <div className="flex gap-1.5 flex-wrap mb-4">
                {NICHE_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => { setTemplateCategory(cat); setTemplateSearch(''); }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${templateCategory === cat ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-2 max-h-[420px] overflow-y-auto pr-1">
                {filteredTemplates.map(tpl => (
                  <button
                    key={tpl.name}
                    onClick={() => applyTemplate(tpl)}
                    className="text-left p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-accent/30 transition-all"
                  >
                    <p className="text-sm font-medium">{tpl.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{tpl.description}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {tpl.keywords.slice(0, 5).map(kw => (
                        <span key={kw} className="text-xs bg-muted px-1.5 py-0.5 rounded">{kw}</span>
                      ))}
                      {tpl.keywords.length > 5 && (
                        <span className="text-xs text-muted-foreground px-1.5 py-0.5">+{tpl.keywords.length - 5}</span>
                      )}
                    </div>
                  </button>
                ))}
                {filteredTemplates.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">No templates match your search.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold">Add Niche</h3>
                <button
                  onClick={() => setShowTemplates(true)}
                  className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors border border-primary/30 rounded-lg px-2.5 py-1.5 hover:bg-primary/5"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Use Template (35 prebuilt)
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Account</label>
                  <select
                    value={newNiche.accountId}
                    onChange={e => setNewNiche(n => ({ ...n, accountId: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select account</option>
                    {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Niche name</label>
                  <Input value={newNiche.name} onChange={e => setNewNiche(n => ({ ...n, name: e.target.value }))} placeholder="e.g. SaaS Founders" className="text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground block mb-1">ICP description (used for LLM scoring)</label>
                  <textarea
                    value={newNiche.icpDescription}
                    onChange={e => setNewNiche(n => ({ ...n, icpDescription: e.target.value }))}
                    placeholder="Describe your ideal customer: role, company size, pain points, goals..."
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Keywords (comma-separated)</label>
                  <Input value={newNiche.keywords} onChange={e => setNewNiche(n => ({ ...n, keywords: e.target.value }))} placeholder="saas, founder, startup" className="text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Target job titles (comma-separated)</label>
                  <Input value={newNiche.targetJobTitles} onChange={e => setNewNiche(n => ({ ...n, targetJobTitles: e.target.value }))} placeholder="CEO, Founder, Head of Product" className="text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Daily connection limit</label>
                  <Input type="number" min={1} max={20} value={newNiche.dailyConnectLimit} onChange={e => setNewNiche(n => ({ ...n, dailyConnectLimit: Number(e.target.value) }))} className="text-sm" />
                </div>
              </div>
              <Button
                size="sm"
                className="mt-4"
                disabled={!newNiche.name || !newNiche.accountId || createNicheMutation.isPending}
                onClick={() => createNicheMutation.mutate({
                  accountId: newNiche.accountId,
                  name: newNiche.name,
                  icpDescription: newNiche.icpDescription || null,
                  keywords: newNiche.keywords.split(',').map(s => s.trim()).filter(Boolean),
                  targetJobTitles: newNiche.targetJobTitles.split(',').map(s => s.trim()).filter(Boolean),
                  dailyConnectLimit: newNiche.dailyConnectLimit,
                })}
              >
                {createNicheMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
                Add Niche
              </Button>
            </div>
          )}

          {niches.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold mb-4">Active Niches</h3>
              <div className="space-y-3">
                {niches.map((n: any) => (
                  <div key={n.id} className="p-3 rounded-lg border border-border bg-background/50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{n.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.icpDescription ?? n.description ?? '—'}</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {(n.keywords ?? []).map((kw: string) => (
                            <span key={kw} className="text-xs bg-muted px-1.5 py-0.5 rounded">{kw}</span>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5">{n.dailyConnectLimit} connections/day</p>
                      </div>
                      <button
                        onClick={() => deleteNicheMutation.mutate(n.id)}
                        className="ml-3 text-muted-foreground hover:text-red-400 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'leads' && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Leads ({leads.length})</h3>
          {leads.length === 0 ? (
            <p className="text-sm text-muted-foreground">No leads yet. The agent will populate leads automatically from the niche search pipeline.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">Name</th>
                    <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">Headline</th>
                    <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">Connection</th>
                    <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">ICP Score</th>
                    <th className="pb-2 text-xs font-medium text-muted-foreground">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {leads.map((l: any) => (
                    <tr key={l.id}>
                      <td className="py-2.5 pr-4">
                        <a href={l.profileUrl} target="_blank" rel="noreferrer" className="font-medium hover:text-primary transition-colors">
                          {l.name ?? '—'}
                        </a>
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground max-w-[200px] truncate">{l.headline ?? '—'}</td>
                      <td className="py-2.5 pr-4">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_COLORS[l.connectionStatus] ?? 'bg-muted text-muted-foreground'}`}>
                          {l.connectionStatus}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_COLORS[l.status] ?? 'bg-muted text-muted-foreground'}`}>
                          {l.status}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{l.icpScore != null ? (l.icpScore * 100).toFixed(0) + '%' : '—'}</td>
                      <td className="py-2.5 text-xs text-muted-foreground max-w-[250px] truncate">{l.icpReason ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'connections' && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Connection Requests ({connections.length})</h3>
          {connections.length === 0 ? (
            <p className="text-sm text-muted-foreground">No connection requests sent yet. The agent will propose these on each 4h cycle once niches are configured.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">Name</th>
                    <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">Headline</th>
                    <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">ICP Score</th>
                    <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">Note sent</th>
                    <th className="pb-2 text-xs font-medium text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {connections.map((c: any) => (
                    <tr key={c.id}>
                      <td className="py-2.5 pr-4">
                        <a href={c.profileUrl ?? '#'} target="_blank" rel="noreferrer" className="font-medium hover:text-primary transition-colors">
                          {c.profileName}
                        </a>
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground max-w-[180px] truncate">{c.profileHeadline ?? '—'}</td>
                      <td className="py-2.5 pr-4">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_COLORS[c.status] ?? 'bg-muted text-muted-foreground'}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{c.icpScore != null ? (c.icpScore * 100).toFixed(0) + '%' : '—'}</td>
                      <td className="py-2.5 pr-4 text-xs text-muted-foreground max-w-[200px] truncate">{c.noteSent ?? '—'}</td>
                      <td className="py-2.5 text-xs text-muted-foreground">{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'posts' && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Feed Posts Engaged ({posts.length})</h3>
          {posts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No posts tracked yet.</p>
          ) : (
            <div className="space-y-3">
              {posts.map((p: any) => (
                <div key={p.id} className="p-3 rounded-lg border border-border bg-background/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">{p.authorName ?? '—'}</p>
                      <p className="text-sm mt-0.5 line-clamp-2">{p.content?.slice(0, 200)}</p>
                      {p.draftComment && (
                        <p className="text-xs text-primary mt-1.5 italic">"{p.draftComment.slice(0, 150)}"</p>
                      )}
                    </div>
                    <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full ${STATUS_COLORS[p.status] ?? 'bg-muted text-muted-foreground'}`}>
                      {p.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'reports' && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-1">Daily activity — last 14 days</h3>
          <p className="text-xs text-muted-foreground mb-4">Actions sent per account per day.</p>
          {dailyReport.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Date</th>
                    <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Account</th>
                    <th className="text-right py-2 pr-4 text-muted-foreground font-medium">Connections</th>
                    <th className="text-right py-2 pr-4 text-muted-foreground font-medium">Comments</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">DMs</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyReport.map((row: any, i: number) => (
                    <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                      <td className="py-2 pr-4 tabular-nums">{row.date}</td>
                      <td className="py-2 pr-4 font-medium">{row.accountLabel}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        <span className={row.connections > 0 ? 'text-emerald-400' : 'text-muted-foreground'}>{row.connections}</span>
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        <span className={row.comments > 0 ? 'text-blue-400' : 'text-muted-foreground'}>{row.comments}</span>
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        <span className={row.dms > 0 ? 'text-violet-400' : 'text-muted-foreground'}>{row.dms}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'docs' && (
        <div className="space-y-4">

          {/* Overview */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold mb-1">What this agent does</h3>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              Runs every 4 hours. Searches LinkedIn for agency owners and freelancers, scores them with an LLM against your ICP, sends personalised connection requests, drafts comments on relevant feed posts, and sends outreach DMs to accepted connections — all proposed via Telegram before anything is sent.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['Connection requests', 'Find + score leads → draft personalised note → Telegram approve → send'],
                ['Feed comments', 'Scan feed for agency/freelance topics → draft comment → Telegram approve → post'],
                ['DM outreach', 'Accepted connections → draft Taskip pitch DM → Telegram approve → send'],
                ['Lead tracking', 'Leads, ICP scores, connection status stored — visible in Leads tab'],
              ].map(([title, desc]) => (
                <div key={title} className="rounded-lg border border-border bg-background/50 p-3">
                  <p className="text-xs font-medium mb-0.5">{title}</p>
                  <p className="text-[11px] text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Multi-account strategy */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold mb-1">Multi-account strategy</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Each LinkedIn account in Unipile can target a different audience. Connect multiple accounts and assign a dedicated niche to each — keeping outreach separate and personalised per segment.
            </p>
            <div className="space-y-2">
              {[
                ['Account A', 'Agency Owners', 'Targets digital/marketing/web agency owners with 2–20 employees looking to scale'],
                ['Account B', 'Freelancers', 'Targets independent developers, designers, and consultants looking for client/project tools'],
                ['Account C', 'Any other segment', 'e.g. SaaS founders, startup CTOs, e-commerce store owners — whatever fits your next campaign'],
              ].map(([account, niche, desc]) => (
                <div key={account} className="flex gap-3 p-3 rounded-lg border border-border bg-background/50">
                  <div className="w-20 shrink-0">
                    <p className="text-[11px] font-semibold text-primary">{account}</p>
                    <p className="text-[11px] font-medium">{niche}</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-3">Each niche in the <strong>Niches</strong> tab has an Account selector — assign one niche per account or mix freely.</p>
          </div>

          {/* Setup checklist */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold mb-4">Setup checklist</h3>
            <div className="space-y-5">
              <SetupStep n={1} title="Configure Unipile API credentials" done={false}>
                <ol className="list-decimal list-inside space-y-1 ml-1">
                  <li>Sign up at <strong>app.unipile.com</strong> and connect your LinkedIn account(s) under <strong>Accounts</strong></li>
                  <li>Go to <strong>Settings → API Keys</strong>, generate a key, and copy your <strong>DSN</strong> (e.g. <code className="bg-muted px-1 rounded">api33.unipile.com:16308</code>)</li>
                  <li>In Cortex OS go to <strong>Integrations → Unipile</strong> and save the API Key and DSN</li>
                  <li>Click <strong>Test connection</strong> to verify — it should show "Connected — N accounts linked"</li>
                </ol>
              </SetupStep>
              <SetupStep n={2} title="Sync LinkedIn accounts" done={accounts.length > 0}>
                <ol className="list-decimal list-inside space-y-1 ml-1">
                  <li>Go to the <strong>Accounts</strong> tab above</li>
                  <li>Click <strong>Sync from Unipile</strong> — your connected LinkedIn accounts will be imported</li>
                  <li>Each account shows its Unipile ID and active/inactive status</li>
                </ol>
              </SetupStep>
              <SetupStep n={3} title="Create at least one niche" done={niches.length > 0}>
                <ol className="list-decimal list-inside space-y-1 ml-1">
                  <li>Go to the <strong>Niches</strong> tab</li>
                  <li>Fill in <strong>Name</strong> (internal label), <strong>Keywords</strong> (LinkedIn search terms, comma-separated), <strong>Target job titles</strong></li>
                  <li>Write an <strong>ICP description</strong> — prose description of your ideal customer; the LLM scores each candidate 0–1 against this (threshold 0.65 by default)</li>
                  <li>Set <strong>Daily connect limit</strong> (default 5 per niche per day) to stay within LinkedIn limits</li>
                </ol>
              </SetupStep>
              <SetupStep n={4} title="Configure feed comment topics" done={false}>
                <p>Open <strong>Agent Config</strong> (gear icon on this page) and set:</p>
                <ul className="list-disc list-inside space-y-0.5 ml-1 mt-1">
                  <li><code className="bg-muted px-1 rounded">targetTopics</code> — array of keywords to match feed posts (e.g. <code className="bg-muted px-1 rounded">["SaaS","productivity","startup"]</code>)</li>
                  <li><code className="bg-muted px-1 rounded">commentTone</code> — style instruction for the LLM (e.g. <code className="bg-muted px-1 rounded">"professional, concise, adds value"</code>)</li>
                  <li><code className="bg-muted px-1 rounded">maxCommentsPerRun</code> — how many comments to draft per 4-hour cycle (default 3)</li>
                  <li><code className="bg-muted px-1 rounded">maxDMsPerRun</code> — max outreach DMs drafted per cycle (default 3)</li>
                </ul>
              </SetupStep>
              <SetupStep n={5} title="Enable the agent and do a test run" done={agent.enabled}>
                <ol className="list-decimal list-inside space-y-1 ml-1">
                  <li>Toggle the agent to <strong>Enabled</strong> at the top of this page</li>
                  <li>Click <strong>Run now</strong> (manual trigger) for the first test</li>
                  <li>Watch for Telegram messages — approve or reject each proposed action</li>
                  <li>Approved actions are executed immediately; rejected ones are logged and skipped</li>
                </ol>
              </SetupStep>
            </div>
          </div>

          {/* Tab guide */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold mb-3">Tab guide</h3>
            <div className="space-y-3">
              {[
                ['Accounts', 'Shows all LinkedIn accounts imported from Unipile. Use Sync to refresh. Each account is used as the sender for connections and DMs.'],
                ['Niches', 'Define target audiences. Each niche has keywords (used to search LinkedIn), job title filters, an ICP description for LLM scoring, and a daily connection cap.'],
                ['Leads', 'All people found and scored by the agent. Shows ICP score, connection status (none → pending → connected), and outreach status. Leads with connectionStatus = connected become eligible for DMs.'],
                ['Connections', 'Tracks every connection request sent — status (pending / sent / accepted / declined), the personalised note, and when it was sent.'],
                ['Posts', 'Feed posts the agent found and drafted comments for. Shows draft, approval status, and post timestamp.'],
              ].map(([tab, desc]) => (
                <div key={tab} className="flex gap-3">
                  <span className="text-xs font-semibold text-primary w-24 shrink-0 pt-0.5">{tab}</span>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Limits & tips */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold mb-3">Limits and tips</h3>
            <ul className="space-y-1.5 text-xs text-muted-foreground list-disc list-inside">
              <li>LinkedIn allows roughly 100–200 connection requests per week on a standard account — keep daily limits low (5–10 per niche)</li>
              <li>ICP score threshold is 0.65 by default — raise it in config (<code className="bg-muted px-1 rounded">icpScoreThreshold</code>) to target only the best-fit leads</li>
              <li>DMs are only proposed for people with <code className="bg-muted px-1 rounded">connectionStatus = connected</code> — the agent naturally gates outreach behind accepted connections</li>
              <li>All actions require Telegram approval — nothing is sent automatically without your sign-off</li>
              <li>The agent deduplicates leads by profile URL — running it multiple times on the same search won't create duplicate records</li>
            </ul>
          </div>

        </div>
      )}

      {tab === 'config' && <Phase4GeneralSubTab agent={agent} token={token} />}
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

type CanvaTab = 'renders' | 'brands' | 'design-samples' | 'settings' | 'setup';

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

const CANVA_TAB_KEY = 'canva_active_tab';

function CanvaAgentPage({ agent, token }: { agent: AgentDetail; token: string }) {
  const [tab, setTab] = useState<CanvaTab>(() => {
    const saved = sessionStorage.getItem(CANVA_TAB_KEY) as CanvaTab | null;
    return (saved && ['renders', 'brands', 'design-samples', 'settings', 'setup'].includes(saved)) ? saved : 'renders';
  });

  function switchTab(t: CanvaTab) {
    sessionStorage.setItem(CANVA_TAB_KEY, t);
    setTab(t);
  }

  const tabs: { key: CanvaTab; label: string }[] = [
    { key: 'renders', label: 'Post Renders' },
    { key: 'brands', label: 'Brands' },
    { key: 'design-samples', label: 'Templates' },
    { key: 'settings', label: 'Settings' },
    { key: 'setup', label: 'Setup' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 border border-border rounded-lg p-1 bg-muted/30 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => switchTab(t.key)}
            className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'renders' && <PostRendersTab token={token} />}
      {tab === 'brands' && <CanvaBrandsTab token={token} />}
      {tab === 'design-samples' && <DesignSamplesTab token={token} />}
      {tab === 'settings' && <CanvaSettingsTab agent={agent} token={token} />}
      {tab === 'setup' && <CanvaSetupTab agent={agent} token={token} />}
    </div>
  );
}

const STATIC_FORMATS = [
  { id: 'linkedin-tips-carousel',    name: 'LinkedIn Tips Carousel',       platform: 'linkedin' },
  { id: 'linkedin-howto-carousel',   name: 'LinkedIn How-To Steps',        platform: 'linkedin' },
  { id: 'linkedin-stat-single',      name: 'LinkedIn Stat Card',           platform: 'linkedin' },
  { id: 'linkedin-quote-single',     name: 'LinkedIn Pull Quote',          platform: 'linkedin' },
  { id: 'linkedin-list-carousel',    name: 'LinkedIn Numbered List',       platform: 'linkedin' },
  { id: 'instagram-quote',           name: 'Instagram Quote Card',         platform: 'instagram' },
  { id: 'instagram-fact',            name: 'Instagram Fact / Stat Card',   platform: 'instagram' },
  { id: 'instagram-carousel-edu',    name: 'Instagram Edu Carousel',       platform: 'instagram' },
  { id: 'instagram-story-tip',       name: 'Instagram Story — Tip',        platform: 'instagram' },
  { id: 'instagram-story-announce',  name: 'Instagram Story — Announcement', platform: 'instagram' },
  { id: 'twitter-announcement',      name: 'Twitter Wide Card',            platform: 'twitter' },
  { id: 'twitter-thread-card',       name: 'Twitter Thread Visual',        platform: 'twitter' },
  { id: 'facebook-ad-banner',        name: 'Facebook Ad Banner',           platform: 'facebook' },
  { id: 'generic-infographic',       name: '3-Column Infographic',         platform: 'any' },
  { id: 'generic-checklist',         name: 'Checklist Card',               platform: 'any' },
];

function SlideLightbox({
  url, n, total, onClose, onPrev, onNext,
}: {
  url: string; n: number; total: number;
  onClose: () => void; onPrev: () => void; onNext: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, onPrev, onNext]);

  async function copyImage() {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const pngBlob = blob.type === 'image/png' ? blob : await new Promise<Blob>((resolve) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
          canvas.getContext('2d')!.drawImage(img, 0, 0);
          canvas.toBlob((b) => resolve(b!), 'image/png');
        };
        img.src = URL.createObjectURL(blob);
      });
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.open(url, '_blank');
    }
  }

  function downloadImage() {
    const a = document.createElement('a');
    a.href = url; a.download = `slide-${n}.png`; a.click();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md" onClick={onClose}>
      <div className="flex items-center justify-between w-full max-w-3xl px-4 pb-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} className={`rounded-full transition-all ${i + 1 === n ? 'w-4 h-2 bg-white' : 'w-2 h-2 bg-white/30'}`} />
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-white/40 text-xs mr-2">{n} / {total}</span>
          <button onClick={copyImage} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${copied ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'}`}>
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button onClick={downloadImage} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-all">
            <Download className="w-4 h-4" /><span>Download</span>
          </button>
          <button onClick={onClose} className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white border border-white/10 transition-all ml-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-3 w-full max-w-3xl px-2" onClick={(e) => e.stopPropagation()}>
        <button onClick={onPrev} disabled={n === 1} className="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 disabled:opacity-20 disabled:cursor-not-allowed text-white border border-white/10 transition-all">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <img src={url} alt={`Slide ${n}`} className="w-full rounded-2xl shadow-2xl ring-1 ring-white/10" />
        </div>
        <button onClick={onNext} disabled={n === total} className="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 disabled:opacity-20 disabled:cursor-not-allowed text-white border border-white/10 transition-all">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

// Post Renders Tab
function PostRendersTab({ token }: { token: string }) {
  const [renders, setRenders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);

  useEffect(() => {
    apiFetch(token, '/posts/renders?limit=50')
      .then(r => setRenders(Array.isArray(r) ? r : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  async function handleDelete(id: string) {
    if (!confirm('Delete this render? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await fetch(`/posts/renders/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      setRenders(prev => prev.filter(r => r.id !== id));
    } catch { /* ignore */ } finally {
      setDeletingId(null);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-4">
      {/* Renders list */}
      <div className="space-y-3">
        {renders.length === 0 && <p className="text-sm text-muted-foreground">No renders yet.</p>}
        {renders.map((r: any) => (
          <div key={r.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{r.formatId === 'dna-carousel' ? 'AI Carousel (training sample)' : r.formatId}</p>
                <p className="text-xs text-muted-foreground">{r.brand !== 'dna' ? r.brand : ''}{r.topic ? ` — ${r.topic}` : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.status === 'approved' ? 'bg-green-100 text-green-700' : r.status === 'rejected' ? 'bg-muted text-muted-foreground' : 'bg-amber-100 text-amber-700'}`}>{r.status}</span>
                {r.formatId !== 'dna-carousel' && <a href={apiHref(`/posts/renders/${r.id}/pptx`)} className="text-xs text-primary underline">PPTX</a>}
                {r.formatId !== 'dna-carousel' && <a href={apiHref(`/posts/renders/${r.id}/canva-csv`)} className="text-xs text-primary underline">CSV</a>}
                {r.formatId !== 'dna-carousel' && <a href={apiHref(`/posts/renders/${r.id}/text-export`)} className="text-xs text-primary underline">Text</a>}
                <button
                  onClick={() => handleDelete(r.id)}
                  disabled={deletingId === r.id}
                  className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors"
                >
                  {deletingId === r.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
            {Array.isArray(r.slideUrls) && r.slideUrls.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {r.slideUrls.map((url: string, i: number) => (
                  <button
                    key={i}
                    onClick={() => setLightbox({ urls: r.slideUrls, index: i })}
                    className="flex-shrink-0 group relative rounded-lg overflow-hidden border border-border"
                  >
                    <img src={url} alt={`Slide ${i + 1}`} className="h-24 w-24 object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {lightbox !== null && (
        <SlideLightbox
          url={lightbox.urls[lightbox.index]}
          n={lightbox.index + 1}
          total={lightbox.urls.length}
          onClose={() => setLightbox(null)}
          onPrev={() => setLightbox(prev => prev ? { ...prev, index: Math.max(0, prev.index - 1) } : null)}
          onNext={() => setLightbox(prev => prev ? { ...prev, index: Math.min(prev.urls.length - 1, prev.index + 1) } : null)}
        />
      )}
    </div>
  );
}


function CarouselSetCard({ setName, slides, onDeleteSlide, deletingId }: {
  setName: string;
  slides: any[];
  onDeleteSlide: (id: string) => void;
  deletingId: string | null;
}) {
  const [gallery, setGallery] = useState<number | null>(null);
  const [deletingSet, setDeletingSet] = useState(false);
  const total = slides.length;

  async function handleDeleteSet(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete all ${total} slides in this set?`)) return;
    setDeletingSet(true);
    for (const s of slides) {
      await new Promise<void>(res => { onDeleteSlide(s.id); setTimeout(res, 50); });
    }
    setDeletingSet(false);
  }

  return (
    <>
      <div className="relative group/set" style={{ width: 68 }}>
        <button
          onClick={() => setGallery(0)}
          className="relative group focus:outline-none"
          style={{ width: 68, height: 68 }}
        >
          {/* Card 3 — furthest back */}
          {total > 2 && (
            <div
              className="absolute rounded-lg bg-muted border border-border/50"
              style={{ inset: 0, transform: 'rotate(-4deg) translate(-2px, 3px)', zIndex: 0 }}
            />
          )}
          {/* Card 2 — middle */}
          {total > 1 && (
            <div
              className="absolute rounded-lg overflow-hidden border border-border/70 bg-muted"
              style={{ inset: 0, transform: 'rotate(2.5deg) translate(2px, 2px)', zIndex: 1 }}
            >
              {slides[1]?.previewData && (
                <img src={slides[1].previewData} alt="" className="w-full h-full object-cover" />
              )}
            </div>
          )}
          {/* Card 1 — front */}
          <div
            className="absolute rounded-lg overflow-hidden border border-border bg-muted shadow-md"
            style={{ inset: 0, zIndex: 2 }}
          >
            {slides[0]?.previewData && (
              <img src={slides[0].previewData} alt="" className="w-full h-full object-cover" />
            )}
          </div>
          <div className="absolute inset-0 rounded-lg bg-black/0 group-hover:bg-black/20 transition-colors pointer-events-none" style={{ zIndex: 3 }} />
          <span
            className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center pointer-events-none"
            style={{ zIndex: 4 }}
          >
            {total}
          </span>
        </button>
        <button
          onClick={handleDeleteSet}
          disabled={deletingSet}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-white text-[10px] hidden group-hover/set:flex items-center justify-center disabled:opacity-50 shadow-sm"
          style={{ zIndex: 20 }}
        >
          {deletingSet ? '·' : <X className="w-3 h-3" />}
        </button>
      </div>

      {gallery !== null && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md"
          onClick={() => setGallery(null)}
        >
          <div className="flex items-center justify-between w-full max-w-2xl px-4 pb-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-1.5">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setGallery(i)}
                  className={`rounded-full transition-all ${i === gallery ? 'w-4 h-2 bg-white' : 'w-2 h-2 bg-white/30 hover:bg-white/60'}`}
                />
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-white/40 text-xs mr-2">{gallery + 1} / {total}</span>
              <button
                onClick={() => setGallery(null)}
                className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white border border-white/10 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full max-w-2xl px-2" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setGallery(g => Math.max(0, (g ?? 0) - 1))}
              disabled={gallery === 0}
              className="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 disabled:opacity-20 disabled:cursor-not-allowed text-white border border-white/10 transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0 space-y-2">
              {slides[gallery]?.previewData ? (
                <img src={slides[gallery].previewData} alt={`Slide ${gallery + 1}`} className="w-full rounded-2xl shadow-2xl ring-1 ring-white/10" />
              ) : (
                <div className="w-full aspect-video bg-muted/20 rounded-2xl flex items-center justify-center">
                  <span className="text-sm text-white/40">No preview</span>
                </div>
              )}
            </div>
            <button
              onClick={() => setGallery(g => Math.min(total - 1, (g ?? 0) + 1))}
              disabled={gallery === total - 1}
              className="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 disabled:opacity-20 disabled:cursor-not-allowed text-white border border-white/10 transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <div className="flex gap-2 mt-3 overflow-x-auto max-w-2xl px-4" onClick={e => e.stopPropagation()}>
            {slides.map((s, i) => (
              <button
                key={i}
                onClick={() => setGallery(i)}
                className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${i === gallery ? 'border-white' : 'border-white/20 hover:border-white/60'}`}
              >
                {s.previewData ? (
                  <img src={s.previewData} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-white/10" />
                )}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-3" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => onDeleteSlide(slides[gallery]?.id)}
              disabled={deletingId === slides[gallery]?.id}
              className="px-3 py-1.5 text-xs text-red-400 border border-red-400/30 rounded-lg hover:bg-red-400/10 transition-colors disabled:opacity-40"
            >
              {deletingId === slides[gallery]?.id ? 'Deleting...' : 'Delete this slide'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function DnaTemplateCard({ template, onDelete, deleting, compact }: {
  template: any;
  onDelete: () => void;
  deleting: boolean;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const params: any[] = Array.isArray(template.parameters) ? template.parameters : [];
  const slideName = template.name.includes('/') ? template.name.split('/').slice(1).join('/') : template.name;

  return (
    <>
      <div className={`relative group ${compact ? 'w-[80px]' : ''}`}>
        <button onClick={() => setExpanded(true)} className={`focus:outline-none ${compact ? 'w-[80px] h-[80px]' : 'w-full'}`}>
          {template.previewData ? (
            <img
              src={template.previewData}
              alt={slideName}
              className={`object-cover rounded-lg border border-border group-hover:border-primary/60 transition-colors ${compact ? 'w-[80px] h-[80px]' : 'w-full aspect-square'}`}
            />
          ) : (
            <div className={`rounded-lg bg-muted border border-border flex items-center justify-center ${compact ? 'w-[80px] h-[80px]' : 'w-full aspect-square'}`}>
              <span className="text-[10px] text-muted-foreground">No preview</span>
            </div>
          )}
          {!compact && (
            <p className="text-xs text-muted-foreground mt-1 truncate text-left">{slideName}</p>
          )}
          {params.length > 0 && (
            <span className="absolute bottom-5 right-0.5 bg-primary text-primary-foreground text-[9px] font-bold rounded px-1 leading-tight pointer-events-none">
              {params.length}p
            </span>
          )}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          disabled={deleting}
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-white text-[10px] hidden group-hover:flex items-center justify-center disabled:opacity-50"
        >
          {deleting ? '.' : 'x'}
        </button>
      </div>

      {expanded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={() => setExpanded(false)}>
          <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <p className="text-sm font-medium text-foreground truncate">{slideName}</p>
              <button onClick={() => setExpanded(false)} className="text-muted-foreground hover:text-foreground px-2">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex">
              {template.previewData && (
                <div className="w-48 shrink-0 border-r border-border bg-muted/30 flex items-center justify-center p-3">
                  <img src={template.previewData} alt="" className="max-w-full max-h-48 object-contain rounded-lg" />
                </div>
              )}
              <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-64">
                {params.length > 0 ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Parameters ({params.length})</p>
                    <div className="space-y-2">
                      {params.map((p: any, i: number) => (
                        <div key={i} className="space-y-0.5">
                          <p className="text-xs font-medium text-foreground">{p.key}</p>
                          <p className="text-xs text-muted-foreground">{p.description}</p>
                          {p.example && <p className="text-[10px] text-primary/70 italic">e.g. {p.example}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No parameters extracted.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Templates Tab
function DesignSamplesTab({ token }: { token: string }) {
  const [jobs, setJobs] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [uploadMode, setUploadMode] = useState<'individual' | 'carousel'>('individual');
  const [isDragOver, setIsDragOver] = useState(false);
  const [carouselStaging, setCarouselStaging] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadAll() {
    const [j, t] = await Promise.all([
      apiFetch(token, '/design-studio/jobs').catch(() => []),
      apiFetch(token, '/design-studio/templates').catch(() => []),
    ]);
    setJobs(Array.isArray(j) ? j : []);
    setTemplates(Array.isArray(t) ? t : []);
  }

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  function startPolling() {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const j = await apiFetch(token, '/design-studio/jobs').catch(() => []);
        const jobList = Array.isArray(j) ? j : [];
        setJobs(jobList);
        const hasPending = jobList.some((job: any) => job.status === 'pending' || job.status === 'processing');
        if (!hasPending) {
          stopPolling();
          const t = await apiFetch(token, '/design-studio/templates').catch(() => []);
          setTemplates(Array.isArray(t) ? t : []);
        }
      } catch {
        stopPolling();
      }
    }, 2500);
  }

  useEffect(() => {
    void loadAll();
    return () => stopPolling();
  }, [token]);

  async function uploadBatch(fieldNames: string[], files: File[]) {
    setUploading(true);
    setUploadError(null);
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 90_000);
    try {
      const form = new FormData();
      files.forEach((f, i) => form.append(fieldNames[i], f, f.name));
      const res = await fetch('/design-studio/import-batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? data?.message ?? `Upload failed (${res.status})`);
      }
      await loadAll();
      startPolling();
    } catch (err: any) {
      const msg = err?.name === 'AbortError' ? 'Upload timed out — the payload may be too large for the server.' : (err?.message ?? 'Upload failed.');
      setUploadError(msg);
    } finally {
      clearTimeout(timeout);
      setUploading(false);
    }
  }

  async function uploadIndividual(files: File[]) {
    const names = files.map((f) => f.name.replace(/\.[^.]+$/, ''));
    await uploadBatch(names, files);
  }

  async function uploadCarousel(files: File[]) {
    if (files.length < 2) return;
    const rawName = files[0].name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').trim() || 'carousel';
    const uid = Date.now().toString(36).slice(-5);
    const setName = `${rawName}-${uid}`;
    const names = files.map((_, i) => `${setName}/slide-${i + 1}`);
    await uploadBatch(names, files);
  }

  async function deleteTemplate(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/design-studio/templates/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setTemplates(prev => prev.filter((t: any) => t.id !== id));
    } catch { /* ignore */ } finally {
      setDeletingId(null);
    }
  }

  function handleFiles(files: File[]) {
    const images = files.filter(f => f.type.startsWith('image/'));
    if (!images.length) return;
    if (fileRef.current) fileRef.current.value = '';
    if (uploadMode === 'individual') {
      void uploadIndividual(images);
    } else {
      void uploadCarousel(images);
    }
  }

  const individualTemplates = templates.filter((t: any) => !t.name.includes('/'));
  const carouselTemplates = [...templates.filter((t: any) => t.name.includes('/'))]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Group by prefix, then split into sessions where gap > 60s between consecutive slides
  const byPrefix: Record<string, any[]> = {};
  for (const t of carouselTemplates) {
    const prefix = t.name.split('/')[0];
    (byPrefix[prefix] ??= []).push(t);
  }
  const carouselGroups: Record<string, any[]> = {};
  for (const [prefix, slides] of Object.entries(byPrefix)) {
    let sessionIdx = 0;
    let lastTs = new Date(slides[0].createdAt).getTime();
    for (const slide of slides) {
      const ts = new Date(slide.createdAt).getTime();
      if (ts - lastTs > 60000) sessionIdx++;
      const key = `${prefix}__${sessionIdx}`;
      (carouselGroups[key] ??= []).push(slide);
      lastTs = ts;
    }
  }
  const activeJobs = jobs.filter((j: any) => j.status === 'pending' || j.status === 'processing');
  const failedJobs = jobs.filter((j: any) => j.status === 'failed');

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
          {(['individual', 'carousel'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => { setUploadMode(mode); setCarouselStaging([]); }}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                uploadMode === mode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {mode === 'individual' ? 'Individual image' : 'Carousel set'}
            </button>
          ))}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple={uploadMode === 'carousel'}
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []).filter(f => f.type.startsWith('image/'));
            if (fileRef.current) fileRef.current.value = '';
            if (uploadMode === 'individual') {
              files.forEach(f => void uploadIndividual([f]));
            } else {
              setCarouselStaging(prev => [...prev, ...files]);
            }
          }}
        />

        {uploadMode === 'individual' ? (
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false); }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
              files.forEach(f => void uploadIndividual([f]));
            }}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
              uploading ? 'opacity-50 pointer-events-none' : isDragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/40'
            }`}
          >
            <p className="text-sm font-medium">{uploading ? 'Uploading...' : isDragOver ? 'Drop images here' : 'Drop images or click to upload'}</p>
            <p className="text-xs text-muted-foreground mt-1">Each image is analyzed and stored as a separate design template</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false); }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
                setCarouselStaging(prev => [...prev, ...files]);
              }}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
                isDragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/40'
              }`}
            >
              <p className="text-sm font-medium">Drop all carousel slides here</p>
              <p className="text-xs text-muted-foreground mt-1">All slides are uploaded together as one named set — add at least 2</p>
            </div>
            {carouselStaging.length > 0 && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {carouselStaging.map((file, i) => (
                    <div key={i} className="relative group">
                      <img src={URL.createObjectURL(file)} alt="" className="w-14 h-14 object-cover rounded-lg border border-border" />
                      <span className="absolute top-0.5 left-0.5 bg-black/60 text-white text-[10px] font-bold rounded px-1 leading-tight">{i + 1}</span>
                      <button
                        onClick={() => setCarouselStaging(prev => prev.filter((_, j) => j !== i))}
                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-white text-[10px] hidden group-hover:flex items-center justify-center"
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void uploadCarousel(carouselStaging).then(() => setCarouselStaging([]))}
                      disabled={carouselStaging.length < 2 || uploading}
                      className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                      {uploading ? 'Uploading...' : `Upload ${carouselStaging.length}-slide set`}
                    </button>
                    <button onClick={() => { setCarouselStaging([]); setUploadError(null); }} className="text-xs text-muted-foreground hover:text-foreground">
                      Clear
                    </button>
                  </div>
                  {uploadError && (
                    <p className="text-xs text-red-500">{uploadError}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {activeJobs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Analyzing</p>
          {activeJobs.map((job: any) => (
            <div key={job.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />
              <span className="text-sm text-foreground flex-1 truncate">{job.name}</span>
              <span className="text-xs text-muted-foreground capitalize">{job.status}</span>
            </div>
          ))}
        </div>
      )}

      {failedJobs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Failed</p>
          {failedJobs.map((job: any) => (
            <div key={job.id} className="bg-card border border-destructive/30 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="text-sm text-foreground flex-1 truncate">{job.name}</span>
              <span className="text-xs text-destructive truncate max-w-xs">{job.error ?? 'Unknown error'}</span>
            </div>
          ))}
        </div>
      )}

      {individualTemplates.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Individual Images ({individualTemplates.length})
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {individualTemplates.map((t: any) => (
              <DnaTemplateCard
                key={t.id}
                template={t}
                onDelete={() => void deleteTemplate(t.id)}
                deleting={deletingId === t.id}
              />
            ))}
          </div>
        </div>
      )}

      {Object.keys(carouselGroups).length > 0 && (
        <div className="space-y-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Carousel Sets ({Object.keys(carouselGroups).length})
          </p>
          <div className="flex flex-wrap gap-4">
            {Object.entries(carouselGroups).map(([setKey, slides]) => (
              <CarouselSetCard
                key={setKey}
                setName={setKey}
                slides={slides}
                onDeleteSlide={(id) => void deleteTemplate(id)}
                deletingId={deletingId}
              />
            ))}
          </div>
        </div>
      )}

      {templates.length === 0 && activeJobs.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-6 text-center">
          <p className="text-sm text-muted-foreground">No design templates yet. Upload images above to extract their visual DNA.</p>
        </div>
      )}
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

const EMPTY_BRAND_FORM = { name: '', displayName: '', voiceProfile: '', canvaKitId: '', palette: '', fonts: '', platforms: '' };

// T29: Brands tab — per-brand identity management with website URL import
function CanvaBrandsTab({ token }: { token: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<CanvaBrand | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_BRAND_FORM);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const { data: brands, isLoading } = useQuery<CanvaBrand[]>({
    queryKey: ['canva-brands'],
    queryFn: () => apiFetch(token, '/canva/brands'),
  });

  const saveMut = useMutation({
    mutationFn: (data: any) => {
      const url = editing ? `/canva/brands/${editing.name}` : '/canva/brands';
      const method = editing ? 'PATCH' : 'POST';
      return apiFetch(token, url, { method, body: JSON.stringify(data) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['canva-brands'] });
      setEditing(null);
      setShowForm(false);
      setForm(EMPTY_BRAND_FORM);
      setWebsiteUrl('');
      setImportError(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (name: string) => apiFetch(token, `/canva/brands/${name}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['canva-brands'] }),
  });

  const startEdit = (b: CanvaBrand) => {
    setEditing(b);
    setShowForm(true);
    setForm({
      name: b.name,
      displayName: b.displayName,
      voiceProfile: b.voiceProfile,
      canvaKitId: b.canvaKitId ?? '',
      palette: b.palette.join(', '),
      fonts: b.fonts.join(', '),
      platforms: b.platforms.join(', '),
    });
    setWebsiteUrl('');
    setImportError(null);
  };

  const startAdd = () => {
    setEditing(null);
    setShowForm(true);
    setForm(EMPTY_BRAND_FORM);
    setWebsiteUrl('');
    setImportError(null);
  };

  const cancelForm = () => {
    setEditing(null);
    setShowForm(false);
    setForm(EMPTY_BRAND_FORM);
    setWebsiteUrl('');
    setImportError(null);
  };

  async function importFromUrl() {
    if (!websiteUrl.trim()) return;
    setImporting(true);
    setImportError(null);
    try {
      const res = await apiFetch(token, '/canva/brands/import-from-url', {
        method: 'POST',
        body: JSON.stringify({ url: websiteUrl.trim() }),
      });
      setForm((prev) => ({
        ...prev,
        displayName: res.displayName ?? prev.displayName,
        voiceProfile: res.voiceProfile ?? prev.voiceProfile,
        palette: res.palette?.join(', ') ?? prev.palette,
        fonts: res.fonts?.join(', ') ?? prev.fonts,
      }));
    } catch (e: any) {
      setImportError(e?.message ?? 'Failed to import from URL');
    } finally {
      setImporting(false);
    }
  }

  async function uploadLogo(file: File) {
    if (!editing) return;
    setLogoUploading(true);
    setLogoError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/canva/brands/${editing.name}/logo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(err.error ?? 'Upload failed');
      }
      qc.invalidateQueries({ queryKey: ['canva-brands'] });
    } catch (e: any) {
      setLogoError(e?.message ?? 'Upload failed');
    } finally {
      setLogoUploading(false);
    }
  }

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
    <div className="space-y-4 max-w-2xl">
      {isLoading && <p className="text-sm text-muted-foreground">Loading brands...</p>}

      {brands && brands.length === 0 && !showForm && (
        <div className="bg-card border border-dashed border-border rounded-xl p-8 text-center">
          <p className="text-sm text-muted-foreground mb-3">No brands yet. Add one to give the agent a voice and visual identity.</p>
        </div>
      )}

      {brands && brands.map((b) => (
        <div key={b.name} className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {b.logoUrl ? (
                <img src={b.logoUrl} alt={b.displayName} className="w-10 h-10 object-contain rounded-lg border border-border/50 shrink-0 bg-muted" />
              ) : (
                <div className="w-10 h-10 rounded-lg border border-dashed border-border/50 bg-muted flex items-center justify-center shrink-0">
                  <ImageIcon className="w-4 h-4 text-muted-foreground/40" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{b.displayName}</p>
                  <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{b.name}</code>
                  {b.active && <span className="text-[10px] bg-green-500/15 text-green-400 px-1.5 py-0.5 rounded-full font-medium">active</span>}
                </div>
                {b.voiceProfile && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{b.voiceProfile}</p>}
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {b.palette.length > 0 && (
                    <div className="flex gap-1">
                      {b.palette.map((c) => (
                        <div key={c} className="w-3.5 h-3.5 rounded-full border border-border/50" style={{ backgroundColor: c }} title={c} />
                      ))}
                    </div>
                  )}
                  {b.fonts.length > 0 && <span className="text-xs text-muted-foreground">{b.fonts.join(', ')}</span>}
                  {b.platforms.length > 0 && <span className="text-xs text-muted-foreground">{b.platforms.join(', ')}</span>}
                  {b.canvaKitId && <span className="text-xs text-muted-foreground">Kit: {b.canvaKitId.slice(0, 12)}…</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => startEdit(b)} className="text-xs text-primary hover:underline px-1">Edit</button>
              <button
                onClick={() => { if (confirm(`Delete brand "${b.displayName}"?`)) deleteMut.mutate(b.name); }}
                className="text-xs text-muted-foreground hover:text-destructive px-1"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}

      {!showForm && (
        <button
          onClick={startAdd}
          className="flex items-center gap-1.5 px-4 py-2 text-sm border border-dashed border-border rounded-xl text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors w-full justify-center"
        >
          <Plus className="w-3.5 h-3.5" /> Add brand
        </button>
      )}

      {showForm && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <p className="text-sm font-semibold">{editing ? `Edit: ${editing.displayName}` : 'New brand'}</p>

          {/* Website URL import */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Import from website (optional)</label>
            <div className="flex gap-2">
              <Input
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://taskip.com"
                className="text-sm flex-1"
              />
              <Button size="sm" variant="outline" onClick={importFromUrl} disabled={!websiteUrl.trim() || importing}>
                {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Import'}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">The agent will scrape the site and pre-fill voice profile, colors, and fonts below.</p>
            {importError && <p className="text-xs text-destructive mt-1">{importError}</p>}
          </div>

          <div className="border-t border-border pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Brand key <span className="text-destructive">*</span></label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                  placeholder="taskip"
                  disabled={!!editing}
                  className="text-sm"
                />
                <p className="text-[11px] text-muted-foreground mt-0.5">Lowercase, no spaces. Used internally.</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Display name <span className="text-destructive">*</span></label>
                <Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="Taskip" className="text-sm" />
              </div>
            </div>

            {editing && (
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Brand logo</label>
                <div className="flex items-center gap-3">
                  {editing.logoUrl ? (
                    <img src={editing.logoUrl} alt="logo" className="w-14 h-14 object-contain rounded-lg border border-border bg-muted" />
                  ) : (
                    <div className="w-14 h-14 rounded-lg border border-dashed border-border bg-muted flex items-center justify-center">
                      <ImageIcon className="w-5 h-5 text-muted-foreground/40" />
                    </div>
                  )}
                  <div>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = ''; }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={logoUploading}
                      className="gap-1.5"
                    >
                      {logoUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      {editing.logoUrl ? 'Replace logo' : 'Upload logo'}
                    </Button>
                    <p className="text-[11px] text-muted-foreground mt-1">PNG, JPG, WEBP or SVG. Used on slide covers and CTAs.</p>
                    {logoError && <p className="text-xs text-destructive mt-1">{logoError}</p>}
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-muted-foreground block mb-1">Voice &amp; tone profile</label>
              <textarea
                value={form.voiceProfile}
                onChange={(e) => setForm({ ...form, voiceProfile: e.target.value })}
                placeholder="Educational, relatable, and slightly witty — for SaaS founders who want actionable insights without the hype..."
                className="w-full text-sm border border-border rounded-lg p-2.5 bg-background resize-none h-24 focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Color palette (hex, comma-separated)</label>
                <Input value={form.palette} onChange={(e) => setForm({ ...form, palette: e.target.value })} placeholder="#6366f1, #4f46e5, #f5f5f5" className="text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Fonts (comma-separated)</label>
                <Input value={form.fonts} onChange={(e) => setForm({ ...form, fonts: e.target.value })} placeholder="Inter, Geist" className="text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Canva Brand Kit ID (optional)</label>
                <Input value={form.canvaKitId} onChange={(e) => setForm({ ...form, canvaKitId: e.target.value })} placeholder="kit_xxxxxx" className="text-sm font-mono" />
                <p className="text-[11px] text-muted-foreground mt-0.5">From Canva Brand Hub → Kit settings URL.</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Platforms (comma-separated)</label>
                <Input value={form.platforms} onChange={(e) => setForm({ ...form, platforms: e.target.value })} placeholder="instagram, linkedin, facebook" className="text-sm" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button onClick={handleSave} disabled={!form.name || !form.displayName || saveMut.isPending}>
              {saveMut.isPending ? 'Saving...' : editing ? 'Update brand' : 'Add brand'}
            </Button>
            <Button variant="outline" onClick={cancelForm}>Cancel</Button>
            {saveMut.isError && <span className="text-xs text-destructive">Save failed</span>}
          </div>
        </div>
      )}
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
  const [patternConsistency, setPatternConsistency] = useState(!!(cfg.patternConsistency));
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
      patternConsistency,
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
            <p className="text-sm">Pattern consistency</p>
            <p className="text-xs text-muted-foreground">Inject per-slide-type learned patterns into content generation (cover / content / cta each get their own rules)</p>
          </div>
          <BigToggle enabled={patternConsistency} onClick={() => setPatternConsistency(!patternConsistency)} />
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

// Setup tab — AI-image-first mode (DALL-E 3 default, Canva MCP optional)
function CanvaSetupTab({ agent, token }: { agent: AgentDetail; token: string }) {
  const navigate = useNavigate();
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);
  const [mcpExpanded, setMcpExpanded] = useState(false);
  const [openaiSet, setOpenaiSet] = useState(false);
  const [stabilitySet, setStabilitySet] = useState(false);

  useEffect(() => {
    apiFetch(token, '/settings').then((rows: any[]) => {
      setOpenaiSet(rows.find((r: any) => r.key === 'openai_api_key')?.stored === true);
      setStabilitySet(rows.find((r: any) => r.key === 'stability_api_key')?.stored === true);
    }).catch(() => {});
  }, [token]);

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
      <div className="bg-muted/40 border border-border rounded-xl p-3 text-xs text-muted-foreground">
        LLM provider, Telegram bot, and database are platform-wide — configure them in Settings, not here.
      </div>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-300 space-y-1">
        <p className="font-semibold">Post Format Engine — no Canva account required</p>
        <p className="text-blue-300/80">Slides are rendered server-side via Satori+Resvg (PNG). Requires an OpenAI or Gemini API key for content generation. Stability AI or DALL-E 3 used for image backgrounds (optional — falls back to solid color).</p>
      </div>

      <div className="space-y-3">

        <SetupStep n={1} title="Add OpenAI API key (required for text generation)" done={openaiSet}>
          <p>Go to <strong>Settings → Secrets</strong> and add:</p>
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <code className="bg-muted px-1.5 py-0.5 rounded text-xs shrink-0">openai_api_key</code>
              <span className="text-muted-foreground text-xs">Used for GPT content generation and DALL-E 3 image backgrounds</span>
            </div>
          </div>
          <div className="mt-2">
            <button
              onClick={() => navigate('/settings')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:opacity-90"
            >
              Go to Settings
            </button>
          </div>
        </SetupStep>

        <SetupStep n={2} title="Add Stability AI key (optional — image backgrounds)" done={stabilitySet}>
          <p>Get a key at <strong>platform.stability.ai → API Keys</strong>, then add in <strong>Settings → Secrets</strong>:</p>
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <code className="bg-muted px-1.5 py-0.5 rounded text-xs shrink-0">stability_api_key</code>
              <span className="text-muted-foreground text-xs">Stability AI key — used for image backgrounds on applicable slide layouts. Falls back to solid color if not set.</span>
            </div>
          </div>
          <p className="mt-1 text-muted-foreground/70">Format: <code className="bg-muted px-1 rounded">sk-...</code> from your Stability AI account dashboard.</p>
        </SetupStep>

        <SetupStep n={3} title="Add brand identities">
          <p>Go to the <strong>Brands</strong> tab and add at least one brand. Paste your website URL to auto-fill voice profile, colors, and fonts.</p>
          <p className="mt-1 text-muted-foreground">Brand identity is injected automatically into every generation prompt.</p>
        </SetupStep>

        <SetupStep n={4} title="Test the agent" done={agent.enabled}>
          <p>Open the <strong>Chat</strong> page for this agent and type a design concept.</p>
          <p className="mt-1 text-muted-foreground">Example: <em>"Create an Instagram carousel for Taskip's spring launch, bold and modern"</em></p>
          <div className="mt-3">
            <button
              onClick={() => navigate(`/agents/${agent.key}/chat`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:opacity-90"
            >
              Open chat
            </button>
          </div>
        </SetupStep>

      </div>

      {/* Post Format Engine */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/20">
          <p className="text-sm font-medium">Post Format Engine</p>
          <p className="text-xs text-muted-foreground mt-0.5">Self-hosted Satori+Resvg renderer — no Canva account needed. Works out of the box once a brand is configured.</p>
        </div>
        <div className="px-4 py-4 space-y-4 text-sm">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quick test prompts</p>
            <div className="space-y-1">
              {[
                'Generate a linkedin-tips-carousel for brand taskip about "5 ways to save time on client work"',
                'Generate a linkedin-stat-single for brand taskip about "87% of freelancers waste 4 hours a week"',
                'Generate an instagram-story-tip for brand taskip about "one habit that saves 2 hours"',
                'Generate a generic-checklist for brand taskip about "before you launch: SaaS checklist"',
                'Generate a facebook-ad-banner for brand taskip targeting freelancers',
              ].map(p => (
                <button
                  key={p}
                  onClick={() => navigate(`/agents/canva/chat`)}
                  title="Click to open chat, then paste this prompt"
                  className="w-full text-left text-xs bg-muted/60 border border-border rounded-lg px-3 py-2 hover:bg-muted transition-colors font-mono text-muted-foreground hover:text-foreground truncate"
                >
                  {p}
                </button>
              ))}
            </div>
            <button
              onClick={() => navigate('/agents/canva/chat')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:opacity-90 mt-1"
            >
              Open chat
            </button>
          </div>

          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Training with design templates</p>
            <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
              <li>Go to the <strong className="text-foreground">Templates</strong> tab above and set your brand name</li>
              <li>Click <strong className="text-foreground">Upload samples</strong> — select 10–200 PNG/JPG design images</li>
              <li>Each image is analyzed by GPT-4V which extracts layout, colors, typography, and mood patterns</li>
              <li>After uploading 20+ samples, click <strong className="text-foreground">Learn patterns</strong> to cluster them into reusable style rules</li>
              <li>Every future render for this brand reads the learned patterns as style context</li>
            </ol>
            <button
              onClick={() => {/* tab switch handled by parent */}}
              className="text-xs text-primary underline"
            >
              Full training guide: docs/post-render-engine.md
            </button>
          </div>

          <div className="space-y-1 border-t border-border pt-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Canva export</p>
            <p className="text-xs text-muted-foreground">Every render can be downloaded as PPTX (full editable layers in Canva), Canva Bulk Create CSV, or plain text. Find download links in the <strong className="text-foreground">Post Renders</strong> tab.</p>
          </div>
        </div>
      </div>

      {/* Optional: Canva MCP */}
      <div className="border border-border rounded-xl overflow-hidden">
        <button
          onClick={() => setMcpExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/40 transition-colors"
        >
          <span>Optional: Enable Canva MCP</span>
          <span className="text-muted-foreground text-xs">{mcpExpanded ? 'Hide' : 'Show'}</span>
        </button>
        {mcpExpanded && (
          <div className="px-4 pb-4 space-y-3 text-sm border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">When Canva MCP is enabled and connected, designs are created directly in your Canva account with a shareable edit URL. Requires a Canva Connect API integration — currently restricted to approved developers.</p>

            <SetupStep n={1} title="Create a Canva Connect API integration">
              <p>Go to <a href="https://www.canva.com/developers/integrations" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">canva.com/developers/integrations</a> → Create an integration.</p>
              <p className="mt-1.5">Add redirect URI:</p>
              <code className="block bg-muted px-2 py-1 rounded text-xs break-all mt-1">
                https://cortex-api.xgenious.com/integrations/oauth/callback/canva
              </code>
              <p className="mt-1.5">Enable scopes: <code className="bg-muted px-1 rounded">design:content:read</code> <code className="bg-muted px-1 rounded">design:content:write</code> <code className="bg-muted px-1 rounded">asset:read</code> <code className="bg-muted px-1 rounded">asset:write</code> <code className="bg-muted px-1 rounded">profile:read</code></p>
            </SetupStep>

            <SetupStep n={2} title="Add credentials to Settings">
              <div className="space-y-1.5 mt-1">
                {[
                  { key: 'canva_oauth_client_id', note: 'Client ID' },
                  { key: 'canva_oauth_client_secret', note: 'Client Secret' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center gap-2">
                    <code className="bg-muted px-1.5 py-0.5 rounded text-xs shrink-0">{item.key}</code>
                    <span className="text-muted-foreground text-xs">{item.note}</span>
                  </div>
                ))}
              </div>
            </SetupStep>

            <SetupStep n={3} title="Connect via OAuth">
              <p>Go to <strong>Integrations → OAuth Apps</strong> and click Connect next to Canva.</p>
              <button onClick={() => navigate('/integrations')} className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:opacity-90">Go to Integrations</button>
            </SetupStep>

            <SetupStep n={4} title="Add Canva MCP server">
              <p>Go to the <strong>MCP</strong> page and add:</p>
              <div className="mt-2 bg-muted rounded-lg px-3 py-2 text-xs font-mono space-y-1">
                <div><span className="text-muted-foreground">Name: </span>canva</div>
                <div><span className="text-muted-foreground">URL: </span>https://mcp.canva.com/mcp</div>
              </div>
              <p className="mt-1.5">Link the OAuth integration to this server row, then enable it.</p>
            </SetupStep>

            <SetupStep n={5} title="Enable in Settings">
              <p>Add in <strong>Settings → Secrets</strong>:</p>
              <div className="flex items-center gap-2 mt-1">
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs shrink-0">canva_mcp_enabled</code>
                <span className="text-muted-foreground text-xs">Set to <code className="bg-muted px-1 rounded">true</code></span>
              </div>
            </SetupStep>

            <div className="flex items-center gap-3 flex-wrap pt-1">
              <Button size="sm" onClick={verify} disabled={verifying}>
                {verifying ? 'Verifying...' : 'Verify Canva MCP'}
              </Button>
            </div>
            {verifyResult && (
              <div className={`p-3 rounded-lg text-xs font-mono border ${verifyResult.ok ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-destructive/10 border-destructive/20 text-destructive'}`}>
                <div>Status: {verifyResult.ok ? 'OK' : 'FAILED'}</div>
                <div>Tools: {verifyResult.toolsFound ?? 0}/{verifyResult.toolsExpected ?? 32}</div>
                {verifyResult.latencyMs && <div>Latency: {verifyResult.latencyMs}ms</div>}
                {verifyResult.error && <div>Error: {verifyResult.error}</div>}
                {verifyResult.missingTools?.length > 0 && (
                  <div className="mt-1">Missing: {verifyResult.missingTools.slice(0, 5).join(', ')}{verifyResult.missingTools.length > 5 ? ` +${verifyResult.missingTools.length - 5} more` : ''}</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}

// ─── Webhook Logs Tab ─────────────────────────────────────────────────────────

interface WebhookLog {
  id: string;
  status: string;
  externalId: string | null;
  ticketId: string | null;
  rawPayload: string | null;
  responseBody: string | null;
  error: string | null;
  receivedAt: string;
}

function WebhookLogsTab({ token }: { token: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [testPayload, setTestPayload] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [showTestPanel, setShowTestPanel] = useState(false);

  const { data: logs = [], isLoading, refetch, isFetching } = useQuery<WebhookLog[]>({
    queryKey: ['support-webhook-logs'],
    queryFn: async () => {
      const res = await fetch('/support/webhook-logs?limit=200', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    staleTime: 30_000,
  });

  async function handleTestWebhook() {
    setTestSending(true);
    setTestResult(null);
    try {
      let body: object;
      try { body = JSON.parse(testPayload || '{}'); } catch { setTestResult({ ok: false, message: 'Invalid JSON' }); setTestSending(false); return; }
      const res = await fetch('/support/webhook-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setTestResult({ ok: true, message: JSON.stringify(data, null, 2) });
        refetch();
      } else {
        setTestResult({ ok: false, message: (data as any)?.message ?? `HTTP ${res.status}` });
      }
    } catch (e) {
      setTestResult({ ok: false, message: e instanceof Error ? e.message : String(e) });
    } finally {
      setTestSending(false);
    }
  }

  function statusChip(status: string) {
    if (status === 'ok' || status === 'stored' || status === 'reopened') return 'bg-emerald-500/15 text-emerald-400';
    if (status === 'duplicate') return 'bg-amber-500/15 text-amber-400';
    if (status === 'skipped_agent_reply') return 'bg-slate-500/15 text-slate-400';
    return 'bg-rose-500/15 text-rose-400';
  }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold">Webhook Logs</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Incoming events from your CRM via{' '}
            <code className="bg-muted px-1 rounded">/support/ingest-ticket</code>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowTestPanel(v => !v); setTestResult(null); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Radio className="w-3 h-3" />
            Test webhook
          </button>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {showTestPanel && (
        <div className="rounded-xl border border-border bg-card p-4 mb-4 space-y-3">
          <p className="text-xs font-medium">Send a test webhook payload directly (bypasses secret check)</p>
          <p className="text-[11px] text-muted-foreground">Paste any CRM webhook JSON to replay it through the ingestion logic.</p>
          <textarea
            value={testPayload}
            onChange={e => setTestPayload(e.target.value)}
            placeholder={'{\n  "event": "support.ticket.created",\n  "data": { ... }\n}'}
            rows={8}
            className="w-full rounded-lg border border-border bg-muted/20 px-3 py-2.5 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-primary resize-y"
          />
          {testResult && (
            <pre className={`text-[11px] rounded-lg px-3 py-2.5 overflow-x-auto ${testResult.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              {testResult.message}
            </pre>
          )}
          <button
            onClick={handleTestWebhook}
            disabled={testSending}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-xs hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {testSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Radio className="w-3 h-3" />}
            {testSending ? 'Sending…' : 'Send test payload'}
          </button>
        </div>
      )}

      {isLoading && (
        <div className="space-y-2">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="rounded-lg border border-border p-3 flex items-center gap-3">
              <Skeleton className="w-16 h-5 rounded-full" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-32 ml-auto" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && logs.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <Radio className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No webhook events received yet.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Events will appear here once your CRM starts sending tickets.</p>
        </div>
      )}

      {!isLoading && logs.length > 0 && (
        <div className="space-y-1.5">
          {logs.map(log => (
            <div key={log.id} className="rounded-lg border border-border bg-card overflow-hidden">
              <button
                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/20 transition-colors"
                onClick={() => setExpanded(expanded === log.id ? null : log.id)}
              >
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide shrink-0 ${statusChip(log.status)}`}>
                  {log.status}
                </span>
                <span className="text-xs font-medium truncate flex-1 min-w-0">
                  {log.externalId ? `Ticket #${log.externalId}` : 'Unknown ticket'}
                </span>
                {log.error && (
                  <span className="text-[11px] text-rose-400 truncate max-w-[200px]">{log.error}</span>
                )}
                <span className="text-[11px] text-muted-foreground shrink-0">{timeAgo(log.receivedAt)}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform ${expanded === log.id ? 'rotate-180' : ''}`} />
              </button>

              {expanded === log.id && (
                <div className="border-t border-border px-4 py-3 space-y-3">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <div><span className="text-muted-foreground">Received:</span> {new Date(log.receivedAt).toLocaleString()}</div>
                    <div><span className="text-muted-foreground">CRM ticket ID:</span> {log.externalId ?? '—'}</div>
                    <div><span className="text-muted-foreground">Internal ticket ID:</span> {log.ticketId ?? '—'}</div>
                    <div><span className="text-muted-foreground">Status:</span> {log.status}</div>
                  </div>
                  {log.error && (
                    <div className="rounded-md bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-400">
                      {log.error}
                    </div>
                  )}
                  {log.rawPayload && (
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Request payload</p>
                      <pre className="text-[11px] bg-muted rounded-lg p-3 overflow-x-auto leading-relaxed">
                        {(() => { try { return JSON.stringify(JSON.parse(log.rawPayload), null, 2); } catch { return log.rawPayload; } })()}
                      </pre>
                    </div>
                  )}
                  {log.responseBody && (
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Response</p>
                      <pre className={`text-[11px] rounded-lg p-3 overflow-x-auto leading-relaxed ${log.status === 'stored' || log.status === 'reopened' || log.status === 'skipped_agent_reply' ? 'bg-emerald-500/10 text-emerald-300' : log.status === 'duplicate' ? 'bg-amber-500/10 text-amber-300' : 'bg-rose-500/10 text-rose-300'}`}>
                        {(() => { try { return JSON.stringify(JSON.parse(log.responseBody), null, 2); } catch { return log.responseBody; } })()}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function AgentDetailPage() {
  const { key } = useParams<{ key: string }>();
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'runs' | 'settings' | 'webhooks'>('runs');
  const color = agentColor(key!);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  const nameMutation = useMutation({
    mutationFn: (name: string) =>
      apiFetch(token, `/agents/${key}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent', key] });
      setEditingName(false);
    },
  });

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
                {editingName ? (
                  <form
                    className="flex items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const trimmed = nameInput.trim();
                      if (trimmed) nameMutation.mutate(trimmed);
                    }}
                  >
                    <input
                      autoFocus
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Escape' && setEditingName(false)}
                      className="text-xl font-semibold bg-transparent border-b border-primary focus:outline-none min-w-[12rem]"
                    />
                    <button
                      type="submit"
                      disabled={nameMutation.isPending || !nameInput.trim()}
                      className="p-1 text-emerald-400 hover:text-emerald-300 disabled:opacity-40 transition-colors"
                    >
                      {nameMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingName(false)}
                      className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </form>
                ) : (
                  <button
                    onClick={() => { setNameInput(agent.name); setEditingName(true); }}
                    className="group/name flex items-center gap-1.5"
                    title="Click to rename"
                  >
                    <h1 className="text-xl font-semibold">{agent.name}</h1>
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover/name:opacity-100 transition-opacity" />
                  </button>
                )}
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
            {key === 'support' && (
              <button
                onClick={() => setActiveTab('webhooks')}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === 'webhooks'
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Radio className="w-4 h-4" />
                Webhooks
              </button>
            )}
          </div>

          {activeTab === 'runs' && <RunsTab agentKey={key!} token={token} />}
          {activeTab === 'settings' && <SettingsTab agent={agent} token={token} />}
          {activeTab === 'webhooks' && key === 'support' && <WebhookLogsTab token={token} />}
        </>
      )}
    </div>
  );
}
