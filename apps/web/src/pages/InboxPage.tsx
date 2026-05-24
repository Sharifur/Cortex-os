import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Mail, Eye, EyeOff, MessageSquare, RefreshCw, Bot, Loader2, Clock, ChevronRight, ChevronLeft, Reply, Send, X, Search, Pencil, ChevronDown, Trash2, Bell, BellOff,
} from 'lucide-react';

interface GmailAccount {
  id: string;
  label: string;
  email: string;
  displayName: string | null;
  isDefault: boolean;
}

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
  gmailAccountId?: string | null;
  openCount?: number;
  firstOpenAt?: string | null;
  lastOpenAt?: string | null;
  metadata?: { spamScore?: number; spamGrade?: string; manuallyOpened?: boolean; manuallyOpenedAt?: string; pixelOpened?: boolean; pixelOpenedAt?: string; [key: string]: unknown } | null;
}

function isOpened(r: InboxRow): boolean {
  return (r.openCount ?? 0) > 0 || r.metadata?.manuallyOpened === true || r.metadata?.pixelOpened === true;
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
    const p = batch.payload as any;
    const emails: any[] = p?.emails ?? [];
    const spamScores: any[] = p?.spamScores ?? [];
    const isChatBatch = p?.source === 'chat';
    if (isChatBatch) {
      const lines = [`Sent ${emails.length} email${emails.length !== 1 ? 's' : ''}:`];
      for (const [i, e] of emails.entries()) {
        const spam = spamScores.find((s: any) => s.recipient === e.recipient);
        const spamNote = spam ? ` (spam: ${spam.grade} ${spam.score})` : '';
        lines.push(`${i + 1}. **${e.recipient}** — ${e.subject}${spamNote}`);
      }
      return lines.join('\n');
    }
    const lines = [`Batch ready — ${emails.length} email${emails.length !== 1 ? 's' : ''} awaiting Telegram approval:`];
    for (const [i, e] of emails.entries()) {
      const spam = spamScores.find((s: any) => s.recipient === e.recipient);
      const spamNote = spam ? ` (spam: ${spam.grade} ${spam.score})` : '';
      lines.push(`${i + 1}. **${e.recipient}** — ${e.subject}${spamNote}`);
    }
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

function parseUtc(iso: string): Date {
  // Postgres timestamp columns return without timezone designator; treat as UTC.
  return new Date(/Z|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + 'Z');
}

function timeAgo(iso: string): string {
  const diff = Date.now() - parseUtc(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtDate(iso: string, tz: string): string {
  return parseUtc(iso).toLocaleString(undefined, { timeZone: tz });
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

function spamGradeColor(grade: string): string {
  switch (grade) {
    case 'INBOX_STRONG': return 'bg-emerald-500/15 text-emerald-400';
    case 'INBOX_LIKELY': return 'bg-green-500/15 text-green-400';
    case 'PROMOTIONS_RISK': return 'bg-amber-500/15 text-amber-400';
    case 'SPAM_RISK': return 'bg-orange-500/15 text-orange-400';
    case 'BLOCK': return 'bg-rose-500/15 text-rose-400';
    default: return 'bg-slate-500/15 text-slate-400';
  }
}

function spamGradeLabel(grade: string): string {
  switch (grade) {
    case 'INBOX_STRONG': return 'Inbox';
    case 'INBOX_LIKELY': return 'Inbox';
    case 'PROMOTIONS_RISK': return 'Promo';
    case 'SPAM_RISK': return 'Spam risk';
    case 'BLOCK': return 'Blocked';
    default: return grade;
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
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(highlightId || null);
  const [mobileView, setMobileView] = useState<'list' | 'detail'>(highlightId ? 'detail' : 'list');
  const highlightApplied = useRef(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  // AI chat drawer
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState<{ role: 'user' | 'agent'; content: string }[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiRunId, setAiRunId] = useState<string | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const aiBottomRef = useRef<HTMLDivElement>(null);
  const aiInputRef = useRef<HTMLTextAreaElement>(null);

  const { data: settingsData } = useQuery<{ key: string; value: string }[]>({
    queryKey: ['settings'],
    queryFn: () => api(token, '/settings'),
    staleTime: 300_000,
  });
  const timezone = settingsData?.find(s => s.key === 'timezone')?.value ?? 'UTC';

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
    // Poll while the selected email hasn't been opened yet so the UI updates as
    // soon as the tracking pixel fires without requiring a manual Sync click.
    refetchInterval: (q) => {
      const email = q.state.data?.email;
      if (!email) return false;
      return isOpened(email) ? false : 30_000;
    },
  });

  const syncMutation = useMutation({
    mutationFn: (id: string) => api(token, `/taskip-internal/inbox/${id}/sync`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox'] });
      qc.invalidateQueries({ queryKey: ['inbox-detail', selectedId] });
    },
  });

  const markOpenedMutation = useMutation({
    mutationFn: (id: string) => api<{ ok: boolean; error?: string; metadata?: InboxRow['metadata']; openCount?: number }>(token, `/taskip-internal/inbox/${id}/mark-opened`, { method: 'POST' }),
    onSuccess: (data, id) => {
      if (!data.ok) return;
      // Use the DB-confirmed values from RETURNING, not a locally-constructed guess.
      const patch = { openCount: data.openCount ?? 1, metadata: data.metadata ?? { manuallyOpened: true } };
      qc.setQueryData<InboxRow[]>(['inbox', purpose], (old) =>
        old?.map((r) => r.id === id ? { ...r, ...patch } : r)
      );
      qc.setQueryData<{ email: InboxRow; replies: unknown[] }>(['inbox-detail', id], (old) =>
        old ? { ...old, email: { ...old.email, ...patch } } : old
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api<{ ok: boolean }>(token, `/taskip-internal/inbox/${id}`, { method: 'DELETE' }),
    onSuccess: (_data, id) => {
      if (selectedId === id) setSelectedId(null);
      qc.setQueryData<InboxRow[]>(['inbox', purpose], (old) => old?.filter((r) => r.id !== id));
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

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setPushEnabled(!!sub);
    }).catch(() => {});
  }, []);

  async function togglePush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    setPushLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        await existing.unsubscribe();
        await fetch('/push/subscribe', { method: 'DELETE', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: existing.endpoint }) });
        setPushEnabled(false);
      } else {
        const { publicKey } = await fetch('/push/vapid-public-key').then(r => r.json());
        if (!publicKey) return;
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKey });
        const j = sub.toJSON();
        await fetch('/push/subscribe', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint, keys: j.keys, label: 'inbox' }) });
        setPushEnabled(true);
      }
    } catch (e) {
      console.error('push toggle failed', e);
    } finally {
      setPushLoading(false);
    }
  }

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
    highlightApplied.current = false;
  }, [highlightId]);

  useEffect(() => {
    if (highlightId && data && !highlightApplied.current) {
      highlightApplied.current = true;
      setSelectedId(highlightId);
      setTimeout(() => {
        document.getElementById(`inbox-row-${highlightId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [highlightId, data]);

  const allRows = data ?? [];
  const needle = search.trim().toLowerCase();
  const rows = needle
    ? allRows.filter(r =>
        r.recipient.toLowerCase().includes(needle) ||
        r.subject.toLowerCase().includes(needle)
      )
    : allRows;
  const selected = allRows.find((r) => r.id === selectedId) ?? null;

  const [replyOpen, setReplyOpen] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [replyPlainText, setReplyPlainText] = useState(false);
  const [replySending, setReplySending] = useState(false);
  const [replySent, setReplySent] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replyAccountId, setReplyAccountId] = useState('');
  const replyRef = useRef<HTMLTextAreaElement>(null);

  // Compose new email
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composePurpose, setComposePurpose] = useState<string>('other');
  const [composePlainText, setComposePlainText] = useState(false);
  const [composeAccountId, setComposeAccountId] = useState('');
  const [composeSending, setComposeSending] = useState(false);
  const [composeSent, setComposeSent] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);

  const accountsQuery = useQuery<GmailAccount[]>({
    queryKey: ['gmail-accounts'],
    queryFn: () => api<GmailAccount[]>(token, '/gmail/accounts'),
    staleTime: 60_000,
  });
  const accounts = accountsQuery.data ?? [];

  // Set default account when accounts load
  useEffect(() => {
    const def = accounts.find(a => a.isDefault) ?? accounts[0];
    if (def) {
      if (!composeAccountId) setComposeAccountId(def.id);
      if (!replyAccountId) setReplyAccountId(def.id);
    }
  }, [accounts]);

  // Pre-select the account that sent the selected email when switching emails
  useEffect(() => {
    if (!selected || !accounts.length) return;
    const match = selected.gmailAccountId
      ? accounts.find(a => a.id === selected.gmailAccountId)
      : null;
    const target = match ?? accounts.find(a => a.isDefault) ?? accounts[0];
    if (target) setReplyAccountId(target.id);
  }, [selected?.id, accounts]);

  async function handleSendCompose() {
    if (!composeTo.trim() || !composeSubject.trim() || !composeBody.trim()) return;
    setComposeSending(true);
    setComposeError(null);
    try {
      const res = await fetch('/taskip-internal/inbox/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: composeTo.trim(),
          subject: composeSubject.trim(),
          textBody: composeBody.trim(),
          purpose: composePurpose,
          accountId: composeAccountId || undefined,
          plainText: composePlainText,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any).message ?? `HTTP ${res.status}`);
      setComposeSent(true);
      setTimeout(() => {
        setComposeOpen(false);
        setComposeTo('');
        setComposeSubject('');
        setComposeBody('');
        setComposeSent(false);
      }, 1200);
      qc.invalidateQueries({ queryKey: ['inbox'] });
    } catch (e) {
      setComposeError(e instanceof Error ? e.message : String(e));
    } finally {
      setComposeSending(false);
    }
  }

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
          accountId: replyAccountId || undefined,
          plainText: replyPlainText,
          emailId: selected.id,
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
    const openInfo = isOpened(r)
      ? opens > 0 ? `opened it ${opens} time${opens > 1 ? 's' : ''} (first opened ${timeAgo(r.firstOpenAt!)})` : 'opened it (manually marked)'
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
      <div className="flex items-center justify-between gap-2 px-4 md:px-6 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shrink-0">
            <Mail className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight">Inbox</h1>
            <p className="hidden md:block text-[11px] text-muted-foreground">Outbound emails — open tracking + reply sync every 15 min</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 md:gap-2 flex-wrap justify-end">
          {/* Stats pills — hidden on small screens */}
          <span className="hidden sm:inline text-[11px] text-muted-foreground border border-border rounded-full px-2.5 py-0.5">
            {rows.length} sent
          </span>
          <span className="hidden sm:inline text-[11px] text-emerald-400 border border-emerald-500/30 rounded-full px-2.5 py-0.5">
            {rows.filter(isOpened).length} opened
          </span>
          <span className="hidden sm:inline text-[11px] text-blue-400 border border-blue-400/30 rounded-full px-2.5 py-0.5">
            {rows.filter((r) => r.replyCount > 0).length} replied
          </span>
          <button
            onClick={() => { setComposeOpen(true); setSelectedId(null); setMobileView('detail'); setComposeSent(false); setComposeError(null); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-[11px] hover:bg-primary/90 transition-colors font-medium"
          >
            <Pencil className="w-3 h-3" /> Compose
          </button>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          {'PushManager' in window && (
            <button
              onClick={togglePush}
              disabled={pushLoading}
              title={pushEnabled ? 'Disable push notifications' : 'Enable push notifications for new replies'}
              className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              {pushEnabled ? <Bell className="w-3.5 h-3.5 text-emerald-400" /> : <BellOff className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs + search */}
      <div className="flex items-center gap-2 px-3 md:px-6 py-2 border-b border-border shrink-0 flex-wrap md:flex-nowrap">
        <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-wrap">
          {(['', 'marketing', 'followup', 'offer', 'other'] as const).map((p) => (
            <button
              key={p || 'all'}
              onClick={() => setPurpose(p)}
              className={`text-[11px] px-3 py-1 rounded-full border transition-colors shrink-0 ${
                purpose === p
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
              }`}
            >
              {p ? p.charAt(0).toUpperCase() + p.slice(1) : 'All'}
            </button>
          ))}
        </div>
        <div className="relative shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search email or subject…"
            className="h-7 pl-7 pr-7 w-full sm:w-52 rounded-md border border-border bg-muted/30 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Two-panel body */}
      <div className="flex flex-1 min-h-0">
        {/* Left: email list */}
        <div className={`${mobileView === 'detail' ? 'hidden md:flex' : 'flex'} w-full md:w-80 shrink-0 border-r border-border flex-col overflow-y-auto`}>
          {isLoading && (
            <div className="space-y-px">
              {[0, 1, 2, 3, 4, 5].map(i => (
                <div key={i} className="px-4 py-3 border-b border-border">
                  <div className="flex items-start gap-2.5">
                    <Skeleton className="w-8 h-8 rounded-full shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <Skeleton className="h-3 w-32" />
                        <Skeleton className="h-2.5 w-10" />
                      </div>
                      <Skeleton className="h-2.5 w-48" />
                      <Skeleton className="h-2.5 w-40" />
                      <div className="flex gap-1.5 pt-0.5">
                        <Skeleton className="h-3.5 w-14 rounded-full" />
                        <Skeleton className="h-3.5 w-10 rounded-full" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!isLoading && rows.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground">No emails yet.</p>
            </div>
          )}
          {rows.map((r) => {
            const isSelected = selectedId === r.id;
            const isHighlighted = r.id === highlightId;
            const opens = r.openCount ?? 0;
            const opened = isOpened(r);
            return (
              <button
                key={r.id}
                id={`inbox-row-${r.id}`}
                onClick={() => { const next = isSelected ? null : r.id; setSelectedId(next); if (next) setMobileView('detail'); }}
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
                      {r.gmailAccountId && accounts.length > 0 && (() => {
                        const acct = accounts.find(a => a.id === r.gmailAccountId);
                        return acct ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-sky-500/15 text-sky-300 max-w-[120px] truncate" title={acct.email}>
                            {acct.email}
                          </span>
                        ) : null;
                      })()}
                      {r.metadata?.spamGrade && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${spamGradeColor(r.metadata.spamGrade as string)}`}>
                          {spamGradeLabel(r.metadata.spamGrade as string)} {r.metadata.spamScore}
                        </span>
                      )}
                      {opened ? (
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

        {/* Right area: detail panel + AI drawer sidebar */}
        <div className={`${mobileView === 'list' ? 'hidden md:flex' : 'flex'} flex-1 min-w-0`}>

        {/* Detail panel */}
        <div className="flex-1 min-w-0 overflow-y-auto">

          {/* Compose panel */}
          {composeOpen && (
            <div className="p-4 md:p-6 max-w-2xl">
              <button
                onClick={() => { setComposeOpen(false); setMobileView('list'); }}
                className="md:hidden flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3 -mt-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Back to inbox
              </button>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                    <Pencil className="w-3.5 h-3.5 text-white" />
                  </div>
                  <h2 className="text-base font-semibold">New Email</h2>
                </div>
                <button onClick={() => setComposeOpen(false)} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="rounded-xl border border-border bg-card overflow-hidden">
                {/* From */}
                {accounts.length > 0 && (
                  <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border">
                    <span className="text-xs text-muted-foreground w-16 shrink-0">From</span>
                    <div className="relative flex-1">
                      <select
                        value={composeAccountId}
                        onChange={e => setComposeAccountId(e.target.value)}
                        className="w-full text-sm pl-0 pr-6 py-0 bg-transparent text-foreground focus:outline-none appearance-none cursor-pointer"
                      >
                        {accounts.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.displayName ? `${a.displayName} <${a.email}>` : a.email}{a.isDefault ? ' (default)' : ''}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                )}
                {/* To */}
                <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border">
                  <span className="text-xs text-muted-foreground w-16 shrink-0">To</span>
                  <input
                    type="email"
                    value={composeTo}
                    onChange={e => setComposeTo(e.target.value)}
                    placeholder="recipient@example.com"
                    className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-muted-foreground/50"
                    autoFocus
                  />
                </div>
                {/* Subject */}
                <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border">
                  <span className="text-xs text-muted-foreground w-16 shrink-0">Subject</span>
                  <input
                    type="text"
                    value={composeSubject}
                    onChange={e => setComposeSubject(e.target.value)}
                    placeholder="Email subject…"
                    className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-muted-foreground/50"
                  />
                </div>
                {/* Purpose + Plain text row */}
                <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-muted/10">
                  <span className="text-[11px] text-muted-foreground w-16 shrink-0">Purpose</span>
                  <div className="relative">
                    <select
                      value={composePurpose}
                      onChange={e => setComposePurpose(e.target.value)}
                      className="text-[11px] pl-2 pr-6 py-1 rounded border border-border bg-muted/30 text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
                    >
                      {['other', 'marketing', 'followup', 'offer'].map(p => (
                        <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer ml-auto">
                    <div
                      onClick={() => setComposePlainText(v => !v)}
                      className={`w-7 h-4 rounded-full transition-colors relative ${composePlainText ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`}
                    >
                      <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform shadow ${composePlainText ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                    </div>
                    <span className="text-[11px] text-muted-foreground">Plain text</span>
                  </label>
                </div>
                {/* Body */}
                <textarea
                  value={composeBody}
                  onChange={e => setComposeBody(e.target.value)}
                  placeholder="Write your email…"
                  className="w-full px-4 py-3 text-sm bg-transparent focus:outline-none resize-none font-mono leading-relaxed"
                  style={{ minHeight: '240px' }}
                />
                {/* Footer */}
                <div className="px-4 py-2.5 border-t border-border flex items-center justify-between gap-2 bg-muted/10">
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {composeBody.trim() ? composeBody.trim().split(/\s+/).length : 0} words
                    {composePlainText && <span className="ml-2 text-emerald-400">plain text</span>}
                  </span>
                  <div className="flex items-center gap-2">
                    {composeError && <span className="text-[11px] text-destructive">{composeError}</span>}
                    {composeSent && <span className="text-[11px] text-emerald-400">Sent — tracking replies…</span>}
                    <button
                      onClick={handleSendCompose}
                      disabled={composeSending || !composeTo.trim() || !composeSubject.trim() || !composeBody.trim()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {composeSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      Send email
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">
                After sending, replies are fetched automatically every 15 min. Use Sync on the sent email to check immediately.
              </p>
            </div>
          )}

          {!composeOpen && !selected && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Mail className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Select an email to read</p>
                <button
                  onClick={() => setComposeOpen(true)}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                >
                  <Pencil className="w-3 h-3" /> Compose new email
                </button>
              </div>
            </div>
          )}

          {!composeOpen && selected && (
            <div className="p-4 md:p-6 max-w-2xl">
              {/* Back button — mobile only */}
              <button
                onClick={() => setMobileView('list')}
                className="md:hidden flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3 -mt-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Back to inbox
              </button>
              {/* Header */}
              <div className="mb-4">
                <h2 className="text-base md:text-lg font-semibold">{selected.subject}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <div className={`w-6 h-6 rounded-full ${avatarColor(selected.recipient)} flex items-center justify-center text-white text-[10px] font-semibold`}>
                    {initials(selected.recipient)}
                  </div>
                  {selected.gmailAccountId && accounts.length > 0 && (() => {
                    const acct = accounts.find(a => a.id === selected.gmailAccountId);
                    return acct ? (
                      <span className="text-xs text-muted-foreground">From: <span className="text-foreground">{acct.displayName ? `${acct.displayName} <${acct.email}>` : acct.email}</span></span>
                    ) : null;
                  })()}
                  <span className="text-sm text-muted-foreground">To: {selected.recipient}</span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">{fmtDate(selected.sentAt, timezone)}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-semibold ${purposeColor(selected.purpose)}`}>
                    {selected.purpose}
                  </span>
                  {selected.metadata?.spamGrade && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${spamGradeColor(selected.metadata.spamGrade as string)}`}>
                      Spam score: {selected.metadata.spamScore} — {spamGradeLabel(selected.metadata.spamGrade as string)}
                    </span>
                  )}
                </div>
              </div>

              {/* Open tracking */}
              {selected.status !== 'failed' && (
                <div className={`rounded-lg border px-3 py-2 mb-4 text-xs flex items-center gap-2 ${
                  isOpened(selected)
                    ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
                    : 'border-border bg-muted/10 text-muted-foreground'
                }`}>
                  {isOpened(selected) ? (
                    <>
                      <Eye className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {(selected.openCount ?? 0) > 0
                          ? `Opened ${selected.openCount}x — first ${selected.firstOpenAt ? fmtDate(selected.firstOpenAt, timezone) : '—'}${selected.lastOpenAt && selected.firstOpenAt !== selected.lastOpenAt ? ` · last ${fmtDate(selected.lastOpenAt, timezone)}` : ''}`
                          : selected.metadata?.pixelOpened
                          ? `Opened via tracking pixel${selected.metadata.pixelOpenedAt ? ` — ${fmtDate(selected.metadata.pixelOpenedAt as string, timezone)}` : ''}`
                          : `Marked as opened${selected.metadata?.manuallyOpenedAt ? ` — ${fmtDate(selected.metadata.manuallyOpenedAt as string, timezone)}` : ''}`
                        }
                      </span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3.5 h-3.5 shrink-0" />
                      <span className="flex-1">Not opened yet</span>
                      <button
                        onClick={() => selected && markOpenedMutation.mutate(selected.id)}
                        disabled={markOpenedMutation.isPending}
                        className="ml-auto text-[10px] px-2 py-0.5 rounded border border-border hover:border-foreground/30 hover:text-foreground transition-colors disabled:opacity-50"
                        title="Email landed in spam — pixel blocked. Mark as opened manually."
                      >
                        {markOpenedMutation.isPending ? 'Marking...' : 'Mark as opened'}
                      </button>
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
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (confirm('Delete this email record? This cannot be undone.')) {
                      deleteMutation.mutate(selected.id);
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60 hover:bg-destructive/5"
                >
                  {deleteMutation.isPending
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    : <Trash2 className="w-3.5 h-3.5 mr-1" />}
                  Delete
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
                  dangerouslySetInnerHTML={{ __html: bodyToHtml(
                    (detailQuery.data?.email.id === selected.id ? detailQuery.data.email.body : null) ?? selected.body ?? ''
                  ) }}
                />
              </div>

              {/* Inline reply composer */}
              {replyOpen && (
                <div className="rounded-xl border border-border bg-card mb-4 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-border bg-muted/20 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
                      <Reply className="w-3.5 h-3.5 shrink-0" />
                      <span className="shrink-0">To: <span className="text-foreground font-medium">{selected.recipient}</span></span>
                      <span className="text-muted-foreground/50 shrink-0">·</span>
                      <span className="truncate max-w-[160px]">Re: {selected.subject}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {accounts.length > 0 && (
                        <div className="relative">
                          <select
                            value={replyAccountId}
                            onChange={e => setReplyAccountId(e.target.value)}
                            className="text-[11px] pl-2 pr-6 py-1 rounded border border-border bg-muted/30 text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
                          >
                            {accounts.map(a => (
                              <option key={a.id} value={a.id}>
                                {a.displayName ? `${a.displayName} <${a.email}>` : a.email}{a.isDefault ? ' (default)' : ''}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                        </div>
                      )}
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <div
                          onClick={() => setReplyPlainText(v => !v)}
                          className={`w-7 h-4 rounded-full transition-colors relative ${replyPlainText ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`}
                        >
                          <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform shadow ${replyPlainText ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                        </div>
                        <span className="text-[11px] text-muted-foreground">Plain</span>
                      </label>
                    </div>
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
                        <span className="text-[11px] text-muted-foreground">{fmtDate(reply.receivedAt, timezone)}</span>
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

        {/* AI Chat Drawer — flex sidebar, width-animated */}
        <div className={`shrink-0 overflow-hidden border-l border-border transition-all duration-300 ${aiOpen ? 'w-[420px]' : 'w-0'}`}>
          <div className="w-[420px] bg-background flex flex-col h-full">
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
      </div>
    </div>
  );
}
