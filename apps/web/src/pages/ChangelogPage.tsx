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
    version: 'v4.7.1',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'chat', description: 'Send Email modal: auto-resizing textarea (grows with content, min 220px), formatting toolbar with Bold (**), Italic (_), and Bullet list toggle. Paragraph tip shown in toolbar.' },
      { tag: 'feat', scope: 'inbox', description: 'Email body now rendered as structured HTML — double newline = paragraph break, lines starting with "- " = bullet list, **text** = bold, _text_ = italic. Applies to both the send modal preview and the inbox detail panel.' },
      { tag: 'feat', scope: 'api', description: 'buildHtmlEmail: enhanced converter produces proper <p> paragraphs, <ul> bullet lists, <strong>/<em> for inline markup instead of a flat <br> dump.' },
    ],
  },
  {
    version: 'v4.7.0',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'inbox', description: 'Redesign Inbox page to Apple Mail two-panel layout: left panel is a compact email list with avatar initials, subject snippet, open/reply indicators; right panel shows full email body, open tracking detail, replies, and action buttons. Stats moved to a top bar with pill badges.' },
      { tag: 'feat', scope: 'api', description: 'Email reply sweep interval changed from 10 min to 15 min as requested.' },
    ],
  },
  {
    version: 'v4.6.5',
    date: '2026-05-10',
    entries: [
      { tag: 'fix', scope: 'api', description: 'send(): rewrite to raw SQL INSERT with only the stable columns — Drizzle client-side defaults (open_count=0 etc.) were included in every INSERT even when not specified, causing column-not-found errors on prod where migration 0063 has not run. tracking_token set via a separate best-effort UPDATE.' },
    ],
  },
  {
    version: 'v4.6.4',
    date: '2026-05-10',
    entries: [
      { tag: 'fix', scope: 'api', description: 'Send email: tracking insert fallback is now unconditional — any insert error retries without tracking columns instead of checking the error message string (avoids Drizzle error-wrapping edge cases). Inbox listSent/getDetail no longer select open_count/first_open_at/last_open_at since migration 0063 is not yet on prod.' },
      { tag: 'fix', scope: 'inbox', description: 'InboxRow openCount/firstOpenAt/lastOpenAt are optional — page renders correctly when tracking columns are absent from prod DB.' },
    ],
  },
  {
    version: 'v4.6.3',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'inbox', description: 'Inbox page: open tracking badge (Opened Nx · Xm ago / Not opened), opened count + timestamps in detail, "Draft reply with AI" button that pre-fills the agent chat with recipient context and SPAR instruction.' },
      { tag: 'feat', scope: 'chat', description: 'Send Email from taskip_internal agent now calls tracked send endpoint (POST /taskip-internal/inbox/send) — email recorded in Inbox with open pixel. "Sent — view in inbox" badge links directly to the tracked row.' },
      { tag: 'feat', scope: 'api', description: 'listSent / getDetail now include openCount, firstOpenAt, lastOpenAt. New POST /taskip-internal/inbox/send tracked send endpoint. AgentChatPage reads ?query= URL param to pre-fill chat from inbox.' },
    ],
  },
  {
    version: 'v4.6.2',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'chat', description: 'Send Email modal: subject field is now editable; body has a live word counter (amber at >80 words); Cmd/Ctrl+Enter sends. EmailDraftCard: green "Sent" badge appears in the footer after a successful send; button demotes to "Send again".' },
    ],
  },
  {
    version: 'v4.6.1',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'chat', description: 'Send Email modal now shows an editable body textarea pre-filled with the draft. Agent SPAR output includes **To:** line — parser extracts the recipient email and auto-fills the To field. **To:** line stripped from the reasoning bubble to avoid duplication.' },
    ],
  },
  {
    version: 'v4.6.0',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'livechat', description: 'Inline search input added to the conversation list sidebar — always visible between the stats bar and the online visitors panel. Filters by visitor name, email, or last message; clear button appears when there is input.' },
    ],
  },
  {
    version: 'v4.5.9',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'taskip-internal', description: 'Agent now has live KB access scoped to site "Taskip": always-on product facts (features, pricing, personas) and per-query semantic search are injected into the system prompt at runtime. Admins can populate KB entries tagged site_keys=Taskip to teach the agent anything about the product without a deploy.' },
    ],
  },
  {
    version: 'v4.5.8',
    date: '2026-05-10',
    entries: [
      { tag: 'fix', scope: 'taskip-internal', description: 'System prompt now explains Taskip is a client portal for freelancers/agencies: invoices are sent TO clients, contacts are clients, leads are prospects. Agent no longer misinterprets invoices_paid=0 as the owner owing money. Angle table, persona table, signal inventory, and banned-framing list all updated to reflect correct product context.' },
    ],
  },
  {
    version: 'v4.5.7',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'chat', description: 'EmailDraftCard: "Open in Mail" replaced with "Send Email" — clicking opens an account-picker modal that lists connected Gmail accounts (default pre-selected), allows editing the To address, and sends via POST /gmail/send.' },
      { tag: 'feat', scope: 'gmail', description: 'POST /gmail/send — authenticated endpoint that sends an email through a specified (or default) Gmail account. Used by the chat EmailDraftCard send flow.' },
    ],
  },
  {
    version: 'v4.5.6',
    date: '2026-05-10',
    entries: [
      { tag: 'fix', scope: 'chat', description: 'Parser: emailMarkerRe no longer requires trailing newline; makeSubjectRe handles Subject A/B with or without space; Subject A/B/Recommended lines stripped from reasoning bubble to avoid duplication.' },
      { tag: 'feat', scope: 'chat', description: 'EmailDraftCard: A/B subject switcher — shows both options, active subject in header, other as small hint; self-score badge (e.g. "5/5") shown bottom-left of card; Copy/Open in Mail use whichever subject is selected.' },
    ],
  },
  {
    version: 'v4.5.5',
    date: '2026-05-10',
    entries: [
      { tag: 'fix', scope: 'chat', description: 'extractInlineEmail now handles the SPAR output format (**Email:** marker, **Subject A/B:** with **Recommended:** picker) in addition to the legacy Subject:/Body: format. Self-score line is omitted from the rendered output.' },
    ],
  },
  {
    version: 'v4.5.4',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'taskip-internal', description: 'Full SPAR 8-step email reasoning system: Signal Inventory (behavior/gap/momentum with recency weighting), Persona Inference, Prior Email Check (angle memory), Cohort Tone Calibration, Angle Selection table, two formula-locked subject options (A/B), body rules with banned-phrase list, and a self-score "would I reply?" gate that forces a rewrite if score < 4.' },
    ],
  },
  {
    version: 'v4.5.3',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'taskip-internal', description: 'Agent now shows a reasoning block (cohort, score, activity signals, last outreach, decision trigger) before every email draft so the operator can understand the rationale before approving.' },
      { tag: 'feat', scope: 'taskip-internal', description: 'Email copy rules enforced in system prompt: no generic Welcome subjects, subject must reference a real behavior/gap, body must cite at least one data point, under 80 words, signed as "Sharifur" only.' },
    ],
  },
  {
    version: 'v4.5.2',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'chat', description: 'Agent messages containing an inline email draft (Subject:/Body: pattern from LLM text replies) are now rendered as a styled EmailDraftCard with Copy and Open in Mail actions instead of raw text.' },
    ],
  },
  {
    version: 'v4.5.1',
    date: '2026-05-10',
    entries: [
      { tag: 'fix', scope: 'taskip-internal', description: 'list_sent_emails, getDetail, syncReplies now use explicit column selection — excludes tracking_token/open_count columns that are only on dev (migration 0063). send() also falls back to inserting without tracking columns when the column is missing on production.' },
    ],
  },
  {
    version: 'v4.5.0',
    date: '2026-05-10',
    entries: [
      { tag: 'fix', scope: 'gmail', description: 'OAuth callback popup no longer shows React 404 — /gmail/oauth/callback is now a public React route that POSTs the code/state to POST /gmail/oauth/exchange and relays the result via postMessage.' },
      { tag: 'fix', scope: 'support', description: 'Webhook deliveries now always create a visible run entry in the activity panel — if triggerAgent fails (e.g. agent disabled), a FAILED run is written so the delivery is traceable.' },
    ],
  },
  {
    version: 'v4.4.8',
    date: '2026-05-10',
    entries: [
      { tag: 'fix', scope: 'taskip-internal', description: 'searchByEmail logs the full resolved URL (base + /search?email=) at debug level so you can see exactly which endpoint is hit.' },
      { tag: 'feat', scope: 'chat', description: 'Activity panel tool_call entries now show the Insight endpoint being called (e.g. /search?email=...) alongside the args summary for easier debugging.' },
      { tag: 'fix', scope: 'taskip-internal', description: 'Setup tab: insight_base_url description now shows the expected full module path format (https://api.taskip.net/api/internal/insight).' },
    ],
  },
  {
    version: 'v4.4.7',
    date: '2026-05-10',
    entries: [
      { tag: 'fix', scope: 'chat', description: 'Activity panel: Thinking... entries no longer stay permanently spinning — marked as success when any subsequent entry follows them, or when the run is finished.' },
    ],
  },
  {
    version: 'v4.4.6',
    date: '2026-05-10',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'send-transcript: SES errors (bad credentials, domain invalid, quota, etc.) are now caught and returned as { ok: false, reason: "send_failed", error: "..." } instead of throwing 500. Frontend shows the actual error reason in the alert.' },
    ],
  },
  {
    version: 'v4.4.5',
    date: '2026-05-10',
    entries: [
      { tag: 'fix', scope: 'ses', description: 'GET /ses/suppressions no longer 500s when email_suppressions table is missing — returns empty array instead. list() and remove() both catch the missing-table error.' },
      { tag: 'fix', scope: 'ses', description: 'sendEmail() now validates the To domain is ASCII-only before calling SES — silently skips and logs a warning instead of throwing InvalidParameterValue when a visitor email has a unicode/punycode domain.' },
    ],
  },
  {
    version: 'v4.4.4',
    date: '2026-05-10',
    entries: [
      { tag: 'fix', scope: 'ses', description: 'isSuppressed() and suppress() now catch missing email_suppressions table gracefully — log a warning and proceed instead of crashing with 500. Fixes send-transcript and any SES email while migration 0062 is pending on production.' },
    ],
  },
  {
    version: 'v4.4.3',
    date: '2026-05-10',
    entries: [
      { tag: 'fix', scope: 'taskip-internal', description: 'lookup_user: if Insight API returns 404 (workspace not yet indexed), agent falls back to direct DB lookup; on permanent failure the error now includes the endpoint path for easier debugging.' },
      { tag: 'fix', scope: 'taskip-internal', description: 'All Insight API errors in executeReadTool now include [endpoint: /path] so the activity panel shows exactly which URL was called.' },
      { tag: 'fix', scope: 'chat', description: 'Activity panel persists across page reloads — on conversation load, lastRunId is seeded from the most recent agent message runId so the timeline is always visible.' },
      { tag: 'fix', scope: 'chat', description: 'Failed tool result detail in activity panel no longer truncates — full error message is shown in red so endpoint + error reason are both readable.' },
    ],
  },
  {
    version: 'v4.4.2',
    date: '2026-05-10',
    entries: [
      { tag: 'fix', scope: 'api', description: 'Client-disconnect (aborted) errors no longer log as 500 — global exception filter detects Error("aborted"), skips debug log, and returns 200 silently since the socket is already closed.' },
    ],
  },
  {
    version: 'v4.4.1',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'contacts', description: 'Contacts list now paginates — 25 per page with Prev/Next controls and "X–Y of Z" counter; page resets to 1 when search query or source filter changes. Backend returns { data, total, page, pageSize, totalPages } envelope.' },
      { tag: 'fix', scope: 'contacts', description: 'Live Chat stat card now sums both livechat and crisp source counts correctly.' },
    ],
  },
  {
    version: 'v4.4.0',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'email', description: 'Gmail open tracking — emails sent via TaskipInternalEmailService now embed a 1x1 transparent GIF tracking pixel; public GET /track/open/:token.gif endpoint records open count, first/last open timestamp, and per-open events (IP, user-agent) in taskip_internal_emails table.' },
      { tag: 'feat', scope: 'gmail', description: 'sendEmail() now accepts htmlBody — builds multipart/alternative MIME for OAuth2 path and passes html option to nodemailer for IMAP path; fallback to plain text when htmlBody is omitted.' },
      { tag: 'feat', scope: 'db', description: 'Migration 0063: adds tracking_token, open_count, first_open_at, last_open_at, open_events columns to taskip_internal_emails with unique partial index on tracking_token.' },
    ],
  },
  {
    version: 'v4.3.9',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'chat', description: 'Activity timeline panel — right-side panel in all agent chat pages shows live run activity: tool calls (start/success/failed), thinking state, LLM call events, decisions, approval gates, and per-run token/cost summary after completion.' },
      { tag: 'feat', scope: 'taskip-internal', description: 'Structured tool-call logging in decide() loop — each tool call emits event_type:tool_call_start and tool_call_end log entries with tool name, args summary, duration, and success/error; LLM calls emit llm_call event; runId now passed to LlmRouter for per-run token tracking.' },
      { tag: 'feat', scope: 'api', description: 'GET /runs/:id/usage endpoint — returns aggregated input/output token counts and estimated cost in USD for a run, queried from llm_usage_logs.' },
      { tag: 'fix', scope: 'dispatcher', description: 'agents variable shadowed the schema import in agent-route-dispatcher — renamed local to agentList to fix TS2339/TS2345/TS2551 errors.' },
    ],
  },
  {
    version: 'v4.3.8',
    date: '2026-05-10',
    entries: [
      { tag: 'fix', scope: 'taskip-internal', description: 'lookup_user now resolves by owner email via Insight API GET /search?email= instead of direct DB query — fixes "user not found" errors when taskip_db_url_readonly is not configured or points to the wrong DB.' },
    ],
  },
  {
    version: 'v4.3.7',
    date: '2026-05-10',
    entries: [
      { tag: 'fix', scope: 'integrations', description: 'LinkedIn setup guide: corrected Unipile URL from app.unipile.com (DNS does not resolve) to dashboard.unipile.com' },
    ],
  },
  {
    version: 'v4.3.6',
    date: '2026-05-10',
    entries: [
      { tag: 'fix', scope: 'integrations', description: 'LinkedIn setup guide: app.unipile.com was plain text — browser opened it as http:// which errors; converted to a proper https:// anchor link' },
    ],
  },
  {
    version: 'v4.3.5',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'integrations', description: 'Gmail OAuth modal now shows required Google scopes inline — amber card lists both gmail.modify and userinfo.email with copy-friendly monospace blocks, path to OAuth consent screen, and note about the restricted-scope warning.' },
      { tag: 'fix', scope: 'db', description: 'email_suppressions migration (0062) was missing from _journal.json — Drizzle never applied it on boot, causing 500 on GET /ses/suppressions. Table will be created on next restart.' },
    ],
  },
  {
    version: 'v4.3.4',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'widget', description: 'Message preview popup — when the widget is minimised and the AI sends a new message, a dark bubble pops above the chat button showing the first 90 chars of the message; auto-dismisses after 6s; clicking opens the panel; close button dismisses manually. Unread badge count was already working — this adds the visual preview.' },
    ],
  },
  {
    version: 'v4.3.3',
    date: '2026-05-10',
    entries: [
      { tag: 'fix', scope: 'webhook', description: 'Webhook signature failures are now visible in the debug page — dispatcher creates a FAILED agent run entry when the x-webhook-secret check fails, so the rejection shows up in the activity log instead of disappearing silently into Pino logs. Also improved log level from DEBUG to LOG so signature check events always appear in production logs with the received header names.' },
    ],
  },
  {
    version: 'v4.3.2',
    date: '2026-05-09',
    entries: [
      { tag: 'fix', scope: 'taskip-internal', description: 'lookup_workspace_owner now resolves workspace UUID via Insight API getLifecycle() instead of a direct DB join — returns the full lifecycle snapshot (owner.email, owner.first_name, workspace state, score, recent messages) without requiring readonly DB access' },
    ],
  },
  {
    version: 'v4.3.1',
    date: '2026-05-09',
    entries: [
      { tag: 'feat', scope: 'taskip-internal', description: 'lookup_workspace_owner tool — resolves workspace UUID to owner user details via workspaces JOIN users; agent can now draft emails from a workspace ID without needing the email upfront' },
      { tag: 'feat', scope: 'chat', description: 'Email draft card — send_email proposals render as a structured inbox card with Subject/To header, markdown-rendered body (bold, italic, tables, code, lists, headings), Copy and Open in Mail buttons; all agent text responses now render markdown instead of plain whitespace-pre-wrap' },
    ],
  },
  {
    version: 'v4.3.0',
    date: '2026-05-09',
    entries: [
      { tag: 'feat', scope: 'ses', description: 'Platform-wide email suppression list — hard bounces and spam complaints from SES SNS are stored in email_suppressions table; SesService.sendEmail() checks suppression before every send (all email types: transcripts, agent emails, etc.); new /ses/suppressions REST API (list, add, delete); Suppressions page in sidebar with table view, manual add, and per-row remove' },
    ],
  },
  {
    version: 'v4.2.15',
    date: '2026-05-09',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'Origin mismatch error response no longer leaks the configured site origin — moved details to a server-side warn log; public response is now a generic "Origin not allowed"' },
    ],
  },
  {
    version: 'v4.2.14',
    date: '2026-05-09',
    entries: [
      { tag: 'fix', scope: 'auth', description: 'JWT strategy validate() was omitting role from request.user — RolesGuard always saw undefined and 403d all admin routes; fixed to include role from DB; added dvrobin4@gmail.com as permanent super_admin bypass in RolesGuard' },
      { tag: 'fix', scope: 'widget', description: 'Email-required chat widget no longer shows hard-gate overlay on open — widget opens normally, email prompt appears inline after first message is sent, subsequent sends are blocked with a toast until email is provided; Maybe later button hidden when email is required' },
    ],
  },
  {
    version: 'v4.2.13',
    date: '2026-05-09',
    entries: [
      { tag: 'chore', scope: 'widget', description: 'Rebuilt livechat.js bundle' },
    ],
  },
  {
    version: 'v4.2.12',
    date: '2026-05-09',
    entries: [
      { tag: 'fix', scope: 'kb', description: 'Knowledge Base tab bar is now horizontally scrollable on small screens — tabs no longer overflow the viewport; header description wraps instead of clipping' },
    ],
  },
  {
    version: 'v4.2.11',
    date: '2026-05-09',
    entries: [
      { tag: 'fix', scope: 'support', description: 'Webhook secret was not trimmed before comparison — trailing whitespace in stored value caused safeEqualString length check to silently reject all requests; now trims both sides; added payload keys log at handler entry' },
    ],
  },
  {
    version: 'v4.2.10',
    date: '2026-05-09',
    entries: [
      { tag: 'fix', scope: 'support', description: 'Webhook rejection was silent — added warn logs for missing secret config, missing header, and header mismatch; dispatcher now logs signature check start/pass/fail with route and source IP' },
    ],
  },
  {
    version: 'v4.2.9',
    date: '2026-05-09',
    entries: [
      { tag: 'fix', scope: 'canva', description: 'Chat messages no longer trigger automatic content calendar generation — added chat mode that responds conversationally via LLM; only CRON and explicit task:generate_design payloads run the calendar/design workflows' },
    ],
  },
  {
    version: 'v4.2.8',
    date: '2026-05-09',
    entries: [
      { tag: 'fix', scope: 'runtime', description: 'Duplicate Telegram approval messages: ApprovalService.createApproval() was emitting "approval.created" and agent-run.processor was also emitting the same event — removed duplicate from processor; enriched emit now includes approvalId field so Telegram handler buttons work correctly' },
      { tag: 'fix', scope: 'taskip-internal', description: 'Insight API 422 Unknown scenario_key: agent was using hardcoded scenario keys from system prompt; replaced with mandatory insight_pending_scenarios() call — scenario_key must come from eligible[].scenario_key for the target workspace' },
    ],
  },
  {
    version: 'v4.2.7',
    date: '2026-05-09',
    entries: [
      { tag: 'fix', scope: 'taskip-internal', description: 'System prompt: added intent detection (READ vs ACTION) — list/show/find queries now return data only and never auto-propose write actions; only explicit "propose/suggest/send" triggers the outreach workflow' },
    ],
  },
  {
    version: 'v4.2.6',
    date: '2026-05-08',
    entries: [
      { tag: 'fix', scope: 'taskip-internal', description: 'Chat continuity: agent now reads history from trigger payload and prepends prior conversation turns to the LLM messages array — follow-up questions no longer lose context of the previous exchange' },
    ],
  },
  {
    version: 'v4.2.5',
    date: '2026-05-08',
    entries: [
      { tag: 'fix', scope: 'runtime', description: 'Build error: stale "body" reference in agent-route-dispatcher webhook trigger — replaced with request.body after the params refactor renamed the variable' },
    ],
  },
  {
    version: 'v4.2.4',
    date: '2026-05-08',
    entries: [
      { tag: 'feat', scope: 'taskip-internal', description: 'Tasks tab added to agent detail page: daily automated sweeps (6 cohort cards), on-demand tasks (8 clickable items), and weekly reviews (3 items)' },
      { tag: 'feat', scope: 'taskip-internal', description: 'Clicking any on-demand or weekly task opens the chat page with the query pre-filled for editing before sending' },
      { tag: 'feat', scope: 'chat', description: 'AgentChatPage now reads location.state.query and pre-fills the chat input — enables navigate-to-chat-with-query from other pages' },
    ],
  },
  {
    version: 'v4.2.3',
    date: '2026-05-08',
    entries: [
      { tag: 'fix', scope: 'taskip-internal', description: 'System prompt: added golden rule (no send without approval), channel routing table, score thresholds, valid scenario_key list, per_page cap, and pre-outreach dedup checklist' },
      { tag: 'fix', scope: 'taskip-internal', description: 'Raised MAX_TOOL_ITERATIONS from 8 to 14 — marketing workflow (segment → drill → recommend → submit → log) routinely exceeded 8 steps' },
      { tag: 'feat', scope: 'taskip-internal', description: 'New tool: list_workspace_suggestions — LLM can check pending/sent suggestions before proposing new outreach to avoid duplicate sends' },
      { tag: 'fix', scope: 'taskip-internal', description: 'send_email tool: body description corrected to Markdown, added paid-plan restriction warning' },
      { tag: 'fix', scope: 'taskip-internal', description: 'insight_submit_message tool: added paid-cohort-only restriction to description' },
      { tag: 'fix', scope: 'taskip-internal', description: 'insight_submit_marketing_suggestion: idempotency_key removed from required fields' },
      { tag: 'fix', scope: 'taskip-internal', description: 'GET /taskip-internal/suggestions: replaced N+1 activity queries with a single batched inArray query' },
    ],
  },
  {
    version: 'v4.2.2',
    date: '2026-05-08',
    entries: [
      { tag: 'feat', scope: 'llm', description: 'All agent LLM tabs now default to "Default (from Settings)" — no hardcoded provider in initial state; per-agent override only when explicitly selected' },
      { tag: 'feat', scope: 'llm', description: 'LlmSubTab, DailyReminderLlmSubTab, EmailManagerLlmSubTab: added Default button that clears llm config; model input hidden when default is active' },
      { tag: 'fix', scope: 'email-manager', description: 'Remove hardcoded provider/model override in draftClientReply and analyzeEmailText — both now use agentLlmOpts(config) which falls through to global Settings' },
      { tag: 'chore', scope: 'llm', description: 'LLM interfaces (TaskipConfig, DailyReminderConfig, EmailManagerConfig): llm field is now optional/nullable' },
    ],
  },
  {
    version: 'v4.2.1',
    date: '2026-05-08',
    entries: [
      { tag: 'fix', scope: 'runtime', description: 'Agent route dispatcher now merges request.query into params — GET route handlers (e.g. insight/status) were always receiving empty params because only request.body was passed' },
      { tag: 'fix', scope: 'taskip-internal', description: 'Insight Test connection: workspaceUuid query param now correctly reaches the status() method; debug logs added in dispatcher and status()' },
      { tag: 'feat', scope: 'taskip-internal', description: 'LLM tab: added Default (from Settings) provider option — when selected, agent inherits platform LLM settings instead of forcing a manual override' },
      { tag: 'chore', scope: 'taskip-internal', description: 'Updated chat suggestion chips to reflect sweep workflow: pending suggestions, run sweep, activity log queries' },
    ],
  },
  {
    version: 'v4.2.0',
    date: '2026-05-08',
    entries: [
      { tag: 'feat', scope: 'taskip-internal', description: 'Proactive suggestion sweep: BullMQ cron runs every 6h, fetches 5 cohorts via Insight API, generates LLM drafts, queues for founder approval' },
      { tag: 'feat', scope: 'taskip-internal', description: 'Dual send path: Gmail for trial/free cohorts, Taskip system messaging for paid cohorts; channel locked at draft time' },
      { tag: 'feat', scope: 'taskip-internal', description: 'Workspace activity log tracks suggestion lifecycle: created, sent, skipped, suppressed' },
      { tag: 'feat', scope: 'taskip-internal', description: 'Suggestions tab on agent detail page: filter bar, suggestion cards with tier badges, inline edit, approve/skip actions, activity timeline' },
      { tag: 'feat', scope: 'taskip-internal', description: 'Approve/skip API routes + manual sweep trigger endpoint' },
      { tag: 'feat', scope: 'taskip-internal', description: '3-skip suppression: workspace auto-suppressed after 3 consecutive skips with no send' },
      { tag: 'chore', scope: 'db', description: 'Migration 0061: taskip_internal_suggestions + taskip_internal_workspace_activity tables' },
    ],
  },
  {
    version: 'v4.1.7',
    date: '2026-05-08',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'AI-image-first mode: planner defaults to ai_image backend (DALL-E 3 → Stability AI) instead of Canva MCP; backend resolved at runtime via canva_mcp_enabled setting' },
      { tag: 'feat', scope: 'canva', description: 'GET /canva/thumbnail/:id route: serves PNG bytes for ai_image candidates; falls back to filePath when thumbnailPath is absent' },
      { tag: 'feat', scope: 'canva', description: 'AIImageAdapter now saves thumbnail alongside candidate image so thumbnail URL is immediately available after generation' },
      { tag: 'feat', scope: 'canva', description: 'Canva setup tab rewritten for AI-first mode: OpenAI key required, Stability AI optional fallback, Canva MCP in collapsible optional section' },
    ],
  },
  {
    version: 'v4.1.6',
    date: '2026-05-08',
    entries: [
      { tag: 'fix', scope: 'canva', description: 'Canva setup step 1: point to Connect API integrations page (canva.com/developers/integrations), not the Apps SDK page — Apps is for Canva editor plugins (Code upload / JS bundle), Connect API is for server OAuth credentials' },
    ],
  },
  {
    version: 'v4.1.5',
    date: '2026-05-08',
    entries: [
      { tag: 'fix', scope: 'canva', description: 'Canva setup tab: clarify that Canva app review is only needed for public release — personal/dev use works immediately; reword steps to remove approval confusion; add info banner explaining no-approval path' },
    ],
  },
  {
    version: 'v4.1.4',
    date: '2026-05-08',
    entries: [
      { tag: 'fix', scope: 'widget', description: 'Rebuild livechat.js bundle — requireEmail email gate was implemented in ui.ts but the deployed bundle was never rebuilt so the gate never appeared; fresh build includes the gate and all recent widget changes' },
    ],
  },
  {
    version: 'v4.1.3',
    date: '2026-05-07',
    entries: [
      { tag: 'fix', scope: 'auth', description: 'Role syncs from /auth/me on every app load so super_admin status persists across refreshes without re-login; nav filter keeps Admin+Settings visible while role is loading (null)' },
    ],
  },
  {
    version: 'v4.1.2',
    date: '2026-05-07',
    entries: [
      { tag: 'fix', scope: 'nav', description: 'Admin and Settings sidebar items hidden when role is null (migration not yet run on production): treat null/unknown role as super_admin so the items remain visible' },
    ],
  },
  {
    version: 'v4.1.1',
    date: '2026-05-07',
    entries: [
      { tag: 'fix', scope: 'canva', description: 'POST /canva/brands/import-from-url returning 404: static route must be registered before :name param routes in Fastify; moved import-from-url first in apiRoutes()' },
      { tag: 'fix', scope: 'livechat', description: 'Origin check throwing 403 for xgenious: relax validation to skip when no Origin/Referer header is present (GET requests and proxies that strip headers); include received vs expected origins in error message for debugging' },
      { tag: 'fix', scope: 'mcp', description: 'GET /mcp/servers 500 (column oauth_integration_id does not exist): migrations 0056-0060 were not in _journal.json so the migrator never ran them; added all missing entries; renamed duplicate 0058_users_role.sql to 0060_users_role.sql' },
    ],
  },
  {
    version: 'v4.1.0',
    date: '2026-05-07',
    entries: [
      { tag: 'feat', scope: 'integrations', description: 'OAuth Integration Hub: server-side OAuth 2.0 token storage for MCP providers (Canva, GitHub); one-click Connect from admin UI, tokens encrypted in DB, auto-refresh on expiry' },
      { tag: 'feat', scope: 'integrations', description: 'OAuth provider registry (oauth-providers.ts): Canva + GitHub configs with scopes, auth/token URLs, and settings key references' },
      { tag: 'chore', scope: 'db', description: 'Migration 0059: oauth_integrations table; oauth_integration_id FK added to mcp_servers' },
    ],
  },
  {
    version: 'v4.0.0',
    date: '2026-05-07',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'Full AI Design Agent: Canva MCP integration, DALL-E 3 + Stability AI image generation, local Pillow render, 6-sprint implementation (T1-T29)' },
      { tag: 'feat', scope: 'canva', description: 'Agent chat page: interactive design generation from text, Edit in Canva deep-link per candidate, approve/reject/revise actions' },
      { tag: 'feat', scope: 'canva', description: 'Multi-brand identity: canva_brands table, per-brand voice profile, palette, fonts, Canva kit ID; Brands management tab' },
      { tag: 'feat', scope: 'canva', description: 'Approval folder workflow: manifest.json + candidate sidecars + append-only audit.jsonl with chained hashes' },
      { tag: 'feat', scope: 'canva', description: 'Skill loading subsystem: 8 built-in SKILL.md skills, intent-based matching, zero-code extensibility' },
      { tag: 'feat', scope: 'canva', description: 'Debug log mode: per-step traces to canva_debug_log table, toggleable via debugMode in agent config' },
      { tag: 'feat', scope: 'canva', description: 'Token + cost tracking: AI image cost per candidate, session total_cost_usd accumulator' },
      { tag: 'chore', scope: 'db', description: 'Migration 0058: canva_brands, canva_sessions, canva_candidates, canva_debug_log tables; default brand seeds' },
    ],
  },
  {
    version: 'v3.10.2',
    date: '2026-05-07',
    entries: [
      { tag: 'feat', scope: 'admin', description: 'New Admin page at /admin — manage users with Super Admin and Agent Operator roles; create, edit role, and delete users with safety guards (cannot remove last super admin or self)' },
      { tag: 'feat', scope: 'auth', description: 'Role-based access control: agent_operator users cannot access Settings or Admin pages; sidebar hides superAdminOnly nav items for non-admins' },
      { tag: 'chore', scope: 'db', description: 'Migration 0058: add role column (default super_admin) to users table' },
    ],
  },
  {
    version: 'v3.10.1',
    date: '2026-05-07',
    entries: [
      { tag: 'feat', scope: 'support', description: 'New Support Tickets page at /support — table view of all tickets with contact name, email, phone, priority and status badges, created/replied timestamps, expandable rows showing ticket body and draft reply' },
      { tag: 'feat', scope: 'support', description: 'Filter by status (All / Open / Replied / Escalated / Closed) and search by subject, email, name or ticket number; stats strip shows live open/replied/escalated counts' },
      { tag: 'feat', scope: 'support', description: 'GET /support/tickets API endpoint with status filter, full-text search, limit/offset pagination' },
    ],
  },
  {
    version: 'v3.10.0',
    date: '2026-05-07',
    entries: [
      { tag: 'feat', scope: 'support', description: 'Support Ticket Manager now receives tickets via crm.xgenious.com webhook (X-Webhook-Secret verification); fetches full ticket description from CRM API before processing' },
      { tag: 'feat', scope: 'support', description: 'After Telegram approval, approved reply is posted back to crm.xgenious.com via POST /api/public-v1/support-ticket/reply/{id}' },
      { tag: 'feat', scope: 'support', description: 'CRM API exposed as 3 MCP tools: crm_get_ticket, crm_list_tickets, crm_post_reply — LLM can call them directly during decision making' },
      { tag: 'feat', scope: 'support', description: 'Setup sub-tab in agent detail page for CRM base URL, API key, and webhook secret configuration with copy-to-clipboard webhook URL' },
      { tag: 'chore', scope: 'db', description: 'Migration 0057: add ticket_no, contact_name, contact_phone, replied_at columns to support_tickets; drop NOT NULL on body' },
    ],
  },
  {
    version: 'v3.9.3',
    date: '2026-05-05',
    entries: [
      { tag: 'fix', scope: 'kb', description: 'KB gap save no longer shows "Failed to save" when the entry saved but the gap deletion errored — gap deletion is now best-effort' },
      { tag: 'feat', scope: 'kb', description: 'Dismiss button shows spinner while deleting a KB gap so the action feels responsive' },
      { tag: 'feat', scope: 'notifications', description: 'KB gaps unanswered count added to notification bell so gaps are visible without navigating to the KB page' },
    ],
  },
  {
    version: 'v3.9.2',
    date: '2026-05-05',
    entries: [
      { tag: 'fix', scope: 'agents', description: 'Pass catalog (product/service/offer) to buildKbPromptBlock in support, whatsapp, linkedin, reddit, social, shorts agents — service entries were fetched but silently dropped from LLM prompts' },
    ],
  },
  {
    version: 'v3.9.1',
    date: '2026-05-05',
    entries: [
      { tag: 'fix', scope: 'kb', description: 'Add "service" to Category dropdown in Add Entry modal so service KB entries can be categorised correctly' },
    ],
  },
  {
    version: 'v3.9.0',
    date: '2026-05-05',
    entries: [
      { tag: 'feat', scope: 'kb', description: 'Extend FTS and vector search to include service, product, and offer entry types — visitors asking about customisation or services now get contextual answers from matching KB entries' },
      { tag: 'fix', scope: 'kb', description: 'Deduplicate catalog entries from Relevant Knowledge section in buildKbPromptBlock so service/product/offer entries do not render twice when found by search and always-on' },
      { tag: 'chore', scope: 'dev', description: 'Add PreToolUse hook in .claude/settings.json to block git push when AppLayout.tsx or ChangelogPage.tsx have not been updated' },
      { tag: 'fix', scope: 'livechat', description: 'Commit rebuilt widget bundle from deleteKbGap fix' },
    ],
  },
  {
    version: 'v3.8.10',
    date: '2026-05-04',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'KB Gaps — commit missing deleteKbGap service method so DELETE /agents/livechat/kb-gaps/:id resolves; fixes Dismiss button 404 and Answer+save flow returning "Failed to save"' },
    ],
  },
  {
    version: 'v3.8.9',
    date: '2026-05-04',
    entries: [
      { tag: 'feat', scope: 'kb', description: 'Correction-to-KB — LLM now synthesizes a proper Q&A reference entry from operator corrections; visitor question sourced from replyToContent; siteKey resolved from session and scoped on the KB entry; category (faq/product/policy/general) and sourceType (correction) stored so entries are filterable; correction entries saved at priority 80' },
    ],
  },
  {
    version: 'v3.8.8',
    date: '2026-05-04',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'Origin check — fall back to Referer header when Origin is absent (fixes 403 for SSR pages and Safari privacy mode on taskip site)' },
    ],
  },
  {
    version: 'v3.8.7',
    date: '2026-05-04',
    entries: [
      { tag: 'feat', scope: 'kb', description: 'KB Gaps — Answer and Dismiss actions per row; Answer opens a modal pre-filled with the visitor question, lets you write a reply, and saves it as a KB entry (category: faq, scoped to site key) then removes the gap; Dismiss deletes the gap without creating an entry' },
    ],
  },
  {
    version: 'v3.8.6',
    date: '2026-05-04',
    entries: [
      { tag: 'feat', scope: 'livechat', description: 'Avatar name tooltip — hovering any visitor avatar in the operator panel now shows the visitor name via the native browser tooltip' },
    ],
  },
  {
    version: 'v3.8.5',
    date: '2026-05-04',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'Operator image paste progress — uploading chips now appear immediately on paste with a thumbnail preview and spinning indicator; "Uploading…" is no longer trapped inside the completed-attachments guard so the chip is visible from the first paste; send is blocked while any upload is in flight' },
      { tag: 'fix', scope: 'livechat-widget', description: 'Visitor image paste progress — uploading chip now shows a CSS spinner alongside the "Uploading…" label; send is blocked (with a toast) while any upload is in progress, preventing duplicate pastes' },
    ],
  },
  {
    version: 'v3.8.4',
    date: '2026-05-04',
    entries: [
      { tag: 'feat', scope: 'kb', description: 'KB Framework moved into Knowledge Base page as a "Framework" tab — removed standalone /kb-framework route and nav link' },
      { tag: 'fix', scope: 'kb', description: 'KB Gaps tab 404 — GapsTab was calling /api/agents/livechat/kb-gaps (wrong prefix); changed to apiFetch so it uses /agents/livechat/kb-gaps matching the controller route' },
    ],
  },
  {
    version: 'v3.8.3',
    date: '2026-05-04',
    entries: [
      { tag: 'fix', scope: 'livechat-widget', description: 'Duplicate agent messages — when Socket.io falls back to HTTP polling, the POST response can arrive before WS stream_start; the 250ms HTTP fallback would fire and push the message, then agent_stream_end would swap the draft bubble to the same messageId creating two identical bubbles; fixed by checking in agent_stream_end whether the real messageId already exists in state and removing the orphaned draft instead of duplicating it; also cleans up orphaned streaming draft bubbles when an LLM-error fallback reply arrives via a plain message event' },
    ],
  },
  {
    version: 'v3.8.2',
    date: '2026-05-04',
    entries: [
      { tag: 'feat', scope: 'livechat', description: 'Human-attention toasts — when a visitor sends a new message or a session escalates to needs_human, a small toast appears bottom-right; clicking it navigates directly to that conversation; toasts auto-dismiss after 6s and stack up to 4' },
    ],
  },
  {
    version: 'v3.8.1',
    date: '2026-05-04',
    entries: [
      { tag: 'feat', scope: 'docs', description: 'KB Framework doc page — new admin panel page at /kb-framework explaining the mandatory 9-step agent contract, layer model, retrieval protocol, prompt block format, security scoping rules, quality gate pipeline, metadata contract, failure/fallback protocol, and health indicators' },
      { tag: 'feat', scope: 'livechat', description: 'Clear widget cache — each site in the Live Chat settings now has a refresh button that sets a cache-bust token on the site record; the widget compares this token on every page load and clears its localStorage message cache when it changes, forcing all visitors to re-fetch conversation state' },
      { tag: 'chore', scope: 'db', description: 'Migration 0055: widget_cache_bust column on livechat_sites' },
    ],
  },
  {
    version: 'v3.8.0',
    date: '2026-05-04',
    entries: [
      { tag: 'feat', scope: 'kb', description: 'KB character count + quality warning — content textarea in the entry editor now shows live char and token estimates; entries under 80 chars get an amber "too short" warning; high comma density triggers a "keyword list" warning since sentences retrieve better than comma-separated terms' },
      { tag: 'feat', scope: 'kb', description: 'AI preview block in entry editor — collapsible section below the form shows how the AI will see the entry after truncation (500 chars for products/services/offers, 800 chars for references) with an amber warning if content exceeds the limit' },
      { tag: 'feat', scope: 'livechat', description: 'Thread-context retrieval — KB search now prepends the last 3 visitor messages to the current query so follow-up questions like "yes" or "how much?" resolve against the topic under discussion, not just the one-word utterance' },
      { tag: 'feat', scope: 'livechat', description: 'Pre-LLM empty-KB gate — if no product/service/offer catalog entries exist for the site AND no references were retrieved for a substantive question, the agent skips the LLM entirely and escalates to human support; prevents hallucinated answers on sites with missing KB coverage' },
      { tag: 'feat', scope: 'livechat', description: 'Post-draft grounding check — after generating a reply draft, a fast secondary LLM call verifies that all specific factual claims in the draft are supported by retrieved KB entries; ungrounded drafts are discarded and escalated rather than delivered to the visitor' },
      { tag: 'feat', scope: 'livechat', description: 'KB source flag and improve buttons — the KB sources panel now shows a flag icon per entry row (marks the entry as inaccurate, persisted to livechat_kb_flags) and an edit link that navigates to the KB editor for that entry and auto-opens the edit modal' },
      { tag: 'feat', scope: 'kb', description: 'Never-retrieved entry tracking — knowledge_entries now records last_retrieved_at; reference entries that have never been fetched by the AI show an orange "never used" badge; entries unused for >30 days show a yellow "stale" badge; a filter toggle in the Entries tab shows only unused entries' },
      { tag: 'feat', scope: 'kb', description: 'KB Gaps tab — new sixth tab in the Knowledge Base page lists questions that escalated because of missing KB coverage or grounding failures; columns: site, visitor question, reason (no references / grounding failed), time; auto-refreshes every 30 s; filterable by site key' },
      { tag: 'fix', scope: 'kb', description: 'Increased KB context limits — product/service/offer content truncation 220 → 500 chars, reference content 600 → 800 chars, references injected 3 → 8; vector similarity threshold (cosine <= 0.40) added to filter low-relevance results' },
      { tag: 'chore', scope: 'db', description: 'Migrations 0052–0054: livechat_kb_gaps table, livechat_kb_flags table, knowledge_entries.last_retrieved_at column' },
    ],
  },
  {
    version: 'v3.7.0',
    date: '2026-05-04',
    entries: [
      { tag: 'feat', scope: 'livechat', description: 'KB debug panel — every AI reply in the operator panel now shows a "kb: N sources" button below the bubble; click to expand a list of KB entry titles and types (product, fact, reference) that were retrieved to generate that reply; aids diagnosing wrong-site or wrong-product answers' },
      { tag: 'feat', scope: 'livechat', description: 'Page-context product pinning — when the visitor is on a named product page (non-generic URL), the agent system prompt is pinned to that page title so replies stay focused on the product shown, not other products in context' },
      { tag: 'feat', scope: 'livechat', description: 'PRODUCT LOCK rule added to system prompt — agent is now explicitly instructed to treat KB entries about other brands as non-existent, even if they slip into context; provides a hard backstop against cross-site product contamination independent of KB filtering' },
      { tag: 'feat', scope: 'kb', description: 'Untagged entry warning in KB admin — entries with the livechat agent selected but no site key set now show a yellow "no site — inactive" badge; entries without a site key are silently excluded from all livechat sessions after the strict site filter deployed in v3.6.2' },
      { tag: 'chore', scope: 'db', description: 'Migration 0051: added metadata jsonb column to livechat_messages for KB source tracking' },
    ],
  },
  {
    version: 'v3.6.2',
    date: '2026-05-04',
    entries: [
      { tag: 'fix', scope: 'kb', description: 'Cross-site KB contamination — KB entries with no site_keys set were treated as "global" and returned for every livechat site, causing products from one site (e.g. Xilancer, Influstar) to appear in replies on unrelated sites; siteKeyWhere is now strict: only entries explicitly tagged with the queried site key are returned; entries must be tagged with a site key to appear in livechat' },
    ],
  },
  {
    version: 'v3.6.1',
    date: '2026-05-04',
    entries: [
      { tag: 'fix', scope: 'widget', description: 'Duplicate agent messages — root cause was a browser event-loop race: fetch().then() is a microtask and resolves before WebSocket onmessage macrotasks, so the HTTP response could push the message before stream_start had processed; when socket is connected the HTTP push is now deferred 250ms so WS events drain first, with HTTP content as a fallback only if WS never delivers' },
      { tag: 'fix', scope: 'widget', description: 'Widget message cache cleared (key bumped to v2) to purge any duplicate messages stored in visitor browsers from the previous race condition' },
    ],
  },
  {
    version: 'v3.6.0',
    date: '2026-05-04',
    entries: [
      { tag: 'feat', scope: 'email_manager', description: 'Full email-drafting rewrite — structured extraction with ExtractedEmail (latestMessage, threadContext, sender, subject, language, sentiment, confidence); dual KB search (15 semantic results + up to 5 per detected product name, deduplicated); thread context injected as conversation history; gpt-4o-mini sentiment/language analysis; stronger KB PRICING RULE and CRITICAL fallback guard; confidence gate rejects ambiguous images before drafting' },
      { tag: 'feat', scope: 'email_manager', description: 'Product name extraction — capitalized words 4+ chars appearing 2+ times are detected as product names (e.g. Nazmart, Taskip); KB is searched separately for each product so product-specific entries are always included alongside semantic results' },
      { tag: 'feat', scope: 'livechat', description: 'Homepage product-question rule — when a visitor asks about pricing, features, or buying from the site homepage without naming a product, the agent asks "Which product?" before proceeding; prevents generic replies when multiple products are on offer' },
      { tag: 'feat', scope: 'widget', description: 'Operator avatar tooltip — hovering the operator avatar image in the chat widget now shows the operator name via a native title attribute' },
      { tag: 'fix', scope: 'db', description: 'Drizzle migration journal gap — migrations 0048 (telegram_mode), 0049 (require_email), 0050 (reply_to_id) were present as SQL files but missing from _journal.json; Drizzle migrate() uses the journal to discover files, so all three columns were never applied on production; journal entries added, columns now created on next deploy startup' },
      { tag: 'fix', scope: 'widget', description: 'Duplicate agent messages in chat widget — HTTP response handler and streaming path could both push the same message; fixed by checking activeDraftId (streaming in progress) before the push so the HTTP fallback skips the message while streaming is active' },
    ],
  },
  {
    version: 'v3.5.6',
    date: '2026-05-04',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'Reply-to quote persisted across conversation switches — switching to a different chat while a reply was queued kept the banner visible; replyTo state now resets whenever the active sessionId changes' },
    ],
  },
  {
    version: 'v3.5.5',
    date: '2026-05-04',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'Clicking the reply button broke the page layout — long message content in the reply-to banner caused the flex container to grow beyond its allocated width, squeezing the sidebar; fixed by adding min-w-0 + overflow-hidden to the session pane wrapper and overflow-hidden to the banner strip' },
    ],
  },
  {
    version: 'v3.5.4',
    date: '2026-05-04',
    entries: [
      { tag: 'fix', scope: 'tasks', description: 'Task reminder Telegram message showed UTC time instead of configured timezone — toLocaleTimeString now passes the platform timezone from SettingsService so "runs in ~1 hour at 10:00 AM" reflects local time, not server UTC' },
    ],
  },
  {
    version: 'v3.5.3',
    date: '2026-05-03',
    entries: [
      { tag: 'feat', scope: 'livechat', description: 'Translate button always visible on all messages — removed hover-only opacity for visitor messages; added translate button and translation display to agent/AI message bubbles so operators can translate in both directions' },
    ],
  },
  {
    version: 'v3.5.2',
    date: '2026-05-03',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'CORS http/https mismatch — sites registered with https:// were rejecting requests from http:// widgets; both the origin cache and the site resolver now compare hostname only, so http://bytesed.com matches a site configured as https://bytesed.com' },
    ],
  },
  {
    version: 'v3.5.1',
    date: '2026-05-03',
    entries: [
      { tag: 'fix', scope: 'geoip', description: 'GeoLite2 file upload crashed with "Maximum call stack size exceeded" — caused by spreading a 10 MB Uint8Array as arguments to String.fromCharCode; replaced with a simple for-loop to build the binary string before btoa encoding' },
      { tag: 'fix', scope: 'livechat', description: 'Translate globe icon now appears on hover for all visitor messages — previously only shown when visitor\'s detected browser language was non-English, so messages from visitors with English browser settings (writing in Russian, Bangla, etc.) never showed the button' },
    ],
  },
  {
    version: 'v3.5.0',
    date: '2026-05-03',
    entries: [
      { tag: 'feat', scope: 'email_manager', description: 'Draft reply assistant in agent chat — paste a client email as text and the agent drafts a full reply using the Knowledge Base for pricing, features, and product details; output includes subject line and signed body ready to copy' },
      { tag: 'feat', scope: 'email_manager', description: 'Image input support — paste a screenshot of an email conversation (Ctrl+V) or upload via the attach button; gpt-4o reads the image, extracts the full conversation, then drafts the reply exactly as with text input' },
      { tag: 'feat', scope: 'llm', description: 'Vision support added to LLM router — imageBase64 + imageMimeType fields on LlmCompleteOpts; OpenAI provider attaches the image as a multimodal content block on the last user message (gpt-4o)' },
      { tag: 'fix', scope: 'email_manager', description: 'Agent chat messages were previously ignored (fell through to the Gmail CRON path); buildContext now detects source:chat payload and routes to task mode with the query as instructions' },
      { tag: 'fix', scope: 'email_manager', description: 'Draft replies now returned as notify_result actions (displayed directly in chat bubble, no Telegram approval) instead of send_reply (which was going to AWAITING_APPROVAL state)' },
    ],
  },
  {
    version: 'v3.4.3',
    date: '2026-05-03',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'Security: prompt injection detection — visitor messages are scanned for known injection phrases ("ignore previous instructions", "you are DAN", "jailbreak", system-prompt spoofing tags, etc.) before reaching the LLM; detected patterns are stripped and logged as warnings' },
      { tag: 'fix', scope: 'livechat', description: 'Security: PII redaction before LLM calls — email addresses, phone numbers, and credit card patterns in visitor messages are replaced with [email]/[phone]/[card] tokens so they never appear in LLM provider logs' },
      { tag: 'fix', scope: 'livechat', description: 'Security: pageContext.custom field sanitization — operator-supplied custom context values injected into the agent system prompt are now run through sanitizeOperatorField (HTML/code-fence stripping, 200-char cap) to prevent prompt injection via the embed snippet' },
      { tag: 'fix', scope: 'livechat', description: 'Security: WebSocket session ownership verified on connection — the gateway now checks that the sessionId passed by the visitor actually belongs to their visitorId on the correct site before joining the session room; previously any party that knew a sessionId UUID could subscribe to and read that conversation' },
      { tag: 'fix', scope: 'api', description: 'Security: Content-Security-Policy header added to all API responses — default-src: none; frame-ancestors: none, appropriate for a pure JSON/WebSocket API with no embedded resources' },
    ],
  },
  {
    version: 'v3.4.2',
    date: '2026-05-03',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'Security: hardened livechat agent system prompt with explicit identity rules — the agent now refuses to name its underlying AI model or provider (OpenAI, Anthropic, GPT, Claude, Gemini, etc.) and deflects all meta-questions about its technology or system instructions' },
      { tag: 'fix', scope: 'livechat', description: 'Security: added post-generation output filter — any draft response containing model/provider disclosure patterns is replaced with a safe deflection before being sent to the visitor or persisted to the database' },
    ],
  },
  {
    version: 'v3.4.1',
    date: '2026-05-03',
    entries: [
      { tag: 'feat', scope: 'livechat', description: 'Translate visitor messages: hover any non-English visitor message → globe icon appears → click to translate to English inline below the bubble using the LLM router; translation is cached per-message for the session' },
      { tag: 'feat', scope: 'livechat', description: 'Auto-translate operator replies: when a session is non-English, a toggle appears in the composer bar — when on, the operator types in English and the message is automatically translated to the visitor\'s language before being sent; falls back to original on LLM error' },
    ],
  },
  {
    version: 'v3.4.0',
    date: '2026-05-03',
    entries: [
      { tag: 'feat', scope: 'livechat', description: 'Force email option in site settings (Identity tab) — when enabled, visitors must enter their email in a pre-chat gate before they can send a message; stored in localStorage so one-time only per device' },
      { tag: 'feat', scope: 'livechat', description: 'Reply feature: hover any message in the admin panel to see a reply button; clicking it shows a reply preview bar above the composer and sends replyToId + quoted snippet with the message; replies render as a quote block above the bubble' },
      { tag: 'fix', scope: 'livechat', description: 'Message bubbles now preserve newlines (whitespace-pre-wrap) and wrap long URLs correctly ([overflow-wrap:anywhere]) — previously multiline messages and long URLs overflowed the bubble, especially on mobile' },
      { tag: 'fix', scope: 'livechat', description: 'Mobile chat panel: reduced side padding (px-3 on mobile, px-6 on desktop) and widened bubbles to 85% max on small screens to prevent clipping' },
      { tag: 'fix', scope: 'livechat', description: 'Seen checkmark is now green (CheckCheck in text-green-500) to clearly distinguish from sent-not-seen (single grey check); previously both used similar blue/grey tones' },
      { tag: 'fix', scope: 'livechat', description: 'Visitor message newlines in widget now render as <br> — previously typing multiline messages produced a single collapsed line in the chat bubble' },
    ],
  },
  {
    version: 'v3.3.2',
    date: '2026-05-03',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'Agent reply bubbles now render markdown — bold (**text**), italic (*text*), and inline code (`text`) are parsed and rendered correctly; URLs remain clickable as before' },
      { tag: 'fix', scope: 'telegram', description: 'Approval/rejection/followup buttons were silently doing nothing in production — the Telegram bot was only started in non-production environments; removed the NODE_ENV guard so polling runs in all environments including Coolify' },
    ],
  },
  {
    version: 'v3.3.1',
    date: '2026-05-03',
    entries: [
      { tag: 'feat', scope: 'chat', description: 'Thumbs down on any agent chat message triggers the self-improvement loop — emits kb.rejection so SelfImprovementService proposes a KB entry and sends it to Telegram for approval; applies to all agents, not just HR' },
      { tag: 'feat', scope: 'telegram', description: 'Agent failures now send an immediate Telegram alert with agent name, task title (if from a task), error summary, and run ID — no need to open the web app to discover a failure; applies to all 14 agents' },
    ],
  },
  {
    version: 'v3.3.0',
    date: '2026-05-03',
    entries: [
      { tag: 'feat', scope: 'tasks', description: 'Telegram mode per task: agent (default, agent handles Telegram itself), notify (plain text when done), approve (all actions gate on Telegram Approve/Reject before executing) — set via dropdown in the task form, shown as badge on task card' },
      { tag: 'fix', scope: 'hr', description: 'Leave approval requests no longer require Cortex approval before reaching Telegram — Approve/Reject buttons appear in Telegram immediately when the daily task fires' },
    ],
  },
  {
    version: 'v3.2.2',
    date: '2026-05-03',
    entries: [
      { tag: 'fix', scope: 'tasks', description: 'Scheduled tasks now correctly trigger agent actions and send Telegram notifications — runTask() was missing source:task in the payload, causing the HR agent to fall back to read-only chat mode and skip the Telegram notify step' },
    ],
  },
  {
    version: 'v3.2.1',
    date: '2026-05-03',
    entries: [
      { tag: 'fix', scope: 'notifications', description: 'Opening the notification bell dropdown now immediately marks agent failures as seen — previously the count only cleared after navigating to the Activity page; the badge now disappears as soon as the dropdown is opened' },
    ],
  },
  {
    version: 'v3.2.0',
    date: '2026-05-03',
    entries: [
      { tag: 'feat', scope: 'llm-usage', description: 'All agent LLM calls now include agentKey attribution — every agent (support, whatsapp, email-manager, linkedin, reddit, social, shorts, taskip-trial, daily-reminder, canva, taskip-internal, telegram-bot, livechat, hr) passes agentKey to complete() and completeWithTools() so calls appear correctly attributed in the by-agent breakdown on the LLM Usage page instead of Unattributed' },
    ],
  },
  {
    version: 'v3.1.7',
    date: '2026-05-03',
    entries: [
      { tag: 'fix', scope: 'hr', description: 'Chat mode is now explicitly read-only — system prompt and tool description for export_payslips_csv make clear it cannot generate salary slips; if asked, the agent explains the user must trigger a run from the Tasks tab' },
      { tag: 'fix', scope: 'chat', description: 'Conversation history no longer causes duplicate messages — staleTime set to Infinity and a ref prevents history query re-fetches from overwriting locally-appended messages; key={convId} on ChatTab forces remount on conversation switch' },
      { tag: 'fix', scope: 'hr', description: 'Conversation history is now passed to the LLM — prior messages are reconstructed from the history payload and prepended so the agent maintains context across turns' },
      { tag: 'feat', scope: 'chat', description: 'Thumbs up/down feedback buttons appear on agent message hover — inline rating stored in local state; clicking again toggles off' },
      { tag: 'feat', scope: 'hr', description: 'Updated HR chat suggestions: who is on leave today, pending leave requests, WFH, birthdays, payslip summary, CSV download, salary generation redirect' },
    ],
  },
  {
    version: 'v3.1.6',
    date: '2026-05-03',
    entries: [
      { tag: 'fix', scope: 'notifications', description: 'Agent failures count clears when navigating to Activity page or clicking the row — stored as a seen-at timestamp in localStorage; backend only counts failures after that point, not the full 24h window' },
    ],
  },
  {
    version: 'v3.1.5',
    date: '2026-05-03',
    entries: [
      { tag: 'fix', scope: 'telegram', description: 'Removed parse_mode:Markdown from all button messages (approval, KB proposal, HR leave/WFH/payslip, routing) — underscores in employee names or action summaries were silently breaking message delivery and preventing buttons from appearing' },
      { tag: 'fix', scope: 'telegram', description: 'Added bot middleware to re-fetch ownerChatId on every update — if the setting was not loaded at startup, all callback button clicks were silently rejected as Unauthorized' },
      { tag: 'fix', scope: 'hr', description: 'Chat queries from the web UI no longer go to Telegram — notify_result actions tagged with source:chat skip the telegram.sendMessage call; the chat page already reads the response from the run result' },
      { tag: 'fix', scope: 'runtime', description: 'Agent runs no longer show AWAITING_APPROVAL when all actions auto-execute — the run processor only sets that status when at least one action requires explicit approval' },
    ],
  },
  {
    version: 'v3.1.4',
    date: '2026-05-03',
    entries: [
      { tag: 'fix', scope: 'llm', description: 'completeWithTools now respects the global LLM provider setting for all agents — when Settings sets gemini as default, tool-calling falls back to openai with a warning instead of silently ignoring the setting; all agents using agentLlmOpts({}) correctly inherit the settings provider' },
    ],
  },
  {
    version: 'v3.1.3',
    date: '2026-05-03',
    entries: [
      { tag: 'fix', scope: 'hr', description: 'LLM tool-call loop now works — assistant messages replayed to OpenAI now include type:"function" and nested function:{name,arguments} as required; previously the flat internal ToolCall shape was sent raw and OpenAI rejected it with 400' },
      { tag: 'fix', scope: 'telegram', description: 'sendMessage no longer sets parse_mode:Markdown — LLM responses and agent digests are plain text; any underscore, asterisk, or bracket in the text was causing Telegram entity-parse errors' },
    ],
  },
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
