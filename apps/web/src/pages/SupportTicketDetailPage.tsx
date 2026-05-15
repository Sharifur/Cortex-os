import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Hash, Mail, User, Phone, Clock, MessageSquare,
  Wand2, RefreshCw, AlertTriangle, CheckCircle2, XCircle,
  ChevronDown, ChevronUp, Trash2, Loader2, Brain, Settings2, StickyNote, Send, Pencil, Link2,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Skeleton } from '@/components/ui/skeleton';
import { DraftEditor } from '@/components/DraftEditor';

interface SupportTicket {
  id: string;
  externalId: string | null;
  crmUuid: string | null;
  ticketNo: string | null;
  subject: string;
  body: string | null;
  userEmail: string;
  contactName: string | null;
  contactPhone: string | null;
  category: string | null;
  priority: string;
  status: string;
  lastDraft: string | null;
  purchaseCode: string | null;
  purchaseCodeStatus: string | null;
  repliedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TicketEvent {
  id: string;
  ticketId: string | null;
  externalId: string | null;
  eventType: string;
  summary: string | null;
  payload: Record<string, unknown> | null;
  error: string | null;
  createdAt: string;
}

const STATUS_STYLES: Record<string, string> = {
  open:      'bg-blue-500/15 text-blue-300',
  replied:   'bg-emerald-500/15 text-emerald-300',
  escalated: 'bg-orange-500/15 text-orange-300',
  closed:    'bg-slate-500/15 text-slate-400',
};

const PRIORITY_STYLES: Record<string, string> = {
  low:    'bg-slate-500/15 text-slate-400',
  medium: 'bg-yellow-500/15 text-yellow-300',
  high:   'bg-orange-500/15 text-orange-300',
  urgent: 'bg-red-500/15 text-red-300',
};

const PURCHASE_CODE_STATUS_STYLES: Record<string, string> = {
  requested: 'bg-yellow-500/15 text-yellow-300',
  verified:  'bg-emerald-500/15 text-emerald-300',
  invalid:   'bg-red-500/15 text-red-300',
  expired:   'bg-orange-500/15 text-orange-300',
};

const EVENT_TYPE_STYLES: Record<string, string> = {
  webhook_received:           'bg-sky-500/15 text-sky-300',
  decide_triggered:           'bg-indigo-500/15 text-indigo-300',
  reply_drafted:              'bg-violet-500/15 text-violet-300',
  manual_draft:               'bg-violet-500/15 text-violet-300',
  post_reply:                 'bg-emerald-500/15 text-emerald-300',
  escalate_to_owner:          'bg-orange-500/15 text-orange-300',
  request_purchase_code:      'bg-yellow-500/15 text-yellow-300',
  purchase_code_not_found:    'bg-yellow-500/15 text-yellow-300',
  purchase_code_verified:     'bg-emerald-500/15 text-emerald-300',
  purchase_code_invalid:      'bg-red-500/15 text-red-300',
  purchase_code_expired:      'bg-orange-500/15 text-orange-300',
  ticket_reopened:            'bg-sky-500/15 text-sky-300',
  customer_reply_received:    'bg-sky-500/15 text-sky-300',
  agent_reply_received:       'bg-emerald-500/15 text-emerald-300',
  decide_error:               'bg-red-500/15 text-red-300',
  reply_failed:               'bg-red-500/15 text-red-300',
  priority_updated:           'bg-indigo-500/15 text-indigo-300',
  status_updated:             'bg-teal-500/15 text-teal-300',
  note_added:                 'bg-slate-500/15 text-slate-300',
  reply_sent:                 'bg-emerald-500/15 text-emerald-300',
  purchase_code_requested:    'bg-yellow-500/15 text-yellow-300',
  server_access_requested:    'bg-orange-500/15 text-orange-300',
};

function Badge({ label, styles }: { label: string; styles: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${styles}`}>
      {label}
    </span>
  );
}

function fmt(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function EventRow({ event }: { event: TicketEvent }) {
  const [open, setOpen] = useState(false);
  const hasDraft = !!(event.payload as any)?.draft;
  const hasPayload = (event.payload && Object.keys(event.payload).length > 0) || !!event.error;
  const isExpandable = hasPayload;
  const style = EVENT_TYPE_STYLES[event.eventType] ?? 'bg-slate-500/15 text-slate-400';

  const summary = event.summary ?? '—';
  // Truncate to ~80 chars for the collapsed row; show full text when expanded
  const truncated = summary.length > 80 ? summary.slice(0, 80) + '…' : summary;

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      <div
        className={`flex items-center gap-3 px-3 py-2.5 ${isExpandable ? 'cursor-pointer hover:bg-accent/20' : ''}`}
        onClick={() => isExpandable && setOpen(v => !v)}
      >
        {/* badge — fixed width */}
        <div className="shrink-0">
          <Badge label={event.eventType.replace(/_/g, ' ')} styles={style} />
        </div>

        {/* summary — single truncated line */}
        <p className="flex-1 min-w-0 text-xs text-muted-foreground truncate">
          {open ? summary : truncated}
        </p>

        {/* timestamp + chevron */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">{fmt(event.createdAt)}</span>
          {isExpandable && (open
            ? <ChevronUp className="w-3 h-3 text-muted-foreground" />
            : <ChevronDown className="w-3 h-3 text-muted-foreground" />
          )}
        </div>
      </div>

      {open && (
        <div className="px-3 pb-3 border-t border-border bg-muted/20 space-y-2">
          {/* full summary if it was truncated */}
          {summary.length > 80 && (
            <p className="pt-2 text-xs text-foreground leading-relaxed">{summary}</p>
          )}
          {hasDraft && (
            <div className="pt-1 space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Draft</p>
              <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto rounded bg-background/50 px-2 py-1.5">
                {(event.payload as any).draft}
              </p>
            </div>
          )}
          {!hasDraft && event.payload && Object.keys(event.payload).length > 0 && (
            <pre className="pt-1 text-[11px] text-muted-foreground overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto rounded bg-background/50 px-2 py-1.5">
              {JSON.stringify(event.payload, null, 2)}
            </pre>
          )}
          {event.error && (
            <p className="pt-1 text-xs text-red-400 font-medium">Error: {event.error}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function SupportTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();

  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);

  const [editingDraft, setEditingDraft] = useState(false);
  const [editDraftText, setEditDraftText] = useState('');
  const [savingDraft, setSavingDraft] = useState(false);

  const [linkCopied, setLinkCopied] = useState(false);

  function handleCopyLink() {
    const url = `${window.location.origin}/support/tickets/${id}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  }

  const [trainOpen, setTrainOpen] = useState(false);
  const [trainCategory, setTrainCategory] = useState<'spam_filter' | 'decision_rule' | 'faq' | 'policy'>('decision_rule');
  const [trainInstruction, setTrainInstruction] = useState('');
  const [trainSuccess, setTrainSuccess] = useState(false);

  const trainMutation = useMutation({
    mutationFn: async ({ category, instruction }: { category: string; instruction: string }) => {
      const res = await fetch(`/support/tickets/${id}/train`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, instruction }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      setTrainSuccess(true);
      setTrainInstruction('');
    },
  });

  const [crmPriority, setCrmPriority] = useState<string>('');
  const [crmStatus, setCrmStatus] = useState<string>('');
  const [crmNotes, setCrmNotes] = useState('');
  const [noteText, setNoteText] = useState('');

  const priorityMutation = useMutation({
    mutationFn: async (priority: number) => {
      const res = await fetch(`/support/tickets/${id}/priority`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message ?? `HTTP ${res.status}`); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['support-ticket', id] }); refetchEvents(); setCrmPriority(''); },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ status, notes }: { status: string; notes?: string }) => {
      const res = await fetch(`/support/tickets/${id}/status`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message ?? `HTTP ${res.status}`); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['support-ticket', id] }); refetchEvents(); setCrmStatus(''); setCrmNotes(''); },
  });

  const noteMutation = useMutation({
    mutationFn: async (note: string) => {
      const res = await fetch(`/support/tickets/${id}/note`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message ?? `HTTP ${res.status}`); }
      return res.json();
    },
    onSuccess: () => { refetchEvents(); setNoteText(''); },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/support/tickets/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support-tickets'] });
      navigate('/support');
    },
  });

  const { data: ticket, isLoading: ticketLoading } = useQuery<SupportTicket>({
    queryKey: ['support-ticket', id],
    queryFn: async () => {
      const res = await fetch(`/support/tickets/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: !!id,
    staleTime: 30_000,
  });

  const { data: events = [], isLoading: eventsLoading, refetch: refetchEvents } = useQuery<TicketEvent[]>({
    queryKey: ['support-ticket-events', id],
    queryFn: async () => {
      const res = await fetch(`/support/tickets/${id}/events`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: !!id,
    staleTime: 15_000,
  });

  async function handleGenerateDraft() {
    if (!id) return;
    setGenerating(true);
    setDraft(null);
    setDraftError(null);
    try {
      const res = await fetch(`/support/tickets/${id}/draft`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.error) {
        setDraftError(data.error);
      } else {
        setDraft(data.draft);
        setEditingDraft(false);
        qc.invalidateQueries({ queryKey: ['support-ticket', id] });
        refetchEvents();
      }
    } catch (err) {
      setDraftError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSendReply() {
    if (!id) return;
    if (!confirm('Send this reply to the customer now?')) return;
    setSending(true);
    setSendError(null);
    setSendSuccess(false);
    try {
      const res = await fetch(`/support/tickets/${id}/send-reply`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setSendError(data.error ?? 'Send failed');
      } else {
        setSendSuccess(true);
        qc.invalidateQueries({ queryKey: ['support-ticket', id] });
        refetchEvents();
      }
    } catch (err) {
      setSendError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function handleSaveDraft() {
    if (!id) return;
    setSavingDraft(true);
    try {
      const res = await fetch(`/support/tickets/${id}/draft`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft: editDraftText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setDraft(data.draft);
      setEditingDraft(false);
      qc.invalidateQueries({ queryKey: ['support-ticket', id] });
      refetchEvents();
    } catch (err) {
      setDraftError((err as Error).message);
    } finally {
      setSavingDraft(false);
    }
  }

  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const activeDraft = draft ?? ticket?.lastDraft;

  if (ticketLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <button onClick={() => navigate('/support')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to tickets
        </button>
        <p className="text-sm text-red-400">Ticket not found.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-4">
      {/* Back + header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/support')}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Tickets
          </button>
          <span className="text-muted-foreground">/</span>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
            <Hash className="w-3 h-3" />
            {ticket.ticketNo ?? ticket.externalId ?? ticket.id}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            <Link2 className="w-3.5 h-3.5" />
            {linkCopied ? 'Copied!' : 'Share link'}
          </button>
          <button
            onClick={() => {
              if (confirm('Delete this ticket and all its history? This cannot be undone.')) {
                deleteMutation.mutate();
              }
            }}
            disabled={deleteMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-destructive/30 text-destructive text-xs hover:bg-destructive/5 hover:border-destructive/60 transition-colors disabled:opacity-50"
          >
            {deleteMutation.isPending
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Trash2 className="w-3.5 h-3.5" />}
            Delete ticket
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-5 items-start">

        {/* ── Left: main content ── */}
        <div className="space-y-4">
          {/* Ticket header */}
          <div className="rounded-xl border border-border bg-card px-5 py-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-base font-semibold leading-snug">{ticket.subject}</h1>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <Badge label={ticket.priority} styles={PRIORITY_STYLES[ticket.priority] ?? 'bg-slate-500/15 text-slate-400'} />
                <Badge label={ticket.status} styles={STATUS_STYLES[ticket.status] ?? 'bg-slate-500/15 text-slate-400'} />
                {ticket.purchaseCodeStatus && (
                  <Badge
                    label={`purchase: ${ticket.purchaseCodeStatus}`}
                    styles={PURCHASE_CODE_STATUS_STYLES[ticket.purchaseCodeStatus] ?? 'bg-slate-500/15 text-slate-400'}
                  />
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              {ticket.contactName && (
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3" /> {ticket.contactName}
                </div>
              )}
              <div className="flex items-center gap-1">
                <Mail className="w-3 h-3" /> {ticket.userEmail}
              </div>
              {ticket.contactPhone && (
                <div className="flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {ticket.contactPhone}
                </div>
              )}
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" /> Created {fmt(ticket.createdAt)}
              </div>
              {ticket.repliedAt && (
                <div className="flex items-center gap-1 text-emerald-400">
                  <MessageSquare className="w-3 h-3" /> Replied {fmt(ticket.repliedAt)}
                </div>
              )}
            </div>
          </div>

          {/* Ticket body */}
          {ticket.body && (
            <div className="rounded-xl border border-border bg-card px-5 py-4 space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Ticket Body</p>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{ticket.body}</p>
            </div>
          )}

          {/* AI Draft section — state-driven */}
          {ticket.status === 'replied' ? (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <p className="text-sm font-semibold text-emerald-400">Reply Sent</p>
                {ticket.repliedAt && (
                  <span className="text-xs text-muted-foreground">{fmt(ticket.repliedAt)}</span>
                )}
                <div className="ml-auto flex items-center gap-2">
                  {activeDraft && !editingDraft && (
                    <button
                      onClick={() => { setEditDraftText(activeDraft); setEditingDraft(true); setDraftError(null); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                  )}
                  <button
                    onClick={handleGenerateDraft}
                    disabled={generating}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    {generating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                    {generating ? 'Generating...' : 'Regenerate'}
                  </button>
                </div>
              </div>
              {draftError && (
                <div className="flex items-center gap-2 text-sm text-red-400">
                  <XCircle className="w-4 h-4 shrink-0" /> {draftError}
                </div>
              )}
              {activeDraft && (
                editingDraft ? (
                  <div className="space-y-2">
                    <DraftEditor value={editDraftText} onChange={setEditDraftText} token={token} />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSaveDraft}
                        disabled={savingDraft || !editDraftText.trim()}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                      >
                        {savingDraft ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        {savingDraft ? 'Saving...' : 'Save Draft'}
                      </button>
                      <button
                        onClick={() => { setEditingDraft(false); setDraftError(null); }}
                        className="px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {activeDraft}
                  </div>
                )
              )}
            </div>
          ) : (
            <>
              {/* Step 1 — Generate draft */}
              <div className="rounded-xl border border-border bg-card px-5 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">AI Draft Reply</p>
                    {activeDraft && !editingDraft && (
                      <p className="text-[11px] text-amber-400 mt-0.5">Draft saved — not sent yet</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {activeDraft && !editingDraft && (
                      <button
                        onClick={() => { setEditDraftText(activeDraft); setEditingDraft(true); setDraftError(null); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                    )}
                    <button
                      onClick={handleGenerateDraft}
                      disabled={generating}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
                    >
                      {generating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                      {generating ? 'Generating...' : activeDraft ? 'Regenerate Draft' : 'Generate Draft'}
                    </button>
                  </div>
                </div>

                {draftError && (
                  <div className="flex items-center gap-2 text-sm text-red-400">
                    <XCircle className="w-4 h-4 shrink-0" /> {draftError}
                  </div>
                )}
                {draft && !editingDraft && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Draft generated and saved
                  </div>
                )}

                {activeDraft ? (
                  editingDraft ? (
                    <div className="space-y-2">
                      <textarea
                        value={editDraftText}
                        onChange={(e) => setEditDraftText(e.target.value)}
                        rows={8}
                        className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring resize-y"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleSaveDraft}
                          disabled={savingDraft || !editDraftText.trim()}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                        >
                          {savingDraft ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          {savingDraft ? 'Saving...' : 'Save Draft'}
                        </button>
                        <button
                          onClick={() => { setEditingDraft(false); setDraftError(null); }}
                          className="px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                      {activeDraft}
                    </div>
                  )
                ) : !generating && (
                  <p className="text-xs text-muted-foreground italic">No draft yet. Click Generate Draft to have the AI write a reply based on the ticket context.</p>
                )}
              </div>

              {/* Step 2 — Send reply (only shown when a draft exists) */}
              {activeDraft && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-emerald-300">Ready to send?</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        This will email the draft above to{' '}
                        <span className="text-foreground">{ticket.userEmail}</span>{' '}
                        and mark the ticket as replied.
                      </p>
                    </div>
                    <button
                      onClick={handleSendReply}
                      disabled={sending}
                      className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      {sending ? 'Sending...' : 'Send Reply'}
                    </button>
                  </div>
                  {sendSuccess && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400 mt-3">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Reply sent to customer
                    </div>
                  )}
                  {sendError && (
                    <div className="flex items-center gap-2 text-sm text-red-400 mt-3">
                      <XCircle className="w-4 h-4 shrink-0" /> {sendError}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Train Agent section */}
          <div className="rounded-xl border border-border bg-card px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Train Agent</p>
              <button
                onClick={() => { setTrainOpen(v => !v); setTrainSuccess(false); trainMutation.reset(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              >
                <Brain className="w-3.5 h-3.5" />
                {trainOpen ? 'Cancel' : 'Correct Agent'}
              </button>
            </div>

            {trainOpen && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Teach the agent how to handle tickets like this. Your instruction will be reviewed via Telegram before being added to the knowledge base.
                </p>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Rule type</label>
                  <select
                    value={trainCategory}
                    onChange={(e) => setTrainCategory(e.target.value as typeof trainCategory)}
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="spam_filter">Spam Filter — auto-close tickets matching this pattern</option>
                    <option value="decision_rule">Decision Rule — route/escalate/skip similar tickets</option>
                    <option value="faq">FAQ — teach the agent a correct answer for this topic</option>
                    <option value="policy">Policy — enforce a business rule for this ticket type</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Instruction</label>
                  <textarea
                    value={trainInstruction}
                    onChange={(e) => setTrainInstruction(e.target.value)}
                    placeholder={
                      trainCategory === 'spam_filter'
                        ? 'e.g. Tickets asking for free licenses or discount codes should be closed immediately with a brief polite decline.'
                        : trainCategory === 'decision_rule'
                        ? 'e.g. Tickets from users with an expired license should always be escalated to the owner, not auto-replied.'
                        : trainCategory === 'faq'
                        ? 'e.g. The correct answer is: refunds are available within 7 days via the Envato resolution center, not through us.'
                        : 'e.g. We do not provide support for customization requests. Always reply with the customization policy link.'
                    }
                    rows={4}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                  />
                </div>

                {trainMutation.isError && (
                  <div className="flex items-center gap-2 text-sm text-red-400">
                    <XCircle className="w-4 h-4 shrink-0" />
                    {(trainMutation.error as Error).message}
                  </div>
                )}

                {trainSuccess && (
                  <div className="flex items-center gap-2 text-sm text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Proposal sent for Telegram approval
                  </div>
                )}

                {!trainSuccess && (
                  <button
                    onClick={() => trainMutation.mutate({ category: trainCategory, instruction: trainInstruction })}
                    disabled={!trainInstruction.trim() || trainMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {trainMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
                    {trainMutation.isPending ? 'Submitting...' : 'Submit for Approval'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Right sidebar ── */}
        <div className="space-y-4">
          {/* Change Priority */}
          <div className="rounded-xl border border-border bg-card px-4 py-4 space-y-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Change Priority</p>
            {!ticket.crmUuid && (
              <p className="text-[11px] text-yellow-400">CRM UUID not stored — re-deliver the webhook to enable this.</p>
            )}
            <div className="flex items-center gap-2">
              <select
                value={crmPriority}
                onChange={(e) => setCrmPriority(e.target.value)}
                disabled={!ticket.crmUuid}
                className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              >
                <option value="">Select priority...</option>
                <option value="0">0 — Low</option>
                <option value="1">1 — Normal</option>
                <option value="2">2 — Medium</option>
                <option value="3">3 — High</option>
                <option value="4">4 — Urgent</option>
              </select>
              <button
                onClick={() => priorityMutation.mutate(Number(crmPriority))}
                disabled={!crmPriority || priorityMutation.isPending || !ticket.crmUuid}
                className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {priorityMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Update'}
              </button>
            </div>
            {priorityMutation.isError && <p className="text-xs text-red-400">{(priorityMutation.error as Error).message}</p>}
            {priorityMutation.isSuccess && <p className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Priority updated</p>}
          </div>

          {/* Update Status */}
          <div className="rounded-xl border border-border bg-card px-4 py-4 space-y-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Update Status</p>
            <select
              value={crmStatus}
              onChange={(e) => setCrmStatus(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Select status...</option>
              <option value="open">open</option>
              <option value="in_progress">in_progress</option>
              <option value="resolved">resolved</option>
              <option value="closed">closed</option>
            </select>
            <div className="flex gap-2">
              <input
                value={crmNotes}
                onChange={(e) => setCrmNotes(e.target.value)}
                placeholder="Resolution notes (optional)"
                className="flex-1 min-w-0 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                onClick={() => statusMutation.mutate({ status: crmStatus, notes: crmNotes || undefined })}
                disabled={!crmStatus || statusMutation.isPending}
                className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {statusMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Update'}
              </button>
            </div>
            {statusMutation.isError && <p className="text-xs text-red-400">{(statusMutation.error as Error).message}</p>}
            {statusMutation.isSuccess && <p className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Status updated</p>}
          </div>

          {/* Add Internal Note */}
          <div className="rounded-xl border border-border bg-card px-4 py-4 space-y-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <StickyNote className="w-3.5 h-3.5" /> Add Internal Note
            </p>
            {!ticket.crmUuid && (
              <p className="text-[11px] text-yellow-400">CRM UUID required for notes.</p>
            )}
            <div className="flex items-start gap-2">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Internal note visible to agents only..."
                rows={3}
                disabled={!ticket.crmUuid}
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring resize-none disabled:opacity-50"
              />
              <button
                onClick={() => noteMutation.mutate(noteText)}
                disabled={!noteText.trim() || noteMutation.isPending || !ticket.crmUuid}
                className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {noteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Add'}
              </button>
            </div>
            {noteMutation.isError && <p className="text-xs text-red-400">{(noteMutation.error as Error).message}</p>}
            {noteMutation.isSuccess && <p className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Note added</p>}
          </div>

          {/* Purchase code */}
          {ticket.purchaseCode && (
            <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3">
              {ticket.purchaseCodeStatus === 'verified' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0" />
              )}
              <div className="text-xs">
                <span className="text-muted-foreground">Purchase code: </span>
                <span className="font-mono text-foreground break-all">{ticket.purchaseCode}</span>
                <span className="ml-2 text-muted-foreground">({ticket.purchaseCodeStatus})</span>
              </div>
            </div>
          )}

          {/* Activity Timeline */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Activity Timeline</p>
              <button
                onClick={() => refetchEvents()}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>

            {eventsLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
              </div>
            ) : sortedEvents.length === 0 ? (
              <div className="rounded-xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
                No events recorded yet.
              </div>
            ) : (
              <div className="space-y-2">
                {sortedEvents.map(e => <EventRow key={e.id} event={e} />)}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
