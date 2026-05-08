# Taskip Internal Agent — Specification

**Module path:** `apps/api/src/modules/agents/taskip-internal/`  
**Agent key:** `taskip_internal`  
**Purpose:** Proactive email suggestion engine that sweeps Insight cohorts, generates personalized draft emails via LLM, queues them for founder approval, and sends via Gmail (personal outreach) or Taskip's own messaging system (lifecycle messages).

---

## 1. Goals

| Audience | Goal |
|---|---|
| Trial users (`serious_trial`, `looking_trial`, `trial_ready_free`) | Convert to paid — founder reaches out personally via Gmail |
| Paid users (`at_risk_paid`, `dormant_paid`) | Retain and nurture — lifecycle message through Taskip's own system (in-app + email) |

No email is ever sent without explicit founder approval.

---

## 2. How It Works (Overview)

```
Every 6 hours (BullMQ cron)
  │
  ├── Phase 1: Sweep cohorts via Insight API
  │     GET /cohorts/{cohort}/workspaces
  │     (+ trial-funnel shortcuts for hot/at-risk/trial-ready)
  │
  ├── Phase 2: Per-workspace drill-down
  │     GET /workspaces/{uuid}/lifecycle        — owner, score, signals
  │     GET /workspaces/{uuid}/scenarios/pending — eligible scenarios
  │     GET /workspaces/{uuid}/messages          — dedup: already sent?
  │     → Check activity log: skip if cooldown, ignored, or has unread reply
  │
  ├── Phase 3: LLM draft generation
  │     Build prompt from lifecycle context + scenario spec
  │     → Save as pending suggestion in taskip_internal_suggestions
  │     → Write suggestion_created to activity log
  │
  └── Telegram notification: "N new email suggestions ready"

Founder reviews in /agents/taskip_internal → Suggestions tab
  → Approve & Send  → email sent, logged in activity
  → Edit first      → update subject/body, then approve
  → Skip            → logged in activity; 3 consecutive skips = sweep ignores workspace
```

---

## 3. Insight API — Live Endpoints Used

Base URL: `{insight_base_url}/api/internal/insight`  
Auth: `X-Insight-Agent-Key` header (set `insight_agent_key_primary` in Settings)

| Endpoint | Phase | Purpose |
|---|---|---|
| `GET /cohorts/{cohort}/workspaces` | 1 | Paginated cohort list, sorted by score_delta_14d ASC (most-decayed first) |
| `GET /trial-funnel/hot-list` | 1 | Shortcut — serious_trial sorted by THS desc |
| `GET /trial-funnel/at-risk-list` | 1 | Shortcut — ignore_trial, THS<30 at day≥5 |
| `GET /trial-funnel/trial-ready-list` | 1 | Shortcut — trial_ready_free, TRS≥50 |
| `GET /workspaces/{uuid}/lifecycle` | 2 | Owner name/email, score, signals, recent_messages |
| `GET /workspaces/{uuid}/scenarios/pending` | 2 | Eligible scenarios from rules engine (respects cooldowns) |
| `GET /workspaces/{uuid}/messages` | 2 | Last 50 AI message attempts — dedup check |
| `POST /workspaces/{uuid}/messages` | 3 | Deliver via Taskip's system (in-app + system email) |

**Not yet live — do not use:**
- `GET /workspaces/{uuid}/recommended-actions`
- `POST /marketing-suggestions`
- `POST /workspaces/{uuid}/agent-actions`

---

## 4. Cohort Target List

| Cohort | Lifecycle | Definition | Email path |
|---|---|---|---|
| `serious_trial` | trial | Day ≥ 3, THS ≥ 60, activation event hit | Gmail (personal) |
| `looking_trial` | trial | THS 30–59 OR activated late (day 4–7) | Gmail (personal) |
| `trial_ready_free` | free | TRS ≥ 50, signup ≥ 2 days, no trial yet | Gmail (personal) |
| `at_risk_paid` | paid | Activity dropped 30%+ in 14d, OR last_login > 7d | Taskip system |
| `dormant_paid` | paid | Zero activity in 14+ days | Taskip system |

