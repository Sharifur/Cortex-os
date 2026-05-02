import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Cable, Save, Trash2, Eye, EyeOff, Key, Send, Mail, Copy, Check,
  ExternalLink, MessageSquare, Linkedin, Hash, Bot, FlaskConical,
  CheckCircle2, XCircle, Loader2, Plus, Globe, ToggleLeft, ToggleRight, Database, Sparkles, Shield, Pencil,
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
  { key: 'telegram', label: 'Telegram', icon: <Send className="w-4 h-4" /> },
  { key: 'ses', label: 'Email (SES)', icon: <Mail className="w-4 h-4" /> },
  { key: 'gmail', label: 'Gmail', icon: <Mail className="w-4 h-4" /> },
  { key: 'license', label: 'License Server', icon: <Key className="w-4 h-4" /> },
  { key: 'storage', label: 'Storage (R2)', icon: <Database className="w-4 h-4" /> },
  { key: 'insight', label: 'Taskip Insight', icon: <Sparkles className="w-4 h-4" /> },
  { key: 'safety', label: 'Safety', icon: <Shield className="w-4 h-4" /> },
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
  const apiOrigin = ((import.meta.env.VITE_API_URL ?? '') as string).replace(/\/$/, '') || window.location.origin;
  const webhookUrl = `${apiOrigin}/whatsapp/webhook`;
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
  const apiOrigin = ((import.meta.env.VITE_API_URL ?? '') as string).replace(/\/$/, '') || window.location.origin;
  const webhookUrl = `${apiOrigin}/ses/webhook`;
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

interface GmailAccount {
  id: string;
  label: string;
  email: string;
  displayName: string | null;
  authType: 'imap' | 'oauth2';
  isDefault: boolean;
  createdAt: string;
}

