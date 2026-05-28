import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, XCircle, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/authStore';

interface TrialSequence {
  id: string;
  workspaceUuid: string;
  email: string;
  industry: string | null;
  step: number;
  status: 'active' | 'completed' | 'cancelled';
  gmailAccountId: string | null;
  sentAngles: string[];
  activatedAt: string;
  nextStepAt: string;
  lastStepAt: string | null;
  createdAt: string;
}

const TOTAL_STEPS = 7;

const STATUS_CLS: Record<string, string> = {
  active: 'text-blue-400 bg-blue-500/10',
  completed: 'text-green-400 bg-green-500/10',
  cancelled: 'text-muted-foreground bg-muted/40',
};

const ANGLE_LABELS: Record<string, string> = {
  welcome_first_win: 'Welcome',
  core_feature: 'Core Feature',
  team_collaboration: 'Team',
  checkin_questions: 'Check-in',
  advanced_unlock: 'Advanced',
  social_proof: 'Social Proof',
  upgrade_cta: 'Upgrade CTA',
};

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const abs = Math.abs(diff);
  const future = diff < 0;
  if (abs < 60_000) return future ? 'in a moment' : 'just now';
  if (abs < 3_600_000) return `${future ? 'in ' : ''}${Math.floor(abs / 60_000)}m${future ? '' : ' ago'}`;
  if (abs < 86_400_000) return `${future ? 'in ' : ''}${Math.floor(abs / 3_600_000)}h${future ? '' : ' ago'}`;
  const d = Math.floor(abs / 86_400_000);
  return `${future ? 'in ' : ''}${d}d${future ? '' : ' ago'}`;
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3.5 w-40 rounded" />
          <Skeleton className="h-5 w-16 rounded" />
        </div>
        <Skeleton className="h-3 w-64 rounded" />
      </div>
      <Skeleton className="h-8 w-16 rounded" />
    </div>
  );
}

function StepDots({ step, total, angles }: { step: number; total: number; angles: string[] }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }).map((_, i) => {
        const angle = angles[i];
        const label = angle ? (ANGLE_LABELS[angle] ?? angle) : null;
        const filled = i < step;
        return (
          <div
            key={i}
            title={label ?? `Step ${i + 1}`}
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              filled ? 'bg-primary' : 'bg-muted border border-border'
            }`}
          />
        );
      })}
    </div>
  );
}

export default function TrialSequencesPage() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();

  const { data: sequences, isLoading, isError, refetch } = useQuery<TrialSequence[]>({
    queryKey: ['trial-sequences'],
    queryFn: async () => {
      const res = await fetch('/taskip-trial/sequences', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/taskip-trial/sequences/${id}/cancel`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Cancel failed');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trial-sequences'] }),
  });

  const active = sequences?.filter(s => s.status === 'active') ?? [];
  const completed = sequences?.filter(s => s.status === 'completed') ?? [];
  const cancelled = sequences?.filter(s => s.status === 'cancelled') ?? [];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-semibold">Trial Sequences</h1>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>
      <p className="text-muted-foreground text-sm mb-6">
        7-day onboarding email sequences. Each step requires Telegram approval before sending.
      </p>

      {isLoading && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)}
          </div>
        </div>
      )}

      {isError && (
        <p className="text-sm text-destructive">Failed to load sequences.</p>
      )}

      {sequences && (
        <div className="space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Active', value: active.length, cls: 'text-blue-400' },
              { label: 'Completed', value: completed.length, cls: 'text-green-400' },
              { label: 'Cancelled', value: cancelled.length, cls: 'text-muted-foreground' },
            ].map(stat => (
              <div key={stat.label} className="rounded-xl border border-border bg-card px-5 py-4">
                <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                <p className={`text-2xl font-semibold ${stat.cls}`}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Active sequences */}
          {active.length > 0 && (
            <Section title="Active" icon={<Clock className="w-4 h-4 text-blue-400" />}>
              {active.map(seq => (
                <SequenceRow
                  key={seq.id}
                  seq={seq}
                  onCancel={() => cancelMutation.mutate(seq.id)}
                  cancelling={cancelMutation.isPending && cancelMutation.variables === seq.id}
                />
              ))}
            </Section>
          )}

          {/* Completed sequences */}
          {completed.length > 0 && (
            <Section title="Completed" icon={<CheckCircle className="w-4 h-4 text-green-400" />}>
              {completed.map(seq => (
                <SequenceRow key={seq.id} seq={seq} />
              ))}
            </Section>
          )}

          {/* Cancelled sequences */}
          {cancelled.length > 0 && (
            <Section title="Cancelled" icon={<XCircle className="w-4 h-4 text-muted-foreground" />}>
              {cancelled.map(seq => (
                <SequenceRow key={seq.id} seq={seq} />
              ))}
            </Section>
          )}

          {sequences.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-10 text-center">
              <p className="text-sm text-muted-foreground">No sequences yet. Sequences are created when a trial is activated via webhook.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2 px-1">
        {icon}
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
        {children}
      </div>
    </div>
  );
}

function SequenceRow({
  seq,
  onCancel,
  cancelling,
}: {
  seq: TrialSequence;
  onCancel?: () => void;
  cancelling?: boolean;
}) {
  const angles = Array.isArray(seq.sentAngles) ? seq.sentAngles : [];
  const nextDue = new Date(seq.nextStepAt);
  const isOverdue = seq.status === 'active' && nextDue < new Date();

  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className="text-sm font-medium truncate">{seq.email}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_CLS[seq.status] ?? ''}`}>
            {seq.status}
          </span>
          {seq.industry && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">
              {seq.industry}
            </span>
          )}
          {seq.gmailAccountId && (
            <span className="text-xs text-muted-foreground font-mono truncate max-w-[120px]">
              via {seq.gmailAccountId.slice(0, 8)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <StepDots step={seq.step} total={TOTAL_STEPS} angles={angles} />
          <span className="text-xs text-muted-foreground">
            {seq.step}/{TOTAL_STEPS} sent
          </span>
          {angles.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {angles.map(a => ANGLE_LABELS[a] ?? a).join(', ')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
          <span>Activated {relTime(seq.activatedAt)}</span>
          {seq.status === 'active' && (
            <span className={isOverdue ? 'text-yellow-400' : ''}>
              Next: {isOverdue ? 'due now' : relTime(seq.nextStepAt)}
            </span>
          )}
          {seq.lastStepAt && (
            <span>Last sent {relTime(seq.lastStepAt)}</span>
          )}
        </div>
      </div>

      {onCancel && seq.status === 'active' && (
        <button
          onClick={onCancel}
          disabled={cancelling}
          className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors disabled:opacity-50"
        >
          {cancelling ? 'Cancelling...' : 'Cancel'}
        </button>
      )}
    </div>
  );
}
