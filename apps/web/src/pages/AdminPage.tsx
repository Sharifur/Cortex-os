import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck, Plus, Trash2, Pencil, X, Check, User, Mail, Lock,
  RefreshCw, AlertTriangle,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
}

const ROLE_STYLES: Record<string, string> = {
  super_admin:    'bg-violet-500/15 text-violet-300',
  agent_operator: 'bg-sky-500/15 text-sky-300',
};

const ROLE_LABELS: Record<string, string> = {
  super_admin:    'Super Admin',
  agent_operator: 'Agent Operator',
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

async function api<T>(token: string, path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts?.headers ?? {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as any;
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${ROLE_STYLES[role] ?? 'bg-slate-500/15 text-slate-400'}`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

function CreateUserModal({ token, onClose }: { token: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('agent_operator');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => api(token, '/auth/admin/users', {
      method: 'POST',
      body: JSON.stringify({ email, name: name.trim() || undefined, password, role }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Add User</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Name (optional)</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className="w-full pl-8 pr-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full pl-8 pr-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Set initial password"
                className="w-full pl-8 pr-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="agent_operator">Agent Operator</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => create.mutate()}
            disabled={create.isPending || !email || !password}
            className="px-4 py-2 text-xs rounded-lg bg-primary text-primary-foreground disabled:opacity-50 transition-colors"
          >
            {create.isPending ? 'Creating...' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  );
}

function UserRow({ u, token, currentUserId }: { u: AdminUser; token: string; currentUserId: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState(u.role);
  const [error, setError] = useState<string | null>(null);
  const isSelf = u.id === currentUserId;

  const update = useMutation({
    mutationFn: () => api(token, `/auth/admin/users/${u.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setEditing(false);
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const del = useMutation({
    mutationFn: () => api(token, `/auth/admin/users/${u.id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
    onError: (e: Error) => setError(e.message),
  });

  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-3.5 pl-4 pr-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">{u.name ?? '—'}</p>
            <p className="text-xs text-muted-foreground">{u.email}</p>
          </div>
          {isSelf && <span className="text-[10px] text-muted-foreground bg-accent/50 px-1.5 py-0.5 rounded">You</span>}
        </div>
      </td>
      <td className="py-3.5 px-3">
        {editing ? (
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="text-xs bg-background border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="agent_operator">Agent Operator</option>
            <option value="super_admin">Super Admin</option>
          </select>
        ) : (
          <RoleBadge role={u.role} />
        )}
        {error && <p className="text-[10px] text-red-400 mt-1">{error}</p>}
      </td>
      <td className="py-3.5 px-3 text-xs text-muted-foreground">{fmt(u.createdAt)}</td>
      <td className="py-3.5 pl-3 pr-4">
        <div className="flex items-center gap-1.5 justify-end">
          {editing ? (
            <>
              <button
                onClick={() => update.mutate()}
                disabled={update.isPending}
                className="p-1.5 rounded-md text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
                title="Save"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => { setEditing(false); setRole(u.role); setError(null); }}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                title="Cancel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                title="Change role"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              {!isSelf && (
                <button
                  onClick={() => { if (confirm(`Remove ${u.email}?`)) del.mutate(); }}
                  disabled={del.isPending}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  title="Remove user"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function AdminPage() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data: me } = useQuery<{ id: string; role: string }>({
    queryKey: ['auth-me'],
    queryFn: () => api(token, '/auth/me'),
    staleTime: 60_000,
  });

  const { data: users = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ['admin-users'],
    queryFn: () => api(token, '/auth/admin/users'),
    staleTime: 30_000,
  });

  const superAdminCount = users.filter((u) => u.role === 'super_admin').length;
  const operatorCount = users.filter((u) => u.role === 'agent_operator').length;

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
      {showCreate && <CreateUserModal token={token} onClose={() => setShowCreate(false)} />}

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Admin — User Management</h1>
            <p className="text-xs text-muted-foreground">Manage who can access Cortex OS and their permission level</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ['admin-users'] })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add User
          </button>
        </div>
      </div>

      {/* Role legend */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex items-center justify-between mb-1">
            <RoleBadge role="super_admin" />
            <span className="text-2xl font-bold text-violet-400">{superAdminCount}</span>
          </div>
          <p className="text-xs text-muted-foreground">Full access — settings, user management, all agent actions</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex items-center justify-between mb-1">
            <RoleBadge role="agent_operator" />
            <span className="text-2xl font-bold text-sky-400">{operatorCount}</span>
          </div>
          <p className="text-xs text-muted-foreground">Approvals, tickets, activity — no settings or user management</p>
        </div>
      </div>

      {/* Users table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">No users found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] text-muted-foreground uppercase tracking-wide">
                <th className="py-2.5 pl-4 pr-3 text-left font-medium">User</th>
                <th className="py-2.5 px-3 text-left font-medium">Role</th>
                <th className="py-2.5 px-3 text-left font-medium">Created</th>
                <th className="py-2.5 pl-3 pr-4 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <UserRow key={u.id} u={u} token={token} currentUserId={me?.id ?? ''} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-lg bg-muted/40 border border-border px-4 py-3 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Access boundaries</p>
        <p>Agent Operators can view dashboards, approve actions, manage tickets, and use live chat. They cannot access Settings, Admin, or trigger agents manually.</p>
        <p>At least one Super Admin must exist at all times. You cannot remove or demote the last Super Admin.</p>
      </div>
    </div>
  );
}
