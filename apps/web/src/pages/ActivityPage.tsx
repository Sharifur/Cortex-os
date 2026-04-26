import { useQuery } from '@tanstack/react-query';
import { Activity, RefreshCw, Bot, AlertCircle, Info, AlertTriangle, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';

interface LogEntry {
  id: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
  runId: string;
  agentName: string;
  agentKey: string;
  runStatus: string;
}

const LEVEL_CONFIG = {
  DEBUG: { icon: <Bug className="w-3.5 h-3.5" />, cls: 'text-muted-foreground bg-muted/50', label: 'DEBUG' },
  INFO: { icon: <Info className="w-3.5 h-3.5" />, cls: 'text-blue-400 bg-blue-500/10', label: 'INFO' },
  WARN: { icon: <AlertTriangle className="w-3.5 h-3.5" />, cls: 'text-yellow-400 bg-yellow-500/10', label: 'WARN' },
  ERROR: { icon: <AlertCircle className="w-3.5 h-3.5" />, cls: 'text-red-400 bg-red-500/10', label: 'ERROR' },
};

const STATUS_CLS: Record<string, string> = {
  PENDING: 'text-muted-foreground',
  RUNNING: 'text-blue-400',
  AWAITING_APPROVAL: 'text-yellow-400',
  APPROVED: 'text-green-400',
  EXECUTED: 'text-green-500',
  REJECTED: 'text-red-400',
  FAILED: 'text-red-500',
  FOLLOWUP: 'text-purple-400',
};

async function fetchActivity(token: string): Promise<LogEntry[]> {
  const res = await fetch('/runs/activity?limit=200', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch activity');
  return res.json();
}

function shortId(id: string) {
  return id.slice(0, 8);
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function ActivityPage() {
  const token = useAuthStore((s) => s.token)!;

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['activity'],
    queryFn: () => fetchActivity(token),
    refetchInterval: 5000,
  });

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-semibold">Activity</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-1.5 text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
      <p className="text-muted-foreground text-sm mb-8">
        Live agent logs and Telegram approval activity. Auto-refreshes every 5 s.
      </p>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}
      {isError && (
        <p className="text-sm text-destructive">Failed to load activity.</p>
      )}

      {data && data.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Bot className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No activity yet. Agents haven't run.</p>
        </div>
      )}

      {data && data.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {data.length} entries
            </span>
            <span className="ml-auto text-xs text-muted-foreground">newest first</span>
          </div>
          <div className="divide-y divide-border">
            {data.map((entry) => {
              const lvl = LEVEL_CONFIG[entry.level] ?? LEVEL_CONFIG.INFO;
              return (
                <div key={entry.id} className="px-4 py-3 hover:bg-accent/30 transition-colors">
                  <div className="flex items-start gap-3">
                    {/* Level badge */}
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono font-medium shrink-0 mt-0.5 ${lvl.cls}`}>
                      {lvl.icon}
                      {lvl.label}
                    </span>

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-xs font-medium text-foreground">{entry.agentName}</span>
                        <span className="text-xs text-muted-foreground font-mono">
                          run:{shortId(entry.runId)}
                        </span>
                        <span className={`text-xs font-medium ${STATUS_CLS[entry.runStatus] ?? 'text-muted-foreground'}`}>
                          {entry.runStatus}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/90 break-words">{entry.message}</p>
                      {entry.meta && Object.keys(entry.meta).length > 0 && (
                        <pre className="mt-1 text-xs text-muted-foreground bg-muted/40 rounded px-2 py-1 overflow-x-auto">
                          {JSON.stringify(entry.meta, null, 2)}
                        </pre>
                      )}
                    </div>

                    {/* Timestamp */}
                    <span className="text-xs text-muted-foreground shrink-0">
                      {relTime(entry.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
