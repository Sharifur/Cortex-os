import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Globe,
  ExternalLink,
  Mail,
  Twitter,
  Linkedin,
  MessageSquare,
  Plus,
  Trash2,
  Copy,
  Check,
  Loader2,
  Send,
  Zap,
  ChevronDown,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

const STATUS_COLORS: Record<string, string> = {
  discovered: 'bg-muted text-muted-foreground',
  researched: 'bg-blue-500/10 text-blue-400',
  pending_approval: 'bg-yellow-500/10 text-yellow-400',
  emailed: 'bg-emerald-500/10 text-emerald-400',
  skipped: 'bg-red-500/10 text-red-400',
  listed: 'bg-purple-500/10 text-purple-400',
};

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  email_sent: <Mail className="w-3.5 h-3.5" />,
  twitter_dm: <Twitter className="w-3.5 h-3.5" />,
  linkedin_message: <Linkedin className="w-3.5 h-3.5" />,
  status_change: <ChevronDown className="w-3.5 h-3.5" />,
  manual: <MessageSquare className="w-3.5 h-3.5" />,
  followup: <Send className="w-3.5 h-3.5" />,
};

interface Prospect {
  id: string;
  domain: string;
  productDomain: string;
  productName: string | null;
  siteName: string | null;
  siteUrl: string;
  contactEmail: string | null;
  linkedinProfileUrl: string | null;
  linkedinName: string | null;
  linkedinHeadline: string | null;
  submitUrl: string | null;
  contactFormUrl: string | null;
  status: string;
  qualityScore: number | null;
  openPageRank: string | null;
  searchRank: number | null;
  outreachGoal: string;
  outreachSubject: string | null;
  outreachBody: string | null;
  notes: string | null;
  lastContactedAt: string | null;
  nextContactAt: string | null;
  description: string | null;
  searchQuery: string | null;
  createdAt: string;
}

interface Activity {
  id: string;
  prospectId: string;
  type: string;
  summary: string;
  content: string | null;
  createdAt: string;
}

interface GmailAccount {
  id: string;
  label: string;
  email: string;
  displayName: string | null;
  isDefault: boolean;
}

