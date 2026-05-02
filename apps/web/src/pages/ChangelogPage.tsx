import { ScrollText } from 'lucide-react';

type Tag = 'feat' | 'fix' | 'chore';

interface ChangeEntry {
  tag: Tag;
  scope?: string;
  description: string;
}

interface VersionBlock {
  version: string;
  date: string;
  entries: ChangeEntry[];
}

const CHANGELOG: VersionBlock[] = [
  {
    version: 'v2.6.0',
    date: '2026-05-02',
    entries: [
      { tag: 'feat', description: 'Changelog page with feat/fix/chore tagged entries, accessible from sidebar' },
      { tag: 'feat', scope: 'geoip', description: 'Upload GeoLite2-City.mmdb directly from local computer as alternative to MaxMind download' },
      { tag: 'feat', scope: 'livechat', description: 'Flag wrong AI responses with inline correction form — LLM reformats into KB proposal sent to Telegram for approval' },
      { tag: 'feat', scope: 'livechat', description: 'Site label badge on online visitors panel showing which site each visitor belongs to' },
      { tag: 'fix', scope: 'agents', description: 'Delete agent now cascades to runs, pending approvals, logs, and conversations before removing agent row' },
      { tag: 'fix', scope: 'llm-usage', description: 'Overview stats were blank due to Date object passed as SQL param — converted to ISO string' },
      { tag: 'fix', scope: 'livechat', description: 'Long URL in Currently On visitor panel no longer overflows its container' },
      { tag: 'fix', scope: 'push', description: 'Browser notifications failing silently when VAPID subject was missing — falls back to default; test button now surfaces errors' },
    ],
  },
  {
    version: 'v2.5.0',
    date: '2026-05-02',
    entries: [
      { tag: 'feat', scope: 'livechat', description: 'Stats panel on dashboard with session count, CSAT score, and avg response time' },
      { tag: 'feat', scope: 'livechat', description: 'Proper Setup sub-tab with prerequisites, config steps, and manual test guide' },
      { tag: 'fix', scope: 'livechat', description: 'CSAT score calculation corrected to exclude unanswered sessions' },
      { tag: 'feat', scope: 'settings', description: 'HR and GeoIP config groups in Settings page' },
      { tag: 'feat', scope: 'livechat', description: 'Agent run recording — each chat session linked to an agent run for audit trail' },
      { tag: 'feat', scope: 'agents', description: 'Site tags for filtering agent activity by site/channel' },
      { tag: 'feat', scope: 'agents', description: 'Inline run logs visible directly in the run detail panel' },
      { tag: 'feat', scope: 'hr', description: 'GeoIP setup panel with API key config and test lookup' },
      { tag: 'feat', scope: 'hr', description: 'Inline config editor for HR agent parameters' },
    ],
  },
  {
    version: 'v2.4.0',
    date: '2026-04-18',
    entries: [
      { tag: 'feat', scope: 'llm-usage', description: 'Dynamic cost chart with configurable time period and per-model breakdown' },
      { tag: 'feat', scope: 'llm-usage', description: 'Recent calls table with agent names and token counts' },
      { tag: 'feat', scope: 'llm-usage', description: 'Period-over-period delta indicator on usage stats' },
      { tag: 'feat', scope: 'livechat', description: 'At-a-glance inbox improvements: unread badges, session status chips, quick reply' },
      { tag: 'chore', description: 'Static Drizzle imports in Telegram service to fix tree-shaking issue' },
    ],
  },
  {
    version: 'v2.3.0',
    date: '2026-04-04',
    entries: [
      { tag: 'fix', scope: 'migrations', description: 'Register migrations 0043 and 0044 in Drizzle journal so they run on boot' },
      { tag: 'feat', scope: 'hr', description: 'Setup UI with test-connection button for HRM API validation' },
      { tag: 'fix', scope: 'livechat', description: 'Session list sorted by last message timestamp instead of creation date' },
      { tag: 'feat', scope: 'hr', description: 'Telegram callback handlers for leave, WFH, and payslip approval flows' },
      { tag: 'feat', scope: 'hr', description: 'XGHRM API client wired in; removed local stub tables; configurable payslip day' },
    ],
  },
  {
    version: 'v2.2.0',
    date: '2026-03-20',
    entries: [
      { tag: 'feat', scope: 'livechat', description: 'Message timestamps and site badge shown in inbox conversation list' },
      { tag: 'fix', scope: 'widget', description: 'Resolve 3 TypeScript build errors that blocked Coolify deployment' },
      { tag: 'feat', scope: 'livechat', description: '3-layer visitor page context (URL, title, referrer) passed to AI for personalised replies' },
      { tag: 'fix', scope: 'livechat', description: 'Visitor-side security hardening — rate limiting, origin validation, sanitised inputs' },
    ],
  },
  {
    version: 'v2.1.0',
    date: '2026-03-06',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'Chatbot security and quality hardening — 14 issues addressed' },
      { tag: 'fix', scope: 'widget', description: '5 mobile edge cases fixed including safe-area inset and scroll lock' },
      { tag: 'fix', scope: 'widget', description: 'True streaming animation, CSS cursor blink, and 10px mobile position offset' },
      { tag: 'fix', scope: 'widget', description: 'Brand color restored on mobile; PWA notch safe area padding' },
    ],
  },
  {
    version: 'v2.0.0',
    date: '2026-02-20',
    entries: [
      { tag: 'feat', scope: 'livechat', description: 'Live Chat module — embeddable widget, operator inbox, AI-assisted replies, CSAT' },
      { tag: 'feat', scope: 'hr', description: 'HR agent — leave requests, WFH approvals, payslip dispatch via Telegram' },
      { tag: 'feat', scope: 'contacts', description: 'Contacts page with visitor history and session timeline' },
      { tag: 'feat', scope: 'tasks', description: 'Tasks page for manual task tracking per agent' },
      { tag: 'feat', scope: 'inbox', description: 'Unified inbox for email threads managed by email-manager agent' },
      { tag: 'chore', description: 'Switched to semver versioning (MAJOR.MINOR.PATCH)' },
    ],
  },
  {
    version: 'v1.0.0',
    date: '2026-01-15',
    entries: [
      { tag: 'feat', description: 'Initial platform: NestJS + Fastify + Drizzle + BullMQ + Redis + MinIO scaffold' },
      { tag: 'feat', description: 'Agent runtime with IAgent contract, Postgres persistence, and BullMQ queue' },
      { tag: 'feat', description: 'LLM router: OpenAI -> Gemini -> DeepSeek fallback chain' },
      { tag: 'feat', description: 'Telegram bot with Approve / Reject / Follow-up callbacks' },
      { tag: 'feat', description: 'Knowledge Base with ingestion (PDF, DOCX, URL), Redis cache, and self-improvement' },
      { tag: 'feat', description: 'MCP server framework and client' },
      { tag: 'feat', description: 'SES module with bounce/complaint webhook' },
      { tag: 'feat', description: 'Agents: crisp, support, whatsapp, email-manager, linkedin, reddit, social, shorts, taskip-trial, daily-reminder' },
      { tag: 'feat', description: 'Frontend: dashboard, agents, approvals, integrations, MCP, activity, settings, knowledge base' },
    ],
  },
];

const TAG_STYLES: Record<Tag, string> = {
  feat: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  fix: 'bg-red-500/10 text-red-400 border border-red-500/20',
  chore: 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20',
};

export default function ChangelogPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <ScrollText className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold">Changelog</h1>
      </div>

      <div className="space-y-10">
        {CHANGELOG.map((block) => (
          <div key={block.version}>
            <div className="flex items-baseline gap-3 mb-4">
              <span className="text-sm font-semibold font-mono">{block.version}</span>
              <span className="text-xs text-muted-foreground">{block.date}</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <ul className="space-y-2">
              {block.entries.map((entry, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className={`shrink-0 mt-0.5 inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-medium ${TAG_STYLES[entry.tag]}`}>
                    {entry.tag}
                  </span>
                  <span className="text-sm text-muted-foreground leading-snug">
                    {entry.scope && (
                      <span className="text-foreground font-medium mr-1">{entry.scope}:</span>
                    )}
                    {entry.description}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
