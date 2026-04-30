# Live Chat Module — Progress Tracker

**Goal:** Self-hosted AI live chat for bytesed.com, xgenious.com, taskip.net. Replaces Crisp dependency. Visitor tracking (page history, browser, OS, country, IP) + admin inbox with operator takeover.

**Status legend:** `TODO` · `IN PROGRESS` · `BLOCKED` · `IN REVIEW` · `DONE`

**Owner:** Sharifur
**Started:** 2026-04-30
**Target ship (bytesed.com live):** Sprint 3 close, ~2 weeks from start

---

## Decisions locked

- GeoIP: **MaxMind GeoLite2** (offline `.mmdb`, free, refresh quarterly)
- No Telegram approval gate for live chat — admin inbox is the only human channel
- One agent key `livechat`, per-site overrides on `livechat_sites`
- Self-critique retry budget: 1 retry, then "needs human" fallback
- Widget: vanilla TS, Shadow DOM, Vite multi-entry → `apps/api/public/livechat.js`, served by Fastify static
- **Socket.io** (not SSE) for server → visitor delivery — SSE was already attempted in this stack and broke through the Coolify proxy (see comment in `apps/api/src/main.ts` around the IoAdapter setup). Mirror the existing `RealtimeGateway` pattern with a new `/livechat` namespace.
- Synchronous agent path (no BullMQ for the happy path) — keeps reply latency tight
- Visitor identity: `localStorage` UUID; email captured lazily after first agent reply
- Default widget styling: neutral charcoal/white (per-site branding deferred to Phase 2)

## Open questions

_(none — plan is locked. Add new ones here as they come up during implementation.)_

---

## Sprint 1 — Foundations (4 days)

| ID | Title | Status | Est | Notes |
|----|-------|--------|-----|-------|
| LC-01 | Schema + migration `0027_livechat.sql` | DONE | 0.5d | Migration `0027_livechat.sql` + `schema.ts` + re-export wired. Five tables + indexes + agent seed row. (Migration number is 0027, not 0013 — latest existing was 0026.) |
| LC-02 | Module scaffold + DI wiring | DONE | 0.5d | `LivechatModule`, `LivechatService`, `LivechatAgent` (IAgent stub) registered in `app.module.ts`. Agent self-registers in `onModuleInit`. |
| LC-03 | GeoIP integration (MaxMind GeoLite2) | DONE | 1d | `apps/api/src/common/visitor-enrichment/` with `GeoIpService`, `UaParserService`, `EnrichmentService`. Global module. `.mmdb` placement documented in `apps/api/data/README.md`; gitignored. Falls back to nulls if file missing (warn log). |
| LC-04 | Sites CRUD endpoints | DONE | 0.5d | `GET/POST/PATCH/DELETE /agents/livechat/sites[/:id]` JWT-guarded. Origin normalization, key validation. Mutations refresh `LivechatOriginCache`. |
| LC-05 | Public visitor endpoints + CORS allow-list | DONE | 1d | `/livechat/track/pageview`, `/livechat/track/leave`, `/livechat/identify`, `/livechat/message` (echo). Per-request origin gate via `resolveSiteForRequest`. Bot pageviews dropped unless site `track_bots=true`. `LivechatOriginCache` consulted in global CORS callback at `main.ts`. |
| LC-06 | Socket.io `/livechat-ws` gateway + room fan-out | DONE | 0.5d | `LivechatGateway` (path `/livechat-ws`, auto-attached via `IoAdapter`). Visitors connect with `{ siteKey, visitorId, sessionId }` + Origin header check; operators connect with JWT `operatorToken`. `LivechatStreamService.publish(sessionId, event)` emits to room `livechat:session:<id>`. Echo path in `/livechat/message` already publishes through it. |

**Sprint 1 demo:** curl + a tiny socket.io client — create site, track a pageview, connect socket, POST a message, see the echo reply emit on the visitor's socket, see visitor row enriched with country/browser.

