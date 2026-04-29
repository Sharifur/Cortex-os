import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Bot, Bug, Info, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/authStore';

interface Run {
  id: string;
  agentKey: string;
  agentName: string;
  triggerType: string;
  status: string;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

interface LogEntry {
  id: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

const LEVEL_CONFIG = {
  DEBUG: { icon: <Bug className="w-3.5 h-3.5" />, cls: 'text-muted-foreground bg-muted/50' },
  INFO: { icon: <Info className="w-3.5 h-3.5" />, cls: 'text-blue-400 bg-blue-500/10' },
  WARN: { icon: <AlertTriangle className="w-3.5 h-3.5" />, cls: 'text-yellow-400 bg-yellow-500/10' },
  ERROR: { icon: <AlertCircle className="w-3.5 h-3.5" />, cls: 'text-red-400 bg-red-500/10' },
};

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

function duration(start: string, end: string | null) {
  if (!end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

export default function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token)!;
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [streamDone, setStreamDone] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: run, refetch: refetchRun } = useQuery<Run>({
    queryKey: ['run', id],
    queryFn: async () => {
      const res = await fetch(`/runs/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  // Poll logs every 1.5s until the run finishes.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const res = await fetch(`/runs/${id}/logs`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = (await res.json()) as { logs: LogEntry[]; finished: boolean };
        if (cancelled) return;
        setLogs(data.logs ?? []);
        if (data.finished) {
          setStreamDone(true);
          refetchRun();
          return;
        }
      } catch { /* ignore one-off fetch errors and retry */ }
      if (!cancelled) timer = setTimeout(tick, 1500);
    };

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [id, token, refetchRun]);

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back
      </button>

      {/* Run header card */}
      {!run && (
        <div className="rounded-xl border border-border bg-card p-5 mb-6">
          <div className="flex items-start gap-3">
            <Skeleton className="w-9 h-9 rounded-lg shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-36 rounded" />
                <Skeleton className="h-5 w-20 rounded" />
                <Skeleton className="h-4 w-14 rounded" />
              </div>
              <Skeleton className="h-3.5 w-56 rounded" />
            </div>
          </div>
        </div>
      )}
      {run && (
        <div className="rounded-xl border border-border bg-card p-5 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Link
                    to={`/agents/${run.agentKey}/runs`}
                    className="text-sm font-semibold hover:text-primary transition-colors"
                  >
                    {run.agentName}
                  </Link>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_CLS[run.status] ?? 'text-muted-foreground bg-muted/50'}`}>
                    {run.status}
                  </span>
                  <span className="text-xs text-muted-foreground">{run.triggerType}</span>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <code className="text-xs text-muted-foreground font-mono">{run.id}</code>
                  {duration(run.startedAt, run.finishedAt) && (
                    <span className="text-xs text-muted-foreground">
                      {duration(run.startedAt, run.finishedAt)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {run.status === 'AWAITING_APPROVAL' && (
              <Link
                to="/approvals"
                className="text-xs bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-3 py-1.5 rounded-lg hover:bg-yellow-500/20 transition-colors shrink-0"
              >
                View pending approval →
              </Link>
            )}
          </div>

          {run.error && (
            <div className="mt-3 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
              {run.error}
            </div>
          )}
        </div>
      )}

      {/* Log stream */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Logs
          </span>
          {!streamDone && (
            <span className="flex items-center gap-1 ml-auto text-xs text-blue-400">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              streaming
            </span>
          )}
          {streamDone && (
            <span className="flex items-center gap-1 ml-auto text-xs text-green-500">
              <CheckCircle2 className="w-3.5 h-3.5" />
              complete
            </span>
          )}
        </div>

        <div className="divide-y divide-border max-h-[60vh] overflow-y-auto">
          {logs.length === 0 && !streamDone && (
            <p className="px-4 py-6 text-sm text-muted-foreground">Waiting for logs…</p>
          )}
          {logs.map((entry) => {
            const lvl = LEVEL_CONFIG[entry.level] ?? LEVEL_CONFIG.INFO;
            return (
              <div key={entry.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-accent/20 transition-colors">
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono font-medium shrink-0 mt-0.5 ${lvl.cls}`}>
                  {lvl.icon}
                  {entry.level}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground/90 break-words">{entry.message}</p>
                  {entry.meta && Object.keys(entry.meta).length > 0 && (
                    <pre className="mt-1 text-xs text-muted-foreground bg-muted/40 rounded px-2 py-1 overflow-x-auto">
                      {JSON.stringify(entry.meta, null, 2)}
                    </pre>
                  )}
                </div>
                <span className="text-xs text-muted-foreground font-mono shrink-0">
                  {new Date(entry.createdAt).toLocaleTimeString()}
                </span>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
