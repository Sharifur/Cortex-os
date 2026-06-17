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
    version: 'v5.1.1',
    date: '2026-06-17',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'Chat bubble button now has an accessible name (aria-label and title "Open chat") plus an explicit type. Resolves the Lighthouse "Buttons do not have an accessible name" accessibility/SEO warning and gives a hover tooltip.' },
    ],
  },
  {
    version: 'v5.1.0',
    date: '2026-06-16',
    entries: [
      { tag: 'feat', scope: 'livechat', description: 'Widget position can now be set per embed via the data-position attribute (left/right or bottom-left/bottom-right). Overrides the site\'s saved position; falls back to the saved position, then bottom-right.' },
    ],
  },
  {
    version: 'v5.0.3',
    date: '2026-06-15',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'Build failure: added pageContext to SessionRow interface so VisitorSidebar traffic source section compiles correctly.' },
    ],
  },
  {
    version: 'v5.0.2',
    date: '2026-06-15',
    entries: [
      { tag: 'feat', scope: 'livechat', description: 'Traffic source section in visitor sidebar: classifies referrer as Search (Google, Bing, DuckDuckGo, Yandex, Baidu…), AI (ChatGPT, Gemini, Claude, Perplexity, Copilot…), Social (Facebook, X, LinkedIn, Reddit, TikTok…), Email campaign, UTM campaign, Referral, or Direct. Shows campaign/medium/keyword when UTM params present.' },
    ],
  },
  {
    version: 'v5.0.1',
    date: '2026-06-15',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'Notification sound now plays only when a visitor sends a message. Agent replies, status changes, takeovers, and other system actions no longer trigger the sound.' },
    ],
  },
  {
    version: 'v5.0.0',
    date: '2026-06-15',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'Delete message button now visible on all message types (visitor, AI, operator) when viewed from the operator dashboard. Previously only showed on operator-role messages due to wrong isOperator check.' },
      { tag: 'fix', scope: 'livechat', description: 'Email validation now rejects single-char TLDs (e.g. y@y.y), single-char local parts, and domain labels shorter than 2 chars — catches dummy addresses not covered by the disposable domain blocklist.' },
    ],
  },
  {
    version: 'v4.99.0',
    date: '2026-06-15',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'Apology message ("Sorry for the wait") now injected only once per escalation (first alert). Subsequent hourly admin reminders send email + push only — no more repeated in-chat messages.' },
      { tag: 'fix', scope: 'livechat', description: 'Visitor confirmation email also sent on first alert only, not on every hourly sweep.' },
      { tag: 'feat', scope: 'livechat', description: 'Operator takeover now injects "A support agent has joined" in-chat message when session was in needs_human state.' },
      { tag: 'feat', scope: 'livechat', description: 'Closing a needs_human session injects a "We weren\'t able to connect you live — we\'ll reply to your email" message to the visitor.' },
      { tag: 'feat', scope: 'livechat', description: 'SNS signature verification on inbound email webhook; rejects unsigned or forged SNS notifications.' },
      { tag: 'feat', scope: 'livechat', description: 'LLM call rate limit: 3 LLM invocations per session per minute to prevent cost spikes from message flooding.' },
      { tag: 'feat', scope: 'livechat', description: 'Reply lock per session (Redis SETNX, 30s TTL) prevents concurrent agent + operator replies from both landing.' },
      { tag: 'fix', scope: 'livechat', description: 'pageContext JSONB capped at 5KB; larger payloads silently dropped to prevent DB bloat.' },
    ],
  },
  {
    version: 'v4.98.0',
    date: '2026-06-14',
    entries: [
      { tag: 'feat', scope: 'livechat', description: 'KB guardrail service: KB self-service results now pass a 3-stage filter before surfacing in chat — (1) query quality check rejects gibberish/short queries, (2) hard site_keys match rejects untagged global entries, (3) LLM relevance scoring discards low-scoring results. Each rejection is logged at debug level.' },
      { tag: 'fix', scope: 'livechat', description: 'KB self-service no longer shows results when site context cannot be resolved (site lookup failure now bails early instead of falling back to untagged global entries).' },
    ],
  },
  {
    version: 'v4.97.0',
    date: '2026-06-14',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'Admin alert email now resolves TO address from livechat_alert_email setting (falls back to site alert email then ses_from_address); was accidentally using the FROM address as the recipient.' },
      { tag: 'fix', scope: 'livechat', description: 'KB self-service articles in human-wait flow now scoped to the current site; previously could return results from unrelated sites.' },
      { tag: 'feat', scope: 'livechat', description: 'Web push notification sent to all subscribed operators when visitor waits more than 3 minutes for a human agent.' },
    ],
  },
  {
    version: 'v4.96.0',
    date: '2026-06-14',
    entries: [
      { tag: 'feat', scope: 'livechat', description: 'Widget confirm dialogs (start new chat, end chat) now use an in-widget UI overlay instead of the browser native alert/confirm box.' },
      { tag: 'feat', scope: 'livechat', description: 'Embed snippet customizer in Install modal: toggle welcome popup, set popup delay, and auto-open on load via data-popup / data-delay / data-open attributes.' },
      { tag: 'feat', scope: 'livechat', description: 'Human-wait queue experience: yellow pulsing queue banner shows visitor position in queue, polls every 30s; AI prep-question chips generated after escalation; KB self-service articles surfaced while waiting with "this solved it" escape hatch.' },
      { tag: 'feat', scope: 'livechat', description: 'Admin email alert and in-chat AI apology message sent automatically when no human agent joins a needs_human session within 3 minutes.' },
    ],
  },
  {
    version: 'v4.95.0',
    date: '2026-06-11',
    entries: [
      { tag: 'feat', scope: 'livechat', description: 'Site origin field now supports multiple origins (one per line or comma-separated), subdomain wildcards (*.example.com), and a bare * to allow any domain. Origin input changed to a textarea to prevent truncation.' },
    ],
  },
  {
    version: 'v4.94.0',
    date: '2026-06-09',
    entries: [
      { tag: 'fix', scope: 'support', description: 'request_purchase_code and request_server_access actions now include crmUuid in their payload so the CRM reply is actually posted after Telegram approval instead of being silently dropped.' },
    ],
  },
  {
    version: 'v4.93.0',
    date: '2026-06-07',
    entries: [
      { tag: 'feat', scope: 'support', description: 'Purchase code verification card now shows full details: buyer username, support active/expired with days remaining, can-extend flag, license key, and summary. Data persisted in new verify_data column on support_tickets so details survive even on tickets with no events.' },
      { tag: 'feat', scope: 'support', description: 'Re-verify button on ticket detail page calls license server on demand, saves result to verify_data, and writes a new event to the activity timeline.' },
      { tag: 'feat', scope: 'support', description: 'New POST /support/tickets/:id/reverify endpoint. New migration 0095_support_verify_data.sql adds verify_data jsonb column to support_tickets.' },
    ],
  },
  {
    version: 'v4.92.0',
    date: '2026-06-05',
    entries: [
      { tag: 'feat', scope: 'support', description: 'Train from Screenshot: upload a conversation screenshot in the support agent Settings → Train tab. Vision LLM extracts the dialogue and generates a KB rule proposal. You approve or reject it via Telegram before it goes live.' },
      { tag: 'feat', scope: 'support', description: 'New POST /support/train-from-image endpoint accepts base64 image, category (decision_rule / policy / faq / spam_filter), and an optional instruction. Uses gpt-4o vision to extract conversation then gpt-4o-mini to generate the KB rule.' },
    ],
  },
  {
    version: 'v4.91.1',
    date: '2026-06-05',
    entries: [
      { tag: 'fix', scope: 'support', description: 'Support agent now requires Telegram approval before sending any reply or purchase code request. Previously post_reply and request_purchase_code actions bypassed requiresApproval and executed immediately.' },
    ],
  },
  {
    version: 'v4.91.0',
    date: '2026-06-04',
    entries: [
      { tag: 'feat', scope: 'livechat', description: 'Admin alert email when a chat needs human assistance and no operator joins within 3 minutes. Configurable per site via the new "Human alert email" field in the Transcript settings tab.' },
    ],
  },
  {
    version: 'v4.90.4',
    date: '2026-06-02',
    entries: [
      { tag: 'fix', scope: 'taskip-trial', description: 'Added onModuleInit table guard for taskip_trial_sequences so the table is created automatically on startup if the migration was not applied.' },
    ],
  },
  {
    version: 'v4.90.3',
    date: '2026-06-01',
    entries: [
      { tag: 'feat', scope: 'support', description: 'Telegram notifications for auto-sent replies now include urgency level, priority, category, and ticket ID. Urgent and high-priority tickets get a [URGENT] or [HIGH] prefix so they stand out immediately.' },
    ],
  },
  {
    version: 'v4.90.2',
    date: '2026-06-01',
    entries: [
      { tag: 'fix', scope: 'support', description: 'CRM reply now sends numeric status code 1 (in_progress) instead of the string in_progress, matching the CRM API contract.' },
    ],
  },
  {
    version: 'v4.90.1',
    date: '2026-06-01',
    entries: [
      { tag: 'fix', scope: 'support', description: 'Support agent reply no longer closes the CRM ticket. Now sends status: in_progress in the agent-reply request body so the ticket stays open after a reply.' },
    ],
  },
  {
    version: 'v4.90.0',
    date: '2026-06-01',
    entries: [
      { tag: 'feat', scope: 'livechat', description: 'Operators can now delete their own sent messages in live chat. A trash icon appears on hover next to operator messages. Deleting removes the message immediately for the operator and broadcasts a message_removed event to the visitor in real time.' },
    ],
  },
  {
    version: 'v4.89.3',
    date: '2026-05-31',
    entries: [
      { tag: 'fix', scope: 'linkedin', description: 'LinkedIn agent now runs ALTER TABLE on startup to ensure blocked_countries column exists before any query executes. Fixes persistent column-not-found errors when migration 0084 was tracked as applied but the column was never actually created in production.' },
    ],
  },
  {
    version: 'v4.89.2',
    date: '2026-05-31',
    entries: [
      { tag: 'fix', scope: 'support', description: 'Fixed support agent reply endpoint — base URL already contained /api/public-v1 so it was being doubled in the path. Also corrected path order from {uuid}/agent-reply to agent-reply/{uuid} to match the actual Taskip API.' },
    ],
  },
  {
    version: 'v4.89.1',
    date: '2026-05-31',
    entries: [
      { tag: 'fix', scope: 'linkedin', description: 'Added migration 0093 to ensure blocked_countries column exists on linkedin_accounts table. Column was missing in production causing the LinkedIn agent to fail on every run.' },
    ],
  },
  {
    version: 'v4.89.0',
    date: '2026-05-31',
    entries: [
      { tag: 'feat', scope: 'taskip-internal', description: 'Email draft card now supports two full body variants (A and B), not just subject swap. SPAR system prompt outputs Variant A and Variant B with labelled tone tabs (e.g. "Full structured" / "Founder voice"). Switching tabs changes both the subject line and the body. Copy and Send use whichever variant is active.' },
    ],
  },
  {
    version: 'v4.88.3',
    date: '2026-05-31',
    entries: [
      { tag: 'fix', scope: 'chat', description: 'Send Email modal now renders via React portal at document.body level, fixing the responsive overlap where the dark backdrop only covered part of the screen on mobile and narrow viewports.' },
    ],
  },
  {
    version: 'v4.88.2',
    date: '2026-05-31',
    entries: [
      { tag: 'fix', scope: 'taskip-internal', description: 'lookup_user MCP tool now searches by company/workspace name when input is not an email address. Previously only email lookups worked — searching "Tallo Digital" would fail with no results.' },
      { tag: 'fix', scope: 'taskip-internal', description: 'Email draft card now renders correctly in chat when the LLM outputs a single Subject line (no A/B variant) followed by the Email body section. Previously the card fell back to a plain text bubble.' },
    ],
  },
  {
    version: 'v4.88.1',
    date: '2026-05-31',
    entries: [
      { tag: 'feat', scope: 'simulate', description: 'Simulate tab now shows a full step-by-step process trace on the right panel. Each agent response reveals: always-on context loaded (with entry type breakdown), writing samples and blocklist counts, KB semantic search result with matched entry types, prompt block assembly with token estimate, coverage gate pass/fail, and LLM call timing. Clicking any response selects it and populates the trace panel. Always-on and matched entries are listed with title, type, priority, and content preview.' },
    ],
  },
  {
    version: 'v4.88.0',
    date: '2026-05-31',
    entries: [
      { tag: 'feat', scope: 'self-improvement', description: 'Added correction signal capture system. Every agent approval, rejection, and follow-up is recorded to correction_signals table — capturing latency, follow-up count, draft text, and rejection reason. Weekly BullMQ job analyses 30-day patterns, identifies recurring mistakes (3+ occurrences), and proposes KB entries via Telegram approval.' },
      { tag: 'feat', scope: 'simulate', description: 'Added Simulate tab to every agent detail page. Chat with the agent as a fake visitor — dry run only, no emails sent, no Telegram messages. Shows which KB entries were matched, always-on entry count, blocklist rules active, and the full assembled KB prompt block. Good/bad ratings on each response feed into correction signals for self-improvement.' },
      { tag: 'feat', scope: 'knowledge-base', description: 'Added Product Q&A tab to Knowledge Base page. Create structured Q: / A: entries scoped per agent. These entries are always retrieved when a visitor asks a question, and are included in the livechat coverage gate — preventing unnecessary escalation to human when answers exist in KB.' },
      { tag: 'fix', scope: 'livechat', description: 'Fixed product_qa entries not being included in the livechat KB coverage gate or FTS search. Agents with product_qa entries now correctly treat them as product catalog coverage instead of escalating.' },
    ],
  },
  {
    version: 'v4.87.0',
    date: '2026-05-28',
    entries: [
      { tag: 'feat', scope: 'inbox', description: 'AI Draft Assistant now passes the original email body + strong engagement signal to the agent. When recipient opened but did not reply, the prompt explicitly instructs the LLM to write as a continuation (not a cold restart), reduce friction, and end with one specific question — not a generic re-introduction.' },
      { tag: 'feat', scope: 'inbox', description: 'Added "Send this draft" button in the AI Draft Assistant panel. When the agent returns a parseable email draft (Email: ... Self-score: format), a "Draft ready" CTA appears above the chat input. One click sends the draft as a reply using the existing send endpoint — no copy-paste required.' },
    ],
  },
  {
    version: 'v4.86.1',
    date: '2026-05-27',
    entries: [
      { tag: 'feat', scope: 'trial-sequences', description: 'Added Trial Sequences management page at /trial-sequences. Shows all onboarding sequences grouped by status (active, completed, cancelled) with step progress dots, sent angle labels, next-send timing, industry tag, and sender account. Active sequences can be cancelled directly from the page. Auto-refreshes every 30s.' },
      { tag: 'feat', scope: 'taskip-trial', description: 'Added PATCH /taskip-trial/sequences/:id/cancel API endpoint to cancel active sequences.' },
    ],
  },
  {
    version: 'v4.86.0',
    date: '2026-05-27',
    entries: [
      { tag: 'feat', scope: 'taskip-trial', description: '7-day hyper-personalized trial onboarding sequence. Triggered via POST /taskip-trial/trial-activated webhook; CRON sweep drafts one email per day per user using live Insight data (last_active_at, cohort, feature usage, industry). LLM picks from 7 angle pool (welcome_first_win, core_feature, team_collaboration, checkin_questions, advanced_unlock, social_proof, upgrade_cta) — sent_angles JSONB prevents repeating the same angle. gmail_account_id locked to sequence at step 0 for consistency. Each email requires Telegram approval showing angle label and computed reason before send.' },
      { tag: 'chore', scope: 'taskip-trial', description: 'Retired day3/day5/trial_expiring_24h CRON segments; replaced by new sequence. paid_at_risk and churned_30d legacy segments remain active.' },
    ],
  },
  {
    version: 'v4.85.6',
    date: '2026-05-27',
    entries: [
      { tag: 'feat', scope: 'nav', description: 'Live Chat and Inbox nav items now show badge counts: Live Chat shows pending human-assist chats (waitingChats), Inbox shows new unread replies (newInboxReplies). Both badges use distinct colors and update every 5 min alongside the notification bell.' },
      { tag: 'fix', scope: 'inbox', description: 'Manual reply sent from Inbox detail view no longer appears as a separate top-level inbox item. Reply rows are tagged with parentEmailId in metadata and filtered out of the inbox list, so the thread stays clean.' },
    ],
  },
  {
    version: 'v4.85.5',
    date: '2026-05-26',
    entries: [
      { tag: 'fix', scope: 'build', description: 'Fixed Docker build failure: BullMQ forRootAsync now passes parsed connection options (host/port/password) instead of an IORedis instance, resolving TS2322 type mismatch between project ioredis and BullMQ\'s bundled ioredis in app.module.ts and worker.ts.' },
    ],
  },
  {
    version: 'v4.85.4',
    date: '2026-05-26',
    entries: [
      { tag: 'feat', scope: 'listing-outreach', description: 'Added Email channel override button on prospect detail page for generating email-format outreach drafts on demand.' },
      { tag: 'fix', scope: 'listing-outreach', description: 'Per-channel loading state on draft buttons: only the clicked button shows a spinner; all others disable without showing a spinner.' },
    ],
  },
  {
    version: 'v4.85.3',
    date: '2026-05-25',
    entries: [
      { tag: 'fix', scope: 'taskip-internal', description: 'Expanded placeholder ban in email drafts to cover all bracket tokens used in prompt templates ([first name], [data point], [metric], [question], [specific thing], [recipient], [company], [workspace], etc.). Every token must be replaced with the actual workspace value — if unknown, the sentence is rephrased to omit it rather than leaving a bracket.' },
    ],
  },
  {
    version: 'v4.85.1',
    date: '2026-05-25',
    entries: [
      { tag: 'feat', scope: 'listing-outreach', description: 'Platform-specific outreach drafts: auto-detects Reddit, Twitter/X, Instagram, Pinterest, LinkedIn by prospect domain and generates channel-native copy (Reddit peer comment, Twitter <=50 words, Instagram DM, Pinterest board pitch, LinkedIn note) instead of always using email format.' },
      { tag: 'feat', scope: 'listing-outreach', description: 'Channel override buttons on prospect detail page (Reddit, LinkedIn, Instagram) allow manual regeneration in a specific channel regardless of available contact info.' },
      { tag: 'feat', scope: 'listing-outreach', description: 'Draft labels adapt to channel: Subject/Body for email, Thread/Comment for Reddit, LinkedIn note/Message for LinkedIn, Instagram DM/Message for Instagram, Form text/Submission for submit-form channel.' },
      { tag: 'fix', scope: 'listing-outreach', description: 'Removed [Editor Name] placeholder — drafts now use actual contact name when known or a plain "Hi" greeting. Banned "partnership opportunity" framing; mutual feature value ("we will also feature your site") used instead.' },
      { tag: 'fix', scope: 'listing-outreach', description: 'Site name in subject lines now strips trailing page title after "|" (e.g. "20 Best X | Hubflo" -> "Hubflo") for cleaner, less robotic subjects.' },
    ],
  },
  {
    version: 'v4.85.0',
    date: '2026-05-25',
    entries: [
      { tag: 'feat', scope: 'listing-outreach', description: 'Prospects tab improvements: search by domain/email/product, default filter shows pending prospects (discovered + researched + pending_approval), delete button per row, click row navigates to dedicated prospect detail page.' },
      { tag: 'feat', scope: 'listing-outreach', description: 'New prospect detail page at /listing-outreach/prospects/:id with full info, status management, notes editing, outreach draft (generate / regenerate / send email), and activity feed.' },
      { tag: 'feat', scope: 'listing-outreach', description: 'Activity tracking on prospect detail page: email sent (stores subject + body, expandable preview), Twitter/X DM, LinkedIn message, manual notes, status changes — all recorded in listing_prospect_activities table.' },
      { tag: 'feat', scope: 'listing-outreach', description: 'Added dedicated Prospects page in sidebar (/listing-outreach/prospects) with search, status filters, inline status updates, delete, and click-to-detail navigation.' },
    ],
  },
  {
    version: 'v4.84.18',
    date: '2026-05-24',
    entries: [
      { tag: 'feat', scope: 'chat', description: 'Five chat UX improvements for Taskip Internal: (1) self-score badge on email cards is now color-coded green/amber/red based on the N/5 score; (2) refinement chips ("Try blunt style", "Different angle", "Make it shorter", "More empathetic") appear below the last email draft for one-tap rewrites; (3) the thinking indicator shows a live step label ("Analyzing workspace...", "Calling tool...", "Checking spam score...", "Rewriting for deliverability...") pulled from run logs; (4) email cards show "Draft N of N / ← Previous" when multiple drafts exist in the conversation; (5) all-skipped responses ("recently contacted", "already engaged") render as an amber notice card instead of a plain text bubble.' },
    ],
  },
  {
    version: 'v4.84.17',
    date: '2026-05-24',
    entries: [
      { tag: 'feat', scope: 'taskip-internal', description: 'Chat now acknowledges refinement instructions before regenerating. When you type "write from different angle", "rewrite covering module X", etc. after a draft was shown, the agent starts its response with a one-line "Revising: ..." summary of what it is changing, then produces the revised SPAR output — without re-fetching workspace data.' },
    ],
  },
  {
    version: 'v4.84.16',
    date: '2026-05-24',
    entries: [
      { tag: 'feat', scope: 'listing-outreach', description: 'Added 5 quality filters to listing prospect discovery: non-directory content (news, jobs, podcasts) is skipped early before scraping; non-English pages skipped via ASCII ratio check; OPR floor < 0.5 excludes micro-sites; prospects with no contact path (email, submit URL, or contact form) discarded after scrape; rejected prospects now enter a 90-day cooldown before re-discovery. Rejection with reason now triggers an automatic re-draft incorporating the feedback, stored in the prospect record and notified via Telegram.' },
    ],
  },
  {
    version: 'v4.84.15',
    date: '2026-05-24',
    entries: [
      { tag: 'fix', scope: 'tracking', description: 'Email tracking pixel now ignores opens within 5 minutes of send time. Gmail pre-fetches the pixel immediately after send, and sender self-views in the sent folder also fire the pixel — both were inflating open counts. Opens after the 5-minute grace period count normally.' },
    ],
  },
  {
    version: 'v4.84.14',
    date: '2026-05-24',
    entries: [
      { tag: 'fix', scope: 'integrations', description: 'Added listing integration test endpoint — /integrations/listing/test now validates the Brave Search API key with a live probe and reports Open PageRank configuration status. Previously returned "Unknown integration: listing".' },
    ],
  },
  {
    version: 'v4.84.13',
    date: '2026-05-24',
    entries: [
      { tag: 'fix', scope: 'support', description: 'CRM agent-reply now tries three URL candidates in order (uuid/agent-reply, numericId/agent-reply, numericId/reply) and stops on first success. Each attempt is logged so server logs show the exact URL the CRM accepts or rejects. Misleading "check support_agent_id" hint removed from failure message.' },
    ],
  },
  {
    version: 'v4.84.12',
    date: '2026-05-24',
    entries: [
      { tag: 'fix', scope: 'inbox', description: 'Clicking a reply email (Re: ...) in the inbox list no longer jumps back to the previously highlighted email. The highlight useEffect now applies only once on initial load and does not reset user selection on every data refetch. Email body also reads from the fresh detail query when available.' },
    ],
  },
  {
    version: 'v4.84.11',
    date: '2026-05-23',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'Block disposable and obviously fake emails (mailinator, guerrillamail, yopmail, 10minutemail, etc.) and dummy local-parts containing test/dummy/fake from the identify endpoint. Returns 400 with a clear message.' },
    ],
  },
  {
    version: 'v4.84.10',
    date: '2026-05-23',
    entries: [
      { tag: 'fix', scope: 'cors', description: 'Set Access-Control-Allow-Credentials: true in global CORS config so livechat widget requests with credentials: include pass the preflight check.' },
    ],
  },
  {
    version: 'v4.84.9',
    date: '2026-05-21',
    entries: [
      { tag: 'feat', scope: 'live-chat', description: 'Site filter dropdown now always visible below the search bar in the Conversations sidebar — no longer hidden behind the filter icon. Highlights in primary color when a site is active.' },
    ],
  },
  {
    version: 'v4.84.8',
    date: '2026-05-21',
    entries: [
      { tag: 'fix', scope: 'listing-outreach', description: 'Added contactFormUrl field to Prospect type in AgentDetailPage — was missing from the TypeScript interface, causing a build failure in production (tsc error TS2339).' },
    ],
  },
  {
    version: 'v4.84.7',
    date: '2026-05-21',
    entries: [
      { tag: 'feat', scope: 'listing-outreach', description: 'Send Email button now opens a compose modal (like the inbox composer) pre-filled with To, Subject, and Body. User can edit everything, switch Gmail account, and send — no direct fire. Patches prospect status to emailed on success.' },
      { tag: 'fix', scope: 'listing-outreach', description: 'Removed direct-send endpoint path — all outreach email sending goes through the compose modal.' },
    ],
  },
  {
    version: 'v4.84.6',
    date: '2026-05-21',
    entries: [
      { tag: 'feat', scope: 'listing-outreach', description: 'Generate Draft button in expanded prospect rows: when no draft exists, a lightning bolt button calls POST /listing-outreach/prospects/:id/draft which runs the LLM + self-critique inline and saves subject + body to the row. Table refreshes immediately with the new draft.' },
    ],
  },
  {
    version: 'v4.84.5',
    date: '2026-05-21',
    entries: [
      { tag: 'feat', scope: 'listing-outreach', description: 'Prospects tab now paginates: 20 rows per page with Previous/Next controls and total count. Filter pills reset to page 1 on change.' },
      { tag: 'feat', scope: 'listing-outreach', description: 'Send Email button in expanded prospect rows: visible when the prospect has a contact email + outreach draft and has not been emailed yet. Sends the pre-filled subject and body directly from the page without going through Telegram approval.' },
    ],
  },
  {
    version: 'v4.84.4',
    date: '2026-05-21',
    entries: [
      { tag: 'feat', scope: 'listing-outreach', description: 'Prospect rows are now expandable: click any row to see outreach approach badges (email / submit form / contact form / LinkedIn), the drafted subject line, and the full message body — each with a Copy button. Shows "No draft yet" for rows pending a run.' },
      { tag: 'feat', scope: 'listing-outreach', description: 'decide() now writes outreach_subject and outreach_body back to the listing_prospects row after LLM draft + self-critique so the Prospects tab can display the draft without re-running.' },
      { tag: 'chore', scope: 'listing-outreach', description: 'Migration 0089 adds outreach_subject and outreach_body columns to listing_prospects.' },
    ],
  },
  {
    version: 'v4.84.3',
    date: '2026-05-20',
    entries: [
      { tag: 'fix', scope: 'listing-outreach', description: 'Prospects tab now loads correctly — /listing-outreach was missing from Vite proxy paths, causing all API calls to return the HTML shell instead of data.' },
      { tag: 'fix', scope: 'listing-outreach', description: 'buildContext parallelized: all Brave Search queries fire concurrently, site OPR + scraping runs in parallel chunks of 5. Scrape pages reduced from 8 to 4, timeout from 8s to 5s — run time drops from 10+ minutes to under 2 minutes.' },
      { tag: 'fix', scope: 'listing-outreach', description: 'Progress logs now stream to the run log panel during discovery — shows search completion, candidate count, chunk progress, and final prospect count.' },
    ],
  },
  {
    version: 'v4.84.2',
    date: '2026-05-20',
    entries: [
      { tag: 'feat', scope: 'listing-outreach', description: 'General tab in Listing Outreach settings now has a proper products editor: add/remove products, set domain, name, outreach goal, and manage search queries per product with inline add/remove. Limits (monthly, per-run, min score, cooldown) are also editable there.' },
      { tag: 'chore', scope: 'listing-outreach', description: 'Removed the unused Search Queries field from Integrations — queries are now configured per-product in the agent General tab.' },
    ],
  },
  {
    version: 'v4.84.1',
    date: '2026-05-20',
    entries: [
      { tag: 'feat', scope: 'listing-outreach', description: 'Prospects tab on the Listing Outreach Agent detail page: shows all discovered sites in a table with domain, product, quality score, contact email, LinkedIn link, and status. Status can be changed inline via dropdown. Filter by status via pill buttons at the top.' },
    ],
  },
  {
    version: 'v4.84.0',
    date: '2026-05-20',
    entries: [
      { tag: 'feat', scope: 'listing-outreach', description: 'New Listing Outreach Agent: discovers top-ranked SaaS and AI tool listing sites via Brave Search, scrapes contact emails, scores site quality (search rank + Open PageRank + contact signals, 0-100), drafts KB-voiced outreach emails, and routes each one through Telegram for approval before sending.' },
      { tag: 'feat', scope: 'listing-outreach', description: 'Per-product config: taskip.net (SaaS PM tool, outreach goal: both) and xgenious.com (dev agency, outreach goal: partnership) each have their own query sets. Compound unique key (domain, product_domain) ensures the same listing site can be targeted for each product independently.' },
      { tag: 'fix', scope: 'listing-outreach', description: 'Setup checklist steps 2 and 3 now reflect live settings state — Open PageRank API key step marks done when the key is stored, outreach limits step always marks done since defaults work out of the box.' },
    ],
  },
  {
    version: 'v4.83.3',
    date: '2026-05-20',
    entries: [
      { tag: 'fix', scope: 'inbox', description: 'Reply from Inbox now threads correctly — passes In-Reply-To + References headers and Gmail threadId so replies land in the original thread instead of starting a new one.' },
    ],
  },
  {
    version: 'v4.83.2',
    date: '2026-05-20',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'SNS SubscriptionConfirmation now handled before token auth check — previously a fresh subscription would stay pending because the 401 prevented cortex from fetching the SubscribeURL.' },
    ],
  },
  {
    version: 'v4.83.1',
    date: '2026-05-20',
    entries: [
      { tag: 'fix', scope: 'support', description: 'Fixed send-reply 404: CRM agent-reply endpoint URL had UUID and action segment inverted; corrected to /support-ticket/{uuid}/agent-reply.' },
    ],
  },
  {
    version: 'v4.83.0',
    date: '2026-05-20',
    entries: [
      { tag: 'feat', scope: 'livechat', description: 'Bulk close all chats: "Close all" button in the conversations sidebar closes every non-closed session matching the current filter (site + status). Confirms before acting, then invalidates the inbox.' },
    ],
  },
  {
    version: 'v4.82.1',
    date: '2026-05-20',
    entries: [
      { tag: 'chore', scope: 'livechat', description: 'Rewrote LC-27 email-to-thread setup runbook with step-by-step MX record, SNS topic, SES Receipt Rule instructions, troubleshooting table, and anti-spoofing notes.' },
    ],
  },
  {
    version: 'v4.82.0',
    date: '2026-05-20',
    entries: [
      { tag: 'feat', scope: 'livechat', description: 'Inactivity email: if a visitor goes offline for 3+ minutes with unread agent messages, an email is sent automatically with the missed messages and a Reply-To so they can respond directly from email.' },
      { tag: 'fix', scope: 'livechat', description: 'Reply-To address now auto-sets once livechat_reply_domain is configured — livechat_reply_secret is generated automatically if missing.' },
      { tag: 'feat', scope: 'widget', description: 'Email auto-capture: when a visitor types an email address in the chat textarea the widget silently calls identify() so the session is linked to their email without interrupting the conversation.' },
      { tag: 'feat', scope: 'ses', description: 'SES webhook and livechat inbound controller now emit detailed debug/warn logs for all notification types, bounces, complaints, and rejected inbound emails — easier to diagnose routing issues.' },
      { tag: 'fix', scope: 'livechat', description: 'Transcript service now warns at log level WARN (not DEBUG) when Reply-To cannot be set, with a clear message about which settings are missing.' },
    ],
  },
  {
    version: 'v4.81.0',
    date: '2026-05-20',
    entries: [
      { tag: 'feat', scope: 'inbox', description: 'Mobile responsive layout: email list and detail panel stack on small screens with back navigation between views.' },
      { tag: 'feat', scope: 'inbox', description: 'Web Push notifications for new email replies — bell icon in inbox top bar to subscribe/unsubscribe per browser.' },
      { tag: 'feat', scope: 'notifications', description: 'Bell icon now shows unread inbox replies count (last 24h) alongside existing chat/approval/failure counts.' },
      { tag: 'fix', scope: 'inbox', description: 'Timestamps now parsed as UTC by appending Z to strings lacking timezone designator, fixing relative time showing 6h offset for UTC+6 users.' },
      { tag: 'fix', scope: 'inbox', description: 'All date displays use configured platform timezone (Asia/Dhaka) instead of browser OS timezone.' },
    ],
  },
  {
    version: 'v4.80.1',
    date: '2026-05-20',
    entries: [
      { tag: 'fix', scope: 'tracking', description: 'Tracking pixel handler now passes ISO string to Postgres timestamp columns instead of a Date object, fixing 500 errors on open tracking requests.' },
    ],
  },
  {
    version: 'v4.80.0',
    date: '2026-05-18',
    entries: [
      { tag: 'feat', scope: 'linkedin', description: 'Template system for DM outreach: 502 stage-tagged templates stored in DB, LLM picks best candidate, variables resolved contextually. Fresh leads (dmStep=0) use templates; follow-up DMs use sequence step instructions.' },
      { tag: 'fix', scope: 'linkedin', description: 'Connection request note hard-capped at 200 chars at Unipile boundary and 190 chars in LLM prompt to prevent 400 too_many_characters errors.' },
      { tag: 'feat', scope: 'linkedin', description: 'LinkedIn templates migration (0085) and LinkedInTemplateService with candidate fetching, LLM picker, and two-pass variable renderer.' },
    ],
  },
  {
    version: 'v4.79.7',
    date: '2026-05-17',
    entries: [
      { tag: 'fix', scope: 'support', description: 'KB import ticket lookup now matches by both ticket_no and external_id. Previously only ticket_no was checked, so numeric CRM ticket IDs (stored in external_id) were not resolved to a UUID and the CRM fetch returned HTTP 404.' },
    ],
  },
  {
    version: 'v4.79.6',
    date: '2026-05-17',
    entries: [
      { tag: 'fix', scope: 'support', description: 'Feed KB from CRM Ticket now resolves UUID from local DB by ticket number before calling the CRM API. CRM API requires UUID — passing a numeric ticket number caused HTTP 404. Both ticket fetch and replies fetch use the resolved UUID.' },
    ],
  },
  {
    version: 'v4.79.5',
    date: '2026-05-17',
    entries: [
      { tag: 'feat', scope: 'linkedin', description: 'Per-account blocked countries: chip multi-select in the Accounts tab. Type a country name and press Enter to add, click x to remove. Saved immediately via PATCH. Merged with the global blockedCountries config at runtime. Migration 0084 adds blocked_countries column.' },
    ],
  },
  {
    version: 'v4.79.4',
    date: '2026-05-17',
    entries: [
      { tag: 'feat', scope: 'inbox', description: 'Inbox email list shows sending Gmail account as a badge on each row. Detail view shows "From: account" in the header. Reply composer pre-selects the account that sent the original email instead of always defaulting to the platform default. Migration 0083 adds gmail_account_id column to taskip_internal_emails.' },
      { tag: 'feat', scope: 'linkedin', description: 'Connection requests now support blockedCountries config key — an array of country names to skip (e.g. ["India","Pakistan"]). Matched case-insensitively against the Unipile location field on each candidate profile.' },
    ],
  },
  {
    version: 'v4.79.3',
    date: '2026-05-17',
    entries: [
      { tag: 'fix', scope: 'linkedin', description: 'Connection request notes no longer contain [Name] placeholder. Prompt now instructs LLM to use the actual first name; a post-generation replace also catches any remaining [name] occurrences.' },
    ],
  },
  {
    version: 'v4.79.2',
    date: '2026-05-17',
    entries: [
      { tag: 'fix', scope: 'linkedin', description: 'getNativeFeedPosts now uses Unipile internal ID (p.id) as post.id instead of provider_id (LinkedIn URN). Fixes "Comment failed on both paths" — Unipile native comment API requires its own internal ID, not a LinkedIn URN. URL generation still uses provider_id.' },
    ],
  },
  {
    version: 'v4.79.1',
    date: '2026-05-17',
    entries: [
      { tag: 'feat', scope: 'linkedin', description: 'Agent detects CTA posts (e.g. "comment LINKEDIN", comment "FREE") and responds with the exact keyword instead of generating a generic comment. Handles double quotes, smart quotes, single quotes, and ALL_CAPS keywords.' },
    ],
  },
  {
    version: 'v4.79.0',
    date: '2026-05-16',
    entries: [
      { tag: 'fix', scope: 'inbox', description: 'Tracking pixel URL now reads api_public_url from Settings first, then falls back to COOLIFY_URL / API_PUBLIC_URL env vars. Previously the URL was always empty on production if those env vars were not set, so open tracking never fired.' },
      { tag: 'fix', scope: 'inbox', description: 'IMAP: after sending, getMessage(smtpMessageId) was doing Number(smtpMessageId) which evaluates to NaN, causing the fetch to fail silently and gmailThreadId to be stored as null. syncReplies then returned immediately. Now falls back to using the SMTP Message-ID itself as the threadId.' },
      { tag: 'fix', scope: 'inbox', description: 'IMAP getThread now searches In-Reply-To header instead of Message-ID. The old search matched only the original sent message (in Sent folder, not INBOX), returning no replies. The new search finds messages in INBOX that replied to the sent email.' },
    ],
  },
  {
    version: 'v4.78.9',
    date: '2026-05-16',
    entries: [
      { tag: 'fix', scope: 'linkedin', description: 'getNativeFeedPosts now maps post ID to provider_id (LinkedIn activity URN) before internal Unipile ID. Fixes Voyager fallback building a malformed URL with an internal ID, which caused 400 "rejected by provider" from LinkedIn.' },
      { tag: 'fix', scope: 'linkedin', description: 'postComment skips Voyager fallback when postId is not a LinkedIn URN (urn:li: prefix), avoiding a guaranteed-400 call. Error message now identifies the non-URN postId for easier diagnosis.' },
    ],
  },
  {
    version: 'v4.78.8',
    date: '2026-05-16',
    entries: [
      { tag: 'fix', scope: 'canva', description: 'Post Renders slide images now load via GET /posts/renders/:id/slides/:n/png proxy instead of raw R2 URLs. The endpoint looks up the stored URL from DB and proxies from R2 server-side, so browser never needs direct R2 access.' },
      { tag: 'feat', scope: 'canva', description: 'Slide thumbnails in Post Renders show a skeleton pulse while loading and an image placeholder on error, same as template cards.' },
    ],
  },
  {
    version: 'v4.78.7',
    date: '2026-05-16',
    entries: [
      { tag: 'fix', scope: 'canva', description: 'DnaTemplateCard now uses /design-studio/templates/:id/preview as img src (API proxy) instead of template.previewData directly. Fixes broken thumbnails for R2-hosted templates where the raw URL is private or signed URLs have expired.' },
      { tag: 'feat', scope: 'canva', description: 'Template cards show a skeleton while the image is loading, then fade in. On error shows "No preview" placeholder instead of broken image icon.' },
    ],
  },
  {
    version: 'v4.78.6',
    date: '2026-05-16',
    entries: [
      { tag: 'fix', scope: 'canva', description: 'Template preview endpoint now proxies R2 URLs through the API instead of redirecting. Fixes broken layout picker thumbnails when R2 bucket is private or signed URLs have expired.' },
      { tag: 'fix', scope: 'canva', description: 'Candidate thumbnail save now uploads to R2 when configured and returns the public URL. On production the DB stores the R2 URL; locally it falls back to the filesystem path.' },
      { tag: 'fix', scope: 'canva', description: 'GET /canva/thumbnail/:id now proxies R2 URLs through the API if thumbnailPath is a URL. Previously always attempted readFile() which fails on production for remote-generated thumbnails.' },
    ],
  },
  {
    version: 'v4.78.5',
    date: '2026-05-16',
    entries: [
      { tag: 'fix', scope: 'linkedin', description: 'Feed now fetched via Unipile native GET /posts (returns internal post IDs) instead of Voyager proxy (returns activity URNs). Native IDs work directly with the comment API — fixes 422 "Post cannot be found" on every comment attempt. Voyager feed kept as fallback if native returns empty.' },
      { tag: 'fix', scope: 'linkedin', description: 'Comment service now tries native Unipile API first (path 1), Voyager proxy second. Previously the order was reversed, so the working path was only reached after the fast-failing path.' },
    ],
  },
  {
    version: 'v4.78.4',
    date: '2026-05-16',
    entries: [
      { tag: 'fix', scope: 'telegram', description: 'Follow-up and reject-reason threadId now embeds APP_ENV prefix so local cannot intercept production reply messages and vice versa. Both storage and lookup are scoped to the current env.' },
      { tag: 'fix', scope: 'linkedin', description: 'Comment posting failure now sends a Telegram notification with the error message instead of silently returning success=false after approval.' },
    ],
  },
  {
    version: 'v4.78.3',
    date: '2026-05-16',
    entries: [
      { tag: 'fix', scope: 'telegram', description: 'Approval callbacks are now environment-scoped via APP_ENV env var (defaults to "local"). Callback data embeds env prefix (e.g. approval:prod:id:approve) so local and production never consume each other\'s Telegram callbacks when sharing the same bot token.' },
    ],
  },
  {
    version: 'v4.78.2',
    date: '2026-05-16',
    entries: [
      { tag: 'fix', scope: 'linkedin', description: 'Comment posting failures are now non-fatal: if a post cannot be commented on (Unipile 422 / post not found), the post is marked failed in the DB and the run continues instead of crashing the entire execution.' },
      { tag: 'fix', scope: 'linkedin', description: 'Voyager proxy comment URL corrected: changed socialactions/ to feed/socialactions/ to match LinkedIn internal API path for commenting on feed posts.' },
    ],
  },
  {
    version: 'v4.78.1',
    date: '2026-05-16',
    entries: [
      { tag: 'feat', scope: 'linkedin', description: '11 pre-built DM sequence templates across 5 categories: Product Outreach (Taskip Agency, SaaS Pain-first, Product Launch), Partnership (exploration, agency-freelancer), Recruitment (tech role, passive nurture), Consulting (lead gen, audit offer), Content & Creator (collaboration, newsletter cross-promo). Each template pre-fills name, goal, and all steps with ready-to-use LLM instructions.' },
      { tag: 'feat', scope: 'linkedin', description: 'DM Sequences tab: From template button opens templates panel with category filter. New sequence button opens blank form. Template picker also accessible inside the editor via Use template button.' },
    ],
  },
  {
    version: 'v4.78.0',
    date: '2026-05-16',
    entries: [
      { tag: 'feat', scope: 'linkedin', description: 'DM sequence system: each LinkedIn account can have one active multi-step sequence with a goal and per-step LLM instructions. Step 1 is sent on first contact; subsequent steps fire automatically when the configured delay (days since last DM) has elapsed.' },
      { tag: 'feat', scope: 'linkedin', description: 'Per-lead sequence tracking: linkedin_leads gains dm_step (current step index) and dm_sequence_id. After each DM execute, dm_step increments. When all steps exhausted, lead status becomes dm_exhausted.' },
      { tag: 'feat', scope: 'linkedin', description: 'DM Sequences tab in LinkedIn settings: create/edit/delete sequences with name, goal, and ordered steps. Each step has delay-days and an instruction textarea the AI uses as the prompt for that message. Supports multiple accounts with different sequences.' },
      { tag: 'feat', scope: 'linkedin', description: 'API: GET/POST /linkedin/dm-sequences, PATCH/DELETE /linkedin/dm-sequences/:id. Migration 0082 adds linkedin_dm_sequences table and dm_step/dm_sequence_id columns to linkedin_leads.' },
    ],
  },
  {
    version: 'v4.77.0',
    date: '2026-05-16',
    entries: [
      { tag: 'feat', scope: 'linkedin', description: 'Post categorization: each feed post is classified (job_new, hiring, success_milestone, design_creative, question, insight, personal_story, product_launch, event, other) before generating a comment. The LLM receives category-specific rules — e.g. job_new prevents any product pitch, design_creative requires engaging with the visual aspect, question requires directly answering.' },
      { tag: 'feat', scope: 'linkedin', description: 'Post-generation category validation: after comment generation, a blocklist of disallowed phrases per category is checked. Comments containing product pitch language on job/personal posts are skipped and logged rather than sent for approval.' },
      { tag: 'feat', scope: 'linkedin', description: 'Post category label shown in Telegram comment proposal: "Comment on [name]s post [design_creative]:" so you can see context before approving.' },
      { tag: 'feat', scope: 'linkedin', description: 'Connection requests: Telegram approval shows Approve + note / Approve (no note) buttons. Approve without note sends a clean connection request with no message. approve_no_note strips payload.note before queuing execute.' },
    ],
  },
  {
    version: 'v4.76.1',
    date: '2026-05-16',
    entries: [
      { tag: 'fix', scope: 'linkedin', description: 'DM proposal Telegram message now includes LinkedIn profile URL and Role (headline) so proposals are identifiable without opening LinkedIn separately.' },
      { tag: 'fix', scope: 'linkedin', description: 'Connection request proposal Telegram message now includes profile URL, Role, niche name, ICP score, and note preview on separate lines.' },
    ],
  },
  {
    version: 'v4.76.0',
    date: '2026-05-16',
    entries: [
      { tag: 'feat', scope: 'linkedin', description: 'Posts tab renamed to Comments. Each entry shows author, post content, draft comment (italic), status badge, and a view post link (LinkedIn feed update URL) for cross-checking.' },
      { tag: 'feat', scope: 'linkedin', description: 'Approve/Reject buttons on pending comments: Approve calls POST /linkedin/posts/:id/approve (posts immediately via Unipile), Reject calls POST /linkedin/posts/:id/reject (skips). Optimistic state per card.' },
      { tag: 'feat', scope: 'linkedin', description: 'Manual persona paste in AccountCard: Paste posts button opens textarea. Posts separated by --- on their own line are sent to POST /linkedin/persona/train-manual and saved as writing samples for that account.' },
    ],
  },
  {
    version: 'v4.75.0',
    date: '2026-05-16',
    entries: [
      { tag: 'fix', scope: 'linkedin', description: 'post_comment 422: LinkedIn comment service now tries Voyager proxy POST first (handles activity URNs from feed), then falls back to native Unipile API with URL-encoded post ID. Each attempt is logged independently.' },
      { tag: 'fix', scope: 'linkedin', description: 'Connections + DMs returning noop with no explanation: added runId param and full diagnostic logging at every bail point in decideConnectionRequests and decideDMs. Logs now show exactly which guard fails (empty keywords, quota exhausted, no leads, etc.).' },
      { tag: 'feat', scope: 'linkedin', description: 'Separate service classes: LinkedInCommentService, LinkedInConnectionService, LinkedInDmService — each owns its Unipile calls with independent logging and error handling. execute() uses these instead of the monolithic LinkedInService.' },
      { tag: 'feat', scope: 'linkedin', description: 'POST /linkedin/connections/import: pull existing LinkedIn connections from Unipile and upsert them as leads with connectionStatus=connected — required before DM outreach can work. UI button added in Accounts tab.' },
      { tag: 'feat', scope: 'linkedin', description: 'Per-account persona training: Train persona button moved into each AccountCard header. POST /linkedin/persona/train accepts unipileAccountId, deletes old samples then re-inserts fresh ones to avoid stale duplicates.' },
    ],
  },
  {
    version: 'v4.74.0',
    date: '2026-05-16',
    entries: [
      { tag: 'fix', scope: 'linkedin', description: 'Strip leading/trailing quotes from LLM-generated comments, DMs, and connection notes so text never appears with double-quotes on LinkedIn. execute() notifications also no longer wrap comment/DM text in quotes.' },
      { tag: 'feat', scope: 'linkedin', description: 'More human system prompts for comments, DMs, and connection notes: simple words, no corporate speak, no generic openers, explicit instruction to not wrap output in quotes.' },
      { tag: 'feat', scope: 'linkedin', description: 'Persona training: POST /linkedin/persona/train fetches own recent LinkedIn posts via Unipile Voyager proxy and saves them as writing samples (agentKeys=linkedin, polarity=positive) so the AI learns the account owner\'s tone. GET /linkedin/persona/samples lists stored samples. UI button on Accounts tab triggers training and shows result count.' },
    ],
  },
  {
    version: 'v4.73.6',
    date: '2026-05-16',
    entries: [
      { tag: 'fix', scope: 'canva', description: 'Template preview images now stored in Cloudflare R2 instead of as base64 in the database. When R2 is configured, uploads always go to R2; local base64 fallback only applies when R2 is not set up. /preview endpoint redirects to R2 URL. generateEdit() fetches image from R2 URL when needed.' },
    ],
  },
  {
    version: 'v4.73.5',
    date: '2026-05-16',
    entries: [
      { tag: 'feat', scope: 'linkedin', description: 'Action-isolated runs: each trigger (comments, connections, DMs) runs as a separate job with actionType in the payload. decide() only runs the requested decider. Feed is only fetched for comment runs.' },
      { tag: 'feat', scope: 'linkedin', description: 'Staggered BullMQ cron schedule: comments at 09:23, connections at 11:41, DMs at 14:17 daily — registered via LinkedInCronProcessor on startup, old repeatable jobs cleared on each restart to apply schedule changes.' },
      { tag: 'feat', scope: 'linkedin', description: 'Manual action buttons added to Accounts tab: Run Comments, Run Connections, Run DMs — each fires a MANUAL run with the specific actionType and navigates to the run detail page.' },
    ],
  },
  {
    version: 'v4.73.4',
    date: '2026-05-16',
    entries: [
      { tag: 'fix', scope: 'linkedin', description: 'Removed GET /api/v1/posts probe (endpoint does not exist in Unipile — publish-only). Feed always uses Voyager proxy. Removed encodeURIComponent from postComment so URN path is not mangled. Schedule changed from every 4h to daily at 09:00. Max 3 connection requests, comments, and DMs per run enforced in config and decideConnectionRequests.' },
      { tag: 'fix', scope: 'telegram', description: 'editMessageReplyMarkup "message is not modified" 400 error no longer bubbles as Action failed. Wrapped in safeEditMarkup/safeApiEditMarkup helpers that silently swallow the not-modified error and rethrow anything else.' },
    ],
  },
  {
    version: 'v4.73.3',
    date: '2026-05-16',
    entries: [
      { tag: 'fix', scope: 'linkedin', description: 'Daily limits now strictly enforced: linkedinPosts insert now stores accountId so quota counter is no longer always 0. Comment quota counts only status=posted rows using postedAt. Connection quota counts only sentAt (actually sent) not createdAt (proposed). DM quota unchanged (already correct).' },
      { tag: 'fix', scope: 'linkedin', description: 'Daily reports now show actual executed actions: connections use sentAt, comments use postedAt+status=posted. Reports tab auto-refreshes every 60 seconds. Accounts tab also loads today\'s stats and shows a live progress bar (used/cap) under each limit input, turning red when the daily cap is reached.' },
    ],
  },
  {
    version: 'v4.73.2',
    date: '2026-05-16',
    entries: [
      { tag: 'fix', scope: 'linkedin', description: 'postComment reverted to Unipile native API (POST /posts/{id}/comments) — requires native post IDs from GET /posts, not LinkedIn URNs from Voyager proxy. Debug endpoint GET /linkedin/debug/posts added to inspect Unipile raw post response and verify ID compatibility.' },
      { tag: 'chore', scope: 'docs', description: 'linkedin-agent.md created: full reference for Unipile endpoints, post ID compatibility rules, comment flow, dedup logic, rate limiting, debug endpoints, and troubleshooting table. Added to CLAUDE.md doc index.' },
    ],
  },
  {
    version: 'v4.73.1',
    date: '2026-05-16',
    entries: [
      { tag: 'feat', scope: 'runs', description: 'Run detail page now shows Retry button (failed runs) and Run Again button (all runs) — triggers a fresh MANUAL run for the same agent and navigates to the new run detail page.' },
      { tag: 'feat', scope: 'linkedin', description: 'LinkedIn agent: 35 prebuilt niche templates added across SaaS Founders, MVP Dev, Web Dev Agencies, Freelance Dev, and Digital Agencies categories with a searchable template browser in the Niches tab.' },
    ],
  },
  {
    version: 'v4.73.0',
    date: '2026-05-16',
    entries: [
      { tag: 'fix', scope: 'canva', description: 'Carousel template upload switched from base64 JSON to multipart form data — fixes infinite Uploading state in production caused by Traefik buffering large JSON bodies. AbortController timeout (90s) added to prevent silent hangs. Upload errors now surface to the user instead of being silently ignored. Multipart file limit raised to 20 slides.' },
    ],
  },
  {
    version: 'v4.72.2',
    date: '2026-05-15',
    entries: [
      { tag: 'fix', scope: 'support', description: 'Generate New Reply on replied tickets appends a separate new draft card below the sent reply — original sent text stays visible and read-only. New draft has Edit, Regenerate, and Send Reply buttons. Purchase code card expanded: shows buyer username, support status with days remaining, license key, and verification date sourced from the purchase_code_verified event payload.' },
    ],
  },
  {
    version: 'v4.72.1',
    date: '2026-05-15',
    entries: [
      { tag: 'fix', scope: 'support', description: 'Replied tickets no longer show Edit or Regenerate buttons. Only a Generate New Reply button is shown. Edit/Regenerate remain available only for unsent drafts. Unsent draft edit mode now uses TipTap rich text editor instead of plain textarea.' },
    ],
  },
  {
    version: 'v4.72.0',
    date: '2026-05-15',
    entries: [
      { tag: 'fix', scope: 'support', description: 'Draft editor blank on click: removed early null-return before TipTap initializes; toolbar always renders with Loading placeholder. Fixed broken useCallback/useEffect pattern replaced by initialised ref. Removed extendMarkToWordIfUnselected (TipTap v3-only). Image paste upload and all toolbar actions now work correctly.' },
    ],
  },
  {
    version: 'v4.71.9',
    date: '2026-05-15',
    entries: [
      { tag: 'fix', scope: 'support', description: 'Draft editor: downgraded TipTap v3→v2 (stable API). Toolbar now visible with correct dark theme contrast. Added image paste-to-upload: pasted images are uploaded to R2 via POST /support/upload-image and inserted as inline images. Added @tiptap/extension-image.' },
    ],
  },
  {
    version: 'v4.71.8',
    date: '2026-05-15',
    entries: [
      { tag: 'feat', scope: 'support', description: 'Draft reply editor upgraded to TipTap rich text: Bold, Italic, Underline, Bullet list, Numbered list, Link, Divider. Added Share Link button (copies direct ticket URL to clipboard).' },
    ],
  },
  {
    version: 'v4.71.7',
    date: '2026-05-15',
    entries: [
      { tag: 'fix', scope: 'support', description: 'Activity Timeline: summary truncated to single line — full text + payload revealed on expand. Events sorted newest-first. Added webhook_received and decide_triggered event types. Added full color-coding for all event types.' },
    ],
  },
  {
    version: 'v4.71.6',
    date: '2026-05-15',
    entries: [
      { tag: 'feat', scope: 'support', description: 'Editable AI draft: Edit button on any generated draft opens an inline textarea. Save Draft persists via PATCH /support/tickets/:id/draft and logs a manual_draft event. Cancel discards without saving.' },
    ],
  },
  {
    version: 'v4.71.5',
    date: '2026-05-15',
    entries: [
      { tag: 'feat', scope: 'support', description: 'Ticket detail page redesigned with two-column layout. CRM Actions (Change Priority, Update Status, Add Internal Note) and Activity Timeline moved into a fixed right sidebar. Each CRM action is now its own card.' },
    ],
  },
  {
    version: 'v4.71.4',
    date: '2026-05-15',
    entries: [
      { tag: 'fix', scope: 'support', description: 'CRM reply endpoint corrected to POST /api/public-v1/support-ticket/agent-reply/{uuid}. agent_id is now required (returns error if not configured). All execute() paths and send-reply API route use crmUuid instead of numeric externalId.' },
    ],
  },
  {
    version: 'v4.71.3',
    date: '2026-05-15',
    entries: [
      { tag: 'fix', scope: 'support', description: 'Root cause fix: CRM replies were silently failing because agent_id was missing from the POST body. postCrmReply now returns ok/error and includes agent_id. execute() only marks ticket as "replied" after confirmed CRM success — on failure the draft is saved, ticket stays open, and Telegram reports the error.' },
      { tag: 'feat', scope: 'support', description: 'Agent ID setting added to support agent Setup tab (Step 1). Required for CRM replies. Shows an amber warning until configured.' },
      { tag: 'fix', scope: 'support', description: 'Migration 0080: ensure support_ticket_events table exists on production (IF NOT EXISTS). Fixes DELETE /support/tickets/:id 500 error on prod.' },
    ],
  },
  {
    version: 'v4.71.2',
    date: '2026-05-15',
    entries: [
      { tag: 'fix', scope: 'linkedin', description: 'Agent Info, LLM, Config JSON, and Manual Trigger moved into a dedicated Config tab instead of appearing at the bottom of every tab.' },
    ],
  },
  {
    version: 'v4.71.1',
    date: '2026-05-15',
    entries: [
      { tag: 'feat', scope: 'linkedin', description: 'Default daily limits: 5 connections, 10 comments, 5 DMs per account. Placeholders now show defaults. Added Reports tab with a 14-day daily activity table per account (connections, comments, DMs).' },
    ],
  },
  {
    version: 'v4.71.0',
    date: '2026-05-15',
    entries: [
      { tag: 'fix', scope: 'linkedin', description: 'Simplify per-account rate limits to per-day only. Removed hourly limit fields from UI and agent logic.' },
    ],
  },
  {
    version: 'v4.70.9',
    date: '2026-05-15',
    entries: [
      { tag: 'feat', scope: 'linkedin', description: 'Per-account daily and hourly rate limits for connections, feed comments, and DM outreach. Edit limits inline per account; agent enforces them at runtime to prevent spam. Migration 0079 adds the 6 limit columns.' },
    ],
  },
  {
    version: 'v4.70.8',
    date: '2026-05-15',
    entries: [
      { tag: 'feat', scope: 'linkedin', description: 'Per-account action toggles in the Accounts tab. Each LinkedIn account now shows inline toggles for Connection requests, Feed comments, and DM outreach. Agent skips disabled actions per account. Migration 0078 adds enable_connections, enable_comments, enable_dms columns.' },
    ],
  },
  {
    version: 'v4.70.7',
    date: '2026-05-15',
    entries: [
      { tag: 'feat', scope: 'linkedin', description: 'Optimize default config for agency owners and freelancers targeting Taskip.net — updated target topics, comment tone, and ICP threshold. Added multi-account strategy docs (Account A: agency owners, Account B: freelancers, Account C: other segments).' },
    ],
  },
  {
    version: 'v4.70.6',
    date: '2026-05-15',
    entries: [
      { tag: 'feat', scope: 'linkedin', description: 'Docs tab on LinkedIn agent page — full setup guide (Unipile credentials, account sync, niche creation, config options, test run) plus tab guide, limits, and tips. Replaces the old Setup tab.' },
    ],
  },
  {
    version: 'v4.70.5',
    date: '2026-05-15',
    entries: [
      { tag: 'fix', scope: 'linkedin', description: 'Sync from Unipile button now shows feedback: error message on failure, amber warning with link to app.unipile.com when 0 accounts found, green confirmation when accounts are synced.' },
    ],
  },
  {
    version: 'v4.70.4',
    date: '2026-05-15',
    entries: [
      { tag: 'fix', scope: 'integrations', description: 'Unipile test connection now calls /accounts instead of /api/v1/me (which does not exist). Returns count of linked accounts on success.' },
    ],
  },
  {
    version: 'v4.70.3',
    date: '2026-05-15',
    entries: [
      { tag: 'feat', scope: 'integrations', description: 'Unipile tab in Integrations page. Configure API Key and DSN with a Test Connection button and setup guide. Fields use their own settings group (unipile) separate from LinkedIn.' },
    ],
  },
  {
    version: 'v4.70.1',
    date: '2026-05-15',
    entries: [
      { tag: 'feat', scope: 'livechat', description: 'License verification in the visitor details sidebar. Enter a purchase code (UUID or XGENIOUS-XXXX format) and click Verify to check it against the license server. Shows action badge, buyer username, support status (active/expired + days remaining), and license key.' },
    ],
  },
  {
    version: 'v4.70.0',
    date: '2026-05-15',
    entries: [
      { tag: 'feat', scope: 'linkedin', description: 'LinkedIn AI Agent — full multi-account build. Connect multiple LinkedIn accounts via Unipile. Niche-based connection requests (5/day, ICP-scored by LLM). Feed comment drafting with dedup. DM outreach pipeline for connected leads. Frontend management UI with 6 tabs: Accounts, Niches, Leads, Connections, Posts, Setup.' },
      { tag: 'feat', scope: 'linkedin', description: 'LinkedIn schema: new tables linkedin_accounts, linkedin_niches, linkedin_connection_requests. linkedin_leads and linkedin_posts extended with account/niche FK, ICP score fields, connection status.' },
      { tag: 'fix', scope: 'support', description: 'post_reply and request_purchase_code actions no longer require Telegram approval — auto-execute immediately.' },
      { tag: 'fix', scope: 'support', description: 'CRM webhook echo detection: if ticket status is already replied and repliedAt is within 90 seconds, skip reopening to prevent agent-reply → webhook → re-trigger loop.' },
      { tag: 'fix', scope: 'taskip-internal', description: 'list_sent_emails tool now accepts optional recipient filter — queries by email address to avoid false no-emails-sent reports.' },
      { tag: 'chore', scope: 'canva', description: 'Renamed Canva agent display name to Social Media Banner Designer.' },
    ],
  },
  {
    version: 'v4.69.2',
    date: '2026-05-15',
    entries: [
      { tag: 'feat', scope: 'agents', description: 'Agent name is now editable inline on the Agents list page. Hover a card to reveal the pencil icon next to the name; click it to rename in-place without leaving the page.' },
    ],
  },
  {
    version: 'v4.69.1',
    date: '2026-05-15',
    entries: [
      { tag: 'feat', scope: 'agents', description: 'Agent name is now editable inline from the agent detail page header. Click the name to open an input field; press Enter or the check button to save, Escape or X to cancel. Saves via PATCH /agents/:key and re-fetches the agent.' },
    ],
  },
  {
    version: 'v4.69.0',
    date: '2026-05-15',
    entries: [
      { tag: 'feat', scope: 'support', description: 'Support Ticket Detail page: Generate Draft and Send Reply are now two visually distinct steps. Generate Draft saves a preview (labeled "Draft saved — not sent yet"); Send Reply lives in a separate green panel describing exactly who will receive the email. Ticket status is never changed by generating a draft.' },
      { tag: 'feat', scope: 'support', description: 'Support Tickets list page: added "Draft Ready" stat card (4th column) and per-row amber "draft ready" badge for tickets that have a saved draft but have not been replied to yet.' },
      { tag: 'fix', scope: 'support', description: 'Replied ticket detail view now shows the reply timestamp and the sent draft in a green confirmation panel instead of the standard editable card.' },
    ],
  },
  {
    version: 'v4.68.2',
    date: '2026-05-15',
    entries: [
      { tag: 'chore', scope: 'canva', description: 'Renamed agent from "Social Media Banner Design Agent" to "Social Media Banner Designer" in agent class, seed file, and DB migration.' },
      { tag: 'fix', scope: 'canva', description: 'AI-generated carousel slides now appear in the Post Renders tab. Added recordDnaRender() to DesignStudioService which inserts a post_renders row (formatId: dna-carousel) after every DNA-path generation run. All three slide-generation paths in the canva agent call this. Post Renders tab shows "AI Carousel (training sample)" as the format label and hides PPTX/CSV/Text export links for DNA renders.' },
    ],
  },
  {
    version: 'v4.68.1',
    date: '2026-05-15',
    entries: [
      { tag: 'fix', scope: 'canva', description: 'Slide lightbox no longer fills the full screen height. Image is now constrained to calc(100vh - 160px), leaving an 80px gap on top and bottom so the toolbar and hint text are always visible.' },
      { tag: 'chore', description: 'Added docs/16-design-studio.md covering the full Design Studio system: DNA extraction, DesignDNA schema, asset collection form, gpt-image-1 edit pipeline, chat state machine markers, progressive slide reveal, and activity log events.' },
    ],
  },
  {
    version: 'v4.68.0',
    date: '2026-05-15',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'Uploaded avatar photo is now passed as a second input image to gpt-image-1 images.edit() API, so the model places the exact uploaded face into the circular profile photo zone instead of generating a generic one.' },
      { tag: 'feat', scope: 'canva', description: 'Progressive slide reveal during generation: each slide appears in the activity bubble as soon as it is ready (from post_ai_slide_end log events with slide_url). Remaining slots show animated skeletons.' },
      { tag: 'fix', scope: 'canva', description: 'Slide thumbnail hover icon (Image icon) was appearing on all thumbnails simultaneously when hovering the message bubble. Fixed by scoping SlideThumb to group/thumb + group-hover/thumb: named group, same pattern as the style picker fix.' },
    ],
  },
  {
    version: 'v4.67.3',
    date: '2026-05-15',
    entries: [
      { tag: 'fix', scope: 'canva', description: 'Fixed 2M-token OpenAI error: the agent\'s [extra-params-gather:] regex was non-greedy and returned null on deeply nested JSON, causing the code to fall through to the general LLM handler which included the full [asset-params-all:] query (with base64 photo) in the prompt. Replaced both regexes with a balanced-brace extractor (extractNestedJson) so the bulk form submission is correctly parsed and routed.' },
      { tag: 'fix', scope: 'canva', description: 'User message bubble no longer shows raw [asset-params-all:{...}] JSON after form submission. The display content is now a friendly summary (e.g. "Sharifur Rahman · @sharifur · taskip.net · [photo uploaded]") stored both in local state and persisted to the backend.' },
      { tag: 'fix', scope: 'canva', description: 'History context passed to the LLM now strips base64 data URLs and sanitizes [asset-params-all:] markers to prevent future token overflows.' },
    ],
  },
  {
    version: 'v4.67.2',
    date: '2026-05-15',
    entries: [
      { tag: 'fix', scope: 'canva', description: 'AssetParamsCard form was not rendering: the regex /\\{[\\s\\S]*?\\}/ is non-greedy and stops at the first closing brace inside nested JSON, causing JSON.parse to fail and the form to silently return null. Replaced with a balanced-brace extractor (extractNestedJson) that walks the string counting { and } to find the correct closing boundary.' },
    ],
  },
  {
    version: 'v4.67.1',
    date: '2026-05-15',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'Asset collection for training-sample carousels now uses a proper inline form (AssetParamsCard) instead of sequential one-at-a-time chat prompts. Text params render as text inputs, image params render with an upload button + URL fallback. Submitting sends all values at once via [asset-params-all:] which the backend processes in a single pass to generate slides.' },
      { tag: 'fix', scope: 'canva', description: 'JSON state marker ([extra-params-gather:...]) no longer leaks into the chat bubble. Non-last messages strip markers and show only the intro text.' },
    ],
  },
  {
    version: 'v4.67.0',
    date: '2026-05-15',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'Training-sample carousel generation now uses images.edit() API instead of generate(), passing the original sample image as the base so DALL-E preserves exact background, colors, and decorative elements.' },
      { tag: 'feat', scope: 'canva', description: 'DNA extraction now captures headlineWordCount, hasAvatarZone, and social param fields (username, social_handle, website_url). When a template has an avatar zone the agent asks the user to upload a profile photo; the upload button appears automatically in the chat input.' },
      { tag: 'fix', scope: 'canva', description: 'Body text (cs.body) removed from DALL-E generation prompts — templates with headline-only layouts no longer receive body paragraph text that breaks the visual layout.' },
      { tag: 'fix', scope: 'canva', description: 'Headline word count is now constrained to match the training sample (headlineWordCount from DNA), so generated text visually fits the template.' },
      { tag: 'fix', scope: 'canva', description: 'BullMQ agent-run processor lockDuration increased to 300s to prevent stall-retries during long slide generation runs (7 slides x ~18s each was triggering 30s stall timeout).' },
    ],
  },
  {
    version: 'v4.66.7',
    date: '2026-05-15',
    entries: [
      { tag: 'fix', scope: 'canva', description: 'Style picker hover border now highlights only the hovered card. Changed button group class to named group/card and updated group-hover: to group-hover/card: so the parent message bubble group does not bleed the hover state to all cards simultaneously.' },
    ],
  },
  {
    version: 'v4.66.6',
    date: '2026-05-15',
    entries: [
      { tag: 'fix', scope: 'canva', description: 'Activity panel now shows per-slide AI generation progress in real-time. The canva agent injects AgentLogService and writes post_ai_slide_start/end events for each slide during design-studio DALL-E generation, so the panel updates as each slide completes.' },
      { tag: 'fix', scope: 'canva', description: 'Activity panel polling interval reduced to 800ms (from 1500ms) for faster real-time feel.' },
      { tag: 'fix', scope: 'canva', description: 'parseLogsToTimeline now handles post_ai_slide_start, post_ai_slide_end, and post_ai_slide_fallback events from both the canva agent and post-renderer.' },
    ],
  },
  {
    version: 'v4.66.5',
    date: '2026-05-14',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'Layout picker response now shows the selected template thumbnail in the user message bubble instead of a bare number. The correct template preview image (with stacked-card depth effect for carousel sets) is displayed based on the preceding style picker context.' },
    ],
  },
  {
    version: 'v4.66.4',
    date: '2026-05-14',
    entries: [
      { tag: 'fix', scope: 'support', description: 'Webhook trigger no longer scans all open tickets. buildContext() now uses normalizeCrmPayload() (same as ingestWebhook) to extract the CRM ticket ID from nested payload formats. Previously the flat-only payload?.ticket?.id lookup always returned null, causing fallthrough to the CRON batch path which processed every open ticket including unrelated ones. Now only the specific ticket from the webhook is processed, and if it is not open the run exits immediately.' },
    ],
  },
  {
    version: 'v4.66.3',
    date: '2026-05-14',
    entries: [
      { tag: 'fix', scope: 'canva', description: 'Activity panel now shows "Executing" and "Executed" log entries, plus a "Run completed" entry at the end of each run. Previously these messages were silently dropped and the panel appeared empty.' },
      { tag: 'fix', scope: 'canva', description: 'Activity panel no longer freezes on an empty state when a fast run finishes before the first poll. Polling now continues until at least one log entry is received.' },
      { tag: 'fix', scope: 'canva', description: 'Generated slides now leave a 50px safe-zone margin on all edges, preventing text from rendering flush against the image border.' },
    ],
  },
  {
    version: 'v4.66.2',
    date: '2026-05-14',
    entries: [
      { tag: 'fix', scope: 'canva', description: 'Slide generation no longer produces unrelated content from the training template. Root cause: gpt-image-1 was given style description first, causing it to regenerate the original training slide content. Fixed by restructuring the prompt — user headline/body leads as the primary directive, visual style is explicitly secondary. All 5 generateAndSave call sites benefit from the fix.' },
    ],
  },
  {
    version: 'v4.66.1',
    date: '2026-05-14',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'Template picker tiles are now portrait stacked-card UI (90×118px) with a depth-shadow effect for carousel sets, so users can visually compare layouts before selecting.' },
      { tag: 'feat', scope: 'canva', description: 'Content plan confirmation now shows "Looks good" and "Revise it" buttons instead of plain text, with immediate skeleton grid feedback while slides generate.' },
      { tag: 'feat', scope: 'canva', description: 'Slide render grid now includes a "Download all" button that packages all carousel slides into a ZIP file.' },
      { tag: 'feat', scope: 'canva', description: 'While slides are generating, a skeleton grid with animated placeholders replaces the generic typing dots for better generation UX.' },
    ],
  },
  {
    version: 'v4.66.0',
    date: '2026-05-14',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'Layout-first carousel flow: agent now shows the template picker before generating content, so content is tailored to the exact slide count of the chosen template. Template tiles show field hints (e.g. headline, description, author_name) so the user knows what each layout expects.' },
      { tag: 'feat', scope: 'canva', description: 'After confirming content from a layout-first flow, the agent skips the second template picker and auto-generates slides immediately (or asks for extra metadata params if the template requires them).' },
    ],
  },
  {
    version: 'v4.65.9',
    date: '2026-05-14',
    entries: [
      { tag: 'fix', scope: 'support', description: 'Agent no longer waits for Telegram approval before sending post_reply and request_purchase_code actions — both are now auto-executed.' },
      { tag: 'fix', scope: 'support', description: 'Fixed webhook echo loop: when CRM fires support.ticket.replied after our own reply, the ticket is no longer incorrectly reopened. Detects agent-reply echoes via repliedAt timestamp (within 90s) to prevent re-triggering the purchase code gate.' },
    ],
  },
  {
    version: 'v4.65.8',
    date: '2026-05-14',
    entries: [
      { tag: 'fix', scope: 'taskip-internal', description: 'list_sent_emails tool now accepts a recipient parameter for filtering by email address. Agent system prompt updated to always query by recipient when a specific customer email is mentioned — fixes false "no emails sent" reports.' },
    ],
  },
  {
    version: 'v4.65.7',
    date: '2026-05-14',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'When content is already confirmed (via content plan), picking a carousel template now auto-generates all slides immediately — no more slide-by-slide questioning. If the template has extra metadata params (Twitter handle, author name, etc.) the agent asks for those first, then generates all slides.' },
      { tag: 'fix', scope: 'canva', description: 'Added [extra-params-gather:] to the list of stripped chat markers so raw JSON state never appears in the chat bubble.' },
    ],
  },
  {
    version: 'v4.65.6',
    date: '2026-05-14',
    entries: [
      { tag: 'fix', scope: 'canva', description: 'Style picker now groups carousel slides by set — shows one representative tile per set (cover slide thumbnail, set name label) instead of every individual slide. 3 uploaded carousels now show 3 choices, not 19+.' },
    ],
  },
  {
    version: 'v4.65.5',
    date: '2026-05-14',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'Carousel set cards now have a delete button (shown on hover) that removes all slides in the set at once with a confirmation prompt.' },
    ],
  },
  {
    version: 'v4.65.4',
    date: '2026-05-14',
    entries: [
      { tag: 'fix', scope: 'canva', description: 'Carousel set cards: removed name label below stack, fixed stack depth rendering so back cards correctly appear behind the front card using absolute z-index layers.' },
    ],
  },
  {
    version: 'v4.65.3',
    date: '2026-05-14',
    entries: [
      { tag: 'fix', scope: 'canva', description: 'Hide [carousel-gather:] and [param-gather:] state markers from chat bubbles — raw JSON state blobs are now stripped before rendering, matching how [styles:] and [pending:] are already hidden.' },
      { tag: 'fix', scope: 'canva', description: 'Carousel sets now correctly split into separate groups when multiple sets have the same filename prefix — sessions > 60s apart are treated as distinct sets using createdAt timestamps.' },
      { tag: 'feat', scope: 'canva', description: 'Carousel set thumbnails are now compact 60x60 stacked cards with a slide-count badge. Clicking opens a full-screen gallery with dot indicators, prev/next navigation, thumbnail strip, and per-slide delete.' },
    ],
  },
  {
    version: 'v4.65.2',
    date: '2026-05-14',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'Carousel sets in Templates tab now display as a single stacked card (cover image with depth effect and slide count badge). Clicking opens a full-screen gallery with prev/next navigation, dot indicators, thumbnail strip at the bottom, and per-slide delete.' },
    ],
  },
  {
    version: 'v4.65.1',
    date: '2026-05-14',
    entries: [
      { tag: 'fix', scope: 'canva', description: 'Carousel uploads now always create distinct sets: each upload appends a short unique ID to the set name so uploading files with the same filename across sessions no longer merges them into one carousel group.' },
      { tag: 'chore', scope: 'canva', description: 'Renamed "Design Samples" tab to "Templates" throughout the Canva agent page.' },
    ],
  },
  {
    version: 'v4.65.0',
    date: '2026-05-14',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'Delete button on Post Renders tab: each render card now has a Delete button that sends DELETE /posts/renders/:id, removes the DB row and local PNG files on disk, and removes the card from the list without a page reload.' },
    ],
  },
  {
    version: 'v4.64.0',
    date: '2026-05-14',
    entries: [
      { tag: 'feat', scope: 'support', description: 'Send Reply button on ticket detail page: when a draft is present and the ticket is not yet replied, a green "Send Reply" button appears next to "Regenerate Draft". Clicking it confirms with the user, then posts the draft directly to the CRM via the public API and marks the ticket as replied. A reply_sent event is recorded in the ticket history.' },
    ],
  },
  {
    version: 'v4.63.0',
    date: '2026-05-14',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'Carousel one-by-one: when a carousel-set template is selected in the style picker, the agent enters carousel-gather mode — it asks content questions for each slide individually, generates each slide via gpt-image-1 as answers arrive, shows the rendered image inline with the next slide question below it, and displays all slide images together when the set is complete.' },
      { tag: 'feat', scope: 'canva', description: 'SlideGrid messages now support a nextSlidePrompt field: when present the prompt text is rendered below the image grid, allowing combined image+question responses in carousel mode.' },
    ],
  },
  {
    version: 'v4.62.0',
    date: '2026-05-14',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'Design Samples tab completely rewritten: uploads images to /design-studio/import-batch (DNA extraction via gpt-image-1), polls job status every 2.5s, and displays extracted templates as clickable cards in two sections — Individual Images and Carousel Sets (grouped by name prefix). Each card shows a preview thumbnail, parameter count badge, and a detail modal with all extracted parameters.' },
      { tag: 'feat', scope: 'canva', description: 'Chat flow step 2 now shows DNA templates as the style picker instead of training samples. Templates load from DesignStudioService; thumbnails served from /design-studio/templates/:id/preview.' },
      { tag: 'feat', scope: 'canva', description: 'New parameter gathering step (step 3): after picking a DNA template the agent asks for each template parameter one by one using [param-gather:] state marker. When all parameters are collected the agent calls dna_generate to produce the image.' },
      { tag: 'feat', scope: 'canva', description: 'dna_generate action: calls DesignStudioService.generateAndSave() which runs gpt-image-1 with the extracted stylePrompt, saves the PNG to ~/Designs/AI-Agent/DnaRenders/, and returns the image via SlideGrid in the chat.' },
      { tag: 'feat', scope: 'design-studio', description: 'Added GET /design-studio/templates/:id/preview endpoint serving the stored base64 previewData as an image with 24h cache header. Added GET /design-studio/renders/:id endpoint serving saved PNG renders.' },
      { tag: 'chore', scope: 'design-studio', description: 'DesignStudioModule now exports DesignStudioService so CanvaModule can inject it. CanvaModule imports DesignStudioModule.' },
    ],
  },
  {
    version: 'v4.61.0',
    date: '2026-05-14',
    entries: [
      { tag: 'feat', scope: 'design-studio', description: 'Multi-image upload with background processing: drop multiple design images at once — each is queued as a BullMQ job, analyzed by Claude Vision in the background, and saved as a template. Progress is shown in real time via WebSocket and persists across page reloads (jobs stored in design_studio_jobs table, migration 0075).' },
      { tag: 'feat', scope: 'design-studio', description: 'Analysis queue panel shows per-job status (Queued, Analyzing, Extracted, Failed) with thumbnail preview, live spinner, and color-coded border. WebSocket subscription to design-studio room pushes status updates instantly; 3-second polling fallback keeps UI in sync during reconnect gaps.' },
      { tag: 'feat', scope: 'design-studio', description: 'Drag-and-drop upload zone now accepts multiple files simultaneously. File input also supports multiple selection.' },
      { tag: 'fix', scope: 'design-studio', description: 'Import endpoint replaced with batch endpoint (POST /design-studio/import-batch); single legacy import endpoint removed. Templates list updates automatically when any job completes.' },
    ],
  },
  {
    version: 'v4.60.2',
    date: '2026-05-14',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'Slide thumbnail lightbox: clicking a slide in the Post Renders tab now opens a full-screen lightbox with prev/next navigation, copy-to-clipboard, and download. Keyboard shortcuts: Esc to close, arrow keys to navigate.' },
    ],
  },
  {
    version: 'v4.60.1',
    date: '2026-05-14',
    entries: [
      { tag: 'fix', scope: 'support', description: 'Agent reply webhooks no longer trigger actions, approvals, or Telegram messages. Added detection for CRM format where data.ticket.user (agent) differs from data.ticket.created_by (customer) — covers the actual webhook structure sent by the CRM alongside the existing replied_by.type checks.' },
    ],
  },
  {
    version: 'v4.60.0',
    date: '2026-05-14',
    entries: [
      { tag: 'feat', scope: 'design-studio', description: 'New experimental Design Studio page: upload any design image, AI (Claude Vision) extracts the layout as a structured spec with parameter schema, saved as a reusable template. Generate variations by typing a chat prompt — AI fills the parameter values and Satori renders the new image. Original vs generated shown side by side for comparison.' },
      { tag: 'feat', scope: 'design-studio', description: 'New design-studio backend module with three endpoints: POST /design-studio/templates/import (image upload + AI extraction), POST /design-studio/templates/:id/generate (prompt → PNG), GET/DELETE /design-studio/templates. Design specs stored in new design_studio_templates table (migration 0074).' },
    ],
  },
  {
    version: 'v4.59.0',
    date: '2026-05-14',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'AI full-slide image generation: when a training sample is selected (sampleId set), each carousel slide is now generated as a complete image by OpenAI/Stability AI instead of the Satori code renderer. The style prompt (colors, typography, shapes, mood) is derived from the selected sample\'s DesignDNA and cached in the DNA JSON at analysis time — renders read the stored prompt_base rather than re-deriving it on every call.' },
      { tag: 'feat', scope: 'canva', description: 'New slide-prompt-builder module: buildStylePromptBase(dna) converts DesignDNA fields into a natural-language DALL-E style description; buildSlideImagePrompt() combines it with slide content (headline, body, list items, CTA) at render time.' },
      { tag: 'feat', scope: 'canva', description: 'New openai-stability image provider option: AI slide generation tries OpenAI first, then Stability AI as fallback. Satori is only used if both providers fail or no API keys are configured.' },
      { tag: 'feat', scope: 'canva', description: 'Design sample analysis now stores prompt_base in DNA JSON at all 6 analysis/reanalysis sites — new uploads and re-analyzed samples automatically cache their DALL-E style prompt.' },
      { tag: 'fix', scope: 'canva', description: 'Increased DALL-E prompt character limit from 800 to 4000 — detailed design prompts were being silently truncated, removing all color/shape/typography detail.' },
    ],
  },
  {
    version: 'v4.58.0',
    date: '2026-05-14',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'Forced 2-step state machine: step 1 (content confirmation) and step 2 (style selection) are now detected from the last agent message in history — not delegated to the LLM classifier. If the last agent message contains [styles:...], the next user message is always treated as a style pick. If it contains [pending:...] (no styles), it is always treated as content confirmation or revision. LLM misclassification can no longer bypass either step.' },
      { tag: 'feat', scope: 'canva', description: 'Removed the 3-question clarifying step: when a design request is detected, the agent immediately generates a content draft (no brand/tone/format questions first). This eliminates the main source of "questions-answered" messages being misclassified as content confirmations.' },
      { tag: 'feat', scope: 'canva', description: 'Style selection now reads the sample list directly from the [styles:...] payload in the last agent message — not from a fresh listSampleMeta call. The picked sample ID is resolved from the embedded samples array, guaranteeing the correct sample is always used.' },
      { tag: 'fix', scope: 'canva', description: 'Simplified LLM classifier to 2 intents only (design-generate | general-chat). Removed questions-answered, content-confirmed, and style-selected from the classifier prompt — these are now handled by the history state machine.' },
    ],
  },
  {
    version: 'v4.57.2',
    date: '2026-05-14',
    entries: [
      { tag: 'fix', scope: 'render', description: 'bg.replace is not a function crash: the LLM could return a non-string value (array, object) for bgColor in the visual spec JSON. Added typeof string guards in resolveVisualBackground, resolveVisualBackgroundStyle, and resolveTextColor so malformed LLM output is safely discarded before .replace() is called.' },
      { tag: 'fix', scope: 'render', description: 'Visual spec mapping now checks typeof bgColor and accentColor before using LLM values — prevents non-string bgColor from propagating into layout rendering.' },
    ],
  },
  {
    version: 'v4.57.1',
    date: '2026-05-14',
    entries: [
      { tag: 'fix', scope: 'canva', description: 'Style picker no longer shows raw }] artifacts — lazy regex (?:[\\s\\S]+?) was stopping at the first }] inside the samples JSON (end of first sample object + array close), leaving the tail unparsed. Changed to [^\\n]+ (greedy, no newlines) so the match correctly spans the full compact single-line JSON.' },
      { tag: 'fix', scope: 'canva', description: 'Strip regex for [styles:...] and [pending:...] tags also changed from lazy [\\s\\S]*? to [^\\n]* so both tags are fully removed from the rendered message text, eliminating the }] ghost text in the chat bubble.' },
    ],
  },
  {
    version: 'v4.57.0',
    date: '2026-05-14',
    entries: [
      { tag: 'feat', scope: 'render', description: 'Structural layout replication: two new Satori layouts added — cover-hero (vivid full-bleed background, giant bold headline, thin separator line, body text, CTA pill footer) and numbered-list-content (accent underline below headline, numbered items with colored box backgrounds). These mirror the visual structure of the uploaded training samples.' },
      { tag: 'feat', scope: 'render', description: 'Sample-pinned layout override: when a specific training sample is selected (sampleId), cover slides automatically use cover-hero layout and content/list slides use numbered-list-content layout — structurally matching the chosen sample instead of picking a generic layout.' },
      { tag: 'feat', scope: 'render', description: 'Exact text color replication: ThemeContract now reads headline_text_hex and body_text_hex from the selected sample\'s color_usage field, so text renders in the same exact colors as the training sample instead of auto-computed contrast colors.' },
      { tag: 'fix', scope: 'render', description: 'Visual spec color anchor: bgColor fallback now prefers color_usage.background_hex from per-slide DNA before primary_color, ensuring the LLM-generated background color is grounded in the most accurate sample data.' },
    ],
  },
  {
    version: 'v4.56.0',
    date: '2026-05-14',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'Strict 4-step carousel flow: (1) ask brand/tone/format questions, (2) generate a slide-by-slide content draft and ask user to confirm, (3) show training sample thumbnail picker, (4) render with exact selected layout plus confirmed content. Steps are now enforced in order — the LLM cannot skip to style picker before the user approves the content plan.' },
      { tag: 'feat', scope: 'canva', description: 'Content draft generation: after answering clarifying questions, the agent calls the LLM to produce a per-slide content plan (headline + body for each slide) and displays it as a numbered list. User approves ("Looks good!") or requests revision before any render is triggered. Slide content is embedded in [pending:{...}] and passed as exact content instructions to the render pipeline.' },
      { tag: 'feat', scope: 'canva', description: 'Exact content passthrough to render: approved slide headlines and bodies are prefixed to the render intent ("Use EXACTLY these slide headlines...") so the content-fill LLM does not invent new copy — it uses what the user confirmed.' },
      { tag: 'fix', scope: 'canva', description: 'Pending JSON extraction now uses lastIndexOf to find the most recent [pending:{...}] tag in history, avoiding greedy regex cross-match between content draft pending and style picker pending when both are in the conversation history.' },
      { tag: 'fix', scope: 'canva', description: 'QuickReplyCard intro now renders each line as a separate paragraph so multi-line content plans (slide 1, slide 2, ...) display with correct line breaks instead of collapsed into a single paragraph.' },
    ],
  },
  {
    version: 'v4.55.1',
    date: '2026-05-14',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'Improved chat pill questions: Visual style now offers 5 options (Bold & Punchy / Clean & Minimal / Warm & Professional / Dark & Dramatic / Bright & Colorful). Content type now shows human-readable format labels (Tips 5 slides / How-To Guide / Listicle / Stat Card / Quote Card) that map directly to format IDs.' },
      { tag: 'feat', scope: 'canva', description: 'Richer visual tone instructions: each tone now injects specific design directives into the render intent — headline word count, contrast level, decoration density, background type, and shape style — giving the visual spec LLM much more precise guidance.' },
      { tag: 'feat', scope: 'canva', description: 'Classification prompt updated: explicit format ID and visual tone mappings added so the LLM reliably extracts formatId and visualTone from both pill submissions and natural language prompts.' },
    ],
  },
  {
    version: 'v4.55.0',
    date: '2026-05-14',
    entries: [
      { tag: 'fix', scope: 'render', description: 'Satori inline-flex error: word highlight spans used display:inline-flex which satori does not support. Changed to display:flex — fixes all renders that include word highlights.' },
      { tag: 'fix', scope: 'canva', description: 'Removed style reference (Q4) from Branch A clarifying questions — it caused the QuickReplyCard to submit garbage text (the instruction text as if it were an option) which looped Branch B indefinitely. Style picker is now a separate step after questions.' },
      { tag: 'feat', scope: 'canva', description: 'Full-prompt shortcut: when the user provides format + topic in their initial message (e.g. "Generate a linkedin-tips-carousel about X"), Branch A now skips the 3-question step and goes directly to the style reference thumbnail picker.' },
      { tag: 'fix', scope: 'canva', description: 'Strip [pending:{...}] and [styles:{...}] internal tags from all agent message fallback rendering — these never show as raw JSON text in the chat anymore.' },
    ],
  },
  {
    version: 'v4.54.1',
    date: '2026-05-14',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'Style picker thumbnails: the style reference picker now shows 72x72 cover image thumbnails for each training sample instead of text pills. Each sample\'s first slide is used as the thumbnail (from carousel_slide_urls in its DNA). Clicking a thumbnail immediately fires the render pinned to that sample\'s DNA — no submit button needed. A "Random" tile with a ? icon is always shown first.' },
    ],
  },
  {
    version: 'v4.54.0',
    date: '2026-05-14',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'Pill quick-reply UI in chat: when the Canva agent asks clarifying questions (brand, tone, format), the message now renders as interactive pill buttons instead of plain text. Each question gets its own row of selectable pills; clicking a pill toggles it. A Generate button assembles the selections and sends them. The style reference picker also renders as pills. Pills only appear on the last (unanswered) agent message — older messages show as plain text.' },
      { tag: 'feat', scope: 'canva', description: 'Brand is now optional: when the user skips the brand question (or selects nothing), the render uses the "default" brand. Removed the fallback to config.brands[0] which was causing brand=taskip with no matching samples.' },
    ],
  },
  {
    version: 'v4.53.1',
    date: '2026-05-14',
    entries: [
      { tag: 'fix', scope: 'render', description: 'Training sample brand fallback: all design sample queries now include site_keys=default as a fallback when the requested brand (e.g. "taskip") has no samples of its own. Fixes the chat style picker showing 0 samples and going straight to render, and fixes perSlideDNA returning null causing all slides to render in brand-default purple instead of training sample colors.' },
    ],
  },
  {
    version: 'v4.53.0',
    date: '2026-05-14',
    entries: [
      { tag: 'feat', scope: 'realtime', description: 'Notification bell is now WebSocket-driven: backend pushes a full NotifSummary via notifications:update whenever approvals are created/removed or agent logs are written — no HTTP fetch on every event. Frontend subscribes to notifications:subscribe on connect and receives an immediate snapshot. Polling reduced from 15s to 5-minute fallback only. Sidebar approval badge is kept in sync by seeding the approvals-count React Query cache from the WebSocket payload — no extra HTTP call.' },
    ],
  },
  {
    version: 'v4.52.2',
    date: '2026-05-14',
    entries: [
      { tag: 'fix', scope: 'support', description: 'Webhook fallback: when normalizeCrmPayload cannot find a ticket (missing subject), the agent now scans the payload for any numeric ticket ID and fetches the full ticket from the CRM API before rejecting. This recovers webhooks where the CRM sends a minimal payload (ticket_id only, or nested resource without subject). Migration 0073 adds crm_uuid column — apply manually in production: ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS crm_uuid text.' },
    ],
  },
  {
    version: 'v4.52.1',
    date: '2026-05-14',
    entries: [
      { tag: 'fix', scope: 'render', description: 'Quick Generate 500 error: PostBrandService.resolve() no longer throws when a brand name is not in the canvaBrands table — it falls back to default fonts (Inter) and palette, logging a warning. PostRenderController.render() now wraps errors in a proper HttpException so the client receives the actual error message instead of a generic 500. apiFetch in AgentDetailPage now reads the JSON error body before throwing so "Request failed" shows the real cause.' },
    ],
  },
  {
    version: 'v4.52.0',
    date: '2026-05-14',
    entries: [
      { tag: 'feat', scope: 'render', description: 'Dot texture backgrounds: when a training sample has background_texture "dots", "grid", or "geometric-pattern" in its DNA, the rendered slides now overlay a white dot radial-gradient texture on the slide background color — matching the Yellow Minimalist carousel style. The texture is applied via CSS backgroundImage + backgroundColor layering.' },
      { tag: 'feat', scope: 'render', description: 'Colored list item boxes: when the visual spec LLM returns a listItemBg color for a list-role slide, each list item is wrapped in a colored content box with borderRadius and padding, matching the Yellow Minimalist carousel style where each point has its own visual container.' },
      { tag: 'fix', scope: 'render', description: 'ThemeContract decoration opacity: removed the hardcoded 0.18 opacity cap on decorations sourced from training sample DNA — shapes now use their actual extracted opacity values, allowing bold corner shapes to show at full 0.5-0.9 opacity as intended.' },
    ],
  },
  {
    version: 'v4.51.0',
    date: '2026-05-14',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'Chat style reference picker: after the agent finalizes content (brand, format, topic resolved), it now presents a numbered list of all uploaded training samples before firing the render. The user picks a number (or 0 for random) and the agent pins that sample\'s exact DNA — colors, shapes, decorations — to every slide. The pending render params are embedded in the agent message so the next chat turn can extract and fire them without any extra state storage.' },
      { tag: 'feat', scope: 'canva', description: 'Sample-pinned renders: RenderRequest now accepts an optional sampleId field. When set, all slides use that training sample\'s DesignDNA instead of picking random per-slide DNAs. The Quick Generate UI panel and the chat style picker both populate this field.' },
    ],
  },
  {
    version: 'v4.50.0',
    date: '2026-05-14',
    entries: [
      { tag: 'feat', scope: 'render', description: 'Style reference picker: the Post Renders tab now shows a Quick Generate panel with a thumbnail strip of all training samples. Clicking a sample pins its exact DNA (colors, shapes, decorations) to every slide in the render. Without a selection, slides continue to use random per-slide training samples.' },
      { tag: 'feat', scope: 'render', description: 'Quick Generate panel: directly generate a render from the Post Renders tab without going through the agent chat — pick format, brand, topic, and optional style reference, then hit Generate. The result appears at the top of the renders list immediately.' },
      { tag: 'fix', scope: 'render', description: 'Bold decorations: decorations now use opacity 0.5-0.9 for corner/edge shapes and larger sizes (40-75% of canvas) as instructed in the visual spec prompt. The hardcoded 0.12-0.35 opacity clamp is removed — the LLM now controls decoration prominence, matching the bold visual language of uploaded training carousels.' },
    ],
  },
  {
    version: 'v4.49.1',
    date: '2026-05-14',
    entries: [
      { tag: 'fix', scope: 'render', description: 'Blank slide: content service now falls back to position-based slide matching when the LLM returns slides with out-of-order or skipped slideIndex values, preventing empty slots on any slide.' },
      { tag: 'fix', scope: 'render', description: 'Black CTA slide: overlay layout no longer hardcodes #111111 as the fallback background — it now uses resolveVisualBackground and resolveVisualBackgroundStyle so the ThemeContract and visual spec color chain applies correctly.' },
      { tag: 'fix', scope: 'render', description: 'Layout pool: split-panel removed from content role pool (left stat panel was always empty on content slides) and overlay removed from CTA role pool (designed for image backgrounds, breaks on solid-color CTA slides).' },
    ],
  },
  {
    version: 'v4.49.0',
    date: '2026-05-14',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'Intent-aware chat with clarifying questions: the Canva agent now uses LLM-based intent classification to distinguish design generation requests from question answers and general chat. When a design intent is detected the agent asks clarifying questions (brand, visual tone, content format) before generating. When the user answers those questions the agent extracts the context and fires the render action. Conversation history (last 6 messages) is passed from the frontend so the classifier can resolve which branch is active.' },
    ],
  },
  {
    version: 'v4.48.0',
    date: '2026-05-14',
    entries: [
      { tag: 'feat', scope: 'support', description: 'CRM ticket management actions: operators can now change ticket priority (0–4), update ticket status (open / in_progress / resolved / closed with optional resolution notes), and add internal notes directly from the ticket detail page. All three actions call the CRM public API (priority via UUID, status via numeric ID, note via UUID) and write audit events to the activity timeline. The CRM UUID is now captured from the webhook payload and stored in the database. Existing tickets without a UUID show a yellow notice on the affected fields.' },
      { tag: 'chore', scope: 'support', description: 'Migration 0073: adds crm_uuid column to support_tickets table to store the ticket UUID from CRM webhook payloads, required for the new priority and note CRM endpoints.' },
    ],
  },
  {
    version: 'v4.47.0',
    date: '2026-05-14',
    entries: [
      { tag: 'feat', scope: 'support', description: 'Feed KB from CRM Ticket: new POST /support/kb-import endpoint accepts a CRM ticket ID, fetches the full conversation (description + reply thread) via the CRM API, strips HTML, and calls the LLM to generate a clean Q&A reference entry saved directly to the knowledge base scoped to the support agent. A "Feed KB from CRM Ticket" section is added to the Support agent Setup tab with a ticket ID input and inline success/error feedback.' },
    ],
  },
  {
    version: 'v4.46.5',
    date: '2026-05-14',
    entries: [
      { tag: 'fix', scope: 'design-samples', description: 'Carousel upload is now non-blocking: clicking "Upload N-slide carousel" clears the staging area immediately so the next carousel can be staged and uploaded without waiting. Each in-flight carousel job shows as a progress card below the upload area with a label, per-slide phase text, and a progress bar that turns green on completion or red on failure. Multiple carousels can be uploading concurrently. Jobs auto-dismiss 3s after completion.' },
    ],
  },
  {
    version: 'v4.46.4',
    date: '2026-05-14',
    entries: [
      { tag: 'fix', scope: 'support', description: 'Reply event handling overhaul: agent reply webhooks now mark the ticket as replied in the DB and write an agent_reply_received event instead of silently skipping. Agent detection checks multiple payload fields (replied_by, user, reply.user). Customer reply events now reopen any existing ticket regardless of purchaseCodeStatus (not just when code was requested), and write a customer_reply_received event. In decide(), when a purchase code was already requested but the customer replied without providing it, the ticket no longer gets stuck — it falls through to the LLM with a pending-code context block so the agent can address the reply and remind the customer.' },
    ],
  },
  {
    version: 'v4.46.3',
    date: '2026-05-14',
    entries: [
      { tag: 'fix', scope: 'design-samples', description: 'Carousel upload now shows real-time per-slide progress. Each slide is uploaded and analyzed individually (reusing the existing upload endpoint), with a step label ("Analyzing slide 2 of 5") and a progress bar that advances after each slide completes. A final synthesis step merges all per-slide DNAs into one carousel entry and removes the individual entries. The upload button is disabled and the progress bar turns green when synthesis completes.' },
    ],
  },
  {
    version: 'v4.46.2',
    date: '2026-05-14',
    entries: [
      { tag: 'feat', scope: 'design-samples', description: 'LinkedIn carousel upload mode: a toggle on the upload area switches between "Individual images" (existing behavior) and "LinkedIn carousel set." In carousel mode, slides are staged in order with numbered thumbnails before upload. On submit, all slides are analyzed individually via vision LLM, then a synthesis LLM pass merges the per-slide DNAs into one unified carousel design system DNA (shared color palette, typography, shape elements, mood). Stored as a single knowledge_entries row; the grid shows a blue slide-count badge on carousel entries.' },
    ],
  },
  {
    version: 'v4.46.1',
    date: '2026-05-14',
    entries: [
      { tag: 'feat', scope: 'design-samples', description: 'Delete all design samples button on the Samples tab. Removes all knowledge_entries rows (entryType=design_sample) for the brand and attempts to delete each file from R2 storage. Useful for local testing: wipe all samples, then re-upload a clean set.' },
    ],
  },
  {
    version: 'v4.46.0',
    date: '2026-05-14',
    entries: [
      { tag: 'feat', scope: 'support', description: 'Server access detection gate: when a verified ticket body contains a 500/server error, license error, or 404 error keyword, the agent checks whether admin credentials have been provided (username+password pattern). If missing, it queues a request_server_access action — posts a reply listing exactly what is needed (URL, admin credentials, FTP/cPanel details) and sends a Telegram notification. Goes through the same Approve/Reject flow as other actions. New detectServerIssue() and detectCredentials() private helpers.' },
      { tag: 'fix', scope: 'support', description: 'Already-verified tickets now pass a cached purchase status block to the LLM (Active/Expired/Invalid with instructions) instead of an empty block — preventing re-verification API calls and giving the LLM correct license context on every run after the first verification.' },
    ],
  },
  {
    version: 'v4.45.2',
    date: '2026-05-14',
    entries: [
      { tag: 'fix', scope: 'design-samples', description: 'Per-slide color variety: each slide now independently picks a different random training sample DNA so slides get distinct background colors instead of one repeated color. PostVisualService receives a per-slide color table with exact hex assignments and is instructed to use each slide\'s assigned color, not repeat them. Decoration opacity floor raised from 0.04 to 0.12 (max 0.35) so shapes are actually visible on slides. Fallback bgColor at parse time also uses per-slide DNA when available.' },
    ],
  },
  {
    version: 'v4.45.1',
    date: '2026-05-14',
    entries: [
      { tag: 'fix', scope: 'support', description: 'Purchase code detection now scans only the ticket body/description, not the subject. HTML is stripped at ingest time on both the CRM-fetch path and the webhook-description fallback path (previously only the fallback stripped HTML). A new stripHtml() helper removes <style>, <script>, all tags, and HTML entities before the text is stored — preventing UUID-pattern false positives from embedded CSS and HTML attributes.' },
    ],
  },
  {
    version: 'v4.45.0',
    date: '2026-05-14',
    entries: [
      { tag: 'feat', scope: 'support', description: 'Train Agent panel on ticket detail page: operators can submit a rule type (Spam Filter, Decision Rule, FAQ, Policy) and a plain-English instruction. The LLM reformulates it into a reusable KB fact, saves it as a kb_proposal, and sends a Telegram approval request before it goes live. Backend: new POST /support/tickets/:id/train route + trainFromTicket() method in SupportAgent. Frontend: inline collapsible panel with category selector, instruction textarea, and approval-confirmation state.' },
      { tag: 'feat', scope: 'design-samples', description: 'Sample-based rendering: each render now picks one random DesignDNA from the training library (getRandomSampleDNA) and uses its exact primary_color, accent_color, and shape_elements as the base theme — replacing the blurry dominant-average approach. contentBg no longer defaults to #ffffff; it uses the sampled DNA primary color so all slides have vivid learned colors. PostVisualService receives the sampled DNA colors as explicit hex anchors and is required to return non-null bgColor. Word highlights added to SlideVisualSpec: the LLM picks 1-2 headline words to receive colored badge backgrounds (pill-style), rendered via a new renderHeadline() helper in layout-helpers. list.layout.ts now calls renderDecorations() so shape decorations appear on list slides.' },
    ],
  },
  {
    version: 'v4.44.1',
    date: '2026-05-14',
    entries: [
      { tag: 'fix', scope: 'design-samples', description: 'Render variety: PostVisualService now shuffles pattern rules before sampling (random 6 per tag, not always the first 8) and runs at temperature 0.7 so shape placement and colors differ on every render. A random session seed prevents LLM response caching. Layout selection is now probabilistic — 60% dominant learned layout, 40% compatible alternative (centered/left-aligned/split-panel/overlay/list-layout per role) — so the same prompt produces structurally different carousels.' },
    ],
  },
  {
    version: 'v4.44.0',
    date: '2026-05-14',
    entries: [
      { tag: 'feat', scope: 'design-samples', description: 'Two-phase render pipeline: after filling content slots, a second LLM call (PostVisualService) translates brand pattern rules ([BACKGROUND], [COLOR], [SHAPE], [LAYOUT], [COMPOSITION]) into per-slide visual specs — background color, accent color, and decorative shapes. Layout functions now receive a SlideVisualSpec and apply per-slide overrides for background, accent, CTA button, accent stripe, and shape decorations.' },
    ],
  },
  {
    version: 'v4.43.1',
    date: '2026-05-14',
    entries: [
      { tag: 'fix', scope: 'design-samples', description: 'Patterns tab now groups rules by category tag (LAYOUT, COLOR, TYPOGRAPHY, BACKGROUND, SHAPE, BRANDING, CTA, STYLE, SLIDE, TONE, MOOD, etc.) instead of a flat list. Tag prefix is shown as a section header; items under it show only the rule text.' },
    ],
  },
  {
    version: 'v4.43.0',
    date: '2026-05-14',
    entries: [
      { tag: 'fix', scope: 'support', description: 'Webhook log tab now stores and shows the response body for every incoming event — rejected (secret_not_configured, missing_header, header_mismatch), stored, duplicate, reopened, skipped_agent_reply. Migration 0072 adds response_body column to support_webhook_logs.' },
      { tag: 'fix', scope: 'support', description: 'Renamed "Raw payload" to "Request payload" in the expanded webhook log row. Added a colour-coded Response section below it showing the exact JSON the server returned for that event.' },
    ],
  },
  {
    version: 'v4.42.0',
    date: '2026-05-14',
    entries: [
      { tag: 'feat', scope: 'support', description: 'Delete ticket: DELETE /support/tickets/:id removes the ticket and all its events. Detail page has a Delete ticket button in the header. Ticket list shows a trash icon on row hover.' },
    ],
  },
  {
    version: 'v4.41.0',
    date: '2026-05-14',
    entries: [
      { tag: 'fix', scope: 'inbox', description: 'Tracking pixel now uses the email record id directly in the pixel URL (/track/open/:id.gif) instead of a separate tracking_token column. Opens are now reliably recorded in production without requiring migration 0063.' },
      { tag: 'feat', scope: 'inbox', description: 'Delete button added to email detail panel. Removes the email and all its reply records from the database and clears the selection.' },
    ],
  },
  {
    version: 'v4.40.0',
    date: '2026-05-14',
    entries: [
      { tag: 'feat', scope: 'design-samples', description: 'Per-image pattern inspector: clicking any sample thumbnail opens a detail modal showing extracted patterns, DNA summary fields (slide_type, layout_type, background_style, colors, tone, mood, CTA, icons), and a Re-analyze button for that single image.' },
      { tag: 'feat', scope: 'design-samples', description: 'Individual re-analyze: POST /posts/design-samples/:id/reanalyze re-runs the vision LLM on one image and refreshes the KB entry without touching other samples.' },
      { tag: 'feat', scope: 'design-samples', description: 'Pattern management: Clear all patterns button removes the Design Patterns section from all design_sample KB entries and deletes design_pattern entries. Each pattern in the list has an X button to remove it from all samples that carry it.' },
      { tag: 'feat', scope: 'canva', description: 'Removed the "Generate new render" form from the Post Renders tab — renders are generated via chat. Tab now shows a tip and the renders history only.' },
    ],
  },
  {
    version: 'v4.39.1',
    date: '2026-05-14',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'Brand logo upload: new POST /canva/brands/:name/logo endpoint accepts multipart image (PNG/JPG/WEBP/SVG), stores in MinIO, and saves the URL back to the brand record.' },
      { tag: 'feat', scope: 'canva', description: 'Brands tab shows logo thumbnail on each brand card. Edit form shows current logo preview and an Upload/Replace button — upload fires immediately, no Save needed.' },
    ],
  },
  {
    version: 'v4.39.0',
    date: '2026-05-14',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'Pattern consistency layer: getPatternsBySlideType() groups per-image design rules by slide_type (cover/content/cta/stat/list/quote/testimonial). When enabled, each slide role receives its own set of learned patterns in the AI prompt.' },
      { tag: 'feat', scope: 'canva', description: 'Pattern consistency toggle added to Canva agent Settings tab. Enabling it injects per-slide-type patterns alongside the global patternRules so cover, inner, and CTA slides each follow the brand patterns learned for that role.' },
    ],
  },
  {
    version: 'v4.38.0',
    date: '2026-05-14',
    entries: [
      { tag: 'feat', scope: 'design-samples', description: 'Per-image pattern extraction: design rules are now derived directly from each image\'s DNA on upload and re-analysis — no separate LLM clustering step required. Each image contributes 20-30 rules covering layout, color, typography, decoration, CTA, branding, and mood.' },
      { tag: 'feat', scope: 'design-samples', description: 'getPatterns() now reads from design_sample entries, deduplicates by exact match, and sorts by frequency (most shared patterns first). Falls back to batch-clustered design_pattern entries if no per-image patterns exist.' },
      { tag: 'feat', scope: 'design-samples', description: 'getDominantDNA() pattern_rules also sourced from per-image patterns so post rendering immediately reflects all re-analysed samples.' },
    ],
  },
  {
    version: 'v4.37.1',
    date: '2026-05-14',
    entries: [
      { tag: 'fix', scope: 'design-samples', description: 'Clustering LLM passes increased from maxTokens 4000 to 8000. At 4000 tokens the response was being cut off before rule #10, consistently producing ~9 patterns regardless of sample count.' },
      { tag: 'fix', scope: 'design-samples', description: 'extractPatterns now also matches bold-numbered lines (e.g. **1.** format some models emit), increasing pattern yield per pass.' },
      { tag: 'fix', scope: 'design-samples', description: 'Clustering now logs DNA parse rate (X/480 samples with valid DNA) and exposes dnaCount in the cluster status. If dnaList is too small, a warning is shown instead of silently returning 0 patterns.' },
      { tag: 'fix', scope: 'design-samples', description: 'If clustering produces 0 patterns (empty LLM responses or all DNA parse failures), old patterns are now preserved instead of being silently deleted.' },
      { tag: 'fix', scope: 'design-samples', description: 'Cluster progress bar now shows sample count and DNA-parsed count on completion so the user can see if re-analysis is needed.' },
    ],
  },
  {
    version: 'v4.37.0',
    date: '2026-05-14',
    entries: [
      { tag: 'feat', scope: 'support', description: 'Ticket list rows now navigate to a dedicated detail page (/support/:id) instead of expanding inline. Detail page shows ticket body, purchase code status, and an activity timeline with all events.' },
      { tag: 'feat', scope: 'support', description: 'Generate Draft button on the ticket detail page triggers the AI agent to write a reply draft on demand, saving it to the ticket and logging a manual_draft event to the timeline.' },
      { tag: 'fix', scope: 'support', description: 'request_purchase_code action requires Telegram approval again (reverted auto-execute). Example codes in the purchase code request message replaced with format placeholders to avoid sharing real-looking codes.' },
    ],
  },
  {
    version: 'v4.36.8',
    date: '2026-05-14',
    entries: [
      { tag: 'fix', scope: 'support', description: 'request_purchase_code action no longer requires Telegram approval. It executes automatically and sends a Telegram confirmation after the CRM reply is posted.' },
    ],
  },
  {
    version: 'v4.36.7',
    date: '2026-05-14',
    entries: [
      { tag: 'fix', scope: 'design-samples', description: 'Active tab (renders/brands/design-samples/settings/setup) is now persisted to sessionStorage. Refreshing the page restores the last active tab so a running re-analysis progress bar is visible immediately.' },
      { tag: 'fix', scope: 'design-samples', description: 'On tab mount, if the cluster already finished while the page was unloaded, loadData() is now called to refresh patterns from DB immediately.' },
      { tag: 'fix', scope: 'design-samples', description: 'cluster() is now wrapped in try-catch-finally: on any LLM or DB failure, status.running is set to false and status.phase to "error". Previously a failed cluster left running=true forever, locking the frontend poll and keeping patterns stale.' },
    ],
  },
  {
    version: 'v4.36.6',
    date: '2026-05-13',
    entries: [
      { tag: 'feat', scope: 'settings', description: 'Canva Agent section added to Settings page with a configurable Design DNA Max Tokens field. The vision LLM token limit for design DNA extraction is now set from the UI — no redeployment needed.' },
      { tag: 'feat', scope: 'settings', description: 'SettingsService.getDecrypted now caches results in-memory with a 60-second TTL. Cache is invalidated immediately on upsert or delete. All services (image-gen, design-analysis, unsplash, llm-router) benefit without any per-service changes.' },
    ],
  },
  {
    version: 'v4.36.5',
    date: '2026-05-13',
    entries: [
      { tag: 'fix', scope: 'design-samples', description: 'Patterns count now updates after re-analysis completes. When re-analysis finishes with auto-cluster, the frontend starts polling cluster status to catch the backend auto-cluster and refresh patterns from DB when done.' },
      { tag: 'fix', scope: 'design-samples', description: 'Cluster status is now checked on page load — if clustering is already running (e.g. after page reload during auto-cluster), polling resumes automatically.' },
    ],
  },
  {
    version: 'v4.36.4',
    date: '2026-05-13',
    entries: [
      { tag: 'fix', scope: 'support', description: 'Webhook logs now appear in the Webhooks tab. Switched writeWebhookLog from raw SQL to Drizzle ORM insert so errors surface instead of being swallowed silently. listWebhookLogs also logs query failures.' },
      { tag: 'fix', scope: 'support', description: 'Support ticket body and purchase codes now extracted from webhook description field when CRM API is not configured or returns empty. HTML tags are stripped before storage.' },
      { tag: 'fix', scope: 'support', description: 'Webhook log status "stored" and "reopened" now display as green in the Webhooks tab (were incorrectly shown as red).' },
    ],
  },
  {
    version: 'v4.36.3',
    date: '2026-05-13',
    entries: [
      { tag: 'feat', scope: 'design-samples', description: 'Failed items log panel added to Design Samples re-analysis. Clicking "show" expands a scrollable list of failed sample IDs with their exact error reasons. Updates live during analysis. Includes a "Copy all" button for the full log. Retry Failed button still appears when analysis is complete.' },
    ],
  },
  {
    version: 'v4.36.2',
    date: '2026-05-13',
    entries: [
      { tag: 'fix', scope: 'design-samples', description: 'All re-analysis failures now log a warn with the reason. The inner JSON-parse catch was completely silent before — no logger call. Each failure now records {id, reason} in failedDetails and persists to DB. Hovering the "N failed" badge shows the error reason for each item.' },
    ],
  },
  {
    version: 'v4.36.1',
    date: '2026-05-13',
    entries: [
      { tag: 'fix', scope: 'inbox', description: 'Sync now auto-marks an email as opened when a reply is found. A reply proves the recipient read the message, so first_open_at and open_count are set to the reply timestamp if open tracking had not already fired. The "Not opened yet" status disappears automatically after Sync.' },
    ],
  },
  {
    version: 'v4.36.0',
    date: '2026-05-13',
    entries: [
      { tag: 'feat', scope: 'design-samples', description: 'Re-analysis progress now survives server restarts. State (done, total, errors, failedIds) is persisted to a new design_reanalysis_state table (migration 0071) and restored on the next status poll, so a Coolify redeploy mid-run no longer silently resets the progress bar.' },
      { tag: 'feat', scope: 'design-samples', description: 'Retry failed button: after re-analysis, if any images could not be processed a "Retry failed (N)" button appears. It re-runs only the failed items and starts a new polling cycle — no need to re-analyze all 478 images again.' },
    ],
  },
  {
    version: 'v4.35.2',
    date: '2026-05-13',
    entries: [
      { tag: 'fix', scope: 'inbox', description: 'Sync now captures replies sent from your own Gmail address. Previously the fromIsSelf filter silently dropped any thread message whose sender contained "sharifur", "xgenious", or "taskip.net" — blocking self-replies. The original sent message is already excluded by message-ID dedup, so the filter was redundant and harmful.' },
    ],
  },
  {
    version: 'v4.35.1',
    date: '2026-05-13',
    entries: [
      { tag: 'fix', scope: 'design-samples', description: 'Patterns tab count updates in real-time during Learn Patterns — shows patternsFound from cluster status instead of the stale loaded count while clustering is running.' },
    ],
  },
  {
    version: 'v4.35.0',
    date: '2026-05-13',
    entries: [
      { tag: 'fix', scope: 'tracking', description: 'Tracking pixel now works correctly end-to-end. Security headers (CSP, X-Frame-Options) are no longer applied to the /track/* route — CDN and proxy layers between email clients and the API were rejecting GIF responses that carried page-level security directives. Access-Control-Allow-Origin: * is now set explicitly on pixel responses. Token is saved atomically in the INSERT rather than a separate best-effort UPDATE so it can no longer be silently lost. VITE_API_URL is now recognised as a fallback for the pixel base URL so no new env var is needed on Coolify.' },
      { tag: 'fix', scope: 'inbox', description: 'Inbox detail view now polls every 30 seconds while the selected email has not been opened yet, so the open status updates automatically without requiring a manual Sync click.' },
      { tag: 'fix', scope: 'design-samples', description: 'Re-analysis now handles local:// scheme image URLs by reading the file from disk instead of making an HTTP request, fixing re-analysis failures for locally stored samples.' },
    ],
  },
  {
    version: 'v4.34.0',
    date: '2026-05-13',
    entries: [
      { tag: 'feat', scope: 'chat', description: 'Reply-to feature added to agent chat: hover any message and click the reply icon to quote it. A preview strip shows above the composer and the quoted context is prepended to the message sent to the AI for better conversational grounding.' },
      { tag: 'feat', scope: 'chat', description: 'Inline Approve/Decline buttons now appear directly below any chat message that is awaiting approval. Clicking either calls the approvals API immediately and clears the pending state in the chat — no need to switch to the Tasks tab or wait for Telegram.' },
    ],
  },
  {
    version: 'v4.33.0',
    date: '2026-05-13',
    entries: [
      { tag: 'fix', scope: 'chat', description: 'Agent chat no longer treats affirmations like "yes", "ok", "sure", or "yeah" as greetings mid-conversation. The greeting shortcut now only fires when the conversation is empty, so confirming an agent proposal works correctly instead of resetting the chat to the intro message.' },
    ],
  },
  {
    version: 'v4.32.0',
    date: '2026-05-13',
    entries: [
      { tag: 'feat', scope: 'support', description: 'Every step the support agent takes on a ticket is now recorded in a new support_ticket_events table — purchase code not found, code found and verified/invalid/expired, reply drafted, reply sent, escalated, ticket reopened, and any errors. Queryable via GET /support/tickets/:id/events.' },
      { tag: 'chore', scope: 'db', description: 'Migration 0070 adds support_ticket_events table with indexes on ticket_id and external_id.' },
    ],
  },
  {
    version: 'v4.31.0',
    date: '2026-05-13',
    entries: [
      { tag: 'feat', scope: 'support', description: 'Purchase code gate added to support agent. Tickets without a purchase code receive an automated reply requesting it before any AI response is drafted. The code is verified against Envato/Xgenious API and the result stored on the ticket so it is not re-verified on subsequent runs.' },
      { tag: 'feat', scope: 'support', description: 'When a customer replies to a purchase-code-requested ticket, the ticket is automatically reopened and re-processed so the agent can extract and verify the provided code.' },
    ],
  },
  {
    version: 'v4.30.0',
    date: '2026-05-13',
    entries: [
      { tag: 'feat', scope: 'design-samples', description: 'Re-analysis progress now persists across page reloads. On mount the UI checks the server status and automatically resumes polling if analysis is still running.' },
      { tag: 'feat', scope: 'design-samples', description: 'Added Cancel button during re-analysis. Clicking it signals the backend loop to stop after the current image and marks the progress bar yellow.' },
    ],
  },
  {
    version: 'v4.29.0',
    date: '2026-05-13',
    entries: [
      { tag: 'feat', scope: 'support', description: 'Support tickets now track purchase code and verification status. purchaseCode and purchaseCodeStatus columns added to support_tickets table via migration 0069.' },
      { tag: 'fix', scope: 'purchase-verify', description: 'Purchase code extractor now recognises Xgenious-format codes (XGENIOUS-XXXX-XXXX-XXXX-XXXX) in addition to UUID-format codes.' },
    ],
  },
  {
    version: 'v4.28.0',
    date: '2026-05-13',
    entries: [
      { tag: 'fix', scope: 'llm', description: 'Vision calls (design sample re-analyze) now skip DeepSeek automatically since it has no image support. When the default provider is DeepSeek and an image is attached, the router falls through to OpenAI or Gemini. Also added vision support to the Gemini provider via inlineData parts, so image analysis works with either OpenAI or Gemini as fallback.' },
      { tag: 'fix', scope: 'llm', description: 'autoRoute() now filters out DeepSeek from the provider list when imageBase64 is present, preventing silent failures where the image was dropped and the LLM returned garbage text instead of DNA JSON.' },
    ],
  },
  {
    version: 'v4.27.2',
    date: '2026-05-13',
    entries: [
      { tag: 'fix', scope: 'api', description: 'JSON parser now tolerates webhook payloads containing raw control characters (ASCII 0x00-0x1F) sent by some CRM platforms. Invalid characters are stripped on a second parse attempt instead of returning a 400 Bad Request.' },
    ],
  },
  {
    version: 'v4.27.1',
    date: '2026-05-13',
    entries: [
      { tag: 'fix', scope: 'cors', description: 'Webhook endpoints (those using secret-based signature verification) now bypass the CORS origin allowlist and respond with Access-Control-Allow-Origin: * so any external platform can call them. Added X-Webhook-Secret, X-Hub-Signature-256, and X-Hub-Signature to the global CORS allowedHeaders list.' },
    ],
  },
  {
    version: 'v4.27.0',
    date: '2026-05-13',
    entries: [
      { tag: 'fix', scope: 'webhooks', description: 'Log request and response body for successful webhook calls when signature verification is enabled, matching the existing logging for rejected signatures. Aids debugging of CRM and support webhook payloads.' },
    ],
  },
  {
    version: 'v4.26.0',
    date: '2026-05-13',
    entries: [
      { tag: 'fix', scope: 'support', description: 'Webhook rejection responses now include a machine-readable reason field: secret_not_configured, missing_header, or header_mismatch — making it easy to diagnose why a real webhook was rejected without reading server logs.' },
      { tag: 'fix', scope: 'support', description: 'Successful webhook ingestion response now returns { ok, status, ticketId, externalId } where status is stored, duplicate, or skipped — instead of the opaque { ok: true, id } returned previously.' },
      { tag: 'feat', scope: 'runtime', description: 'AgentApiRoute.verifySignature can now return { ok: false, reason } instead of plain false, and the dispatcher forwards that reason in the 401 response body. All other agents are unaffected.' },
    ],
  },
  {
    version: 'v4.25.0',
    date: '2026-05-13',
    entries: [
      { tag: 'fix', scope: 'taskip-internal', description: 'Fixed email send failure when email_suppressions table was missing — suppression check now has a try-catch that skips the check and logs a warning instead of throwing, unblocking all outbound sends.' },
      { tag: 'chore', scope: 'db', description: 'Added migration 0068 to force-create email_suppressions table idempotently — fixes environments where migration 0067 was recorded in __drizzle_migrations but its DDL never committed.' },
    ],
  },
  {
    version: 'v4.24.0',
    date: '2026-05-13',
    entries: [
      { tag: 'feat', scope: 'post-render', description: 'Per-role layout selection: when 20+ design samples exist, each slide role (cover/content/cta/stat/list/quote) uses the dominant layout type observed in that role across all samples instead of the format template default. Safety rules: list-layout never applied to non-list roles, overlay never applied to cover/cta.' },
      { tag: 'feat', scope: 'post-render', description: 'Gradient backgrounds: when DNA shows gradient-dark or gradient-light background style, cover and CTA slides render as CSS linear-gradient computed from the learned hex and a darkened variant at the dominant gradient angle from the sample set. Content slides remain flat for readability.' },
      { tag: 'feat', scope: 'post-render', description: 'Learned font pairing: when brand uses default Inter fonts, getDominantDNA font_style field maps to a Google Font pair (geometric→Montserrat, classic-serif→Playfair Display/Lato, rounded→Nunito, slab-serif→Roboto Slab, display→Bebas Neue). Only overrides when brand has not customised fonts.' },
      { tag: 'feat', scope: 'post-render', description: 'Structured pattern rules in content prompt: pattern rules are now filtered by relevance — copy/text rules get priority (up to 20), per-slide-type rules next (up to 8), a few visual rules last. Total up from 5 to 33 rules injected into content generation, driving copy length, tone, and structure from the learned dataset.' },
    ],
  },
  {
    version: 'v4.23.0',
    date: '2026-05-13',
    entries: [
      { tag: 'feat', scope: 'post-render', description: 'ThemeContract now uses colors learned from design samples instead of brand palette when 20+ samples exist. Cover background uses dominant cover-slide hex, content background uses learned content-slide hex, CTA background uses learned CTA-slide hex, accent uses learned dominant accent color. Text colors (headline/body/subtext) are computed from actual background for WCAG AA compliance.' },
      { tag: 'fix', scope: 'post-render', description: 'Fixed headlineColor computation bug in ThemeContractService — previously always resolved to white regardless of background. Now correctly calls pickTextColor(contentBg) so dark content backgrounds get white text and light backgrounds get dark text.' },
      { tag: 'feat', scope: 'post-render', description: 'getDominantDNA now extracts per-slide-type dominant colors (bg/accent/textHex for cover/content/cta/stat/list/quote/testimonial), dominant primary color, dominant accent color, dominant headline hex, CTA background hex, and background gradient angle from the full design sample dataset.' },
    ],
  },
  {
    version: 'v4.22.0',
    date: '2026-05-13',
    entries: [
      { tag: 'feat', scope: 'post-render', description: 'Multi-pass clustering: "Learn patterns" now runs 6 focused LLM passes instead of one — Pass 1: Structure & Layout (50+ rules), Pass 2: Color System (50+), Pass 3: Typography (50+), Pass 4: Visual Elements (50+), Pass 5: Brand Identity & Content (40+), Pass 6: Per Slide Type (15+ rules per cover/content/cta/stat/list/quote type). Target: 300–400 patterns from 478 samples vs the previous 50-80 cap.' },
      { tag: 'feat', scope: 'post-render', description: 'Patterns stored in chunks of 100 per KB entry so large pattern sets remain retrievable. getPatterns() and getDominantDNA() both read all chunks via flatMap. Banner brief always in chunk 1.' },
      { tag: 'feat', scope: 'post-render', description: 'Frontend progress bar shows Pass N/M: [label] with accurate percentage (each pass = 1/totalPasses of the bar). Live counter shows patterns found so far while clustering runs.' },
    ],
  },
  {
    version: 'v4.21.0',
    date: '2026-05-13',
    entries: [
      { tag: 'feat', scope: 'post-render', description: 'Learn patterns now shows real-time progress: "Learn patterns" fires in background immediately, frontend polls GET /posts/design-samples/cluster/status every 2s and shows the current phase (Loading samples / Aggregating DNA frequencies / Generating patterns (LLM) / Writing banner brief / Saving). Progress bar advances through phases with a pulse animation. Switches to Patterns tab automatically on click.' },
      { tag: 'feat', scope: 'post-render', description: 'Patterns tab updates in real-time during clustering: shows phase label while running, then refreshes the full pattern list and banner brief when clustering completes — no manual page reload needed.' },
    ],
  },
  {
    version: 'v4.20.0',
    date: '2026-05-13',
    entries: [
      { tag: 'feat', scope: 'post-render', description: 'Re-analyze all now shows a live progress bar: polls GET /posts/design-samples/reanalyze/status every 3s and displays done/total count and percentage. Progress bar turns green on completion. After all images are re-analyzed, pattern clustering runs automatically (autoCluster=true).' },
      { tag: 'fix', scope: 'post-render', description: 'Re-analyze all was storing a simplified 14-line KB entry (missing text_elements, layer_stack, composite_effects, decorative_illustrations, scene_composition, photo_subjects). Fixed: both analyzeAndStore and reanalyzeSamples now use the same full buildKbContent() builder. Embeddings are also regenerated after each image so pattern search benefits from the updated DNA.' },
    ],
  },
  {
    version: 'v4.19.0',
    date: '2026-05-13',
    entries: [
      { tag: 'feat', scope: 'inbox', description: 'Compose new email from the inbox page: "Compose" button in top bar opens a full compose panel with From (account selector), To, Subject, Purpose, plain-text toggle, and body. Account selector populated from configured Gmail accounts, defaults to the default account. After sending, email appears in the inbox list and reply tracking starts automatically.' },
      { tag: 'feat', scope: 'inbox', description: 'Account selector added to the reply composer: choose which Gmail account to send the reply from.' },
      { tag: 'fix', scope: 'inbox', description: 'accountId now correctly wired through SendTrackedEmailInput to gmail.getFromAddress() and gmail.sendEmail() — previously accountId was stored only in metadata and the send always used the default account regardless.' },
    ],
  },
  {
    version: 'v4.18.2',
    date: '2026-05-13',
    entries: [
      { tag: 'feat', scope: 'post-render', description: 'Persistent font disk cache at ~/.cortex/fonts-cache/: fonts are saved as binary files after first fetch and loaded from disk on server restarts — no re-download needed. Two-layer lookup: L1 in-memory Map (zero cost within a process lifetime), L2 disk (survives restarts), L3 Google Fonts API (only on first-ever use). Inter fallback is also disk-cached so it never hits the network after the first render.' },
    ],
  },
  {
    version: 'v4.18.1',
    date: '2026-05-13',
    entries: [
      { tag: 'fix', scope: 'post-render', description: 'Fix "Unsupported OpenType signature <!DO" crash: font loader now checks HTTP response status before reading bytes, validates font magic bytes (TTF/OTF/WOFF/WOFF2 signatures) before caching, falls back to weight 400 of the same font if bold weight unavailable (e.g. Instrument Serif), then falls back to Inter via Google Fonts CSS API — no more hardcoded gstatic WOFF URL that could return HTML on failure.' },
    ],
  },
  {
    version: 'v4.18.0',
    date: '2026-05-13',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'DNA now captures illustration scenes as unified compositions: scene_composition field stores type (unified-scene/scattered-icons), theme, one-sentence narrative, characters present, props present, and element_relationships (person-character [riding] shopping-cart, dollar-sign-circle [pointing-at] headline, etc.). decorative_illustrations subject enum expanded to 35+ types including shopping-cart, dollar-sign-circle, person-character, motion-lines, curved-arrow, geometric-arrow, growth-chart, trophy, rocket, speech-bubble, and more. Each instance tracks interacts_with[] and scene_group (main-scene/scattered/standalone). KB content builder renders scene narrative and all element interactions.' },
    ],
  },
  {
    version: 'v4.17.9',
    date: '2026-05-13',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'DNA now captures paper planes, stars, arrows and all illustrative icons via decorative_illustrations[] — each entry stores subject type, render style (outline-stroke, filled, hand-drawn), stroke/fill colors, opacity, semantic role, and per-instance positions with individual x/y/w/h/rotation. Person cutout photos tracked in photo_subjects[] with treatment (cutout/full-frame/masked), body framing (portrait/halfbody/full-body), position anchor, z-index, and overlap list. Shape elements gain clipped_at_edge and visible_arc fields for partial circles that extend beyond the canvas edge. White glow/blur elements captured as shape_type:radial-glow. font_style (italic/normal) and font_family_style added to each text_elements entry.' },
    ],
  },
  {
    version: 'v4.17.8',
    date: '2026-05-13',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'DNA now captures layering and overlap relationships: layer_stack (painting order back→front), z_index on every element, overlaps_with array naming which elements overlap, composite_effects describing how elements interact (number-as-background, word-highlight-shape, layered-eyebrow, inline-badge, shape-behind-text). Text elements gain background_shape, background_rotation_deg, and word_highlights (per-word inline background shapes with rotation and padding). Enables learning designs like: giant stat number behind headline text, eyebrow pill overlapping headline start, single word with rotated colored rectangle behind it.' },
    ],
  },
  {
    version: 'v4.17.7',
    date: '2026-05-13',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'DNA now captures every text layer individually via a text_elements array — each entry stores role, content preview, x/y/w/h position (% of canvas), rotation_deg (0 for normal, 90 for vertical, etc.), font weight, estimated size in px, color hex, background hex, letter-spacing, line-height, case style, decoration, line count, and opacity. rotation_deg also added to element_positions. DesignDNA TypeScript interface updated with text_elements, typography, spacing, color_usage, and text_content_pattern fields.' },
    ],
  },
  {
    version: 'v4.17.6',
    date: '2026-05-13',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'DNA prompt extended with full typography detail (case, letter-spacing, line-height, word count, eyebrow style, highlight usage), spacing measurements (outer padding, vertical rhythm, element gaps), exact color hex per element (background, headline, CTA, accent bar), and text content patterns (headline structure, brand name usage). Pattern prompt now generates 25-40 rules across 19 categories with mandatory hex codes, SVG shape hints, and positional data. maxTokens raised to 4000.' },
      { tag: 'feat', scope: 'canva', description: 'Samples grid replaced Prev/Next pagination with a "Load more (N remaining)" button — starts at 60, grows by 60 on each click.' },
    ],
  },
  {
    version: 'v4.17.5',
    date: '2026-05-13',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'Samples grid now paginates 60 images per page with Prev/Next controls — stays fast with 300+ samples.' },
      { tag: 'feat', scope: 'canva', description: 'Pattern clustering now uses ALL uploaded DNA samples (removed 100-sample cap), generates 20-30 detailed rules across 10 categories (added SPACING and BRAND IDENTITY), and has a 2500-token budget for deep results.' },
      { tag: 'feat', scope: 'canva', description: 'Re-analyze all button — fires background re-analysis of every stored sample through the vision LLM to refresh DNA data with the latest prompt. Returns immediately; processes in background.' },
      { tag: 'fix', scope: 'canva', description: 'DNA extraction maxTokens increased to 2000 for best quality per-image analysis.' },
    ],
  },
  {
    version: 'v4.17.4',
    date: '2026-05-13',
    entries: [
      { tag: 'fix', scope: 'canva', description: 'Removed hard .limit(200) from listSamples() DB query — all uploaded design samples are now returned regardless of count. Samples tab and count now correctly reflect 300+ images.' },
    ],
  },
  {
    version: 'v4.17.3',
    date: '2026-05-13',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'Design Samples upload is now non-blocking — new images can be dropped while previous ones are still being analyzed by vision LLM. Each file uploads individually so the progress bar increments in real time. Sample grid refreshes after each completed image.' },
      { tag: 'fix', scope: 'canva', description: 'Removed the "Uploaded undefined sample(s)" status message — progress state now tracks done/total counts directly without relying on the API response field.' },
    ],
  },
  {
    version: 'v4.17.2',
    date: '2026-05-12',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'Pattern learning now generates a holistic "Banner Brief" — a 3-5 sentence art-director paragraph synthesizing layout, color, typography, icons, shapes, and tone into a single actionable design description. Stored alongside pattern rules and surfaced in the Patterns tab.' },
      { tag: 'feat', scope: 'canva', description: 'Banner Brief is passed to content generation as design context — AI copy now understands the full visual intent of the brand, not just individual rules.' },
      { tag: 'feat', scope: 'canva', description: 'UnsplashService wired into PostRendererService — real photos are fetched via _buildUnsplashQuery() before AI generation when DNA indicates photography style. Unsplash is not listed as an image generation provider; it is a photo source for backgrounds and corporate imagery.' },
      { tag: 'fix', scope: 'canva', description: 'UnsplashService added to post-render module providers and exports — was imported but missing from DI registration, causing runtime injection errors.' },
    ],
  },
  {
    version: 'v4.17.1',
    date: '2026-05-12',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'Learned design DNA is now fully applied during rendering. getDominantDNA() aggregates all samples and drives: heading size, padding, line height, accent bar position, logo placement, CTA button style/border-radius, content tone, mood keywords, and icon/illustration/photography style.' },
      { tag: 'feat', scope: 'canva', description: 'Decorative shapes from design samples (circles, blobs, diagonal cuts, waves, etc.) are rendered in centered and left-aligned layouts using absolute-positioned divs — colours, gradients, opacity, and border-radius all from the learned shape_elements DNA.' },
      { tag: 'feat', scope: 'canva', description: 'CTA buttons now adopt the learned ctaStyle: pill (borderRadius 999), flat (0), outlined (transparent bg with accent border), text-link, or arrow-link. Helper ctaStyle() centralises rendering logic across layouts.' },
      { tag: 'feat', scope: 'canva', description: 'Image generation prompts now use learned photography_style, illustration_style, background_style and mood_keywords — produces contextually matching backgrounds instead of the generic fallback.' },
      { tag: 'feat', scope: 'canva', description: 'Content generation receives learned content_tone, mood_keywords, and top-5 pattern rules — AI copy now matches the visual tone of the learned brand.' },
    ],
  },
  {
    version: 'v4.17.0',
    date: '2026-05-12',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'Design sample DNA extraction is now deeply detailed — icon style/count/size, illustration type, photography style, decoration elements, border radius, shadow, CTA shape, content tone, color count, background texture, and free-text pattern notes are all extracted per image.' },
      { tag: 'feat', scope: 'canva', description: 'Spatial layout capture (Elementor-style): every visible element (logo, headline, icon, CTA, brand-bar, etc.) is recorded with x/y/w/h as canvas percentages, alignment, and z-layer. Grid column count and content zone bounds are also captured.' },
      { tag: 'feat', scope: 'canva', description: 'Shape element capture: every decorative shape (circle, blob, wave, diagonal-cut, etc.) records shape type, fill type/colors, gradient angle, opacity, position, border-radius, and an SVG reconstruction hint — enough to regenerate the exact shape programmatically.' },
      { tag: 'feat', scope: 'canva', description: 'Pattern clustering now aggregates full DNA JSON across all samples (not just 300-char text slices), computes field frequencies, collects SVG hints, and produces 8–12 category-organised rules covering layout, color, typography, icons, illustration/photo, shapes, content tone, and CTA.' },
    ],
  },
  {
    version: 'v4.16.9',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'activity', description: 'Activity panel no longer shows spinning progress icons for completed render_slide, content_gen, post_render and image_gen steps — they resolve to success icons once the paired done-event arrives or the run finishes.' },
      { tag: 'feat', scope: 'chat', description: 'Slide lightbox redesigned — dot-strip slide counter, side chevron buttons for prev/next, separate Copy and Download action buttons, keyboard hint, rounded image with ring.' },
    ],
  },
  {
    version: 'v4.16.8',
    date: '2026-05-12',
    entries: [
      { tag: 'feat', scope: 'chat', description: 'Slide thumbnails are now clickable — opens a full-size lightbox with prev/next navigation, keyboard arrow support, and a "Copy image" button that copies the PNG to clipboard for pasting directly into Canva.' },
    ],
  },
  {
    version: 'v4.16.7',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'post-render', description: 'Local filesystem fallback for slide PNGs when R2 is not configured — slides saved to ~/Designs/AI-Agent/Renders/<renderId>/ and served via /posts/renders/:id/slides/:n/png.' },
      { tag: 'fix', scope: 'post-render', description: 'Fixed "cannot cast type record to text[]" — replaced raw SQL INSERT with Drizzle ORM .insert().values() so slideUrls array is properly persisted.' },
      { tag: 'fix', scope: 'post-render', description: 'Satori crash on undefined CSS values fixed in centered and overlay layouts — backgroundImage/backgroundColor now use conditional spread instead of explicit undefined.' },
      { tag: 'fix', scope: 'post-render', description: 'Added missing journal entries for migrations 0064-0065 so Drizzle applies them on next db:migrate run.' },
      { tag: 'feat', scope: 'chat', description: 'Progressive slide rendering in chat — while a render is in progress the chat shows a live grid with completed slide thumbnails and skeleton placeholders for pending slides. Final result renders a full SlideGrid.' },
    ],
  },
  {
    version: 'v4.16.6',
    date: '2026-05-12',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'Design Samples tab now has Samples / Patterns sub-tabs — patterns are no longer inline so the page stays readable with 200+ uploaded images. Sample thumbnails are fixed 60×60px squares; the Learned badge is now a small green BookOpen icon.' },
    ],
  },
  {
    version: 'v4.16.5',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'post-render', description: 'Removed children:null from all layout accent-bar and stripe elements — satori crashed with "Cannot read properties of undefined (reading trim)" when processing null children. Activity tab now emits an ERROR log entry when render fails so the panel shows a red error state instead of staying stuck on the last progress step.' },
    ],
  },
  {
    version: 'v4.16.4',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'canva', description: 'Learn patterns now works with 3+ samples — cluster() and getPatterns() replaced semantic search with direct DB queries. Frontend passes brand=default so uploaded samples are correctly matched.' },
      { tag: 'feat', scope: 'canva', description: 'Design sample cards: removed title text, added green Learned badge on each thumbnail when patterns have been generated. Grid expanded to 4 columns.' },
    ],
  },
  {
    version: 'v4.16.3',
    date: '2026-05-12',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'Design Samples cards now show a 60x60 thumbnail. Clicking the thumbnail opens the full-size image in a lightbox overlay (click outside to close).' },
      { tag: 'feat', scope: 'debug', description: 'DebugLogsPage stats and log list now show animated skeleton placeholders while loading instead of empty state.' },
      { tag: 'fix', scope: 'post-render', description: 'Added error logging with stack traces to satori render crashes and postRenders SELECT failures — easier to diagnose render pipeline errors.' },
    ],
  },
  {
    version: 'v4.16.2',
    date: '2026-05-12',
    entries: [
      { tag: 'feat', scope: 'activity', description: 'Render pipeline steps now appear in the Activity tab in real time — runId is injected into the action payload by the execute processor so all post_render logs (theme locked, content ready, rendering slide N, render complete) attach to the correct run.' },
      { tag: 'fix', scope: 'canva', description: 'Design Samples list now shows uploaded entries — listSamples() was using semantic search (searchEntries) which skipped non-matching entries. Replaced with a direct DB query filtering entryType=design_sample.' },
      { tag: 'fix', scope: 'canva', description: 'Lower Learn patterns threshold from 20 to 3 so it can be tested with a small set of uploads.' },
    ],
  },
  {
    version: 'v4.16.1',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'chat', description: 'Chat now shows response messages from auto-executed agent actions (e.g. post_render) by reading run.result[].data.message when present.' },
    ],
  },
  {
    version: 'v4.16.0',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'inbox', description: 'Fixed mark-as-opened persisting across reloads — root cause was JSON.stringify() in the email send/seed paths causing metadata to be stored as a JSONB string scalar instead of an object. The || merge operator then produced a JSONB array on subsequent updates, so manuallyOpened was always undefined after reload. Fixed by passing JS objects directly (no JSON.stringify) in send() and seed so postgres.js serializes them correctly as JSONB objects.' },
    ],
  },
  {
    version: 'v4.15.9',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'inbox', description: 'listSent and getDetail now use raw SQL with a COALESCE fallback for open_count/first_open_at/last_open_at — these columns may not exist on local environments where migration 0063 has not run. Falls back to a query without those columns if they are missing, so the inbox loads instead of 500-ing.' },
    ],
  },
  {
    version: 'v4.15.8',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'dev', description: 'Added missing agent route prefixes to Vite dev proxy: /taskip-internal, /support, /canva, /email-manager, /linkedin, /reddit, /whatsapp. Without these the inbox and other agent pages returned empty data locally because requests were served by Vite instead of the API.' },
    ],
  },
  {
    version: 'v4.15.7',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'inbox', description: 'Mark as opened now persists across page reloads — listSent and getDetail queries now include openCount, firstOpenAt, lastOpenAt columns. Previously these were omitted from the SELECT so reload always showed openCount as undefined, and the opened badge relied only on the metadata JSONB field.' },
      { tag: 'feat', scope: 'seed', description: 'Added 5 dummy inbox emails to the seed script for local development — covers marketing, trial_followup, and other purposes with varying open states (unopened, pixel-opened, manually-opened, failed send).' },
    ],
  },
  {
    version: 'v4.15.6',
    date: '2026-05-12',
    entries: [
      { tag: 'chore', scope: 'deploy', description: 'Revert migration step from nixpacks.toml start command — Coolify post-deploy command already runs node dist/src/migrate before traffic switches; adding it to the start cmd caused double-migration on every deploy.' },
    ],
  },
  {
    version: 'v4.15.5',
    date: '2026-05-12',
    entries: [
      { tag: 'chore', scope: 'deploy', description: 'Switch to Nixpacks for deployment: migrations now run automatically via nixpacks.toml start command ("node dist/src/migrate && node dist/src/main"). Removed Dockerfile, .dockerignore, docker-entrypoint.sh, and healthcheck.js — they are not used with Nixpacks.' },
    ],
  },
  {
    version: 'v4.15.4',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'support', description: 'Webhook log now written for every incoming request, including those rejected at the signature check (missing secret config, missing header, wrong secret). Previously only requests that passed signature validation appeared in the Webhook Logs tab. Rejected entries show status "rejected" with the specific reason in the error field.' },
    ],
  },
  {
    version: 'v4.15.3',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'support', description: 'Webhook normalization now handles flat data payloads where data contains the ticket fields directly (id, subject, priority at top level). Previously only transformer-class-keyed formats were recognised, causing "Missing ticket.id or ticket.subject" for all support.ticket.created and support.ticket.replied events. Priority now also accepts string values (low/medium/high/urgent) in addition to numeric codes.' },
    ],
  },
  {
    version: 'v4.15.2',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'migrations', description: 'Added migration 0067_ensure_email_tables: creates email_suppressions table and adds open-tracking columns (tracking_token, open_count, first_open_at, last_open_at, open_events) with IF NOT EXISTS guards. Fixes persistent "relation email_suppressions does not exist" — 0062/0063 were recorded as applied in __drizzle_migrations but their DDL never committed.' },
      { tag: 'fix', scope: 'inbox', description: 'Mark as opened no longer reverts after a second — removed the immediate inbox list invalidation from onSuccess. The optimistic cache patch is now stable; a simultaneous refetch was racing the DB write and returning stale data that overwrote the opened state.' },
    ],
  },
  {
    version: 'v4.15.1',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'deploy', description: 'docker-entrypoint.sh now runs "node dist/src/migrate" automatically before starting the app on every container start. Eliminates the need for a manual Coolify post-deploy command — migrations (including missing post_renders and post_formats tables) apply on the next deploy.' },
    ],
  },
  {
    version: 'v4.15.0',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'migrate', description: 'Standalone migrate.ts (node dist/src/migrate) now logs journal entry count, wraps the client in try/finally so it always closes, throws a clear error if the drizzle folder cannot be found, and calls process.exit(0) on success so Coolify post-deploy commands exit cleanly instead of hanging.' },
    ],
  },
  {
    version: 'v4.14.9',
    date: '2026-05-12',
    entries: [
      { tag: 'chore', scope: 'agents', description: 'Removed Social Media Handler (social) and YouTube Shorts Creator (shorts) agents — deregistered from app.module.ts, seed.ts, and Telegram routing menus.' },
    ],
  },
  {
    version: 'v4.14.8',
    date: '2026-05-12',
    entries: [
      { tag: 'chore', scope: 'canva', description: 'Renamed agent from "Canva + Social Content Agent" to "Social Media Banner Design Agent" in agent class and seed file.' },
    ],
  },
  {
    version: 'v4.14.7',
    date: '2026-05-12',
    entries: [
      { tag: 'chore', scope: 'canva', description: 'Removed Candidates tab from Canva agent settings — Post Renders is now the default landing tab.' },
      { tag: 'chore', scope: 'nav', description: 'Removed Post Renders sidebar nav item — the feature lives inside the Canva agent settings tab.' },
    ],
  },
  {
    version: 'v4.14.6',
    date: '2026-05-12',
    entries: [
      { tag: 'chore', scope: 'canva', description: 'Design Samples tab: removed brand filter — samples are now uploaded and listed globally across all brands. Learn patterns also runs globally.' },
    ],
  },
  {
    version: 'v4.14.5',
    date: '2026-05-12',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'Post Renders brand field is now a select dropdown populated from saved canva brands. First brand is auto-selected on load. Falls back to a text input if no brands are configured yet.' },
    ],
  },
  {
    version: 'v4.14.4',
    date: '2026-05-12',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'Design Samples upload now has a full drag-and-drop dropzone — drag images directly onto the zone to upload without clicking. Clicking still opens the file picker. Drag-over state highlights the border. Multiple files supported in both flows.' },
    ],
  },
  {
    version: 'v4.14.3',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'chat', description: 'Email card SPAR parser now finds the last **Email:** section marker (followed by newline) rather than the first occurrence. Workspace context fields like **Email:** user@domain.com were being matched first, causing the entire workspace context and reasoning block to appear as the email body inside the card.' },
      { tag: 'fix', scope: 'canva', description: 'Post Renders format dropdown now shows all 15 built-in formats immediately using a static fallback list — no longer empty when the /posts/formats API is unavailable. Added /posts to Vite proxy so the API call also works in dev.' },
      { tag: 'fix', scope: 'canva', description: 'Design Samples upload resets the file input after each upload so users can select and upload new batches immediately without refreshing. Fixed upload URL to remove spurious /api/ prefix.' },
    ],
  },
  {
    version: 'v4.14.2',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'migrations', description: 'Added migration 0066_missing_tables.sql (registered in _journal.json) to create support_webhook_logs, post_formats, and post_renders tables. Migrations 0064 and 0065 were raw SQL files never added to the Drizzle journal — Drizzle silently skips files not in _journal.json so they never ran in production. The 0066 migration uses IF NOT EXISTS so it is safe to apply even if tables were created manually.' },
    ],
  },
  {
    version: 'v4.14.1',
    date: '2026-05-12',
    entries: [
      { tag: 'feat', scope: 'chat', description: 'Post-render engine events now appear in the chat activity panel: content generation, image gen (with cost), per-slide rendering, and render complete — each with a distinct icon and running/success/failed state.' },
      { tag: 'feat', scope: 'llm-usage', description: 'Image generation cost now recorded to llm_usage_logs via LlmUsageService.record() with costUsdOverride, so image spend appears in the LLM Usage page by model and agent alongside text LLM calls.' },
      { tag: 'feat', scope: 'llm-usage', description: 'UsageRecord now accepts costUsdOverride to bypass the token-based pricing table computation — needed for per-image pricing models.' },
    ],
  },
  {
    version: 'v4.14.0',
    date: '2026-05-12',
    entries: [
      { tag: 'feat', scope: 'settings', description: 'Image Generation settings rebuilt with provider sub-tabs (OpenAI / Stability AI / Gemini), model selector per provider with cost annotations, and a cost reference table. Settings definitions now carry options arrays for dropdown rendering.' },
      { tag: 'feat', scope: 'image-gen', description: 'ImageGenService now supports Stability AI (Stable Image Core, SDXL, Stable Image Ultra) as a provider. Provider cascade updated to: openai → stability → gemini. Each generation logs model name, provider, and estimated cost in USD to activity log.' },
      { tag: 'feat', scope: 'image-gen', description: 'Added configurable model selection: image_gen_openai_model (gpt-image-1, gpt-image-2, dall-e-3-hd, dall-e-3, dall-e-2) and image_gen_stability_model (stable-image-core, SDXL, stable-image-ultra) settings.' },
    ],
  },
  {
    version: 'v4.13.7',
    date: '2026-05-12',
    entries: [
      { tag: 'feat', scope: 'settings', description: 'Added Image Generation section to Settings page with two fields: stability_api_key (secret, for AI image backgrounds) and image_gen_provider (auto/openai/stability). Section appears between LLM and HR tabs.' },
      { tag: 'fix', scope: 'settings', description: 'stability_api_key and image_gen_provider were missing from SETTING_DEFINITIONS so they never appeared in Settings. Added with group: image and correct isSecret flags.' },
    ],
  },
  {
    version: 'v4.13.6',
    date: '2026-05-12',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'Post Format Engine now executes from chat: sending "Generate a linkedin-tips-carousel for brand taskip about ..." detects the pattern in decideChat, calls PostRendererService.render() directly, and returns slide URLs in the chat response. Previously the agent just returned a text layout description.' },
      { tag: 'fix', scope: 'post-render', description: 'Broke circular dependency between PostRenderModule and CanvaModule: PostBrandService now queries canvaBrands table directly via DbService instead of depending on CanvaBrandsService, allowing PostRenderModule to be imported into CanvaModule cleanly.' },
      { tag: 'fix', scope: 'canva', description: 'Setup tab Step 1 and Step 2 now show as checked when openai_api_key / stability_api_key are configured in Settings. Step descriptions updated: Stability AI doc added with platform.stability.ai → API Keys instructions and sk-... key format note.' },
      { tag: 'fix', scope: 'post-renders', description: 'Design Samples tab brand selector changed from a fixed dropdown (taskip/xgenious) to a free text input. Samples now load across all brands by default when brand field is empty.' },
    ],
  },
  {
    version: 'v4.13.5',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'inbox', description: 'Mark as opened now updates the row immediately via optimistic setQueryData patch, so the opened state reflects without waiting for a refetch. Invalidation also scoped to the active purpose filter key.' },
      { tag: 'fix', scope: 'chat', description: 'Spam score badge replaced with a color-coded pill: "Inbox · 100" in emerald, "Promotions · N" in amber, "Spam risk · N" in orange, "Blocked · N" in rose. Previous label "Spam: 100 — Inbox strong" was confusing.' },
    ],
  },
  {
    version: 'v4.13.4',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'chat', description: 'Plain text mode toggle in the Send Email dialog was visually broken: the thumb overflowed the right edge of the track when active. Fixed by adding overflow-hidden to the track element and correcting the ON translate from translate-x-4 (16px) to translate-x-[18px] (track 36px minus thumb 16px minus 2px right margin = 18px). Also reduced shadow to shadow-sm to avoid visual bleed.' },
    ],
  },
  {
    version: 'v4.13.3',
    date: '2026-05-12',
    entries: [
      { tag: 'feat', scope: 'post-renders', description: 'Added standalone Post Renders page at /post-renders with nav entry. Includes two tabs: Post Renders (generate form with format/brand/intent/topic inputs, renders list with slide thumbnails, approve/reject, PPTX/CSV/text download links) and Design Samples & Training (drag-and-drop upload zone, brand selector, upload DNA results with color swatches, learned patterns display, sample grid with hover overlay). The page is accessible directly from the sidebar without going through the Canva agent tab.' },
    ],
  },
  {
    version: 'v4.13.2',
    date: '2026-05-12',
    entries: [
      { tag: 'chore', scope: 'canva', description: 'Updated Canva agent task suggestions to surface Post Format Engine commands: LinkedIn carousels (tips, how-to, list), LinkedIn single cards (stat, quote), Instagram carousels and story formats, Twitter announcement, Facebook ad banner, and generic checklist. Legacy Canva MCP marketing suggestions trimmed to avoid duplication.' },
    ],
  },
  {
    version: 'v4.13.1',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'spam-checker', description: 'Frontend chat spam score was capped at 45 (SPAM_RISK) despite clean email content. Root cause: empty fromDomain passed by the frontend triggered DNS lookups for _dmarc. and reputation checks against an empty label, which failed and set a critical failure, capping rawScore at 45. Fix: checkAuthentication and checkReputation now return a neutral 100 score when fromDomain is empty, so domain-infrastructure checks are skipped for calls that only know the email content.' },
    ],
  },
  {
    version: 'v4.13.0',
    date: '2026-05-12',
    entries: [
      { tag: 'feat', scope: 'post-render', description: 'Post Format Engine: Canva-free self-hosted image generation pipeline using Satori (JSX to SVG) and @resvg/resvg-js (SVG to PNG). 15 built-in templates across LinkedIn, Instagram, Twitter, Facebook in carousel, single, and story formats. AI fills content slots dynamically via LLM using a structured schema with per-slot maxChars, constraints, and hints.' },
      { tag: 'feat', scope: 'post-render', description: 'ThemeContract consistency engine: derives a locked style object once per render session (colors, fonts, padding, accent bar, indicator position) and applies it uniformly to all slides. Structural consistency is guaranteed by construction rather than validated after the fact.' },
      { tag: 'feat', scope: 'post-render', description: 'Multi-provider image background generation: gpt-image-1 to dall-e-3 to gemini-2.0-flash-exp to dall-e-2 cascade with automatic fallback. Slides with backgroundType=ai-image trigger this pipeline; all others use flat hex color.' },
      { tag: 'feat', scope: 'post-render', description: 'Canva interoperability exports: PPTX (full layer-wise editing in Canva after import), Canva Bulk Create CSV, plain text slot export. All available via REST endpoints GET /posts/renders/:id/pptx, /canva-csv, /text-export.' },
      { tag: 'feat', scope: 'post-render', description: 'Design Sample Learning: upload 200+ design images, GPT-4V extracts Design DNA JSON (layout, colors, typography, mood keywords, platform fit), stored in existing knowledgeEntries table as entryType=design_sample, brand-scoped via siteKeys. After 20+ samples, a clustering pass produces design_pattern entries used as always-on context at render time.' },
      { tag: 'feat', scope: 'post-render', description: 'Post Renders tab added to Canva agent page: generate new renders from any format/brand/topic, view slide thumbnails, download PPTX/CSV/text exports, approve/reject status management. Design Samples sub-tab with image upload, DNA analysis progress, learned patterns display.' },
      { tag: 'feat', scope: 'post-render', description: 'Full activity logging for all render pipeline steps (post_render_start, post_theme_derived, post_content_start, post_content_end, post_image_gen_start/end/fallback, post_render_slide, post_render_slide_done, post_upload_done, post_consistency_check, design_sample_analyze, design_pattern_cluster). Real-time via WebSocket activity:log events.' },
      { tag: 'chore', scope: 'db', description: 'Migration 0065: post_formats and post_renders tables. post_formats stores static template registry; post_renders stores AI-generated content and slide URLs per render session.' },
    ],
  },
  {
    version: 'v4.12.15',
    date: '2026-05-12',
    entries: [
      { tag: 'feat', scope: 'taskip-internal', description: 'Six distinct email writing styles added to SPAR system, each with its own vocabulary, opener, sentence structure, and length range. A=CURIOUS (peer question, 40-55w), B=BLUNT (one observation + one question, 20-32w), C=EMPATHETIC (acknowledges friction, 55-70w), D=CHALLENGER (contrast with peer behavior, 45-60w), E=WARM (Hey opener, colleague-like, 45-60w), F=DIRECT (metric first, binary question, 30-45w). Style is selected per email based on angle-to-style mapping, cohort hard overrides, and batch rotation to prevent the same style repeating. Step 6 subject formulas are now style-keyed so subject and body always match in voice. Step 7 has per-style body rules replacing the single generic structure. Step 8 self-score now checks style consistency. Final output includes Style field.' },
    ],
  },
  {
    version: 'v4.12.14',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'spam-checker', description: 'Removed SPF DNS check from authentication category. SPF is an infrastructure concern handled by the sending provider (Gmail Workspace); the checker cannot know which provider will send at check time. Auth score now starts at 50/100 (implicit SPF trust) with DMARC and DKIM contributing the remaining 50. criticalFailure now only fires on missing DMARC, not missing SPF.' },
      { tag: 'fix', scope: 'taskip-internal', description: 'getFromDomain() now resolves the sender domain from the Gmail account (GmailService.getFromAddress) instead of the ses_default_from setting. Falls back to ses_default_from if Gmail is not configured. This ensures DMARC/DKIM checks in the spam scorer use the actual sending domain.' },
      { tag: 'fix', scope: 'taskip-internal', description: 'Email writing style updated to prioritize reply rate over observation framing. Step 6 subject formulas changed to direct personal questions ("do you [gap activity] outside Taskip?") and pattern interrupts ("no [gap thing] yet - intentional?"). Step 7 body structure tightened to under 60 words: open directly with the question anchored to their specific data, no preamble. Step 8 self-score reframed around "would I reply within 24 hours?" rather than passive open likelihood.' },
    ],
  },
  {
    version: 'v4.12.13',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'support', description: 'Webhook normalization: normalizeCrmPayload now handles the actual CRM payload format where the Laravel transformer class is a direct key of data (data["Modules\\\\SupportTicket\\\\..."] = {id, subject}) rather than nested under data.ticket. Added Format 3 detection: grab first value of data if it has an id field. Format 2 (data.ticket wrapper) and Format 1 (flat legacy) retained as fallbacks.' },
      { tag: 'fix', scope: 'support', description: 'writeWebhookLog now uses raw SQL INSERT instead of Drizzle schema reference so it works on environments where migration 0064 has not run. Error is still caught+logged but does not swallow silently — NestJS logger now shows the table-missing message clearly.' },
    ],
  },
  {
    version: 'v4.12.12',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'inbox', description: 'POST /taskip-internal/inbox/:id/mark-opened 500 — PostgresError: could not determine data type of parameter $1. jsonb_build_object receives bound parameters without type context; added ::text cast to the ISO timestamp parameter so PostgreSQL can resolve the type.' },
    ],
  },
  {
    version: 'v4.12.11',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'email', description: 'Removed "Reply STOP to unsubscribe" footer from 1:1 outreach emails. Research confirms appending this footer on personal Gmail sends signals bulk/marketing intent to Gmail classifier, increasing spam report rate. Reply-STOP detection in syncReplies() and the suppression gate remain active — only the appended footer is removed.' },
      { tag: 'fix', scope: 'spam-checker', description: 'Relaxed over-aggressive debt-collection content rules for 1:1 personal outreach: DEBT_ENSURE -15→-5 (low severity), DEBT_SPEED_UP -15→-8 (medium), DEBT_FOLLOWUP_HELP -15→-8 (medium). Research confirms "ensure you get" and "following up could help" are low-risk natural phrases; the original -15 deduction was based on bulk-email SpamAssassin heuristics.' },
    ],
  },
  {
    version: 'v4.12.10',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'chat', description: 'Frontend spam score was always showing ~45 regardless of email content because the POST /spam-checker/score call was missing isTransactional: true. The compliance category was always firing -40 (no List-Unsubscribe header) + -35 (no unsub link) + -25 (no address) = constant -100 penalty. These bulk-email rules do not apply to 1:1 personal outreach via Gmail. Score now reflects actual content quality.' },
    ],
  },
  {
    version: 'v4.12.9',
    date: '2026-05-12',
    entries: [
      { tag: 'feat', scope: 'activity', description: 'Spam check events now visible in the activity panel: spam_check_start shows "Spam check" with subject preview; spam_check_end shows grade/score and pass/fail; spam_rewrite_triggered shows an orange "Rewriting email" entry with the top spam issues. ShieldAlert/ShieldCheck/RotateCcw icons used.' },
      { tag: 'feat', scope: 'activity', description: 'Tool result entries now show a response_preview (first 500 chars of the API response JSON) so lookup_user results are visible directly in the activity panel — making it easy to see what email/data the Insight API returned.' },
      { tag: 'fix', scope: 'taskip-internal', description: 'lookup_user cross-references owner.email against Taskip DB. If the email is not found (e.g. contact@xgenious.com vs actual login xgenious51@gmail.com), a _email_warning is appended to the result telling the LLM not to use that address and to resolve via insight_get_lifecycle instead.' },
    ],
  },
  {
    version: 'v4.12.8',
    date: '2026-05-11',
    entries: [
      { tag: 'feat', scope: 'taskip-internal', description: 'Unsubscribe footer auto-appended to every outbound email: plain-text gets "Reply STOP to unsubscribe" appended; HTML emails get a styled footer line before the tracking pixel. send() gates on the email_suppressions table — suppressed recipients are rejected immediately with status failed/suppressed. Reply sync now detects STOP/unsubscribe signals in incoming replies and inserts the sender into email_suppressions automatically.' },
      { tag: 'fix', scope: 'taskip-internal', description: 'Renamed "payment_collection" angle to "invoice_followup" throughout the system prompt to remove semantic anchor that was pulling subject lines toward banned vocabulary. Both spam check calls (chat draft path and batch SPAR path) now pass isTransactional: true so bulk-email compliance rules (no unsub link, no address) do not penalise 1:1 personal outreach.' },
    ],
  },
  {
    version: 'v4.12.7',
    date: '2026-05-11',
    entries: [
      { tag: 'feat', scope: 'taskip-internal', description: 'Server-side spam auto-rewrite in chat mode: when the LLM returns a text draft in the notify_result path, extractEmailDraft() parses the subject and body, SpamCheckerService scores it, and if score < 60 (SPAM_RISK/BLOCK) the feedback is injected back into the conversation as a user message asking for a rewrite. Runs up to 2 revisions. Each spam check is logged as spam_check_start/spam_check_end events visible in the Activity panel.' },
      { tag: 'fix', scope: 'taskip-internal', description: 'Payment collection angle subjects: added concrete spam-safe subject formulas (e.g. "1 invoice open - heard back?", "did your client get the invoice?") and reinforced NEVER-use list for invoice/payment/reminder patterns that score below 60 in spam filters.' },
    ],
  },
  {
    version: 'v4.12.6',
    date: '2026-05-11',
    entries: [
      { tag: 'feat', scope: 'email', description: 'Dedicated EmailSanitizerService replaces non-ASCII characters (em dash, en dash, smart quotes, ellipsis, bullets, non-breaking spaces) with ASCII equivalents before any email is sent via Gmail (both IMAP/SMTP and OAuth raw MIME paths). Subject is sanitized once at the entry point of sendEmail() so all send paths are covered.' },
      { tag: 'fix', scope: 'tracking', description: 'Tracking pixel controller now uses raw SQL to update open counts — avoids PostgresError when migration 0063 columns (open_count, first_open_at, etc.) are absent on the deployment. Falls back to metadata JSONB on column error so opens are still recorded. InboxPage isOpened() now also checks metadata.pixelOpened for this fallback path.' },
      { tag: 'fix', scope: 'support', description: 'GET /support/webhook-logs returns empty array instead of 500 when the support_webhook_logs table does not exist (migration 0064 not yet on main branch).' },
      { tag: 'fix', scope: 'inbox', description: 'markOpened() now guards against undefined id to prevent UNDEFINED_VALUE postgres errors when the dispatcher path params fix is not yet deployed.' },
    ],
  },
  {
    version: 'v4.12.5',
    date: '2026-05-11',
    entries: [
      { tag: 'fix', scope: 'gmail', description: 'Non-ASCII characters in email subjects (em dash, smart quotes, etc.) were arriving garbled (Ã¢Â€Â" instead of —) when sent via Gmail OAuth API. Raw MIME headers now RFC 2047-encode subjects that contain non-ASCII bytes using =?UTF-8?B?...?= encoding, so all mail clients decode them correctly.' },
    ],
  },
  {
    version: 'v4.12.4',
    date: '2026-05-11',
    entries: [
      { tag: 'fix', scope: 'runtime', description: 'Agent route dispatcher was omitting request.params from the handler params object — every route with a path parameter (e.g. /inbox/:id, /inbox/:id/mark-opened) received undefined for those params, causing UNDEFINED_VALUE postgres errors. Fixed by spreading request.params first in the merge.' },
    ],
  },
  {
    version: 'v4.12.3',
    date: '2026-05-11',
    entries: [
      { tag: 'fix', scope: 'inbox', description: 'Remove open_count/first_open_at/last_open_at from listSent() SELECT — migration 0063 is on dev but not yet on main, so these columns do not exist in production. markOpened() also rewritten as raw SQL with a .catch() so the tracking pixel never 500s on missing columns. Both will resume full functionality once dev is merged to main.' },
    ],
  },
  {
    version: 'v4.12.2',
    date: '2026-05-11',
    entries: [
      { tag: 'fix', scope: 'debug-logs', description: 'Agent route logging: only record 4xx and 500 errors — successful 200 calls are no longer written to Debug Logs to avoid noise.' },
    ],
  },
  {
    version: 'v4.12.1',
    date: '2026-05-11',
    entries: [
      { tag: 'feat', scope: 'debug-logs', description: 'All agent API route calls (GET/POST/etc on /taskip-internal/*, /livechat/*, /support/*, and every other agent route) are now recorded in the Debug Logs page. Success calls log at 200 with duration. Errors log at 500 with the error message, stack trace, and request body. Auth failures (missing/invalid JWT, invalid webhook signature) also log at 401.' },
    ],
  },
  {
    version: 'v4.12.0',
    date: '2026-05-11',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'Transcript on close now fires for ALL sites consistently: (1) visitor-initiated close (widget close button) now also sends the transcript, matching operator-close behaviour. (2) maybeSendOnClose no longer force-bypasses transcriptEnabled — only sites with the flag enabled will send, preventing unsolicited emails for sites that have it turned off.' },
    ],
  },
  {
    version: 'v4.11.9',
    date: '2026-05-11',
    entries: [
      { tag: 'feat', scope: 'livechat', description: 'Setup step 5 for email reply-to-thread: shows the three required settings (Reply Domain, Reply HMAC Secret, Inbound Webhook Token) and the SNS inbound URL with a copy button. Visitors who reply to a transcript email now have that reply routed back into the live chat session once SES inbound is configured.' },
    ],
  },
  {
    version: 'v4.11.8',
    date: '2026-05-11',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'Transcript sender display name: emails now appear as "SiteName <livechat@domain>" instead of a bare email address. Display name is taken from site.botName, falling back to site.label, then "Support".' },
    ],
  },
  {
    version: 'v4.11.7',
    date: '2026-05-11',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'pageview 403 actual root cause: extractRequestOrigin fell back to the HTTP Referer header when Origin was absent. Server-side/prerender requests (e.g. from AWS IPs) have no Origin but do have Referer set to the navigation source (Google). This caused google.com to be compared against xgenious.com → ForbiddenException. Origin validation now uses ONLY the Origin header; if absent the check is skipped entirely.' },
    ],
  },
  {
    version: 'v4.11.6',
    date: '2026-05-11',
    entries: [
      { tag: 'fix', scope: 'tracking', description: 'trackOpen GIF pixel: res.setHeader is not a function — switched from Express-style res to FastifyReply (.header() + .send()). Tracking pixel now correctly returns a 1x1 transparent GIF.' },
      { tag: 'fix', scope: 'livechat', description: 'pageview 403 "Origin not allowed": two root causes fixed. (1) When site.origin is stored without https:// scheme, extractHostname() returns null — origin check is now skipped with a WARN log instead of throwing. (2) www. prefix stripped from both hostnames before comparison so www.example.com and example.com both pass.' },
    ],
  },
  {
    version: 'v4.11.5',
    date: '2026-05-11',
    entries: [
      { tag: 'fix', scope: 'support', description: 'Webhook payload parsing fixed for CRM nested format: ticket data was wrapped under payload.data.ticket["Modules\\\\SupportTicket\\\\Transformers\\\\SupportTicketResource"] (Laravel transformer key). normalizeCrmPayload() now unwraps both the nested CRM format and the legacy flat format. Contact email extracted from created_by.email.' },
      { tag: 'fix', scope: 'support', description: 'Agent-replied events (replied_by.type === "agent") are now logged as status skipped_agent_reply instead of triggering ticket ingest — prevents feedback loops when the agent posts a reply.' },
      { tag: 'fix', scope: 'support', description: 'writeWebhookLog no longer silently eats DB errors. Now logs at ERROR level with the full entry details so missing table migrations are immediately visible.' },
      { tag: 'feat', scope: 'support', description: 'New POST /support/webhook-test endpoint (JWT auth) + Test webhook panel in Webhooks tab: paste any CRM JSON payload and replay it through ingestWebhook to debug parsing without needing the CRM to resend.' },
    ],
  },
  {
    version: 'v4.11.4',
    date: '2026-05-11',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'Transcript "Domain contains illegal character" root cause fixed: buildReplyTo now trims livechat_reply_domain (removing trailing newlines/spaces from copy-paste) and validates the domain before building the address. If domain is invalid, Reply-To is dropped rather than passing a corrupt address to SES.' },
      { tag: 'fix', scope: 'ses', description: 'Pre-send validation added for replyTo and BCC addresses: domain extracted and checked against [a-zA-Z0-9.-] before the SES SDK call. Throws a descriptive error naming the specific field and value rather than relying on the generic "Domain contains illegal character" from SES.' },
      { tag: 'fix', scope: 'livechat', description: 'Transcript send failure log upgraded to ERROR and includes full context: session id, to, from, replyTo, BCC, and error message — so the problematic address is immediately visible in logs.' },
    ],
  },
  {
    version: 'v4.11.3',
    date: '2026-05-11',
    entries: [
      { tag: 'fix', scope: 'chat', description: 'Suggestion chips no longer shown constantly — only appear when the chat is empty (no messages and no typed input). Hidden once conversation starts.' },
      { tag: 'feat', scope: 'chat', description: 'Email draft card now shows live spam score: calls /spam-checker/score on render and displays grade + numeric score (color-coded) next to the SPAR self-score in the card footer. Only active for taskip_internal agent.' },
      { tag: 'feat', scope: 'taskip-internal', description: 'Spam check results now recorded in run activity log (event_type: spam_check_start / spam_check_end) with email count, per-recipient scores, failed count, revision number, and duration. Visible in the Activity panel.' },
    ],
  },
  {
    version: 'v4.11.2',
    date: '2026-05-11',
    entries: [
      { tag: 'feat', scope: 'taskip-internal', description: 'Chat mode batch_send_email: no Telegram notifications when source=chat. All progress messages (start, per-email, summary) are suppressed. Telegram approval step skipped entirely — batch executes immediately from chat. Spam score (score + grade) stored in email metadata and surfaced in InboxPage as a badge per email row and in the detail panel header.' },
      { tag: 'feat', scope: 'inbox', description: 'Spam score badge on email rows and detail panel: shows grade (Inbox/Promo/Spam risk/Blocked) + numeric score, color-coded. Populated from email metadata.spamScore/spamGrade written at send time.' },
      { tag: 'feat', scope: 'inbox', description: 'Chat AI response for batch_send_email now shows sent count + per-email spam scores inline instead of "Approve via Telegram" prompt.' },
    ],
  },
  {
    version: 'v4.11.1',
    date: '2026-05-11',
    entries: [
      { tag: 'feat', scope: 'taskip-internal', description: 'Pre-send spam gate in decide(): every batch_send_email call now scores all emails via SpamCheckerService before proposing for Telegram approval. Emails scoring below 60 (SPAM_RISK/BLOCK) feed back top issues to the LLM as a tool result so it revises — up to 2 revision attempts. Only clean drafts (score ≥60) surface as ProposedAction. Spam scores included in the Telegram approval summary (e.g. INBOX_LIKELY(82)).' },
    ],
  },
  {
    version: 'v4.11.0',
    date: '2026-05-11',
    entries: [
      { tag: 'feat', scope: 'spam-checker', description: 'Full SRS v1.0 spam-risk scoring engine (Phase 1 MVP). 7-category weighted scoring: Authentication (SPF/DKIM/DMARC DNS, weight 25), Reputation (Spamhaus DBL + Barracuda DNSBL, weight 25), List Hygiene (MX lookup + role/disposable detection, weight 15), Content (46 rule-based checks across phishing-mimic / debt-collection / urgency / TGTBT / financial / clickbait categories, weight 20), Technical (URL shorteners / link density / image ratio / subject length / non-ASCII, weight 10), Compliance (List-Unsubscribe header + body link + postal address, weight 5). Returns score 0-100, grade (INBOX_STRONG / INBOX_LIKELY / PROMOTIONS_RISK / SPAM_RISK / BLOCK), per-category breakdown, criticalFailures[], suggestedFix per issue. Critical-failure cap: Spamhaus hit caps at 30 (BLOCK), missing SPF+DMARC caps at 45 (SPAM_RISK).' },
      { tag: 'feat', scope: 'spam-checker', description: 'REST endpoints: POST /spam-checker/score (full pre-send analysis) + GET /spam-checker/audit/domain?domain= (SPF/DKIM/DMARC + blocklist audit for a domain alone). All DNS lookups run in parallel with 3s timeout and 5-min in-memory cache (p95 < 400ms warm).' },
      { tag: 'feat', scope: 'ses', description: 'SES sendEmail now calls SpamCheckerService.score() (async, full engine) before every send. CRITICAL failures logged at ERROR level, SPAM_RISK/BLOCK at WARN, clean sends at DEBUG. Subject is auto-sanitized (non-ASCII stripped) in all cases.' },
      { tag: 'chore', scope: 'ses', description: 'Removed EmailSpamCheckerService (basic phrase-list only). Replaced by SpamCheckerModule which SesModule now imports.' },
    ],
  },
  {
    version: 'v4.10.0',
    date: '2026-05-11',
    entries: [
      { tag: 'feat', scope: 'inbox', description: 'Mark as opened button: when an email shows "Not opened yet" (e.g. landed in spam — pixel blocked by Gmail), click "Mark as opened" to manually record an open event. Increments open_count, sets first_open_at/last_open_at. New POST /taskip-internal/inbox/:id/mark-opened endpoint.' },
    ],
  },
  {
    version: 'v4.9.9',
    date: '2026-05-11',
    entries: [
      { tag: 'feat', scope: 'ses', description: 'New EmailSpamCheckerService: scores email subject + body against spam phrase lists, auto-sanitizes non-ASCII characters in subject (em dash, smart quotes, ellipsis) to plain ASCII before SES send, and logs blockers/warnings. Prevents encoding-corrupted subjects and spam-trigger phrases from reaching inboxes.' },
      { tag: 'fix', scope: 'taskip-internal', description: 'SPAR Step 5 angle priority reordered — payment_collection is now last resort (priority 8), only fires when no other behavioral signal qualifies. Re-engagement, friction, billing gap, pipeline gap all take precedence. Prevents all workspaces with invoices_paid=0 from receiving identical payment-angle emails.' },
      { tag: 'fix', scope: 'taskip-internal', description: 'SPAR Step 3 angle diversity enforced: if prior email used payment_collection angle, it is eliminated from Step 5 candidates entirely. Angle diversity rule added — different workspaces in same batch must receive different angles based on their specific strongest signal.' },
      { tag: 'fix', scope: 'taskip-internal', description: 'SPAR Step 1 signal ranking now requires listing 2-3 candidates before deciding; invoice-only signals are explicitly marked weak when other activity signals are present.' },
      { tag: 'fix', scope: 'taskip-internal', description: 'SPAR Step 7 banned phrases expanded: "get what you\'re owed", "ensure you get", "following up could help", "speed up the process", "outstanding invoice" added to body ban list. Subject ban list added: "invoice out", "invoice overdue", "payment due", "unpaid", "outstanding", "reminder". Subject must use plain ASCII only.' },
    ],
  },
  {
    version: 'v4.9.8',
    date: '2026-05-11',
    entries: [
      { tag: 'feat', scope: 'taskip-internal', description: 'User type badge [PAID]/[TRIAL]/[FREE] now prepended to every workspace in single-detail responses and numbered lists, derived from cohort name. Makes plan tier instantly visible without reading the cohort field.' },
    ],
  },
  {
    version: 'v4.9.7',
    date: '2026-05-11',
    entries: [
      { tag: 'fix', scope: 'ses', description: 'SES sendEmail now logs a DEBUG line before calling the SDK (to/from/replyTo/bcc/subject) and an ERROR line on SDK failure with the exact address fields — making "Domain contains illegal character" diagnosable from server logs.' },
    ],
  },
  {
    version: 'v4.9.6',
    date: '2026-05-11',
    entries: [
      { tag: 'fix', scope: 'taskip-internal', description: 'Code-level DETAIL LOOKUP detection in buildContinuationHint(): "share details about 1", "tell me about 2", "what about 5", bare "1" all now inject a DETAIL LOOKUP MODE hint that calls lookup_user(name) then insight_get_lifecycle — never re-running insight_list_cohort.' },
      { tag: 'fix', scope: 'taskip-internal', description: 'Chat-mode responses no longer sent to Telegram. source:"chat" is now threaded from trigger payload through snapshot → decide() → execute(), matching the HR agent pattern.' },
    ],
  },
  {
    version: 'v4.9.5',
    date: '2026-05-11',
    entries: [
      { tag: 'fix', scope: 'taskip-internal', description: 'DETAIL LOOKUP intent: "share details about 1" / "tell me about 2" now correctly resolves the number as a list position from the prior shown list — not a fresh cohort query. READ intent now explicitly guards against re-running insight_list_cohort when a numbered list is already in context.' },
    ],
  },
  {
    version: 'v4.9.4',
    date: '2026-05-11',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'Transcript email now validates the from address domain before calling the SES SDK, surfacing a clear error instead of "Domain contains illegal character" from AWS. Check Settings → Email (SES) if from address is misconfigured.' },
      { tag: 'feat', scope: 'livechat', description: 'Transcript is now always sent on chat close (force: true) — visitor just needs an email on file and at least one message. The per-site transcriptEnabled toggle is no longer required; it remains as an override only.' },
    ],
  },
  {
    version: 'v4.9.3',
    date: '2026-05-11',
    entries: [
      { tag: 'fix', scope: 'taskip-internal', description: 'Auto-resolve numeric workspace_uuid to real UUID before any insight tool call: if the LLM passes a list position (e.g. "4") instead of a UUID, the runtime now scans prior cohort list tool results and substitutes the correct uuid field automatically.' },
    ],
  },
  {
    version: 'v4.9.2',
    date: '2026-05-11',
    entries: [
      { tag: 'fix', scope: 'taskip-internal', description: 'SELECTION intent now correctly maps list position numbers to workspace UUIDs from prior insight_list_cohort results instead of passing numeric positions as workspace_uuid. UUID error message strengthened to halt LLM retry loops.' },
    ],
  },
  {
    version: 'v4.9.1',
    date: '2026-05-11',
    entries: [
      { tag: 'feat', scope: 'auth', description: 'Login page shows default credentials (admin@cortex.local / changeme123) with a one-click "Use" fill button when running on localhost or 127.0.0.1. Hidden in production.' },
    ],
  },
  {
    version: 'v4.9.0',
    date: '2026-05-11',
    entries: [
      { tag: 'feat', scope: 'support', description: 'Webhooks tab added to the Support agent detail page (/agents/support). Shows all incoming CRM webhook events (status, ticket ID, timestamp, raw payload) with expandable rows — same data as the chat page webhook tab but accessible directly from the agent page.' },
    ],
  },
  {
    version: 'v4.8.9',
    date: '2026-05-11',
    entries: [
      { tag: 'fix', scope: 'inbox', description: 'Inbox layout rebuilt: email list always visible on left, AI drawer is now a proper flex sidebar (width-animated 0→420px) instead of an absolute overlay — eliminates all overflow-hidden clipping issues, close button always works, drawer only opens when "Draft reply with AI" is clicked.' },
    ],
  },
  {
    version: 'v4.8.8',
    date: '2026-05-10',
    entries: [
      { tag: 'fix', scope: 'inbox', description: 'AI drawer close button fix: moved overflow-hidden to outer container, added pointer-events-none when drawer is closed.' },
    ],
  },
  {
    version: 'v4.8.7',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'agent', description: 'lookup_user unified search: now accepts uuid, url (slug/subdomain/custom domain), email, or name — passes directly to Insight /search endpoint. Name search returns a candidate list; exact lookups return full stats + activity_by_day.' },
      { tag: 'feat', scope: 'agent', description: 'New trial funnel tools: insight_trial_funnel_hot (THS-sorted trials), insight_trial_funnel_at_risk (stalled day 5+), insight_trial_funnel_trial_ready (free TRS>=50), insight_trial_funnel_stats (conversion ratio summary).' },
      { tag: 'feat', scope: 'agent', description: 'System prompt updated: 4-band score tier model (Cold/Warming/Active/Hot, 0-25/26-50/51-75/76-100), delta_14d momentum guidance, lifecycle_state field awareness, THS day-caps.' },
      { tag: 'chore', scope: 'api', description: 'InsightCohortListItem gains lifecycle_state field. InsightSearchResult, InsightSearchExactResult, InsightSearchNameResult types added. insight.search() replaces searchByEmail() as canonical method.' },
    ],
  },
  {
    version: 'v4.8.6',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'support', description: 'Webhook Logs tab in Support Ticket Manager chat page. Shows all incoming CRM webhook events with status (ok / duplicate / error), CRM ticket ID, internal ID, timestamp, and expandable raw payload viewer.' },
      { tag: 'feat', scope: 'api', description: 'support_webhook_logs table (migration 0064). ingestWebhook now writes a row for every event — success, duplicate, and error cases. GET /support/webhook-logs endpoint (auth required, limit 100).' },
    ],
  },
  {
    version: 'v4.8.5',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'inbox', description: 'AI draft drawer now instructs the agent to call insight_get_lifecycle with the workspace UUID before drafting — so the email is based on live engagement stats, not cached inbox data.' },
    ],
  },
  {
    version: 'v4.8.4',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'inbox', description: 'Draft reply with AI: clicking the button opens an in-page right-side drawer with a live AI chat (taskip_internal agent). Pre-seeds the context from the selected email and auto-sends the initial draft query. No navigation away from the inbox.' },
      { tag: 'feat', scope: 'inbox', description: 'Reply loading skeleton: replaced "Loading replies..." text with two animated skeleton reply cards while replies are fetching.' },
      { tag: 'feat', scope: 'inbox', description: 'AI thinking skeleton: while the agent is processing, the drawer shows animated skeleton lines instead of a plain loading indicator.' },
    ],
  },
  {
    version: 'v4.8.3',
    date: '2026-05-10',
    entries: [
      { tag: 'fix', scope: 'agent', description: 'Insight API 404 fix: executeReadTool now validates workspace_uuid is a UUID string before calling the API — returns a clear error if a numeric id is passed, preventing /workspaces/1/lifecycle 404s. Tool descriptions updated to explicitly name the `uuid` field from insight_list_cohort results.' },
    ],
  },
  {
    version: 'v4.8.2',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'agent', description: 'Batch send gap: 100–300s random delay between consecutive emails in a batch to avoid bulk-send patterns and improve deliverability. Telegram notifies before each wait with the countdown.' },
    ],
  },
  {
    version: 'v4.8.1',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'agent', description: 'Dry-run mode: say "show me first" / "dry run" / "preview" — agent runs the full SPAR workflow per workspace and outputs all drafts as formatted text without calling batch_send_email. Reply "send them" or a number selection to dispatch.' },
      { tag: 'feat', scope: 'agent', description: 'Tone presets: append a tone modifier to any message — "aggressive", "soft", "ultra-brief", "warm". Overrides SPAR Step 4 cohort calibration for all emails in that batch.' },
      { tag: 'feat', scope: 'agent', description: 'Dedup pre-filter: workspace list now shows "[contacted Xd ago]" and "[replied — engaged]" annotations. Agent checks insight_recent_messages in parallel while listing, but still includes all workspaces — user decides whether to include flagged ones.' },
      { tag: 'feat', scope: 'agent', description: 'Reply-aware skip in batch: before generating each email, checks list_sent_emails for replyCount > 0. Workspaces with active replies are skipped automatically (they are already engaged).' },
      { tag: 'feat', scope: 'agent', description: 'Partial batch recovery: when a batch has failures, Telegram summary lists each failed recipient with error. Say "retry failed" or "retry" to re-process only the failed ones — CONTINUATION MODE targets them specifically.' },
    ],
  },
  {
    version: 'v4.8.0',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'agent', description: 'Continuation intent detection: when the prior agent message asked for confirmation and the user replies with "yes/go/proceed", the agent now injects a CONTINUATION MODE directive into the system prompt — bypassing re-read and re-listing entirely, executing the queued action immediately.' },
      { tag: 'feat', scope: 'agent', description: 'Selection intent: when the user sends numbers like "2,4,5,6,7", the agent maps them back to the workspace names from the prior numbered list and processes only those workspaces through SPAR.' },
      { tag: 'feat', scope: 'agent', description: 'batch_send_email action: new approval-gated action type that holds an array of SPAR-generated email drafts. Single Telegram approval sends the whole batch. Each email is individually tracked in the Inbox.' },
      { tag: 'feat', scope: 'agent', description: 'Workspace list format standardised: agent now numbers lists as "1. Name — Score: N" and ends with reply instructions, making number-selection parsing reliable.' },
      { tag: 'feat', scope: 'agent', description: 'MAX_TOOL_ITERATIONS raised from 14 to 25 to support multi-workspace batch processing (7 workspaces × ~3 tool calls each).' },
      { tag: 'feat', scope: 'chat', description: 'Batch email action shown in chat as a preview list of all recipients + subjects with Telegram approval reminder.' },
    ],
  },
  {
    version: 'v4.7.2',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'inbox', description: 'Inline reply composer in the email detail panel: Reply button expands a compose area pre-filled with recipient and Re: subject. Auto-resizing textarea, word count, Send reply button. Collapses and resets when switching emails.' },
      { tag: 'feat', scope: 'inbox', description: 'Plain text mode toggle in the inline reply composer. When enabled: no HTML wrapper, no tracking pixel — raw plain text email for maximum deliverability. Status strip shows the mode clearly.' },
      { tag: 'feat', scope: 'chat', description: 'Plain text mode toggle in the Send Email modal (taskip_internal agent only). Same deliverability behaviour — bypasses buildHtmlEmail when enabled.' },
      { tag: 'feat', scope: 'api', description: 'SendTrackedEmailInput accepts plainText flag. When true: skips HTML generation and tracking pixel entirely, sends raw plain text via Gmail.' },
    ],
  },
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
