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
