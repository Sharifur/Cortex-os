import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Cable, Save, Trash2, Eye, EyeOff, Key, Send, Mail, Copy, Check,
  ExternalLink, MessageSquare, Linkedin, Hash, Bot, FlaskConical,
  CheckCircle2, XCircle, Loader2, Plus, Globe, ToggleLeft, ToggleRight, Database, Sparkles,
} from 'lucide-react';
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

const TABS = [
  { key: 'whatsapp', label: 'WhatsApp', icon: <MessageSquare className="w-4 h-4" /> },
  { key: 'linkedin', label: 'LinkedIn', icon: <Linkedin className="w-4 h-4" /> },
  { key: 'reddit', label: 'Reddit', icon: <Hash className="w-4 h-4" /> },
  { key: 'crisp', label: 'Crisp', icon: <Bot className="w-4 h-4" /> },
  { key: 'telegram', label: 'Telegram', icon: <Send className="w-4 h-4" /> },
  { key: 'ses', label: 'Email (SES)', icon: <Mail className="w-4 h-4" /> },
  { key: 'gmail', label: 'Gmail', icon: <Mail className="w-4 h-4" /> },
  { key: 'license', label: 'License Server', icon: <Key className="w-4 h-4" /> },
  { key: 'storage', label: 'Storage (R2)', icon: <Database className="w-4 h-4" /> },
  { key: 'insight', label: 'Taskip Insight', icon: <Sparkles className="w-4 h-4" /> },
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

function FieldsCard({ rows, token }: { rows: SettingRow[]; token: string }) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="px-5">
        {rows.length === 0
          ? <p className="text-sm text-muted-foreground py-6">No settings in this group.</p>
          : rows.map((s) => <SettingField key={s.key} setting={s} token={token} />)}
      </div>
    </div>
  );
}

interface TestResult {
  ok: boolean;
  message: string;
}

