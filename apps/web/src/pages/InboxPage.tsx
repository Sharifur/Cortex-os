import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import {
  Mail, Eye, EyeOff, MessageSquare, RefreshCw, Bot, ExternalLink, Loader2, Clock,
} from 'lucide-react';

interface InboxRow {
  id: string;
  purpose: string;
  workspaceUuid: string | null;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  error: string | null;
  replyCount: number;
  lastReplyAt: string | null;
  lastSyncedAt: string | null;
  sentAt: string;
  openCount: number;
  firstOpenAt: string | null;
  lastOpenAt: string | null;
}

interface InboxReply {
  id: string;
  fromAddress: string;
  snippet: string | null;
  body: string | null;
  receivedAt: string;
}

async function api<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function OpenBadge({ row }: { row: InboxRow }) {
  if (row.status === 'failed') {
    return <span className="text-[10px] text-rose-400 border border-rose-400/30 rounded px-1.5 py-0.5">Failed</span>;
  }
  if (row.openCount > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium border border-emerald-500/30 rounded px-1.5 py-0.5">
        <Eye className="w-3 h-3" />
        Opened {row.openCount > 1 ? `${row.openCount}x` : ''} · {timeAgo(row.firstOpenAt!)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">
      <EyeOff className="w-3 h-3" /> Not opened
    </span>
  );
}

export default function InboxPage() {
  const token = useAuthStore((s) => s.token) ?? '';
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight') ?? '';

  const [purpose, setPurpose] = useState<string>('');
  const [openId, setOpenId] = useState<string | null>(highlightId || null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['inbox', purpose],
    queryFn: () => {
      const qs = purpose ? `?purpose=${encodeURIComponent(purpose)}` : '';
      return api<InboxRow[]>(token, `/taskip-internal/inbox${qs}`);
    },
  });

  const detailQuery = useQuery({
    queryKey: ['inbox-detail', openId],
    queryFn: () => api<{ email: InboxRow; replies: InboxReply[] }>(token, `/taskip-internal/inbox/${openId}`),
    enabled: !!openId,
  });

  const syncMutation = useMutation({
    mutationFn: (id: string) => api(token, `/taskip-internal/inbox/${id}/sync`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox'] });
      qc.invalidateQueries({ queryKey: ['inbox-detail', openId] });
    },
  });

  useEffect(() => {
    if (highlightId) {
      setTimeout(() => {
        document.getElementById(`inbox-row-${highlightId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 400);
    }
  }, [highlightId, data]);

  const rows = data ?? [];
  const openedCount = rows.filter((r) => r.openCount > 0).length;
  const repliedCount = rows.filter((r) => r.replyCount > 0).length;

  function handleDraftReply(r: InboxRow) {
    const openInfo = r.openCount > 0
      ? `opened it ${r.openCount} time${r.openCount > 1 ? 's' : ''} (first opened ${timeAgo(r.firstOpenAt!)})`
      : 'has not opened it yet';
    const replyInfo = r.replyCount > 0
      ? ` They replied ${r.replyCount} time${r.replyCount > 1 ? 's' : ''}, last ${timeAgo(r.lastReplyAt!)}.`
      : '';
    const query = `Draft a follow-up email to ${r.recipient} about the email "${r.subject}" sent ${timeAgo(r.sentAt)}. They ${openInfo}.${replyInfo} Use the SPAR system.`;
    navigate(`/agents/taskip_internal?query=${encodeURIComponent(query)}`);
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Inbox</h1>
            <p className="text-xs text-muted-foreground">
              Outbound emails with open tracking and reply sync. Auto-synced every 10 min for the last 14 days.
            </p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3 mt-6 mb-6">
        <Stat label="Total sent" value={rows.length.toString()} />
        <Stat label="Opened" value={openedCount.toString()} accent="emerald" />
        <Stat label="Replied" value={repliedCount.toString()} accent="blue" />
        <Stat label="Failed" value={rows.filter((r) => r.status === 'failed').length.toString()} accent="rose" />
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 p-4 border-b border-border">
          {(['', 'marketing', 'followup', 'offer', 'other'] as const).map((p) => (
            <button
              key={p || 'all'}
              onClick={() => setPurpose(p)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                purpose === p
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
              }`}
            >
              {p ? p.charAt(0).toUpperCase() + p.slice(1) : 'All'}
            </button>
          ))}
        </div>

        {isLoading && <p className="text-xs text-muted-foreground p-6">Loading…</p>}
        {!isLoading && rows.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-sm text-muted-foreground">No emails sent yet.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Emails sent via the Taskip Internal agent appear here with open tracking.</p>
          </div>
        )}

        <div className="divide-y divide-border">
          {rows.map((r) => {
            const isOpen = openId === r.id;
            const isHighlighted = r.id === highlightId;
            return (
              <div key={r.id} id={`inbox-row-${r.id}`} className={isHighlighted ? 'bg-emerald-500/5' : ''}>
                {/* Row summary */}
                <button
                  onClick={() => setOpenId(isOpen ? null : r.id)}
                  className="w-full text-left py-3 px-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold ${
                      r.status === 'failed' ? 'bg-rose-500/10 text-rose-400'
                        : r.replyCount > 0 ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-slate-500/10 text-slate-300'
                    }`}>{r.purpose}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.subject}</p>
                      <p className="text-xs text-muted-foreground truncate">to {r.recipient}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <OpenBadge row={r} />
                      {r.replyCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-blue-400 border border-blue-400/30 rounded px-1.5 py-0.5">
                          <MessageSquare className="w-3 h-3" /> {r.replyCount}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">{timeAgo(r.sentAt)}</span>
                    </div>
                  </div>
                </button>

                {/* Expanded */}
                {isOpen && (
                  <div className="px-4 pb-4">
                    <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-4">
                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => handleDraftReply(r)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs hover:bg-primary/90 transition-colors"
                        >
                          <Bot className="w-3.5 h-3.5" /> Draft reply with AI
                        </button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => syncMutation.mutate(r.id)}
                          disabled={syncMutation.isPending}
                        >
                          {syncMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
                          Sync replies
                        </Button>
                        {r.workspaceUuid && (
                          <span className="text-xs text-muted-foreground">workspace <code className="bg-muted px-1 rounded">{r.workspaceUuid}</code></span>
                        )}
                        {r.lastSyncedAt && (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" /> synced {timeAgo(r.lastSyncedAt)}
                          </span>
                        )}
                      </div>

                      {/* Open tracking detail */}
                      {r.openCount > 0 && (
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <p><span className="font-medium text-emerald-400">Opened {r.openCount}x</span></p>
                          <p>First: {new Date(r.firstOpenAt!).toLocaleString()} · Last: {new Date(r.lastOpenAt!).toLocaleString()}</p>
                        </div>
                      )}

                      {r.status === 'failed' && r.error && (
                        <p className="text-xs text-destructive">{r.error}</p>
                      )}

                      {/* Body */}
                      <pre className="text-xs whitespace-pre-wrap font-mono bg-background/60 rounded-md p-3">{r.body}</pre>

                      {/* Replies */}
                      {detailQuery.data?.email.id === r.id && detailQuery.data.replies.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground">
                            {detailQuery.data.replies.length} repl{detailQuery.data.replies.length === 1 ? 'y' : 'ies'}
                          </p>
                          {detailQuery.data.replies.map((reply) => (
                            <div key={reply.id} className="rounded-md border border-border bg-background/60 p-3">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium">{reply.fromAddress}</span>
                                <span className="text-[11px] text-muted-foreground">{new Date(reply.receivedAt).toLocaleString()}</span>
                              </div>
                              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{reply.body || reply.snippet}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: 'emerald' | 'rose' | 'blue' }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${
        accent === 'emerald' ? 'text-emerald-400'
          : accent === 'rose' ? 'text-rose-400'
          : accent === 'blue' ? 'text-blue-400'
          : 'text-foreground'
      }`}>{value}</p>
    </div>
  );
}
