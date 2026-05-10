import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import {
  Mail, Eye, EyeOff, MessageSquare, RefreshCw, Bot, Loader2, Clock, ChevronRight,
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
  openCount?: number;
  firstOpenAt?: string | null;
  lastOpenAt?: string | null;
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

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inlineMarkup(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>');
}

function bodyToHtml(text: string): string {
  const blocks = text.split(/\n\n+/);
  return blocks.map(block => {
    const lines = block.split('\n');
    const nonEmpty = lines.filter(l => l.trim());
    if (nonEmpty.length > 0 && nonEmpty.every(l => l.trimStart().startsWith('- '))) {
      const items = nonEmpty
        .map(l => `<li>${inlineMarkup(escHtml(l.replace(/^[\s]*-\s*/, '').trim()))}</li>`)
        .join('');
      return `<ul style="margin:0 0 0.75em 1.4em;padding:0">${items}</ul>`;
    }
    const content = lines.map(l => inlineMarkup(escHtml(l))).join('<br>');
    return `<p style="margin:0 0 0.75em">${content}</p>`;
  }).join('');
}

function initials(email: string): string {
  const name = email.split('@')[0];
  const parts = name.split(/[._-]/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function purposeColor(purpose: string): string {
  switch (purpose) {
    case 'marketing': return 'bg-violet-500/15 text-violet-300';
    case 'followup': return 'bg-blue-500/15 text-blue-300';
    case 'offer': return 'bg-amber-500/15 text-amber-300';
    default: return 'bg-slate-500/15 text-slate-300';
  }
}

function avatarColor(email: string): string {
  const colors = [
    'bg-indigo-500', 'bg-violet-500', 'bg-cyan-600', 'bg-emerald-600',
    'bg-rose-500', 'bg-amber-500', 'bg-sky-500', 'bg-teal-600',
  ];
  let h = 0;
  for (const c of email) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(h) % colors.length];
}

export default function InboxPage() {
  const token = useAuthStore((s) => s.token) ?? '';
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight') ?? '';

  const [purpose, setPurpose] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string | null>(highlightId || null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['inbox', purpose],
    queryFn: () => {
      const qs = purpose ? `?purpose=${encodeURIComponent(purpose)}` : '';
      return api<InboxRow[]>(token, `/taskip-internal/inbox${qs}`);
    },
  });

  const detailQuery = useQuery({
    queryKey: ['inbox-detail', selectedId],
    queryFn: () => api<{ email: InboxRow; replies: InboxReply[] }>(token, `/taskip-internal/inbox/${selectedId}`),
    enabled: !!selectedId,
  });

  const syncMutation = useMutation({
    mutationFn: (id: string) => api(token, `/taskip-internal/inbox/${id}/sync`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox'] });
      qc.invalidateQueries({ queryKey: ['inbox-detail', selectedId] });
    },
  });

  useEffect(() => {
    if (highlightId && data) {
      setSelectedId(highlightId);
      setTimeout(() => {
        document.getElementById(`inbox-row-${highlightId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [highlightId, data]);

  const rows = data ?? [];
  const selected = rows.find((r) => r.id === selectedId) ?? null;

  function handleDraftReply(r: InboxRow) {
    const opens = r.openCount ?? 0;
    const openInfo = opens > 0
      ? `opened it ${opens} time${opens > 1 ? 's' : ''} (first opened ${timeAgo(r.firstOpenAt!)})`
      : 'has not opened it yet';
    const replyInfo = r.replyCount > 0
      ? ` They replied ${r.replyCount} time${r.replyCount > 1 ? 's' : ''}, last ${timeAgo(r.lastReplyAt!)}.`
      : '';
    const query = `Draft a follow-up email to ${r.recipient} about the email "${r.subject}" sent ${timeAgo(r.sentAt)}. They ${openInfo}.${replyInfo} Use the SPAR system.`;
    navigate(`/agents/taskip_internal?query=${encodeURIComponent(query)}`);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 px-6 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
            <Mail className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight">Inbox</h1>
            <p className="text-[11px] text-muted-foreground">Outbound emails — open tracking + reply sync every 15 min</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Stats pills */}
          <span className="text-[11px] text-muted-foreground border border-border rounded-full px-2.5 py-0.5">
            {rows.length} sent
          </span>
          <span className="text-[11px] text-emerald-400 border border-emerald-500/30 rounded-full px-2.5 py-0.5">
            {rows.filter((r) => (r.openCount ?? 0) > 0).length} opened
          </span>
          <span className="text-[11px] text-blue-400 border border-blue-400/30 rounded-full px-2.5 py-0.5">
            {rows.filter((r) => r.replyCount > 0).length} replied
          </span>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 px-6 py-2 border-b border-border shrink-0">
        {(['', 'marketing', 'followup', 'offer', 'other'] as const).map((p) => (
          <button
            key={p || 'all'}
            onClick={() => setPurpose(p)}
            className={`text-[11px] px-3 py-1 rounded-full border transition-colors ${
              purpose === p
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
            }`}
          >
            {p ? p.charAt(0).toUpperCase() + p.slice(1) : 'All'}
          </button>
        ))}
      </div>

      {/* Two-panel body */}
      <div className="flex flex-1 min-h-0">
        {/* Left: email list */}
        <div className="w-80 shrink-0 border-r border-border flex flex-col overflow-y-auto">
          {isLoading && <p className="text-xs text-muted-foreground p-6">Loading…</p>}
          {!isLoading && rows.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground">No emails yet.</p>
            </div>
          )}
          {rows.map((r) => {
            const isSelected = selectedId === r.id;
            const isHighlighted = r.id === highlightId;
            const opens = r.openCount ?? 0;
            return (
              <button
                key={r.id}
                id={`inbox-row-${r.id}`}
                onClick={() => setSelectedId(isSelected ? null : r.id)}
                className={`w-full text-left px-4 py-3 border-b border-border transition-colors hover:bg-muted/30 ${
                  isSelected ? 'bg-primary/10 border-l-2 border-l-primary' : ''
                } ${isHighlighted && !isSelected ? 'bg-emerald-500/5' : ''}`}
              >
                <div className="flex items-start gap-2.5">
                  {/* Avatar */}
                  <div className={`shrink-0 w-8 h-8 rounded-full ${avatarColor(r.recipient)} flex items-center justify-center text-white text-[11px] font-semibold mt-0.5`}>
                    {initials(r.recipient)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-xs font-medium truncate">{r.recipient}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(r.sentAt)}</span>
                    </div>
                    <p className="text-[11px] font-medium truncate text-foreground/90">{r.subject}</p>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">{r.body.slice(0, 80)}</p>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-semibold ${purposeColor(r.purpose)}`}>
                        {r.purpose}
                      </span>
                      {opens > 0 ? (
                        <span className="inline-flex items-center gap-0.5 text-[9px] text-emerald-400">
                          <Eye className="w-2.5 h-2.5" /> {opens > 1 ? `${opens}x` : 'Opened'}
                        </span>
                      ) : r.status !== 'failed' ? (
                        <span className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground">
                          <EyeOff className="w-2.5 h-2.5" /> Not opened
                        </span>
                      ) : null}
                      {r.status === 'failed' && (
                        <span className="text-[9px] text-rose-400">Failed</span>
                      )}
                      {r.replyCount > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] text-blue-400">
                          <MessageSquare className="w-2.5 h-2.5" /> {r.replyCount}
                        </span>
                      )}
                    </div>
                  </div>
                  {isSelected && <ChevronRight className="w-3 h-3 text-primary shrink-0 mt-2" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: detail panel */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {!selected && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Mail className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Select an email to read</p>
              </div>
            </div>
          )}

          {selected && (
            <div className="p-6 max-w-2xl">
              {/* Header */}
              <div className="mb-4">
                <h2 className="text-lg font-semibold">{selected.subject}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <div className={`w-6 h-6 rounded-full ${avatarColor(selected.recipient)} flex items-center justify-center text-white text-[10px] font-semibold`}>
                    {initials(selected.recipient)}
                  </div>
                  <span className="text-sm text-muted-foreground">To: {selected.recipient}</span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">{new Date(selected.sentAt).toLocaleString()}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-semibold ${purposeColor(selected.purpose)}`}>
                    {selected.purpose}
                  </span>
                </div>
              </div>

              {/* Open tracking */}
              {selected.status !== 'failed' && (
                <div className={`rounded-lg border px-3 py-2 mb-4 text-xs flex items-center gap-2 ${
                  (selected.openCount ?? 0) > 0
                    ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
                    : 'border-border bg-muted/10 text-muted-foreground'
                }`}>
                  {(selected.openCount ?? 0) > 0 ? (
                    <>
                      <Eye className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Opened {selected.openCount}x — first {selected.firstOpenAt ? new Date(selected.firstOpenAt).toLocaleString() : '—'}
                        {selected.lastOpenAt && selected.firstOpenAt !== selected.lastOpenAt
                          ? ` · last ${new Date(selected.lastOpenAt).toLocaleString()}`
                          : ''}
                      </span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3.5 h-3.5 shrink-0" />
                      <span>Not opened yet</span>
                    </>
                  )}
                </div>
              )}

              {selected.status === 'failed' && selected.error && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 mb-4 text-xs text-rose-400">
                  {selected.error}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <button
                  onClick={() => handleDraftReply(selected)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs hover:bg-primary/90 transition-colors"
                >
                  <Bot className="w-3.5 h-3.5" /> Draft reply with AI
                </button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => syncMutation.mutate(selected.id)}
                  disabled={syncMutation.isPending}
                >
                  {syncMutation.isPending
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
                  Sync replies
                </Button>
                {selected.lastSyncedAt && (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" /> synced {timeAgo(selected.lastSyncedAt)}
                  </span>
                )}
              </div>

              {/* Email body */}
              <div className="rounded-xl border border-border bg-card p-5 mb-4">
                <div
                  className="text-sm leading-relaxed text-foreground/90 prose-sm"
                  dangerouslySetInnerHTML={{ __html: bodyToHtml(selected.body) }}
                />
              </div>

              {/* Replies */}
              {detailQuery.isLoading && (
                <p className="text-xs text-muted-foreground">Loading replies…</p>
              )}
              {detailQuery.data?.email.id === selected.id && detailQuery.data.replies.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {detailQuery.data.replies.length} repl{detailQuery.data.replies.length === 1 ? 'y' : 'ies'}
                  </p>
                  {detailQuery.data.replies.map((reply) => (
                    <div key={reply.id} className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full ${avatarColor(reply.fromAddress)} flex items-center justify-center text-white text-[10px] font-semibold`}>
                            {initials(reply.fromAddress)}
                          </div>
                          <span className="text-xs font-medium">{reply.fromAddress}</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground">{new Date(reply.receivedAt).toLocaleString()}</span>
                      </div>
                      <div
                        className="text-sm text-foreground/80 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: bodyToHtml(reply.body || reply.snippet || '') }}
                      />
                    </div>
                  ))}
                </div>
              )}
              {detailQuery.data?.email.id === selected.id && detailQuery.data.replies.length === 0 && (
                <p className="text-xs text-muted-foreground">No replies yet.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
