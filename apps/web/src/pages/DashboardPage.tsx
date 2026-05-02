import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Activity, CheckCircle2, AlertCircle, Bot, Clock,
  TrendingUp, ChevronRight, Zap, Users, MessageSquare,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/authStore';

interface StatusBreakdown {
  status: string;
  n: number;
}

interface TopAgent {
  key: string;
  name: string;
  runs: number;
  failures: number;
}

interface RecentRun {
  id: string;
  status: string;
  triggerType: string;
  startedAt: string;
  finishedAt: string | null;
  agentKey: string;
  agentName: string;
}

interface Stats {
  totalRuns: number;
  runsToday: number;
  pendingApprovals: number;
  failedRuns24h: number;
  totalAgents: number;
  enabledAgents: number;
  statusBreakdown: StatusBreakdown[];
  topAgents: TopAgent[];
  recentRuns: RecentRun[];
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
  if (!end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

function StatCard({
  icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border bg-card p-5 ${highlight ? 'border-yellow-500/40' : 'border-border'}`}>
      <div className="flex items-center gap-2 mb-3">{icon}<span className="text-sm font-medium text-muted-foreground">{label}</span></div>
      <p className="text-3xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <Skeleton className="w-5 h-5 rounded" />
        <Skeleton className="h-4 w-28 rounded" />
      </div>
      <Skeleton className="h-9 w-16 rounded" />
      <Skeleton className="h-3 w-24 rounded mt-2" />
    </div>
  );
}

interface LivechatStats {
  open: number;
  needsHuman: number;
  today: number;
  pendingDrafts: number;
}

export default function DashboardPage() {
  const token = useAuthStore((s) => s.token)!;

  const { data: chatStats } = useQuery<LivechatStats>({
    queryKey: ['livechat-session-stats'],
    queryFn: async () => {
      const res = await fetch('/agents/livechat/sessions/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const { data, isLoading } = useQuery<Stats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await fetch('/dashboard/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    refetchInterval: 30_000,
  });

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-1">Dashboard</h1>
      <p className="text-muted-foreground text-sm mb-8">Platform overview</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : data ? (
          <>
            <StatCard
              icon={<Activity className="w-5 h-5 text-primary" />}
              label="Total runs"
              value={data.totalRuns}
              sub="all time"
            />
            <StatCard
              icon={<Zap className="w-5 h-5 text-blue-400" />}
              label="Runs today"
              value={data.runsToday}
              sub={new Date().toLocaleDateString('en-US', { weekday: 'long' })}
            />
            <StatCard
              icon={<Clock className="w-5 h-5 text-yellow-500" />}
              label="Pending approvals"
              value={data.pendingApprovals}
              sub={data.pendingApprovals > 0 ? 'action required' : 'all clear'}
              highlight={data.pendingApprovals > 0}
            />
            <StatCard
              icon={<AlertCircle className="w-5 h-5 text-red-500" />}
              label="Failures (24h)"
              value={data.failedRuns24h}
              sub={data.failedRuns24h === 0 ? 'no failures' : 'needs attention'}
            />
            <StatCard
              icon={<Bot className="w-5 h-5 text-primary" />}
              label="Total agents"
              value={data.totalAgents}
              sub={`${data.enabledAgents} enabled`}
            />
            <StatCard
              icon={<CheckCircle2 className="w-5 h-5 text-green-500" />}
              label="Success rate (7d)"
              value={(() => {
                const total = data.statusBreakdown.reduce((s, r) => s + r.n, 0);
                const ok = data.statusBreakdown.find((r) => r.status === 'EXECUTED')?.n ?? 0;
                return total === 0 ? '—' : `${Math.round((ok / total) * 100)}%`;
              })()}
              sub="executed / all"
            />
            <StatCard
              icon={<TrendingUp className="w-5 h-5 text-purple-400" />}
              label="Runs (7d)"
              value={data.statusBreakdown.reduce((s, r) => s + r.n, 0)}
              sub="last 7 days"
            />
            <StatCard
              icon={<Users className="w-5 h-5 text-muted-foreground" />}
              label="Active agents (7d)"
              value={data.topAgents.filter((a) => a.runs > 0).length}
              sub={`of ${data.topAgents.length} total`}
            />
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <section>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground" />
            Status breakdown — last 7 days
          </h2>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {isLoading ? (
              <div className="divide-y divide-border">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <Skeleton className="h-4 w-24 rounded" />
                    <Skeleton className="h-4 w-8 rounded" />
                  </div>
                ))}
              </div>
            ) : data && data.statusBreakdown.length > 0 ? (
              <div className="divide-y divide-border">
                {data.statusBreakdown.map((row) => {
                  const total = data.statusBreakdown.reduce((s, r) => s + r.n, 0);
                  const pct = total > 0 ? Math.round((row.n / total) * 100) : 0;
                  return (
                    <div key={row.status} className="flex items-center gap-3 px-4 py-2.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium w-36 text-center shrink-0 ${STATUS_CLS[row.status] ?? 'text-muted-foreground bg-muted/50'}`}>
                        {row.status}
                      </span>
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/60"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-8 text-right shrink-0">{row.n}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center text-sm text-muted-foreground">No runs in the last 7 days.</div>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Bot className="w-4 h-4 text-muted-foreground" />
            Top agents — last 7 days
          </h2>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {isLoading ? (
              <div className="divide-y divide-border">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <Skeleton className="h-4 w-28 rounded" />
                    <Skeleton className="h-4 w-10 rounded" />
                  </div>
                ))}
              </div>
            ) : data && data.topAgents.filter((a) => a.runs > 0).length > 0 ? (
              <div className="divide-y divide-border">
                {data.topAgents.filter((a) => a.runs > 0).map((agent) => (
                  <Link
                    key={agent.key}
                    to={`/agents/${agent.key}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/30 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Bot className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{agent.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{agent.key}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium">{agent.runs}</p>
                      {agent.failures > 0 && (
                        <p className="text-xs text-red-400">{agent.failures} failed</p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-sm text-muted-foreground">No agent runs yet.</div>
            )}
          </div>
        </section>
      </div>

      {chatStats !== undefined && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
            Live Chat
          </h2>
          <Link to="/livechat" className="block rounded-xl border border-border bg-card hover:bg-accent/30 transition-colors p-4">
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold ${chatStats.open > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {chatStats.open}
                </span>
                <span className="text-xs text-muted-foreground">active sessions</span>
              </div>
              {chatStats.needsHuman > 0 && (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  <span className="text-sm font-medium text-amber-500">{chatStats.needsHuman} need human</span>
                </div>
              )}
              {chatStats.pendingDrafts > 0 && (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                  <span className="text-sm font-medium text-blue-400">{chatStats.pendingDrafts} pending draft{chatStats.pendingDrafts > 1 ? 's' : ''}</span>
                </div>
              )}
              <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                <span>{chatStats.today} session{chatStats.today !== 1 ? 's' : ''} today</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          </Link>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          Recent runs
        </h2>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {isLoading ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                  <Skeleton className="h-3.5 w-24 rounded" />
                  <Skeleton className="h-5 w-20 rounded" />
                  <div className="flex-1" />
                  <Skeleton className="h-3.5 w-16 rounded" />
                </div>
              ))}
            </div>
          ) : data && data.recentRuns.length > 0 ? (
            <div className="divide-y divide-border">
              {data.recentRuns.map((run) => (
                <Link
                  key={run.id}
                  to={`/runs/${run.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-accent/30 transition-colors"
                >
                  <code className="text-xs font-mono text-muted-foreground w-24 shrink-0">{run.id.slice(0, 10)}</code>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${STATUS_CLS[run.status] ?? 'text-muted-foreground'}`}>
                    {run.status}
                  </span>
                  <span className="text-sm flex-1 min-w-0 truncate">{run.agentName}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{run.triggerType}</span>
                  {duration(run.startedAt, run.finishedAt) && (
                    <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
                      {duration(run.startedAt, run.finishedAt)}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground shrink-0">{relTime(run.startedAt)}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">No runs yet.</div>
          )}
        </div>
      </section>

      {data && data.pendingApprovals > 0 && (
        <div className="mt-6 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-yellow-500" />
            <span className="text-sm font-medium">
              {data.pendingApprovals} action{data.pendingApprovals > 1 ? 's' : ''} awaiting your review
            </span>
          </div>
          <Link
            to="/approvals"
            className="text-sm text-yellow-500 hover:text-yellow-400 font-medium flex items-center gap-1"
          >
            Review
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
