import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, Search, Plus, Mail, Phone, MessageSquare, Tag, Trash2, Loader2, X, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/authStore';

interface Contact {
  id: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  source: string;
  sourceRef: string;
  websiteTag: string | null;
  taskipUserId: string | null;
  notes: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface Activity {
  id: string;
  contactId: string;
  kind: string;
  summary: string;
  refId: string | null;
  createdAt: string;
}

async function api<T>(token: string, path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.status === 204 ? (undefined as T) : res.json();
}

const SOURCE_LABELS: Record<string, string> = {
  livechat: 'Live Chat',
  crisp: 'Live Chat (legacy)',
  taskip: 'Taskip',
  email: 'Email',
  whatsapp: 'WhatsApp',
  linkedin: 'LinkedIn',
  manual: 'Manual',
};

const SOURCE_COLORS: Record<string, string> = {
  livechat: 'bg-violet-500/15 text-violet-300',
  crisp: 'bg-violet-500/15 text-violet-300',
  taskip: 'bg-emerald-500/15 text-emerald-300',
  email: 'bg-blue-500/15 text-blue-300',
  whatsapp: 'bg-green-500/15 text-green-300',
  linkedin: 'bg-sky-500/15 text-sky-300',
  manual: 'bg-slate-500/15 text-slate-300',
};

export default function ContactsPage() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [source, setSource] = useState<string>('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const list = useQuery<Contact[]>({
    queryKey: ['contacts', q, source],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (q) qs.set('q', q);
      if (source) qs.set('source', source);
      return api<Contact[]>(token, `/contacts?${qs}`);
    },
  });

  const stats = useQuery<{ total: number; crisp: number; email: number; manual: number }>({
    queryKey: ['contacts-stats'],
    queryFn: () => api(token, '/contacts/stats'),
    refetchInterval: 30_000,
  });

  const detail = useQuery<Contact>({
    queryKey: ['contact', openId],
    queryFn: () => api<Contact>(token, `/contacts/${openId}`),
    enabled: !!openId,
  });

  const activity = useQuery<Activity[]>({
    queryKey: ['contact-activity', openId],
    queryFn: () => api<Activity[]>(token, `/contacts/${openId}/activity`),
    enabled: !!openId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(token, `/contacts/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setOpenId(null);
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: ['contacts-stats'] });
    },
  });

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Contacts</h1>
            <p className="text-xs text-muted-foreground">
              Cross-channel address book. Each contact is linked to a source (live chat visitor, email recipient, manual entry).
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          New contact
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3 mt-6 mb-6">
        <Stat label="Total" value={stats.data?.total ?? '–'} />
        <Stat label="Live Chat" value={stats.data?.crisp ?? '–'} accent="violet" />
        <Stat label="Email" value={stats.data?.email ?? '–'} accent="blue" />
        <Stat label="Manual" value={stats.data?.manual ?? '–'} accent="slate" />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 p-4 border-b border-border">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email, phone, notes…"
              className="text-xs pl-9"
            />
          </div>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="text-xs bg-muted/40 border border-border rounded-md px-2 py-1.5"
          >
            <option value="">All sources</option>
            <option value="livechat">Live Chat</option>
            <option value="email">Email</option>
            <option value="taskip">Taskip</option>
            <option value="manual">Manual</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="linkedin">LinkedIn</option>
          </select>
        </div>

        {list.isLoading && <p className="p-6 text-xs text-muted-foreground">Loading…</p>}
        {!list.isLoading && (list.data ?? []).length === 0 && (
          <div className="p-12 text-center">
            <p className="text-sm text-muted-foreground">No contacts yet.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Live chat visitors are added automatically when they message you.
            </p>
          </div>
        )}

        <div className="divide-y divide-border">
          {(list.data ?? []).map((c) => (
            <button
              key={c.id}
              onClick={() => setOpenId(c.id === openId ? null : c.id)}
              className="w-full text-left py-3 px-4 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className={`shrink-0 inline-flex items-center justify-center text-[10px] font-semibold rounded px-1.5 py-0.5 ${SOURCE_COLORS[c.source] ?? 'bg-muted'}`}>
                  {SOURCE_LABELS[c.source] ?? c.source}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {c.displayName || c.email || c.phone || c.sourceRef}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[c.email, c.phone, c.websiteTag].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {c.tags.length > 0 && (
                  <div className="flex gap-1">
                    {c.tags.slice(0, 3).map((t) => (
                      <span key={t} className="text-[10px] px-1.5 rounded bg-muted text-muted-foreground">{t}</span>
                    ))}
                  </div>
                )}
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(c.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {openId && detail.data && (
        <ContactDetailDrawer
          contact={detail.data}
          activity={activity.data ?? []}
          onClose={() => setOpenId(null)}
          onSave={async (patch) => {
            await api(token, `/contacts/${openId}`, { method: 'PATCH', body: JSON.stringify(patch) });
            qc.invalidateQueries({ queryKey: ['contacts'] });
            qc.invalidateQueries({ queryKey: ['contact', openId] });
          }}
          onDelete={() => {
            if (window.confirm('Delete this contact? Activity history will be removed.')) {
              deleteMutation.mutate(openId);
            }
          }}
          deleting={deleteMutation.isPending}
        />
      )}

      {showCreate && (
        <CreateContactDrawer
          onClose={() => setShowCreate(false)}
          onCreate={async (body) => {
            await api(token, '/contacts', { method: 'POST', body: JSON.stringify(body) });
            qc.invalidateQueries({ queryKey: ['contacts'] });
            qc.invalidateQueries({ queryKey: ['contacts-stats'] });
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: 'violet' | 'blue' | 'slate' }) {
  const cls =
    accent === 'violet' ? 'text-violet-300'
      : accent === 'blue' ? 'text-blue-300'
      : accent === 'slate' ? 'text-slate-300'
      : 'text-foreground';
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${cls}`}>{value}</p>
    </div>
  );
}

