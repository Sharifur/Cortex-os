import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Plus, Trash2, Edit2, X, Upload, Link, ChevronDown, ChevronRight, FileText, Globe, Code, Layers } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

const KB_AGENTS = ['livechat', 'support', 'whatsapp', 'email_manager', 'linkedin', 'reddit', 'social', 'shorts'];
const ENTRY_TYPES = ['reference', 'fact', 'voice_profile', 'blocklist', 'product', 'service', 'offer'];
const CATEGORIES = ['general', 'product', 'policy', 'faq', 'document', 'webpage', 'other'];

function parseAgentKeys(csv: string): string[] {
  return csv.split(',').map((s) => s.trim()).filter(Boolean);
}

function AgentPills({ csv, fallback }: { csv?: string | null; fallback?: string }) {
  const tags = csv ? parseAgentKeys(csv) : [];
  if (tags.length === 0) {
    return fallback ? (
      <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-dashed border-border text-muted-foreground">
        {fallback}
      </span>
    ) : null;
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {tags.map((t) => (
        <span
          key={t}
          className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-medium"
        >
          {t}
        </span>
      ))}
    </span>
  );
}

function AgentMultiSelect({ value, onChange, placeholder }: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  const selected = parseAgentKeys(value);
  const toggle = (key: string) => {
    const next = selected.includes(key) ? selected.filter((s) => s !== key) : [...selected, key];
    onChange(next.join(','));
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 bg-background border border-border rounded-lg px-2 py-1.5 min-h-[38px]">
      {selected.length === 0 && (
        <span className="text-xs text-muted-foreground px-1">{placeholder ?? 'Pick agents (blank = all)'}</span>
      )}
      {KB_AGENTS.map((a) => {
        const on = selected.includes(a);
        return (
          <button
            key={a}
            type="button"
            onClick={() => toggle(a)}
            className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
              on
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
            }`}
          >
            {a}
          </button>
        );
      })}
      {selected.length > 0 && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="ml-auto text-[11px] text-muted-foreground hover:text-foreground"
        >
          clear
        </button>
      )}
    </div>
  );
}

// Livechat sites — used to scope KB entries / samples to a specific website
// when the `livechat` agent tag is set. Cached for 60s; rarely changes.
function useLivechatSites(token: string) {
  return useQuery<{ id: string; key: string; label: string }[]>({
    queryKey: ['livechat-sites'],
    queryFn: async () => {
      const res = await fetch('/agents/livechat/sites', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60_000,
  });
}

type SiteScopeMode = 'all' | 'include' | 'exclude';

function csvToList(csv: string): string[] {
  return csv.split(',').map((s) => s.trim()).filter(Boolean);
}

function SiteScopeBadge({
  siteKeys,
  excludedSiteKeys,
  siteLabel,
}: {
  siteKeys?: string | null;
  excludedSiteKeys?: string | null;
  siteLabel: (k: string) => string | null;
}) {
  const inc = siteKeys ? csvToList(siteKeys) : [];
  const exc = excludedSiteKeys ? csvToList(excludedSiteKeys) : [];
  if (!inc.length && !exc.length) return null;
  if (exc.length) {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 font-medium" title={`Excluded sites: ${exc.join(', ')}`}>
        except: {exc.map((k) => siteLabel(k) ?? k).join(', ')}
      </span>
    );
  }
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 font-medium" title={`Sites: ${inc.join(', ')}`}>
      sites: {inc.map((k) => siteLabel(k) ?? k).join(', ')}
    </span>
  );
}

/**
 * Three-mode site scope editor for livechat KB entries:
 *   - all       — applies to every site (both lists empty)
 *   - include   — applies only to checked sites (siteKeys = csv)
 *   - exclude   — applies to all sites except checked ones (excludedSiteKeys = csv)
 */
function LivechatSiteScopeEditor({
  token,
  siteKeys,
  excludedSiteKeys,
  onChange,
}: {
  token: string;
  siteKeys: string;
  excludedSiteKeys: string;
  onChange: (next: { siteKeys: string; excludedSiteKeys: string }) => void;
}) {
  const { data: sites = [] } = useLivechatSites(token);
  const initialMode: SiteScopeMode = excludedSiteKeys.trim()
    ? 'exclude'
    : siteKeys.trim()
      ? 'include'
      : 'all';
  const [mode, setMode] = useState<SiteScopeMode>(initialMode);
  const checked = mode === 'include' ? csvToList(siteKeys) : mode === 'exclude' ? csvToList(excludedSiteKeys) : [];

  const setMode_ = (next: SiteScopeMode) => {
    setMode(next);
    if (next === 'all') onChange({ siteKeys: '', excludedSiteKeys: '' });
    else if (next === 'include') onChange({ siteKeys: csvToList(siteKeys).join(','), excludedSiteKeys: '' });
    else onChange({ siteKeys: '', excludedSiteKeys: csvToList(excludedSiteKeys).join(',') });
  };

  const toggle = (key: string) => {
    const next = checked.includes(key) ? checked.filter((k) => k !== key) : [...checked, key];
    if (mode === 'include') onChange({ siteKeys: next.join(','), excludedSiteKeys: '' });
    else if (mode === 'exclude') onChange({ siteKeys: '', excludedSiteKeys: next.join(',') });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3 text-xs">
        {(['all', 'include', 'exclude'] as SiteScopeMode[]).map((m) => (
          <label key={m} className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="site-scope"
              checked={mode === m}
              onChange={() => setMode_(m)}
              className="accent-primary"
            />
            {m === 'all' ? 'All sites' : m === 'include' ? 'Only these sites' : 'All sites except these'}
          </label>
        ))}
      </div>
      {mode !== 'all' && (
        <div className="bg-background border border-border rounded-lg p-2 flex flex-wrap gap-1.5 max-h-[140px] overflow-auto">
          {sites.length === 0 ? (
            <span className="text-xs text-muted-foreground px-1">No livechat sites configured.</span>
          ) : (
            sites.map((s) => {
              const on = checked.includes(s.key);
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => toggle(s.key)}
                  className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${
                    on
                      ? mode === 'exclude'
                        ? 'bg-red-500/15 text-red-500 border-red-500/40'
                        : 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
                  }`}
                  title={s.key}
                >
                  {s.label}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

async function apiFetch(token: string, path: string, opts?: RequestInit) {
  const res = await fetch(path, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...opts?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}

function typeBadge(type: string) {
  const map: Record<string, string> = {
    reference: 'bg-blue-500/15 text-blue-400',
    fact: 'bg-amber-500/15 text-amber-400',
    voice_profile: 'bg-purple-500/15 text-purple-400',
    blocklist: 'bg-red-500/15 text-red-400',
    product: 'bg-emerald-500/15 text-emerald-400',
    service: 'bg-teal-500/15 text-teal-400',
    offer: 'bg-pink-500/15 text-pink-400',
  };
  return map[type] ?? 'bg-muted text-muted-foreground';
}

function sourceBadge(type: string) {
  const map: Record<string, string> = {
    manual: 'bg-muted text-muted-foreground',
    pdf: 'bg-rose-500/15 text-rose-400',
    docx: 'bg-indigo-500/15 text-indigo-400',
    md: 'bg-green-500/15 text-green-400',
    link: 'bg-cyan-500/15 text-cyan-400',
  };
  return map[type] ?? 'bg-muted text-muted-foreground';
}

// ─── Entry Modal ───────────────────────────────────────────────────────────

function EntryModal({ entry, onClose, onSave, token }: {
  entry?: any;
  onClose: () => void;
  onSave: (data: any) => void;
  token: string;
}) {
  const [form, setForm] = useState({
    title: entry?.title ?? '',
    content: entry?.content ?? '',
    category: entry?.category ?? 'general',
    entryType: entry?.entryType ?? 'reference',
    priority: entry?.priority ?? 50,
    agentKeys: entry?.agentKeys ?? '',
    siteKeys: entry?.siteKeys ?? '',
    excludedSiteKeys: entry?.excludedSiteKeys ?? '',
  });
  const livechatTagged = parseAgentKeys(form.agentKeys).includes('livechat');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg mx-4 shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold text-sm">{entry ? 'Edit Entry' : 'Add Entry'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Title</label>
            <input
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Refund Policy"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Content</label>
            <textarea
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              rows={6}
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder="Enter the knowledge content..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Type</label>
              <select
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                value={form.entryType}
                onChange={e => setForm(f => ({ ...f, entryType: e.target.value }))}
              >
                <option value="reference">Reference (FTS searched)</option>
                <option value="fact">Always-On Fact</option>
                <option value="voice_profile">Voice Profile</option>
                <option value="blocklist">Blocklist Rule</option>
                <option value="product">Product (always-on)</option>
                <option value="service">Service (always-on)</option>
                <option value="offer">Offer / Promo (always-on)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Category</label>
              <select
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Priority (1–100)</label>
              <input
                type="number" min={1} max={100}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Agents (blank = all)</label>
              <AgentMultiSelect
                value={form.agentKeys}
                onChange={(next) => {
                  const lc = parseAgentKeys(next).includes('livechat');
                  setForm((f) => ({
                    ...f,
                    agentKeys: next,
                    siteKeys: lc ? f.siteKeys : '',
                    excludedSiteKeys: lc ? f.excludedSiteKeys : '',
                  }));
                }}
              />
            </div>
          </div>
          {livechatTagged && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Live Chat site scope</label>
              <LivechatSiteScopeEditor
                token={token}
                siteKeys={form.siteKeys}
                excludedSiteKeys={form.excludedSiteKeys}
                onChange={(next) => setForm((f) => ({ ...f, ...next }))}
              />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg">Cancel</button>
          <button
            onClick={() => onSave({
              ...form,
              agentKeys: form.agentKeys || null,
              siteKeys: form.siteKeys || null,
              excludedSiteKeys: form.excludedSiteKeys || null,
            })}
            disabled={!form.title.trim() || !form.content.trim()}
            className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sample Modal ─────────────────────────────────────────────────────────

function SampleModal({ sample, onClose, onSave, token }: {
  sample?: any;
  onClose: () => void;
  onSave: (data: any) => void;
  token: string;
}) {
  const [form, setForm] = useState({
    context: sample?.context ?? '',
    sampleText: sample?.sampleText ?? '',
    polarity: sample?.polarity ?? 'positive',
    agentKeys: sample?.agentKeys ?? '',
    siteKeys: sample?.siteKeys ?? '',
    excludedSiteKeys: sample?.excludedSiteKeys ?? '',
  });
  const livechatTagged = parseAgentKeys(form.agentKeys).includes('livechat');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg mx-4 shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold text-sm">{sample ? 'Edit Sample' : 'Add Writing Sample'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Context label</label>
            <input
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              value={form.context}
              onChange={e => setForm(f => ({ ...f, context: e.target.value }))}
              placeholder="e.g. angry customer reply"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Sample text</label>
            <textarea
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              rows={8}
              value={form.sampleText}
              onChange={e => setForm(f => ({ ...f, sampleText: e.target.value }))}
              placeholder="Paste an example of the writing style..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Polarity</label>
              <select
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                value={form.polarity}
                onChange={e => setForm(f => ({ ...f, polarity: e.target.value }))}
              >
                <option value="positive">✓ Positive — write like this</option>
                <option value="negative">✗ Negative — never write like this</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Agents (blank = all)</label>
              <AgentMultiSelect
                value={form.agentKeys}
                onChange={(next) => {
                  const lc = parseAgentKeys(next).includes('livechat');
                  setForm((f) => ({
                    ...f,
                    agentKeys: next,
                    siteKeys: lc ? f.siteKeys : '',
                    excludedSiteKeys: lc ? f.excludedSiteKeys : '',
                  }));
                }}
              />
            </div>
          </div>
          {livechatTagged && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Live Chat site scope</label>
              <LivechatSiteScopeEditor
                token={token}
                siteKeys={form.siteKeys}
                excludedSiteKeys={form.excludedSiteKeys}
                onChange={(next) => setForm((f) => ({ ...f, ...next }))}
              />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg">Cancel</button>
          <button
            onClick={() => onSave({
              ...form,
              agentKeys: form.agentKeys || null,
              siteKeys: form.siteKeys || null,
              excludedSiteKeys: form.excludedSiteKeys || null,
            })}
            disabled={!form.context.trim() || !form.sampleText.trim()}
            className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 1: Entries ────────────────────────────────────────────────────────

function EntriesTab({ token }: { token: string }) {
  const qc = useQueryClient();
  const [agentFilter, setAgentFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [siteFilter, setSiteFilter] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [modal, setModal] = useState<null | 'add' | any>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { data: sites = [] } = useLivechatSites(token);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  function onSearchChange(val: string) {
    setSearch(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(val), 400);
  }

  const params = new URLSearchParams();
  if (agentFilter) params.set('agentKey', agentFilter);
  if (typeFilter) params.set('type', typeFilter);
  if (siteFilter) params.set('siteKey', siteFilter);
  if (debouncedSearch) params.set('q', debouncedSearch);

  const { data: entries = [], isLoading } = useQuery<any[]>({
    queryKey: ['kb-entries', agentFilter, typeFilter, siteFilter, debouncedSearch],
    queryFn: () => apiFetch(token, `/knowledge-base/entries?${params}`),
  });

  const createMut = useMutation({
    mutationFn: (body: any) => apiFetch(token, '/knowledge-base/entries', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kb-entries'] }); setModal(null); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...body }: any) => apiFetch(token, `/knowledge-base/entries/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kb-entries'] }); setModal(null); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(token, `/knowledge-base/entries/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kb-entries'] }),
  });

  const bulkDeleteMut = useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch(token, '/knowledge-base/entries/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kb-entries'] });
      setSelected(new Set());
    },
  });

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const visibleSelectableIds = entries.filter((e: any) => !e.parentDocId).map((e: any) => e.id);
  const allSelected = visibleSelectableIds.length > 0 && visibleSelectableIds.every((id: string) => selected.has(id));
  const someSelected = visibleSelectableIds.some((id: string) => selected.has(id));
  const toggleSelectAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(visibleSelectableIds));
  };
  const siteLabel = (key: string | null | undefined) => {
    if (!key) return null;
    const m = sites.find((s) => s.key === key);
    return m ? m.label : key;
  };

  // Group chunks under their parent doc so the list stays readable when an
  // imported document explodes into 11+ rows. A top-level row is anything
  // that has no parent, OR an orphan whose parent isn't in this page.
  const childrenByParent = new Map<string, any[]>();
  for (const e of entries as any[]) {
    if (e.parentDocId) {
      const list = childrenByParent.get(e.parentDocId) ?? [];
      list.push(e);
      childrenByParent.set(e.parentDocId, list);
    }
  }
  const presentIds = new Set((entries as any[]).map((e) => e.id));
  const topLevel = (entries as any[]).filter((e) => !e.parentDocId || !presentIds.has(e.parentDocId));
  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary w-48"
          placeholder="Search entries..."
          value={search}
          onChange={e => onSearchChange(e.target.value)}
        />
        <select
          className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none"
          value={agentFilter}
          onChange={e => setAgentFilter(e.target.value)}
        >
          <option value="">All agents</option>
          {KB_AGENTS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select
          className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
        >
          <option value="">All types</option>
          {ENTRY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {agentFilter === 'livechat' && sites.length > 0 && (
          <select
            className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none"
            value={siteFilter}
            onChange={e => setSiteFilter(e.target.value)}
          >
            <option value="">All sites</option>
            {sites.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        )}
        <button
          onClick={() => setModal('add')}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded-lg hover:opacity-90"
        >
          <Plus className="w-3.5 h-3.5" /> Add Entry
        </button>
      </div>

      {someSelected && (
        <div className="mb-3 flex items-center gap-3 bg-card border border-border rounded-lg px-3 py-2">
          <span className="text-xs text-muted-foreground">{selected.size} selected</span>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete ${selected.size} entries? This cannot be undone.`)) {
                bulkDeleteMut.mutate(Array.from(selected));
              }
            }}
            disabled={bulkDeleteMut.isPending}
            className="ml-auto flex items-center gap-1.5 px-3 py-1 text-xs bg-red-500/15 text-red-500 rounded-md hover:bg-red-500/25 disabled:opacity-50"
          >
            <Trash2 className="w-3 h-3" /> Delete selected
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-muted/50 rounded-lg animate-pulse" />)}</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">No entries yet. Add your first knowledge entry.</div>
      ) : (
        <div className="space-y-2">
          {visibleSelectableIds.length > 0 && (
            <label className="flex items-center gap-2 px-2 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                className="accent-primary"
              />
              Select all on this page
            </label>
          )}
          {topLevel.map((entry: any) => {
            const children = childrenByParent.get(entry.id) ?? [];
            const hasChildren = children.length > 0;
            const isOpen = expanded.has(entry.id);
            return (
              <div key={entry.id} className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="px-4 py-3 flex items-start gap-3">
                  {!entry.parentDocId ? (
                    <input
                      type="checkbox"
                      checked={selected.has(entry.id)}
                      onChange={() => toggleSelected(entry.id)}
                      className="accent-primary mt-1 shrink-0"
                    />
                  ) : (
                    <span className="w-4" />
                  )}
                  {hasChildren ? (
                    <button
                      onClick={() => toggleExpanded(entry.id)}
                      className="text-muted-foreground hover:text-foreground p-0.5 mt-0.5 shrink-0"
                      title={isOpen ? 'Collapse chunks' : 'Expand chunks'}
                    >
                      {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                  ) : (
                    <span className="w-4" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{entry.title}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${typeBadge(entry.entryType)}`}>{entry.entryType}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${sourceBadge(entry.sourceType)}`}>{entry.sourceType}</span>
                      {entry.parentDocId && <span className="text-xs text-muted-foreground">chunk</span>}
                      {hasChildren && (
                        <span className="text-[10px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 font-medium">
                          <Layers className="w-3 h-3" /> {children.length} chunk{children.length === 1 ? '' : 's'}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">{entry.category}</span>
                      {entry.priority !== 50 && <span className="text-xs text-muted-foreground">p:{entry.priority}</span>}
                      <AgentPills csv={entry.agentKeys} fallback="all agents" />
                      <SiteScopeBadge siteKeys={entry.siteKeys} excludedSiteKeys={entry.excludedSiteKeys} siteLabel={siteLabel} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{entry.content}</p>
                  </div>
                  {!entry.parentDocId && (
                    <button
                      onClick={() => setModal(entry)}
                      className="text-muted-foreground hover:text-foreground p-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      const msg = hasChildren
                        ? `Delete "${entry.title}" and its ${children.length} chunk${children.length === 1 ? '' : 's'}? This cannot be undone.`
                        : `Delete "${entry.title}"? This cannot be undone.`;
                      if (confirm(msg)) deleteMut.mutate(entry.id);
                    }}
                    className="text-muted-foreground hover:text-destructive p-1"
                    title={hasChildren ? `Delete with ${children.length} chunks` : 'Delete'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {hasChildren && isOpen && (
                  <div className="border-t border-border bg-muted/20 px-4 py-2 space-y-1">
                    {children.map((c: any) => (
                      <div key={c.id} className="flex items-start gap-2 text-xs py-1">
                        <span className="text-muted-foreground shrink-0 font-mono">↳</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{c.title}</span>
                          </div>
                          <p className="text-muted-foreground mt-0.5 truncate">{c.content}</p>
                        </div>
                        <button
                          onClick={() => deleteMut.mutate(c.id)}
                          className="text-muted-foreground hover:text-destructive p-1"
                          title="Delete this chunk"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <EntryModal
          entry={modal === 'add' ? undefined : modal}
          onClose={() => setModal(null)}
          token={token}
          onSave={(data) => {
            if (modal === 'add') createMut.mutate(data);
            else updateMut.mutate({ id: modal.id, ...data });
          }}
        />
      )}
    </div>
  );
}

// ─── Tab 2: Writing Samples ────────────────────────────────────────────────

function SamplesTab({ token }: { token: string }) {
  const qc = useQueryClient();
  const [agentFilter, setAgentFilter] = useState('');
  const [polarityFilter, setPolarityFilter] = useState('');
  const [siteFilter, setSiteFilter] = useState('');
  const [modal, setModal] = useState<null | 'add' | any>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { data: sites = [] } = useLivechatSites(token);

  const params = new URLSearchParams();
  if (agentFilter) params.set('agentKey', agentFilter);
  if (siteFilter) params.set('siteKey', siteFilter);

  const { data: samples = [], isLoading } = useQuery<any[]>({
    queryKey: ['kb-samples', agentFilter, siteFilter],
    queryFn: () => apiFetch(token, `/knowledge-base/samples?${params}`),
  });

  const filtered = polarityFilter ? samples.filter((s: any) => s.polarity === polarityFilter) : samples;

  const createMut = useMutation({
    mutationFn: (body: any) => apiFetch(token, '/knowledge-base/samples', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kb-samples'] }); setModal(null); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...body }: any) => apiFetch(token, `/knowledge-base/samples/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kb-samples'] }); setModal(null); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(token, `/knowledge-base/samples/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kb-samples'] }),
  });

  const bulkDeleteMut = useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch(token, '/knowledge-base/samples/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kb-samples'] });
      setSelected(new Set());
    },
  });

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const visibleIds = filtered.map((s: any) => s.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id: string) => selected.has(id));
  const someSelected = visibleIds.some((id: string) => selected.has(id));
  const toggleSelectAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(visibleIds));
  };
  const siteLabel = (key: string | null | undefined) => {
    if (!key) return null;
    const m = sites.find((s) => s.key === key);
    return m ? m.label : key;
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none"
          value={agentFilter}
          onChange={e => setAgentFilter(e.target.value)}
        >
          <option value="">All agents</option>
          {KB_AGENTS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select
          className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none"
          value={polarityFilter}
          onChange={e => setPolarityFilter(e.target.value)}
        >
          <option value="">All polarities</option>
          <option value="positive">✓ Positive</option>
          <option value="negative">✗ Negative</option>
        </select>
        {agentFilter === 'livechat' && sites.length > 0 && (
          <select
            className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none"
            value={siteFilter}
            onChange={e => setSiteFilter(e.target.value)}
          >
            <option value="">All sites</option>
            {sites.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        )}
        <button
          onClick={() => setModal('add')}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded-lg hover:opacity-90"
        >
          <Plus className="w-3.5 h-3.5" /> Add Sample
        </button>
      </div>

      {someSelected && (
        <div className="mb-3 flex items-center gap-3 bg-card border border-border rounded-lg px-3 py-2">
          <span className="text-xs text-muted-foreground">{selected.size} selected</span>
          <button onClick={() => setSelected(new Set())} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
          <button
            onClick={() => {
              if (confirm(`Delete ${selected.size} samples? This cannot be undone.`)) {
                bulkDeleteMut.mutate(Array.from(selected));
              }
            }}
            disabled={bulkDeleteMut.isPending}
            className="ml-auto flex items-center gap-1.5 px-3 py-1 text-xs bg-red-500/15 text-red-500 rounded-md hover:bg-red-500/25 disabled:opacity-50"
          >
            <Trash2 className="w-3 h-3" /> Delete selected
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-muted/50 rounded-lg animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">No writing samples yet.</div>
      ) : (
        <div className="space-y-2">
          {visibleIds.length > 0 && (
            <label className="flex items-center gap-2 px-2 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                className="accent-primary"
              />
              Select all on this page
            </label>
          )}
          {filtered.map((s: any) => (
            <div key={s.id} className="bg-card border border-border rounded-lg px-4 py-3 flex items-start gap-3">
              <input
                type="checkbox"
                checked={selected.has(s.id)}
                onChange={() => toggleSelected(s.id)}
                className="accent-primary mt-1 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{s.context}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${s.polarity === 'positive' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                    {s.polarity === 'positive' ? '✓' : '✗'} {s.polarity}
                  </span>
                  <AgentPills csv={s.agentKeys} fallback="all agents" />
                  <SiteScopeBadge siteKeys={s.siteKeys} excludedSiteKeys={s.excludedSiteKeys} siteLabel={siteLabel} />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{s.sampleText}</p>
              </div>
              <button onClick={() => setModal(s)} className="text-muted-foreground hover:text-foreground p-1">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => deleteMut.mutate(s.id)} className="text-muted-foreground hover:text-destructive p-1">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <SampleModal
          sample={modal === 'add' ? undefined : modal}
          onClose={() => setModal(null)}
          token={token}
          onSave={(data) => {
            if (modal === 'add') createMut.mutate(data);
            else updateMut.mutate({ id: modal.id, ...data });
          }}
        />
      )}
    </div>
  );
}

// ─── Tab 3: Import ─────────────────────────────────────────────────────────

function ImportTab({ token }: { token: string }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importType, setImportType] = useState<'document' | 'url'>('document');

  const [files, setFiles] = useState<File[]>([]);
  const [fileAgentKeys, setFileAgentKeys] = useState('');
  const [fileCategory, setFileCategory] = useState('document');
  const [uploading, setUploading] = useState(false);
  const [fileResults, setFileResults] = useState<Record<string, { ok: boolean; chunks?: number; title?: string; error?: string }>>({});
  const [activeFileName, setActiveFileName] = useState<string | null>(null);

  function addFiles(picked: File[]) {
    if (!picked.length) return;
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => `${f.name}:${f.size}`));
      const next = [...prev];
      for (const f of picked) {
        const key = `${f.name}:${f.size}`;
        if (!existing.has(key)) {
          next.push(f);
          existing.add(key);
        }
      }
      return next;
    });
    setFileResults({});
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function clearFiles() {
    setFiles([]);
    setFileResults({});
    setActiveFileName(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  const [url, setUrl] = useState('');
  const [linkAgentKeys, setLinkAgentKeys] = useState('');
  const [linkCategory, setLinkCategory] = useState('webpage');
  const [linking, setLinking] = useState(false);
  const [linkResult, setLinkResult] = useState<{ chunks: number; title?: string } | null>(null);
  const [linkError, setLinkError] = useState('');

  const { data: imports = [] } = useQuery<any[]>({
    queryKey: ['kb-imports'],
    queryFn: () => apiFetch(token, '/knowledge-base/entries?type=reference').then((rows: any[]) =>
      rows.filter(r => r.sourceType !== 'manual' && !r.parentDocId).slice(0, 10)
    ),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(token, `/knowledge-base/entries/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kb-imports', 'kb-entries'] }),
  });

  async function handleFileUpload() {
    if (!files.length) return;
    setUploading(true);
    setFileResults({});

    const localResults: Record<string, { ok: boolean; chunks?: number; title?: string; error?: string }> = {};
    for (const f of files) {
      setActiveFileName(f.name);
      try {
        const buf = await f.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
        const result = await apiFetch(token, '/knowledge-base/ingest/document', {
          method: 'POST',
          body: JSON.stringify({ filename: f.name, mimeType: f.type, data: base64, agentKeys: fileAgentKeys || undefined, category: fileCategory }),
        });
        localResults[f.name] = { ok: true, chunks: result.chunks, title: result.title };
        setFileResults((prev) => ({ ...prev, [f.name]: localResults[f.name] }));
      } catch (err: unknown) {
        localResults[f.name] = { ok: false, error: (err as Error).message ?? 'Upload failed' };
        setFileResults((prev) => ({ ...prev, [f.name]: localResults[f.name] }));
      }
    }

    setActiveFileName(null);
    qc.invalidateQueries({ queryKey: ['kb-imports', 'kb-entries'] });
    setUploading(false);

    // Reset form on success — drop successful files, keep failed ones for retry,
    // and clear the agent / category selection so the next batch starts clean.
    setFiles((prev) => prev.filter((f) => !localResults[f.name]?.ok));
    if (Object.values(localResults).every((r) => r.ok)) {
      setFileAgentKeys('');
      setFileCategory('document');
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleLinkImport() {
    if (!url.trim()) return;
    setLinking(true); setLinkError(''); setLinkResult(null);
    try {
      const result = await apiFetch(token, '/knowledge-base/ingest/link', {
        method: 'POST',
        body: JSON.stringify({ url: url.trim(), agentKeys: linkAgentKeys || undefined, category: linkCategory }),
      });
      setLinkResult(result);
      qc.invalidateQueries({ queryKey: ['kb-imports', 'kb-entries'] });
      setUrl('');
      setLinkAgentKeys('');
      setLinkCategory('webpage');
    } catch (err: any) {
      setLinkError(err.message ?? 'Import failed');
    } finally {
      setLinking(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Type selector */}
      <div className="bg-card border border-border rounded-xl p-1.5 flex gap-1">
        <button
          onClick={() => { setImportType('document'); setFileResults({}); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
            importType === 'document'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
          }`}
        >
          <FileText className="w-4 h-4" />
          Document
          <span className={`text-xs ${importType === 'document' ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
            .pdf, .docx, .md
          </span>
        </button>
        <button
          onClick={() => { setImportType('url'); setLinkResult(null); setLinkError(''); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
            importType === 'url'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
          }`}
        >
          <Globe className="w-4 h-4" />
          URL
          <span className={`text-xs ${importType === 'url' ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
            web page / article
          </span>
        </button>
      </div>

      {/* Document upload panel */}
      {importType === 'document' && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <div
            className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileRef.current?.click()}
            onDrop={e => { e.preventDefault(); addFiles(Array.from(e.dataTransfer.files)); }}
            onDragOver={e => e.preventDefault()}
          >
            <Upload className="w-7 h-7 mx-auto mb-2 text-muted-foreground" />
            {files.length > 0 ? (
              <div>
                <p className="text-sm font-medium">{files.length} file{files.length === 1 ? '' : 's'} selected</p>
                <p className="text-xs text-muted-foreground mt-0.5">Click or drop more to add</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Drag & drop or click to choose files</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, DOC, MD — multi-select, max 10MB each</p>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.doc,.md"
              multiple
              className="hidden"
              onChange={e => { addFiles(Array.from(e.target.files ?? [])); }}
            />
          </div>

          {files.length > 0 && (
            <div className="border border-border rounded-lg divide-y divide-border max-h-64 overflow-y-auto">
              {files.map((f, idx) => {
                const res = fileResults[f.name];
                const inProgress = uploading && activeFileName === f.name;
                return (
                  <div key={`${f.name}:${f.size}:${idx}`} className="flex items-center gap-2 px-3 py-2">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{f.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {(f.size / 1024).toFixed(0)} KB
                        {res?.ok && <span className="ml-2 text-green-400">✓ {res.chunks} chunks{res.title ? ` — ${res.title}` : ''}</span>}
                        {res && !res.ok && <span className="ml-2 text-destructive">✗ {res.error}</span>}
                        {inProgress && <span className="ml-2 text-primary">uploading…</span>}
                      </p>
                    </div>
                    {!uploading && (
                      <button
                        onClick={() => removeFile(idx)}
                        className="text-muted-foreground hover:text-destructive p-1"
                        title="Remove"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <AgentMultiSelect value={fileAgentKeys} onChange={setFileAgentKeys} placeholder="Agents (optional)" />
            <select className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none" value={fileCategory} onChange={e => setFileCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleFileUpload}
              disabled={!files.length || uploading}
              className="flex-1 py-2 bg-primary text-primary-foreground text-sm rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {uploading ? `Importing… (${Object.keys(fileResults).length}/${files.length})` : `Import ${files.length || ''} ${files.length === 1 ? 'document' : 'documents'}`.trim()}
            </button>
            {files.length > 0 && !uploading && (
              <button
                onClick={clearFiles}
                className="px-4 py-2 border border-border text-sm rounded-lg text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* URL import panel */}
      {importType === 'url' && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <input
            className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="https://yoursite.com/pricing"
            value={url}
            onChange={e => { setUrl(e.target.value); setLinkResult(null); setLinkError(''); }}
          />
          <div className="grid grid-cols-2 gap-3">
            <AgentMultiSelect value={linkAgentKeys} onChange={setLinkAgentKeys} placeholder="Agents (optional)" />
            <select className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none" value={linkCategory} onChange={e => setLinkCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {linkError && <p className="text-xs text-destructive">{linkError}</p>}
          {linkResult && <p className="text-xs text-green-400">✓ Imported "{linkResult.title}" — {linkResult.chunks} chunks</p>}
          <button
            onClick={handleLinkImport}
            disabled={!url.trim() || linking}
            className="w-full py-2 bg-primary text-primary-foreground text-sm rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {linking ? 'Fetching…' : 'Import URL'}
          </button>
        </div>
      )}

      {/* Recent imports */}
      {imports.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-3">Recent Imports</h3>
          <div className="space-y-2">
            {imports.map((entry: any) => (
              <div key={entry.id} className="bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-3">
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${sourceBadge(entry.sourceType)}`}>{entry.sourceType}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{entry.title}</p>
                  {entry.sourceUrl && <p className="text-xs text-muted-foreground truncate">{entry.sourceUrl}</p>}
                </div>
                <button onClick={() => deleteMut.mutate(entry.id)} className="text-muted-foreground hover:text-destructive p-1">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab 4: Prompt Templates ───────────────────────────────────────────────

function TemplatesTab({ token }: { token: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [addForm, setAddForm] = useState({ agent: KB_AGENTS[0], purpose: 'reply', system: '', userTemplate: '' });
  const [showAdd, setShowAdd] = useState(false);

  const composedKey = addForm.agent && addForm.purpose ? `${addForm.agent}.${addForm.purpose.trim()}` : '';

  const { data: templates = [], isLoading } = useQuery<any[]>({
    queryKey: ['kb-templates'],
    queryFn: () => apiFetch(token, '/knowledge-base/templates'),
  });

  const createMut = useMutation({
    mutationFn: (body: any) => apiFetch(token, '/knowledge-base/templates', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kb-templates'] }); setShowAdd(false); setAddForm({ agent: KB_AGENTS[0], purpose: 'reply', system: '', userTemplate: '' }); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...body }: any) => apiFetch(token, `/knowledge-base/templates/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kb-templates'] }); setEditing(null); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(token, `/knowledge-base/templates/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kb-templates'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Templates override agent system prompts. Key format: <code className="font-mono bg-muted px-1 rounded">agentKey.reply</code> e.g. <code className="font-mono bg-muted px-1 rounded">livechat.reply</code></p>
        <button onClick={() => setShowAdd(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded-lg hover:opacity-90">
          <Plus className="w-3.5 h-3.5" /> New Template
        </button>
      </div>

      {showAdd && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Agent</label>
              <select
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                value={addForm.agent}
                onChange={e => setAddForm(f => ({ ...f, agent: e.target.value }))}
              >
                {KB_AGENTS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Purpose</label>
              <input
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                placeholder="reply"
                value={addForm.purpose}
                onChange={e => setAddForm(f => ({ ...f, purpose: e.target.value }))}
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Key: <code className="font-mono bg-muted px-1 rounded">{composedKey || '<agent>.<purpose>'}</code>
          </p>
          <textarea className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none resize-none" rows={6} placeholder="System prompt..." value={addForm.system} onChange={e => setAddForm(f => ({ ...f, system: e.target.value }))} />
          <p className="text-xs text-muted-foreground">{addForm.system.length} chars</p>
          <textarea className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none resize-none" rows={3} placeholder="User template (optional)..." value={addForm.userTemplate} onChange={e => setAddForm(f => ({ ...f, userTemplate: e.target.value }))} />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-sm text-muted-foreground border border-border rounded-lg">Cancel</button>
            <button
              onClick={() => createMut.mutate({ key: composedKey, system: addForm.system, userTemplate: addForm.userTemplate })}
              disabled={!composedKey || !addForm.purpose.trim() || !addForm.system}
              className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />)}</div>
      ) : templates.length === 0 ? (
        !showAdd && <div className="text-center py-12 text-muted-foreground text-sm">No templates yet. Agents use their hardcoded prompts.</div>
      ) : (
        templates.map((t: any) => (
          <div key={t.id} className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <Code className="w-4 h-4 text-primary" />
              <span className="text-sm font-mono font-medium">{t.key}</span>
              {(() => {
                const agentPrefix = typeof t.key === 'string' && t.key.includes('.') ? t.key.split('.')[0] : '';
                return agentPrefix ? <AgentPills csv={agentPrefix} /> : null;
              })()}
              <span className="text-xs text-muted-foreground ml-auto">v{t.version}</span>
              <button onClick={() => setEditing(editing?.id === t.id ? null : t)} className="text-muted-foreground hover:text-foreground p-1">
                {editing?.id === t.id ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => deleteMut.mutate(t.id)} className="text-muted-foreground hover:text-destructive p-1">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            {editing?.id === t.id && (
              <div className="p-4 space-y-3">
                <textarea
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none resize-none"
                  rows={8}
                  value={editing.system}
                  onChange={e => setEditing((ed: any) => ({ ...ed, system: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">{editing.system?.length ?? 0} chars</p>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setEditing(null)} className="px-3 py-1.5 text-sm text-muted-foreground border border-border rounded-lg">Cancel</button>
                  <button onClick={() => updateMut.mutate({ id: t.id, system: editing.system, userTemplate: editing.userTemplate })} className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg">Save</button>
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ─── Tab 5: Proposals ─────────────────────────────────────────────────────────

function ProposalsTab({ token }: { token: string }) {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  const { data: proposals = [], isLoading } = useQuery<any[]>({
    queryKey: ['kb-proposals', statusFilter],
    queryFn: () => apiFetch(token, `/knowledge-base/proposals${statusFilter !== 'all' ? `?status=${statusFilter}` : ''}`),
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => apiFetch(token, `/knowledge-base/proposals/${id}/approve`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kb-proposals'] }),
  });

  const rejectMut = useMutation({
    mutationFn: (id: string) => apiFetch(token, `/knowledge-base/proposals/${id}/reject`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kb-proposals'] }),
  });

  const STATUS_BADGE: Record<string, string> = {
    pending: 'bg-amber-500/15 text-amber-400',
    approved: 'bg-green-500/15 text-green-400',
    rejected: 'bg-muted text-muted-foreground',
  };

  const TYPE_BADGE: Record<string, string> = {
    fact: 'bg-amber-500/15 text-amber-400',
    blocklist: 'bg-red-500/15 text-red-400',
    writing_sample: 'bg-blue-500/15 text-blue-400',
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          When you reject an agent action with a reason, the system proposes a KB entry to prevent the mistake in future. Review proposals here or via Telegram.
        </p>
        <div className="flex gap-1">
          {(['pending', 'approved', 'rejected', 'all'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 text-xs rounded-lg transition-colors capitalize ${
                statusFilter === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />)}</div>
      ) : proposals.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-sm text-muted-foreground">No {statusFilter !== 'all' ? statusFilter : ''} proposals.</p>
          <p className="text-xs text-muted-foreground mt-1">Reject an agent action with a reason to generate the first proposal.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {proposals.map((p: any) => (
            <div key={p.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${TYPE_BADGE[p.proposedEntryType] ?? 'bg-muted text-muted-foreground'}`}>
                      {p.proposedEntryType}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_BADGE[p.status] ?? ''}`}>
                      {p.status}
                    </span>
                    <span className="text-xs text-muted-foreground">agent: {p.agentKey}</span>
                    <span className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm font-medium mb-1">{p.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{p.content}</p>
                  {p.reasoning && (
                    <p className="text-xs text-muted-foreground/70 mt-1.5 italic">Why: {p.reasoning}</p>
                  )}
                </div>

                {p.status === 'pending' && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => approveMut.mutate(p.id)}
                      disabled={approveMut.isPending}
                      className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
                    >
                      Add to KB
                    </button>
                    <button
                      onClick={() => rejectMut.mutate(p.id)}
                      disabled={rejectMut.isPending}
                      className="px-3 py-1.5 text-xs border border-border text-muted-foreground rounded-lg hover:text-foreground disabled:opacity-50"
                    >
                      Skip
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

const TABS = [
  { id: 'entries', label: 'Knowledge Entries' },
  { id: 'samples', label: 'Writing Samples' },
  { id: 'import', label: 'Import' },
  { id: 'templates', label: 'Prompt Templates' },
  { id: 'proposals', label: 'Proposals' },
];

export default function KnowledgeBasePage() {
  const token = useAuthStore(s => s.token)!;
  const [tab, setTab] = useState('entries');

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2.5 mb-6">
        <BookOpen className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold">Knowledge Base</h1>
        <p className="text-sm text-muted-foreground ml-1">Personalize agent outputs with facts, tone, and writing samples</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm transition-colors -mb-px border-b-2 ${
              tab === t.id
                ? 'border-primary text-foreground font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'entries' && <EntriesTab token={token} />}
      {tab === 'samples' && <SamplesTab token={token} />}
      {tab === 'import' && <ImportTab token={token} />}
      {tab === 'templates' && <TemplatesTab token={token} />}
      {tab === 'proposals' && <ProposalsTab token={token} />}
    </div>
  );
}
