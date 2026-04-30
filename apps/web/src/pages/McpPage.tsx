import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plug, ChevronDown, ChevronRight, Copy, Check,
  Wrench, Bot, Plus, Trash2, ToggleLeft, ToggleRight,
  RefreshCw, Wifi, WifiOff, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/authStore';

function AgentMcpCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4">
        <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-4 w-20 rounded" />
          </div>
          <Skeleton className="h-3.5 w-16 rounded" />
        </div>
        <Skeleton className="w-4 h-4 rounded" />
      </div>
    </div>
  );
}

function ExternalServerSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-28 rounded" />
          <Skeleton className="h-3.5 w-52 rounded font-mono" />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Skeleton className="w-3.5 h-3.5 rounded" />
          <Skeleton className="w-6 h-6 rounded" />
          <Skeleton className="w-4 h-4 rounded" />
          <Skeleton className="w-4 h-4 rounded" />
        </div>
      </div>
    </div>
  );
}

function ToolsSkeleton() {
  return (
    <div className="border-t border-border divide-y divide-border">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="px-5 py-3 flex items-center gap-2">
          <Skeleton className="w-3.5 h-3.5 rounded shrink-0" />
          <Skeleton className="h-3.5 w-40 rounded" />
        </div>
      ))}
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface McpTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

interface AgentMcpEntry {
  agentKey: string;
  agentName: string;
  tools: McpTool[];
}

interface McpOverview {
  agents: AgentMcpEntry[];
  activeConnections: number;
}

interface ExternalServer {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  createdAt: string;
}

interface ServerToolsResult {
  connected: boolean;
  tools: McpTool[];
  error?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function apiFetch(token: string, path: string, opts?: RequestInit) {
  return fetch(path, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...opts?.headers,
    },
  }).then((r) => {
    if (!r.ok && r.status !== 204) throw new Error(`HTTP ${r.status}`);
    return r.status === 204 ? null : r.json();
  });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button onClick={copy} className="text-muted-foreground hover:text-foreground transition-colors" title="Copy">
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ── Inbound: agent tools exposed to external clients ─────────────────────────

