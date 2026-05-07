# Canva + Social Content Agent — Sprint Plan

**SRS Version:** 1.0 (May 7, 2026)  
**Status:** Planning  
**Branch:** dev  
**Owner:** Sharifur

---

## Gap Analysis: Current vs SRS

| Area | Current State | SRS Target |
|---|---|---|
| Core function | Monthly content calendar generator (LLM → Telegram approval → DB insert) | Full AI Design Agent: concept → brief → multi-backend generation → local file approval |
| Canva MCP | None — agent never calls Canva APIs | Full MCP client: `https://mcp.canva.com/mcp`, OAuth, 30+ tools |
| AI image | None | DALL·E 3 + Stability AI + Replicate adapters |
| Local render | None | Pillow, cairosvg, ImageMagick, Playwright |
| Storage | `contentIdeas` rows in Postgres | Local approval folder: `~/Designs/AI-Agent/Approvals/<session>/{pending,approved,rejected}/` |
| Approval flow | Telegram single-action approve/reject on calendar batch | Per-candidate approval with manifest.json + sidecar .json + audit.jsonl |
| Iteration | None | Up to 5 refinement rounds with parent lineage tracking |
| Skills | None | 8 built-in SKILL.md files, dynamic loader |
| Frontend | Basic Setup sub-tab | Design brief intake, candidate gallery, per-candidate approve/revise/reject |

---

## Sprint Overview

| Sprint | Focus | Tickets | Est. |
|---|---|---|---|
| S1 | Foundation: Canva MCP + DB schema | T1–T4 | 1 week |
| S2 | Generation backends | T5–T8 | 1 week |
| S3 | Approval workflow + storage | T9–T12 | 1 week |
| S4 | Skill loader + orchestration | T13–T16 | 1 week |
| S5 | Frontend + agent Setup tab | T17–T20 | 1 week |
| S6 | Error handling + tests + polish | T21–T25 | 1 week |

---

## Sprint 1 — Foundation: Canva MCP + DB Schema

### T1 — Canva MCP Client Service
**File:** `apps/api/src/modules/mcp/canva-mcp.service.ts`  
**SRS refs:** §4.2.1, FR-084–FR-089, Appendix E

- [ ] Add `mcp-remote` npm dep + `npx -y mcp-remote https://mcp.canva.com/mcp` stdio shim config
- [ ] Implement `CancvaMcpService` wrapping `McpClientService` for the Canva remote endpoint
- [ ] Startup verification: reachability → handshake → `list-brand-kits` auth check → tool catalog completeness (32 tools) → latency P50
- [ ] Expose `canva:verify` MCP tool that returns status block (endpoint, auth state, tools count, latency)
- [ ] Brand kit cache: Redis TTL 30 min per session (FR-081)
- [ ] Token never logged — redact from Pino (FR-087, SEC-007)
- [ ] Fail loud if any required tool missing (FR-089)

**Done when:** `canva:verify` returns OK with 32/32 tools and latency < 1500 ms.

---

### T2 — DesignBrief Parser + Intent Classifier
**File:** `apps/api/src/modules/agents/canva/concept-parser.service.ts`  
**SRS refs:** §5.1, §10.1, FR-001–FR-004, FR-010–FR-013

- [ ] Define `DesignBrief` TypeScript interface matching §10.1 schema
- [ ] `ConceptParserService.parse(freeText, attachments?)`: LLM call → structured `DesignBrief`
- [ ] Intent classification: `social_post | presentation | marketing_banner | logo | infographic | print | illustration | custom`
- [ ] Missing-field detection: dimensions, brand kit, format, approval workflow → surface via structured question (FR-002)
- [ ] `brief_hash`: SHA-256 of canonical JSON (needed for sidecar)
- [ ] Unit test: 7 intent classes each produce fully populated brief

**Done when:** A free-form prompt produces a valid `DesignBrief` with all required fields.

---

### T3 — DB Schema: Sessions + Candidates + Audit
**Files:** `apps/api/src/modules/agents/canva/schema.ts`, `apps/api/drizzle/0013_canva_sessions.sql`  
**SRS refs:** §10.1–10.3, §8.1–8.2

