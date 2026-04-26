import { useState, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  CheckCircle2, XCircle, MessageSquare, Clock,
  AlertTriangle, ShieldAlert, Bot, Wifi, WifiOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/authStore';

interface ProposedAction {
  type: string;
  summary: string;
  payload: unknown;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface FollowupMessage {
  from: string;
  text: string;
  at: string;
}

interface Approval {
  id: string;
  runId: string;
  agentKey: string;
  agentName: string;
  runStatus: string;
  action: ProposedAction;
  status: string;
  followupMessages: FollowupMessage[] | null;
  createdAt: string;
  resolvedAt: string | null;
  expiresAt: string;
}

const RISK_CONFIG = {
  LOW: { cls: 'text-green-400 bg-green-500/10', label: 'Low risk' },
  MEDIUM: { cls: 'text-yellow-400 bg-yellow-500/10', label: 'Medium risk' },
  HIGH: { cls: 'text-orange-400 bg-orange-500/10', label: 'High risk' },
  CRITICAL: { cls: 'text-red-400 bg-red-500/10', label: 'Critical' },
};

function timeLeft(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  const h = Math.floor(ms / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

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
    onSuccess: () => {
      onRemove(approval.id);
      setShowFollowup(false);
      setInstruction('');
    },
  });

  const risk = RISK_CONFIG[approval.action.riskLevel] ?? RISK_CONFIG.MEDIUM;
  const busy = approveMutation.isPending || rejectMutation.isPending || followupMutation.isPending;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bot className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <span className="text-sm font-medium">{approval.agentName}</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Link
                to={`/runs/${approval.runId}`}
                className="text-xs font-mono text-muted-foreground hover:text-primary transition-colors"
              >
                run:{approval.runId.slice(0, 10)}
              </Link>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {timeLeft(approval.expiresAt)}
              </span>
            </div>
          </div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${risk.cls}`}>
          {risk.label}
        </span>
      </div>

      <div className="rounded-lg bg-muted/40 border border-border px-4 py-3 mb-3">
        <div className="flex items-center gap-1.5 mb-1">
          <ShieldAlert className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {approval.action.type}
          </span>
        </div>
        <p className="text-sm">{approval.action.summary}</p>
      </div>

      {approval.followupMessages && approval.followupMessages.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {approval.followupMessages.map((msg, i) => (
            <div key={i} className="flex gap-2 text-xs">
              <span className="text-muted-foreground shrink-0">{msg.from}:</span>
              <span className="text-foreground/80">{msg.text}</span>
            </div>
          ))}
        </div>
      )}

      {showFollowup && (
        <div className="flex gap-2 mb-3">
          <Input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Give the agent additional instructions…"
            className="text-sm"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && instruction && followupMutation.mutate()}
          />
          <Button
            size="sm"
            onClick={() => followupMutation.mutate()}
            disabled={!instruction || followupMutation.isPending}
          >
            Send
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { setShowFollowup(false); setInstruction(''); }}
          >
            Cancel
          </Button>
        </div>
      )}

      {!showFollowup && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
            onClick={() => approveMutation.mutate()}
            disabled={busy}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
            onClick={() => rejectMutation.mutate()}
            disabled={busy}
          >
            <XCircle className="w-3.5 h-3.5" />
            Reject
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 ml-auto"
            onClick={() => setShowFollowup(true)}
            disabled={busy}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Follow-up
          </Button>
        </div>
      )}
    </div>
  );
}

export default function ApprovalsPage() {
  const token = useAuthStore((s) => s.token)!;
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [connected, setConnected] = useState(false);
  const [connError, setConnError] = useState(false);
  // track snapshot receipt so we don't flash empty state before initial load
  const snapshotReceived = useRef(false);

  useEffect(() => {
    snapshotReceived.current = false;
    setConnError(false);

    const es = new EventSource(`/approvals/stream?token=${encodeURIComponent(token)}`);

    es.onopen = () => {
      setConnected(true);
      setConnError(false);
    };

    es.onmessage = (event) => {
      const msg = JSON.parse(event.data as string) as {
        type: 'snapshot' | 'created' | 'removed';
        data: Approval | Approval[] | { id: string };
      };

      if (msg.type === 'snapshot') {
        setApprovals(msg.data as Approval[]);
        snapshotReceived.current = true;
      } else if (msg.type === 'created') {
        setApprovals((prev) => [msg.data as Approval, ...prev]);
      } else if (msg.type === 'removed') {
        const { id } = msg.data as { id: string };
        setApprovals((prev) => prev.filter((a) => a.id !== id));
      }
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

  function removeApproval(id: string) {
    setApprovals((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-semibold">Approvals</h1>
          {approvals.length > 0 && (
            <span className="ml-1 bg-yellow-500/15 text-yellow-500 text-xs font-medium px-2 py-0.5 rounded-full">
              {approvals.length} pending
            </span>
          )}
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
              <span className="text-muted-foreground">
                {connError ? 'Disconnected' : 'Connecting…'}
              </span>
            </>
          )}
        </div>
      </div>
      <p className="text-muted-foreground text-sm mb-6">
        Review and act on actions your agents want to take.
      </p>

      {connError && (
        <p className="text-sm text-destructive mb-4">Connection lost. Reload to reconnect.</p>
      )}

      {connected && snapshotReceived.current && approvals.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <CheckCircle2 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No pending approvals. All clear.</p>
        </div>
      )}

      {approvals.length > 0 && (
        <div className="space-y-4">
          {approvals.map((approval) => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
              token={token}
              onRemove={removeApproval}
            />
          ))}
        </div>
      )}
    </div>
  );
}