function ContactDetailDrawer({
  contact, activity, onClose, onSave, onDelete, deleting,
}: {
  contact: Contact;
  activity: Activity[];
  onClose: () => void;
  onSave: (patch: Partial<Contact> & { tags?: string[] }) => Promise<void>;
  onDelete: () => void;
  deleting: boolean;
}) {
  const [displayName, setDisplayName] = useState(contact.displayName ?? '');
  const [email, setEmail] = useState(contact.email ?? '');
  const [phone, setPhone] = useState(contact.phone ?? '');
  const [notes, setNotes] = useState(contact.notes ?? '');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(contact.tags ?? []);
  const [saving, setSaving] = useState(false);

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-background/60 backdrop-blur-sm" onClick={onClose} />
      <div className="w-[520px] max-w-[90vw] bg-card border-l border-border h-full overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border sticky top-0 bg-card z-10">
          <span className="text-sm font-semibold">Contact</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-5">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-semibold rounded px-1.5 py-0.5 ${SOURCE_COLORS[contact.source] ?? 'bg-muted'}`}>
              {SOURCE_LABELS[contact.source] ?? contact.source}
            </span>
            <code className="text-[10px] font-mono text-muted-foreground truncate">{contact.sourceRef}</code>
            {contact.websiteTag && (
              <span className="text-[10px] px-1.5 rounded bg-muted text-muted-foreground ml-auto">site: {contact.websiteTag}</span>
            )}
          </div>

          <Field label="Display name">
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </Field>
          <Field label="Email" icon={<Mail className="w-3.5 h-3.5" />}>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="visitor@example.com" />
          </Field>
          <Field label="Phone" icon={<Phone className="w-3.5 h-3.5" />}>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 …" />
          </Field>
          {contact.taskipUserId && (
            <div className="text-xs text-muted-foreground">
              Linked Taskip user: <code className="font-mono text-foreground/80">{contact.taskipUserId}</code>
            </div>
          )}
          <Field label="Tags" icon={<Tag className="w-3.5 h-3.5" />}>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-muted">
                  {t}
                  <button onClick={() => setTags(tags.filter((x) => x !== t))} className="text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && tagInput.trim()) {
                    e.preventDefault();
                    if (!tags.includes(tagInput.trim())) setTags([...tags, tagInput.trim()]);
                    setTagInput('');
                  }
                }}
                placeholder="add tag…"
                className="text-xs bg-transparent border border-border rounded px-2 py-0.5 w-28 focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </Field>
          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full text-sm bg-muted/40 border border-border rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={async () => {
                setSaving(true);
                try {
                  await onSave({
                    displayName: displayName || null,
                    email: email || null,
                    phone: phone || null,
                    notes: notes || null,
                    tags,
                  });
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving}
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button size="sm" variant="ghost" onClick={onDelete} disabled={deleting} className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10">
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Delete
            </Button>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Activity</p>
            {activity.length === 0 && <p className="text-xs text-muted-foreground italic">No activity yet.</p>}
            <div className="space-y-2">
              {activity.map((a) => (
                <div key={a.id} className="text-xs border-l-2 border-border pl-3 py-1">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-3 h-3 text-muted-foreground" />
                    <span className="font-mono text-[10px] text-muted-foreground">{a.kind}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">{new Date(a.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-foreground/90 mt-0.5">{a.summary}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateContactDrawer({ onClose, onCreate }: { onClose: () => void; onCreate: (body: Record<string, unknown>) => Promise<void> }) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [taskipUserId, setTaskipUserId] = useState('');
  const [saving, setSaving] = useState(false);

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-background/60 backdrop-blur-sm" onClick={onClose} />
      <div className="w-[520px] max-w-[90vw] bg-card border-l border-border h-full overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border sticky top-0 bg-card z-10">
          <span className="text-sm font-semibold">New contact</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <Field label="Display name">
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </Field>
          <Field label="Email">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@example.com" />
          </Field>
          <Field label="Phone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="Taskip user ID (optional)">
            <Input value={taskipUserId} onChange={(e) => setTaskipUserId(e.target.value)} placeholder="user_..." />
          </Field>
          <p className="text-[11px] text-muted-foreground">
            Source is set to <code className="font-mono">manual</code>. Taskip user info is referenced only — not duplicated here.
          </p>
          <Button
            size="sm"
            onClick={async () => {
              if (!displayName && !email && !phone) return;
              setSaving(true);
              try {
                await onCreate({
                  displayName: displayName || undefined,
                  email: email || undefined,
                  phone: phone || undefined,
                  taskipUserId: taskipUserId || undefined,
                  source: taskipUserId ? 'taskip' : 'manual',
                });
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving || (!displayName && !email && !phone)}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Create
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      {children}
    </div>
  );
}