function AgentMcpCard({ entry }: { entry: AgentMcpEntry }) {
  const [expanded, setExpanded] = useState(false);
  const apiOrigin = ((import.meta.env.VITE_API_URL ?? '') as string).replace(/\/$/, '') || window.location.origin;
  const sseUrl = `${apiOrigin}/mcp/${entry.agentKey}/sse`;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div
        className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-accent/30 transition-colors select-none"
        onClick={() => entry.tools.length > 0 && setExpanded((v) => !v)}
      >
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Bot className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{entry.agentName}</span>
            <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{entry.agentKey}</code>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {entry.tools.length === 0 ? 'No MCP tools' : `${entry.tools.length} tool${entry.tools.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {entry.tools.length > 0 && (
          expanded
            ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </div>

      {expanded && (
        <div className="border-t border-border">
          <div className="px-5 py-3 border-b border-border bg-muted/20 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-1">SSE endpoint</p>
              <code className="text-xs font-mono text-foreground/80 truncate block">{sseUrl}?token=&lt;jwt&gt;</code>
            </div>
            <CopyButton text={`${sseUrl}?token=<jwt>`} />
          </div>
          <div className="divide-y divide-border">
            {entry.tools.map((tool) => (
              <div key={tool.name} className="px-5 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <Wrench className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <code className="text-xs font-mono font-medium">{tool.name}</code>
                </div>
                {tool.description && <p className="text-xs text-muted-foreground ml-5">{tool.description}</p>}
                {tool.inputSchema && Object.keys(tool.inputSchema).length > 0 && (
                  <pre className="mt-2 ml-5 text-xs text-muted-foreground bg-muted/40 rounded px-3 py-2 overflow-x-auto">
                    {JSON.stringify(tool.inputSchema, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Outbound: external servers our agents connect to ─────────────────────────

function ExternalServerRow({
  server,
  token,
}: {
  server: ExternalServer;
  token: string;
}) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const { data: toolsData, isLoading: toolsLoading, refetch: testConnection } = useQuery<ServerToolsResult>({
    queryKey: ['mcp-server-tools', server.id],
    queryFn: () => apiFetch(token, `/mcp/servers/${server.id}/tools`),
    enabled: expanded,
    retry: false,
  });

  const toggleMutation = useMutation({
    mutationFn: () => apiFetch(token, `/mcp/servers/${server.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled: !server.enabled }),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mcp-servers'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiFetch(token, `/mcp/servers/${server.id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mcp-servers'] }),
  });

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4">
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => setExpanded((v) => !v)}
        >
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium">{server.name}</span>
            {!server.enabled && (
              <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">disabled</span>
            )}
          </div>
          <code className="text-xs text-muted-foreground font-mono truncate block">{server.url}</code>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => testConnection()}
            disabled={toolsLoading}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            title="Test connection"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${toolsLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => toggleMutation.mutate()}
            disabled={toggleMutation.isPending}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title={server.enabled ? 'Disable' : 'Enable'}
          >
            {server.enabled
              ? <ToggleRight className="w-6 h-6 text-primary" />
              : <ToggleLeft className="w-6 h-6" />}
          </button>
          <button
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            className="text-muted-foreground hover:text-destructive transition-colors"
            title="Remove"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={() => setExpanded((v) => !v)}>
            {expanded
              ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
              : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border">
          {toolsLoading && <ToolsSkeleton />}
          {toolsData && !toolsData.connected && (
            <div className="px-5 py-4 flex items-center gap-2 text-destructive">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <div>
                <p className="text-sm font-medium">Connection failed</p>
                {toolsData.error && <p className="text-xs text-muted-foreground mt-0.5">{toolsData.error}</p>}
              </div>
            </div>
          )}
          {toolsData?.connected && toolsData.tools.length === 0 && (
            <p className="px-5 py-4 text-sm text-muted-foreground">Connected — no tools found.</p>
          )}
          {toolsData?.connected && toolsData.tools.length > 0 && (
            <div className="divide-y divide-border">
              <div className="px-5 py-2.5 flex items-center gap-2">
                <Wifi className="w-3.5 h-3.5 text-green-500" />
                <span className="text-xs text-green-500">
                  Connected · {toolsData.tools.length} tool{toolsData.tools.length !== 1 ? 's' : ''}
                </span>
                <span className="ml-2 text-xs text-muted-foreground">
                  Use as: <code className="font-mono bg-muted px-1 rounded">"{server.name}"</code> in agent code
                </span>
              </div>
              {toolsData.tools.map((tool) => (
                <div key={tool.name} className="px-5 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Wrench className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <code className="text-xs font-mono font-medium">{tool.name}</code>
                  </div>
                  {tool.description && <p className="text-xs text-muted-foreground ml-5">{tool.description}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AddServerForm({ token, onDone }: { token: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');

  const mutation = useMutation({
    mutationFn: () => apiFetch(token, '/mcp/servers', {
      method: 'POST',
      body: JSON.stringify({ name, url }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mcp-servers'] });
      onDone();
    },
  });

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-sm font-medium mb-3">Add external MCP server</p>
      <div className="flex items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (e.g. github)"
          className="text-sm w-40 shrink-0"
        />
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="SSE URL (e.g. http://localhost:3001/sse)"
          className="text-sm flex-1"
          onKeyDown={(e) => e.key === 'Enter' && name && url && mutation.mutate()}
        />
        <Button
          size="sm"
          onClick={() => mutation.mutate()}
          disabled={!name || !url || mutation.isPending}
        >
          {mutation.isPending ? 'Adding…' : 'Add'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
      {mutation.isError && (
        <p className="text-xs text-destructive mt-2">Failed — name may already be taken.</p>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function McpPage() {
  const token = useAuthStore((s) => s.token)!;
  const [showAddForm, setShowAddForm] = useState(false);

  const { data: overview, isLoading: overviewLoading } = useQuery<McpOverview>({
    queryKey: ['mcp'],
    queryFn: () => apiFetch(token, '/mcp'),
  });

  const { data: externalServers = [], isLoading: serversLoading } = useQuery<ExternalServer[]>({
    queryKey: ['mcp-servers'],
    queryFn: () => apiFetch(token, '/mcp/servers'),
  });

  const withTools = overview?.agents.filter((a) => a.tools.length > 0) ?? [];
  const noTools = overview?.agents.filter((a) => a.tools.length === 0) ?? [];

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Plug className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-semibold">MCP</h1>
        </div>
        {overview && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`w-2 h-2 rounded-full ${overview.activeConnections > 0 ? 'bg-green-500' : 'bg-muted-foreground'}`} />
            {overview.activeConnections} active inbound connection{overview.activeConnections !== 1 ? 's' : ''}
          </div>
        )}
      </div>
      <p className="text-muted-foreground text-sm mb-8">
        Manage MCP tools your agents expose to external clients, and external servers your agents connect to.
      </p>

      {/* ── Inbound ── */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Inbound — tools exposed to external clients
        </h2>

        {overviewLoading && (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => <AgentMcpCardSkeleton key={i} />)}
          </div>
        )}

        {!overviewLoading && withTools.length === 0 && noTools.length === 0 && (
          <p className="text-sm text-muted-foreground">No agents registered yet.</p>
        )}

        <div className="space-y-3">
          {withTools.map((entry) => <AgentMcpCard key={entry.agentKey} entry={entry} />)}
        </div>

        {noTools.length > 0 && (
          <div className={`rounded-xl border border-border bg-card overflow-hidden ${withTools.length > 0 ? 'mt-3' : ''}`}>
            <div className="divide-y divide-border">
              {noTools.map((entry) => (
                <div key={entry.agentKey} className="flex items-center gap-3 px-5 py-3">
                  <WifiOff className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{entry.agentName}</span>
                  <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{entry.agentKey}</code>
                  <span className="text-xs text-muted-foreground ml-auto">no tools</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Outbound ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Outbound — external servers agents connect to
          </h2>
          {!showAddForm && (
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setShowAddForm(true)}>
              <Plus className="w-3.5 h-3.5" />
              Add server
            </Button>
          )}
        </div>

        {showAddForm && (
          <div className="mb-3">
            <AddServerForm token={token} onDone={() => setShowAddForm(false)} />
          </div>
        )}

        {serversLoading && (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => <ExternalServerSkeleton key={i} />)}
          </div>
        )}

        {!serversLoading && externalServers.length === 0 && !showAddForm && (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <Plug className="w-7 h-7 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-1">No external MCP servers configured.</p>
            <p className="text-xs text-muted-foreground">
              Agents reference servers by name:{' '}
              <code className="bg-muted px-1 rounded font-mono">mcpClient.callToolByName(key, "github", ...)</code>
            </p>
          </div>
        )}

        <div className="space-y-3">
          {externalServers.map((server) => (
            <ExternalServerRow key={server.id} server={server} token={token} />
          ))}
        </div>
      </div>
    </div>
  );
}
