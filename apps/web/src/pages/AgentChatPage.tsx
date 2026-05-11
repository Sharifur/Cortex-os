import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link, useLocation, useSearchParams } from 'react-router-dom';
import {
  Bot, ArrowLeft, Send, Loader2, RefreshCw,
  Calendar, Clock, CheckCircle2, XCircle,
  AlertCircle, MessageSquare, ListTodo, RotateCcw, History, X,
  ThumbsUp, ThumbsDown, ImagePlus, Copy, Mail, Check, Wrench, Zap,
  Bold, Italic, List, Radio,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/authStore';
import { agentColor } from '@/lib/agent-colors';
import { getAgentSuggestions } from '@/lib/agentTaskSuggestions';
import { isGreetingExact } from '@/lib/greetings';

interface AgentInfo {
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  registered: boolean;
  triggers: { type: string; cron?: string }[];
}

function SuggestionChips({ agentKey, onPick }: { agentKey: string; onPick: (s: string) => void }) {
  const items = getAgentSuggestions(agentKey);
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 pb-2 px-1">
      {items.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onPick(s)}
          className="text-[11px] px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          {s}
        </button>
      ))}
    </div>
  );
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

interface ConvSummary {
  conversationId: string;
  startedAt: string;
  lastActivityAt: string;
  messageCount: number;
  preview: string | null;
}

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

const EMAIL_DRAFT_PREFIX = '__EMAIL_DRAFT__:';

interface InlineEmail {
  before: string;       // reasoning block shown above the card
  subject: string;      // recommended subject
  subjectAlt?: string;  // alternate subject (B when A recommended, or vice versa)
  body: string;
  after: string;
  selfScore?: string;   // e.g. "5/5"
  to?: string;          // recipient email from **To:** line
}

