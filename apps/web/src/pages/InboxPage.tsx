import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Mail } from 'lucide-react';

interface InboxRow {
  id: string;
  purpose: string;
  workspaceUuid: string | null;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  error: string | null;
  replyCount: number;
  lastReplyAt: string | null;
  lastSyncedAt: string | null;
  sentAt: string;
}

interface InboxReply {
  id: string;
  fromAddress: string;
  snippet: string | null;
  body: string | null;
  receivedAt: string;
}

async function api<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export default function InboxPage() {
  const token = useAuthStore((s) => s.token) ?? '';
  const qc = useQueryClient();
  const [purpose, setPurpose] = useState<string>('');
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['inbox', purpose],
    queryFn: () => {
      const qs = purpose ? `?purpose=${encodeURIComponent(purpose)}` : '';
      return api<InboxRow[]>(token, `/taskip-internal/inbox${qs}`);
    },
  });

  const detailQuery = useQuery({
    queryKey: ['inbox-detail', openId],
    queryFn: () => api<{ email: InboxRow; replies: InboxReply[] }>(token, `/taskip-internal/inbox/${openId}`),
    enabled: !!openId,
  });

  const syncMutation = useMutation({
    mutationFn: (id: string) => api(token, `/taskip-internal/inbox/${id}/sync`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox'] });
      qc.invalidateQueries({ queryKey: ['inbox-detail', openId] });
    },
  });

  const rows = data ?? [];
  const repliedCount = rows.filter((r) => r.replyCount > 0).length;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
          <Mail className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Inbox</h1>
          <p className="text-xs text-muted-foreground">
            Outbound Gmail emails sent by agents (marketing, follow-up, offer) with replies pulled from the same thread.
            Auto-synced every 10 minutes for emails sent in the last 14 days.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-6 mb-6">
        <Stat label="Total sent" value={rows.length.toString()} />
        <Stat label="With replies" value={repliedCount.toString()} accent="emerald" />
        <Stat label="Failed" value={rows.filter((r) => r.status === 'failed').length.toString()} accent="rose" />
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            {(['', 'marketing', 'followup', 'offer', 'other'] as const).map((p) => (
              <button
                key={p || 'all'}
                onClick={() => setPurpose(p)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  purpose === p
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
                }`}
              >
                {p ? p.charAt(0).toUpperCase() + p.slice(1) : 'All'}
              </button>
            ))}
          </div>
        </div>

        {isLoading && <p className="text-xs text-muted-foreground p-6">Loading…</p>}
        {!isLoading && rows.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-sm text-muted-foreground">No emails sent yet.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">When the Taskip Internal agent sends an email, it will appear here.</p>
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
                  <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold ${
                    r.status === 'failed' ? 'bg-rose-500/10 text-rose-400'
                      : r.replyCount > 0 ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-slate-500/10 text-slate-300'
                  }`}>{r.purpose}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.subject}</p>
                    <p className="text-xs text-muted-foreground truncate">to {r.recipient}{r.workspaceUuid && <> · workspace <code className="bg-muted px-1 rounded">{r.workspaceUuid}</code></>}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground shrink-0">
                    <div>{new Date(r.sentAt).toLocaleString()}</div>
                    <div className="mt-0.5">
                      {r.replyCount > 0 ? (
                        <span className="text-emerald-400">{r.replyCount} repl{r.replyCount === 1 ? 'y' : 'ies'}</span>
                      ) : r.status === 'failed' ? (
                        <span className="text-rose-400">failed</span>
                      ) : (
                        <span>no replies</span>
                      )}
                    </div>
                  </div>
                </div>
              </button>

              {openId === r.id && (
                <div className="px-4 pb-4">
                  <div className="rounded-lg border border-border bg-muted/10 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Button size="sm" onClick={() => syncMutation.mutate(r.id)} disabled={syncMutation.isPending}>
                        {syncMutation.isPending ? 'Syncing…' : 'Sync replies now'}
                      </Button>
                      {r.lastSyncedAt && (
                        <span className="text-[11px] text-muted-foreground">last synced {new Date(r.lastSyncedAt).toLocaleString()}</span>
                      )}
                    </div>

                    {r.status === 'failed' && r.error && (
                      <p className="text-xs text-destructive mb-3">{r.error}</p>
                    )}

                    <pre className="text-xs whitespace-pre-wrap font-mono bg-background/60 rounded-md p-3 mb-4">{r.body}</pre>

                    {detailQuery.data && detailQuery.data.email.id === r.id && detailQuery.data.replies.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground">Replies ({detailQuery.data.replies.length})</p>
                        {detailQuery.data.replies.map((reply) => (
                          <div key={reply.id} className="rounded-md border border-border bg-background/60 p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium">{reply.fromAddress}</span>
                              <span className="text-[11px] text-muted-foreground">{new Date(reply.receivedAt).toLocaleString()}</span>
                            </div>
                            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{reply.body || reply.snippet}</p>
                          </div>
                        ))}
                      </div>
                    )}
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

function Stat({ label, value, accent }: { label: string; value: string; accent?: 'emerald' | 'rose' }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${
        accent === 'emerald' ? 'text-emerald-400'
          : accent === 'rose' ? 'text-rose-400'
          : 'text-foreground'
      }`}>{value}</p>
    </div>
  );
}