function TestConnectionButton({ integrationKey, token }: { integrationKey: string; token: string }) {
  const [result, setResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);

  async function runTest() {
    setTesting(true);
    setResult(null);
    try {
      const res = await fetch(`/integrations/${integrationKey}/test`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: TestResult = await res.json();
      setResult(data);
    } catch {
      setResult({ ok: false, message: 'Request failed — check server logs' });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        onClick={runTest}
        disabled={testing}
      >
        {testing
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <FlaskConical className="w-3.5 h-3.5" />
        }
        {testing ? 'Testing...' : 'Test connection'}
      </Button>
      {result && (
        <span className={`flex items-center gap-1.5 text-sm font-medium ${result.ok ? 'text-green-400' : 'text-red-400'}`}>
          {result.ok
            ? <CheckCircle2 className="w-4 h-4 shrink-0" />
            : <XCircle className="w-4 h-4 shrink-0" />
          }
          {result.message}
        </span>
      )}
    </div>
  );
}

function IntegrationLayout({
  integrationKey,
  rows,
  token,
  docs,
  extraSettings,
}: {
  integrationKey: string;
  rows: SettingRow[];
  token: string;
  docs: React.ReactNode;
  extraSettings?: React.ReactNode;
}) {
  const [sub, setSub] = useState<'settings' | 'docs'>('settings');

  const storedCount = rows.filter((r) => r.stored).length;

  return (
    <div>
      <div className="flex items-center gap-1 border border-border rounded-lg p-1 mb-5 bg-muted/30 w-fit">
        <button
          onClick={() => setSub('settings')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
            sub === 'settings' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Settings
          {storedCount > 0 && (
            <span className="text-xs bg-green-500/15 text-green-400 px-1.5 py-0.5 rounded-full leading-none">
              {storedCount}/{rows.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setSub('docs')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
            sub === 'docs' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Docs
        </button>
      </div>

      {sub === 'settings' && (
        <div className="space-y-4">
          {extraSettings}
          <FieldsCard rows={rows} token={token} />
          <TestConnectionButton integrationKey={integrationKey} token={token} />
        </div>
      )}
      {sub === 'docs' && (
        <div className="rounded-xl border border-border bg-card p-5">
          {docs}
        </div>
      )}
    </div>
  );
}

function WhatsAppTab({ rows, token }: { rows: SettingRow[]; token: string }) {
  const webhookUrl = `${window.location.origin}/whatsapp/webhook`;
  return (
    <IntegrationLayout
      integrationKey="whatsapp"
      rows={rows}
      token={token}
      extraSettings={
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold mb-1">Webhook URL</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Enter this in Meta for Developers → WhatsApp → Configuration → Webhook.
          </p>
          <div className="flex items-center gap-2 bg-muted/60 border border-border rounded-lg px-3 py-2">
            <code className="text-xs font-mono flex-1 break-all text-foreground">{webhookUrl}</code>
            <CopyButton text={webhookUrl} />
          </div>
        </div>
      }
      docs={
        <>
          <h2 className="text-sm font-semibold mb-4">Setup Guide</h2>
          <div className="space-y-4">
            <SetupStep n={1} title="Create a Meta app">
              <p>Go to <strong>developers.facebook.com</strong> → My Apps → Create App.</p>
              <p>Select <strong>Business</strong> type, add the <strong>WhatsApp</strong> product.</p>
            </SetupStep>
            <SetupStep n={2} title="Add a phone number">
              <p>In WhatsApp → API Setup, add and verify your business phone number.</p>
              <p>Copy the <strong>Phone Number ID</strong> — paste it in Settings.</p>
            </SetupStep>
            <SetupStep n={3} title="Generate a system user token">
              <p>In <strong>Meta Business Suite → Settings → System Users</strong>, create a system user.</p>
              <p>Generate a token with <code className="bg-muted px-1 rounded">whatsapp_business_messaging</code> permission.</p>
            </SetupStep>
            <SetupStep n={4} title="Configure the webhook">
              <p>In WhatsApp → Configuration, set the callback URL to the webhook URL shown in Settings.</p>
              <p>Set the verify token to match <strong>Webhook Verify Token</strong>.</p>
              <p>Subscribe to <code className="bg-muted px-1 rounded">messages</code> field.</p>
            </SetupStep>
          </div>
          <a
            href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-4"
          >
            WhatsApp Cloud API docs <ExternalLink className="w-3 h-3" />
          </a>
        </>
      }
    />
  );
}

function LinkedInTab({ rows, token }: { rows: SettingRow[]; token: string }) {
  return (
    <IntegrationLayout
      integrationKey="linkedin"
      rows={rows}
      token={token}
      docs={
        <>
          <h2 className="text-sm font-semibold mb-4">Setup Guide</h2>
          <div className="space-y-4">
            <SetupStep n={1} title="Sign up for Unipile (recommended)">
              <p>Go to <strong>app.unipile.com</strong> and create an account.</p>
              <p>Connect your LinkedIn account under <strong>Accounts</strong>.</p>
              <p>In <strong>Settings → API Keys</strong>, generate a key and copy your DSN.</p>
              <p>Paste <strong>API Key</strong> and <strong>DSN</strong> in Settings — Unipile handles LinkedIn auth.</p>
            </SetupStep>
            <SetupStep n={2} title="Or use a direct access token (fallback)">
              <p>Create a LinkedIn app at <strong>linkedin.com/developers</strong>.</p>
              <p>Enable <code className="bg-muted px-1 rounded">w_member_social</code> and <code className="bg-muted px-1 rounded">r_liteprofile</code> scopes.</p>
              <p>Complete the OAuth2 flow and paste the <strong>Access Token</strong> in Settings.</p>
              <p className="text-yellow-500">Note: direct tokens expire — Unipile is preferred for stability.</p>
            </SetupStep>
          </div>
          <a
            href="https://docs.unipile.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-4"
          >
            Unipile docs <ExternalLink className="w-3 h-3" />
          </a>
        </>
      }
    />
  );
}

function RedditTab({ rows, token }: { rows: SettingRow[]; token: string }) {
  return (
    <IntegrationLayout
      integrationKey="reddit"
      rows={rows}
      token={token}
      docs={
        <>
          <h2 className="text-sm font-semibold mb-4">Setup Guide</h2>
          <div className="space-y-4">
            <SetupStep n={1} title="Create a Reddit script app">
              <p>Go to <strong>reddit.com/prefs/apps</strong> while logged in as the posting account.</p>
              <p>Click <strong>create another app</strong>, choose type <strong>script</strong>.</p>
              <p>Set redirect URI to <code className="bg-muted px-1 rounded">http://localhost</code> (not used for script apps).</p>
            </SetupStep>
            <SetupStep n={2} title="Copy credentials">
              <p>The string under the app name is your <strong>Client ID</strong>.</p>
              <p>The <strong>secret</strong> field is your Client Secret.</p>
            </SetupStep>
            <SetupStep n={3} title="Paste credentials in Settings">
              <p>Enter Client ID, Client Secret, Reddit Username, and Password.</p>
              <p>The agent uses the OAuth2 password flow — tokens are cached and refreshed automatically.</p>
            </SetupStep>
          </div>
          <a
            href="https://www.reddit.com/wiki/api"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-4"
          >
            Reddit API docs <ExternalLink className="w-3 h-3" />
          </a>
        </>
      }
    />
  );
}

interface CrispWebsite {
  id: string;
  label: string;
  websiteId: string;
  identifier: string;
  apiKeyMasked: string;
  enabled: boolean;
  createdAt: string;
}

function CrispTab({ token }: { token: string }) {
  const qc = useQueryClient();
  const webhookUrl = `${window.location.origin}/crisp/webhook`;
  const [sub, setSub] = useState<'settings' | 'docs'>('settings');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ label: '', websiteId: '', identifier: '', apiKey: '' });
  const [showKey, setShowKey] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [testingId, setTestingId] = useState<string | null>(null);

  const { data: sites = [], isLoading } = useQuery<CrispWebsite[]>({
    queryKey: ['crisp-websites'],
    queryFn: async () => {
      const res = await fetch('/crisp/websites', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to load');
      return res.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/crisp/websites', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Failed to add');
    },
    onSuccess: () => {
      setAdding(false);
      setForm({ label: '', websiteId: '', identifier: '', apiKey: '' });
      qc.invalidateQueries({ queryKey: ['crisp-websites'] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const res = await fetch(`/crisp/websites/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error('Failed to update');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crisp-websites'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/crisp/websites/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crisp-websites'] }),
  });

  async function testSite(id: string) {
    setTestingId(id);
    try {
      const res = await fetch(`/crisp/websites/${id}/test`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setTestResults((prev) => ({ ...prev, [id]: data }));
    } catch {
      setTestResults((prev) => ({ ...prev, [id]: { ok: false, message: 'Request failed' } }));
    } finally {
      setTestingId(null);
    }
  }

  const formValid = form.label && form.websiteId && form.identifier && form.apiKey;

  return (
    <div>
      <div className="flex items-center gap-1 border border-border rounded-lg p-1 mb-5 bg-muted/30 w-fit">
        <button onClick={() => setSub('settings')}
          className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${sub === 'settings' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          Settings
        </button>
        <button onClick={() => setSub('docs')}
          className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${sub === 'docs' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          Docs
        </button>
      </div>

      {sub === 'settings' && (
        <div className="space-y-4">
          {/* Webhook URL */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold mb-1">Webhook URL</h2>
            <p className="text-xs text-muted-foreground mb-3">
              Add this in Crisp to enable real-time replies. Without it the agent polls every 15 minutes.
            </p>
            <div className="flex items-center gap-2 bg-muted/60 border border-border rounded-lg px-3 py-2">
              <code className="text-xs font-mono flex-1 break-all text-foreground">{webhookUrl}</code>
              <CopyButton text={webhookUrl} />
            </div>
          </div>

          {/* Website list */}
          <div className="rounded-xl border border-border bg-card">
            <div className="px-5 py-4 flex items-center justify-between border-b border-border">
              <div>
                <p className="text-sm font-semibold">Connected websites</p>
                <p className="text-xs text-muted-foreground mt-0.5">{sites.length} configured</p>
              </div>
              {!adding && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAdding(true)}>
                  <Plus className="w-3.5 h-3.5" />Add website
                </Button>
              )}
            </div>

            {isLoading && (
              <div className="px-5 py-4 space-y-3">
                {[1, 2].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
              </div>
            )}

            {!isLoading && sites.length === 0 && !adding && (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                No websites configured. Add one to get started.
              </div>
            )}

            {!isLoading && sites.map((site) => (
              <div key={site.id} className="px-5 py-4 border-b border-border last:border-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium">{site.label}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${site.enabled ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'}`}>
                        {site.enabled ? 'enabled' : 'disabled'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">{site.websiteId}</p>
                    {testResults[site.id] && (
                      <span className={`flex items-center gap-1 text-xs mt-1 ${testResults[site.id].ok ? 'text-green-400' : 'text-red-400'}`}>
                        {testResults[site.id].ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {testResults[site.id].message}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="ghost" className="text-muted-foreground px-2"
                      onClick={() => testSite(site.id)} disabled={testingId === site.id}>
                      {testingId === site.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FlaskConical className="w-3.5 h-3.5" />}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-muted-foreground px-2"
                      onClick={() => toggleMutation.mutate({ id: site.id, enabled: !site.enabled })}>
                      {site.enabled
                        ? <ToggleRight className="w-4 h-4 text-green-500" />
                        : <ToggleLeft className="w-4 h-4" />}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive px-2"
                      onClick={() => deleteMutation.mutate(site.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {/* Add form */}
            {adding && (
              <div className="px-5 py-4 border-t border-border space-y-3">
                <p className="text-sm font-medium">Add website</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Label</label>
                    <Input placeholder="e.g. Taskip" value={form.label}
                      onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} className="text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Website ID</label>
                    <Input placeholder="from Crisp → Settings → Setup"
                      value={form.websiteId}
                      onChange={(e) => setForm((f) => ({ ...f, websiteId: e.target.value }))} className="text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">API Identifier</label>
                    <Input placeholder="from Crisp → API Keys"
                      value={form.identifier}
                      onChange={(e) => setForm((f) => ({ ...f, identifier: e.target.value }))} className="text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">API Key</label>
                    <div className="relative">
                      <Input type={showKey ? 'text' : 'password'}
                        placeholder="secret"
                        value={form.apiKey}
                        onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                        className="text-sm pr-9" />
                      <button type="button" onClick={() => setShowKey((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => addMutation.mutate()}
                    disabled={!formValid || addMutation.isPending}>
                    {addMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                    Save
                  </Button>
                  <Button size="sm" variant="ghost"
                    onClick={() => { setAdding(false); setForm({ label: '', websiteId: '', identifier: '', apiKey: '' }); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {sub === 'docs' && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold mb-4">Setup Guide</h2>
          <div className="space-y-4">
            <SetupStep n={1} title="Log in to Crisp and open your website">
              <p>Go to <strong>app.crisp.chat</strong> → select your website → <strong>Settings</strong>.</p>
            </SetupStep>
            <SetupStep n={2} title="Copy your Website ID">
              <p>Settings → <strong>Setup</strong> → copy the <strong>Website ID</strong> at the top.</p>
            </SetupStep>
            <SetupStep n={3} title="Generate API keys">
              <p>Settings → <strong>API Keys</strong> → create a new key pair.</p>
              <p>Copy both the <strong>Identifier</strong> (not secret) and the <strong>Key</strong> (secret).</p>
            </SetupStep>
            <SetupStep n={4} title="Add the website in Settings">
              <p>Click <strong>Add website</strong>, fill in the label, Website ID, Identifier, and API Key.</p>
              <p>Repeat for each Crisp website (e.g. Taskip, Xgenious).</p>
            </SetupStep>
            <SetupStep n={5} title="Add the webhook for real-time replies">
              <p>In Crisp → Settings → <strong>Integrations</strong> → <strong>Webhooks</strong> → <strong>Add webhook</strong>.</p>
              <p>Paste the Webhook URL from Settings. Enable the <code className="bg-muted px-1 rounded">message:send</code> event.</p>
              <p>The agent replies instantly instead of waiting for the 15-minute cron.</p>
            </SetupStep>
          </div>
          <a href="https://docs.crisp.chat/references/rest-api/v1/" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-4">
            Crisp REST API docs <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
}

function TelegramTab({ rows, token }: { rows: SettingRow[]; token: string }) {
  return (
    <IntegrationLayout
      integrationKey="telegram"
      rows={rows}
      token={token}
      docs={
        <>
          <h2 className="text-sm font-semibold mb-4">Setup Guide</h2>
          <div className="space-y-4">
            <SetupStep n={1} title="Create a bot">
              <p>Open Telegram and message <code className="bg-muted px-1 rounded">@BotFather</code></p>
              <p>Send <code className="bg-muted px-1 rounded">/newbot</code>, choose a name and username.</p>
              <p>BotFather replies with your <strong>bot token</strong> — copy it into Settings.</p>
            </SetupStep>
            <SetupStep n={2} title="Get your Chat ID">
              <p>Message <code className="bg-muted px-1 rounded">@userinfobot</code> — it replies with your Chat ID.</p>
              <p>Alternatively, message your bot then visit:</p>
              <code className="bg-muted px-1.5 py-0.5 rounded block mt-1 text-xs break-all">
                https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates
              </code>
              <p className="mt-1">Look for <code className="bg-muted px-1 rounded">"chat": {"{"}"id": 123456789{"}"}</code></p>
            </SetupStep>
            <SetupStep n={3} title="Paste credentials in Settings">
              <p>Set both fields. Telegram is used for all Approve / Reject / Follow-up actions.</p>
            </SetupStep>
          </div>
        </>
      }
    />
  );
}

function SesTab({ rows, token }: { rows: SettingRow[]; token: string }) {
  const webhookUrl = `${window.location.origin}/ses/webhook`;
  return (
    <IntegrationLayout
      integrationKey="ses"
      rows={rows}
      token={token}
      extraSettings={
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
      }
      docs={
        <>
          <h2 className="text-sm font-semibold mb-4">SNS Setup Guide</h2>
          <div className="space-y-4">
            <SetupStep n={1} title="Create IAM user">
              <p>In AWS IAM, create a user with <code className="bg-muted px-1 rounded">ses:SendEmail</code> and <code className="bg-muted px-1 rounded">ses:SendRawEmail</code> permissions.</p>
              <p>Generate an access key and paste in Settings.</p>
            </SetupStep>
            <SetupStep n={2} title="Verify sender domain / email">
              <p>In SES → Verified identities, verify your sending domain or email address.</p>
            </SetupStep>
            <SetupStep n={3} title="Create a Configuration Set">
              <p>In SES → Configuration Sets, create one (e.g. <code className="bg-muted px-1 rounded">ses-monitoring</code>).</p>
              <p>Add an SNS destination for <strong>Bounce</strong> and <strong>Complaint</strong> events.</p>
            </SetupStep>
            <SetupStep n={4} title="Subscribe SNS to the webhook">
              <p>In your SNS topic → Subscriptions, add an <strong>HTTPS</strong> subscription pointing to the URL in Settings.</p>
              <p>AWS confirms it automatically.</p>
            </SetupStep>
          </div>
          <a
            href="https://docs.aws.amazon.com/ses/latest/dg/monitor-sending-activity-using-notifications-sns.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-4"
          >
            AWS SES SNS docs <ExternalLink className="w-3 h-3" />
          </a>
        </>
      }
    />
  );
}

function GmailTab({ rows, token }: { rows: SettingRow[]; token: string }) {
  return (
    <IntegrationLayout
      integrationKey="gmail"
      rows={rows}
      token={token}
      docs={
        <>
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
              <p>Gear icon → check <strong>"Use your own OAuth credentials"</strong>, paste Client ID and Secret.</p>
              <p>Scope: <code className="bg-muted px-1 rounded">https://mail.google.com/</code></p>
              <p>Authorize → Exchange auth code → copy the <strong>Refresh Token</strong>.</p>
            </SetupStep>
          </div>
        </>
      }
    />
  );
}

function LicenseTab({ rows, token }: { rows: SettingRow[]; token: string }) {
  return (
    <IntegrationLayout
      integrationKey="license"
      rows={rows}
      token={token}
      docs={
        <>
          <h2 className="text-sm font-semibold mb-4">Setup Guide</h2>
          <div className="space-y-4">
            <SetupStep n={1} title="Open the license server dashboard">
              <p>Go to your Xgenious license server → <strong>Dashboard → Public API</strong>.</p>
            </SetupStep>
            <SetupStep n={2} title="Create an application">
              <p>Click <strong>Create</strong>, set a name (e.g. "Cortex OS"), enable the <code className="bg-muted px-1 rounded">envato.verify</code> scope.</p>
              <p>Copy the generated <strong>X-Signature</strong> — it is shown only once.</p>
            </SetupStep>
            <SetupStep n={3} title="Paste credentials in Settings">
              <p>Set the <strong>License Server URL</strong> (base URL without trailing slash) and paste the signature.</p>
              <p>Set <strong>Default Envato Account</strong> to the slug used by your products (e.g. <code className="bg-muted px-1 rounded">xgenious</code>).</p>
            </SetupStep>
            <SetupStep n={4} title="Test the connection">
              <p>Click <strong>Test connection</strong> — a valid signature returns "License server reachable".</p>
              <p>After setup, the Crisp and Support agents will automatically verify purchase codes found in customer messages before generating replies.</p>
            </SetupStep>
          </div>
        </>
      }
    />
  );
}

function InsightTab({ rows, token }: { rows: SettingRow[]; token: string }) {
  return (
    <IntegrationLayout
      integrationKey="insight"
      rows={rows}
      token={token}
      docs={
        <>
          <h2 className="text-sm font-semibold mb-4">Taskip Insight API</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Server-to-server integration with Taskip's Insight module. The Taskip Internal agent uses these
            credentials to read cohort segmentation, workspace overviews (with volume metrics + session blocks),
            and write back marketing suggestions.
          </p>
          <div className="space-y-4">
            <SetupStep n={1} title="Get the agent key from the Taskip backend">
              <p>
                In Taskip, set <code className="bg-muted px-1 rounded">INSIGHT_AGENT_KEY_PRIMARY</code> (and optionally
                <code className="bg-muted px-1 rounded">INSIGHT_AGENT_KEY_SECONDARY</code> for zero-downtime rotation).
                Copy the same value here.
              </p>
            </SetupStep>
            <SetupStep n={2} title="Set the base URL">
              <p>
                Format: <code className="bg-muted px-1 rounded">https://taskip.net/api/internal/insight</code>.
                Trailing slash is stripped automatically.
              </p>
            </SetupStep>
            <SetupStep n={3} title="Test the connection">
              <p>
                Open <strong>Agents → Taskip Internal → Setup</strong> and use the <strong>Test connection</strong> button
                with a sample workspace UUID. A reachable response shows the schema version (currently <code className="bg-muted px-1 rounded">1</code>).
              </p>
            </SetupStep>
            <SetupStep n={4} title="Rotation procedure">
              <p>
                When rotating: paste the new key into the <strong>Secondary</strong> slot (both keys are accepted),
                deploy Taskip with the new key as primary, then promote the secondary into the primary slot here and clear the secondary.
              </p>
            </SetupStep>
          </div>
        </>
      }
    />
  );
}

function StorageTab({ rows, token }: { rows: SettingRow[]; token: string }) {
  return (
    <IntegrationLayout
      integrationKey="storage"
      rows={rows}
      token={token}
      docs={
        <>
          <h2 className="text-sm font-semibold mb-4">Cloudflare R2 Setup</h2>
          <div className="space-y-4">
            <SetupStep n={1} title="Create an R2 bucket">
              <p>Go to <strong>Cloudflare Dashboard → R2</strong> and create a bucket (e.g. <code className="bg-muted px-1 rounded">cortex</code>).</p>
            </SetupStep>
            <SetupStep n={2} title="Generate an R2 API token">
              <p>In Cloudflare Dashboard → R2 → <strong>Manage R2 API Tokens</strong> → Create API Token.</p>
              <p>Grant <strong>Object Read & Write</strong> permissions. Copy the Access Key ID and Secret Access Key — shown only once.</p>
            </SetupStep>
            <SetupStep n={3} title="Find your Account ID">
              <p>In Cloudflare Dashboard → R2, your <strong>Account ID</strong> is shown on the right side of the page.</p>
              <p>The endpoint format is: <code className="bg-muted px-1 rounded">&lt;account-id&gt;.r2.cloudflarestorage.com</code></p>
            </SetupStep>
            <SetupStep n={4} title="Paste credentials in Settings">
              <p>Set <strong>Endpoint</strong>, <strong>Access Key ID</strong>, <strong>Secret Access Key</strong>, and <strong>Bucket Name</strong>.</p>
              <p>Leave Port as <code className="bg-muted px-1 rounded">443</code> and Use SSL as <code className="bg-muted px-1 rounded">true</code> for R2.</p>
            </SetupStep>
            <SetupStep n={5} title="Test the connection">
              <p>Click <strong>Test connection</strong>. A successful test confirms the bucket is reachable.</p>
              <p>Storage is used for knowledge base file ingestion (PDFs, DOCX).</p>
            </SetupStep>
          </div>
          <a
            href="https://developers.cloudflare.com/r2/api/s3/api/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-4"
          >
            Cloudflare R2 S3-compatible API docs <ExternalLink className="w-3 h-3" />
          </a>
        </>
      }
    />
  );
}

export default function IntegrationsPage() {
  const token = useAuthStore((s) => s.token)!;
  const [activeTab, setActiveTab] = useState('whatsapp');

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
        <Cable className="w-5 h-5 text-primary" />
        <h1 className="text-2xl font-semibold">Integrations</h1>
      </div>
      <p className="text-muted-foreground text-sm mb-6">
        Connect external services. Credentials are encrypted at rest and never shown in plaintext.
      </p>

      <div className="flex items-center gap-1 border-b border-border mb-6 flex-wrap">
        {TABS.map((tab) => (
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
                  <Skeleton className="h-4 w-36 rounded" />
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
          {activeTab === 'whatsapp' && <WhatsAppTab rows={grouped['whatsapp'] ?? []} token={token} />}
          {activeTab === 'linkedin' && <LinkedInTab rows={grouped['linkedin'] ?? []} token={token} />}
          {activeTab === 'reddit' && <RedditTab rows={grouped['reddit'] ?? []} token={token} />}
          {activeTab === 'crisp' && <CrispTab token={token} />}
          {activeTab === 'telegram' && <TelegramTab rows={grouped['telegram'] ?? []} token={token} />}
          {activeTab === 'ses' && <SesTab rows={grouped['ses'] ?? []} token={token} />}
          {activeTab === 'gmail' && <GmailTab rows={grouped['gmail'] ?? []} token={token} />}
          {activeTab === 'license' && <LicenseTab rows={grouped['license'] ?? []} token={token} />}
          {activeTab === 'storage' && <StorageTab rows={grouped['storage'] ?? []} token={token} />}
          {activeTab === 'insight' && <InsightTab rows={grouped['insight'] ?? []} token={token} />}
        </>
      )}
    </div>
  );
}
