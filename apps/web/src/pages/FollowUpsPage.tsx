import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, CheckCircle2, Loader2, Star, X, Save, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/authStore';

interface CrispConv {
  id: string;
  sessionId: string;
  websiteId: string;
  visitorEmail: string | null;
  visitorNickname: string | null;
  lastMessage: string;
  status: string;
  receivedAt: string;
  contactId: string | null;
  followUp: boolean;
  followUpNote: string | null;
  followUpDueAt: string | null;
  followUpNotifiedAt: string | null;
  followUpResolvedAt: string | null;
}

async function api<T>(token: string, path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export default function FollowUpsPage() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  const [editing, setEditing] = useState<CrispConv | null>(null);

  const list = useQuery<CrispConv[]>({
    queryKey: ['crisp-followups'],
    queryFn: () => api<CrispConv[]>(token, '/crisp/conversations?followUp=true'),
    refetchInterval: 30_000,
  });

  const resolveMutation = useMutation({
    mutationFn: (sessionId: string) =>
      api(token, `/crisp/conversations/${sessionId}/follow-up`, {
        method: 'PATCH',
        body: JSON.stringify({ followUp: false }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crisp-followups'] }),
  });

  const rows = list.data ?? [];
  const now = Date.now();

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-1">
        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
          <BellRing className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Follow-ups</h1>
          <p className="text-xs text-muted-foreground">
            Crisp conversations flagged for follow-up. Telegram pings you when a due time passes.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden mt-6">
        {list.isLoading && <p className="p-6 text-xs text-muted-foreground">Loading…</p>}
        {!list.isLoading && rows.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-sm text-muted-foreground">No follow-ups flagged.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Open a Crisp conversation and click "Follow-up" to add one.
            </p>
          </div>
        )}

        <div className="divide-y divide-border">
          {rows.map((r) => {
            const due = r.followUpDueAt ? new Date(r.followUpDueAt) : null;
            const overdue = due && due.getTime() <= now;
            const visitor = r.visitorNickname || r.visitorEmail || r.sessionId.slice(-8);
            return (
              <div key={r.id} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <Star className={`w-4 h-4 shrink-0 mt-0.5 ${overdue ? 'text-rose-400' : 'text-amber-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{visitor}</span>
                      <span className="text-[10px] px-1.5 rounded bg-muted text-muted-foreground">{r.websiteId}</span>
                      {due && (
                        <span className={`text-[10px] px-1.5 rounded inline-flex items-center gap-1 ${overdue ? 'bg-rose-500/10 text-rose-300' : 'bg-amber-500/10 text-amber-300'}`}>
                          <Calendar className="w-3 h-3" />
                          {overdue ? 'Overdue · ' : 'Due '}{due.toLocaleString()}
                        </span>
                      )}
                      {r.followUpNotifiedAt && (
                        <span className="text-[10px] text-muted-foreground">notified · {new Date(r.followUpNotifiedAt).toLocaleString()}</span>
                      )}
                    </div>
                    {r.followUpNote && (
                      <p className="text-xs text-foreground/80 mt-1">{r.followUpNote}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      Last: "{r.lastMessage.slice(0, 200)}"
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(r)} className="text-xs">Edit</Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => resolveMutation.mutate(r.sessionId)}
                      disabled={resolveMutation.isPending}
                      className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                    >
                      {resolveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      Resolve
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {editing && (
        <FollowUpEditor
          conv={editing}
          onClose={() => setEditing(null)}
          onSave={async (patch) => {
            await api(token, `/crisp/conversations/${editing.sessionId}/follow-up`, {
              method: 'PATCH',
              body: JSON.stringify({ followUp: true, ...patch }),
            });
            qc.invalidateQueries({ queryKey: ['crisp-followups'] });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

export function FollowUpEditor({
  conv, onClose, onSave,
}: {
  conv: CrispConv;
  onClose: () => void;
  onSave: (patch: { note: string | null; dueAt: string | null }) => Promise<void>;
}) {
  const [note, setNote] = useState(conv.followUpNote ?? '');
  const initialDue = conv.followUpDueAt ? new Date(conv.followUpDueAt).toISOString().slice(0, 16) : '';
  const [dueAt, setDueAt] = useState(initialDue);
  const [saving, setSaving] = useState(false);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl w-[480px] max-w-[90vw] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <span className="text-sm font-semibold">Edit follow-up</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Visitor</p>
            <p className="text-sm">{conv.visitorNickname || conv.visitorEmail || conv.sessionId.slice(-8)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Note</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Why are we following up?"
              className="w-full text-sm bg-muted/40 border border-border rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Due (Telegram ping)</p>
            <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </div>
          <Button
            size="sm"
            onClick={async () => {
              setSaving(true);
              try {
                await onSave({
                  note: note || null,
                  dueAt: dueAt ? new Date(dueAt).toISOString() : null,
                });
              } finally { setSaving(false); }
            }}
            disabled={saving}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
