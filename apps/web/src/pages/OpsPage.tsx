import { useState, useEffect, useRef, useCallback } from 'react';
import { getRealtimeSocket } from '@/lib/realtime';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  Activity, Bot, CheckCircle2, XCircle, MessageSquare,
  Clock, ShieldAlert, Wifi, WifiOff, ChevronRight, AlertCircle,
  Info, AlertTriangle, Bug, Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/authStore';

// ── Types ─────────────────────────────────────────────────────────────────────

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

interface Approval {
  id: string;
  runId: string;
  agentKey: string;
  agentName: string;
  runStatus: string;
  action: { type: string; summary: string; riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' };
  status: string;
  followupMessages: { from: string; text: string; at: string }[] | null;
  createdAt: string;
  resolvedAt: string | null;
  expiresAt: string;
}

interface TrackedRun {
  runId: string;
  agentKey: string;
  agentName: string;
  status: string;
  triggerType: string;
  startedAt: string;
  finishedAt: string | null;
  lastMessage: string;
  lastLevel: string;
  doneAt?: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

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

const RISK_CLS: Record<string, string> = {
  LOW: 'text-green-400 bg-green-500/10',
  MEDIUM: 'text-yellow-400 bg-yellow-500/10',
  HIGH: 'text-orange-400 bg-orange-500/10',
  CRITICAL: 'text-red-400 bg-red-500/10',
};

const LEVEL_CFG = {
  DEBUG: { icon: <Bug className="w-3 h-3" />, cls: 'text-muted-foreground bg-muted/50' },
  INFO:  { icon: <Info className="w-3 h-3" />, cls: 'text-blue-400 bg-blue-500/10' },
  WARN:  { icon: <AlertTriangle className="w-3 h-3" />, cls: 'text-yellow-400 bg-yellow-500/10' },
  ERROR: { icon: <AlertCircle className="w-3 h-3" />, cls: 'text-red-400 bg-red-500/10' },
};

const DONE_STATUSES = new Set(['EXECUTED', 'FAILED', 'REJECTED']);
const DONE_LINGER_MS = 30_000;
const MAX_LOGS = 300;

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function elapsed(start: string) {
  const ms = Date.now() - new Date(start).getTime();
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3600_000) return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
  return `${Math.floor(ms / 3600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m`;
}

function timeLeft(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  const h = Math.floor(ms / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

// ── Active Lane Card ──────────────────────────────────────────────────────────

function LaneCard({ run, tick }: { run: TrackedRun; tick: number }) {
  void tick;
  const isDone = DONE_STATUSES.has(run.status);
  return (
    <Link
      to={`/runs/${run.runId}`}
      className={`shrink-0 w-64 rounded-xl border bg-card p-4 flex flex-col gap-2 hover:bg-accent/30 transition-colors ${
        isDone ? 'opacity-60' : 'border-border'
      } ${run.status === 'RUNNING' ? 'border-blue-500/30' : run.status === 'AWAITING_APPROVAL' ? 'border-yellow-500/30' : 'border-border'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <Bot className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-sm font-medium truncate">{run.agentName}</span>
        </div>
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${STATUS_CLS[run.status] ?? 'text-muted-foreground bg-muted/50'}`}>
          {run.status.replace('_', ' ')}
        </span>
      </div>

      <p className="text-xs text-muted-foreground truncate leading-relaxed">
        {run.lastMessage || 'Waiting…'}
      </p>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-mono">{run.runId.slice(0, 8)}</span>
        <span>{isDone ? relTime(run.finishedAt ?? run.startedAt) : elapsed(run.startedAt)}</span>
      </div>
    </Link>
  );
}

// ── Approval Card ─────────────────────────────────────────────────────────────

function ApprovalCard({
  approval,
  token,
  onRemove,
}: {
  approval: Approval;
  token: string;
  onRemove: (id: string) => void;
}) {
  const [showFollowup, setShowFollowup] = useState(false);
  const [instruction, setInstruction] = useState('');

  async function apiPost(path: string, body?: unknown) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
    if (!res.ok) throw new Error('Request failed');
    return res.json();
  }

  const approveMutation = useMutation({
    mutationFn: () => apiPost(`/approvals/${approval.id}/approve`),
    onSuccess: () => onRemove(approval.id),
  });
  const rejectMutation = useMutation({
    mutationFn: () => apiPost(`/approvals/${approval.id}/reject`),
    onSuccess: () => onRemove(approval.id),
  });
  const followupMutation = useMutation({
    mutationFn: () => apiPost(`/approvals/${approval.id}/followup`, { instruction }),
    onSuccess: () => { onRemove(approval.id); setShowFollowup(false); setInstruction(''); },
  });

  const busy = approveMutation.isPending || rejectMutation.isPending || followupMutation.isPending;
  const risk = approval.action.riskLevel;

  return (
    <div className="rounded-lg border border-border bg-card/50 p-3.5">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-sm font-medium">{approval.agentName}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Link to={`/runs/${approval.runId}`} className="text-xs font-mono text-muted-foreground hover:text-primary transition-colors">
              run:{approval.runId.slice(0, 8)}
            </Link>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeLeft(approval.expiresAt)}
            </span>
          </div>
        </div>
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${RISK_CLS[risk] ?? RISK_CLS.MEDIUM}`}>
          {risk}
        </span>
      </div>

      <div className="rounded-md bg-muted/40 border border-border px-3 py-2 mb-2.5">
        <div className="flex items-center gap-1.5 mb-1">
          <ShieldAlert className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{approval.action.type}</span>
        </div>
        <p className="text-xs leading-relaxed">{approval.action.summary}</p>
      </div>

      {approval.followupMessages && approval.followupMessages.length > 0 && (
        <div className="mb-2.5 space-y-1">
          {approval.followupMessages.map((msg, i) => (
            <div key={i} className="flex gap-2 text-xs">
              <span className="text-muted-foreground shrink-0">{msg.from}:</span>
              <span className="text-foreground/80">{msg.text}</span>
            </div>
          ))}
        </div>
      )}

      {showFollowup ? (
        <div className="flex gap-1.5">
          <Input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Additional instructions…"
            className="text-xs h-8"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && instruction && followupMutation.mutate()}
          />
          <Button size="sm" className="h-8 shrink-0" onClick={() => followupMutation.mutate()} disabled={!instruction || busy}>
            Send
          </Button>
          <Button size="sm" variant="ghost" className="h-8 shrink-0" onClick={() => { setShowFollowup(false); setInstruction(''); }}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700 text-white"
            onClick={() => approveMutation.mutate()}
            disabled={busy}
          >
            <CheckCircle2 className="w-3 h-3" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
            onClick={() => rejectMutation.mutate()}
            disabled={busy}
          >
            <XCircle className="w-3 h-3" />
            Reject
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1 ml-auto"
            onClick={() => setShowFollowup(true)}
            disabled={busy}
          >
            <MessageSquare className="w-3 h-3" />
            Follow-up
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function OpsPage() {
  const token = useAuthStore((s) => s.token)!;

  // Live connection state
  const [logsConnected, setLogsConnected] = useState(false);
  const [logsError, setLogsError] = useState(false);
  const [approvalsConnected, setApprovalsConnected] = useState(false);

  // Log feed
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logSnapshotDone = useRef(false);
  const logBuffer = useRef<LogEntry[]>([]);

  // Filters
  const [agentFilter, setAgentFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('ALL');

  // Approvals
  const [approvals, setApprovals] = useState<Approval[]>([]);

  // Active run lanes — stored in a ref map, synced to state for rendering
  const runsMapRef = useRef(new Map<string, TrackedRun>());
  const [activeRuns, setActiveRuns] = useState<TrackedRun[]>([]);
  const [tick, setTick] = useState(0);

  // Flush runs map to state
  const flushRuns = useCallback(() => {
    setActiveRuns(
      Array.from(runsMapRef.current.values()).sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      ),
    );
  }, []);

  // Tick every second for elapsed timers
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Upsert a run from log entry
  const upsertRun = useCallback((entry: LogEntry) => {
    const map = runsMapRef.current;
    const existing = map.get(entry.runId);

    if (existing) {
      existing.status = entry.runStatus;
      existing.lastMessage = entry.message;
      existing.lastLevel = entry.level;
      if (DONE_STATUSES.has(entry.runStatus) && !existing.doneAt) {
        existing.doneAt = Date.now();
        setTimeout(() => {
          runsMapRef.current.delete(entry.runId);
          flushRuns();
        }, DONE_LINGER_MS);
      }
    } else if (!DONE_STATUSES.has(entry.runStatus)) {
      map.set(entry.runId, {
        runId: entry.runId,
        agentKey: entry.agentKey,
        agentName: entry.agentName,
        status: entry.runStatus,
        triggerType: 'MANUAL',
        startedAt: entry.createdAt,
        finishedAt: null,
        lastMessage: entry.message,
        lastLevel: entry.level,
      });
    }
    flushRuns();
  }, [flushRuns]);

  // Initial run fetch to seed active lanes
  useEffect(() => {
    fetch('/runs', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((runs: { id: string; status: string; triggerType: string; startedAt: string; finishedAt: string | null; agentKey?: string; agentName?: string }[]) => {
        const map = runsMapRef.current;
        for (const run of runs) {
          if (!DONE_STATUSES.has(run.status) && !map.has(run.id)) {
            map.set(run.id, {
              runId: run.id,
              agentKey: run.agentKey ?? '',
              agentName: run.agentName ?? run.agentKey ?? run.id.slice(0, 8),
              status: run.status,
              triggerType: run.triggerType,
              startedAt: run.startedAt,
              finishedAt: run.finishedAt,
              lastMessage: '',
              lastLevel: 'INFO',
            });
          }
        }
        flushRuns();
      })
      .catch(() => { /* ignore — stream will catch up */ });
  }, [token, flushRuns]);

  // Activity + Approvals over WebSocket (one shared socket).
  useEffect(() => {
    logSnapshotDone.current = false;
    logBuffer.current = [];
    setLogsError(false);

    const socket = getRealtimeSocket(token);

    const onConnect = () => {
      setLogsConnected(true);
      setApprovalsConnected(true);
      setLogsError(false);
      socket.emit('activity:subscribe');
      socket.emit('approvals:subscribe');
    };
    const onDisconnect = () => {
      setLogsConnected(false);
      setApprovalsConnected(false);
      setLogsError(true);
    };

    const onActivitySnapshot = (rows: LogEntry[]) => {
      const trimmed = (rows ?? []).slice(0, MAX_LOGS);
      setLogs(trimmed);
      trimmed.forEach((e) => upsertRun(e));
      logSnapshotDone.current = true;
    };
    const onActivityLog = (entry: LogEntry) => {
      upsertRun(entry);
      setLogs((prev) => {
        const next = [entry, ...prev];
        return next.length > MAX_LOGS ? next.slice(0, MAX_LOGS) : next;
      });
    };

    const onApprovalsSnapshot = (rows: Approval[]) => setApprovals(rows ?? []);
    const onApprovalCreated = (a: Approval) => setApprovals((p) => [a, ...p]);
    const onApprovalRemoved = (payload: { id: string }) => {
      setApprovals((p) => p.filter((a) => a.id !== payload.id));
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('activity:snapshot', onActivitySnapshot);
    socket.on('activity:log', onActivityLog);
    socket.on('approvals:snapshot', onApprovalsSnapshot);
    socket.on('approval:created', onApprovalCreated);
    socket.on('approval:removed', onApprovalRemoved);

    if (socket.connected) onConnect();

    return () => {
      socket.emit('activity:unsubscribe');
      socket.emit('approvals:unsubscribe');
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('activity:snapshot', onActivitySnapshot);
      socket.off('activity:log', onActivityLog);
      socket.off('approvals:snapshot', onApprovalsSnapshot);
      socket.off('approval:created', onApprovalCreated);
      socket.off('approval:removed', onApprovalRemoved);
    };
  }, [token, upsertRun]);

  // Unique agents from log history for filter dropdown
  const agentOptions = Array.from(new Set(logs.map((l) => l.agentKey))).sort();

  // Filtered logs
  const filteredLogs = logs.filter((l) => {
    if (agentFilter && l.agentKey !== agentFilter) return false;
    if (levelFilter !== 'ALL' && l.level !== levelFilter) return false;
    return true;
  });

  const isLive = logsConnected && approvalsConnected;

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* Header */}
      <div className="shrink-0 px-6 pt-5 pb-3 border-b border-border flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Operations
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Live view of all agent activity</p>
        </div>
        <div className="flex items-center gap-4">
          {activeRuns.filter((r) => !r.doneAt).length > 0 && (
            <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-1 rounded-full font-medium">
              {activeRuns.filter((r) => !r.doneAt).length} active
            </span>
          )}
          {approvals.length > 0 && (
            <span className="text-xs bg-yellow-500/10 text-yellow-400 px-2 py-1 rounded-full font-medium">
              {approvals.length} pending
            </span>
          )}
          <div className="flex items-center gap-1.5 text-xs">
            {isLive ? (
              <><Wifi className="w-3.5 h-3.5 text-green-500" /><span className="text-green-500">Live</span></>
            ) : (
              <><WifiOff className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-muted-foreground">{logsError ? 'Disconnected' : 'Connecting'}</span></>
            )}
          </div>
        </div>
      </div>

      {/* Active lanes */}
      <div className="shrink-0 px-6 py-3 border-b border-border">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2.5">Active runs</p>
        {activeRuns.length === 0 ? (
          <div className="h-16 flex items-center justify-center rounded-lg border border-dashed border-border">
            <span className="text-xs text-muted-foreground">No agents running right now</span>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
            {activeRuns.map((run) => (
              <LaneCard key={run.runId} run={run} tick={tick} />
            ))}
          </div>
        )}
      </div>

      {/* Main split: logs + approvals */}
      <div className="flex-1 min-h-0 flex">

        {/* Log feed */}
        <div className="flex-1 min-w-0 flex flex-col border-r border-border">
          <div className="shrink-0 px-4 py-2.5 border-b border-border flex items-center gap-3">
            <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="text-xs bg-transparent border-0 text-muted-foreground focus:outline-none cursor-pointer"
            >
              <option value="">All agents</option>
              {agentOptions.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
            <div className="flex items-center gap-1 ml-auto">
              {(['ALL', 'INFO', 'WARN', 'ERROR'] as const).map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setLevelFilter(lvl)}
                  className={`text-xs px-2 py-0.5 rounded font-medium transition-colors ${
                    levelFilter === lvl
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground shrink-0">{filteredLogs.length} entries</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border/50">
            {filteredLogs.length === 0 && (
              <div className="p-8 text-center text-xs text-muted-foreground">
                {logsConnected ? 'No log entries match the current filter.' : 'Connecting to activity stream…'}
              </div>
            )}
            {filteredLogs.map((entry) => {
              const lvl = LEVEL_CFG[entry.level] ?? LEVEL_CFG.INFO;
              return (
                <div key={entry.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-accent/20 transition-colors">
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono font-medium shrink-0 mt-0.5 ${lvl.cls}`}>
                    {lvl.icon}
                    {entry.level}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-xs font-medium">{entry.agentName}</span>
                      <Link
                        to={`/runs/${entry.runId}`}
                        className="text-xs font-mono text-muted-foreground hover:text-primary transition-colors"
                      >
                        {entry.runId.slice(0, 8)}
                      </Link>
                      <span className={`text-xs font-medium ${STATUS_CLS[entry.runStatus]?.split(' ')[0] ?? 'text-muted-foreground'}`}>
                        {entry.runStatus}
                      </span>
                    </div>
                    <p className="text-xs text-foreground/90 break-words leading-relaxed">{entry.message}</p>
                    {entry.meta && Object.keys(entry.meta).length > 0 && (
                      <pre className="mt-1 text-xs text-muted-foreground bg-muted/40 rounded px-2 py-1 overflow-x-auto">
                        {JSON.stringify(entry.meta, null, 2)}
                      </pre>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 mt-0.5">{relTime(entry.createdAt)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Approvals panel */}
        <div className="w-80 shrink-0 flex flex-col">
          <div className="shrink-0 px-4 py-2.5 border-b border-border flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pending Approvals</span>
            {approvals.length > 0 && (
              <span className="text-xs bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded-full font-medium">
                {approvals.length}
              </span>
            )}
            <Link
              to="/approvals"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 ml-auto"
            >
              All
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {approvals.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2">
                <CheckCircle2 className="w-6 h-6 text-muted-foreground" />
                <p className="text-xs text-muted-foreground text-center">No pending approvals</p>
              </div>
            ) : (
              approvals.map((approval) => (
                <ApprovalCard
                  key={approval.id}
                  approval={approval}
                  token={token}
                  onRemove={(id) => setApprovals((p) => p.filter((a) => a.id !== id))}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
