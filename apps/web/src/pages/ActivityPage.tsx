import { useState, useEffect } from 'react';
import { Activity, Bot, AlertCircle, Info, AlertTriangle, Bug, Wifi, WifiOff, ChevronDown, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { getRealtimeSocket } from '@/lib/realtime';

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

const MAX_ENTRIES = 5000;
const PAGE_SIZE = 20;

export default function ActivityPage() {
  const token = useAuthStore((s) => s.token)!;
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function loadMore() {
    if (loadingMore) return;
    if (visibleCount < logs.length) {
      setVisibleCount((n) => n + PAGE_SIZE);
      return;
    }
    setLoadingMore(true);
    try {
      const oldest = logs.length ? new Date(logs[logs.length - 1].createdAt).toISOString() : new Date().toISOString();
      const res = await fetch(`/runs/activity?limit=${PAGE_SIZE}&before=${encodeURIComponent(oldest)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const older: LogEntry[] = await res.json();
      if (older.length === 0) return;
      setLogs((prev) => {
        const seen = new Set(prev.map((e) => e.id));
        return [...prev, ...older.filter((e) => !seen.has(e.id))];
      });
      setVisibleCount((n) => n + older.length);
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    const socket = getRealtimeSocket(token);

    const onConnect = () => {
      setConnected(true);
      setReconnecting(false);
      socket.emit('activity:subscribe');
    };
    const onDisconnect = () => { setConnected(false); setReconnecting(true); };
    const onReconnectAttempt = () => { setReconnecting(true); };

    const onSnapshot = (rows: LogEntry[]) => {
      setLogs((rows ?? []).slice(0, MAX_ENTRIES));
    };
    const onLog = (entry: LogEntry) => {
      setLogs((prev) => {
        const next = [entry, ...prev];
        return next.length > MAX_ENTRIES ? next.slice(0, MAX_ENTRIES) : next;
      });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect_attempt', onReconnectAttempt);
    socket.on('activity:snapshot', onSnapshot);
    socket.on('activity:log', onLog);

    if (socket.connected) onConnect();

    return () => {
      socket.emit('activity:unsubscribe');
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
      socket.off('activity:snapshot', onSnapshot);
      socket.off('activity:log', onLog);
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
          ) : reconnecting ? (
            <>
              <WifiOff className="w-3.5 h-3.5 text-yellow-500" />
              <span className="text-yellow-500">Reconnecting...</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Connecting...</span>
            </>
          )}
        </div>
      </div>
      <p className="text-muted-foreground text-sm mb-8">
        Real-time agent logs and Telegram approval activity.
      </p>

      {reconnecting && !connected && (
        <p className="text-sm text-yellow-500/80 mb-4">Connection lost. Reconnecting automatically...</p>
      )}

      {!connected && !reconnecting && (
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
              {Math.min(visibleCount, logs.length)} of {logs.length} entries
            </span>
            <span className="ml-auto text-xs text-muted-foreground">newest first</span>
          </div>
          <div className="divide-y divide-border">
            {logs.slice(0, visibleCount).map((entry) => {
              const lvl = LEVEL_CONFIG[entry.level] ?? LEVEL_CONFIG.INFO;
              const isExpanded = expandedIds.has(entry.id);
              const hasMeta = !!entry.meta && Object.keys(entry.meta).length > 0;
              return (
                <div key={entry.id} className="px-4 py-2.5 hover:bg-accent/30 transition-colors">
                  <button
                    type="button"
                    onClick={() => toggleExpanded(entry.id)}
                    className="w-full flex items-start gap-3 text-left"
                  >
                    <span className="text-muted-foreground shrink-0 mt-1">
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono font-medium shrink-0 mt-0.5 ${lvl.cls}`}>
                      {lvl.icon}
                      {lvl.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-foreground">{entry.agentName}</span>
                        <p className="text-sm text-foreground/90 break-words flex-1 min-w-0 truncate">{entry.message}</p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 mt-0.5">
                      {relTime(entry.createdAt)}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="mt-2 pl-7 space-y-2">
                      <div className="flex items-center gap-2 text-xs flex-wrap">
                        <span className="text-muted-foreground font-mono">run:{shortId(entry.runId)}</span>
                        <span className={`font-medium ${STATUS_CLS[entry.runStatus] ?? 'text-muted-foreground'}`}>
                          {entry.runStatus}
                        </span>
                        <span className="text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-foreground/90 break-words whitespace-pre-wrap">{entry.message}</p>
                      {hasMeta && (
                        <pre className="text-xs text-muted-foreground bg-muted/40 rounded px-2 py-1 overflow-x-auto">
                          {JSON.stringify(entry.meta, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-center px-4 py-3 border-t border-border">
            <Button size="sm" variant="outline" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Loading…' : 'Load more'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
