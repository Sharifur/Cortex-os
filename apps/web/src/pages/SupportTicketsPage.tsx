import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Ticket, Search, RefreshCw, ChevronDown, ChevronUp,
  Mail, Phone, User, Hash, Clock, MessageSquare, AlertTriangle,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

interface SupportTicket {
  id: string;
  externalId: string | null;
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
  repliedAt: string | null;
  createdAt: string;
  updatedAt: string;
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

const CATEGORY_STYLES: Record<string, string> = {
  billing:   'bg-violet-500/15 text-violet-300',
  technical: 'bg-sky-500/15 text-sky-300',
  feature:   'bg-teal-500/15 text-teal-300',
  general:   'bg-slate-500/15 text-slate-400',
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

function TicketRow({ t }: { t: SupportTicket }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className="border-b border-border hover:bg-accent/30 transition-colors cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="py-3 pl-4 pr-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
            <Hash className="w-3 h-3 shrink-0" />
            {t.ticketNo ?? t.externalId ?? '—'}
          </div>
        </td>
        <td className="py-3 px-3 max-w-[260px]">
          <p className="text-sm font-medium truncate">{t.subject}</p>
          {t.category && (
            <Badge label={t.category} styles={CATEGORY_STYLES[t.category] ?? 'bg-slate-500/15 text-slate-400'} />
          )}
        </td>
        <td className="py-3 px-3">
          <div className="flex flex-col gap-0.5">
            {t.contactName && (
              <div className="flex items-center gap-1 text-xs text-foreground">
                <User className="w-3 h-3 text-muted-foreground shrink-0" />
                {t.contactName}
              </div>
            )}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Mail className="w-3 h-3 shrink-0" />
              {t.userEmail || '—'}
            </div>
            {t.contactPhone && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Phone className="w-3 h-3 shrink-0" />
                {t.contactPhone}
              </div>
            )}
          </div>
        </td>
        <td className="py-3 px-3">
          <Badge label={t.priority} styles={PRIORITY_STYLES[t.priority] ?? 'bg-slate-500/15 text-slate-400'} />
        </td>
        <td className="py-3 px-3">
          <Badge label={t.status} styles={STATUS_STYLES[t.status] ?? 'bg-slate-500/15 text-slate-400'} />
        </td>
        <td className="py-3 px-3 text-xs text-muted-foreground whitespace-nowrap">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 shrink-0" />
            {fmt(t.createdAt)}
          </div>
        </td>
        <td className="py-3 px-3 text-xs text-muted-foreground whitespace-nowrap">
          {t.repliedAt ? (
            <div className="flex items-center gap-1 text-emerald-400">
              <MessageSquare className="w-3 h-3 shrink-0" />
              {fmt(t.repliedAt)}
            </div>
          ) : '—'}
        </td>
        <td className="py-3 pl-3 pr-4">
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-border bg-muted/20">
          <td colSpan={8} className="px-4 py-4 space-y-3">
            {t.body ? (
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Ticket Body</p>
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{t.body}</p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No body recorded — ticket created before CRM fetch was configured.</p>
            )}
            {t.lastDraft && (
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  {t.status === 'replied' ? 'Reply Sent' : 'Draft Reply'}
                </p>
                <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {t.lastDraft}
                </div>
              </div>
            )}
            {!t.body && !t.lastDraft && (
              <p className="text-xs text-muted-foreground italic">No content available yet.</p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

const STATUSES = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'replied', label: 'Replied' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'closed', label: 'Closed' },
];

export default function SupportTicketsPage() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading, isError } = useQuery<{ data: SupportTicket[]; limit: number; offset: number }>({
    queryKey: ['support-tickets', q, status],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (q) qs.set('q', q);
      if (status) qs.set('status', status);
      qs.set('limit', '100');
      const res = await fetch(`/support/tickets?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime: 30_000,
  });

  const tickets = data?.data ?? [];

  const counts = {
    open:      tickets.filter(t => t.status === 'open').length,
    replied:   tickets.filter(t => t.status === 'replied').length,
    escalated: tickets.filter(t => t.status === 'escalated').length,
  };

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Ticket className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Support Tickets</h1>
            <p className="text-xs text-muted-foreground">All tickets handled by the Support Ticket Manager agent</p>
          </div>
        </div>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ['support-tickets'] })}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground mb-1">Open</p>
          <p className="text-2xl font-bold text-blue-400">{counts.open}</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground mb-1">Replied</p>
          <p className="text-2xl font-bold text-emerald-400">{counts.replied}</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Escalated</p>
            <p className="text-2xl font-bold text-orange-400">{counts.escalated}</p>
          </div>
          {counts.escalated > 0 && <AlertTriangle className="w-4 h-4 text-orange-400 mt-1" />}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search subject, email, name, ticket no..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
          {STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => setStatus(s.value)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                status === s.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Loading tickets...</div>
        ) : isError ? (
          <div className="py-16 text-center text-sm text-red-400">Failed to load tickets. Check backend connection.</div>
        ) : tickets.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            {q || status ? 'No tickets match the current filters.' : 'No tickets yet — waiting for the first webhook.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] text-muted-foreground uppercase tracking-wide">
                  <th className="py-2.5 pl-4 pr-3 text-left font-medium">Ticket #</th>
                  <th className="py-2.5 px-3 text-left font-medium">Subject</th>
                  <th className="py-2.5 px-3 text-left font-medium">Contact</th>
                  <th className="py-2.5 px-3 text-left font-medium">Priority</th>
                  <th className="py-2.5 px-3 text-left font-medium">Status</th>
                  <th className="py-2.5 px-3 text-left font-medium">Created</th>
                  <th className="py-2.5 px-3 text-left font-medium">Replied</th>
                  <th className="py-2.5 pl-3 pr-4 text-left font-medium w-8"></th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <TicketRow key={t.id} t={t} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tickets.length > 0 && (
          <div className="px-4 py-2.5 border-t border-border text-xs text-muted-foreground">
            Showing {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}