**Sprint 1 exit criteria:**
- [x] Migration applies cleanly (drizzle journal updated to idx 27)
- [x] App boots with `livechat` agent registered (verified via tsc; runtime check pending boot)
- [x] curl can CRUD sites at `/agents/livechat/sites` (JWT-guarded)
- [x] curl from allowed origin tracks a pageview / sends a message; disallowed origin returns 403
- [x] socket.io clients connect to `/livechat-ws`, join a session room, receive `livechat:event` payloads on echo

**Manual smoke test (after pulling MaxMind .mmdb + rebooting API):**
```sh
# 1. CRUD a site
curl -X POST http://localhost:3000/agents/livechat/sites \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"key":"bytesed","label":"Bytesed","origin":"https://bytesed.com"}'

# 2. Track a pageview (must include matching Origin)
curl -X POST http://localhost:3000/livechat/track/pageview \
  -H "Origin: https://bytesed.com" -H "Content-Type: application/json" \
  -d '{"siteKey":"bytesed","visitorId":"v_test_1","url":"https://bytesed.com/pricing","title":"Pricing"}'

# 3. Send a message (returns sessionId; echo agent reply included)
curl -X POST http://localhost:3000/livechat/message \
  -H "Origin: https://bytesed.com" -H "Content-Type: application/json" \
  -d '{"siteKey":"bytesed","visitorId":"v_test_1","content":"hi"}'

# 4. Verify enrichment
psql -c "SELECT visitor_id, ip_country, browser_name, os_name, total_pageviews, total_messages FROM livechat_visitors WHERE visitor_id='v_test_1';"
```

---

## Sprint 2 — AI replies + admin inbox (5 days)

| ID | Title | Status | Est | Notes |
|----|-------|--------|-----|-------|
| LC-07 | Visitor → Contact bridge + session linking | TODO | 0.5d | `upsertContactForLivechat` mirroring `crisp.service.ts:439`. Counters increment. |
| LC-08 | Real agent: KB pipeline + self-critique | TODO | 1.5d | Adapt `crisp/agent.ts`. Context includes pageviews, current page, visitor location/browser. 1 retry on critique fail → `needs_human` fallback. |
| LC-09 | Admin endpoints: inbox, takeover, operator reply | TODO | 1d | `GET/POST` on `/agents/livechat/sessions[/:id]/{takeover,release,message,close}` + `/visitors/:id[/pageviews]`. Agent short-circuits on `human_taken_over` / `needs_human`. |
| LC-10 | Admin nav + LiveChatPage shell + Sites tab | TODO | 0.5d | New page, route `/livechat`, nav between Agents and Knowledge. Sites tab fully functional. |
| LC-11 | Conversations tab: inbox + transcript + composer + visitor card + page journey | TODO | 1.5d | InboxList, Transcript, Composer (Take over / Release), VisitorCard (country flag, browser, IP click-to-reveal, local time), PageJourney (live "Currently on" pill via SSE). |

**Sprint 2 demo:** Stub HTML page calls public endpoints; admin inbox shows live conversation; operator takes over, replies, releases.

**Sprint 2 exit criteria:**
- [ ] Visitor message produces KB-aware AI reply within ~5s
- [ ] Reply references current page when relevant (e.g. /pricing)
- [ ] Self-critique retry + `needs_human` fallback fire correctly on blocklist hits
- [ ] Operator can list, open, take over, reply, release sessions from admin UI
- [ ] Visitor card shows country, browser, OS, language, lifetime counters
- [ ] Page journey timeline updates live as visitor navigates

---

## Sprint 3 — Widget, tracking, polish, deployment (5 days)

