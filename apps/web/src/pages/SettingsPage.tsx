import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Save, Trash2, Eye, EyeOff, Key, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/authStore';

interface SettingRow {
  key: string;
  value: string;
  isSecret: boolean;
  label: string;
  description?: string | null;
  group: string;
  provider?: string | null;
  stored: boolean;
}

const LLM_PROVIDER_TABS = [
  { key: 'openai', label: 'OpenAI' },
  { key: 'gemini', label: 'Gemini' },
  { key: 'deepseek', label: 'DeepSeek' },
];

const OPENAI_TEXT_MODELS = [
  { label: 'GPT-5.5', value: 'gpt-5.5' },
  { label: 'GPT-5.4', value: 'gpt-5.4' },
  { label: 'GPT-5.4 mini', value: 'gpt-5.4-mini' },
  { label: 'GPT-5.2', value: 'gpt-5.2' },
  { label: 'GPT-5', value: 'gpt-5' },
  { label: 'GPT-5 mini', value: 'gpt-5-mini' },
  { label: 'o3', value: 'o3' },
  { label: 'o3-pro', value: 'o3-pro' },
  { label: 'o4-mini', value: 'o4-mini' },
  { label: 'GPT-4.5', value: 'gpt-4.5' },
  { label: 'GPT-4o', value: 'gpt-4o' },
  { label: 'GPT-4o mini', value: 'gpt-4o-mini' },
  { label: 'GPT-4.1', value: 'gpt-4.1' },
  { label: 'GPT-4.1 mini', value: 'gpt-4.1-mini' },
];

const OPENAI_EMBEDDING_MODELS = [
  { label: 'text-embedding-3-large', value: 'text-embedding-3-large' },
  { label: 'text-embedding-3-small', value: 'text-embedding-3-small' },
];