Cohorts NOT targeted by the sweep (no action):
- `ignore_trial` — THS < 30, no activation by day 5
- `healthy_paid` / `expanding_paid` — already engaged
- `ignore_free` — TRS < 20 or no login in 14+ days
- `expired_trial_cold` — low frozen THS, let go

---

## 5. Score Tiers

| Tier | Range | Label | Badge color | Agent action |
|---|---|---|---|---|
| 1 | 0–25 | Cold | `#ef4444` red | Educational, feature discovery |
| 2 | 26–50 | Warming | `#f59e0b` amber | Activation nudge, trial invite |
| 3 | 51–75 | Active | `#3b82f6` blue | Conversion push, upgrade hint |
| 4 | 76–100 | Hot | `#10b981` green | Milestone celebration, referral |

THS day caps (trial users): Day 1 → max 30, Day 3 → max 70, Day 5+ → full 100.

Score momentum matters: a Tier 2 user with `+20 delta_14d` should be treated like Tier 3.

---

## 6. Scenario Catalog

| Scenario key | Trigger | Cohort | Tone |
|---|---|---|---|
| `welcome_free` | workspace_created | free | Warm, anchor on JTBD |
| `nudge_warming` | TRS crosses 30 | free | Encouraging, suggest next milestone |
| `invite_to_trial` | TRS crosses 50 | trial_ready_free | Confident, frame as unlocking a feature |
| `celebrate_activation` | THS crosses 60 | serious_trial | Celebratory, hint at paid unlock |
| `rescue_stalled` | THS < 30 at day 5+ | looking_trial | Concerned, offer concierge help |
| `convert_now` | Trial expiring 48h, THS ≥ 60 | serious_trial | Urgent but earned |
| `reactivate_expired` | trial_expired, no payment | expired_trial_warm | Empathetic, 3-message sequence |
| `thank_you_paid` | subscription_started | — | Gracious, power-user onboarding |
| `abandoner_reminder` | payment_info_added, no purchase 24h | — | Friendly, low-pressure |

Scenario eligibility is determined server-side by `GET /workspaces/{uuid}/scenarios/pending`. The agent only sends what the rules engine allows.

---

## 7. Email Paths

### Gmail (personal outreach)
Used for: trial and free user conversion  
Sent from: founder's connected Google Workspace account  
Tracked in: `taskip_internal_emails` + `taskip_internal_email_replies`

### Taskip System
Used for: paid user retention  
Sent via: `POST /workspaces/{uuid}/messages` — Taskip's own mail stack + in-app notification  
Tracked by: Insight API (`ai_messages_log` table on Taskip side) + `insightMessageId` stored locally

---

## 8. Database Schema

### `taskip_internal_suggestions`

| Column | Type | Notes |
|---|---|---|
| `id` | cuid2 PK | |
| `workspaceUuid` | text | Insight workspace UUID |
| `ownerEmail` | text | Recipient |
| `ownerName` | text | For display |
| `cohort` | text | Which cohort triggered this |
| `scenarioKey` | text | From pending scenarios endpoint |
| `score` | integer | Score at time of sweep |
| `scoreTier` | integer | 1–4 |
| `lifecycleState` | text | free / trial / paid / etc. |
| `daysSinceSignup` | integer | |
| `subject` | text | LLM-generated |
| `bodyMd` | text | LLM-generated markdown |
| `emailPath` | text | `gmail` or `taskip_system` |
| `status` | text | `pending` / `approved` / `sent` / `skipped` |
| `sentEmailId` | text | FK → taskipInternalEmails (gmail path) |
| `insightMessageId` | integer | ID from POST /messages (taskip_system path) |
| `approvedAt` | timestamp | |
| `sentAt` | timestamp | |
| `skippedAt` | timestamp | |
| `createdAt` | timestamp | |

### `taskip_internal_workspace_activity`

Full event log per workspace. The sweep reads this before acting on any workspace.

