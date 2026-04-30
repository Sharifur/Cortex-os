import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, BarChart3, Bot, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/authStore';

interface ModelRow {
  provider: string;
  model: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  costUsd: number;
}

interface AgentRow {
  agentKey: string | null;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  costUsd: number;
}

interface DailyRow {
  day: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

interface Totals {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  costUsd: number;
}

interface Summary {
  totals: Totals;
  byModel: ModelRow[];
  byAgent: AgentRow[];
  daily: DailyRow[];
}

interface PricingRow {
  provider: string;
  model: string;
  price: { inputPer1M: number; outputPer1M: number; cachedInputPer1M?: number };
}

const RANGES = [
  { label: '24h', hours: 24 },
  { label: '7 days', hours: 24 * 7 },
  { label: '30 days', hours: 24 * 30 },
  { label: 'All time', hours: 0 },
] as const;

function fmtUsd(n: number) {
  return `$${n.toFixed(n >= 1 ? 2 : 4)}`;
}

function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

async function api<T>(token: string, path: string): Promise<T> {
  const res = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Request failed');
  return res.json();
}

export default function LlmUsagePage() {
  const token = useAuthStore((s) => s.token)!;
  const [rangeIdx, setRangeIdx] = useState(0);
  const range = RANGES[rangeIdx];

  const summaryQuery = useQuery<Summary>({
    queryKey: ['llm-usage-summary', range.hours],
    queryFn: () => api(token, `/llm-usage/summary${range.hours ? `?hours=${range.hours}` : ''}`),
    refetchInterval: 30_000,
  });

  const pricingQuery = useQuery<PricingRow[]>({
    queryKey: ['llm-pricing'],
    queryFn: () => api(token, '/llm-usage/pricing'),
    staleTime: Infinity,
  });

  const totals = summaryQuery.data?.totals;
  const byModel = summaryQuery.data?.byModel ?? [];
  const byAgent = summaryQuery.data?.byAgent ?? [];
  const daily = summaryQuery.data?.daily ?? [];

  const peakDay = daily.reduce((m, d) => (d.costUsd > m ? d.costUsd : m), 0);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-semibold">LLM Usage</h1>
        </div>
        <Button size="sm" variant="outline" onClick={() => summaryQuery.refetch()} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>
      <p className="text-muted-foreground text-sm mb-6">
        Token spend per provider, model, and agent. Costs are computed from the static pricing table at <code className="bg-muted px-1 rounded">apps/api/src/modules/llm/pricing.ts</code>.
      </p>

      {/* Range selector */}
      <div className="flex items-center gap-1 border border-border rounded-lg p-1 mb-5 bg-muted/30 w-fit">
        {RANGES.map((r, i) => (
          <button
            key={r.label}
            onClick={() => setRangeIdx(i)}
            className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
              i === rangeIdx ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Cost" value={totals ? fmtUsd(totals.costUsd) : '—'} loading={summaryQuery.isLoading} />
        <StatCard label="Calls" value={totals ? totals.calls.toLocaleString() : '—'} loading={summaryQuery.isLoading} />
        <StatCard label="Input tokens" value={totals ? fmtTokens(totals.inputTokens) : '—'} loading={summaryQuery.isLoading} />
        <StatCard label="Output tokens" value={totals ? fmtTokens(totals.outputTokens) : '—'} loading={summaryQuery.isLoading} />
      </div>

      {/* By model */}
      <div className="rounded-xl border border-border bg-card overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-border flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">By model</h2>
          <span className="ml-auto text-xs text-muted-foreground">{byModel.length} model(s)</span>
        </div>
        {summaryQuery.isLoading && (
          <div className="p-5 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-6 w-full rounded" />)}</div>
        )}
        {!summaryQuery.isLoading && byModel.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">No LLM calls in this range yet.</div>
        )}
        {byModel.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left px-5 py-2 font-medium">Provider</th>
                <th className="text-left px-3 py-2 font-medium">Model</th>
                <th className="text-right px-3 py-2 font-medium">Calls</th>
                <th className="text-right px-3 py-2 font-medium">Input</th>
                <th className="text-right px-3 py-2 font-medium">Output</th>
                <th className="text-right px-5 py-2 font-medium">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {byModel.map((row) => (
                <tr key={`${row.provider}/${row.model}`} className="hover:bg-accent/20">
                  <td className="px-5 py-2 font-mono text-xs text-muted-foreground">{row.provider}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.model}</td>
                  <td className="px-3 py-2 text-right">{row.calls}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{fmtTokens(row.inputTokens)}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{fmtTokens(row.outputTokens)}</td>
                  <td className="px-5 py-2 text-right font-medium">{fmtUsd(row.costUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* By agent */}
      <div className="rounded-xl border border-border bg-card overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-border flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">By agent</h2>
          <span className="ml-auto text-xs text-muted-foreground">{byAgent.length} agent(s)</span>
        </div>
        {!summaryQuery.isLoading && byAgent.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">No agent-attributed calls yet.</div>
        )}
        {byAgent.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left px-5 py-2 font-medium">Agent</th>
                <th className="text-right px-3 py-2 font-medium">Calls</th>
                <th className="text-right px-3 py-2 font-medium">Input</th>
                <th className="text-right px-3 py-2 font-medium">Output</th>
                <th className="text-right px-5 py-2 font-medium">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {byAgent.map((row) => (
                <tr key={row.agentKey ?? 'unknown'} className="hover:bg-accent/20">
                  <td className="px-5 py-2 font-mono text-xs">{row.agentKey ?? <span className="text-muted-foreground">unattributed</span>}</td>
                  <td className="px-3 py-2 text-right">{row.calls}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{fmtTokens(row.inputTokens)}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{fmtTokens(row.outputTokens)}</td>
                  <td className="px-5 py-2 text-right font-medium">{fmtUsd(row.costUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Daily bars */}
      {daily.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 mb-6">
          <h2 className="text-sm font-semibold mb-3">Last 30 days</h2>
          <div className="flex items-end gap-1 h-32">
            {[...daily].reverse().map((d) => {
              const heightPct = peakDay > 0 ? Math.max(2, (d.costUsd / peakDay) * 100) : 2;
              return (
                <div key={d.day} title={`${d.day} • ${fmtUsd(d.costUsd)} • ${d.calls} calls`} className="flex-1 group relative">
                  <div
                    className="w-full rounded-t bg-primary/70 hover:bg-primary transition-colors"
                    style={{ height: `${heightPct}%` }}
                  />
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-foreground text-background text-[10px] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    {d.day} · {fmtUsd(d.costUsd)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>{daily[daily.length - 1]?.day}</span>
            <span>{daily[0]?.day}</span>
          </div>
        </div>
      )}

      {/* Pricing reference */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Pricing reference</h2>
          <p className="text-xs text-muted-foreground mt-0.5">USD per 1,000,000 tokens. Update <code className="bg-muted px-1 rounded">pricing.ts</code> when providers change rates.</p>
        </div>
        {pricingQuery.data && (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left px-5 py-2 font-medium">Provider</th>
                <th className="text-left px-3 py-2 font-medium">Model</th>
                <th className="text-right px-3 py-2 font-medium">Input</th>
                <th className="text-right px-3 py-2 font-medium">Output</th>
                <th className="text-right px-5 py-2 font-medium">Cached input</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pricingQuery.data.map((p) => (
                <tr key={`${p.provider}/${p.model}`} className="hover:bg-accent/20">
                  <td className="px-5 py-2 font-mono text-xs text-muted-foreground">{p.provider}</td>
                  <td className="px-3 py-2 font-mono text-xs">{p.model}</td>
                  <td className="px-3 py-2 text-right">${p.price.inputPer1M.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">${p.price.outputPer1M.toFixed(2)}</td>
                  <td className="px-5 py-2 text-right text-muted-foreground">{p.price.cachedInputPer1M ? `$${p.price.cachedInputPer1M.toFixed(3)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, loading }: { label: string; value: string; loading?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {loading ? <Skeleton className="h-7 w-20 rounded" /> : <p className="text-xl font-semibold">{value}</p>}
    </div>
  );
}
