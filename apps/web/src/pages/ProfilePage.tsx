import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { User, Save } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Profile {
  id: string;
  email: string;
  name: string | null;
  telegramChatId: string | null;
  createdAt: string;
}

interface SessionRow {
  id: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  revokedAt: string | null;
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
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error((d as { message?: string }).message ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export default function ProfilePage() {
  const token = useAuthStore((s) => s.token) ?? '';
  const qc = useQueryClient();

  const profileQ = useQuery<Profile>({
    queryKey: ['auth-me'],
    queryFn: () => api<Profile>(token, '/auth/me'),
  });

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState('');

  const updateProfile = useMutation({
    mutationFn: (body: { name?: string; email?: string }) =>
      api(token, '/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({
          email: body.email ?? profileQ.data?.email ?? '',
          name: body.name ?? profileQ.data?.name ?? undefined,
        }),
      }),
    onSuccess: () => {
      setEditingName(false);
      setEditingEmail(false);
      setNameInput('');
      setEmailInput('');
      qc.invalidateQueries({ queryKey: ['auth-me'] });
    },
  });

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <User className="w-5 h-5 text-primary" />
        <h1 className="text-2xl font-semibold">Profile</h1>
      </div>
      <p className="text-muted-foreground text-sm mb-8">Edit your name, email, and review active sessions.</p>

      <div className="rounded-xl border border-border bg-card mb-6">
        <div className="px-5 py-4 border-b border-border">
          <span className="text-sm font-semibold">Account</span>
        </div>

        {/* Name */}
        <div className="px-5 py-4 border-b border-border">
          <p className="text-sm font-medium mb-0.5">Display name</p>
          {profileQ.isLoading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : editingName ? (
            <div className="flex items-center gap-2 mt-2">
              <Input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Your name"
                className="text-sm max-w-xs"
                autoFocus
              />
              <Button size="sm" onClick={() => updateProfile.mutate({ name: nameInput.trim() })} disabled={updateProfile.isPending}>
                <Save className="w-3.5 h-3.5" />Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditingName(false); setNameInput(''); }}>Cancel</Button>
              {updateProfile.isError && <span className="text-xs text-destructive">{(updateProfile.error as Error).message}</span>}
            </div>
          ) : (
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-muted-foreground">{profileQ.data?.name ?? 'Not set'}</span>
              <Button size="sm" variant="outline" className="text-xs" onClick={() => { setNameInput(profileQ.data?.name ?? ''); setEditingName(true); }}>
                {profileQ.data?.name ? 'Update' : 'Set name'}
              </Button>
            </div>
          )}
        </div>

        {/* Email */}
        <div className="px-5 py-4 border-b border-border">
          <p className="text-sm font-medium mb-0.5">Login email</p>
          {profileQ.isLoading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : editingEmail ? (
            <div className="flex items-center gap-2 mt-2">
              <Input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="new@email.com"
                className="text-sm max-w-xs"
                autoFocus
              />
              <Button size="sm" onClick={() => updateProfile.mutate({ email: emailInput })} disabled={!emailInput || updateProfile.isPending}>
                <Save className="w-3.5 h-3.5" />Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditingEmail(false); setEmailInput(''); }}>Cancel</Button>
            </div>
          ) : (
            <div className="flex items-center gap-3 mt-1">
              <code className="text-xs bg-muted px-2 py-1 rounded font-mono text-muted-foreground">{profileQ.data?.email ?? '—'}</code>
              <Button size="sm" variant="outline" className="text-xs" onClick={() => { setEmailInput(profileQ.data?.email ?? ''); setEditingEmail(true); }}>Update</Button>
            </div>
          )}
        </div>

        {/* Telegram chat id (read-only) */}
        <div className="px-5 py-4">
          <p className="text-sm font-medium mb-0.5">Telegram chat ID</p>
          <p className={`text-xs mt-1 ${profileQ.data?.telegramChatId ? 'font-mono text-foreground/80' : 'text-muted-foreground'}`}>
            {profileQ.data?.telegramChatId ?? 'Not linked'}
          </p>
        </div>
      </div>

      <SessionsCard token={token} />
    </div>
  );
}

function SessionsCard({ token }: { token: string }) {
  const qc = useQueryClient();
  const sessionsQ = useQuery<SessionRow[]>({
    queryKey: ['auth-sessions'],
    queryFn: () => api<SessionRow[]>(token, '/auth/sessions'),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api(token, `/auth/sessions/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auth-sessions'] }),
  });

  const rows = sessionsQ.data ?? [];

  return (
    <div className="rounded-xl border border-border bg-card mb-6">
      <div className="px-5 py-4 border-b border-border">
        <p className="text-sm font-semibold">Active sessions</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Each successful login creates a session. Revoke any session you don't recognize.
        </p>
      </div>
      <div className="divide-y divide-border">
        {sessionsQ.isLoading && <p className="text-xs text-muted-foreground p-5">Loading…</p>}
        {!sessionsQ.isLoading && rows.length === 0 && (
          <p className="text-xs text-muted-foreground p-5">No sessions recorded yet.</p>
        )}
        {rows.map((s) => {
          const expired = new Date(s.expiresAt).getTime() < Date.now();
          const revoked = !!s.revokedAt;
          return (
            <div key={s.id} className="flex items-center gap-3 px-5 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono text-foreground/90">{s.ip ?? 'unknown ip'}</p>
                <p className="text-[11px] text-muted-foreground truncate">{s.userAgent ?? 'unknown ua'}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Created {new Date(s.createdAt).toLocaleString()} · Last used {new Date(s.lastUsedAt).toLocaleString()}
                </p>
              </div>
              <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold ${
                revoked ? 'bg-rose-500/15 text-rose-400'
                  : expired ? 'bg-slate-500/15 text-slate-400'
                  : 'bg-emerald-500/15 text-emerald-400'
              }`}>{revoked ? 'revoked' : expired ? 'expired' : 'active'}</span>
              {!revoked && !expired && (
                <Button size="sm" variant="outline" disabled={revoke.isPending} onClick={() => revoke.mutate(s.id)}>Revoke</Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