| Column | Type | Notes |
|---|---|---|
| `id` | cuid2 PK | |
| `workspaceUuid` | text | |
| `activityType` | text | See activity types below |
| `suggestionId` | text | FK → suggestions (nullable) |
| `emailId` | text | FK → taskipInternalEmails (nullable) |
| `score` | integer | Score at time of event |
| `cohort` | text | Cohort at time of event |
| `notes` | text | Reply snippet, skip reason, etc. |
| `createdAt` | timestamp | |

**Activity types:**

| Type | Written when |
|---|---|
| `suggestion_created` | Sweep generates a new draft |
| `email_sent` | Founder approves + Gmail sends |
| `email_replied` | Gmail reply synced via sweep processor |
| `suggestion_skipped` | Founder clicks Skip |
| `insight_message_sent` | Taskip system message delivered |
| `sweep_skipped_cooldown` | Sweep skips workspace due to 48h rule |
| `sweep_ignored` | 3 consecutive skips → workspace suppressed |

---

## 9. Sweep Decision Logic

Before generating a suggestion for any workspace, the sweep checks the activity log:

| Condition | Action |
|---|---|
| `email_sent` within 48h | Skip — log `sweep_skipped_cooldown` |
| `suggestion_created` (status=pending) exists | Skip — already queued, avoid duplicate |
| `suggestion_skipped` 3+ times in a row, no `email_sent` | Log `sweep_ignored` — stop generating until score changes by ≥10 pts |
| `email_replied` within 7 days | Skip — log `sweep_skipped_cooldown` with note "has active reply"; send Telegram alert once |
| `ai_messages_enabled=false` or `marketing_emails_enabled=false` | Skip silently |
| `eligible` scenarios list is empty | Skip — nothing to send right now (cooldown handled server-side) |

---

## 10. LLM Draft Prompt

```
You are writing a personalized email for the Taskip founder to review before sending.

Workspace: {workspace.name} ({workspace.days_in_state} days in {workspace.lifecycle_state})
Owner: {owner.first_name}
Cohort: {cohort} | Score: {score.value}/100 ({tier_label}) | Delta 14d: {score.delta_14d}
Scenario: {scenario.key} — {scenario.trigger_reason}
Tone: {scenario.spec.tone}
Personalization vars allowed: {scenario.spec.allowed_vars}

Top signals from score:
{top 3 score.signals as bullet list}

Recent message history (what was already sent):
{last 2 entries from lifecycle.recent_messages, or "none"}

Write a short, personal email referencing what the user actually DID.
Rules:
- Reference user actions (what they did), never behavior patterns or login counts
- Single CTA, named clearly
- No countdown timers, no exclamation marks doing emotional labor
- No "just checking in" or "we miss you"
- Max 120 words for body
- CTA URL must be on taskip.net or taskip.app

Return JSON only:
{ "subject": "...", "body_md": "...", "cta_text": "...", "cta_url": "..." }
```

---

## 11. API Routes

All routes require auth (`requiresAuth: true`) unless noted.

| Method | Path | Description |
|---|---|---|
| `GET` | `/taskip-internal/suggestions` | List suggestions; `?status=pending\|sent\|skipped\|all`; includes last 3 activity entries per workspace |
| `PATCH` | `/taskip-internal/suggestions/:id` | Edit subject/body/cta before approving |
| `POST` | `/taskip-internal/suggestions/:id/approve` | Approve → send email → log activity |
| `POST` | `/taskip-internal/suggestions/:id/skip` | Mark skipped → log `suggestion_skipped` |
| `POST` | `/taskip-internal/suggestions/sweep` | Manually trigger sweep now |
| `GET` | `/taskip-internal/workspace/:uuid/activity` | Full activity log for one workspace |

### Approve — Gmail path
1. Verify `status === 'pending'` and `emailPath === 'gmail'`
2. `emailService.send({ purpose: 'followup', recipient: ownerEmail, subject, body: bodyMd, workspaceUuid })`
3. Update suggestion: `status = 'sent'`, `sentEmailId`, `sentAt`
4. Write `email_sent` to activity log
5. Return `{ ok: true, emailId }`