| ID | Title | Status | Est | Notes |
|----|-------|--------|-----|-------|
| LC-12 | Widget bundle build pipeline | DONE | 1d | `apps/web/vite.widget.config.ts` builds IIFE → `apps/api/public/livechat.js`. **18.1 kB gzipped** (target was 12-18kb — at upper bound, dominated by socket.io-client). `LivechatScriptController` serves at `GET /livechat.js` with `Cache-Control: public, max-age=300` and CORS `*`. New script: `npm --workspace=apps/web run build:widget`. `publicDir: false` prevents `apps/web/public/` from leaking into the bundle output. |
| LC-13 | Widget UI: bubble + panel + send/receive | DONE | 1.5d | `apps/web/widget/ui.ts` — Shadow DOM root, blue bubble button, slide-in panel, message list with right-side blue / left-side white bubbles, typing indicator, lazy email capture after first agent reply, honeypot field for bots, 30/min visitor-side rate limit (localStorage). socket.io-client connects after first message and persists session in `localStorage` so the conversation resumes on reload. |
| LC-14 | Widget tracker: pageviews, SPA hooks, beacon | DONE | 1d | `apps/web/widget/tracker.ts` — `history.pushState`/`replaceState` patched with 300ms debounce, `popstate` listener, `pagehide` → `navigator.sendBeacon('/livechat/track/leave')` with the open pageview ID. Tracker fires before UI mounts so visits without chat still register. |
| LC-15 | Setup tab + per-site script snippets | DONE | 0.5d | Already covered in LC-10/11. Per-site copy snippet `<script src="${apiBase}/livechat.js" data-site="${key}" defer></script>`, manual test checklist (6 steps), troubleshooting guide. |
| LC-16 | Bot filtering + rate limits + IP privacy | DONE | 0.5d | Bot filtering was in LC-05 (`device_type='bot'` rows skipped unless `livechat_sites.track_bots=true`). New `LivechatRateLimitService` with per-`LIVECHAT_REDIS` provider — 60/min on `/livechat/track/pageview`, 30/min on `/livechat/message`, both keyed by `${siteKey}:${visitorId}`. Fail-open if Redis is unreachable. IP masked in UI by default (`Eye`/`EyeOff` toggle on the visitor card). |
| LC-17 | Per-site configurable widget instance | DONE | 1d | **Reframed from rollout to configurability.** Migration `0028_livechat_site_config.sql` adds `bot_name`, `bot_subtitle`, `welcome_message`, `brand_color`, `position`, `llm_provider`, `llm_model` to `livechat_sites`. Public `GET /livechat/config?siteKey=X` returns the runtime widget config (origin-gated). Widget fetches it on bootstrap and applies via CSS custom properties (`--lc-brand`, position class). Agent reads per-site LLM provider/model overrides on top of `agentLlmOpts`. Admin form gains three sub-tabs (Identity / Persona / Advanced) with color picker + position dropdown + LLM override. One bundle (`livechat.js`) serves all sites — config switch happens at runtime by `data-site` key. |
| LC-18 | Production rollout (operator action) | TODO | 0.5d | Coolify deploy + add `livechat_sites` rows for each property + paste snippet in each site's footer. Runbook below. Cannot be automated from the codebase. |

**Sprint 3 demo:** Live on bytesed.com. Rolling out to xgenious.com + taskip.net is then ~5 minutes each (add row, paste snippet).

### LC-27 runbook — email-to-thread (AWS setup)

This is the AWS-side configuration that pairs with the code in LC-27. Without it the transcript emails still go out, but visitor replies will land in your inbox unrouted.

**Prerequisites:** SES is in production mode (out of sandbox), AWS SES inbound is enabled in your region, you control DNS for the reply subdomain.