function GmailOAuthModal({ token, onClose }: { token: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [label, setLabel] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [redirectUri, setRedirectUri] = useState('');
  const [phase, setPhase] = useState<'form' | 'awaiting' | 'done'>('form');
  const [error, setError] = useState<string | null>(null);

  // Show the redirect URI early so the user can register it in Google Cloud
  // before submitting. We compute it the same way the backend does.
  useEffect(() => {
    setRedirectUri(`${window.location.origin}/gmail/oauth/callback`);
  }, []);

  // Listen for the postMessage from the OAuth callback page so we can refresh
  // the account list and close this modal as soon as Google redirects back.
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'gmail-oauth-success') {
        qc.invalidateQueries({ queryKey: ['gmail-accounts'] });
        setPhase('done');
        setTimeout(onClose, 800);
      } else if (e.data?.type === 'gmail-oauth-error') {
        setError(e.data.message ?? 'OAuth failed');
        setPhase('form');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [qc, onClose]);

  async function startOAuth() {
    setError(null);
    if (!label.trim() || !clientId.trim() || !clientSecret.trim()) {
      setError('Label, client ID and client secret are required');
      return;
    }
    try {
      const res = await fetch('/gmail/oauth/start', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, displayName: displayName || null, clientId, clientSecret, setDefault: setAsDefault }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message ?? `HTTP ${res.status}`);
      }
      const { authUrl } = await res.json();
      setPhase('awaiting');
      window.open(authUrl, '_blank', 'width=520,height=720');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-xl shadow-xl max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold text-sm">Connect with Google OAuth2</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><XCircle className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-4 text-sm">
          {phase === 'done' ? (
            <div className="text-center py-8 text-emerald-500">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3" />
              <div className="font-medium">Connected!</div>
            </div>
          ) : phase === 'awaiting' ? (
            <div className="text-center py-8">
              <Loader2 className="w-10 h-10 mx-auto mb-3 animate-spin text-primary" />
              <div className="font-medium mb-1">Waiting for Google consent…</div>
              <p className="text-xs text-muted-foreground">Approve in the popup window. This dialog will close automatically.</p>
              <button
                onClick={() => setPhase('form')}
                className="mt-4 text-xs text-muted-foreground hover:text-foreground underline"
              >
                Cancel and edit details
              </button>
            </div>
          ) : (
            <>
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-xs text-blue-300 space-y-1">
                <div className="font-semibold text-blue-200">Before submitting, register this redirect URI in Google Cloud:</div>
                <div className="font-mono break-all bg-blue-950/40 rounded px-2 py-1 mt-1">{redirectUri}</div>
                <p className="mt-1">
                  APIs & Services → Credentials → your OAuth client → <strong>Authorized redirect URIs</strong> → add the URI above. The Client ID + Secret below come from that same OAuth client.
                </p>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Label</label>
                <input
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Khairul (Workspace)"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Display name (optional)</label>
                <input
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Khairul"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">OAuth Client ID</label>
                <input
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="xxxxxxxxxx-xxxxxxxx.apps.googleusercontent.com"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">OAuth Client Secret</label>
                <input
                  type="password"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder="GOCSPX-..."
                  autoComplete="new-password"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={setAsDefault}
                  onChange={(e) => setSetAsDefault(e.target.checked)}
                />
                Set as default account
              </label>
              {error && <div className="text-xs text-red-500">{error}</div>}
            </>
          )}
        </div>
        {phase === 'form' && (
          <div className="flex justify-end gap-2 p-4 border-t border-border">
            <button onClick={onClose} className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg">Cancel</button>
            <button
              onClick={startOAuth}
              disabled={!label.trim() || !clientId.trim() || !clientSecret.trim()}
              className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              Continue with Google
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function GmailAccountModal({
  token,
  account,
  onClose,
}: {
  token: string;
  account: GmailAccount | null; // null = create
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [label, setLabel] = useState(account?.label ?? '');
  const [email, setEmail] = useState(account?.email ?? '');
  const [displayName, setDisplayName] = useState(account?.displayName ?? '');
  const [appPassword, setAppPassword] = useState('');
  const [isDefault, setIsDefault] = useState(account?.isDefault ?? false);
  const [error, setError] = useState<string | null>(null);

  const saveMut = useMutation({
    mutationFn: async () => {
      const url = account ? `/gmail/accounts/${account.id}` : '/gmail/accounts';
      const method = account ? 'PATCH' : 'POST';
      const body: Record<string, unknown> = { label, displayName: displayName || null };
      if (!account) {
        body.email = email;
        body.appPassword = appPassword;
        body.isDefault = isDefault;
      } else if (appPassword.trim()) {
        body.appPassword = appPassword;
      }
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gmail-accounts'] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const isCreate = !account;
  const canSubmit = isCreate
    ? !!label.trim() && !!email.trim() && !!appPassword.trim()
    : !!label.trim();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg mx-4 shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold text-sm">{isCreate ? 'Add Gmail account' : 'Edit account'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><XCircle className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Label</label>
            <input
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Khairul (workspace)"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Email address {isCreate ? '' : '(read-only)'}</label>
            <input
              type="email"
              disabled={!isCreate}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="khairul@trytaskip.com"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              App Password {isCreate ? '' : '(leave blank to keep current)'}
            </label>
            <input
              type="password"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
              placeholder="xxxx xxxx xxxx xxxx"
              autoComplete="new-password"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Generate at <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">myaccount.google.com/apppasswords</a> (2FA must be on). Spaces are stripped.
            </p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Display name (optional)</label>
            <input
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Khairul"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Shown in the From header. Defaults to email.</p>
          </div>
          {isCreate && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                className="accent-primary"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
              />
              Set as default account
            </label>
          )}
          {error && <div className="text-xs text-red-500">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg">Cancel</button>
          <button
            onClick={() => saveMut.mutate()}
            disabled={!canSubmit || saveMut.isPending}
            className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {saveMut.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function GmailTab({ token }: { rows: SettingRow[]; token: string }) {
  const qc = useQueryClient();
  const [modal, setModal] = useState<null | 'add' | 'oauth' | GmailAccount>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>({});

  const { data: accounts = [], isLoading } = useQuery<GmailAccount[]>({
    queryKey: ['gmail-accounts'],
    queryFn: async () => {
      const res = await fetch('/gmail/accounts', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const setDefaultMut = useMutation({
    mutationFn: (id: string) =>
      fetch(`/gmail/accounts/${id}/set-default`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => { if (!r.ok) throw new Error('Failed'); }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gmail-accounts'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      fetch(`/gmail/accounts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => { if (!r.ok) throw new Error('Failed'); }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gmail-accounts'] }),
  });

  const testMut = useMutation({
    mutationFn: async (id: string): Promise<{ id: string; result: { ok: boolean; message: string } }> => {
      const res = await fetch(`/gmail/accounts/${id}/test`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json();
      return { id, result };
    },
    onSuccess: ({ id, result }) => setTestResults((prev) => ({ ...prev, [id]: result })),
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold">Gmail accounts</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Used by the Taskip Internal agent for marketing / follow-up emails. Live chat uses AWS SES.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setModal('oauth')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded-lg hover:opacity-90 whitespace-nowrap shrink-0"
              title="Use OAuth2 — required for Workspace accounts where App Passwords are blocked"
            >
              <Plus className="w-3.5 h-3.5" /> Connect with OAuth
            </button>
            <button
              onClick={() => setModal('add')}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-sm rounded-lg hover:bg-accent/50 whitespace-nowrap shrink-0"
              title="Use IMAP + App Password — simpler for personal Gmail"
            >
              <Plus className="w-3.5 h-3.5" /> App Password
            </button>
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : accounts.length === 0 ? (
          <div className="bg-card border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
            No Gmail accounts yet. Click <strong>Add account</strong> to connect your first inbox.
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map((acc) => {
              const test = testResults[acc.id];
              return (
                <div key={acc.id} className="bg-card border border-border rounded-lg px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{acc.label}</span>
                        {acc.isDefault && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium">
                            default
                          </span>
                        )}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${acc.authType === 'oauth2' ? 'bg-blue-500/15 text-blue-400' : 'bg-muted text-muted-foreground'}`}>
                          {acc.authType === 'oauth2' ? 'OAuth2' : 'IMAP'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {acc.displayName ? `${acc.displayName} <${acc.email}>` : acc.email}
                      </p>
                      {test && (
                        <p className={`text-[11px] mt-1 ${test.ok ? 'text-emerald-500' : 'text-red-500'}`}>
                          {test.ok ? <CheckCircle2 className="w-3 h-3 inline mr-1" /> : <XCircle className="w-3 h-3 inline mr-1" />}
                          {test.message}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => testMut.mutate(acc.id)}
                        disabled={testMut.isPending}
                        className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border disabled:opacity-50"
                      >
                        {testMut.isPending && testMut.variables === acc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Test'}
                      </button>
                      {!acc.isDefault && (
                        <button
                          onClick={() => setDefaultMut.mutate(acc.id)}
                          className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border"
                          title="Make this the default account"
                        >
                          Set default
                        </button>
                      )}
                      {acc.authType === 'imap' && (
                        <button
                          onClick={() => setModal(acc)}
                          className="text-muted-foreground hover:text-foreground p-1.5"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (confirm(`Delete ${acc.email}? This cannot be undone.`)) {
                            deleteMut.mutate(acc.id);
                          }
                        }}
                        className="text-muted-foreground hover:text-destructive p-1.5"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <aside className="bg-muted/30 rounded-lg p-5 text-sm">
        <h2 className="text-sm font-semibold mb-4">IMAP Setup (App Password)</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Connects via Gmail's IMAP / SMTP endpoints using a 16-character App Password — no Google Cloud project needed.
          Works for Gmail and Workspace accounts (admin must allow IMAP and App Passwords).
        </p>
        <div className="space-y-4">
          <SetupStep n={1} title="Turn on 2-Step Verification">
            <p>
              <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">myaccount.google.com → Security</a> →
              enable <strong>2-Step Verification</strong>.
            </p>
          </SetupStep>
          <SetupStep n={2} title="Generate an App Password">
            <p>
              <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">myaccount.google.com/apppasswords</a> →
              name it <code className="bg-muted px-1 rounded">Cortex OS</code> → <strong>Create</strong>.
            </p>
          </SetupStep>
          <SetupStep n={3} title="Add the account here">
            <p>
              Click <strong>Add account</strong>, paste email + 16-char password. Mark one account as default.
            </p>
            <p className="text-muted-foreground">
              IMAP <code className="bg-muted px-1 rounded">imap.gmail.com:993</code> · SMTP <code className="bg-muted px-1 rounded">smtp.gmail.com:465</code>.
            </p>
          </SetupStep>
        </div>
      </aside>

      {modal === 'oauth' && (
        <GmailOAuthModal token={token} onClose={() => setModal(null)} />
      )}
      {modal !== null && modal !== 'oauth' && (
        <GmailAccountModal
          token={token}
          account={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
        />
      )}
    </div>
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

function SafetyTab({ rows, token }: { rows: SettingRow[]; token: string }) {
  return (
    <IntegrationLayout
      integrationKey="safety"
      rows={rows}
      token={token}
      docs={
        <>
          <h2 className="text-sm font-semibold mb-3">Kill switches</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Set any of these to <code className="bg-muted px-1 rounded">true</code> to immediately block
            the corresponding agent action across all agents and runs. Useful when something is misbehaving
            and you want to stop it without redeploying.
          </p>
          <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
            <li><strong>Block extend_trial</strong> — taskip_internal cannot extend trials</li>
            <li><strong>Block mark_refund</strong> — refund-marking is blocked</li>
            <li><strong>Block send_email</strong> — Gmail outbound is blocked across agents</li>
            <li><strong>Block insight_submit_marketing_suggestion</strong> — Taskip Insight marketing-suggestion writeback blocked</li>
            <li><strong>Block insight_submit_message</strong> — Insight lifecycle messaging (email + in-app) blocked</li>
          </ul>
          <p className="text-xs text-muted-foreground mt-3">
            Telegram approval is checked first; the kill switch is the last gate before execution.
          </p>
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
            <SetupStep n={5} title="Optional: connect a custom domain">
              <p>In R2 → bucket → <strong>Settings → Public Access</strong>, point a subdomain (e.g. <code className="bg-muted px-1 rounded">files.taskip.net</code>) at the bucket.</p>
              <p>Paste the full URL into <strong>Public CDN Base URL</strong>. When set, attachment URLs use this prefix and never expire. When blank, the API serves 24h presigned URLs.</p>
            </SetupStep>
            <SetupStep n={6} title="Test the connection">
              <p>Click <strong>Test connection</strong>. The API runs a put + delete probe against the bucket; success confirms credentials and bucket are valid.</p>
              <p>Storage is used by Knowledge Base ingestion (PDFs, DOCX) and live-chat attachments. Files are namespaced per module (e.g. <code className="bg-muted px-1 rounded">livechat/&lt;site&gt;/&lt;session&gt;/&lt;id&gt;.png</code>).</p>
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
          {activeTab === 'telegram' && <TelegramTab rows={grouped['telegram'] ?? []} token={token} />}
          {activeTab === 'ses' && <SesTab rows={grouped['ses'] ?? []} token={token} />}
          {activeTab === 'gmail' && <GmailTab rows={grouped['gmail'] ?? []} token={token} />}
          {activeTab === 'license' && <LicenseTab rows={grouped['license'] ?? []} token={token} />}
          {activeTab === 'storage' && <StorageTab rows={grouped['storage'] ?? []} token={token} />}
          {activeTab === 'insight' && <InsightTab rows={grouped['insight'] ?? []} token={token} />}
          {activeTab === 'safety' && <SafetyTab rows={grouped['safety'] ?? []} token={token} />}
        </>
      )}
    </div>
  );
}
