import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Bot, ArrowLeft, ChevronRight, Save, Play, ToggleLeft, ToggleRight, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/authStore';

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

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
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

function RunsTab({ agentKey, token }: { agentKey: string; token: string }) {
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

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="divide-y divide-border">
          {Array.from({ length: 6 }).map((_, i) => <RunRowSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  if (isError) return <p className="text-sm text-destructive">Failed to load runs.</p>;

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
        {runs.map((run) => (
          <Link
            key={run.id}
            to={`/runs/${run.id}`}
            className="flex items-center gap-4 px-5 py-3.5 hover:bg-accent/30 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <code className="text-xs font-mono text-muted-foreground">{run.id.slice(0, 12)}</code>
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_CLS[run.status] ?? 'text-muted-foreground'}`}>
                  {run.status}
                </span>
                <span className="text-xs text-muted-foreground">{run.triggerType}</span>
              </div>
              {run.error && <p className="text-xs text-destructive truncate">{run.error}</p>}
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-muted-foreground">{relTime(run.startedAt)}</p>
              <p className="text-xs text-muted-foreground">{duration(run.startedAt, run.finishedAt)}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}

function SettingsTab({ agent, token }: { agent: AgentDetail; token: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description ?? '');
  const [configText, setConfigText] = useState(
    JSON.stringify(agent.config ?? {}, null, 2)
  );
  const [configError, setConfigError] = useState<string | null>(null);

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
    mutationFn: (config: Record<string, unknown>) =>
      apiFetch(token, `/agents/${agent.key}`, {
        method: 'PATCH',
        body: JSON.stringify({ config }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent', agent.key] }),
  });

  function handleSaveConfig() {
    try {
      const parsed = JSON.parse(configText);
      setConfigError(null);
      configMutation.mutate(parsed);
    } catch {
      setConfigError('Invalid JSON — fix the syntax before saving.');
    }
  }

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
      {/* Basic info */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold mb-4">Basic Info</h2>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Description</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} className="text-sm" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Enabled</p>
              <p className="text-xs text-muted-foreground">Allow this agent to run on schedule</p>
            </div>
            <button
              onClick={() => toggleMutation.mutate()}
              disabled={toggleMutation.isPending}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {agent.enabled
                ? <ToggleRight className="w-7 h-7 text-primary" />
                : <ToggleLeft className="w-7 h-7" />}
            </button>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              onClick={() => metaMutation.mutate()}
              disabled={metaMutation.isPending}
            >
              <Save className="w-3.5 h-3.5" />
              {metaMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
            {metaMutation.isSuccess && (
              <span className="text-xs text-green-500">Saved</span>
            )}
          </div>
        </div>
      </div>

      {/* Config JSON */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold">Agent Config</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Runtime configuration — controls segments, LLM, email provider, caps.
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleSaveConfig}
            disabled={configMutation.isPending}
          >
            <Save className="w-3.5 h-3.5" />
            {configMutation.isPending ? 'Saving…' : 'Save Config'}
          </Button>
        </div>
        {configError && (
          <p className="text-xs text-destructive mb-2">{configError}</p>
        )}
        {configMutation.isSuccess && !configError && (
          <p className="text-xs text-green-500 mb-2">Config saved</p>
        )}
        <textarea
          value={configText}
          onChange={(e) => { setConfigText(e.target.value); setConfigError(null); }}
          spellCheck={false}
          className="w-full h-80 font-mono text-xs bg-muted/40 border border-border rounded-lg p-3 resize-none focus:outline-none focus:ring-1 focus:ring-ring text-foreground"
        />
      </div>

      {/* Triggers + Routes info */}
      {(agent.triggers.length > 0 || agent.apiRoutes.length > 0 || agent.mcpTools.length > 0) && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold mb-4">Runtime Info</h2>
          <div className="space-y-4">
            {agent.triggers.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Triggers</p>
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
                <p className="text-xs text-muted-foreground mb-1.5">API Routes</p>
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
                <p className="text-xs text-muted-foreground mb-1.5">MCP Tools</p>
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
        </div>
      )}

      {/* Danger zone */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold mb-1">Manual Trigger</h2>
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

export default function AgentDetailPage() {
  const { key } = useParams<{ key: string }>();
  const token = useAuthStore((s) => s.token)!;
  const [activeTab, setActiveTab] = useState<'runs' | 'settings'>('runs');

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
    <div className="p-8 max-w-4xl mx-auto">
      <button
        onClick={() => window.history.back()}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Agents
      </button>

      {isLoading && <AgentDetailSkeleton />}
      {isError && <p className="text-sm text-destructive">Failed to load agent.</p>}

      {agent && (
        <>
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h1 className="text-xl font-semibold">{agent.name}</h1>
                <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{agent.key}</code>
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
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-border mb-6">
            <button
              onClick={() => setActiveTab('runs')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === 'runs'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <ChevronRight className="w-4 h-4" />
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