```sh
# 1. Pick a subdomain you'll use as the reply address.
#    e.g. reply.taskip.net (must be a subdomain you control, NOT a domain you send from).

# 2. Add MX records pointing the subdomain at SES inbound for your region.
#    For us-east-1:  reply.taskip.net.  MX  10  inbound-smtp.us-east-1.amazonaws.com.
#    For ap-south-1: reply.taskip.net.  MX  10  inbound-smtp.ap-south-1.amazonaws.com.
#    Replace the region to match SES configuration in cortex-os Settings.

# 3. Verify the domain in SES → Verified identities → Create identity → Domain.
#    (You only need DKIM verification for sending; for receiving, the MX is enough.)

# 4. Create an SNS topic that the Receipt Rule will publish to:
#    SNS → Topics → Create topic → Standard → name: cortex-livechat-inbound

# 5. Generate two random secrets, paste them into cortex-os
#    (Settings → Integrations → Email (SES)):
#       livechat_reply_domain    = reply.taskip.net   (the subdomain from step 1)
#       livechat_reply_secret    = <32+ char random>  (HMAC key for reply tokens)
#       livechat_inbound_token   = <32+ char random>  (URL query token)

# 6. Subscribe the inbound webhook to the SNS topic:
#    SNS → your topic → Create subscription
#       Protocol: HTTPS
#       Endpoint: https://api.<your-domain>/livechat/inbound?t=<livechat_inbound_token>
#    The first POST will be a SubscriptionConfirmation with a SubscribeURL —
#    cortex auto-confirms it (controller logs "SNS livechat-inbound subscription confirmed").

# 7. Create the SES Receipt Rule:
#    SES → Email receiving → Rule sets → (default rule set) → Create rule
#       Recipients: reply.taskip.net   (or transcript@reply.taskip.net for stricter scoping)
#       Action 1: Publish to Amazon SNS topic
#         - Topic: cortex-livechat-inbound
#         - Encoding: UTF-8
#         - Message format: SES (will include parsed mail.commonHeaders + raw content)
#       Action 2 (optional): Add header X-Cortex-Source: livechat
#       Then activate the rule set.

# 8. Smoke test:
#    a. Open admin → Live Chat → enable transcript on a site, set visitor email, close a session.
#    b. Visitor receives transcript with Reply-To: transcript+<sessionId>.<token>@reply.taskip.net
#    c. Visitor hits Reply, types "thanks", hits Send.
#    d. SES receives → SNS → cortex /livechat/inbound endpoint.
#    e. Watch API logs for: "Inbound accepted for session XXXXXXXX (accepted)"
#    f. Open admin Conversations → the closed session reopens, the email body is
#       now a visitor message, agent has replied.

# Anti-spoofing built in:
#   - HMAC token in the To address (only cortex can mint valid reply addresses)
#   - Sender email must match livechat_sessions.visitor_email (rejects forwarded replies from third parties)
#   - URL token (?t=) on the webhook (rejects calls not from your SNS)
#   - SNS SubscribeURL must come from sns.<region>.amazonaws.com (rejects spoofed handshake attempts)
#
# Quoted-reply / signature stripping:
#   - "On X, Y wrote:" Gmail-style quote markers
#   - "From: ... Sent: ... To: ..." Outlook quote headers
#   - "------ Original Message ------"
#   - "Sent from my iPhone/iPad/Android/Outlook"
#   - "------ Forwarded message ------"
#   - Any line starting with > (quoted reply lines)
#
# What can break:
#   - Visitor replies from a different email than the session's visitor_email → rejected as sender_mismatch
#   - Visitor replies after 24h+ (transcript URLs expired) → still works, only attachment images go stale; reply itself routes fine
#   - Visitor's email client mangles the In-Reply-To header → token in the To address still works; both paths are checked
```

### LC-18 runbook — production rollout (multi-site)