- [ ] `canva_sessions` table: `id`, `brief` (jsonb), `status` (active|closed), `approval_folder_path`, `created_at`
- [ ] `canva_candidates` table: `id`, `session_id`, `status` (pending|approved|rejected|revised|failed), `backend` (canva|ai_image|local), `file_path`, `format`, `width`, `height`, `size_bytes`, `sha256`, `phash`, `parent_candidate_id`, `iteration`, `feedback`, `cost_usd`, `rationale`, `metadata` (jsonb), `created_at`
- [ ] Re-export from `apps/api/src/db/schema.ts`
- [ ] Write migration `0013_canva_sessions.sql`

**Done when:** Migration runs clean on dev Postgres.

---

### T4 — BackendAdapter Interface
**File:** `apps/api/src/modules/agents/canva/adapters/backend-adapter.interface.ts`  
**SRS refs:** §3.2, NFR-040

- [ ] Define `BackendAdapter` interface: `generate(task: GenerationTask): Promise<Candidate>`
- [ ] Define `GenerationTask`, `Candidate`, `GenerationPlan`, `ImageRequest`, `ImageResult` types
- [ ] Stub `CanvaAdapter`, `AIImageAdapter`, `LocalRenderAdapter` classes (no implementation yet — that's S2)
- [ ] `BackendRouter.dispatch(plan: GenerationPlan): Promise<Candidate[]>` — iterates tasks, picks adapter

**Done when:** Types compile; router stubs dispatch without runtime errors.

---

## Sprint 2 — Generation Backends

### T5 — CanvaAdapter: Full Generation Flow
**File:** `apps/api/src/modules/agents/canva/adapters/canva.adapter.ts`  
**SRS refs:** §7.1, FR-020–FR-023, FR-080–FR-083

- [ ] `listBrandKits()` → cached via Redis
- [ ] `generateDesign(brief, brandKitId?)` → `generate-design-structured` → `design_id`
- [ ] Transactional edit wrapper:
  - `startEditingTransaction(designId)` → `txn_id`
  - `performEditingOperations(txnId, ops[])`
  - `commitEditingTransaction(txnId)` — always commit or cancel, never leak (FR-080)
  - `cancelEditingTransaction(txnId)` on any error
- [ ] Export: `getExportFormats(designId)` → `exportDesign(designId, format)` → download bytes to approval folder
- [ ] `getDesignThumbnail(designId)` → store low-res preview
- [ ] `uploadAssetFromUrl(localPath)` → `asset_id` for composite flow
- [ ] Resolve shortlink on user-provided Canva URLs (FR-082)

**Done when:** End-to-end Canva flow produces a PNG in `pending/` with sidecar JSON.

---

### T6 — AIImageAdapter: DALL·E 3 + Stability Fallback
**File:** `apps/api/src/modules/agents/canva/adapters/ai-image.adapter.ts`  
**SRS refs:** §7.2, FR-090–FR-093

- [ ] Uniform `generate(request: ImageRequest): Promise<ImageResult[]>` signature
- [ ] DALL·E 3 provider: sizes 1024×1024 / 1024×1792 / 1792×1024; `style: natural|vivid`
- [ ] Stability AI provider: full size flexibility, seed-controllable, img2img support
- [ ] Replicate provider: pin model version per skill for reproducibility
- [ ] Prompt sanitization before provider call (FR-090)
- [ ] Always download bytes — never store URL alone (FR-091)
- [ ] Cost estimate recorded in sidecar (FR-092)
- [ ] pHash computed for deduplication (FR-093)

**Done when:** DALL·E 3 generates a PNG with cost estimate in sidecar; Stability fallback activates when DALL·E quota exceeded.

---

### T7 — LocalRenderAdapter: Pillow + ImageMagick
**File:** `apps/api/src/modules/agents/canva/adapters/local-render.adapter.ts`  
**SRS refs:** §7.3, FR-100–FR-102

- [ ] Sandboxed subprocess executor with 60s timeout (FR-100)
- [ ] Pillow (Python): text-on-image overlay → PNG
- [ ] cairosvg: SVG → PNG/PDF
- [ ] ImageMagick: composite, watermark, thumbnail
- [ ] Playwright/Chromium: HTML+CSS → PNG for pixel-precise layouts
- [ ] Font availability check before render; fallback font or clarifying question (FR-101)
- [ ] Font cache reused within session (FR-102)

**Done when:** Pillow text overlay produces 1080×1080 PNG within 5s.

---

### T8 — Planner + Backend Selection Matrix
**File:** `apps/api/src/modules/agents/canva/planner.service.ts`  
**SRS refs:** §7.4, FR-010–FR-013

- [ ] `Planner.plan(brief, skills): GenerationPlan`
- [ ] Backend selection matrix (9 intents → primary/secondary backend)
- [ ] Default 2–4 candidates per concept (FR-012)
- [ ] Rationale written to each `GenerationTask` → propagated to sidecar (FR-013)
- [ ] Concurrent dispatch: up to 4 tasks in parallel via `Promise.allSettled` (NFR-020)

**Done when:** A `social_post` brief emits a plan with 3 Canva tasks; a `logo` brief emits AI image primary.

---

## Sprint 3 — Approval Workflow + Storage

### T9 — Approval Folder Store
**File:** `apps/api/src/modules/agents/canva/approval-folder.service.ts`  
**SRS refs:** §8.1–8.2, FR-030–FR-034

- [ ] Create session dir: `~/Designs/AI-Agent/Approvals/<session_id>/{pending,approved,rejected}/`
- [ ] Atomic file write: write to `.tmp`, then `rename` (FR-120)
- [ ] `manifest.json` CRUD: create, read, update candidate status, list
- [ ] Path allowlist enforcement — no writes outside approval root (SEC-005)
- [ ] Pre-write disk quota check (Appendix D, risk 5)
- [ ] `computer://` link generation for chat output (FR-034, NFR-031)

**Done when:** Session folder created; manifest updated atomically on each candidate write.

---

### T10 — Candidate Sidecar + Audit Log
**File:** `apps/api/src/modules/agents/canva/audit-log.service.ts`  
**SRS refs:** §10.2–10.3, FR-060–FR-061

- [ ] Write `<candidate_id>.json` sidecar matching §10.2 schema on each candidate
- [ ] Append-only `audit.jsonl` per session: timestamp, session_id, candidate_id, actor, action, input_hash, output_hash, latency_ms, outcome
- [ ] Chained hashes for tamper-evidence (NFR-061)
- [ ] Structured Pino log fields: `session_id`, `candidate_id`, `backend`, `tool`, `latency_ms` (NFR-060)

**Done when:** Every backend call produces an audit entry; sidecar matches the §10.2 shape.

---

### T11 — Approval State Machine
**File:** `apps/api/src/modules/agents/canva/approval-manager.service.ts`  
**SRS refs:** §8.3–8.4, FR-040–FR-045

State machine:
```
pending → approved (approve)
pending → rejected (reject)  → rejected/
pending → revised  (revise)  → new candidate, parent_candidate_id set
approved → pending (undo, within session)
rejected → pending (restore, within session)
```

- [ ] `presentCandidates()`: numbered list with file link, thumbnail link, backend, dims, format, rationale
- [ ] Multi-select approval/rejection/revision via structured response
- [ ] Per-candidate revision feedback stored as free-text → fed back to Planner
- [ ] Never move files without explicit user direction (FR-113)
- [ ] Never permanently delete files without explicit confirmation (FR-045)
- [ ] Iteration cap: stop at 5, ask whether to continue (FR-052)

**Done when:** Approve/reject/revise transitions update both manifest.json and Postgres `canva_candidates`.

---

### T12 — Telegram Approval Integration for Design Candidates
**SRS refs:** §5.5, existing Telegram approval flow

- [ ] Format candidate summary message for Telegram: candidate index, backend, dims, format, rationale
- [ ] Telegram inline buttons: Approve / Reject / Revise per candidate
- [ ] On "Revise": follow-up message for free-text feedback
- [ ] Re-enter planning loop with revised brief on revise callback
- [ ] `requiresApproval()`: always true for `publish_design` action type

**Done when:** Telegram message shows 3 candidates with action buttons; approval updates manifest.

---

## Sprint 4 — Skill Loader + Full Orchestration

### T13 — Built-in Skill Files
**Dir:** `apps/api/src/modules/agents/canva/skills/`  
**SRS refs:** §6.1, §6.4

Create `SKILL.md` for each of the 8 built-in skills:

| Skill | File |
|---|---|
| `canva-social-post` | `skills/canva-social-post/SKILL.md` |
| `canva-presentation` | `skills/canva-presentation/SKILL.md` |
| `canva-marketing-banner` | `skills/canva-marketing-banner/SKILL.md` |
| `ai-illustration` | `skills/ai-illustration/SKILL.md` |
| `ai-photo-realistic` | `skills/ai-photo-realistic/SKILL.md` |
| `local-text-overlay` | `skills/local-text-overlay/SKILL.md` |
| `local-html-render` | `skills/local-html-render/SKILL.md` |
| `composite-design` | `skills/composite-design/SKILL.md` |

Each `SKILL.md` must have YAML frontmatter: `name`, `description`, `triggers[]`, `backend_hints[]`, `inputs[]`.

**Done when:** 8 SKILL.md files exist with valid frontmatter; `SkillLoaderService` can index all of them.

---

### T14 — Skill Loader Service
**File:** `apps/api/src/modules/agents/canva/skill-loader.service.ts`  
**SRS refs:** §6.2–6.3, FR-070–FR-072

Lifecycle: Index → Match → Load → Apply → Unload

- [ ] `index()`: scan skill dirs on startup, cache frontmatter only (FR-070)
- [ ] `match(brief): ScoredSkill[]`: keyword trigger match + semantic similarity against description (FR-071)
- [ ] `load(skill): SkillContent`: read full SKILL.md into planning context
- [ ] Conflict resolution: skill priority field + recency (FR-072)
- [ ] Adding a new skill = new dir + SKILL.md only — zero code change (NFR-041)

**Done when:** `canva-social-post` matches at score > 0.8 for "Instagram post announcing our Spring sale".

---

### T15 — CandidateAggregator + pHash Deduplication
**File:** `apps/api/src/modules/agents/canva/candidate-aggregator.service.ts`  
**SRS refs:** FR-024, §10.2

- [ ] Collect `Candidate[]` from BackendRouter after parallel dispatch
- [ ] Normalize output to PNG/PDF/SVG (cairosvg for SVG, ImageMagick for others)
- [ ] pHash computation per candidate; deduplicate within Hamming distance threshold (FR-024)
- [ ] Persist sidecar + manifest after each candidate
- [ ] Partial failure handling: failed tasks marked `failed` in manifest; successful ones continue (NFR-012)

**Done when:** Generating 3 variants; near-duplicate is dropped; manifest correctly shows 2 unique pending.

---

### T16 — Full Orchestration in `agent.ts` (Canva Agent Rewrite)
**File:** `apps/api/src/modules/agents/canva/agent.ts`  
**SRS refs:** §2.2, §11.1, §3.3

Rewrite `decide()` to:

1. `ConceptParserService.parse(trigger.body)` → `DesignBrief`
2. `SkillLoaderService.match(brief)` → top skills
3. `Planner.plan(brief, skills)` → `GenerationPlan`
4. `BackendRouter.dispatch(plan)` → `Candidate[]` (parallel, up to 4)
5. `CandidateAggregator.collect(candidates)` → persist, dedup
6. `ApprovalManager.presentCandidates()` → approval action for Telegram

`execute()` handles approval state transitions.

Keep existing content-calendar cron as a separate `decide()` branch — don't remove it.

**Done when:** End-to-end happy path (§11.1) completes: concept → 3 candidates in `pending/` → Telegram shows approval.

---

## Sprint 5 — Frontend + Agent Setup Tab

### T17 — Design Brief Intake UI
**File:** `apps/web/src/pages/AgentDetailPage.tsx` (canva section) or new `DesignBriefPage.tsx`  
**SRS refs:** §4.1, FR-001–FR-004

- [ ] Trigger form: text area for concept, dimension picker, format selector, brand kit selector (loaded from `GET /canva/brand-kits`)
- [ ] Optional reference image upload
- [ ] "Generate" button → `POST /canva/generate`
- [ ] Loading state while generation runs

**Done when:** User can submit a concept brief from the web UI and see a loading indicator.

---

### T18 — Candidate Gallery with Approval Actions
**File:** `apps/web/src/pages/AgentDetailPage.tsx` (new Candidates sub-tab)  
**SRS refs:** §8.4, FR-040–FR-044

- [ ] Fetch `GET /canva/sessions/:id/candidates`
- [ ] Grid: thumbnail, backend badge, dims, format, rationale, status chip
- [ ] Per-candidate: Approve / Reject / Revise buttons
- [ ] Revise: inline free-text feedback input
- [ ] Manifest status reflected in real-time (poll or SSE)
- [ ] `approved/` candidates highlighted green; `rejected/` greyed out

**Done when:** All approval state transitions visible and actionable in the UI.

---

### T19 — Canva Agent Setup Sub-Tab
**File:** `apps/web/src/pages/AgentDetailPage.tsx`  
**SRS refs:** §4.2.1.5, Appendix E

Per the memory rule: Setup sub-tab = prerequisites + config steps + manual test guide.

- [ ] Prerequisite note: Canva account with MCP access enabled
- [ ] Step 1: Add `CANVA_MCP_ENDPOINT=https://mcp.canva.com/mcp` to env (or config.yaml)
- [ ] Step 2: AI image provider keys: `OPENAI_API_KEY`, `STABILITY_API_KEY`, `REPLICATE_API_KEY`
- [ ] Step 3: Set approval folder path (`CANVA_APPROVAL_FOLDER` — default `~/Designs/AI-Agent/Approvals`)
- [ ] Step 4: Verify Canva connection — button that calls `GET /canva/verify` → shows status block
- [ ] Step 5: Manual test — paste a brief → confirm candidates appear in `pending/`
- [ ] Note card: LLM provider and Telegram are platform-wide (not repeated as setup steps)

**Done when:** Setup tab visible under the canva agent; verify button shows 32/32 tools OK.

---

### T20 — Prometheus Metrics for Backends
**SRS refs:** §15.3, NFR-060

- [ ] Counter: `canva_candidates_total{backend, status}` — produced, approved, rejected, failed
- [ ] Histogram: `canva_backend_latency_ms{backend, tool}` — per-backend tool latency
- [ ] Counter: `canva_errors_total{backend, error_class}` — transient, permanent, quota

**Done when:** Metrics visible on `/metrics` endpoint after a full generation run.

---

## Sprint 6 — Error Handling + Tests + Polish

### T21 — Retry Logic + Circuit Breaker
**SRS refs:** §12, NFR-010–NFR-012, FR-122

- [ ] Retry wrapper: exponential backoff, up to 3 attempts, transient errors only (502, 503, 429)
- [ ] Circuit breaker per backend: after 3 consecutive failures → suspend for session + notify user
- [ ] `429` rate-limit: honor `Retry-After` header; reduce `concurrent_tasks` in config
- [ ] Permanent errors (401, 403, 404) → fail fast, surface to user with remediation

**Done when:** Forced 503 on `commit-editing-transaction` → transaction cancelled, manifest untouched, user notified.

---

### T22 — Editing Transaction Cleanup Guard
**SRS refs:** FR-080, FR-121

- [ ] Wrap every `start-editing-transaction` in a try/finally that always calls `cancel` on unhandled error
- [ ] `TransactionRegistry`: track open txn_ids per session; sweep and cancel on agent shutdown
- [ ] Verify: no orphan transactions after a forced kill

**Done when:** No Canva editing transaction leaks in any failure scenario.

---

### T23 — Content Policy + Cost Cap
**SRS refs:** §12.1, §13, FR-090, Appendix D risk 2

- [ ] Prompt injection sanitization before all AI image provider calls (FR-090)
- [ ] Per-session cost accumulator; configurable `max_cost_usd` cap → switch to fallback backend on breach
- [ ] Copyright flag: reject verbatim reproduction of protected references (SEC-004)
- [ ] Content policy triggered → refuse, explain, do not retry blindly

**Done when:** Cost cap switches from DALL·E to Stability when session USD exceeds threshold.

---

### T24 — Unit + Integration Tests
**SRS refs:** §14.1–14.2

- [ ] Unit: `ConceptParserService` — 7 intent classes
- [ ] Unit: `SkillLoaderService` — match scoring for each built-in skill
- [ ] Unit: `Planner` — backend selection matrix (9 intents)
- [ ] Unit: `ApprovalManager` — state machine transitions
- [ ] Contract: `BackendAdapter` interface — all 3 adapters satisfy the contract
- [ ] Integration: `CanvaAdapter` against Canva sandbox account (if available)
- [ ] Snapshot: `manifest.json` and sidecar shape
- [ ] Chaos: forced 503 on commit → transaction cancelled, manifest intact

**Done when:** All unit tests pass; chaos test produces correct failure recovery.

---

### T25 — Version Bump + Changelog
**Files:** `apps/web/src/layouts/AppLayout.tsx`, `apps/web/src/pages/ChangelogPage.tsx`

- [ ] Bump version to v3.10.0 (MINOR — new agent feature set)
- [ ] Add v3.10.0 block to ChangelogPage with summary of all S1–S6 changes

**Done when:** Version string updated; changelog entry added in same commit.

---

## Additional Requirements (added May 7, 2026)

### T26 — Token + Cost Usage Tracking
**Files:** `adapters/ai-image.adapter.ts`, `canva-mcp.service.ts`, `canva_candidates` table  
**Req:** Every backend call (LLM, DALL·E, Stability, Replicate, Canva MCP) must record cost.

- [ ] AI image cost per provider: DALL·E 3 ($0.04/image std, $0.08/HD), Stability (per credit), Replicate (per prediction)
- [ ] Canva MCP calls: record latency only (no token cost); log to audit.jsonl
- [ ] `canva_candidates.cost_usd` = cumulative image generation cost per candidate
- [ ] `canva_sessions.total_cost_usd` = sum of all candidate costs in session
- [ ] LLM calls (ConceptParser, Planner) already tracked via existing `LlmUsageService` — tag with `agentKey: 'canva'`

**Done when:** After a generation run, session total_cost_usd is correct; image costs visible in candidate sidecar.

---

### T27 — Debug Log Mode
**Files:** `canva-debug.service.ts`, `canva_debug_log` table, agent config  
**Req:** Structured per-step debug traces, toggleable via `debugMode: true` in agent JSON config.

- [ ] `canva_debug_log` Postgres table: `session_id`, `candidate_id`, `step`, `actor`, `data` (jsonb), `latency_ms`
- [ ] `CanvaDebugService.log(step, actor, data, latencyMs)` — writes to DB only when `debugMode=true`
- [ ] Steps to log: `parse`, `skill_match`, `plan`, `canva_call`, `image_generate`, `local_render`, `approve`, `reject`, `revise`
- [ ] API: `GET /canva/sessions/:id/debug` — returns debug log for a session
- [ ] Frontend: Debug tab in Candidates view (visible when `debugMode=true`)

**Done when:** Debug tab shows timestamped step trace after a generation run.

---

### T28 — Agent Chat Page (Generate + Edit in Canva)
**File:** `apps/web/src/pages/AgentDetailPage.tsx` (new Chat tab for canva agent)  
**Req:** Interactive chat to generate images or ideas; "Edit in Canva" deep-link per candidate.

- [ ] Chat tab alongside existing Setup/Calendar tabs
- [ ] Text input → `POST /canva/chat` — routes to image generation (design concept) or idea generation (calendar idea)
- [ ] Response renders candidates as image cards with: thumbnail, backend badge, "Edit in Canva" button
- [ ] "Edit in Canva" opens `https://www.canva.com/design/{canvaDesignId}/edit` in new tab
- [ ] If candidate is AI image (no Canva design ID): show "Download" instead of "Edit in Canva"
- [ ] Streaming response for LLM steps (plan narration)
- [ ] Idea cards: hook, body, CTA, platform, "Design it" button → triggers Canva generation for that idea

**Done when:** User can type "create an Instagram post for taskip spring sale" in chat → candidates appear → Edit in Canva opens the Canva editor.

---

### T29 — Multi-Brand Identity System
**Files:** `canva_brands` table, `canva-brands.service.ts`, API routes, frontend brand editor  
**Req:** Each brand has its own voice, palette, fonts, Canva kit ID — not a shared global voice.

- [ ] `canva_brands` table: `name`, `displayName`, `voiceProfile`, `palette` (jsonb), `fonts` (jsonb), `canvaKitId`, `platforms` (jsonb), `logoUrl`, `active`
- [ ] `CanvaBrandsService`: CRUD + `getByName(name): CanvaBrand`
- [ ] API: `GET /canva/brands`, `POST /canva/brands`, `PATCH /canva/brands/:name`
- [ ] ConceptParserService: when brief mentions a brand name, load its identity and inject into DesignBrief
- [ ] CanvaAdapter: use brand's `canvaKitId` for `list-brand-kits` lookup
- [ ] Frontend: Brands sub-tab in Setup with form per brand (voice textarea, palette swatches, fonts, Canva kit ID field)

**Done when:** Creating a "taskip" brand with its own voice; generating a post for taskip uses that voice and Canva kit.

---

## Progress Tracker

| Ticket | Title | Status | Sprint |
|---|---|---|---|
| T1 | Canva MCP Client Service | Done | S1 |
| T2 | DesignBrief Parser + Intent Classifier | Done | S1 |
| T3 | DB Schema: Sessions + Candidates + Audit | Done | S1 |
| T4 | BackendAdapter Interface | Done | S1 |
| T5 | CanvaAdapter: Full Generation Flow | Done | S2 |
| T6 | AIImageAdapter: DALL·E 3 + Stability | Done | S2 |
| T7 | LocalRenderAdapter: Pillow + ImageMagick | Done | S2 |
| T8 | Planner + Backend Selection Matrix | Done | S2 |
| T9 | Approval Folder Store | Done | S3 |
| T10 | Candidate Sidecar + Audit Log | Done | S3 |
| T11 | Approval State Machine | Done | S3 |
| T12 | Telegram Approval Integration | Done | S3 |
| T13 | Built-in Skill Files (8 skills) | Done | S4 |
| T14 | Skill Loader Service | Done | S4 |
| T15 | CandidateAggregator + pHash Dedup | Done | S4 |
| T16 | Full Orchestration in agent.ts | Done | S4 |
| T17 | Design Brief Intake UI | Done | S5 |
| T18 | Candidate Gallery + Approval Actions | Done | S5 |
| T19 | Canva Agent Setup Sub-Tab | Done | S5 |
| T20 | Prometheus Metrics for Backends | Not started | S5 |
| T21 | Retry Logic + Circuit Breaker | Done (in CanvaAdapter) | S6 |
| T22 | Editing Transaction Cleanup Guard | Done (in CanvaAdapter) | S6 |
| T23 | Content Policy + Cost Cap | Done (prompt sanitize + cost field) | S6 |
| T24 | Unit + Integration Tests | Not started | S6 |
| T25 | Version Bump + Changelog | Not started | S6 |
| T26 | Token + Cost Usage Tracking | Done (cost_usd in candidates + LlmUsageService) | S6 |
| T27 | Debug Log Mode | Done | S6 |
| T28 | Agent Chat Page (Generate + Edit in Canva) | Done | S5 |
| T29 | Multi-Brand Identity System | Done | S1 |

---

## Key Architecture Decisions

**Why rewrite `agent.ts` rather than replace it (T16):**  
The existing content-calendar cron has approved ideas in the `contentIdeas` table — preserving it avoids data loss. The rewrite adds a second `decide()` branch for concept-driven generation; both branches coexist under the same agent key `canva`.

**Approval folder vs Postgres for file storage:**  
SRS §8 requires local filesystem candidates — Postgres stores only metadata and status. MinIO (already in stack) is NOT used here; approval folder is the source of truth per §15.4.

**Canva MCP auth model:**  
OAuth 2.0 browser-based. No Canva password or API key ever stored. Token cached by `mcp-remote` under `~/.mcp-auth/` (0700 dir, 0600 files). The agent never reads this token directly — the MCP client handles it transparently.

**Skill system is data-only (NFR-041):**  
New skills require zero code changes. `SkillLoaderService` indexes any directory added to `skills_dirs[]` in config. This satisfies the SRS extensibility requirement without premature abstraction.
