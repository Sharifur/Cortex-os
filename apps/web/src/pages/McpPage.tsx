import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plug, ChevronDown, ChevronRight, Copy, Check, Wrench, Bot } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

interface McpTool {
  name: string;
  description: string;
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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button
      onClick={copy}
      className="text-muted-foreground hover:text-foreground transition-colors"
      title="Copy"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function AgentMcpCard({ entry }: { entry: AgentMcpEntry }) {
  const [expanded, setExpanded] = useState(false);
  const sseUrl = `${window.location.origin}/mcp/${entry.agentKey}/sse`;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div
        className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-accent/30 transition-colors select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Bot className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{entry.agentName}</span>
            <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {entry.agentKey}
            </code>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {entry.tools.length === 0
              ? 'No MCP tools declared'
              : `${entry.tools.length} tool${entry.tools.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {entry.tools.length > 0 && (
          expanded
            ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </div>

      {expanded && entry.tools.length > 0 && (
        <div className="border-t border-border">
          {/* SSE URL */}
          <div className="px-5 py-3 border-b border-border bg-muted/20">
            <p className="text-xs text-muted-foreground mb-1.5">MCP Server URL (SSE)</p>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono text-foreground/80 flex-1 truncate">{sseUrl}</code>
              <CopyButton text={`${sseUrl}?token=<jwt>`} />
            </div>
          </div>

          {/* Tool list */}
          <div className="divide-y divide-border">
            {entry.tools.map((tool) => (
              <div key={tool.name} className="px-5 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <Wrench className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <code className="text-xs font-mono font-medium">{tool.name}</code>
                </div>
                {tool.description && (
                  <p className="text-xs text-muted-foreground ml-5">{tool.description}</p>
                )}
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

export default function McpPage() {
  const token = useAuthStore((s) => s.token)!;

  const { data, isLoading, isError } = useQuery<McpOverview>({
    queryKey: ['mcp'],
    queryFn: async () => {
      const res = await fetch('/mcp', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const withTools = data?.agents.filter((a) => a.tools.length > 0) ?? [];
  const noTools = data?.agents.filter((a) => a.tools.length === 0) ?? [];

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Plug className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-semibold">MCP</h1>
        </div>
        {data && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`w-2 h-2 rounded-full ${data.activeConnections > 0 ? 'bg-green-500' : 'bg-muted-foreground'}`} />
            {data.activeConnections} active connection{data.activeConnections !== 1 ? 's' : ''}
          </div>
        )}
      </div>
      <p className="text-muted-foreground text-sm mb-6">
        MCP tools exposed by each agent. External clients (Claude Desktop, Cursor) connect via the SSE URL.
      </p>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {isError && <p className="text-sm text-destructive">Failed to load MCP overview.</p>}

      {data && withTools.length === 0 && noTools.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <Plug className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No agents registered yet.</p>
        </div>
      )}

      {withTools.length > 0 && (
        <div className="space-y-3 mb-6">
          {withTools.map((entry) => (
            <AgentMcpCard key={entry.agentKey} entry={entry} />
          ))}
        </div>
      )}

      {noTools.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">
            No tools declared
          </p>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="divide-y divide-border">
              {noTools.map((entry) => (
                <div key={entry.agentKey} className="flex items-center gap-3 px-5 py-3">
                  <Bot className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{entry.agentName}</span>
                  <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded ml-1">
                    {entry.agentKey}
                  </code>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