```sh
# 1. Build the widget locally and commit the bundle (no separate widget deploy step)
cd apps/web && npm run build:widget
git add apps/api/public/livechat.js && git commit -m "chore(livechat): rebuild widget bundle"

# 2. Push; Coolify auto-deploys the API. The migration 0027_livechat.sql runs on boot
#    (RUN_MIGRATIONS_ON_BOOT defaults to true). Confirm in Coolify logs:
#       [bootstrap] migrations up-to-date
#       Registered agent: livechat
#       GeoLite2-City.mmdb loaded from /app/apps/api/data/GeoLite2-City.mmdb

# 3. Drop GeoLite2-City.mmdb into the API container's persistent volume at apps/api/data/
#    (see apps/api/data/README.md). One-time setup; survives redeploys.

# 4. Sign in to cortex-os → Live Chat → Sites → New site for EACH property:
#    Identity tab:   key, label, origin, enabled
#    Persona tab:    bot name, subtitle, welcome message, product context,
#                    reply tone, brand color, position
#    Advanced tab:   per-site LLM provider/model (optional)
#
#    Example: Bytesed → key=bytesed, brand=#1d4ed8, welcome="Hi! I'm Bytes —
#             ask me anything about our SaaS templates."
#    Example: Xgenious → key=xgenious, brand=#9333ea, welcome="Hey there!
#             Looking to hire devs? I can route you to the right team."
#    Example: Taskip → key=taskip, brand=#0891b2, welcome="Welcome to Taskip
#             — happy to walk you through plans, integrations, or onboarding."

# 5. Live Chat → Setup → copy the per-site snippet. Paste it just before </body>
#    on each site. The same livechat.js bundle is loaded by all sites; its
#    runtime appearance + persona switches based on the data-site key.

# 6. Smoke test (~3 minutes):
#    a. Open https://bytesed.com in incognito → bubble appears bottom-right
#    b. Click bubble, send "hi" → AI replies within ~5s
#    c. Admin → Live Chat → Conversations → session shows up with country flag + browser
#    d. Click "Take over" → status flips to taken_over, composer enables
#    e. Type "this is the operator" → visitor sees the reply land in real time
#    f. Click "Release to AI" → send another visitor message → AI resumes

# 7. socket.io path is /livechat-ws (mirrors RealtimeGateway's /ws). If Coolify proxies
#    websockets correctly for /ws today, /livechat-ws works the same. Confirm in browser
#    devtools → Network → WS that the upgrade succeeds (status 101).
#    If it fails, fall back to long-poll by setting transports: ['polling'] in
#    apps/web/widget/socket.ts and rebuilding the widget.

# 8. Rolling out to xgenious.com + taskip.net is the same process (5 min each):
#    add a site row with the right origin, paste the snippet from the Setup tab.
```

### Known fragile points to watch on first 24h

- **socket.io upgrade** — if the Coolify nginx proxy strips `Connection: upgrade` headers on the new path, the widget falls back to long-polling automatically (already in `transports: ['websocket', 'polling']`). Check the Network panel for repeated POSTs to `/livechat-ws/?EIO=4&transport=polling` — that's the polling fallback, not a failure.
- **Visitor counts not enriching country** — means the `.mmdb` is not on the volume. The agent still functions; visitor location just stays null until you place the file and reboot the API.
- **CORS 403 on first pageview** — origin in the site row must exactly match what the browser sends as `Origin`. `https://www.bytesed.com` ≠ `https://bytesed.com`. Fix by adding both rows or by canonicalising on the site itself.
- **Echoed visitor messages on socket** — visitor's own messages are filtered client-side in `socket.ts` (`if (event.role === 'visitor') return`). If you see duplicate sends, that filter regressed.

**Sprint 3 exit criteria:**
- [ ] Widget loads on bytesed.com, ~12–18 kb gzipped, no host-page CSS bleed
- [ ] End-to-end conversation from bytesed.com appears in admin inbox with country/browser/page-journey data
- [ ] SPA navigation registers as pageviews; operator sees live "Currently on" updates
- [ ] Take over → operator reply → visitor sees it within 1s; release → AI resumes
- [ ] Crawler UAs don't pollute the journey timeline
- [ ] Rate limits trip cleanly at 429

---

## Dependency graph (critical path)

```
LC-01 → LC-02 → LC-04 → LC-05 → LC-06 → LC-08 → LC-09 → LC-11 → LC-13 → LC-14 → LC-15 → LC-17
       ↘ LC-03 ↗                       ↘ LC-07 ↗
                                                LC-10 (parallel with LC-11)
                                                LC-12 (can start anytime in Sprint 2)
                                                LC-16 (after LC-11)
```

