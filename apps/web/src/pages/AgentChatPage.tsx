import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import {
  Bot, ArrowLeft, Send, Loader2, RefreshCw,
  Calendar, Clock, CheckCircle2, XCircle,
  AlertCircle, MessageSquare, ListTodo, RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/authStore';
import { agentColor } from '@/lib/agent-colors';

interface AgentInfo {
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  registered: boolean;
  triggers: { type: string; cron?: string }[];
}

interface ConvMessage {
  id: string;
  role: string;
  content: string;
  runId: string | null;
  requiresApproval: boolean;
  createdAt: string;
}

interface RunDetail {
  id: string;
  status: string;
  proposedActions: { type: string; summary: string; payload?: Record<string, unknown> }[] | null;
  error: string | null;
  finishedAt: string | null;
}

const CHAT_TABS = [
  { key: 'chat', label: 'Chat', icon: MessageSquare },
  { key: 'tasks', label: 'Tasks', icon: ListTodo },
  { key: 'schedule', label: 'Schedule', icon: Calendar },
] as const;
type ChatTabKey = typeof CHAT_TABS[number]['key'];

const TERMINAL_STATUSES = new Set(['EXECUTED', 'FAILED', 'REJECTED']);

function getConvId(agentKey: string): string {
  const stored = localStorage.getItem(`cortex_conv_${agentKey}`);
  if (stored) return stored;
  const id = `${agentKey}-${Date.now()}`;
  localStorage.setItem(`cortex_conv_${agentKey}`, id);
  return id;
}

function setConvId(agentKey: string, id: string) {
  localStorage.setItem(`cortex_conv_${agentKey}`, id);
}

async function apiFetch(token: string, path: string, opts?: RequestInit) {
  const res = await fetch(path, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...opts?.headers },
  });
  if (!res.ok) throw new Error('Request failed');
  return res.json();
}