const GEMINI_TEXT_MODELS = [
  { label: 'Gemini 3.1 Pro', value: 'gemini-3.1-pro' },
  { label: 'Gemini 3.1 Flash', value: 'gemini-3.1-flash' },
  { label: 'Gemini 3.1 Flash-Lite', value: 'gemini-3.1-flash-lite' },
  { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
  { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
  { label: 'Gemini 2.5 Flash-Lite', value: 'gemini-2.5-flash-lite' },
  { label: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' },
  { label: 'Gemini 2.0 Pro', value: 'gemini-2.0-pro' },
];

const DEFAULT_PROVIDER_OPTIONS = [
  { value: 'auto', label: 'Auto (fallback chain)', desc: 'OpenAI → Gemini → DeepSeek' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'deepseek', label: 'DeepSeek' },
];

async function fetchSettings(token: string): Promise<SettingRow[]> {
  const res = await fetch('/settings', { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
}

async function upsertSetting(token: string, key: string, value: string) {
  const res = await fetch(`/settings/${key}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  });
  if (!res.ok) throw new Error('Failed to save');
}

async function deleteSetting(token: string, key: string) {
  const res = await fetch(`/settings/${key}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to delete');
}

function SettingField({ setting, token }: { setting: SettingRow; token: string }) {
  const [inputValue, setInputValue] = useState('');
  const [editing, setEditing] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const qc = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: () => upsertSetting(token, setting.key, inputValue),
    onSuccess: () => { setEditing(false); setInputValue(''); qc.invalidateQueries({ queryKey: ['settings'] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteSetting(token, setting.key),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });

  return (
    <div className="py-4 border-b border-border last:border-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            {setting.isSecret && <Key className="w-3 h-3 text-yellow-500 shrink-0" />}
            <span className="text-sm font-medium">{setting.label}</span>
            {setting.stored && (
              <span className="text-xs bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded">saved</span>
            )}
          </div>
          {setting.description && (
            <p className="text-xs text-muted-foreground mb-2">{setting.description}</p>
          )}
          {editing ? (
            <div className="flex items-center gap-2 mt-2">
              <div className="relative flex-1">
                <Input
                  type={setting.isSecret && !showRaw ? 'password' : 'text'}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={`Enter ${setting.label}`}
                  className="pr-9 text-sm"
                  autoFocus
                />
                {setting.isSecret && (
                  <button type="button" onClick={() => setShowRaw((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showRaw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>
              <Button size="sm" onClick={() => saveMutation.mutate()} disabled={!inputValue || saveMutation.isPending}>
                <Save className="w-3.5 h-3.5" />Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setInputValue(''); }}>Cancel</Button>
            </div>
          ) : (
            <code className="text-xs bg-muted px-2 py-1 rounded font-mono text-muted-foreground mt-1 inline-block">
              {setting.stored ? setting.value : (setting.value || '—')}
            </code>
          )}
        </div>
        {!editing && (
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="text-xs">
              {setting.stored ? 'Update' : 'Set'}
            </Button>
            {setting.stored && (
              <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="text-muted-foreground hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ModelSelectField({
  setting,
  options,
  token,
}: {
  setting: SettingRow;
  options: { label: string; value: string }[];
  token: string;
}) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (val: string) => upsertSetting(token, setting.key, val),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });

  return (
    <div className="py-4 border-b border-border last:border-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium">{setting.label}</span>
            {mutation.isSuccess && (
              <span className="text-xs bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded">saved</span>
            )}
          </div>
          {setting.description && (
            <p className="text-xs text-muted-foreground mb-2">{setting.description}</p>
          )}
          <select
            value={setting.value || ''}
            onChange={(e) => mutation.mutate(e.target.value)}
            disabled={mutation.isPending}
            className="mt-1 w-full max-w-xs bg-muted border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

function DefaultProviderSelector({ current, token }: { current: string; token: string }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (val: string) => upsertSetting(token, 'llm_default_provider', val),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });

  return (
    <div className="rounded-xl border border-border bg-card p-5 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">Default Provider</span>
        {mutation.isSuccess && (
          <span className="text-xs text-green-500 ml-auto">Saved</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {DEFAULT_PROVIDER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => mutation.mutate(opt.value)}
            disabled={mutation.isPending}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              current === opt.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
            }`}
          >
            {opt.label}
            {opt.desc && current === opt.value && (
              <span className="ml-1.5 text-xs opacity-75">{opt.desc}</span>
            )}
          </button>
        ))}
      </div>
      {current !== 'auto' && (
        <p className="text-xs text-muted-foreground mt-2">
          Falls back to auto chain if the selected provider fails or has no API key.
        </p>
      )}
    </div>
  );
}

const MODEL_SELECT_KEYS: Record<string, { label: string; value: string }[]> = {
  openai_default_model: OPENAI_TEXT_MODELS,
  openai_embedding_model: OPENAI_EMBEDDING_MODELS,
  gemini_default_model: GEMINI_TEXT_MODELS,
};

function LlmTab({ rows, token }: { rows: SettingRow[]; token: string }) {
  const [activeProvider, setActiveProvider] = useState('openai');

  const generalSettings = rows.filter((r) => r.provider === 'general');
  const defaultProviderRow = generalSettings.find((r) => r.key === 'llm_default_provider');
  const currentDefault = defaultProviderRow?.value || 'auto';

  const providerRows = rows.filter((r) => r.provider === activeProvider);

  return (
    <div>
      <DefaultProviderSelector current={currentDefault} token={token} />

      {/* Provider sub-tabs */}
      <div className="flex items-center gap-1 border border-border rounded-lg p-1 mb-4 bg-muted/30 w-fit">
        {LLM_PROVIDER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveProvider(tab.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeProvider === tab.key
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="px-5">
          {providerRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6">No settings for this provider.</p>
          ) : (
            providerRows.map((s) =>
              MODEL_SELECT_KEYS[s.key] ? (
                <ModelSelectField key={s.key} setting={s} options={MODEL_SELECT_KEYS[s.key]} token={token} />
              ) : (
                <SettingField key={s.key} setting={s} token={token} />
              )
            )
          )}
        </div>
      </div>
    </div>
  );
}


export default function SettingsPage() {
  const token = useAuthStore((s) => s.token)!;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['settings'],
    queryFn: () => fetchSettings(token),
    staleTime: 0,
  });

  const grouped: Record<string, SettingRow[]> = {};
  for (const row of data ?? []) {
    if (!grouped[row.group]) grouped[row.group] = [];
    grouped[row.group].push(row);
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Settings className="w-5 h-5 text-primary" />
        <h1 className="text-2xl font-semibold">Settings</h1>
      </div>
      <p className="text-muted-foreground text-sm mb-6">
        LLM provider keys and configuration. For external service credentials, see{' '}
        <a href="/integrations" className="text-primary hover:underline">Integrations</a>.
      </p>

      {isLoading && (
        <div className="rounded-xl border border-border bg-card">
          <div className="px-5 divide-y divide-border">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="py-4 flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-36 rounded" />
                    <Skeleton className="h-4 w-12 rounded" />
                  </div>
                  <Skeleton className="h-3.5 w-64 rounded" />
                  <Skeleton className="h-7 w-48 rounded" />
                </div>
                <Skeleton className="h-7 w-14 rounded" />
              </div>
            ))}
          </div>
        </div>
      )}
      {isError && <p className="text-sm text-destructive">Failed to load settings.</p>}

      {!isLoading && !isError && <LlmTab rows={grouped['llm'] ?? []} token={token} />}
    </div>
  );
}