Parallelizable side-tracks: LC-03, LC-12. Hand-off candidates if a second engineer joins.

---

## Risks

| Risk | Surfaces in | Mitigation |
|------|-------------|------------|
| ~~SSE buffered/killed by Coolify proxy~~ | ~~LC-17~~ | **Resolved up-front:** pivoted LC-06 to socket.io to mirror `RealtimeGateway` (path `/ws`). New gateway uses path `/livechat-ws`. Eliminates the proxy buffering risk. |
| MaxMind .mmdb refresh forgotten | Quarterly ops | LC-03 ships a README; consider a small `cron`/CI ticket later to re-pull and redeploy. |
| Widget bundle size creep | LC-12, LC-13 | No-deps rule on widget. If >25kb gzipped, split tracker into deferred async chunk. |
| Approval-less replies post something embarrassing | LC-08 onwards | Self-critique + blocklist + `needs_human` fallback. Monitor inbox for first weeks; tighten KB and blocklist iteratively. |

---

## Out of scope (parking lot — Phase 2+)

- File attachments via MinIO
- SES transcript-on-close (email visitor when session closes)
- Typing indicators
- hCaptcha after N anonymous messages
- Auto-approve mode based on KB confidence
- Cross-session visitor lifetime view + bulk export
- IP truncation policy for EU compliance (auto-truncate IPs >90 days to /24)
- Per-site widget branding (primary color + logo columns on `livechat_sites`)
- Returning-visitor session resume after >30 day gap
- Reactions / message edits

---

## Changelog