function extractResponse(run: RunDetail): string {
  if (run.status === 'FAILED') return `Error: ${run.error ?? 'Run failed'}`;
  if (run.status === 'REJECTED') return 'Action was rejected.';

  const actions = run.proposedActions ?? [];
  if (!actions.length) return 'Done.';

  const notify = actions.find((a) =>
    ['notify_result', 'send_telegram_brief', 'notify_email'].includes(a.type),
  );
  if (notify?.payload?.['message']) return String(notify.payload['message']);

  const approval = actions.find((a) => ['extend_trial', 'mark_refund', 'send_reply'].includes(a.type));
  if (approval) return `⏳ Awaiting Telegram approval: ${approval.summary}`;

  return actions.map((a) => a.summary).join('\n') || 'Done.';
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingBubble({ color }: { color: ReturnType<typeof agentColor> }) {
  return (
    <div className="flex items-end gap-2">
      <div className={`w-7 h-7 rounded-lg ${color.iconBg} flex items-center justify-center shrink-0`}>
        <Bot className={`w-3.5 h-3.5 ${color.iconText}`} />
      </div>
      <div className={`rounded-2xl rounded-bl-sm px-4 py-3 ${color.bubble}`}>
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`w-1.5 h-1.5 rounded-full ${color.dot} opacity-60`}
              style={{ animation: `bounce 1.2s ${i * 0.2}s infinite` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  msg, color, agentName,
}: {
  msg: ConvMessage & { pending?: boolean };
  color: ReturnType<typeof agentColor>;
  agentName: string;
}) {
  const isUser = msg.role === 'user';

  return (
    <div className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && (
        <div className={`w-7 h-7 rounded-lg ${color.iconBg} flex items-center justify-center shrink-0`}>
          <Bot className={`w-3.5 h-3.5 ${color.iconText}`} />
        </div>
      )}
      <div className={`max-w-[72%] group`}>
        <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : `${color.bubble} text-foreground rounded-bl-sm`
        }`}>
          {msg.content}
        </div>
        {msg.requiresApproval && (
          <div className="flex items-center gap-1 mt-1 px-1">
            <AlertCircle className="w-3 h-3 text-amber-500" />
            <span className="text-xs text-amber-500">Awaiting Telegram approval</span>
          </div>
        )}
        <div className={`text-[10px] text-muted-foreground/50 mt-0.5 px-1 ${isUser ? 'text-right' : ''}`}>
          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {msg.runId && (
            <Link to={`/runs/${msg.runId}`} className="ml-1.5 hover:text-muted-foreground transition-colors">
              run →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Chat tab ─────────────────────────────────────────────────────────────────

function ChatTab({
  agent, token, color, convId, onNewConv,
}: {
  agent: AgentInfo;
  token: string;
  color: ReturnType<typeof agentColor>;
  convId: string;
  onNewConv: () => void;
}) {
  const [messages, setMessages] = useState<(ConvMessage & { pending?: boolean })[]>([]);
  const [input, setInput] = useState('');
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load conversation history
  const { data: history, isLoading: histLoading } = useQuery<ConvMessage[]>({
    queryKey: ['conv', agent.key, convId],
    queryFn: () => apiFetch(token, `/agents/${agent.key}/conversations/${convId}`),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (history) setMessages(history);
  }, [history]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Poll active run
  const { data: runData } = useQuery<RunDetail>({
    queryKey: ['run-poll', activeRunId],
    enabled: !!activeRunId,
    queryFn: () => apiFetch(token, `/runs/${activeRunId}`),
    refetchInterval: (query) => {
      const d = query.state.data;
      if (!d) return 2000;
      return TERMINAL_STATUSES.has(d.status) ? false : 2000;
    },
  });

  useEffect(() => {
    if (!runData || !activeRunId) return;
    if (!TERMINAL_STATUSES.has(runData.status) && runData.status !== 'AWAITING_APPROVAL') return;

    const content = extractResponse(runData);
    const requiresApproval = runData.status === 'AWAITING_APPROVAL';

    const agentMsg: ConvMessage = {
      id: `a-${activeRunId}`,
      role: 'agent',
      content,
      runId: activeRunId,
      requiresApproval,
      createdAt: runData.finishedAt ?? new Date().toISOString(),
    };

    // Save to backend
    apiFetch(token, `/agents/${agent.key}/conversations/message`, {
      method: 'POST',
      body: JSON.stringify({
        conversationId: convId,
        role: 'agent',
        content,
        runId: activeRunId,
        requiresApproval,
      }),
    }).catch(() => {});

    setMessages((prev) => [...prev, agentMsg]);
    setIsThinking(false);
    setActiveRunId(null);
  }, [runData, activeRunId]);

  const triggerMutation = useMutation({
    mutationFn: async (query: string) => {
      // Build history context (last 6 messages)
      const recent = messages.slice(-6);
      const historyCtx = recent.length
        ? recent.map((m) => `${m.role === 'user' ? 'User' : 'Agent'}: ${m.content}`).join('\n')
        : undefined;

      return apiFetch(token, `/agents/${agent.key}/trigger`, {
        method: 'POST',
        body: JSON.stringify({
          triggerType: 'MANUAL',
          payload: { query, source: 'chat', conversationId: convId, history: historyCtx },
        }),
      });
    },
    onMutate: async (query: string) => {
      const userMsg: ConvMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: query,
        runId: null,
        requiresApproval: false,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsThinking(true);

      // Save user message to backend
      apiFetch(token, `/agents/${agent.key}/conversations/message`, {
        method: 'POST',
        body: JSON.stringify({ conversationId: convId, role: 'user', content: query }),
      }).catch(() => {});
    },
    onSuccess: (run: { id: string }) => {
      setActiveRunId(run.id);
    },
    onError: () => {
      setIsThinking(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'agent',
          content: 'Failed to start run. Check that the agent is enabled and the API is running.',
          runId: null,
          requiresApproval: false,
          createdAt: new Date().toISOString(),
        },
      ]);
    },
  });

  function handleSend() {
    const q = input.trim();
    if (!q || triggerMutation.isPending || isThinking) return;
    setInput('');
    triggerMutation.mutate(q);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const isBusy = triggerMutation.isPending || isThinking;

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[500px]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
        <p className="text-xs text-muted-foreground font-mono truncate max-w-xs">{convId}</p>
        <button
          onClick={onNewConv}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          New chat
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {histLoading && (
          <div className="space-y-3 pt-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : ''}`}>
                <Skeleton className={`h-10 rounded-2xl ${i % 2 === 0 ? 'w-48' : 'w-64'}`} />
              </div>
            ))}
          </div>
        )}

        {!histLoading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-12">
            <div className={`w-14 h-14 rounded-2xl ${color.iconBg} flex items-center justify-center`}>
              <Bot className={`w-7 h-7 ${color.iconText}`} />
            </div>
            <div>
              <p className="text-sm font-medium">{agent.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Send a message to start the conversation</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} color={color} agentName={agent.name} />
        ))}

        {isThinking && <TypingBubble color={color} />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border p-3">
        {!agent.enabled && (
          <p className="text-xs text-amber-500 mb-2 px-1">Agent is disabled — enable it in Settings to chat.</p>
        )}
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${agent.name}… (Enter to send, Shift+Enter for newline)`}
            rows={2}
            disabled={!agent.enabled || !agent.registered || isBusy}
            className="flex-1 font-sans text-sm bg-muted/40 border border-border rounded-xl p-3 resize-none focus:outline-none focus:ring-1 focus:ring-ring text-foreground placeholder:text-muted-foreground/50 disabled:opacity-50"
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!input.trim() || !agent.enabled || !agent.registered || isBusy}
            className="h-10 w-10 p-0 rounded-xl shrink-0"
          >
            {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Tasks tab ────────────────────────────────────────────────────────────────

function TasksTab({
  agent, token, color,
}: {
  agent: AgentInfo;
  token: string;
  color: ReturnType<typeof agentColor>;
}) {
  const [taskInput, setTaskInput] = useState('');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');

  const { data: runs, isLoading, refetch } = useQuery<{
    id: string; triggerType: string; status: string; triggerPayload: unknown; startedAt: string; finishedAt: string | null;
  }[]>({
    queryKey: ['agent-runs-tasks', agent.key],
    queryFn: () => apiFetch(token, `/agents/${agent.key}/runs?limit=30`),
    refetchInterval: 15_000,
  });

  const triggerMutation = useMutation({
    mutationFn: () =>
      apiFetch(token, `/agents/${agent.key}/trigger`, {
        method: 'POST',
        body: JSON.stringify({
          triggerType: 'MANUAL',
          payload: { query: taskInput, source: 'task', priority },
        }),
      }),
    onSuccess: () => { setTaskInput(''); refetch(); },
  });

  const manualRuns = (runs ?? []).filter((r) => r.triggerType === 'MANUAL');

  const STATUS_CLS: Record<string, string> = {
    PENDING: 'text-muted-foreground',
    RUNNING: 'text-blue-400',
    AWAITING_APPROVAL: 'text-amber-400',
    EXECUTED: 'text-green-400',
    FAILED: 'text-red-400',
    REJECTED: 'text-red-400',
  };

  return (
    <div className="p-4 space-y-5">
      {/* New task */}
      <div className={`rounded-xl border ${color.border} bg-card p-4 space-y-3`}>
        <h3 className="text-sm font-semibold">Assign New Task</h3>
        <textarea
          value={taskInput}
          onChange={(e) => setTaskInput(e.target.value)}
          placeholder="Describe the task for this agent…"
          rows={3}
          className="w-full text-sm bg-muted/40 border border-border rounded-lg p-3 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            {(['high', 'medium', 'low'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  priority === p
                    ? p === 'high' ? 'bg-red-500/15 border-red-500/40 text-red-400'
                    : p === 'medium' ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                    : 'bg-muted border-border text-muted-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            onClick={() => triggerMutation.mutate()}
            disabled={!taskInput.trim() || !agent.enabled || triggerMutation.isPending}
            className="ml-auto gap-1.5"
          >
            {triggerMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Assign
          </Button>
        </div>
      </div>

      {/* Task history */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Manual Task History</h3>
          <button onClick={() => refetch()} className="text-xs text-muted-foreground hover:text-foreground">
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
        {isLoading && <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>}
        {!isLoading && manualRuns.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No manual tasks yet.</p>
        )}
        <div className="space-y-1.5">
          {manualRuns.map((run) => {
            const payload = run.triggerPayload as { query?: string; priority?: string } | null;
            const query = payload?.query ?? 'Manual trigger';
            return (
              <Link
                key={run.id}
                to={`/runs/${run.id}`}
                className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-2.5 hover:bg-accent/30 transition-colors"
              >
                <div className="shrink-0 mt-0.5">
                  {run.status === 'EXECUTED' ? (
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                  ) : run.status === 'FAILED' || run.status === 'REJECTED' ? (
                    <XCircle className="w-4 h-4 text-red-400" />
                  ) : (
                    <Clock className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{query}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] font-medium ${STATUS_CLS[run.status] ?? 'text-muted-foreground'}`}>
                      {run.status}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(run.startedAt).toLocaleDateString()} {new Date(run.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Schedule tab ─────────────────────────────────────────────────────────────

function ScheduleTab({
  agent, token, color,
}: {
  agent: AgentInfo;
  token: string;
  color: ReturnType<typeof agentColor>;
}) {
  const [schedQuery, setSchedQuery] = useState('');
  const [schedAt, setSchedAt] = useState('');
  const [scheduled, setScheduled] = useState<{ query: string; at: string; runId: string }[]>([]);

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      const targetMs = new Date(schedAt).getTime();
      const delayMs = Math.max(0, targetMs - Date.now());
      return apiFetch(token, `/agents/${agent.key}/trigger`, {
        method: 'POST',
        body: JSON.stringify({
          triggerType: 'MANUAL',
          payload: { query: schedQuery, source: 'scheduled' },
          delayMs,
        }),
      });
    },
    onSuccess: (run: { id: string }) => {
      setScheduled((prev) => [{ query: schedQuery, at: schedAt, runId: run.id }, ...prev]);
      setSchedQuery('');
      setSchedAt('');
    },
  });

  const nowPlusHour = new Date(Date.now() + 3600_000).toISOString().slice(0, 16);

  return (
    <div className="p-4 space-y-5">
      {/* Current schedule */}
      {agent.triggers.length > 0 && (
        <div className={`rounded-xl border ${color.border} bg-card p-4`}>
          <h3 className="text-sm font-semibold mb-3">Automatic Schedule</h3>
          <div className="space-y-2">
            {agent.triggers.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <Clock className={`w-3.5 h-3.5 ${color.iconText}`} />
                <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                  {t.type}{t.cron ? ` • ${t.cron}` : ''}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${color.badge} ${color.badgeText}`}>
                  {agent.enabled ? 'active' : 'paused'}
                </span>
              </div>
            ))}
          </div>
          {!agent.enabled && (
            <p className="text-xs text-amber-500 mt-2">Agent is disabled. Enable it in Settings → General to activate this schedule.</p>
          )}
        </div>
      )}

      {/* One-time scheduled task */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold">Schedule One-time Task</h3>
        <p className="text-xs text-muted-foreground">The agent will run at the specified time with your query.</p>
        <textarea
          value={schedQuery}
          onChange={(e) => setSchedQuery(e.target.value)}
          placeholder="Describe the task…"
          rows={2}
          className="w-full text-sm bg-muted/40 border border-border rounded-lg p-3 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground block mb-1">Run at</label>
            <Input
              type="datetime-local"
              value={schedAt}
              onChange={(e) => setSchedAt(e.target.value)}
              min={nowPlusHour}
              className="text-sm"
            />
          </div>
          <Button
            size="sm"
            onClick={() => scheduleMutation.mutate()}
            disabled={!schedQuery.trim() || !schedAt || !agent.enabled || scheduleMutation.isPending}
            className="gap-1.5 mb-0"
          >
            {scheduleMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
            Schedule
          </Button>
        </div>
        {scheduleMutation.isSuccess && (
          <p className="text-xs text-green-500">Scheduled successfully.</p>
        )}
      </div>

      {/* Scheduled tasks list */}
      {scheduled.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Upcoming (this session)</h3>
          <div className="space-y-1.5">
            {scheduled.map((s) => (
              <div key={s.runId} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
                <Calendar className={`w-4 h-4 ${color.iconText} shrink-0`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{s.query}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(s.at).toLocaleString()}</p>
                </div>
                <Link to={`/runs/${s.runId}`} className="text-[10px] text-muted-foreground hover:text-foreground">
                  run →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgentChatPage() {
  const { key } = useParams<{ key: string }>();
  const token = useAuthStore((s) => s.token)!;
  const [activeTab, setActiveTab] = useState<ChatTabKey>('chat');
  const [convId, setConvIdState] = useState(() => getConvId(key!));
  const color = agentColor(key!);

  const { data: agent, isLoading } = useQuery<AgentInfo>({
    queryKey: ['agent', key],
    queryFn: () => apiFetch(token, `/agents/${key}`),
  });

  const handleNewConv = useCallback(() => {
    const id = `${key}-${Date.now()}`;
    setConvId(key!, id);
    setConvIdState(id);
  }, [key]);

  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden">
      {/* Header */}
      <div className={`shrink-0 border-b border-border px-5 py-3 flex items-center gap-3 bg-card`}>
        <Link
          to={`/agents/${key}`}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mr-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </Link>

        <div className={`w-8 h-8 rounded-lg ${color.iconBg} flex items-center justify-center shrink-0`}>
          <Bot className={`w-4 h-4 ${color.iconText}`} />
        </div>

        {isLoading ? (
          <Skeleton className="h-5 w-32 rounded" />
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{agent?.name}</span>
            <code className={`text-xs px-1.5 py-0.5 rounded ${color.badge} ${color.badgeText}`}>{key}</code>
            {agent && !agent.enabled && (
              <span className="text-xs text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">disabled</span>
            )}
          </div>
        )}

        {/* Tab bar in header */}
        <div className="ml-auto flex items-center gap-1 border border-border rounded-lg p-0.5 bg-muted/30">
          {CHAT_TABS.map(({ key: tabKey, label, icon: Icon }) => (
            <button
              key={tabKey}
              onClick={() => setActiveTab(tabKey)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === tabKey
                  ? `bg-card text-foreground shadow-sm`
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {agent && activeTab === 'chat' && (
          <ChatTab agent={agent} token={token} color={color} convId={convId} onNewConv={handleNewConv} />
        )}
        {agent && activeTab === 'tasks' && (
          <TasksTab agent={agent} token={token} color={color} />
        )}
        {agent && activeTab === 'schedule' && (
          <ScheduleTab agent={agent} token={token} color={color} />
        )}
        {isLoading && (
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        )}
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
