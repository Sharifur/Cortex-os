import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckSquare, Plus, Trash2, Play, Clock, RefreshCw, ChevronDown, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/authStore';

async function apiFetch(token: string, path: string, opts?: RequestInit) {
  const res = await fetch(path, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...opts?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}

interface Task {
  id: string;
  title: string;
  instructions: string;
  agentKey: string;
  status: 'pending' | 'running' | 'awaiting_approval' | 'done' | 'failed';
  output: unknown | null;
  runId: string | null;
  recurrence: 'daily' | 'weekly' | 'weekdays' | null;
  recurrenceTime: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const AGENT_OPTIONS = [
  { key: 'linkedin', label: 'LinkedIn AI Agent' },
  { key: 'reddit', label: 'Reddit Followup Agent' },
  { key: 'social', label: 'Social Media Handler' },
  { key: 'email_manager', label: 'Email Manager' },
  { key: 'shorts', label: 'YouTube Shorts Creator' },
  { key: 'support', label: 'Support Ticket Manager' },
  { key: 'canva', label: 'Canva Content Agent' },
  { key: 'crisp', label: 'Crisp AI Agent' },
  { key: 'whatsapp', label: 'WhatsApp Business Watcher' },
  { key: 'daily_reminder', label: 'Daily Reminder' },
  { key: 'hr', label: 'HR Manager Agent' },
  { key: 'taskip_trial', label: 'Trial Email Agent' },
  { key: 'taskip_internal', label: 'Taskip Internal' },
];

const STATUS_CLS: Record<string, string> = {
  pending: 'text-muted-foreground bg-muted/50',
  running: 'text-blue-400 bg-blue-500/10',
  awaiting_approval: 'text-yellow-400 bg-yellow-500/10',
  done: 'text-green-400 bg-green-500/10',
  failed: 'text-red-400 bg-red-500/10',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  running: 'Running',
  awaiting_approval: 'Awaiting Approval',
  done: 'Done',
  failed: 'Failed',
};

const RECURRENCE_LABEL: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  weekdays: 'Weekdays',
};

function agentLabel(key: string) {
  return AGENT_OPTIONS.find((a) => a.key === key)?.label ?? key;
}

function formatRecurrenceTime(utcTime: string | null): string {
  if (!utcTime) return '';
  const [h, m] = utcTime.split(':').map(Number);
  const d = new Date();
  d.setUTCHours(h, m, 0, 0);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatNextRun(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** "in 10m", "in 2h 5m", "due now", "5m overdue", etc. */
function formatRelative(iso: string | null): string {
  if (!iso) return '';
  const diffMs = new Date(iso).getTime() - Date.now();
  const overdue = diffMs < 0;
  const totalSec = Math.abs(Math.floor(diffMs / 1000));

  if (totalSec < 30) return overdue ? 'due now' : 'in <1m';

  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);

  let body: string;
  if (days > 0) body = `${days}d ${hours}h`;
  else if (hours > 0) body = `${hours}h ${minutes}m`;
  else body = `${Math.max(1, minutes)}m`;

  return overdue ? `${body} overdue` : `in ${body}`;
}

function dhakaToUtcTime(dhakaTime: string): string {
  const [h, m] = dhakaTime.split(':').map(Number);
  let utcH = h - 6;
  if (utcH < 0) utcH += 24;
  return `${String(utcH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function utcToDhakaTime(utcTime: string): string {
  const [h, m] = utcTime.split(':').map(Number);
  let dhakaH = h + 6;
  if (dhakaH >= 24) dhakaH -= 24;
  return `${String(dhakaH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function TaskSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-40 rounded" />
          <Skeleton className="h-5 w-16 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-20 rounded" />
          <Skeleton className="h-7 w-7 rounded" />
        </div>
      </div>
      <Skeleton className="h-3.5 w-32 rounded" />
    </div>
  );
}

function TaskCard({
  task,
  token,
  onDelete,
}: {
  task: Task;
  token: string;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();

  const runMutation = useMutation({
    mutationFn: () => apiFetch(token, `/tasks/${task.id}/run`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiFetch(token, `/tasks/${task.id}`, { method: 'DELETE' }),
    onSuccess: () => onDelete(task.id),
  });

  const busy = runMutation.isPending || deleteMutation.isPending;
  const canRun = task.status !== 'running' && task.status !== 'awaiting_approval';
  const statusCls = STATUS_CLS[task.status] ?? 'text-muted-foreground bg-muted/50';

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <button
              className="flex items-center gap-1.5 text-left group"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded
                ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              }
              <span className="font-medium text-sm group-hover:text-primary transition-colors">
                {task.title}
              </span>
            </button>
            <div className="flex items-center gap-2 mt-1 ml-5 flex-wrap">
              <span className="text-xs text-muted-foreground">{agentLabel(task.agentKey)}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${statusCls}`}>
                {STATUS_LABEL[task.status] ?? task.status}
              </span>
              {task.recurrence && task.recurrenceTime && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 font-medium flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" />
                  {RECURRENCE_LABEL[task.recurrence]} {formatRecurrenceTime(task.recurrenceTime)}
                </span>
              )}
              {task.nextRunAt && (
                <span
                  className={`text-xs flex items-center gap-1 ${
                    task.status === 'pending' && new Date(task.nextRunAt).getTime() < Date.now()
                      ? 'text-rose-400'
                      : 'text-muted-foreground'
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  {task.recurrence ? 'Next' : task.status === 'running' ? 'Started' : 'Runs'}: {formatNextRun(task.nextRunAt)}
                  {task.status === 'pending' && (
                    <span className="ml-1 font-medium">({formatRelative(task.nextRunAt)})</span>
                  )}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-7 px-2.5 text-xs"
              onClick={() => runMutation.mutate()}
              disabled={!canRun || busy}
            >
              <Play className="w-3 h-3" />
              Run now
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={busy}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-4">
          <div className="ml-5 rounded-lg bg-muted/40 border border-border px-3 py-2.5">
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{task.instructions}</p>
          </div>
        </div>
      )}
    </div>
  );
}

type ScheduleMode = 'now' | 'scheduled' | 'save';

interface CreateForm {
  title: string;
  agentKey: string;
  instructions: string;
  recurring: boolean;
  recurrence: 'daily' | 'weekly' | 'weekdays';
  recurrenceTimeDhaka: string;
  scheduleMode: ScheduleMode;
  scheduledDate: string; // YYYY-MM-DD local
  scheduledTime: string; // HH:MM local (Dhaka)
}

function CreateTaskPanel({
  token,
  onClose,
}: {
  token: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  // Default scheduled date/time = today + 1 hour, Dhaka local
  const defaultDate = (() => {
    const d = new Date(Date.now() + 3600_000 + 6 * 3600_000); // UTC+6
    return d.toISOString().slice(0, 10);
  })();
  const defaultTime = (() => {
    const d = new Date(Date.now() + 3600_000 + 6 * 3600_000);
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  })();

  const [form, setForm] = useState<CreateForm>({
    title: '',
    agentKey: AGENT_OPTIONS[0].key,
    instructions: '',
    recurring: false,
    recurrence: 'daily',
    recurrenceTimeDhaka: '09:00',
    scheduleMode: 'now',
    scheduledDate: defaultDate,
    scheduledTime: defaultTime,
  });
  const [error, setError] = useState('');

  function set<K extends keyof CreateForm>(key: K, value: CreateForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch(token, '/tasks', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) { setError('Title is required.'); return; }
    if (!form.instructions.trim()) { setError('Instructions are required.'); return; }

    const body: Record<string, unknown> = {
      title: form.title.trim(),
      agentKey: form.agentKey,
      instructions: form.instructions.trim(),
    };

    if (form.recurring) {
      body.recurrence = form.recurrence;
      body.recurrenceTime = dhakaToUtcTime(form.recurrenceTimeDhaka);
    } else if (form.scheduleMode === 'now') {
      body.runNow = true;
    } else if (form.scheduleMode === 'scheduled') {
      if (!form.scheduledDate || !form.scheduledTime) {
        setError('Please pick a date and time.');
        return;
      }
      // Combine local Dhaka date+time and convert to UTC ISO
      const [h, m] = form.scheduledTime.split(':').map(Number);
      const [yr, mo, dy] = form.scheduledDate.split('-').map(Number);
      const dhakaMs = Date.UTC(yr, mo - 1, dy, h, m, 0) - 6 * 3600_000;
      if (dhakaMs <= Date.now()) { setError('Scheduled time must be in the future.'); return; }
      body.scheduledAt = new Date(dhakaMs).toISOString();
    }
    // 'save' mode: no runNow, no scheduledAt — just saves as pending

    createMutation.mutate(body);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold">New Task</h2>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <span className="text-lg leading-none">&times;</span>
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Title</label>
          <Input
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Task title"
            className="text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Agent</label>
          <select
            value={form.agentKey}
            onChange={(e) => set('agentKey', e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {AGENT_OPTIONS.map((a) => (
              <option key={a.key} value={a.key}>{a.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Instructions</label>
          <textarea
            value={form.instructions}
            onChange={(e) => set('instructions', e.target.value)}
            placeholder="Describe what you want the agent to do..."
            rows={5}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={form.recurring}
            onClick={() => set('recurring', !form.recurring)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.recurring ? 'bg-primary' : 'bg-muted'}`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform ${form.recurring ? 'translate-x-4' : 'translate-x-1'}`}
            />
          </button>
          <span className="text-sm">Recurring</span>
        </div>
        {form.recurring && (
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Repeat</label>
              <select
                value={form.recurrence}
                onChange={(e) => set('recurrence', e.target.value as CreateForm['recurrence'])}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="weekdays">Weekdays</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Time (Dhaka)</label>
              <Input
                type="time"
                value={form.recurrenceTimeDhaka}
                onChange={(e) => set('recurrenceTimeDhaka', e.target.value)}
                className="text-sm w-32"
              />
            </div>
          </div>
        )}
        {!form.recurring && (
          <div className="space-y-3">
            <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-1 w-fit">
              {([
                { id: 'now', label: 'Run now' },
                { id: 'scheduled', label: 'Schedule for' },
                { id: 'save', label: 'Save only' },
              ] as { id: ScheduleMode; label: string }[]).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => set('scheduleMode', opt.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    form.scheduleMode === opt.id
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {form.scheduleMode === 'scheduled' && (
              <div className="flex items-center gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Date</label>
                  <Input
                    type="date"
                    value={form.scheduledDate}
                    onChange={(e) => set('scheduledDate', e.target.value)}
                    className="text-sm w-40"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Time (Dhaka)</label>
                  <Input
                    type="time"
                    value={form.scheduledTime}
                    onChange={(e) => set('scheduledTime', e.target.value)}
                    className="text-sm w-32"
                  />
                </div>
              </div>
            )}
          </div>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex items-center gap-2 pt-1">
          <Button type="submit" size="sm" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create Task'}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

function SectionEmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-8 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

type TabId = 'scheduled' | 'onetime';

export default function TasksPage() {
  const token = useAuthStore((s) => s.token)!;
  const [showCreate, setShowCreate] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('scheduled');
  const queryClient = useQueryClient();

  const { data, isPending, isFetching } = useQuery<Task[]>({
    queryKey: ['tasks'],
    queryFn: () => apiFetch(token, '/tasks'),
    refetchInterval: 10_000,
  });

  const tasks = data ?? [];
  const scheduled = tasks.filter((t) => t.recurrence !== null);
  const oneTime = tasks.filter((t) => t.recurrence === null);

  const loading = isPending && isFetching;

  function handleDelete(id: string) {
    queryClient.setQueryData<Task[]>(['tasks'], (prev) =>
      (prev ?? []).filter((t) => t.id !== id)
    );
  }

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: 'scheduled', label: 'Scheduled', count: scheduled.length },
    { id: 'onetime', label: 'One-time', count: oneTime.length },
  ];

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-semibold">Tasks</h1>
        </div>
        {!showCreate && (
          <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" />
            New Task
          </Button>
        )}
      </div>
      <p className="text-muted-foreground text-sm mb-6">
        Create and schedule tasks for your agents to run.
      </p>

      {showCreate && (
        <CreateTaskPanel token={token} onClose={() => setShowCreate(false)} />
      )}

      <div className="flex gap-1 p-1 bg-muted/40 rounded-lg border border-border mb-5 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            {!loading && tab.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                activeTab === tab.id ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <TaskSkeleton key={i} />)}
        </div>
      ) : activeTab === 'scheduled' ? (
        scheduled.length === 0 ? (
          <SectionEmptyState message="No scheduled tasks." />
        ) : (
          <div className="space-y-3">
            {scheduled.map((task) => (
              <TaskCard key={task.id} task={task} token={token} onDelete={handleDelete} />
            ))}
          </div>
        )
      ) : (
        oneTime.length === 0 ? (
          <SectionEmptyState message={tasks.length === 0 ? 'No tasks yet. Create your first task to get started.' : 'No one-time tasks.'} />
        ) : (
          <div className="space-y-3">
            {oneTime.map((task) => (
              <TaskCard key={task.id} task={task} token={token} onDelete={handleDelete} />
            ))}
          </div>
        )
      )}
    </div>
  );
}
