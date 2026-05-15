import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { Bot, Play, ToggleLeft, ToggleRight, MessageSquare, Pin, PinOff, Trash2, Pencil, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/authStore';
import { agentColor } from '@/lib/agent-colors';

function AgentCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
        <div className="flex-1 min-w-0 space-y-1.5 pt-0.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3.5 w-20 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <div className="flex items-center gap-2 pt-1 mt-auto">
        <Skeleton className="h-7 w-16 rounded-lg" />
        <Skeleton className="h-7 w-14 rounded-lg" />
        <Skeleton className="h-6 w-6 rounded ml-auto" />
        <Skeleton className="h-6 w-6 rounded" />
      </div>
    </div>
  );
}

interface Agent {
  id: string;
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  pinned: boolean;
  registered: boolean;
  createdAt: string;
  updatedAt: string;
}

async function apiFetch(token: string, path: string, opts?: RequestInit) {
  const res = await fetch(path, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...opts?.headers },
  });
  if (!res.ok) throw new Error('Request failed');
  return res.json();
}

function AgentCard({ agent, token }: { agent: Agent; token: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const color = agentColor(agent.key);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  const nameMutation = useMutation({
    mutationFn: (name: string) =>
      apiFetch(token, `/agents/${agent.key}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] });
      setEditingName(false);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: () =>
      apiFetch(token, `/agents/${agent.key}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !agent.enabled }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
  });

  const pinMutation = useMutation({
    mutationFn: () =>
      apiFetch(token, `/agents/${agent.key}`, {
        method: 'PATCH',
        body: JSON.stringify({ pinned: !agent.pinned }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
  });

  const triggerMutation = useMutation({
    mutationFn: () =>
      apiFetch(token, `/agents/${agent.key}/trigger`, {
        method: 'POST',
        body: JSON.stringify({ triggerType: 'MANUAL' }),
      }),
    onSuccess: (run: { id: string }) => navigate(`/runs/${run.id}`),
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      apiFetch(token, `/agents/${agent.key}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
  });

  return (
    <div className={`rounded-xl border bg-card p-4 flex flex-col gap-3 transition-colors hover:bg-accent/20 ${agent.pinned ? `border-${color.iconText.replace('text-', '')}/40` : 'border-border'}`}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl ${color.iconBg} flex items-center justify-center shrink-0`}>
          <Bot className={`w-5 h-5 ${color.iconText}`} />
        </div>
        <div className="flex-1 min-w-0">
          {editingName ? (
            <form
              className="flex items-center gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = nameInput.trim();
                if (trimmed) nameMutation.mutate(trimmed);
              }}
            >
              <input
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setEditingName(false)}
                className="text-sm font-semibold bg-transparent border-b border-primary focus:outline-none w-full min-w-0"
              />
              <button
                type="submit"
                disabled={nameMutation.isPending || !nameInput.trim()}
                className="shrink-0 text-emerald-400 hover:text-emerald-300 disabled:opacity-40 transition-colors"
              >
                {nameMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setEditingName(false)}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <div className="group/name flex items-center gap-1.5">
              <button
                onClick={() => navigate(`/agents/${agent.key}`)}
                className="text-sm font-semibold hover:text-primary transition-colors text-left leading-snug line-clamp-1"
              >
                {agent.name}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setNameInput(agent.name); setEditingName(true); }}
                className="shrink-0 opacity-0 group-hover/name:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                title="Rename"
              >
                <Pencil className="w-3 h-3" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            <code className={`text-[10px] px-1.5 py-0.5 rounded ${color.badge} ${color.badgeText}`}>{agent.key}</code>
            {!agent.registered && (
              <span className="text-[10px] bg-yellow-500/10 text-yellow-500 px-1.5 py-0.5 rounded">unregistered</span>
            )}
            {!agent.enabled && (
              <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">disabled</span>
            )}
          </div>
        </div>
        <button
          onClick={() => pinMutation.mutate()}
          disabled={pinMutation.isPending}
          className={`shrink-0 transition-colors ${agent.pinned ? color.iconText : 'text-muted-foreground hover:text-foreground'}`}
          title={agent.pinned ? 'Unpin' : 'Pin to top'}
        >
          {agent.pinned ? <Pin className="w-3.5 h-3.5 fill-current" /> : <PinOff className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Description */}
      {agent.description ? (
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{agent.description}</p>
      ) : (
        <p className="text-xs text-muted-foreground/40 italic">No description.</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-auto pt-1">
        <Link
          to={`/agents/${agent.key}/chat`}
          className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${color.border} ${color.badgeText} hover:${color.iconBg}`}
        >
          <MessageSquare className="w-3 h-3" />
          Chat
        </Link>
        <Button
          size="sm"
          variant="outline"
          className="gap-1 text-xs h-7 px-2.5"
          onClick={() => triggerMutation.mutate()}
          disabled={!agent.enabled || !agent.registered || triggerMutation.isPending}
        >
          <Play className="w-3 h-3" />
          {triggerMutation.isPending ? 'Starting…' : 'Run'}
        </Button>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => toggleMutation.mutate()}
            disabled={toggleMutation.isPending}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title={agent.enabled ? 'Disable' : 'Enable'}
          >
            {agent.enabled
              ? <ToggleRight className={`w-5 h-5 ${color.iconText}`} />
              : <ToggleLeft className="w-5 h-5" />}
          </button>
          <button
            onClick={() => {
              if (!confirm(`Delete agent "${agent.name}"? This cannot be undone.`)) return;
              deleteMutation.mutate();
            }}
            disabled={deleteMutation.isPending}
            className="text-muted-foreground hover:text-destructive transition-colors"
            title="Delete agent"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AgentsPage() {
  const token = useAuthStore((s) => s.token)!;

  const { data, isLoading, isError } = useQuery<Agent[]>({
    queryKey: ['agents'],
    queryFn: () => apiFetch(token, '/agents'),
    refetchInterval: 15_000,
  });

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Bot className="w-5 h-5 text-primary" />
        <h1 className="text-2xl font-semibold">Agents</h1>
      </div>
      <p className="text-muted-foreground text-sm mb-6">
        Manage and manually trigger your AI agents.
      </p>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <AgentCardSkeleton key={i} />)}
        </div>
      )}
      {isError && <p className="text-sm text-destructive">Failed to load agents.</p>}

      {data && (
        data.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center">
            <Bot className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No agents registered yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...data]
              .sort((a, b) => {
                if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
                return a.name.localeCompare(b.name);
              })
              .map((agent) => (
                <AgentCard key={agent.key} agent={agent} token={token} />
              ))}
          </div>
        )
      )}
    </div>
  );
}
