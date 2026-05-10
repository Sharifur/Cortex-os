import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Mail, Eye, EyeOff, MessageSquare, RefreshCw, Bot, Loader2, Clock, ChevronRight, Reply, Send, X,
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

interface RunDetail {
  id: string;
  status: string;
  proposedActions: { type: string; summary: string; payload?: Record<string, unknown> }[] | null;
  error: string | null;
  finishedAt: string | null;
}

const TERMINAL_STATUSES = new Set(['EXECUTED', 'FAILED', 'REJECTED']);

function extractRunResponse(run: RunDetail): string {
  if (run.status === 'FAILED') return `Error: ${run.error ?? 'Run failed'}`;
  if (run.status === 'REJECTED') return 'Action was rejected.';
  const actions = run.proposedActions ?? [];
  if (!actions.length) return 'Done.';
  const batch = actions.find(a => a.type === 'batch_send_email');
  if (batch) {
    const emails = (batch.payload as any)?.emails ?? [];
    const lines = [`Batch ready — ${emails.length} email${emails.length !== 1 ? 's' : ''} awaiting Telegram approval:`];
    for (const [i, e] of emails.entries()) lines.push(`${i + 1}. **${e.recipient}** — ${e.subject}`);
    lines.push('', 'Approve via Telegram.');
    return lines.join('\n');
  }
  const notify = actions.find(a => ['notify_result', 'send_telegram_brief', 'notify_email'].includes(a.type));
  if (notify?.payload?.['message']) return String(notify.payload['message']);
  const approval = actions.find(a => ['extend_trial', 'mark_refund', 'send_reply', 'send_email'].includes(a.type));
  if (approval) return `Awaiting Telegram approval: ${approval.summary}`;
  return actions.map(a => a.summary).join('\n') || 'Done.';
}

