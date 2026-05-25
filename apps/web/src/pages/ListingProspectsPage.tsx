import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Globe,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Loader2,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Skeleton } from '@/components/ui/skeleton';

const STATUS_COLORS: Record<string, string> = {
  discovered: 'bg-muted text-muted-foreground',
  researched: 'bg-blue-500/10 text-blue-400',
  pending_approval: 'bg-yellow-500/10 text-yellow-400',
  emailed: 'bg-emerald-500/10 text-emerald-400',
  contacted: 'bg-teal-500/10 text-teal-400',
  linkedin_dm: 'bg-blue-600/10 text-blue-300',
  instagram_dm: 'bg-pink-500/10 text-pink-400',
  skipped: 'bg-red-500/10 text-red-400',
  listed: 'bg-purple-500/10 text-purple-400',
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
  submitUrl: string | null;
  status: string;
  qualityScore: number | null;
  openPageRank: string | null;
  outreachGoal: string;
  lastContactedAt: string | null;
}

interface ProspectsPage {
  data: Prospect[];
  total: number;
  page: number;
  pageSize: number;
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: '', label: 'All' },
  { value: 'discovered', label: 'Discovered' },
  { value: 'researched', label: 'Researched' },
  { value: 'pending_approval', label: 'Approval' },
  { value: 'emailed', label: 'Emailed' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'linkedin_dm', label: 'LinkedIn DM' },
  { value: 'instagram_dm', label: 'Instagram DM' },
  { value: 'skipped', label: 'Skipped' },
  { value: 'listed', label: 'Listed' },
];

export default function ListingProspectsPage() {
  const token = useAuthStore((s) => s.token) ?? '';
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const PAGE_SIZE = 25;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useQuery<ProspectsPage>({
    queryKey: ['listing-prospects', statusFilter, debouncedSearch, page],
    queryFn: async () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (statusFilter) qs.set('status', statusFilter);
      if (debouncedSearch) qs.set('search', debouncedSearch);
      const res = await fetch(`/listing-outreach/prospects?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    staleTime: 30_000,
  });

  const prospects = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function changeFilter(v: string) {
    setStatusFilter(v);
    setPage(1);
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/listing-outreach/prospects/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    qc.invalidateQueries({ queryKey: ['listing-prospects'] });
  }

  async function deleteProspect(id: string) {
    await fetch(`/listing-outreach/prospects/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setDeletingId(null);
    qc.invalidateQueries({ queryKey: ['listing-prospects'] });
  }

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Listing Prospects</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Outreach targets discovered by the Listing Outreach agent</p>
        </div>
        <button
          onClick={() => navigate('/agents/listing_outreach')}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          Agent settings
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search domain, email, product..."
          className="h-8 pl-3 pr-3 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring w-52"
        />
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s.value}
            onClick={() => changeFilter(s.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              statusFilter === s.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {s.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">{total} prospects</span>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : prospects.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground text-sm">
          {search || statusFilter ? 'No prospects match the current filters.' : 'No prospects yet. Trigger the Listing Outreach agent to start discovery.'}
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Site</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Product</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Score</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Contact</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Last contacted</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {prospects.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/listing-outreach/prospects/${p.id}`)}
                    className="hover:bg-muted/20 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium text-sm leading-tight">{p.siteName || p.domain}</div>
                        <a
                          href={p.siteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mt-0.5"
                        >
                          <Globe className="w-3 h-3" />
                          {p.domain}
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs">{p.productName || p.productDomain}</div>
                      <div className="text-xs text-muted-foreground capitalize">{p.outreachGoal}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-sm">{p.qualityScore ?? '—'}</div>
                      {p.openPageRank && (
                        <div className="text-xs text-muted-foreground">OPR {p.openPageRank}</div>
                      )}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {p.contactEmail ? (
                        <a href={`mailto:${p.contactEmail}`} className="text-xs text-primary hover:underline">{p.contactEmail}</a>
                      ) : p.submitUrl ? (
                        <a href={p.submitUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground">Submit form</a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                      {p.linkedinProfileUrl && (
                        <a href={p.linkedinProfileUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="block text-xs text-blue-400 hover:underline mt-0.5">LinkedIn</a>
                      )}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={p.status}
                        onChange={(e) => updateStatus(p.id, e.target.value)}
                        className={`text-xs px-2 py-0.5 rounded-full border-0 font-medium cursor-pointer ${STATUS_COLORS[p.status] ?? 'bg-muted text-muted-foreground'}`}
                      >
                        {['discovered', 'researched', 'pending_approval', 'emailed', 'contacted', 'linkedin_dm', 'instagram_dm', 'skipped', 'listed'].map((s) => (
                          <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {p.lastContactedAt ? new Date(p.lastContactedAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {deletingId === p.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => deleteProspect(p.id)} className="text-[10px] px-1.5 py-0.5 rounded bg-destructive text-destructive-foreground hover:bg-destructive/90">Del</button>
                          <button onClick={() => setDeletingId(null)} className="text-[10px] px-1.5 py-0.5 rounded border border-border hover:bg-muted">No</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeletingId(p.id)}
                          className="p-1 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
              </button>
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages} &middot; {total} total
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
