import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Save, Trash2, Eye, EyeOff, Key, Bot, Send, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/authStore';

interface SettingRow {
  key: string;
  value: string;
  isSecret: boolean;
  label: string;
  description?: string | null;
  group: string;
  stored: boolean;
}

type GroupedSettings = Record<string, SettingRow[]>;

const GROUP_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  llm: { label: 'LLM Providers', icon: <Bot className="w-4 h-4" /> },
  telegram: { label: 'Telegram', icon: <Send className="w-4 h-4" /> },
  ses: { label: 'Email (SES)', icon: <Mail className="w-4 h-4" /> },
};

async function fetchSettings(token: string): Promise<SettingRow[]> {
  const res = await fetch('/settings', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
}

async function upsertSetting(token: string, key: string, value: string): Promise<void> {
  const res = await fetch(`/settings/${key}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ value }),
  });
  if (!res.ok) throw new Error('Failed to save setting');
}

async function deleteSetting(token: string, key: string): Promise<void> {
  const res = await fetch(`/settings/${key}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to delete setting');
}

function SettingField({ setting, token }: { setting: SettingRow; token: string }) {
  const [inputValue, setInputValue] = useState('');
  const [editing, setEditing] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const qc = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: () => upsertSetting(token, setting.key, inputValue),
    onSuccess: () => {
      setEditing(false);
      setInputValue('');
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteSetting(token, setting.key),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });

  const displayValue = setting.stored ? setting.value : setting.value || '—';
  const inputType = setting.isSecret && !showRaw ? 'password' : 'text';

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
                  type={inputType}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={`Enter ${setting.label}`}
                  className="pr-9 text-sm"
                  autoFocus
                />
                {setting.isSecret && (
                  <button
                    type="button"
                    onClick={() => setShowRaw((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showRaw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>
              <Button
                size="sm"
                onClick={() => saveMutation.mutate()}
                disabled={!inputValue || saveMutation.isPending}
              >
                <Save className="w-3.5 h-3.5" />
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setEditing(false); setInputValue(''); }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-1">
              <code className="text-xs bg-muted px-2 py-1 rounded font-mono text-muted-foreground">
                {displayValue}
              </code>
            </div>
          )}
        </div>

        {!editing && (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(true)}
              className="text-xs"
            >
              {setting.stored ? 'Update' : 'Set'}
            </Button>
            {setting.stored && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const token = useAuthStore((s) => s.token)!;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['settings'],
    queryFn: () => fetchSettings(token),
  });

  const grouped: GroupedSettings = {};
  for (const row of data ?? []) {
    if (!grouped[row.group]) grouped[row.group] = [];
    grouped[row.group].push(row);
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Settings className="w-5 h-5 text-primary" />
        <h1 className="text-2xl font-semibold">Settings</h1>
      </div>
      <p className="text-muted-foreground text-sm mb-8">
        API keys and configuration. Secrets are encrypted at rest and never shown in plaintext.
      </p>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}
      {isError && (
        <p className="text-sm text-destructive">Failed to load settings.</p>
      )}

      {Object.entries(GROUP_LABELS).map(([groupKey, { label, icon }]) => {
        const rows = grouped[groupKey];
        if (!rows) return null;
        return (
          <div key={groupKey} className="rounded-xl border border-border bg-card mb-6">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
              {icon}
              <span className="text-sm font-semibold">{label}</span>
            </div>
            <div className="px-5">
              {rows.map((s) => (
                <SettingField key={s.key} setting={s} token={token} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
