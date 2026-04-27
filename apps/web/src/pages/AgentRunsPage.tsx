import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Bot, ArrowLeft, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/authStore';

function RunRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5">
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3.5 w-24 rounded font-mono" />
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

export default function AgentRunsPage() {
  const { key } = useParams<{ key: string }>();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token)!;

  const { data: runs, isLoading, isError } = useQuery<Run[]>({
    queryKey: ['agent-runs', key],
    queryFn: async () => {
      const res = await fetch(`/agents/${key}/runs?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    refetchInterval: 10_000,
  });

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <button
        onClick={() => navigate('/agents')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Agents
      </button>

      <div className="flex items-center gap-2 mb-1">
        <Bot className="w-5 h-5 text-primary" />
        <h1 className="text-2xl font-semibold">
          <code className="font-mono text-xl">{key}</code> — Runs
        </h1>
      </div>
      <p className="text-muted-foreground text-sm mb-6">Last 50 runs for this agent.</p>

      {isLoading && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="divide-y divide-border">
            {Array.from({ length: 6 }).map((_, i) => <RunRowSkeleton key={i} />)}
          </div>
        </div>
      )}
      {isError && <p className="text-sm text-destructive">Failed to load runs.</p>}

      {runs && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {runs.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm text-muted-foreground">No runs yet for this agent.</p>
            </div>
          ) : (
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
                    {run.error && (
                      <p className="text-xs text-destructive truncate">{run.error}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">{relTime(run.startedAt)}</p>
                    <p className="text-xs text-muted-foreground">{duration(run.startedAt, run.finishedAt)}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
