import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Save, Trash2, Eye, EyeOff, Key, Bot, Send, Mail, Zap, Mail as GmailIcon, Copy, Check, ExternalLink } from 'lucide-react';
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

const MAIN_TABS = [
  { key: 'llm', label: 'LLM Providers', icon: <Bot className="w-4 h-4" /> },
  { key: 'telegram', label: 'Telegram', icon: <Send className="w-4 h-4" /> },
  { key: 'ses', label: 'Email (SES)', icon: <Mail className="w-4 h-4" /> },
  { key: 'gmail', label: 'Gmail', icon: <GmailIcon className="w-4 h-4" /> },
];

const LLM_PROVIDER_TABS = [
  { key: 'openai', label: 'OpenAI' },
  { key: 'gemini', label: 'Gemini' },
  { key: 'deepseek', label: 'DeepSeek' },
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
            providerRows.map((s) => <SettingField key={s.key} setting={s} token={token} />)
          )}
        </div>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button onClick={copy} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0">
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function SetupStep({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
        {n}
      </div>
      <div>
        <p className="text-sm font-medium mb-0.5">{title}</p>
        <div className="text-xs text-muted-foreground space-y-1">{children}</div>
      </div>
    </div>
  );
}

function TelegramTab({ rows, token }: { rows: SettingRow[]; token: string }) {
  return (
    <div className="space-y-4">
      {/* Setup guide */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold mb-4">Setup Guide</h2>
        <div className="space-y-4">
          <SetupStep n={1} title="Create a bot">
            <p>Open Telegram and message <code className="bg-muted px-1 rounded">@BotFather</code></p>
            <p>Send <code className="bg-muted px-1 rounded">/newbot</code>, choose a name and username.</p>
            <p>BotFather replies with your <strong>bot token</strong> — copy it below.</p>
          </SetupStep>
          <SetupStep n={2} title="Get your Chat ID">
            <p>Message <code className="bg-muted px-1 rounded">@userinfobot</code> on Telegram — it replies with your Chat ID.</p>
            <p>Alternatively, message your new bot, then visit:</p>
            <code className="bg-muted px-1.5 py-0.5 rounded block mt-1 text-xs break-all">
              https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates
            </code>
            <p className="mt-1">Look for <code className="bg-muted px-1 rounded">"chat": {"{"}"id": 123456789{"}"}</code></p>
          </SetupStep>
          <SetupStep n={3} title="Paste credentials below">
            <p>Set both fields. The bot will send Approve / Reject / Follow-up buttons for every agent action.</p>
          </SetupStep>
        </div>
      </div>

      {/* Fields */}
      <div className="rounded-xl border border-border bg-card">
        <div className="px-5">
          {rows.length === 0
            ? <p className="text-sm text-muted-foreground py-6">No settings in this group.</p>
            : rows.map((s) => <SettingField key={s.key} setting={s} token={token} />)}
        </div>
      </div>
    </div>
  );
}

function SesTab({ rows, token }: { rows: SettingRow[]; token: string }) {
  const webhookUrl = `${window.location.origin}/ses/webhook`;

  return (
    <div className="space-y-4">
      {/* Webhook URL */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold mb-1">SNS Webhook URL</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Enter this URL when subscribing to your SNS topic for SES bounce and complaint events.
        </p>
        <div className="flex items-center gap-2 bg-muted/60 border border-border rounded-lg px-3 py-2">
          <code className="text-xs font-mono flex-1 break-all text-foreground">{webhookUrl}</code>
          <CopyButton text={webhookUrl} />
        </div>
      </div>

      {/* Setup guide */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold mb-4">SNS Setup Guide</h2>
        <div className="space-y-4">
          <SetupStep n={1} title="Create IAM user">
            <p>In AWS IAM, create a user with <code className="bg-muted px-1 rounded">ses:SendEmail</code> and <code className="bg-muted px-1 rounded">ses:SendRawEmail</code> permissions.</p>
            <p>Generate an access key and paste below.</p>
          </SetupStep>
          <SetupStep n={2} title="Verify sender domain / email">
            <p>In SES → Verified identities, verify your sending domain or email address.</p>
          </SetupStep>
          <SetupStep n={3} title="Create a Configuration Set">
            <p>In SES → Configuration Sets, create one (e.g. <code className="bg-muted px-1 rounded">ses-monitoring</code>).</p>
            <p>Add an SNS destination for <strong>Bounce</strong> and <strong>Complaint</strong> events.</p>
          </SetupStep>
          <SetupStep n={4} title="Subscribe SNS to the webhook">
            <p>In your SNS topic → Subscriptions, add an <strong>HTTPS</strong> subscription pointing to the URL above.</p>
            <p>AWS will send a confirmation request — the webhook confirms it automatically.</p>
          </SetupStep>
          <SetupStep n={5} title="Paste credentials below">
            <p>Set Access Key ID, Secret, Region, From Address, and Configuration Set name.</p>
          </SetupStep>
        </div>
        <a
          href="https://docs.aws.amazon.com/ses/latest/dg/monitor-sending-activity-using-notifications-sns.html"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-4"
        >
          AWS SES SNS notifications docs <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Fields */}
      <div className="rounded-xl border border-border bg-card">
        <div className="px-5">
          {rows.length === 0
            ? <p className="text-sm text-muted-foreground py-6">No settings in this group.</p>
            : rows.map((s) => <SettingField key={s.key} setting={s} token={token} />)}
        </div>
      </div>
    </div>
  );
}

function GmailTab({ rows, token }: { rows: SettingRow[]; token: string }) {
  return (
    <div className="space-y-4">
      {/* Setup guide */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold mb-4">OAuth2 Setup Guide</h2>
        <div className="space-y-4">
          <SetupStep n={1} title="Create a Google Cloud project">
            <p>Go to <strong>console.cloud.google.com</strong> → New Project.</p>
          </SetupStep>
          <SetupStep n={2} title="Enable Gmail API">
            <p>APIs & Services → Enable APIs → search <strong>Gmail API</strong> → Enable.</p>
          </SetupStep>
          <SetupStep n={3} title="Create OAuth2 credentials">
            <p>APIs & Services → Credentials → Create Credentials → OAuth client ID.</p>
            <p>Application type: <strong>Web application</strong>.</p>
            <p>Authorized redirect URI: <code className="bg-muted px-1 rounded">https://developers.google.com/oauthplayground</code></p>
          </SetupStep>
          <SetupStep n={4} title="Get a refresh token via OAuth Playground">
            <p>Open <a href="https://developers.google.com/oauthplayground" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">OAuth 2.0 Playground</a></p>
            <p>Click the gear icon → check <strong>"Use your own OAuth credentials"</strong>, paste your Client ID and Secret.</p>
            <p>In scope field enter: <code className="bg-muted px-1 rounded">https://mail.google.com/</code></p>
            <p>Authorize → Exchange auth code for tokens → copy the <strong>Refresh Token</strong>.</p>
          </SetupStep>
          <SetupStep n={5} title="Paste credentials below">
            <p>Set Client ID, Client Secret, Refresh Token, and From Address.</p>
          </SetupStep>
        </div>
      </div>

      {/* Fields */}
      <div className="rounded-xl border border-border bg-card">
        <div className="px-5">
          {rows.length === 0
            ? <p className="text-sm text-muted-foreground py-6">No settings in this group.</p>
            : rows.map((s) => <SettingField key={s.key} setting={s} token={token} />)}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const token = useAuthStore((s) => s.token)!;
  const [activeTab, setActiveTab] = useState('llm');

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
        API keys and configuration. Secrets are encrypted at rest and never shown in plaintext.
      </p>

      {/* Main tab bar */}
      <div className="flex items-center gap-1 border-b border-border mb-6">
        {MAIN_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

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

      {!isLoading && !isError && (
        <>
          {activeTab === 'llm' && <LlmTab rows={grouped['llm'] ?? []} token={token} />}
          {activeTab === 'telegram' && <TelegramTab rows={grouped['telegram'] ?? []} token={token} />}
          {activeTab === 'ses' && <SesTab rows={grouped['ses'] ?? []} token={token} />}
          {activeTab === 'gmail' && <GmailTab rows={grouped['gmail'] ?? []} token={token} />}
        </>
      )}
    </div>
  );
}
