import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bug } from 'lucide-react';

interface RequestLogRow {
  id: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number | null;
  requestId: string | null;
  userId: string | null;
  ip: string | null;
  userAgent: string | null;
  queryString: string | null;
  requestBody: string | null;
  responseBody: string | null;
  errorMessage: string | null;
  errorStack: string | null;
  createdAt: string;
}

async function api<T>(token: string, path: string): Promise<T> {
  const res = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export default function DebugLogsPage() {
  const token = useAuthStore((s) => s.token) ?? '';
  const [q, setQ] = useState('');
  const [minStatus, setMinStatus] = useState<string>('500');
  const [openId, setOpenId] = useState<string | null>(null);

  const stats = useQuery({
    queryKey: ['debug-logs-stats'],
    queryFn: () => api<{ total: number; errors: number; last_hour: number }>(token, '/debug-logs/stats'),
    refetchInterval: 15_000,
  });

  const list = useQuery({
    queryKey: ['debug-logs', minStatus, q],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (minStatus) qs.set('minStatus', minStatus);
      if (q) qs.set('q', q);
      qs.set('limit', '200');
      return api<RequestLogRow[]>(token, `/debug-logs?${qs}`);
    },
    refetchInterval: 15_000,
  });

  const detail = useQuery({
    queryKey: ['debug-log', openId],
    queryFn: () => api<RequestLogRow>(token, `/debug-logs/${openId}`),
    enabled: !!openId,
  });

  const rows = list.data ?? [];

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-1">
        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center">
          <Bug className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Debug Logs</h1>
          <p className="text-xs text-muted-foreground">Captured request / response details for any 4xx or 5xx response. Successful requests are not logged here.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-6 mb-6">
        <Stat label="Total errors recorded" value={stats.data?.total?.toString() ?? '–'} />
        <Stat label="5xx (server errors)" value={stats.data?.errors?.toString() ?? '–'} accent="rose" />
        <Stat label="Last hour" value={stats.data?.last_hour?.toString() ?? '–'} accent="amber" />
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center gap-2 p-4 border-b border-border">
          <select
            value={minStatus}
            onChange={(e) => setMinStatus(e.target.value)}
            className="text-xs bg-muted/40 border border-border rounded-md px-2 py-1.5"
          >
            <option value="">All statuses</option>
            <option value="400">≥ 400 (any error)</option>
            <option value="500">≥ 500 (server errors)</option>
          </select>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search path / error message / body…"
            className="text-xs flex-1 min-w-[240px]"
          />
          <Button size="sm" variant="outline" onClick={() => list.refetch()}>Refresh</Button>
        </div>

        {list.isLoading && <p className="p-6 text-xs text-muted-foreground">Loading…</p>}
        {!list.isLoading && rows.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-sm text-muted-foreground">No errors recorded.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">All recent requests succeeded — or the filter is excluding them.</p>
          </div>
        )}

        <div className="divide-y divide-border">
          {rows.map((r) => (
            <div key={r.id}>
              <button
                onClick={() => setOpenId(r.id === openId ? null : r.id)}
                className="w-full text-left py-3 px-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`shrink-0 inline-flex items-center justify-center min-w-[3rem] text-[10px] font-bold rounded-md py-1 ${
                    r.statusCode >= 500 ? 'bg-rose-500/15 text-rose-400'
                      : r.statusCode >= 400 ? 'bg-amber-500/15 text-amber-400'
                      : 'bg-slate-500/15 text-slate-300'
                  }`}>{r.statusCode}</span>
                  <span className="shrink-0 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border border-border text-muted-foreground">{r.method}</span>
                  <code className="text-xs font-mono flex-1 truncate text-foreground">{r.path}</code>
                  <div className="text-right text-xs text-muted-foreground shrink-0">
                    <div>{new Date(r.createdAt).toLocaleString()}</div>
                    {typeof r.durationMs === 'number' && <div className="mt-0.5">{r.durationMs}ms</div>}
                  </div>
                </div>
                {r.errorMessage && (
                  <p className="text-xs text-rose-400 mt-1 ml-[3.5rem] truncate">{r.errorMessage}</p>
                )}
              </button>

              {openId === r.id && (
                <div className="px-4 pb-4">
                  <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-3">
                    <Section label="Request URL" value={`${r.method} ${r.path}${r.queryString ? '?' + r.queryString : ''}`} mono />
                    {r.requestBody && <Section label="Request payload" value={r.requestBody} mono pre />}
                    {(detail.data?.responseBody ?? r.responseBody) && (
                      <Section label="Response body" value={(detail.data?.responseBody ?? r.responseBody) ?? ''} mono pre />
                    )}
                    {r.errorMessage && <Section label="Error message" value={r.errorMessage} accent="rose" />}
                    {(detail.data?.errorStack ?? r.errorStack) && (
                      <Section label="Stack trace" value={(detail.data?.errorStack ?? r.errorStack) ?? ''} mono pre accent="rose" />
                    )}
                    <div className="grid grid-cols-3 gap-3 text-[11px] text-muted-foreground">
                      {r.requestId && <Meta label="Request ID" value={r.requestId} />}
                      {r.userId && <Meta label="User ID" value={r.userId} />}
                      {r.ip && <Meta label="IP" value={r.ip} />}
                      {r.userAgent && <Meta label="User-Agent" value={r.userAgent} />}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: 'rose' | 'amber' }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${
        accent === 'rose' ? 'text-rose-400'
          : accent === 'amber' ? 'text-amber-400'
          : 'text-foreground'
      }`}>{value}</p>
    </div>
  );
}

function Section({ label, value, mono, pre, accent }: { label: string; value: string; mono?: boolean; pre?: boolean; accent?: 'rose' }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      {pre ? (
        <pre className={`text-xs ${mono ? 'font-mono' : ''} ${accent === 'rose' ? 'text-rose-300' : 'text-foreground'} bg-background/60 rounded p-3 whitespace-pre-wrap break-words`}>{value}</pre>
      ) : (
        <p className={`text-xs ${mono ? 'font-mono' : ''} ${accent === 'rose' ? 'text-rose-300' : 'text-foreground'} break-all`}>{value}</p>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[10px] uppercase tracking-wider">{label}</span>
      <code className="block font-mono text-[11px] text-foreground/80 truncate">{value}</code>
    </div>
  );
}
