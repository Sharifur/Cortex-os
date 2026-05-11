import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Plus, ShieldOff } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Skeleton } from '@/components/ui/skeleton';

interface Suppression {
  id: string;
  email: string;
  reason: string;
  source: string;
  createdAt: string;
}

function reasonLabel(reason: string) {
  if (reason === 'hard_bounce') return 'Hard bounce';
  if (reason === 'complaint') return 'Spam complaint';
  if (reason === 'manual') return 'Manual';
  return reason;
}

function reasonBadgeClass(reason: string) {
  if (reason === 'hard_bounce') return 'bg-red-500/15 text-red-400';
  if (reason === 'complaint') return 'bg-orange-500/15 text-orange-400';
  return 'bg-muted text-muted-foreground';
}

export default function EmailSuppressionsPage() {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  const [newEmail, setNewEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const { data, isLoading } = useQuery<Suppression[]>({
    queryKey: ['email-suppressions'],
    queryFn: async () => {
      const res = await fetch('/ses/suppressions', { headers });
      if (!res.ok) throw new Error('Failed to load');
      return res.json();
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/ses/suppressions/${id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error('Failed to remove');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-suppressions'] }),
  });

  const addMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await fetch('/ses/suppressions', {
        method: 'POST',
        headers,
        body: JSON.stringify({ email, reason: 'manual' }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'Failed to add');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-suppressions'] });
      setNewEmail('');
      setAdding(false);
      setAddError('');
    },
    onError: (err: Error) => setAddError(err.message),
  });

  const handleAdd = () => {
    setAddError('');
    if (!newEmail.trim()) return;
    addMutation.mutate(newEmail.trim());
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldOff className="w-5 h-5 text-muted-foreground" />
          <div>
            <h1 className="text-lg font-semibold">Email Suppressions</h1>
            <p className="text-sm text-muted-foreground">
              Addresses blocked from receiving emails — hard bounces, spam complaints, and manual entries.
            </p>
          </div>
        </div>
        <button
          onClick={() => { setAdding((v) => !v); setAddError(''); }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>

      {adding && (
        <div className="border border-border rounded-lg p-4 space-y-3 bg-card">
          <p className="text-sm font-medium">Manually suppress an address</p>
          <div className="flex gap-2">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="email@example.com"
              className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
            <button
              onClick={handleAdd}
              disabled={addMutation.isPending}
              className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {addMutation.isPending ? 'Adding…' : 'Suppress'}
            </button>
          </div>
          {addError && <p className="text-xs text-destructive">{addError}</p>}
        </div>
      )}

      <div className="border border-border rounded-lg overflow-hidden">
        {isLoading ? (
          <div>
            <div className="border-b border-border bg-muted/40 grid grid-cols-[1fr_120px_100px_120px_40px] gap-4 px-4 py-2.5">
              {['Email', 'Reason', 'Source', 'Date', ''].map((h, i) => (
                <Skeleton key={i} className={`h-3 ${i === 4 ? 'w-4' : 'w-16'}`} />
              ))}
            </div>
            {[0, 1, 2, 3].map(i => (
              <div key={i} className={`grid grid-cols-[1fr_120px_100px_120px_40px] gap-4 px-4 py-3 border-b border-border last:border-0 ${i % 2 !== 0 ? 'bg-muted/20' : ''}`}>
                <Skeleton className="h-3 w-48" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-4 rounded" />
              </div>
            ))}
          </div>
        ) : !data?.length ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No suppressed addresses yet. Hard bounces and spam complaints are added automatically.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Email</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Reason</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Source</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={row.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-muted/20'}`}>
                  <td className="px-4 py-2.5 font-mono text-xs">{row.email}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${reasonBadgeClass(row.reason)}`}>
                      {reasonLabel(row.reason)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground capitalize">{row.source}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {new Date(row.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => removeMutation.mutate(row.id)}
                      disabled={removeMutation.isPending}
                      className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Remove suppression"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {data?.length ?? 0} suppressed address{data?.length === 1 ? '' : 'es'}.
        Removing an address allows future emails to be sent to it again.
      </p>
    </div>
  );
}
