import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Bot, ArrowLeft, ChevronRight, Save, Play,
  ToggleLeft, ToggleRight, Settings, List,
  Mail, Cpu, Layers, Info, BookOpen,
  CheckCircle2, Circle, MessageSquare,
} from 'lucide-react';
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

          <SetupStep n={1} title="Configure LLM provider" done={false}>
            <p>Go to <strong>Settings → LLM Providers</strong> and set an API key for OpenAI, Gemini, or DeepSeek.</p>
            <p>Then set the <strong>Default Provider</strong> or configure a specific one in the LLM sub-tab above.</p>
          </SetupStep>

          <SetupStep n={2} title="Connect email provider" done={hasEmail}>
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

          <SetupStep n={3} title="Connect Telegram for approvals" done={false}>
            <p>Every email batch needs your approval before sending.</p>
            <ol className="list-decimal list-inside space-y-0.5 ml-1">
              <li>Message <code className="bg-muted px-1 rounded">@BotFather</code> → <code className="bg-muted px-1 rounded">/newbot</code> → get your token</li>
              <li>Message <code className="bg-muted px-1 rounded">@userinfobot</code> to get your Chat ID</li>
              <li>Paste both in <strong>Settings → Telegram</strong></li>
            </ol>
          </SetupStep>

          <SetupStep n={4} title="Add Taskip read-only database" done={false}>
            <p>The agent queries your Taskip Postgres DB to find users for each segment.</p>
            <p>In Coolify (or your <code className="bg-muted px-1 rounded">.env</code> file), set:</p>
            <code className="bg-muted px-2 py-1 rounded block mt-1 text-xs">
              TASKIP_DB_URL_READONLY=postgres://user:pass@host:5432/taskip
            </code>
            <p className="mt-1">Use a read-only Postgres role — this agent never writes to Taskip DB.</p>
          </SetupStep>

          <SetupStep n={5} title="Configure segments and limits" done={isRegistered}>
            <p>Use the <strong>Segments</strong> sub-tab to enable the email sequences you want.</p>
            <p>Set daily cap and follow-up limit in <strong>General</strong>.</p>
          </SetupStep>

          <SetupStep n={6} title="Test with a manual run" done={false}>
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

          <SetupStep n={1} title="Configure Telegram bot" done={agent.registered}>
            <p>The brief is delivered via your Telegram bot. If not yet configured:</p>
            <ol className="list-decimal list-inside space-y-0.5 ml-1 mt-1">
              <li>Message <code className="bg-muted px-1 rounded">@BotFather</code> → <code className="bg-muted px-1 rounded">/newbot</code> → copy the token</li>
              <li>Message <code className="bg-muted px-1 rounded">@userinfobot</code> to get your Chat ID</li>
              <li>Paste both in <strong>Settings → Telegram</strong></li>
            </ol>
          </SetupStep>

          <SetupStep n={2} title="Configure LLM provider" done={false}>
            <p>The agent uses an LLM to compose the brief text. Go to <strong>Settings → LLM Providers</strong> and add an API key.</p>
            <p className="mt-1">Then set the provider and model in the <strong>LLM</strong> sub-tab above. Default: <code className="bg-muted px-1 rounded">gpt-4o-mini</code>.</p>
          </SetupStep>

          <SetupStep n={3} title="Set your timezone schedule" done={false}>
            <p>
              Default schedule: <strong>08:30 Dhaka (02:30 UTC)</strong> for morning, <strong>21:00 Dhaka (15:00 UTC)</strong> for evening.
            </p>
            <p className="mt-1">If you're in a different timezone, adjust the cron expressions in the <strong>Schedule</strong> sub-tab.</p>
            <p className="mt-1 font-medium text-foreground/70">Cron format: <code className="bg-muted px-1 rounded">MINUTE HOUR * * *</code> (UTC)</p>
          </SetupStep>

          <SetupStep n={4} title="Enable the agent and test" done={agent.enabled}>
            <p>Toggle the agent <strong>Enabled</strong> in the General tab, then click <strong>Run now</strong>.</p>
            <p className="mt-1">You should receive a Telegram message within a few seconds. The brief will say "No pending approvals" and list any recent agent activity.</p>
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
    (agent.config as DailyReminderConfig) ?? {
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

          <SetupStep n={2} title="Configure LLM provider" done={false}>
            <p>The agent calls an LLM to classify each email and draft replies.</p>
            <p className="mt-1">Add an API key in <strong>Settings → LLM Providers</strong>, then set provider + model in the <strong>LLM</strong> sub-tab.</p>
            <p className="mt-1">Default: <code className="bg-muted px-1 rounded">gpt-4o-mini</code> — cost-effective for high-volume classification.</p>
          </SetupStep>

          <SetupStep n={3} title="Configure Telegram for reply approvals" done={false}>
            <p>When a <em>must-reply</em> email arrives, a Telegram message will show the drafted reply and ask for approval before sending.</p>
            <p className="mt-1">Set up your bot token and chat ID in <strong>Settings → Telegram</strong> if not already done.</p>
          </SetupStep>

          <SetupStep n={4} title="Set filters" done={false}>
            <p>In the <strong>Filters</strong> tab, add:</p>
            <ul className="list-disc list-inside space-y-0.5 ml-1 mt-1">
              <li><strong>Important senders</strong> — email addresses always classified as must-reply</li>
              <li><strong>Auto-archive domains</strong> — e.g. <code className="bg-muted px-1 rounded">substack.com</code>, <code className="bg-muted px-1 rounded">mailchimp.com</code></li>
            </ul>
          </SetupStep>

          <SetupStep n={5} title="Enable and run a test" done={agent.enabled}>
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
    (agent.config as EmailManagerConfig) ?? {
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
  { key: 'ask', label: 'Ask', icon: MessageSquare },
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
          and invoices, then proposes write actions (extend trial, mark refund) for your Telegram approval.
        </p>
        <div className="space-y-5">

          <SetupStep n={1} title="Add Taskip read-only DB connection" done={false}>
            <p>Set this env var in Coolify (or your <code className="bg-muted px-1 rounded">.env</code>):</p>
            <code className="bg-muted px-2 py-1 rounded block mt-1 text-xs font-mono">
              TASKIP_DB_URL_READONLY=postgres://readonly_user:pass@host:5432/taskip
            </code>
            <p className="mt-1">Create a read-only Postgres role in Taskip DB — grant <code className="bg-muted px-1 rounded">SELECT</code> on users, subscriptions, invoices.</p>
            <p className="mt-1">For write operations (extend_trial, mark_refund) the same connection is reused — those queries need <code className="bg-muted px-1 rounded">UPDATE</code> permission on those tables.</p>
          </SetupStep>

          <SetupStep n={2} title="Configure OpenAI API key" done={false}>
            <p>This agent uses function/tool calling — it requires <strong>OpenAI</strong> or <strong>DeepSeek</strong> (Gemini does not support tool calling in this router).</p>
            <p className="mt-1">Add your key in <strong>Settings → LLM Providers</strong>. Recommended model: <code className="bg-muted px-1 rounded">gpt-4o</code> for accurate reasoning over DB results.</p>
          </SetupStep>

          <SetupStep n={3} title="Configure Telegram for approval messages" done={false}>
            <p>Write operations (extend trial, mark refund) require Telegram approval before executing.</p>
            <p className="mt-1">Ensure your bot token and chat ID are set in <strong>Settings → Telegram</strong>.</p>
          </SetupStep>

          <SetupStep n={4} title="Test with a manual query" done={agent.enabled}>
            <p>Go to the <strong>Ask</strong> tab and type a question, for example:</p>
            <ul className="list-disc list-inside ml-1 mt-1 space-y-0.5">
              <li><em>Look up user john@example.com</em></li>
              <li><em>Show me the last 5 invoices for user abc-123</em></li>
              <li><em>Extend the trial for john@example.com by 7 days</em></li>
            </ul>
            <p className="mt-1">The agent will run, query the DB, and send the answer (or an approval request) to Telegram.</p>
          </SetupStep>

        </div>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
        <p className="text-xs font-medium text-amber-500 mb-1">Tool calling requirement</p>
        <p className="text-xs text-muted-foreground">
          This agent uses LLM function calling. Set the provider to <strong>OpenAI</strong> or <strong>DeepSeek</strong> in the LLM tab — Gemini is not supported for this agent.
        </p>
      </div>
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

  const triggerMutation = useMutation({
    mutationFn: () =>
      apiFetch(token, `/agents/${agent.key}/trigger`, {
        method: 'POST',
        body: JSON.stringify({ triggerType: 'MANUAL', payload: { query } }),
      }),
    onSuccess: (run: { id: string }) => navigate(`/runs/${run.id}`),
  });

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
            onClick={() => triggerMutation.mutate()}
            disabled={!query.trim() || !agent.enabled || !agent.registered || triggerMutation.isPending}
            className="gap-1.5"
          >
            <Play className="w-3.5 h-3.5" />
            {triggerMutation.isPending ? 'Starting…' : 'Run query'}
          </Button>
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
          {[
            'Look up user — enter an email',
            'Show subscriptions for user',
            'List invoices for user',
            'Extend trial by 7 days',
            'Mark invoice as refund',
          ].map((q) => (
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
    (agent.config as TaskipInternalConfig) ?? {
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
      {activeSub === 'ask' && (
        <TaskipInternalAskSubTab agent={agent} config={config} token={token} />
      )}
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
    (agent.config as TaskipConfig) ?? {
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

function GenericConfigEditor({ agent, token }: { agent: AgentDetail; token: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [configText, setConfigText] = useState(JSON.stringify(agent.config ?? {}, null, 2));
  const [configError, setConfigError] = useState<string | null>(null);

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
      const parsed = JSON.parse(configText);
      setConfigError(null);
      configMutation.mutate(parsed);
    } catch {
      setConfigError('Invalid JSON — fix the syntax before saving.');
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Config JSON</h3>
          <Button size="sm" onClick={handleSave} disabled={configMutation.isPending}>
            <Save className="w-3.5 h-3.5" />
            {configMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
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

      {isLoading && !agent && <AgentDetailSkeleton />}
      {isError && !agent && <p className="text-sm text-destructive">Failed to load agent.</p>}

      {agent && (
        <>
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
