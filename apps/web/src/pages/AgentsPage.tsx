import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { Bot, Play, ToggleLeft, ToggleRight, MessageSquare, Pin, PinOff, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/authStore';
import { agentColor } from '@/lib/agent-colors';

function AgentRowSkeleton() {
  return (
    <div className="px-4 sm:px-5 py-3 sm:py-4">
      <div className="flex items-center gap-3">
        <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-4 w-20 rounded" />
          </div>
          <Skeleton className="h-3 w-48 rounded" />
        </div>
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <Skeleton className="h-7 w-20 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
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

function AgentRow({ agent, token }: { agent: Agent; token: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();

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

  const color = agentColor(agent.key);

  const chatLink = (
    <Link
      to={`/agents/${agent.key}/chat`}
      className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${color.border} ${color.badgeText} hover:${color.iconBg}`}
    >
      <MessageSquare className="w-3 h-3" />
      Chat
    </Link>
  );

  const runButton = (
    <Button
      size="sm"
      variant="outline"
      className="gap-1.5 text-xs"
      onClick={() => triggerMutation.mutate()}
      disabled={!agent.enabled || !agent.registered || triggerMutation.isPending}
    >
      <Play className="w-3 h-3" />
      {triggerMutation.isPending ? 'Starting…' : 'Run'}
    </Button>
  );

  const toggleButton = (
    <button
      onClick={() => toggleMutation.mutate()}
      disabled={toggleMutation.isPending}
      className="text-muted-foreground hover:text-foreground transition-colors"
      title={agent.enabled ? 'Disable' : 'Enable'}
    >
      {agent.enabled
        ? <ToggleRight className={`w-6 h-6 ${color.iconText}`} />
        : <ToggleLeft className="w-6 h-6" />}
    </button>
  );

  const pinButton = (
    <button
      onClick={() => pinMutation.mutate()}
      disabled={pinMutation.isPending}
      className={`text-muted-foreground hover:text-foreground transition-colors ${agent.pinned ? color.iconText : ''}`}
      title={agent.pinned ? 'Unpin' : 'Pin to top'}
    >
      {agent.pinned ? <Pin className="w-4 h-4 fill-current" /> : <PinOff className="w-4 h-4" />}
    </button>
  );

  const deleteButton = (
    <button
      onClick={() => {
        if (!confirm(`Delete agent "${agent.name}"? This cannot be undone.`)) return;
        deleteMutation.mutate();
      }}
      disabled={deleteMutation.isPending}
      className="text-muted-foreground hover:text-destructive transition-colors"
      title="Delete agent"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );

  return (
    <div className="hover:bg-accent/30 transition-colors">
      <div className="flex items-center gap-3 px-4 sm:px-5 py-3 sm:py-4">
        <div className={`w-8 h-8 rounded-lg ${color.iconBg} flex items-center justify-center shrink-0`}>
          <Bot className={`w-4 h-4 ${color.iconText}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <button
              onClick={() => navigate(`/agents/${agent.key}`)}
              className="text-sm font-medium hover:text-primary transition-colors"
            >
              {agent.name}
            </button>
            <code className={`text-xs px-1.5 py-0.5 rounded ${color.badge} ${color.badgeText}`}>{agent.key}</code>
            {!agent.registered && (
              <span className="text-xs bg-yellow-500/10 text-yellow-500 px-1.5 py-0.5 rounded">unregistered</span>
            )}
            {!agent.enabled && (
              <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">disabled</span>
            )}
          </div>
          {agent.description && (
            <p className="text-xs text-muted-foreground truncate">{agent.description}</p>
          )}
        </div>

        {/* Desktop action buttons */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          {pinButton}
          {chatLink}
          {runButton}
          {toggleButton}
          {deleteButton}
        </div>
      </div>

      {/* Mobile action buttons row */}
      <div className="flex sm:hidden items-center gap-2 px-4 pb-3 pl-[3.25rem] flex-wrap">
        {chatLink}
        {runButton}
        {toggleButton}
        {pinButton}
        {deleteButton}
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
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Bot className="w-5 h-5 text-primary" />
        <h1 className="text-2xl font-semibold">Agents</h1>
      </div>
      <p className="text-muted-foreground text-sm mb-6">
        Manage and manually trigger your AI agents.
      </p>

      {isLoading && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="divide-y divide-border">
            {Array.from({ length: 3 }).map((_, i) => <AgentRowSkeleton key={i} />)}
          </div>
        </div>
      )}
      {isError && <p className="text-sm text-destructive">Failed to load agents.</p>}

      {data && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {data.length === 0 ? (
            <div className="p-10 text-center">
              <Bot className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No agents registered yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {[...data]
                .sort((a, b) => {
                  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
                  return a.name.localeCompare(b.name);
                })
                .map((agent) => (
                  <AgentRow key={agent.key} agent={agent} token={token} />
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
