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
    version: 'v3.1.2',
    date: '2026-05-03',
    entries: [
      { tag: 'fix', scope: 'chat', description: 'AgentChatPage no longer shows a double scrollbar on desktop — root changed from h-screen to h-full; AppLayout main switches to overflow-hidden on /agents/*/chat routes so the chat fills exactly the available viewport' },
    ],
  },
  {
    version: 'v3.1.1',
    date: '2026-05-03',
    entries: [
      { tag: 'feat', scope: 'agents', description: 'Approve/Reject with action summary in both AgentDetailPage RunsTab and AgentChatPage TasksTab — each pending approval shows its action.summary so the user knows what they are approving; works for all agents generically' },
      { tag: 'fix', scope: 'agents', description: 'TasksTab refetch interval reduced to 10s to match RunsTab; both views share the pending-approvals query key so approval state is consistent' },
    ],
  },
  {
    version: 'v3.1.0',
    date: '2026-05-03',
    entries: [
      { tag: 'feat', scope: 'hr', description: 'HR agent chat mode — MANUAL triggers with a query now use LLM + tool calling to answer specific HR questions instead of running daily digest or payroll; LlmModule added to HrModule' },
      { tag: 'feat', scope: 'agents', description: 'Approve/Reject buttons on AWAITING_APPROVAL runs in agent detail page — no need to go to Approvals page' },
      { tag: 'feat', scope: 'ui', description: 'Mobile responsive layout for AgentsPage, AgentDetailPage, AgentChatPage — actions stack below name on small screens; chat tab bar moves below agent name on mobile' },
    ],
  },
  {
    version: 'v3.0.9',
    date: '2026-05-03',
    entries: [
      { tag: 'fix', scope: 'hr', description: 'Payslip generate response updated — removed .skipped field, added alreadyGeneratedNote and noAttendance handling; no-attendance count and already-generated note both surfaced to Telegram' },
      { tag: 'feat', scope: 'hr', description: 'Payslip Telegram message now includes working days and present days from API response' },
    ],
  },
  {
    version: 'v3.0.8',
    date: '2026-05-03',
    entries: [
      { tag: 'fix', scope: 'notifications', description: 'Bell badge now updates in real time — subscribes to approvals and activity rooms via WebSocket; correct event names (approval:created, approval:removed, activity:log); fallback poll reduced to 15s' },
    ],
  },
  {
    version: 'v3.0.7',
    date: '2026-05-03',
    entries: [
      { tag: 'fix', scope: 'hr', description: 'Payslip flow corrected — per-slip Telegram messages with Approve/Edit/Skip buttons sent after Cortex batch approval; hrPayslipRuns rows inserted on generation, not before' },
      { tag: 'fix', scope: 'telegram', description: 'HR leave and WFH Approve/Reject buttons now work — replaced editMessageText with Markdown with editMessageReplyMarkup + plain reply; same fix for payslip approve/edit/skip callbacks' },
      { tag: 'fix', scope: 'telegram', description: 'Slash commands (/help, /status, /agents, /inbox, /remind, /cancel) now surface errors instead of silently failing — all handlers wrapped in try/catch; removed Markdown from command replies to prevent silent Telegram parse errors' },
      { tag: 'feat', scope: 'hr', description: 'Added submit_leave_request, submit_wfh_request, and export_payslips_csv MCP tools; createLeaveRequest and createWfhRequest added to HrmApiService' },
    ],
  },
  {
    version: 'v3.0.6',
    date: '2026-05-03',
    entries: [
      { tag: 'feat', scope: 'approvals', description: 'Bulk reject — select all checkbox + "Reject N" button in approvals page header; each card has a checkbox for individual selection' },
      { tag: 'fix', scope: 'approvals', description: 'Follow-up no longer re-creates all stale approvals for the run — existing PENDING approvals are cancelled before new ones are queued' },
    ],
  },
  {
    version: 'v3.0.5',
    date: '2026-05-03',
    entries: [
      { tag: 'fix', scope: 'telegram', description: 'Approve/Reject/Follow-up buttons now work reliably — replaced editMessageText with Markdown (broke on special chars) with editMessageReplyMarkup + plain reply; errors surface as a reply instead of failing silently' },
      { tag: 'fix', scope: 'hr', description: 'Payslips no longer generated in XGHRM before approval — generation and approval now happen inside execute() after the user approves the batch in Cortex; single approval card replaces 17 individual ones' },
    ],
  },
  {
    version: 'v3.0.4',
    date: '2026-05-03',
    entries: [
      { tag: 'fix', scope: 'geoip', description: 'Country flags now appear for existing visitors — GeoIP backfill runs on boot and after every database upload/download, updating all visitors that have an IP but no country data' },
    ],
  },
  {
    version: 'v3.0.3',
    date: '2026-05-03',
    entries: [
      { tag: 'feat', scope: 'geoip', description: 'Chunked upload now shows a progress bar and "Uploading chunk X of Y" label; download/upload section hidden when database is already loaded; Debug tab renamed to GEOLite2' },
    ],
  },
  {
    version: 'v3.0.2',
    date: '2026-05-03',
    entries: [
      { tag: 'feat', scope: 'geoip', description: 'GeoLite2-City.mmdb upload now uses 10 MB chunked transfer — large files (130 MB+) upload reliably with per-chunk progress shown in the button' },
    ],
  },
  {
    version: 'v3.0.1',
    date: '2026-05-03',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'Visitor list now sorts open/pending sessions first, then by last message time descending — closed sessions always sink to the bottom' },
    ],
  },
  {
    version: 'v3.0.0',
    date: '2026-05-03',
    entries: [
      { tag: 'feat', scope: 'tasks', description: 'Weekly recurrence now has a day-of-week picker (Mon–Sun); monthly recurrence added with a day-of-month picker (1–31)' },
      { tag: 'feat', scope: 'tasks', description: 'Telegram reminder sent ~1 hour before any scheduled or recurring task runs; reminder_sent_at tracked in DB to avoid duplicates, reset on each rescheduling cycle' },
    ],
  },
  {
    version: 'v2.9.4',
    date: '2026-05-03',
    entries: [
      { tag: 'fix', scope: 'hr', description: 'HR test-connection errors now appear in debug logs — removed internal error swallowing so failures propagate as 500 with the real error message; dispatcher catch block sends actual error text instead of generic message' },
    ],
  },
  {
    version: 'v2.9.3',
    date: '2026-05-03',
    entries: [
      { tag: 'fix', scope: 'kb', description: 'Live Chat site scope selector now appears in the Import tab (document and URL) when livechat agent is selected, matching behaviour of the Add Entry modal' },
    ],
  },
  {
    version: 'v2.9.2',
    date: '2026-05-02',
    entries: [
      { tag: 'feat', scope: 'ci', description: 'GitHub Actions workflow builds Docker image on push to main — downloads GeoLite2-City.mmdb and bakes it into the image; Dockerfile updated to copy data/ into runner stage' },
      { tag: 'fix', scope: 'geoip', description: 'mmdb upload no longer fails with file too large — per-request 150 MB limit on the geo/upload-db endpoint overrides the global 10 MB multipart cap' },
    ],
  },
  {
    version: 'v2.9.1',
    date: '2026-05-02',
    entries: [
      { tag: 'fix', scope: 'integrations', description: 'Gmail tab Connect with OAuth and App Password buttons no longer wrap text — added whitespace-nowrap and shrink-0' },
    ],
  },
  {
    version: 'v2.9.0',
    date: '2026-05-02',
    entries: [
      { tag: 'fix', scope: 'telegram', description: 'KB proposal approve/reject in Telegram now works — replaced editMessageText with Markdown (broke on AI-generated content with underscores) with plain reply + button removal' },
      { tag: 'fix', scope: 'ops', description: 'Operations page is now responsive — header, active lanes, and log/approvals panel stack correctly on mobile' },
      { tag: 'fix', scope: 'livechat', description: 'Live Chat tab bar scrolls horizontally on narrow screens — tabs no longer wrap or overflow container' },
      { tag: 'fix', scope: 'notifications', description: 'Fixed /notifications/summary 500 error — approval_status enum comparison now uses uppercase PENDING to match Postgres enum values' },
      { tag: 'fix', scope: 'livechat', description: 'Fixed visitor duplicate-key race condition on high-concurrency sites — upsertVisitor now uses atomic onConflictDoUpdate' },
      { tag: 'feat', scope: 'debug-logs', description: 'Copy full error button in debug log detail view — formats method, path, status, request/response body, error message, and stack trace to clipboard' },
      { tag: 'fix', scope: 'hr', description: 'HR agent setup tab shows the exact endpoint URL that test-connection calls, so misconfigured base URLs are immediately visible' },
      { tag: 'feat', scope: 'livechat', description: 'Message seen checkmarks — single grey check when sent, double blue check when visitor reads; visitor widget emits seen event on open and on new message' },
    ],
  },
  {
    version: 'v2.7.2',
    date: '2026-05-02',
    entries: [
      { tag: 'fix', scope: 'geoip', description: 'GeoLite2-City download now works — removed --wildcards tar flag that is unsupported on BSD/some Linux tar versions' },
      { tag: 'fix', scope: 'settings', description: 'Removed duplicate MaxMind GeoIP fields from global Settings — managed exclusively in Live Chat > Setup' },
    ],
  },
  {
    version: 'v2.7.1',
    date: '2026-05-02',
    entries: [
      { tag: 'fix', scope: 'livechat', description: '"Correction sent" label now always visible after submitting a flag — was hidden until hover' },
    ],
  },
  {
    version: 'v2.7.0',
    date: '2026-05-02',
    entries: [
      { tag: 'feat', scope: 'notifications', description: 'Real-time notification bell in topbar — badge count for waiting chats, pending approvals, agent failures, and KB proposals; each item navigates to the relevant page' },
      { tag: 'feat', scope: 'changelog', description: 'Changelog moved from sidebar to topbar icon button (ScrollText) for cleaner nav' },
    ],
  },
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