function cleanSubject(raw: string): string {
  return raw.trim().replace(/^["']|["']$/g, '').replace(/\*+$/g, '').trim();
}

// Strip Subject A/B / Recommended lines from the reasoning block so the
// "before" bubble only shows Signal/Persona/Angle, not duplicated subject lines.
function stripSubjectLines(text: string): string {
  return text
    .split('\n')
    .filter(line => !/^\*{0,2}Subject\s*[AB]?\s*:/i.test(line.trim()) &&
                    !/^\*{0,2}Recommended:/i.test(line.trim()) &&
                    !/^\*{0,2}To:\*{0,2}\s/i.test(line.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Handles two formats:
//   SPAR:   **Subject A/B:** … **Recommended:** A … **Email:** \n body **Self-score:** …
//   Legacy: **Subject:** … **Body:** \n body
function extractInlineEmail(text: string): InlineEmail | null {
  // ── SPAR format ──────────────────────────────────────────────────────────────
  // emailMarkerRe: **Email:** optionally followed by a space/newline, or body on same line
  const emailMarkerRe = /\*{0,2}Email:\*{0,2}\s*\n?/i;
  const emailMarkerIdx = text.search(emailMarkerRe);

  if (emailMarkerIdx >= 0) {
    const markerMatch = text.match(emailMarkerRe)!;
    const bodyStart = emailMarkerIdx + markerMatch[0].length;
    const afterEmail = text.slice(bodyStart);

    // Body ends at **Self-score:**, **Recommended:**, or another **bold:** meta-line
    const selfScoreRe = /\n\*{0,2}Self-score:/i;
    const selfScoreIdx = afterEmail.search(selfScoreRe);
    const body = (selfScoreIdx >= 0 ? afterEmail.slice(0, selfScoreIdx) : afterEmail).trim();

    // Extract self-score value e.g. "5/5"
    let selfScore: string | undefined;
    if (selfScoreIdx >= 0) {
      const scoreMatch = afterEmail.slice(selfScoreIdx).match(/Self-score:\*{0,2}\s*(\d\/\d)/i);
      if (scoreMatch) selfScore = scoreMatch[1];
    }

    // Recommended: pick A or B — match first letter after the colon, ignoring — dashes
    const recommendedMatch = text.match(/\*{0,2}Recommended:\*{0,2}\s*([AB])\b/i);
    const pick = recommendedMatch ? recommendedMatch[1].toUpperCase() : 'A';
    const other = pick === 'A' ? 'B' : 'A';

    // Subject regex: **Subject A:** or **SubjectA:** (with or without space)
    const makeSubjectRe = (letter: string) =>
      new RegExp(`\\*{0,2}Subject\\s*${letter}:\\*{0,2}\\s*([^\\n]+)`, 'i');

    const subjectMatch = text.match(makeSubjectRe(pick));
    const altMatch = text.match(makeSubjectRe(other));

    const subject = subjectMatch ? cleanSubject(subjectMatch[1]) : '';
    const subjectAlt = altMatch ? cleanSubject(altMatch[1]) : undefined;

    // "before" = reasoning block only (strip Subject A/B/Recommended lines)
    const rawBefore = text.slice(0, emailMarkerIdx).replace(/\n?---\s*$/, '');
    const before = stripSubjectLines(rawBefore);

    // Extract **To:** recipient email
    const toMatch = text.match(/\*{0,2}To:\*{0,2}\s*([^\s\n]+)/i);
    const to = toMatch ? toMatch[1].trim() : undefined;

    if (subject && body) return { before, subject, subjectAlt, body, after: '', selfScore, to };
  }

  // ── Legacy format (Subject: / Body:) ─────────────────────────────────────────
  const subjectRe = /\*{0,2}Subject:\*{0,2}\s*(.+)/i;
  const bodyRe = /\*{0,2}Body:\*{0,2}\s*\n?([\s\S]+)/i;

  const subjectMatch = text.match(subjectRe);
  if (!subjectMatch) return null;
  const subjectIdx = text.search(subjectRe);

  const afterSubject = text.slice(subjectIdx);
  const bodyMatch = afterSubject.match(bodyRe);
  if (!bodyMatch) return null;

  const subject = cleanSubject(subjectMatch[1]);
  const rawBody = bodyMatch[1];
  const separatorIdx = rawBody.search(/\n---\s*\n|\n\n(?=\w{1,30}\s+you\b|\[|\*\*)/);
  const body = separatorIdx >= 0 ? rawBody.slice(0, separatorIdx).trim() : rawBody.trim();
  const after = separatorIdx >= 0 ? rawBody.slice(separatorIdx).replace(/^[\s-]+/, '').trim() : '';
  const before = text.slice(0, subjectIdx).replace(/\n?---\s*$/, '').trim();

  if (!subject || !body) return null;
  return { before, subject, body, after };
}

function extractResponse(run: RunDetail): string {
  if (run.status === 'FAILED') return `Error: ${run.error ?? 'Run failed'}`;
  if (run.status === 'REJECTED') return 'Action was rejected.';

  const actions = run.proposedActions ?? [];
  if (!actions.length) return 'Done.';

  const emailAction = actions.find((a) => a.type === 'send_email');
  if (emailAction?.payload) {
    const { subject, body, recipient } = emailAction.payload as { subject?: string; body?: string; recipient?: string };
    if (subject && body) {
      return EMAIL_DRAFT_PREFIX + JSON.stringify({ subject, body, recipient, summary: emailAction.summary });
    }
  }

  const notify = actions.find((a) =>
    ['notify_result', 'send_telegram_brief', 'notify_email'].includes(a.type),
  );
  if (notify?.payload?.['message']) return String(notify.payload['message']);

  const batchAction = actions.find((a) => a.type === 'batch_send_email');
  if (batchAction) {
    const emails = (batchAction.payload as any)?.emails ?? [];
    const lines = [`Batch email ready — ${emails.length} email${emails.length !== 1 ? 's' : ''} awaiting Telegram approval:`, ''];
    for (const [i, e] of emails.entries()) {
      lines.push(`${i + 1}. **${e.recipient}** — ${e.subject}`);
    }
    lines.push('', 'Approve or reject via Telegram.');
    return lines.join('\n');
  }

  const approval = actions.find((a) => ['extend_trial', 'mark_refund', 'send_reply'].includes(a.type));
  if (approval) return `Awaiting Telegram approval: ${approval.summary}`;

  return actions.map((a) => a.summary).join('\n') || 'Done.';
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function renderMarkdown(text: string): string {
  let s = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  // Tables: detect lines with | separators
  s = s.replace(/^(\|.+\|\n?)+/gm, (table) => {
    const rows = table.trim().split('\n').filter(Boolean);
    if (rows.length < 2) return table;
    const header = rows[0].split('|').filter((_, i, a) => i > 0 && i < a.length - 1).map(c => `<th class="px-3 py-1.5 text-left text-xs font-semibold border-b border-border">${c.trim()}</th>`).join('');
    const body = rows.slice(2).map(r => {
      const cells = r.split('|').filter((_, i, a) => i > 0 && i < a.length - 1).map(c => `<td class="px-3 py-1.5 text-xs border-b border-border/50">${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `<div class="overflow-x-auto my-2"><table class="w-full border border-border rounded-lg overflow-hidden"><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></div>`;
  });
  // Code blocks
  s = s.replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre class="bg-muted rounded-md p-3 text-xs font-mono overflow-x-auto my-2"><code>$1</code></pre>');
  // Inline code
  s = s.replace(/`([^`\n]+)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-xs font-mono">$1</code>');
  // Bold
  s = s.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
  // Italic
  s = s.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');
  // Links
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="underline text-primary">$1</a>');
  // Headings
  s = s.replace(/^### (.+)$/gm, '<h3 class="font-semibold text-sm mt-3 mb-1">$1</h3>');
  s = s.replace(/^## (.+)$/gm, '<h2 class="font-semibold text-base mt-3 mb-1">$1</h2>');
  s = s.replace(/^# (.+)$/gm, '<h1 class="font-bold text-lg mt-3 mb-1">$1</h1>');
  // Unordered lists
  s = s.replace(/^[-*] (.+)$/gm, '<li class="ml-4 list-disc text-sm">$1</li>');
  s = s.replace(/(<li[^>]*>.*<\/li>\n?)+/g, (m) => `<ul class="my-1 space-y-0.5">${m}</ul>`);
  // Numbered lists
  s = s.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-sm">$1</li>');
  // Line breaks
  s = s.replace(/\n/g, '<br>');
  return s;
}

// ─── Email draft card ─────────────────────────────────────────────────────────

// ─── Send email modal ─────────────────────────────────────────────────────────

interface GmailAccountOption { id: string; label: string; email: string; isDefault: boolean; }

function insertAtCursor(el: HTMLTextAreaElement, before: string, after: string) {
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const selected = el.value.slice(start, end);
  const replacement = before + (selected || 'text') + after;
  el.setRangeText(replacement, start, end, 'select');
  el.focus();
}

function toggleBullets(el: HTMLTextAreaElement) {
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const val = el.value;
  const lineStart = val.lastIndexOf('\n', start - 1) + 1;
  const lineEnd = val.indexOf('\n', end);
  const block = val.slice(lineStart, lineEnd === -1 ? val.length : lineEnd);
  const lines = block.split('\n');
  const allBullets = lines.every(l => l.startsWith('- '));
  const toggled = lines.map(l => allBullets ? l.replace(/^- /, '') : `- ${l}`).join('\n');
  el.setRangeText(toggled, lineStart, lineEnd === -1 ? val.length : lineEnd, 'preserve');
  el.focus();
}

function SendEmailModal({
  to, subject, body, token,
  onClose, onSent, trackedSend,
}: {
  to?: string; subject: string; body: string; token: string;
  onClose: () => void;
  onSent?: (emailId?: string) => void;
  trackedSend?: boolean;
}) {
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const { data: accounts, isLoading } = useQuery<GmailAccountOption[]>({
    queryKey: ['gmail-accounts-send'],
    queryFn: async () => {
      const res = await fetch('/gmail/accounts', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to load accounts');
      return res.json();
    },
  });

  const defaultAccount = accounts?.find(a => a.isDefault) ?? accounts?.[0];
  const [selectedId, setSelectedId] = useState<string>('');
  const [toValue, setToValue] = useState(to ?? '');
  const [subjectValue, setSubjectValue] = useState(subject);
  const [bodyValue, setBodyValue] = useState(body);
  const [plainText, setPlainText] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wordCount = bodyValue.trim() ? bodyValue.trim().split(/\s+/).length : 0;

  useEffect(() => {
    if (defaultAccount && !selectedId) setSelectedId(defaultAccount.id);
  }, [defaultAccount, selectedId]);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [bodyValue]);

  async function handleSend() {
    if (!selectedId || !toValue.trim()) return;
    setSending(true);
    setError(null);
    try {
      const endpoint = trackedSend ? '/taskip-internal/inbox/send' : '/gmail/send';
      const payload = trackedSend
        ? { recipient: toValue.trim(), subject: subjectValue, textBody: bodyValue, accountId: selectedId, purpose: 'marketing', plainText }
        : { accountId: selectedId, to: toValue.trim(), subject: subjectValue, textBody: bodyValue };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any).message ?? `HTTP ${res.status}`);
      setDone(true);
      onSent?.((data as any).id);
      setTimeout(onClose, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSend(); }}
    >
      <div
        className="bg-card border border-border rounded-xl w-full max-w-md shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Send Email</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <XCircle className="w-4 h-4" />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-2 py-10 text-emerald-500">
            <CheckCircle2 className="w-8 h-8" />
            <span className="text-sm font-medium">Sent!</span>
          </div>
        ) : (
          <div className="p-4 space-y-4 text-sm">
            {/* To */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">To</label>
              <input
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                value={toValue}
                onChange={e => setToValue(e.target.value)}
                placeholder="recipient@example.com"
              />
            </div>

            {/* Subject (editable) */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Subject</label>
              <input
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                value={subjectValue}
                onChange={e => setSubjectValue(e.target.value)}
              />
            </div>

            {/* Body (editable) with formatting toolbar */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-muted-foreground">Body</label>
                <span className={`text-[10px] tabular-nums ${wordCount > 80 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                  {wordCount} words
                </span>
              </div>
              {/* Toolbar */}
              <div className="flex items-center gap-1 border border-border border-b-0 rounded-t-md bg-muted/40 px-2 py-1">
                <button
                  type="button"
                  title="Bold (wraps selection in **)"
                  onClick={() => bodyRef.current && insertAtCursor(bodyRef.current, '**', '**')}
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  title="Italic (wraps selection in _)"
                  onClick={() => bodyRef.current && insertAtCursor(bodyRef.current, '_', '_')}
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <div className="w-px h-3.5 bg-border mx-1" />
                <button
                  type="button"
                  title="Toggle bullet list"
                  onClick={() => bodyRef.current && toggleBullets(bodyRef.current)}
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <div className="w-px h-3.5 bg-border mx-1" />
                <span className="text-[10px] text-muted-foreground/60 ml-1">Tip: blank line = new paragraph</span>
              </div>
              <textarea
                ref={bodyRef}
                className="w-full rounded-b-md border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-y font-mono leading-relaxed"
                style={{ minHeight: '220px' }}
                value={bodyValue}
                onChange={e => setBodyValue(e.target.value)}
              />
            </div>

            {/* Plain text toggle (only for tracked send) */}
            {trackedSend && (
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2">
                <div>
                  <p className="text-xs font-medium">Plain text mode</p>
                  <p className="text-[11px] text-muted-foreground">No HTML wrapper or tracking pixel — better deliverability</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPlainText(v => !v)}
                  className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${plainText ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow ${plainText ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </div>
            )}

            {/* From account picker */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Send from</label>
              {isLoading ? (
                <div className="text-xs text-muted-foreground">Loading accounts…</div>
              ) : !accounts?.length ? (
                <div className="text-xs text-destructive">No Gmail accounts connected. Add one in Integrations.</div>
              ) : (
                <div className="space-y-2">
                  {accounts.map(acc => (
                    <label
                      key={acc.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                        selectedId === acc.id ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <input
                        type="radio"
                        className="sr-only"
                        name="gmail-account"
                        value={acc.id}
                        checked={selectedId === acc.id}
                        onChange={() => setSelectedId(acc.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{acc.label}</div>
                        <div className="text-xs text-muted-foreground truncate">{acc.email}</div>
                      </div>
                      {acc.isDefault && (
                        <span className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5 shrink-0">default</span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-muted-foreground">Cmd+Enter to send</span>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending || !selectedId || !toValue.trim() || !accounts?.length}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-xs hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                  {sending ? 'Sending…' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Email draft card ─────────────────────────────────────────────────────────

function EmailDraftCard({
  subject, subjectAlt, body, recipient, selfScore, token, agentKey,
}: {
  subject: string;
  subjectAlt?: string;
  body: string;
  recipient?: string;
  selfScore?: string;
  token: string;
  agentKey?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [useAlt, setUseAlt] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentEmailId, setSentEmailId] = useState<string | undefined>();
  const [spamResult, setSpamResult] = useState<{ score: number; grade: string } | null>(null);
  const trackedSend = agentKey === 'taskip_internal';

  useEffect(() => {
    if (agentKey !== 'taskip_internal' || !subject || !body) return;
    fetch('/spam-checker/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ subject, textBody: body, fromAddress: '', fromDomain: '', recipient: recipient ?? '' }),
    })
      .then(r => r.ok ? r.json() : null)
      .then((d: any) => { if (d?.score != null) setSpamResult({ score: d.score, grade: d.grade }); })
      .catch(() => {});
  }, [subject, body, agentKey, token, recipient]);

  const activeSubject = useAlt && subjectAlt ? subjectAlt : subject;

  const handleCopy = () => {
    navigator.clipboard.writeText(`Subject: ${activeSubject}\n\n${body}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {showSendModal && (
        <SendEmailModal
          to={recipient}
          subject={activeSubject}
          body={body}
          token={token}
          trackedSend={trackedSend}
          onClose={() => setShowSendModal(false)}
          onSent={(id) => { setSent(true); setSentEmailId(id); }}
        />
      )}
      <div className="rounded-xl border border-border bg-card overflow-hidden w-full max-w-xl text-sm">
        {/* Subject row with optional A/B toggle */}
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="text-muted-foreground shrink-0 text-xs font-medium w-14">Subject:</span>
              <span className="font-medium text-foreground">{activeSubject}</span>
            </div>
            {subjectAlt && (
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={() => setUseAlt(false)}
                  className={`px-2 py-0.5 rounded-l text-xs border border-border transition-colors ${!useAlt ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >A</button>
                <button
                  onClick={() => setUseAlt(true)}
                  className={`px-2 py-0.5 rounded-r text-xs border-y border-r border-border transition-colors ${useAlt ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >B</button>
              </div>
            )}
          </div>
          {subjectAlt && (
            <p className="text-[10px] text-muted-foreground mt-1 ml-16">
              {useAlt ? subject : subjectAlt}
            </p>
          )}
        </div>
        {recipient && (
          <div className="flex items-baseline gap-2 px-4 py-2 border-b border-border bg-muted/20">
            <span className="text-muted-foreground shrink-0 text-xs font-medium w-14">To:</span>
            <span className="text-foreground text-xs">{recipient}</span>
          </div>
        )}
        <div
          className="px-4 py-4 text-foreground leading-relaxed prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }}
        />
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border bg-muted/20">
          <div className="flex items-center gap-2">
            {selfScore && (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500 font-medium">
                <Check className="w-3 h-3" /> {selfScore}
              </span>
            )}
            {spamResult && (() => {
              const gradeColors: Record<string, string> = {
                INBOX_STRONG: 'text-emerald-400',
                INBOX_LIKELY: 'text-green-400',
                PROMOTIONS_RISK: 'text-amber-400',
                SPAM_RISK: 'text-orange-400',
                BLOCK: 'text-rose-400',
              };
              const gradeLabels: Record<string, string> = {
                INBOX_STRONG: 'Inbox strong',
                INBOX_LIKELY: 'Inbox likely',
                PROMOTIONS_RISK: 'Promo risk',
                SPAM_RISK: 'Spam risk',
                BLOCK: 'Blocked',
              };
              const color = gradeColors[spamResult.grade] ?? 'text-muted-foreground';
              const label = gradeLabels[spamResult.grade] ?? spamResult.grade;
              return (
                <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${color}`}>
                  Spam: {spamResult.score} — {label}
                </span>
              );
            })()}
            {sent && (
              sentEmailId ? (
                <Link
                  to={`/inbox?highlight=${sentEmailId}`}
                  className="inline-flex items-center gap-1 text-[10px] text-emerald-500 font-medium border border-emerald-500/30 rounded px-1.5 py-0.5 hover:bg-emerald-500/10 transition-colors"
                >
                  <CheckCircle2 className="w-3 h-3" /> Sent — view in inbox
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500 font-medium border border-emerald-500/30 rounded px-1.5 py-0.5">
                  <CheckCircle2 className="w-3 h-3" /> Sent
                </span>
              )
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            {sent ? (
              <button
                onClick={() => setShowSendModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                Send again
              </button>
            ) : (
              <button
                onClick={() => setShowSendModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs hover:bg-primary/90 transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                Send Email
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
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
  msg, color, agentName, onFeedback, token, agentKey,
}: {
  msg: ConvMessage & { pending?: boolean; feedback?: 'up' | 'down' };
  color: ReturnType<typeof agentColor>;
  agentName: string;
  onFeedback?: (msgId: string, rating: 'up' | 'down') => void;
  token: string;
  agentKey?: string;
}) {
  const isUser = msg.role === 'user';

  return (
    <div className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && (
        <div className={`w-7 h-7 rounded-lg ${color.iconBg} flex items-center justify-center shrink-0`}>
          <Bot className={`w-3.5 h-3.5 ${color.iconText}`} />
        </div>
      )}
      <div className={`max-w-[80%] group`}>
        {(() => {
          // Structured email draft from proposedActions
          if (!isUser && msg.content.startsWith(EMAIL_DRAFT_PREFIX)) {
            try {
              const draft = JSON.parse(msg.content.slice(EMAIL_DRAFT_PREFIX.length));
              return <EmailDraftCard subject={draft.subject} body={draft.body} recipient={draft.recipient} token={token} agentKey={agentKey} />;
            } catch { /* fall through */ }
          }
          // Inline email draft in LLM text reply
          if (!isUser) {
            const inline = extractInlineEmail(msg.content);
            if (inline) {
              return (
                <div className="flex flex-col gap-2 max-w-xl">
                  {inline.before && (
                    <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${color.bubble} text-foreground rounded-bl-sm`}>
                      <div dangerouslySetInnerHTML={{ __html: renderMarkdown(inline.before) }} />
                    </div>
                  )}
                  <EmailDraftCard subject={inline.subject} subjectAlt={inline.subjectAlt} body={inline.body} selfScore={inline.selfScore} recipient={inline.to} token={token} agentKey={agentKey} />
                  {inline.after && (
                    <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${color.bubble} text-foreground rounded-bl-sm`}>
                      <div dangerouslySetInnerHTML={{ __html: renderMarkdown(inline.after) }} />
                    </div>
                  )}
                </div>
              );
            }
          }
          return (
            <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              isUser
                ? 'bg-primary text-primary-foreground rounded-br-sm whitespace-pre-wrap'
                : `${color.bubble} text-foreground rounded-bl-sm`
            }`}>
              {isUser
                ? msg.content
                : <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
              }
            </div>
          );
        })()}
        {msg.requiresApproval && (
          <div className="flex items-center gap-1 mt-1 px-1">
            <AlertCircle className="w-3 h-3 text-amber-500" />
            <span className="text-xs text-amber-500">Awaiting Telegram approval</span>
          </div>
        )}
        <div className={`flex items-center gap-2 mt-0.5 px-1 ${isUser ? 'justify-end' : ''}`}>
          <span className="text-[10px] text-muted-foreground/50">
            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {msg.runId && (
            <Link to={`/runs/${msg.runId}`} className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors">
              run →
            </Link>
          )}
          {!isUser && onFeedback && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onFeedback(msg.id, 'up')}
                title="Helpful"
                className={`p-0.5 rounded transition-colors ${msg.feedback === 'up' ? 'text-green-400' : 'text-muted-foreground/40 hover:text-green-400'}`}
              >
                <ThumbsUp className="w-3 h-3" />
              </button>
              <button
                onClick={() => onFeedback(msg.id, 'down')}
                title="Not helpful"
                className={`p-0.5 rounded transition-colors ${msg.feedback === 'down' ? 'text-red-400' : 'text-muted-foreground/40 hover:text-red-400'}`}
              >
                <ThumbsDown className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Run Activity Panel ───────────────────────────────────────────────────────

interface RunLog {
  id: string;
  level: string;
  message: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
  runId: string;
}

interface RunUsage {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

interface ActivityEntry {
  id: string;
  at: string;
  type: 'start' | 'thinking' | 'tool_call' | 'tool_result' | 'decision' | 'approval' | 'error' | 'complete';
  label: string;
  detail?: string;
  status?: 'running' | 'success' | 'failed';
  durationMs?: number;
}

function parseLogsToTimeline(logs: RunLog[], finished: boolean): ActivityEntry[] {
  const entries: ActivityEntry[] = [];
  for (const log of logs) {
    const meta = log.meta as Record<string, unknown> | null;
    const at = log.createdAt;
    if (meta?.event_type === 'tool_call_start') {
      const detail = [
        meta.args_summary ? String(meta.args_summary) : null,
        meta.endpoint ? `→ ${String(meta.endpoint)}` : null,
      ].filter(Boolean).join('  ');
      entries.push({
        id: `tcs-${log.id}`,
        at,
        type: 'tool_call',
        label: String(meta.tool ?? 'tool'),
        detail: detail || undefined,
        status: 'running',
      });
      continue;
    }
    if (meta?.event_type === 'tool_call_end') {
      entries.push({
        id: `tce-${log.id}`,
        at,
        type: 'tool_result',
        label: String(meta.tool ?? 'tool'),
        status: meta.success ? 'success' : 'failed',
        durationMs: meta.duration_ms ? Number(meta.duration_ms) : undefined,
        detail: meta.error ? String(meta.error) : undefined,
      });
      continue;
    }
    if (meta?.event_type === 'llm_call') {
      entries.push({ id: `llm-${log.id}`, at, type: 'thinking', label: 'Thinking...', status: 'running' });
      continue;
    }
    if (log.message === 'Run started') {
      entries.push({ id: log.id, at, type: 'start', label: 'Run started' });
      continue;
    }
    if (log.message.startsWith('Decided ')) {
      const actions = (meta?.actions as Array<{ type: string; summary: string }> | null) ?? [];
      const label = actions.length ? `Decided: ${actions.map((a) => a.type).join(', ')}` : 'Decided actions';
      const detail = actions[0]?.summary?.slice(0, 70);
      entries.push({ id: log.id, at, type: 'decision', label, detail, status: 'success' });
      continue;
    }
    if (log.message.startsWith('Approval pending:')) {
      entries.push({
        id: log.id, at, type: 'approval',
        label: 'Awaiting approval',
        detail: log.message.slice('Approval pending: '.length).slice(0, 60),
        status: 'running',
      });
      continue;
    }
    if (log.message.startsWith('Auto-executing:')) {
      entries.push({ id: log.id, at, type: 'complete', label: log.message.slice(0, 60), status: 'success' });
      continue;
    }
    if (log.message.startsWith('Run completed')) {
      entries.push({ id: log.id, at, type: 'complete', label: 'Run completed', status: 'success' });
      continue;
    }
    if (log.level === 'ERROR') {
      entries.push({ id: log.id, at, type: 'error', label: 'Error', detail: log.message.slice(0, 70), status: 'failed' });
      continue;
    }
  }

  // Resolve thinking entries: mark as success if something follows them, or if the run is finished
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].type === 'thinking' && entries[i].status === 'running') {
      const hasFollowingEntry = i < entries.length - 1;
      if (hasFollowingEntry || finished) {
        entries[i] = { ...entries[i], status: 'success' };
      }
    }
  }

  return entries;
}

function ActivityIcon({ entry }: { entry: ActivityEntry }) {
  switch (entry.type) {
    case 'start':
      return <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1" />;
    case 'thinking':
      return entry.status === 'running'
        ? <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
        : <CheckCircle2 className="w-3 h-3 text-blue-400" />;
    case 'tool_call':
      return <Wrench className="w-3 h-3 text-violet-400" />;
    case 'tool_result':
      return entry.status === 'success'
        ? <CheckCircle2 className="w-3 h-3 text-emerald-400" />
        : <XCircle className="w-3 h-3 text-red-400" />;
    case 'decision':
      return <Zap className="w-3 h-3 text-amber-400" />;
    case 'approval':
      return <AlertCircle className="w-3 h-3 text-amber-400" />;
    case 'error':
      return <XCircle className="w-3 h-3 text-red-400" />;
    case 'complete':
      return <CheckCircle2 className="w-3 h-3 text-emerald-400" />;
    default:
      return <div className="w-2 h-2 rounded-full bg-border mt-1" />;
  }
}

function RunActivityPanel({
  runId,
  isActive,
  token,
}: {
  runId: string | null;
  isActive: boolean;
  token: string;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: logsData } = useQuery<{ logs: RunLog[]; finished: boolean }>({
    queryKey: ['run-logs', runId],
    enabled: !!runId,
    queryFn: () => apiFetch(token, `/runs/${runId}/logs`),
    refetchInterval: (query) => {
      if (!runId) return false;
      if (query.state.data?.finished) return false;
      return 1500;
    },
  });

  const { data: usage } = useQuery<RunUsage>({
    queryKey: ['run-usage', runId],
    enabled: !!runId && !!logsData?.finished,
    queryFn: () => apiFetch(token, `/runs/${runId}/usage`),
    staleTime: Infinity,
  });

  const entries = logsData ? parseLogsToTimeline(logsData.logs, !!logsData.finished) : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <span className="text-xs font-semibold text-foreground">Activity</span>
        {isActive && (
          <span className="flex items-center gap-1 text-[10px] text-blue-400">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Running
          </span>
        )}
        {!isActive && logsData?.finished && (
          <span className="text-[10px] text-muted-foreground/50">Done</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0">
        {!runId && (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <Clock className="w-4 h-4 text-muted-foreground/20" />
            <p className="text-[10px] text-muted-foreground/40 text-center">Send a message to see live activity</p>
          </div>
        )}

        {runId && entries.length === 0 && (
          <div className="flex items-center gap-2 py-2">
            <Loader2 className="w-3 h-3 text-blue-400 animate-spin shrink-0" />
            <span className="text-[11px] text-muted-foreground">Starting run...</span>
          </div>
        )}

        {entries.map((entry, idx) => (
          <div key={entry.id} className="flex gap-2 py-1">
            <div className="flex flex-col items-center shrink-0 w-4">
              <div className="flex items-center justify-center w-4 h-4">
                <ActivityIcon entry={entry} />
              </div>
              {idx < entries.length - 1 && (
                <div className="w-px flex-1 bg-border/40 mt-0.5" />
              )}
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-start justify-between gap-1">
                <span className={`text-[11px] font-medium leading-tight ${
                  entry.status === 'failed' ? 'text-red-400' :
                  entry.type === 'thinking' && entry.status === 'running' ? 'text-blue-400' :
                  entry.type === 'tool_call' ? 'text-violet-300' :
                  entry.type === 'start' ? 'text-emerald-400' :
                  entry.type === 'approval' ? 'text-amber-400' :
                  'text-foreground/80'
                }`}>
                  {entry.label}
                </span>
                <span className="text-[9px] text-muted-foreground/40 shrink-0 pt-0.5">
                  {new Date(entry.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
              {entry.detail && (
                <p className={`text-[10px] mt-0.5 break-all leading-tight ${entry.status === 'failed' ? 'text-red-300/70' : 'text-muted-foreground/60'}`}>{entry.detail}</p>
              )}
              {entry.durationMs !== undefined && (
                <span className="text-[9px] text-muted-foreground/40">{entry.durationMs}ms</span>
              )}
            </div>
          </div>
        ))}

        {usage && usage.calls > 0 && (
          <div className="mt-3 rounded-lg bg-muted/30 border border-border/40 p-2.5">
            <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">Token Usage</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              <div>
                <p className="text-[9px] text-muted-foreground/50">Input</p>
                <p className="text-[11px] font-mono text-foreground">{usage.inputTokens.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground/50">Output</p>
                <p className="text-[11px] font-mono text-foreground">{usage.outputTokens.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground/50">LLM calls</p>
                <p className="text-[11px] font-mono text-foreground">{usage.calls}</p>
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground/50">Est. cost</p>
                <p className="text-[11px] font-mono text-foreground">${Number(usage.costUsd).toFixed(5)}</p>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ─── Chat tab ─────────────────────────────────────────────────────────────────

function ChatTab({
  agent, token, color, convId, onNewConv, onSwitchConv, initialQuery,
}: {
  agent: AgentInfo;
  token: string;
  color: ReturnType<typeof agentColor>;
  convId: string;
  onNewConv: () => void;
  onSwitchConv: (id: string) => void;
  initialQuery?: string;
}) {
  const [messages, setMessages] = useState<(ConvMessage & { pending?: boolean; feedback?: 'up' | 'down' })[]>([]);
  const [input, setInput] = useState(initialQuery ?? '');
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [lastRunId, setLastRunId] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [pastedImage, setPastedImage] = useState<{ base64: string; mimeType: string; previewUrl: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supportsImages = agent.key === 'email_manager';
  // Prevents history query re-fetches from overwriting locally-appended messages.
  const historyApplied = useRef(false);

  const { data: convList } = useQuery<ConvSummary[]>({
    queryKey: ['conv-list', agent.key],
    queryFn: () => apiFetch(token, `/agents/${agent.key}/conversations`),
    staleTime: 10_000,
  });

  // Load conversation history — only apply once per mount (convId changes remount ChatTab via key prop)
  const { data: history, isLoading: histLoading } = useQuery<ConvMessage[]>({
    queryKey: ['conv', agent.key, convId],
    queryFn: () => apiFetch(token, `/agents/${agent.key}/conversations/${convId}`),
    staleTime: Infinity,
  });

  useEffect(() => {
    if (history && !historyApplied.current) {
      historyApplied.current = true;
      setMessages(history);
      // Seed activity panel from the most recent agent run in this conversation
      const lastAgentMsg = [...history].reverse().find((m) => m.role === 'agent' && m.runId);
      if (lastAgentMsg?.runId) setLastRunId(lastAgentMsg.runId);
    }
  }, [history]);

  function handleFeedback(msgId: string, rating: 'up' | 'down') {
    const msg = messages.find((m) => m.id === msgId);
    const newRating = msg?.feedback === rating ? undefined : rating;
    setMessages((prev) =>
      prev.map((m) => m.id === msgId ? { ...m, feedback: newRating } : m),
    );
    if (newRating && msg) {
      const userQuery = [...messages].reverse().find((m) => m.role === 'user')?.content;
      apiFetch(token, `/agents/${agent.key}/feedback`, {
        method: 'POST',
        body: JSON.stringify({
          agentName: agent.name,
          rating: newRating,
          agentMessage: msg.content,
          userQuery,
        }),
      }).catch(() => {});
    }
  }

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

  useEffect(() => {
    if (activeRunId) setLastRunId(activeRunId);
  }, [activeRunId]);

  const triggerMutation = useMutation({
    mutationFn: async (query: string) => {
      const recent = messages.slice(-6);
      const historyCtx = recent.length
        ? recent.map((m) => `${m.role === 'user' ? 'User' : 'Agent'}: ${m.content}`).join('\n')
        : undefined;
      const imagePayload = pastedImage
        ? { base64: pastedImage.base64, mimeType: pastedImage.mimeType }
        : undefined;

      return apiFetch(token, `/agents/${agent.key}/trigger`, {
        method: 'POST',
        body: JSON.stringify({
          triggerType: 'MANUAL',
          payload: { query, source: 'chat', conversationId: convId, history: historyCtx, imageData: imagePayload },
        }),
      });
    },
    onMutate: async (query: string) => {
      const imageLabel = pastedImage ? '\n[image attached]' : '';
      const userMsg: ConvMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: query + imageLabel,
        runId: null,
        requiresApproval: false,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setPastedImage(null);
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
    const q = input.trim() || (pastedImage ? 'Draft a reply to this email.' : '');
    if (!q || triggerMutation.isPending || isThinking) return;
    setInput('');

    if (isGreetingExact(q)) {
      const userMsg: ConvMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: q,
        runId: null,
        requiresApproval: false,
        createdAt: new Date().toISOString(),
      };
      const greetingReply: ConvMessage = {
        id: `a-greet-${Date.now()}`,
        role: 'agent',
        content: `Hi — I'm ${agent.name}. Ask me something specific so I can help, or pick one of the suggestions.`,
        runId: null,
        requiresApproval: false,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg, greetingReply]);
      apiFetch(token, `/agents/${agent.key}/conversations/message`, {
        method: 'POST',
        body: JSON.stringify({ conversationId: convId, role: 'user', content: q }),
      }).catch(() => {});
      apiFetch(token, `/agents/${agent.key}/conversations/message`, {
        method: 'POST',
        body: JSON.stringify({ conversationId: convId, role: 'agent', content: greetingReply.content }),
      }).catch(() => {});
      return;
    }

    triggerMutation.mutate(q);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function readFileAsBase64(file: File): Promise<{ base64: string; mimeType: string; previewUrl: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(',')[1] ?? '';
        resolve({ base64, mimeType: file.type || 'image/jpeg', previewUrl: dataUrl });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handlePaste(e: React.ClipboardEvent) {
    if (!supportsImages) return;
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;
    e.preventDefault();
    const file = imageItem.getAsFile();
    if (!file) return;
    const result = await readFileAsBase64(file).catch(() => null);
    if (result) setPastedImage(result);
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await readFileAsBase64(file).catch(() => null);
    if (result) setPastedImage(result);
    e.target.value = '';
  }

  const isBusy = triggerMutation.isPending || isThinking;
  const displayRunId = activeRunId ?? lastRunId;

  return (
    <div className="flex h-full relative">
      {/* Left: chat column */}
      <div className="flex flex-col flex-1 min-w-0 relative">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
        <p className="text-xs text-muted-foreground font-mono truncate max-w-xs">{convId}</p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowHistory((v) => !v)}
            className={`flex items-center gap-1.5 text-xs transition-colors ${showHistory ? color.badgeText : 'text-muted-foreground hover:text-foreground'}`}
          >
            <History className="w-3 h-3" />
            History
          </button>
          <button
            onClick={onNewConv}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            New chat
          </button>
        </div>
      </div>

      {/* History panel */}
      {showHistory && (
        <div className="absolute inset-0 z-10 flex">
          <div className="w-72 shrink-0 border-r border-border bg-card flex flex-col h-full shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-semibold">Conversations</span>
              <button onClick={() => setShowHistory(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {!convList?.length && (
                <p className="text-xs text-muted-foreground p-4 italic">No past conversations.</p>
              )}
              {convList?.map((c) => {
                const isActive = c.conversationId === convId;
                return (
                  <button
                    key={c.conversationId}
                    onClick={() => { onSwitchConv(c.conversationId); setShowHistory(false); }}
                    className={`w-full text-left px-4 py-3 border-b border-border transition-colors hover:bg-accent/30 ${isActive ? color.bubble : ''}`}
                  >
                    <p className="text-xs font-medium truncate text-foreground">
                      {c.preview ?? '(no messages)'}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(c.lastActivityAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                        {new Date(c.lastActivityAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className={`text-[10px] px-1.5 rounded ${color.badge} ${color.badgeText}`}>
                        {c.messageCount} msg
                      </span>
                      {isActive && <span className="text-[10px] text-green-400 ml-auto">current</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex-1 bg-background/60 backdrop-blur-sm" onClick={() => setShowHistory(false)} />
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        <div className="max-w-3xl mx-auto w-full px-4 py-4 flex-1 flex flex-col gap-4">
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
          <div className="flex flex-col items-center justify-center flex-1 text-center gap-3 py-12">
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
          <MessageBubble key={msg.id} msg={msg} color={color} agentName={agent.name} onFeedback={handleFeedback} token={token ?? ''} agentKey={agent.key} />
        ))}

        {isThinking && <TypingBubble color={color} />}
        <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border p-3">
        <div className="max-w-3xl mx-auto w-full">
        {!agent.enabled && (
          <p className="text-xs text-amber-500 mb-2 px-1">Agent is disabled — enable it in Settings to chat.</p>
        )}
        {!input.trim() && messages.length === 0 && (
          <SuggestionChips
            agentKey={agent.key}
            onPick={(s) => {
              setInput(s);
              textareaRef.current?.focus();
            }}
          />
        )}
        {pastedImage && (
          <div className="mb-2 flex items-center gap-2">
            <img src={pastedImage.previewUrl} alt="pasted" className="h-14 rounded-lg border border-border object-cover" />
            <button onClick={() => setPastedImage(null)} className="text-muted-foreground hover:text-foreground p-1">
              <X className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs text-muted-foreground">Image attached — agent will read the email from it</span>
          </div>
        )}
        <div className="flex gap-2 items-end">
          {supportsImages && (
            <>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isBusy}
                title="Attach image of email"
                className="shrink-0 h-10 w-10 flex items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors disabled:opacity-40"
              >
                <ImagePlus className="w-4 h-4" />
              </button>
            </>
          )}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={supportsImages
              ? `Paste a client email or type instructions… (Ctrl+V to paste screenshot)`
              : `Message ${agent.name}… (Enter to send, Shift+Enter for newline)`}
            rows={2}
            disabled={!agent.enabled || !agent.registered || isBusy}
            className="flex-1 font-sans text-sm bg-muted/40 border border-border rounded-xl p-3 resize-none focus:outline-none focus:ring-1 focus:ring-ring text-foreground placeholder:text-muted-foreground/50 disabled:opacity-50"
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={(!input.trim() && !pastedImage) || !agent.enabled || !agent.registered || isBusy}
            className="h-10 w-10 p-0 rounded-xl shrink-0"
          >
            {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
        </div>{/* end max-w wrapper */}
      </div>
      </div>{/* end left chat column */}

      {/* Right: activity panel */}
      <div className="w-60 border-l border-border shrink-0 hidden lg:flex flex-col bg-card/30">
        <RunActivityPanel
          runId={displayRunId}
          isActive={!!activeRunId}
          token={token}
        />
      </div>
    </div>
  );
}

// ─── Tasks tab ────────────────────────────────────────────────────────────────

interface TaskApproval {
  id: string;
  runId: string;
  agentKey: string;
  action: { type: string; summary: string };
  status: string;
}

function TasksTab({
  agent, token, color,
}: {
  agent: AgentInfo;
  token: string;
  color: ReturnType<typeof agentColor>;
}) {
  const qc = useQueryClient();
  const [taskInput, setTaskInput] = useState('');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');

  const { data: runs, isLoading, refetch } = useQuery<{
    id: string; triggerType: string; status: string; triggerPayload: unknown; startedAt: string; finishedAt: string | null;
  }[]>({
    queryKey: ['agent-runs-tasks', agent.key],
    queryFn: () => apiFetch(token, `/agents/${agent.key}/runs?limit=30`),
    refetchInterval: 10_000,
  });

  const { data: allApprovals } = useQuery<TaskApproval[]>({
    queryKey: ['pending-approvals'],
    queryFn: () => apiFetch(token, '/approvals'),
    refetchInterval: 10_000,
  });

  const approveMutation = useMutation({
    mutationFn: (approvalId: string) =>
      apiFetch(token, `/approvals/${approvalId}/approve`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-approvals'] });
      qc.invalidateQueries({ queryKey: ['agent-runs-tasks', agent.key] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (approvalId: string) =>
      apiFetch(token, `/approvals/${approvalId}/reject`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-approvals'] });
      qc.invalidateQueries({ queryKey: ['agent-runs-tasks', agent.key] });
    },
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

  const approvalsByRunId = (allApprovals ?? [])
    .filter((a) => a.agentKey === agent.key)
    .reduce<Record<string, TaskApproval[]>>((acc, a) => {
      (acc[a.runId] ??= []).push(a);
      return acc;
    }, {});

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
        <SuggestionChips agentKey={agent.key} onPick={setTaskInput} />
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
            const runApprovals = approvalsByRunId[run.id] ?? [];
            const isAwaiting = run.status === 'AWAITING_APPROVAL' && runApprovals.length > 0;

            return (
              <div key={run.id} className="rounded-lg border border-border bg-card overflow-hidden">
                <Link
                  to={`/runs/${run.id}`}
                  className="flex items-start gap-3 px-3 py-2.5 hover:bg-accent/30 transition-colors"
                >
                  <div className="shrink-0 mt-0.5">
                    {run.status === 'EXECUTED' ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    ) : run.status === 'FAILED' || run.status === 'REJECTED' ? (
                      <XCircle className="w-4 h-4 text-red-400" />
                    ) : isAwaiting ? (
                      <AlertCircle className="w-4 h-4 text-amber-400" />
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

                {/* Approve/Reject section for each pending approval */}
                {isAwaiting && (
                  <div className="border-t border-yellow-500/20 bg-yellow-500/5 px-3 py-2 space-y-1.5">
                    {runApprovals.map((approval) => (
                      <div key={approval.id} className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] text-muted-foreground flex-1 min-w-0 truncate" title={approval.action.summary}>
                          {approval.action.summary}
                        </span>
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            onClick={() => approveMutation.mutate(approval.id)}
                            disabled={approveMutation.isPending || rejectMutation.isPending}
                            className="text-xs px-2.5 py-0.5 rounded bg-green-500/15 text-green-500 hover:bg-green-500/25 border border-green-500/30 disabled:opacity-50 font-medium transition-colors"
                          >
                            {approveMutation.isPending ? '…' : 'Approve'}
                          </button>
                          <button
                            onClick={() => rejectMutation.mutate(approval.id)}
                            disabled={approveMutation.isPending || rejectMutation.isPending}
                            className="text-xs px-2.5 py-0.5 rounded bg-red-500/15 text-red-500 hover:bg-red-500/25 border border-red-500/30 disabled:opacity-50 font-medium transition-colors"
                          >
                            {rejectMutation.isPending ? '…' : 'Reject'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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

// ─── Webhook Logs Tab (support agent only) ────────────────────────────────────

interface WebhookLog {
  id: string;
  status: string;
  externalId: string | null;
  ticketId: string | null;
  rawPayload: string | null;
  error: string | null;
  receivedAt: string;
}

function WebhookLogsTab({ token }: { token: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: logs = [], isLoading, refetch, isFetching } = useQuery<WebhookLog[]>({
    queryKey: ['support-webhook-logs'],
    queryFn: () => apiFetch(token, '/support/webhook-logs?limit=100'),
    staleTime: 30_000,
  });

  function statusChip(status: string) {
    if (status === 'ok') return 'bg-emerald-500/15 text-emerald-400';
    if (status === 'duplicate') return 'bg-amber-500/15 text-amber-400';
    return 'bg-rose-500/15 text-rose-400';
  }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold">Webhook Logs</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Incoming events from your CRM via <code className="bg-muted px-1 rounded">/support/ingest-ticket</code></p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="rounded-lg border border-border p-3 flex items-center gap-3">
              <Skeleton className="w-16 h-5 rounded-full" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-32 ml-auto" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && logs.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <Radio className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No webhook events received yet.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Events will appear here once your CRM starts sending tickets.</p>
        </div>
      )}

      {!isLoading && logs.length > 0 && (
        <div className="space-y-1.5">
          {logs.map(log => (
            <div key={log.id} className="rounded-lg border border-border bg-card overflow-hidden">
              <button
                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/20 transition-colors"
                onClick={() => setExpanded(expanded === log.id ? null : log.id)}
              >
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide shrink-0 ${statusChip(log.status)}`}>
                  {log.status}
                </span>
                <span className="text-xs font-medium truncate flex-1 min-w-0">
                  {log.externalId ? `Ticket #${log.externalId}` : 'Unknown ticket'}
                </span>
                {log.error && (
                  <span className="text-[11px] text-rose-400 truncate max-w-[200px]">{log.error}</span>
                )}
                <span className="text-[11px] text-muted-foreground shrink-0">{timeAgo(log.receivedAt)}</span>
                <ChevronIcon expanded={expanded === log.id} />
              </button>

              {expanded === log.id && (
                <div className="border-t border-border px-4 py-3 space-y-3">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <div><span className="text-muted-foreground">Received:</span> {new Date(log.receivedAt).toLocaleString()}</div>
                    <div><span className="text-muted-foreground">CRM ticket ID:</span> {log.externalId ?? '—'}</div>
                    <div><span className="text-muted-foreground">Internal ID:</span> {log.ticketId ?? '—'}</div>
                    <div><span className="text-muted-foreground">Status:</span> {log.status}</div>
                  </div>
                  {log.error && (
                    <div className="rounded-md bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-400">{log.error}</div>
                  )}
                  {log.rawPayload && (
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-1.5 font-medium">Raw payload</p>
                      <pre className="text-[11px] bg-muted rounded-lg p-3 overflow-x-auto max-h-48 text-foreground/80 font-mono leading-relaxed">
                        {(() => { try { return JSON.stringify(JSON.parse(log.rawPayload), null, 2); } catch { return log.rawPayload; } })()}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-3.5 h-3.5 text-muted-foreground transition-transform shrink-0 ${expanded ? 'rotate-180' : ''}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgentChatPage() {
  const { key } = useParams<{ key: string }>();
  const token = useAuthStore((s) => s.token)!;
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('query') ?? (location.state as { query?: string } | null)?.query;
  type AllTabKey = ChatTabKey | 'webhooks';
  const [activeTab, setActiveTab] = useState<AllTabKey>('chat');
  const visibleTabs: { key: AllTabKey; label: string; icon: React.ElementType }[] = key === 'support'
    ? [...CHAT_TABS, { key: 'webhooks', label: 'Webhooks', icon: Radio }]
    : [...CHAT_TABS];
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

  const handleSwitchConv = useCallback((id: string) => {
    setConvId(key!, id);
    setConvIdState(id);
  }, [key]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className={`shrink-0 border-b border-border px-4 sm:px-5 py-2 sm:py-3 bg-card`}>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to={`/agents/${key}`}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </Link>

          <div className={`w-8 h-8 rounded-lg ${color.iconBg} flex items-center justify-center shrink-0`}>
            <Bot className={`w-4 h-4 ${color.iconText}`} />
          </div>

          {isLoading ? (
            <Skeleton className="h-5 w-32 rounded" />
          ) : (
            <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
              <span className="text-sm font-semibold truncate">{agent?.name}</span>
              <code className={`text-xs px-1.5 py-0.5 rounded ${color.badge} ${color.badgeText} shrink-0`}>{key}</code>
              {agent && !agent.enabled && (
                <span className="text-xs text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded shrink-0">disabled</span>
              )}
            </div>
          )}

          {/* Tab bar — desktop (shown inline) */}
          <div className="hidden sm:flex items-center gap-1 border border-border rounded-lg p-0.5 bg-muted/30 ml-auto shrink-0">
            {visibleTabs.map(({ key: tabKey, label, icon: Icon }) => (
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

        {/* Tab bar — mobile (shown below name row) */}
        <div className="flex sm:hidden items-center gap-1 border border-border rounded-lg p-0.5 bg-muted/30 mt-2">
          {visibleTabs.map(({ key: tabKey, label, icon: Icon }) => (
            <button
              key={tabKey}
              onClick={() => setActiveTab(tabKey)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
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
      <div className="flex-1 overflow-hidden overflow-y-auto">
        {agent && activeTab === 'chat' && (
          <ChatTab key={convId} agent={agent} token={token} color={color} convId={convId} onNewConv={handleNewConv} onSwitchConv={handleSwitchConv} initialQuery={initialQuery} />
        )}
        {agent && activeTab === 'tasks' && (
          <TasksTab agent={agent} token={token} color={color} />
        )}
        {agent && activeTab === 'schedule' && (
          <ScheduleTab agent={agent} token={token} color={color} />
        )}
        {activeTab === 'webhooks' && (
          <WebhookLogsTab token={token} />
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
