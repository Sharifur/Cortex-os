import { useState, useEffect, useRef } from 'react';
import { Activity, Bot, AlertCircle, Info, AlertTriangle, Bug, Wifi, WifiOff } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/authStore';

function LogRowSkeleton() {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Skeleton className="h-5 w-12 rounded shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3.5 w-24 rounded" />
          <Skeleton className="h-3.5 w-16 rounded" />
          <Skeleton className="h-3.5 w-14 rounded" />
        </div>
        <Skeleton className="h-4 w-3/4 rounded" />
      </div>
      <Skeleton className="h-3.5 w-12 rounded shrink-0" />
    </div>
  );
}

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

const MAX_ENTRIES = 500;

export default function ActivityPage() {
  const token = useAuthStore((s) => s.token)!;
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [connError, setConnError] = useState(false);
  const snapshotDone = useRef(false);
  const snapshotBuffer = useRef<LogEntry[]>([]);

  useEffect(() => {
    snapshotDone.current = false;
    snapshotBuffer.current = [];
    setConnError(false);

    const es = new EventSource(`/runs/activity/stream?token=${encodeURIComponent(token)}`);

    es.onopen = () => {
      setConnected(true);
      setConnError(false);
    };

    es.onmessage = (event) => {
      const data = JSON.parse(event.data as string) as { type?: string } & LogEntry;

      if (data.type === 'snapshot_done') {
        setLogs(snapshotBuffer.current);
        snapshotDone.current = true;
        return;
      }

      if (!snapshotDone.current) {
        snapshotBuffer.current.push(data as LogEntry);
        return;
      }

      setLogs((prev) => {
        const next = [data as LogEntry, ...prev];
        return next.length > MAX_ENTRIES ? next.slice(0, MAX_ENTRIES) : next;
      });
    };

    es.onerror = () => {
      setConnected(false);
      setConnError(true);
      es.close();
    };

    return () => {
      es.close();
      setConnected(false);
    };
  }, [token]);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-semibold">Activity</h1>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          {connected ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-green-500" />
              <span className="text-green-500">Live</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">{connError ? 'Disconnected' : 'Connecting…'}</span>
            </>
          )}
        </div>
      </div>
      <p className="text-muted-foreground text-sm mb-8">
        Real-time agent logs and Telegram approval activity.
      </p>

      {connError && (
        <p className="text-sm text-destructive mb-4">Connection lost. Reload to reconnect.</p>
      )}

      {!connected && !connError && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="divide-y divide-border">
            {Array.from({ length: 8 }).map((_, i) => <LogRowSkeleton key={i} />)}
          </div>
        </div>
      )}

      {connected && logs.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Bot className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No activity yet. Agents haven't run.</p>
        </div>
      )}

      {logs.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {logs.length} entries
            </span>
            <span className="ml-auto text-xs text-muted-foreground">newest first</span>
          </div>
          <div className="divide-y divide-border">
            {logs.map((entry) => {
              const lvl = LEVEL_CONFIG[entry.level] ?? LEVEL_CONFIG.INFO;
              return (
                <div key={entry.id} className="px-4 py-3 hover:bg-accent/30 transition-colors">
                  <div className="flex items-start gap-3">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono font-medium shrink-0 mt-0.5 ${lvl.cls}`}>
                      {lvl.icon}
                      {lvl.label}
                    </span>
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
