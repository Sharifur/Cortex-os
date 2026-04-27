import { useQuery } from '@tanstack/react-query';
import { Activity, CheckCircle2, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/authStore';

type ServiceStatus = 'ok' | 'error' | 'not_configured';

interface ServiceCheck {
  status: ServiceStatus;
  message?: string;
}

interface HealthResponse {
  status: 'ok' | 'degraded';
  checks: Record<string, ServiceCheck>;
  uptime: number;
  timestamp: string;
}

const SERVICE_LABELS: Record<string, string> = {
  postgres: 'PostgreSQL',
  redis: 'Redis',
  minio: 'MinIO',
  llm: 'LLM Provider',
  telegram: 'Telegram Bot',
  ses: 'AWS SES',
  gmail: 'Gmail',
  whatsapp: 'WhatsApp',
  linkedin: 'LinkedIn',
  reddit: 'Reddit',
  crisp: 'Crisp',
};

const CORE_SERVICES = ['postgres', 'redis', 'minio'];
const INTEGRATION_SERVICES = ['llm', 'telegram', 'ses', 'gmail', 'whatsapp', 'linkedin', 'reddit', 'crisp'];

const FALLBACK_CHECK: ServiceCheck = { status: 'not_configured' };

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function StatusIcon({ status }: { status: ServiceStatus }) {
  if (status === 'ok') return <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />;
  if (status === 'error') return <XCircle className="w-4 h-4 text-red-400 shrink-0" />;
  return <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0" />;
}

function statusLabel(status: ServiceStatus) {
  if (status === 'ok') return <span className="text-xs font-medium text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">OK</span>;
  if (status === 'error') return <span className="text-xs font-medium text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">Error</span>;
  return <span className="text-xs font-medium text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded">Not configured</span>;
}

function ServiceRow({ name, check }: { name: string; check: ServiceCheck }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div className="flex items-center gap-2.5">
        <StatusIcon status={check.status} />
        <span className="text-sm font-medium">{SERVICE_LABELS[name] ?? name}</span>
        {check.message && (
          <span className="text-xs text-muted-foreground">{check.message}</span>
        )}
      </div>
      {statusLabel(check.status)}
    </div>
  );
}

function ServiceSkeleton() {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div className="flex items-center gap-2.5">
        <Skeleton className="w-4 h-4 rounded-full" />
        <Skeleton className="h-4 w-28 rounded" />
      </div>
      <Skeleton className="h-5 w-14 rounded" />
    </div>
  );
}

export default function HealthPage() {
  const token = useAuthStore((s) => s.token)!;

  const { data, isPending, isFetching, refetch, dataUpdatedAt } = useQuery<HealthResponse>({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await fetch('/health', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const loading = isPending && isFetching;

  const overallOk = data?.status === 'ok';
  const coreChecks = CORE_SERVICES.map((k) => ({ name: k, check: data?.checks[k] ?? FALLBACK_CHECK }));
  const integrationChecks = INTEGRATION_SERVICES.map((k) => ({ name: k, check: data?.checks[k] ?? FALLBACK_CHECK }));

  const lastChecked = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : null;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-semibold">Health</h1>
        </div>
        <div className="flex items-center gap-3">
          {lastChecked && (
            <span className="text-xs text-muted-foreground">Last checked: {lastChecked}</span>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>
      <p className="text-muted-foreground text-sm mb-6">
        Live status of platform infrastructure and integrations.
      </p>

      {!loading && data && (
        <div className={`rounded-xl border px-4 py-3 mb-6 flex items-center gap-3 ${
          overallOk ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'
        }`}>
          {overallOk
            ? <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
            : <XCircle className="w-5 h-5 text-red-400 shrink-0" />
          }
          <div>
            <p className={`text-sm font-semibold ${overallOk ? 'text-green-400' : 'text-red-400'}`}>
              {overallOk ? 'All systems operational' : 'Core service degraded'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Uptime: {formatUptime(data.uptime)} &middot; {new Date(data.timestamp).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-5">
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Core Infrastructure
          </h2>
          <div className="rounded-xl border border-border bg-card px-4">
            {loading
              ? CORE_SERVICES.map((k) => <ServiceSkeleton key={k} />)
              : coreChecks.map(({ name, check }) => (
                  <ServiceRow key={name} name={name} check={check} />
                ))
            }
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Integrations
          </h2>
          <div className="rounded-xl border border-border bg-card px-4">
            {loading
              ? INTEGRATION_SERVICES.map((k) => <ServiceSkeleton key={k} />)
              : integrationChecks.map(({ name, check }) => (
                  <ServiceRow key={name} name={name} check={check} />
                ))
            }
          </div>
        </section>
      </div>
    </div>
  );
}