function ComposeEmailModal({
  token,
  prospect,
  onClose,
  onSent,
}: {
  token: string;
  prospect: Prospect;
  onClose: () => void;
  onSent: () => void;
}) {
  const [to, setTo] = useState(prospect.contactEmail ?? '');
  const [subject, setSubject] = useState(prospect.outreachSubject ?? '');
  const [body, setBody] = useState(prospect.outreachBody ?? '');
  const [accountId, setAccountId] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<GmailAccount[]>({
    queryKey: ['gmail-accounts'],
    queryFn: async () => {
      const res = await fetch('/gmail/accounts', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    staleTime: 60_000,
  });

  const def = accounts.find((a) => a.isDefault) ?? accounts[0];
  if (def && !accountId) setAccountId(def.id);

  async function handleSend() {
    if (!to.trim() || !subject.trim() || !body.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/taskip-internal/inbox/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: to.trim(),
          subject: subject.trim(),
          textBody: body.trim(),
          purpose: 'other',
          accountId: accountId || undefined,
          plainText: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { message?: string }).message ?? `HTTP ${res.status}`);

      await Promise.all([
        fetch(`/listing-outreach/prospects/${prospect.id}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'emailed' }),
        }),
        fetch(`/listing-outreach/prospects/${prospect.id}/activities`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'email_sent',
            summary: `Email sent to ${to.trim()}`,
            content: JSON.stringify({ to: to.trim(), subject: subject.trim(), body: body.trim() }),
          }),
        }),
      ]);

      setTimeout(() => { onSent(); onClose(); }, 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
              <Mail className="w-3.5 h-3.5 text-white" />
            </div>
            <h2 className="text-base font-semibold">Send Outreach Email</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="rounded-b-xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border">
            <span className="text-xs text-muted-foreground w-16 shrink-0">From</span>
            {accountsLoading ? (
              <Skeleton className="h-4 w-48" />
            ) : accounts.length > 0 ? (
              <div className="relative flex-1">
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full text-sm pl-0 pr-6 py-0 bg-transparent text-foreground focus:outline-none appearance-none cursor-pointer"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.displayName ? `${a.displayName} <${a.email}>` : a.email}{a.isDefault ? ' (default)' : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">No Gmail accounts connected</span>
            )}
          </div>
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border">
            <span className="text-xs text-muted-foreground w-16 shrink-0">To</span>
            <input type="email" value={to} onChange={(e) => setTo(e.target.value)} className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-muted-foreground/50" />
          </div>
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border">
            <span className="text-xs text-muted-foreground w-16 shrink-0">Subject</span>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-muted-foreground/50" />
          </div>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} className="w-full px-4 py-3 text-sm bg-transparent focus:outline-none resize-none font-mono leading-relaxed" style={{ minHeight: '200px' }} />
          <div className="px-4 py-2.5 border-t border-border flex items-center justify-between gap-2 bg-muted/10">
            <span className="text-[11px] text-muted-foreground tabular-nums">{body.trim() ? body.trim().split(/\s+/).length : 0} words</span>
            <div className="flex items-center gap-2">
              {error && <span className="text-[11px] text-destructive">{error}</span>}
              <button
                onClick={handleSend}
                disabled={sending || !to.trim() || !subject.trim() || !body.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Send email
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddActivityModal({
  token,
  prospectId,
  onClose,
  onAdded,
}: {
  token: string;
  prospectId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [type, setType] = useState('manual');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!summary.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/listing-outreach/prospects/${prospectId}/activities`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, summary: summary.trim(), content: content.trim() || undefined }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onAdded();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const ACTIVITY_TYPES = [
    { value: 'manual', label: 'Manual note' },
    { value: 'twitter_dm', label: 'Twitter/X DM' },
    { value: 'linkedin_message', label: 'LinkedIn message' },
    { value: 'followup', label: 'Follow-up' },
    { value: 'email_sent', label: 'Email sent' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold">Add Activity</h2>
          <button onClick={onClose} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full h-9 text-sm rounded-md border border-input bg-background px-3"
            >
              {ACTIVITY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Summary</label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="What happened?"
              className="w-full h-9 text-sm rounded-md border border-input bg-background px-3 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Content (optional)</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Message text, notes, or any details..."
              rows={4}
              className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !summary.trim()}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
              Save activity
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmailContentPreview({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  let parsed: { to?: string; subject?: string; body?: string } = {};
  try { parsed = JSON.parse(content); } catch { return <p className="text-xs text-muted-foreground font-mono mt-2">{content}</p>; }

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="text-xs text-primary hover:underline"
      >
        {expanded ? 'Hide email' : 'Show email content'}
      </button>
      {expanded && (
        <div className="mt-2 rounded-lg border border-border bg-muted/20 text-xs space-y-1 p-3">
          {parsed.to && <p><span className="text-muted-foreground">To:</span> {parsed.to}</p>}
          {parsed.subject && <p><span className="text-muted-foreground">Subject:</span> {parsed.subject}</p>}
          {parsed.body && <pre className="mt-2 whitespace-pre-wrap font-sans leading-relaxed text-foreground/80">{parsed.body}</pre>}
        </div>
      )}
    </div>
  );
}

export default function ListingProspectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token) ?? '';
  const qc = useQueryClient();
  const [composing, setComposing] = useState(false);
  const [addingActivity, setAddingActivity] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [editNotes, setEditNotes] = useState(false);
  const [notesValue, setNotesValue] = useState('');

  const { data: prospect, isLoading } = useQuery<Prospect>({
    queryKey: ['listing-prospect', id],
    queryFn: async () => {
      const res = await fetch(`/listing-outreach/prospects/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Not found');
      return res.json();
    },
    enabled: !!id,
  });

  const { data: activities = [], isLoading: activitiesLoading } = useQuery<Activity[]>({
    queryKey: ['listing-prospect-activities', id],
    queryFn: async () => {
      const res = await fetch(`/listing-outreach/prospects/${id}/activities`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id,
    refetchInterval: 15_000,
  });

  async function updateStatus(status: string) {
    await fetch(`/listing-outreach/prospects/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    qc.invalidateQueries({ queryKey: ['listing-prospect', id] });
    qc.invalidateQueries({ queryKey: ['listing-prospect-activities', id] });
    qc.invalidateQueries({ queryKey: ['listing-prospects'] });
  }

  async function saveNotes() {
    await fetch(`/listing-outreach/prospects/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: notesValue }),
    });
    qc.invalidateQueries({ queryKey: ['listing-prospect', id] });
    setEditNotes(false);
  }

  async function generateDraft() {
    setDrafting(true);
    setDraftError(null);
    try {
      const res = await fetch(`/listing-outreach/prospects/${id}/draft`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Draft failed' }));
        setDraftError((err as { message?: string }).message ?? 'Draft failed');
      } else {
        qc.invalidateQueries({ queryKey: ['listing-prospect', id] });
      }
    } finally {
      setDrafting(false);
    }
  }

  async function deletePropect() {
    await fetch(`/listing-outreach/prospects/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    qc.invalidateQueries({ queryKey: ['listing-prospects'] });
    navigate('/agents/listing_outreach');
  }

  function copyText(key: string, text: string) {
    navigator.clipboard.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(null), 2000); });
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (!prospect) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Prospect not found.{' '}
        <Link to="/agents/listing_outreach" className="text-primary hover:underline">Back to agent</Link>
      </div>
    );
  }

  return (
    <>
      {composing && (
        <ComposeEmailModal
          token={token}
          prospect={prospect}
          onClose={() => setComposing(false)}
          onSent={() => {
            setComposing(false);
            qc.invalidateQueries({ queryKey: ['listing-prospect', id] });
            qc.invalidateQueries({ queryKey: ['listing-prospect-activities', id] });
            qc.invalidateQueries({ queryKey: ['listing-prospects'] });
          }}
        />
      )}
      {addingActivity && (
        <AddActivityModal
          token={token}
          prospectId={prospect.id}
          onClose={() => setAddingActivity(false)}
          onAdded={() => qc.invalidateQueries({ queryKey: ['listing-prospect-activities', id] })}
        />
      )}

      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <button
              onClick={() => navigate('/agents/listing_outreach')}
              className="mt-0.5 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-xl font-semibold">{prospect.siteName || prospect.domain}</h1>
              <a
                href={prospect.siteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 mt-0.5"
              >
                <Globe className="w-3.5 h-3.5" />
                {prospect.domain}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <select
              value={prospect.status}
              onChange={(e) => updateStatus(e.target.value)}
              className={`text-xs px-3 py-1.5 rounded-full border-0 font-medium cursor-pointer ${STATUS_COLORS[prospect.status] ?? 'bg-muted text-muted-foreground'}`}
            >
              {['discovered', 'researched', 'pending_approval', 'emailed', 'skipped', 'listed'].map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>

            {!deleteConfirm ? (
              <button
                onClick={() => setDeleteConfirm(true)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Delete prospect"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Delete?</span>
                <button onClick={deletePropect} className="text-xs px-2 py-1 rounded bg-destructive text-destructive-foreground hover:bg-destructive/90">Yes</button>
                <button onClick={() => setDeleteConfirm(false)} className="text-xs px-2 py-1 rounded border border-border hover:bg-muted">No</button>
              </div>
            )}
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Site info */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Site</h2>
            <div className="space-y-2 text-sm">
              {prospect.description && <p className="text-muted-foreground text-xs leading-relaxed">{prospect.description}</p>}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Quality score</span>
                <span className="font-mono text-sm">{prospect.qualityScore ?? '—'}</span>
              </div>
              {prospect.openPageRank && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Open PageRank</span>
                  <span className="font-mono text-sm">{prospect.openPageRank}</span>
                </div>
              )}
              {prospect.searchRank && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Search rank</span>
                  <span className="font-mono text-sm">#{prospect.searchRank}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Product</span>
                <span className="text-sm">{prospect.productName || prospect.productDomain}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Goal</span>
                <span className="text-sm capitalize">{prospect.outreachGoal}</span>
              </div>
            </div>
          </div>

          {/* Contact info */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact</h2>
            <div className="space-y-2">
              {prospect.contactEmail ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-sm">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                    <a href={`mailto:${prospect.contactEmail}`} className="text-primary hover:underline">{prospect.contactEmail}</a>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No email found</p>
              )}
              {prospect.linkedinProfileUrl && (
                <div className="flex items-center gap-1.5 text-sm">
                  <Linkedin className="w-3.5 h-3.5 text-blue-400" />
                  <a href={prospect.linkedinProfileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                    {prospect.linkedinName || 'LinkedIn profile'} <ExternalLink className="w-2.5 h-2.5 inline" />
                  </a>
                </div>
              )}
              {prospect.submitUrl && (
                <div className="flex items-center gap-1.5 text-sm">
                  <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                  <a href={prospect.submitUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                    Submit form <ExternalLink className="w-2.5 h-2.5 inline" />
                  </a>
                </div>
              )}
              {prospect.contactFormUrl && !prospect.submitUrl && (
                <div className="flex items-center gap-1.5 text-sm">
                  <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                  <a href={prospect.contactFormUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                    Contact form <ExternalLink className="w-2.5 h-2.5 inline" />
                  </a>
                </div>
              )}
              {prospect.lastContactedAt && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-muted-foreground">Last contacted</span>
                  <span className="text-xs">{new Date(prospect.lastContactedAt).toLocaleDateString()}</span>
                </div>
              )}
              {prospect.nextContactAt && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Next contact</span>
                  <span className="text-xs">{new Date(prospect.nextContactAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Outreach draft */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Outreach Draft</h2>
            <div className="flex items-center gap-2">
              {prospect.outreachSubject && prospect.outreachBody && (
                <>
                  <button
                    onClick={generateDraft}
                    disabled={drafting}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    {drafting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                    Regenerate
                  </button>
                  {prospect.contactEmail && prospect.status !== 'emailed' && (
                    <button
                      onClick={() => setComposing(true)}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs hover:bg-primary/90 transition-colors"
                    >
                      <Mail className="w-3 h-3" /> Send Email
                    </button>
                  )}
                </>
              )}
              {!prospect.outreachSubject && (
                <button
                  onClick={generateDraft}
                  disabled={drafting}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/40 disabled:opacity-50 transition-colors"
                >
                  {drafting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                  {drafting ? 'Generating...' : 'Generate Draft'}
                </button>
              )}
            </div>
          </div>

          {draftError && <p className="text-xs text-destructive">{draftError}</p>}

          {prospect.outreachSubject ? (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-muted-foreground">Subject</p>
                  <button onClick={() => prospect.outreachSubject && copyText('sub', prospect.outreachSubject)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                    {copied === 'sub' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copied === 'sub' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-sm bg-muted/40 border border-border rounded px-3 py-2">{prospect.outreachSubject}</p>
              </div>
              {prospect.outreachBody && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-muted-foreground">Body</p>
                    <button onClick={() => prospect.outreachBody && copyText('body', prospect.outreachBody)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                      {copied === 'body' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      {copied === 'body' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <pre className="text-sm bg-muted/40 border border-border rounded px-3 py-2 whitespace-pre-wrap font-sans leading-relaxed">{prospect.outreachBody}</pre>
                </div>
              )}
              {prospect.status === 'emailed' && (
                <p className="text-xs text-emerald-400 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Email sent
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No draft yet. Generate one or trigger the agent.</p>
          )}
        </div>

        {/* Notes */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</h2>
            {!editNotes && (
              <button
                onClick={() => { setNotesValue(prospect.notes ?? ''); setEditNotes(true); }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Edit
              </button>
            )}
          </div>
          {editNotes ? (
            <div className="space-y-2">
              <textarea
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                rows={4}
                className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                placeholder="Add notes about this prospect..."
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={saveNotes}>Save</Button>
                <Button size="sm" variant="outline" onClick={() => setEditNotes(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{prospect.notes || 'No notes yet.'}</p>
          )}
        </div>

        {/* Activity feed */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Activity</h2>
            <button
              onClick={() => setAddingActivity(true)}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Plus className="w-3.5 h-3.5" /> Add activity
            </button>
          </div>

          {activitiesLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : activities.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No activities yet. Add one to track your outreach.</p>
          ) : (
            <div className="space-y-3">
              {activities.map((a) => (
                <div key={a.id} className="flex gap-3">
                  <div className="mt-0.5 h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
                    {ACTIVITY_ICONS[a.type] ?? <MessageSquare className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{a.summary}</p>
                      <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                        {new Date(a.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground capitalize">{a.type.replace(/_/g, ' ')}</p>
                    {a.content && a.type === 'email_sent' && <EmailContentPreview content={a.content} />}
                    {a.content && a.type !== 'email_sent' && (
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{a.content}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