| Date | Entry |
|------|-------|
| 2026-04-30 | Module planned. Decisions locked. Sprints 1–3 broken into 17 tickets. Status: not started. |
| 2026-04-30 | Sprint 1 started. Pivoted LC-06 from SSE → socket.io after discovering the existing `RealtimeGateway` switched away from SSE due to Coolify proxy buffering. |
| 2026-04-30 | Sprint 1 complete (LC-01 through LC-06). Migration is `0027_livechat.sql` (not `0013` as originally drafted — collided with existing `0013_tasks.sql`). All TypeScript clean. Runtime smoke test pending: requires MaxMind `.mmdb` placement + API reboot. |
| 2026-04-30 | Sprint 2 complete (LC-07 through LC-11). Contacts bridge wired (`source: 'livechat'`, `livechat_message` activity kind), real KB+self-critique agent with `needs_human` fallback, admin endpoints (sessions list, takeover/release/close, operator reply, visitor + pageviews), full LiveChatPage UI with three tabs, live socket subscription on the operator side. UI restyled to match Crisp's three-column layout: avatar+flag inbox rows, top action bar with right-side primary status button, centered language pill + day separators, gray-left/blue-right message bubbles, collapsible visitor sidebar sections. |
| 2026-04-30 | Sprint 3 complete in code (LC-12 through LC-16). Embeddable widget at `apps/api/public/livechat.js` (18.1kB gzipped) built from `apps/web/widget/`; pageview tracker with SPA hooks + sendBeacon; bubble + panel + send/receive + lazy email + honeypot + visitor-side throttle; admin script controller serves the bundle. Redis-backed rate limits (60/min pageview, 30/min message) live behind a new `LIVECHAT_REDIS` provider. LC-17 (production rollout to bytesed.com) is the only remaining ticket and requires a Coolify deploy + footer edit — runbook documented above. |
| 2026-04-30 | LC-17 reframed: from "rollout to bytesed" to **per-site configurable widget instance**. Migration `0028_livechat_site_config.sql` adds 7 columns to `livechat_sites`. New public `GET /livechat/config?siteKey=X` endpoint. Widget fetches site config on bootstrap and applies brand color + position via CSS custom properties; renders per-site bot name, subtitle, and seeds the welcome message. Agent honors per-site LLM provider/model overrides. Admin form rebuilt with Identity / Persona / Advanced sub-tabs + native color picker. One bundle serves all sites — `data-site="<key>"` is the only switch. Bundle size: 18.55 kB gzipped. The actual production rollout itself is now tracked as LC-18 (operator action). |
| 2026-04-30 | LC-21 (install instructions modal) + LC-19 (live inbox + live visitor count/list) shipped together. Sites tab now opens an InstallModal with the copy-pasteable script + paste instructions + quick test as soon as a new site is created; same modal accessible later via a `<>` button per row. ConversationsTab dropped its 10s poll and runs on a single shared operator socket — server publishes `session_upserted` and `visitor_activity` events to `livechat:operators` from session create / status flip / operator reply / public message / pageview / heartbeat paths. New `POST /livechat/track/heartbeat` endpoint (rate-limited 120/min) keeps `last_seen_at` fresh while a tab is visible (widget pings every 30s). New `GET /agents/livechat/visitors/live?windowSec=` returns visitors seen in the last N seconds joined with their open session. Inbox shows a pulsing "X online" header with collapsible visitor list (country flag, name/email, "in chat" badge, current page title) at the top of the conversations rail. Bundle: 18.65 kB gzipped. |
| 2026-04-30 | LC-20 (bidirectional typing indicators) shipped. Gateway adds `livechat:typing` subscriber that forwards events sender-excluded via `client.to(room).emit`. Visitor textarea fires typing on input, debounced 1.5s off-timer; cleared on send + blur. Operator composer same pattern, scoped to active sessionId. Visitor side renders the existing `.lc-typing` 3-dot animation when `from='operator'` events arrive. Operator side renders a "{name} is typing…" pill above the composer with bouncing dots when `from='visitor'` events arrive; 5s safety auto-clear in case the off-event drops. Bundle: 18.78 kB gzipped. |
| 2026-04-30 | LC-22 first cut — file attachments via Cloudflare R2. Migration `0029_livechat_attachments.sql`. Initial draft used env vars and a livechat-only service. |
| 2026-04-30 | LC-22 hardened. Storage moved out of env vars into `SettingsService` (Integrations page → Storage tab). New global `StorageModule` exposes `StorageService.upload({ module, refKey, body, declaredMime, originalFilename })` so other modules (KB ingestion, future agent uploads) reuse it; R2 keys become `<module>/<refKey>/<cuid2>.<ext>`. Strict whitelist: png / jpeg / gif / webp / avif / pdf / doc / docx — anything else rejected. Magic-byte sniff via `file-type` cross-checks the claimed MIME against the actual bytes; office docs reconciled by extension when sniff returns CFB/ZIP. Filename rules: no dotfiles, no double extensions like `file.php.png`, alphanumeric + dot/dash/underscore only, max 200 chars. Forbidden extensions blocked (exe, sh, php, html, svg, etc). Settings cache (60s) so config changes apply without restart. New `storage_public_base` setting — when set, attachment URLs use the CDN domain (long-lived); otherwise 24h presigned GET. Test-connection in Integrations now does a real put + delete probe. Widget + admin composer support paste-to-upload (clipboard image items become attachments). URLs in chat content auto-linkify on both sides — visitor and operator/agent — opening in a new tab with `rel="noopener noreferrer nofollow"`. Bundle: 20.64 kB gzipped. |
| 2026-04-30 | LC-23 (SES transcript-on-close) shipped. Migration `0030_livechat_transcript.sql` adds `transcript_enabled` / `transcript_bcc` / `transcript_from` to `livechat_sites` and `transcript_sent_at` to `livechat_sessions`. Extended `SesService.sendEmail` with optional `htmlBody`, `cc`, `bcc`, `replyTo`. New `LivechatTranscriptService.send(sessionId, { force? })` builds an HTML + text email of the full conversation (visitor-left / operator+agent-right bubbles, role-tagged, attachments inlined as images or as styled file pills, URLs linkified) and dispatches via SES with optional BCC fan-out. Close endpoint fires `maybeSendOnClose` (never throws). New `POST /agents/livechat/sessions/:id/send-transcript` for manual send (force=true bypasses the per-site enable toggle). Admin form gains a Transcript sub-tab (Enabled / From address / BCC), and the SessionPane top bar gets a Mail icon to send-on-demand. Brand color from the site row drives the email header. |
| 2026-04-30 | LC-24 (auto-approve + moderation queue) shipped. Migration `0031_livechat_auto_approve.sql` flips `livechat_sites.auto_approve` default to `true` and backfills existing rows; adds `pending_approval` boolean to `livechat_messages` with a partial index for fast queue lookups. Agent now reads `site.auto_approve` and routes accordingly: `true` (default) → publish straight to visitor as before; `false` → save with `pending_approval=true`, broadcast `session_upserted` to operators only, visitor never sees the draft. New endpoints: `POST /agents/livechat/messages/:id/approve` (publishes the message to the session room with attachments), `:id/edit-and-approve` (save edit + approve in one shot), `:id/reject` (delete row). Stream events grow `pendingApproval?` on `message` and a new `message_removed` variant. Operator UI: pending agent bubbles render in amber with "Awaiting your approval" label and inline Approve / Edit / Reject buttons; Edit opens the bubble as an editable textarea then sends edited content as approval. Inbox rows show a "N pending review" amber pill when drafts await an operator. Admin form's Persona tab gains a prominent Auto-send toggle with copy explaining it's the default for automation. `getRecentMessages` (used by agent context) filters out pending drafts so the agent never tries to reference messages the visitor never received. |
| 2026-04-30 | LC-25 (Needs review filter + pending count badge) shipped. `listSessions` accepts `hasPendingDrafts` filter (subselect against `livechat_messages WHERE pending_approval=true`). New `GET /agents/livechat/sessions/pending-count` returns `{ sessions, drafts }`. Inbox filter dropdown gains a `Needs review` chip with an amber count badge (current dropdown chip + each item in the dropdown). Badge driven by the existing operator-socket `session_upserted` event — invalidates both the sessions list and the pending-count query so changes propagate live across operators. |
| 2026-04-30 | LC-26 (cross-session visitor history) shipped. `LivechatService.getVisitorSessions(visitorPk)` joins sessions + sites + message counts, ordered by lastSeenAt desc. Endpoint `GET /agents/livechat/visitors/:id/sessions`. New `PastConversationsSection` accordion in the visitor sidebar — "Past conversations (N)" shows site label, status pill, message count, last-page hint per past session; click opens the session inline. |
| 2026-04-30 | LC-28 (visitor message dedupe) shipped. `appendMessage` for `role='visitor'` looks up identical content within the last 5 seconds and returns the existing message instead of inserting. Public `/livechat/message` short-circuits when the helper returns `duplicate=true` — skips attachment linking, socket publish, and agent run. Catches double-clicks, network retries, and SNS at-least-once delivery on the inbound path (LC-27). |
| 2026-04-30 | LC-27 (email-to-thread) shipped. New `LivechatInboundService` with HMAC-signed reply addresses (`transcript+{sessionId}.{token}@<reply-domain>`) and an inbound MIME parser. Transcript emails now set `Reply-To` to the signed address. New `POST /livechat/inbound?t=<token>` endpoint receives SES → SNS notifications, parses RFC822 (multipart, base64/quoted-printable decoding, HTML→text fallback), extracts `In-Reply-To` and recipient, validates HMAC token + visitor email match, strips quoted reply (Gmail/Outlook/Apple Mail/iPhone signatures), reopens closed sessions, posts as visitor message, runs the agent. Three new settings: `livechat_reply_domain`, `livechat_reply_secret`, `livechat_inbound_token`. Inbound controller lives inside the livechat module to avoid `SesModule ↔ LivechatModule` cycle. AWS-side setup documented below. |