### Approve — Taskip system path
1. Verify `status === 'pending'` and `emailPath === 'taskip_system'`
2. `insight.submitMessage(workspaceUuid, { scenario_key, channel: 'both', subject, body_md, cta_text, cta_url })`
3. Handle: `sent` → mark sent; `suppressed_cooldown` → mark skipped with note; `manual_review_pending` → keep pending
4. Write `insight_message_sent` to activity log
5. Return `{ ok: true, insightMessageId, insightStatus }`

---

## 12. Guardrails

| Rule | Enforcement |
|---|---|
| 48h cooldown per workspace | Activity log check (pre-generation) + server-side by Insight API (`suppressed_cooldown` response) |
| No auto-send | Every suggestion requires explicit approval click in UI or Telegram |
| Opt-out respected | `ai_messages_enabled=false` → skip before generation; `marketing_emails_enabled=false` → same |
| Workspace paused | Insight API returns `423`; handled in approve flow; suggestion marked skipped with note |
| Scenario allow-list | Only `scenario_key` values returned by `getPendingScenarios()` are used — no invented scenarios |
| Cold workspace suppression | 3 consecutive skips with no send → `sweep_ignored` activity → sweep stops generating |
| Tone rules | Enforced in prompt template + server-side validation by Insight API on `POST /messages` |
| CTA URL | Must match `taskip.net` or `taskip.app` — validated by Insight API on submission |

---

## 13. Files

### New files to create

| File | Purpose |
|---|---|
| `taskip-internal-sweep.service.ts` | Cohort scan + activity log check + LLM draft generation |
| `taskip-internal-sweep.processor.ts` | BullMQ processor — runs every 6h |
| `apps/api/drizzle/0061_taskip_internal_suggestions.sql` | Migration for both new tables |

### Files to modify

| File | Change |
|---|---|
| `schema.ts` | Add `taskipInternalSuggestions` + `taskipInternalWorkspaceActivity` |
| `taskip-insight.service.ts` | Add `getTrialFunnelHotList()`, `getTrialFunnelAtRiskList()`, `getTrialFunnelTrialReadyList()` |
| `agent.ts` | Add 6 suggestion + activity API routes |
| `taskip-internal.module.ts` | Register sweep service + processor + new queue |
| `queue.constants.ts` | Add `TASKIP_SUGGESTION_SWEEP = 'taskip-suggestion-sweep'` |
| `_journal.json` | Add migration 0061 entry |
| `AgentDetailPage.tsx` | Add Suggestions tab for taskip_internal agent key |

---

## 14. Frontend — Suggestions Tab

Tab: **Suggestions** (added to taskip_internal agent detail page)

**Header:** Pending count badge + "Run sweep now" button + last sweep timestamp

**Suggestion card:**
- Owner name, email, workspace name
- Cohort badge (color per cohort type) + Score tier badge (Tier 1–4 with colors from Section 5)
- Lifecycle state + days in state + score + delta arrow
- Email path badge: `Gmail` or `Taskip System`
- Subject (bold) + body preview (2 lines, expandable)
- Buttons: **Approve & Send** | **Edit** | **Skip**
- Expandable **Activity** section: last 3 events for this workspace

**Edit mode:** Inline textarea for subject + body + CTA fields. Save keeps status as pending. Separate Approve button sends.

**Filter bar:** All / Pending / Sent / Skipped

---

## 15. Verification Checklist

1. `insight_base_url` + `insight_agent_key_primary` set in Settings
2. Gmail connected (GmailService)
3. `POST /taskip-internal/suggestions/sweep` — returns count per cohort
4. Telegram message received with sweep summary
5. Suggestions tab shows cards with correct tier badges and score data
6. Approve Gmail-path suggestion → Gmail outbox receives it, `taskip_internal_emails` row created, `email_sent` in activity log
7. Approve Taskip-system-path suggestion → `insightMessageId` stored, `insight_message_sent` in activity log
8. Skip → `suggestion_skipped` in activity log
9. Workspace activity tab shows full timeline
10. Re-sweep within 48h → same workspace skipped (`sweep_skipped_cooldown` in log)
11. Skip same workspace 3 times → `sweep_ignored` logged, next sweep skips it entirely