function renderMd(text: string): string {
  let s = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  s = s.replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre class="bg-muted rounded p-2 text-xs font-mono overflow-x-auto my-1.5"><code>$1</code></pre>');
  s = s.replace(/`([^`\n]+)`/g, '<code class="bg-muted px-1 rounded text-xs font-mono">$1</code>');
  s = s.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');
  s = s.replace(/^### (.+)$/gm, '<p class="font-semibold text-sm mt-2">$1</p>');
  s = s.replace(/^## (.+)$/gm, '<p class="font-semibold mt-2">$1</p>');
  s = s.replace(/^[-*] (.+)$/gm, '<li class="ml-3 list-disc text-sm">$1</li>');
  s = s.replace(/(<li[^>]*>.*<\/li>\n?)+/g, m => `<ul class="my-1">${m}</ul>`);
  s = s.replace(/^\d+\. (.+)$/gm, '<li class="ml-3 list-decimal text-sm">$1</li>');
  s = s.replace(/\n/g, '<br>');
  return s;
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
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight') ?? '';

  const [purpose, setPurpose] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string | null>(highlightId || null);

  // AI chat drawer
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState<{ role: 'user' | 'agent'; content: string }[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiRunId, setAiRunId] = useState<string | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const aiBottomRef = useRef<HTMLDivElement>(null);
  const aiInputRef = useRef<HTMLTextAreaElement>(null);

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

  const aiRunQuery = useQuery<RunDetail>({
    queryKey: ['ai-drawer-run', aiRunId],
    queryFn: () => api<RunDetail>(token, `/runs/${aiRunId}`),
    enabled: !!aiRunId,
    refetchInterval: (q) => {
      const d = q.state.data;
      if (!d) return 2000;
      return (TERMINAL_STATUSES.has(d.status) || d.status === 'AWAITING_APPROVAL') ? false : 2000;
    },
  });

  useEffect(() => {
    if (!aiRunQuery.data || !aiRunId) return;
    const run = aiRunQuery.data;
    if (!TERMINAL_STATUSES.has(run.status) && run.status !== 'AWAITING_APPROVAL') return;
    const content = extractRunResponse(run);
    setAiMessages(prev => [...prev, { role: 'agent', content }]);
    setAiThinking(false);
    setAiRunId(null);
  }, [aiRunQuery.data, aiRunId]);

  useEffect(() => {
    aiBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages, aiThinking]);

  async function triggerAiRun(msg: string, history: { role: 'user' | 'agent'; content: string }[]) {
    setAiMessages(prev => [...prev, { role: 'user', content: msg }]);
    setAiThinking(true);
    const historyCtx = history.slice(-6)
      .map(m => `${m.role === 'user' ? 'User' : 'Agent'}: ${m.content}`)
      .join('\n') || undefined;
    try {
      const run = await api<{ id: string }>(token, '/agents/taskip_internal/trigger', {
        method: 'POST',
        body: JSON.stringify({
          triggerType: 'MANUAL',
          payload: { query: msg, source: 'chat', history: historyCtx },
        }),
      });
      setAiRunId(run.id);
    } catch {
      setAiThinking(false);
      setAiMessages(prev => [...prev, { role: 'agent', content: 'Failed to contact agent. Make sure the API is running.' }]);
    }
  }

  function handleSendAi() {
    const msg = aiInput.trim();
    if (!msg || aiThinking) return;
    setAiInput('');
    triggerAiRun(msg, aiMessages);
  }

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

  const [replyOpen, setReplyOpen] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [replyPlainText, setReplyPlainText] = useState(false);
  const [replySending, setReplySending] = useState(false);
  const [replySent, setReplySent] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const replyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setReplyOpen(false);
    setReplyBody('');
    setReplySent(false);
    setReplyError(null);
  }, [selectedId]);

  useEffect(() => {
    const el = replyRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [replyBody]);

  async function handleSendReply() {
    if (!selected || !replyBody.trim()) return;
    setReplySending(true);
    setReplyError(null);
    try {
      const res = await fetch('/taskip-internal/inbox/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: selected.recipient,
          subject: selected.subject.startsWith('Re:') ? selected.subject : `Re: ${selected.subject}`,
          textBody: replyBody.trim(),
          purpose: 'followup',
          plainText: replyPlainText,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any).message ?? `HTTP ${res.status}`);
      setReplySent(true);
      setReplyBody('');
      qc.invalidateQueries({ queryKey: ['inbox'] });
    } catch (e) {
      setReplyError(e instanceof Error ? e.message : String(e));
    } finally {
      setReplySending(false);
    }
  }

  function handleDraftReply(r: InboxRow) {
    const opens = r.openCount ?? 0;
    const openInfo = opens > 0
      ? `opened it ${opens} time${opens > 1 ? 's' : ''} (first opened ${timeAgo(r.firstOpenAt!)})`
      : 'has not opened it yet';
    const replyInfo = r.replyCount > 0
      ? ` They replied ${r.replyCount} time${r.replyCount > 1 ? 's' : ''}, last ${timeAgo(r.lastReplyAt!)}.`
      : '';
    const insightHint = r.workspaceUuid
      ? ` Before drafting, call insight_get_lifecycle with workspace_uuid="${r.workspaceUuid}" to get the latest engagement stats for this workspace, then use those in the draft.`
      : '';
    const query = `Draft a follow-up email to ${r.recipient} about the email "${r.subject}" sent ${timeAgo(r.sentAt)}. They ${openInfo}.${replyInfo}${insightHint} Use the SPAR system.`;
    setAiMessages([]);
    setAiRunId(null);
    setAiThinking(false);
    setAiInput('');
    setAiOpen(true);
    triggerAiRun(query, []);
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
      <div className="flex flex-1 min-h-0 relative overflow-hidden">
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
                  onClick={() => { setReplyOpen(o => !o); setReplySent(false); setReplyError(null); }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors ${
                    replyOpen
                      ? 'bg-muted text-foreground border border-border'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  }`}
                >
                  {replyOpen ? <X className="w-3.5 h-3.5" /> : <Reply className="w-3.5 h-3.5" />}
                  {replyOpen ? 'Cancel' : 'Reply'}
                </button>
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
                  Sync
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

              {/* Inline reply composer */}
              {replyOpen && (
                <div className="rounded-xl border border-border bg-card mb-4 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-border bg-muted/20 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Reply className="w-3.5 h-3.5" />
                      <span>To: <span className="text-foreground font-medium">{selected.recipient}</span></span>
                      <span className="text-muted-foreground/50">·</span>
                      <span className="truncate max-w-[200px]">Re: {selected.subject}</span>
                    </div>
                    {/* Plain text toggle */}
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <div
                        onClick={() => setReplyPlainText(v => !v)}
                        className={`w-7 h-4 rounded-full transition-colors relative ${replyPlainText ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`}
                      >
                        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform shadow ${replyPlainText ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                      </div>
                      <span className="text-[11px] text-muted-foreground">Plain text</span>
                    </label>
                  </div>
                  {replyPlainText && (
                    <div className="px-4 py-1.5 bg-emerald-500/5 border-b border-emerald-500/20">
                      <p className="text-[11px] text-emerald-400">Plain text mode — no HTML wrapper or tracking pixel. Better deliverability.</p>
                    </div>
                  )}
                  <textarea
                    ref={replyRef}
                    className="w-full px-4 py-3 text-sm bg-transparent focus:outline-none resize-none font-mono leading-relaxed"
                    style={{ minHeight: '140px' }}
                    placeholder="Write your reply…"
                    value={replyBody}
                    onChange={e => setReplyBody(e.target.value)}
                    autoFocus
                  />
                  <div className="px-4 py-2.5 border-t border-border flex items-center justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {replyBody.trim() ? replyBody.trim().split(/\s+/).length : 0} words
                    </span>
                    <div className="flex items-center gap-2">
                      {replyError && <span className="text-[11px] text-destructive">{replyError}</span>}
                      {replySent && <span className="text-[11px] text-emerald-400">Sent!</span>}
                      <button
                        onClick={handleSendReply}
                        disabled={replySending || !replyBody.trim()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs hover:bg-primary/90 disabled:opacity-50 transition-colors"
                      >
                        {replySending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Send reply
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Replies */}
              {detailQuery.isLoading && (
                <div className="space-y-3">
                  {[0, 1].map(i => (
                    <div key={i} className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Skeleton className="w-6 h-6 rounded-full" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                        <Skeleton className="h-3 w-20" />
                      </div>
                      <Skeleton className="h-3 w-full mb-1.5" />
                      <Skeleton className="h-3 w-4/5 mb-1.5" />
                      <Skeleton className="h-3 w-3/5" />
                    </div>
                  ))}
                </div>
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

        {/* AI Chat Drawer */}
        <div
          className={`absolute top-0 right-0 bottom-0 w-[420px] bg-background border-l border-border flex flex-col shadow-2xl z-30 transition-transform duration-300 ${
            aiOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* Drawer header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-medium">AI Draft Assistant</span>
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">taskip_internal</span>
            </div>
            <button
              onClick={() => setAiOpen(false)}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {aiMessages.length === 0 && !aiThinking && (
              <p className="text-xs text-muted-foreground text-center mt-8">Send a message to draft a reply with AI.</p>
            )}
            {aiMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'agent' && (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white shrink-0 mr-2 mt-0.5">
                    <Bot className="w-3 h-3" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-muted text-foreground rounded-bl-sm'
                  }`}
                  dangerouslySetInnerHTML={{ __html: msg.role === 'agent' ? renderMd(msg.content) : msg.content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>') }}
                />
              </div>
            ))}
            {aiThinking && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white shrink-0 mr-2 mt-0.5">
                  <Bot className="w-3 h-3" />
                </div>
                <div className="bg-muted rounded-xl rounded-bl-sm px-4 py-3 space-y-2">
                  <Skeleton className="h-2.5 w-40" />
                  <Skeleton className="h-2.5 w-56" />
                  <Skeleton className="h-2.5 w-32" />
                </div>
              </div>
            )}
            <div ref={aiBottomRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-border p-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={aiInputRef}
                value={aiInput}
                onChange={e => setAiInput(e.target.value)}
                onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSendAi(); }}
                placeholder="Ask AI to draft or refine…"
                disabled={aiThinking}
                rows={2}
                className="flex-1 resize-none rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 placeholder:text-muted-foreground"
              />
              <button
                onClick={handleSendAi}
                disabled={!aiInput.trim() || aiThinking}
                className="p-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors shrink-0"
              >
                {aiThinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">Cmd+Enter to send</p>
          </div>
        </div>
      </div>
    </div>
  );
}
