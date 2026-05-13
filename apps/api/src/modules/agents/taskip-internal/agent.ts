import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { agents, taskipInternalOps, taskipInternalSuggestions, taskipInternalWorkspaceActivity } from '../../../db/schema';
import { AgentRegistryService } from '../runtime/agent-registry.service';
import { AgentLogService } from '../runtime/agent-log.service';
import { LlmRouterService } from '../../llm/llm-router.service';
import { TelegramService } from '../../telegram/telegram.service';
import { TaskipInternalDbService } from './taskip-internal-db.service';
import { TaskipInsightService, InsightApiError, type InsightCohort, type InsightMarketingSuggestion, type InsightSubmitMessage } from './taskip-insight.service';
import { TaskipInternalEmailService, type TaskipEmailPurpose } from './taskip-internal-email.service';
import { TaskipInternalSuggestionSweepService } from './taskip-internal-suggestion-sweep.service';
import { TASKIP_SUGGESTION_SWEEP_QUEUE } from './taskip-internal-suggestion-sweep.processor';
import { KillSwitchService, type KillSwitchAction } from '../../safety/kill-switch.service';
import { KnowledgeBaseService } from '../../knowledge-base/knowledge-base.service';
import { SpamCheckerService } from '../../spam-checker/spam-checker.service';
import { SettingsService } from '../../settings/settings.service';
import { GmailService } from '../../gmail/gmail.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { LlmToolMessage, ToolDefinition } from '../../llm/llm.types';
import type {
  IAgent,
  TriggerSpec,
  TriggerEvent,
  RunContext,
  AgentContext,
  ProposedAction,
  ActionResult,
  McpToolDefinition,
  AgentApiRoute,
} from '../runtime/types';
import { agentLlmOpts } from '../runtime/llm-config.util';

interface TaskipInternalConfig {
  llm?: { provider?: string; model?: string };
}

interface TaskipInternalSnapshot {
  query: string;
  config: TaskipInternalConfig;
  history?: string;
  runId?: string;
  source?: string;
}

const SYSTEM_PROMPT = `You are an internal ops assistant for Sharifur Rahman, founder of Taskip.

GOLDEN RULE: You NEVER send an email, lifecycle message, or marketing suggestion automatically. Every write action (send_email, insight_submit_message, insight_submit_marketing_suggestion, extend_trial, mark_refund) requires explicit human approval. Propose the action and stop — the approval gate handles delivery.

---

## What Taskip is — READ THIS BEFORE INTERPRETING ANY METRIC

Taskip is a **client portal platform for freelancers and agencies**. Workspace owners are freelancers or agency owners. Their clients are the people they work for and invoice.

This changes how every metric must be interpreted:

| Metric | What it means in Taskip |
|---|---|
| invoices_total | Invoices the workspace owner has issued **to their clients** — not payments owed to Taskip |
| invoices_paid | How many of those client invoices have been marked paid |
| invoices_total > 0, invoices_paid = 0 | Owner has billed clients but hasn't received payment yet — billing friction on the client side |
| contacts_total | Number of clients the owner has added to their portal |
| leads_total | Potential new clients in the owner's pipeline |
| projects_total | Active client projects the owner is managing |
| tasks_total | Tasks across all their projects |

CRITICAL IMPLICATION: When you see invoices_total > 0 and invoices_paid = 0, the owner is **waiting to get paid by their client**, not waiting to pay Taskip. Never write an email that implies the owner owes money to anyone.

The owner's goal is to: manage client projects, collect payment from clients, grow their client base.
Sharifur's goal is to help the owner succeed at that — so they stay on Taskip and eventually upgrade.

---

## Read tools

Taskip DB: lookup_user (unified search: email/uuid/url/name) / query_subscriptions / query_invoices / summarize_user_history
Insight (cohort): insight_list_cohort / insight_trial_funnel_hot / insight_trial_funnel_at_risk / insight_trial_funnel_trial_ready / insight_trial_funnel_stats
Insight (workspace): insight_get_overview / insight_get_lifecycle / insight_pending_scenarios / insight_recent_messages / insight_recommended_actions
Insight (write): insight_log_agent_action
Agent queue (read): list_workspace_suggestions / list_sent_emails / sync_email_replies

lookup_user search modes:
- By email: { emailOrId: "user@example.com" }  → exact match, full stats
- By url: { url: "xgenious" } or { url: "xgenious.taskip.app" } → exact match
- By uuid: { uuid: "xxxxxxxx-xxxx-..." } → exact match
- By name: { name: "Acme" } → returns candidate list (mode="name_search"), pick a uuid then call insight_get_lifecycle

## Write tools (ALL approval-gated — propose only, never execute directly)

- send_email — Gmail outbound for FREE and TRIAL cohorts only
- insight_submit_message — Insight lifecycle delivery for PAID cohorts only
- insight_submit_marketing_suggestion — marketing queue for any cohort; human reviews before send
- extend_trial / mark_refund — Taskip DB mutations

---

## Channel routing — CRITICAL

| Cohort | Channel to use |
|---|---|
| serious_trial, looking_trial, ignore_trial, expired_trial_warm, expired_trial_cold | send_email (Gmail — personal founder tone) |
| trial_ready_free, nurture_free, activate_free, ignore_free | send_email (Gmail — personal founder tone) |
| healthy_paid, expanding_paid, at_risk_paid, dormant_paid | insight_submit_message (Insight system delivery) |

Never use send_email for paid-plan workspaces.
Never use insight_submit_message for free or trial workspaces.

---

## Score thresholds

| Score type | When active | Priority guidance |
|---|---|---|
| CHS (Customer Health) | paid cohorts | < 40 = act now, 40–70 = monitor, > 70 = healthy |
| TRS (Trial Readiness) | free cohorts | > 70 = upgrade candidate, 50–70 = nurture |
| THS (Trial Health) | trial cohorts | > 60 = on track, < 40 = stalled — intervene |

THS day-caps: Day 1 max 30 (Tier 2), Day 3 max 70 (mid-Tier 3), Day 5+ full range. A low THS on Day 1 is expected — don't over-react.
THS alt-activation: invoices_total > 0 OR leads_total > 0 OR contacts_total >= 3 counts as activated even if the event stream didn't fire. Do NOT send activation nudges to already-activated workspaces.

## Score tier model (4-band, applies to TRS / THS / CHS equally)

| Tier | Range | Label | Meaning |
|---|---|---|---|
| 1 | 0–25 | Cold | New or dormant. No meaningful engagement. |
| 2 | 26–50 | Warming | Some activity, not deeply engaged. Most free/early-trial users land here. |
| 3 | 51–75 | Active | Regularly using core features. Worth a personal nudge. |
| 4 | 76–100 | Hot | Highly engaged. High conversion probability. < 5% of trial users. |

Always read score_delta_14d alongside the score value. A Tier 2 workspace with delta_14d=+20 is trending into Tier 3 — treat them accordingly. A Tier 3 with delta_14d=-25 is at risk of falling.

## Lifecycle states

Workspaces pass through: free → trial → paid (or expired_trial → churned). The lifecycle_state field is on every cohort list item and lifecycle snapshot. Use it to:
- Distinguish free users (TRS) from trial users (THS) even when both appear in overlap cohorts
- Skip sending trial-specific copy to expired or churned workspaces
- Route correctly: free/trial/expired → send_email; paid → insight_submit_message

---

## Valid scenario_key values (insight_submit_message only)

NEVER invent or guess a scenario_key. Before calling insight_submit_message, you MUST call insight_pending_scenarios(workspace_uuid) first.
Use ONLY a scenario_key that appears in insight_pending_scenarios.eligible[].scenario_key for that workspace.
If the eligible list is empty, skip this workspace — do not submit a message.

---

## Intent detection — READ THIS FIRST before every response

Check for CONTINUATION intent FIRST before anything else.

**CONTINUATION intent** — When the system message includes "CONTINUATION MODE ACTIVE", this overrides ALL other intent rules.
→ Do NOT re-run cohort queries. Do NOT re-list workspaces. Do NOT ask for confirmation again.
→ Process the specified workspaces through SPAR, accumulate all emails, call batch_send_email once.

**RETRY intent** — When the system message includes "CONTINUATION MODE ACTIVE — RETRY":
→ Re-process only the listed failed recipients. Look each one up, run SPAR, call batch_send_email.

**SELECTION intent** — When the user sends multiple comma-separated numbers (e.g. "2,4,5,6,7" or "1,3") AND the prior assistant message showed a numbered workspace list AND you just asked which workspaces to process:
→ The numbers are LIST POSITIONS (1-indexed), NOT workspace IDs or UUIDs.
→ Map each position to the workspace "uuid" field from the prior insight_list_cohort results. NEVER pass a position number as workspace_uuid.
→ Run SPAR for each selected workspace using its UUID, then call batch_send_email.
→ Single bare number (e.g. "1") without a preceding outreach prompt = DETAIL LOOKUP, not SELECTION.

**DETAIL LOOKUP intent** — When the user says something like "share details about 1", "tell me about 2", "details on 3", "more info on 1", "look up 4", "show me 2", "expand 3", "what about 5", "any updates on 3", "describe 4", "1?" — i.e. any phrase or single number referencing a position from a prior numbered workspace list:
→ This is NOT a new query. Do NOT call insight_list_cohort again. NEVER.
→ The number is a LIST POSITION (1-indexed) from the most recently shown numbered workspace list in this conversation.
→ The prior tool result JSON is NOT available in this turn — resolve via name: call lookup_user(name="WorkspaceName") where WorkspaceName is the name shown at that position in the prior assistant message.
→ Then call insight_get_lifecycle with the UUID returned by lookup_user.
→ Return the details. STOP. Do not propose outreach unless the user asks.
→ NEGATIVE EXAMPLES — these are DETAIL LOOKUP, not READ — do NOT re-run insight_list_cohort for:
  "tell me about 1", "share details about 2", "what about 3", "1", "show me 2", "any updates on 5"

**DRY-RUN intent** — phrases: "show me first", "preview", "draft only", "what would you send", "dry run", "don't send yet", "let me see", "let me review"
→ Run the full SPAR workflow for each relevant workspace. Do NOT call batch_send_email or send_email.
→ Instead, output all generated drafts as formatted text: for each workspace show "**Workspace**: Name | **To**: email | **Subject**: ... | **Body**: first 2 lines..."
→ End with: "Reply 'send them' to dispatch all, or give a number selection to send specific ones."
→ NOTE: "show me N" or "show me about N" with a position number = DETAIL LOOKUP, not DRY-RUN. DRY-RUN fires only when "show me first" / "preview" appears with no list-position number.

**READ intent** — keywords: list, show, find, get, what, how many, check, who, display, summarize, overview, drill into, look up, give me, tell me
→ Run read tools only. Return the data. STOP. Do NOT propose any write action unless the user explicitly asked for one.
→ MANDATORY EXCEPTION: if the user message contains a number AND a numbered workspace list appeared in the prior assistant message, it is ALWAYS DETAIL LOOKUP — never READ. Keywords like "share", "details", "tell me", "show me", "look up", "give me" followed by a list-position number are DETAIL LOOKUP, not READ. Do NOT re-run insight_list_cohort.
→ READ fires only for queries with no number referencing a prior list (e.g. "list at_risk workspaces", "how many trial users", "show me user X's history").

**ACTION intent** — keywords: propose, suggest, send, submit, draft, extend, refund, reach out, outreach, write email, create suggestion
→ Follow the outreach workflow below. Use batch_send_email when multiple workspaces are confirmed.

**TONE OVERRIDE** — If the user includes a tone modifier anywhere in their message, override SPAR Step 4 for all emails in this session:
- "aggressive" / "direct" / "push hard" → shorter, assertive, question is pointed
- "soft" / "gentle" / "low-pressure" → exploratory, no pressure, one soft observation
- "ultra-brief" / "very short" → max 3 sentences + sign-off, single blunt question
- "warm" / "friendly" / "casual" → conversational, genuine, like a founder to a peer

If the message is ambiguous and there is NO prior conversation context, treat it as READ. Never auto-escalate to an action.

Examples:
- "List at_risk_paid workspaces" → READ — return the list, nothing else
- "Show me user X's history" → READ — return the data
- "Propose retention outreach for workspace Y" → ACTION — draft and propose
- "2,4,5,6,7" after a numbered workspace list → SELECTION — process those 5 workspaces
- "yes" / "go" / "proceed" after a confirmation prompt → CONTINUATION — execute immediately
- "show me first" / "dry run" → DRY-RUN — generate drafts, do not send
- "retry" / "retry failed" → RETRY — resend only the failed ones from the last batch
- "send them aggressive" → CONTINUATION + TONE OVERRIDE aggressive
- "share details about 1" after a numbered list → DETAIL LOOKUP — call lookup_user(name=pos1Name), then insight_get_lifecycle
- "tell me about 2" after a numbered list → DETAIL LOOKUP — do NOT re-run insight_list_cohort
- "what about 5" after a numbered list → DETAIL LOOKUP — not READ
- "1" alone after a numbered list (no pending outreach prompt) → DETAIL LOOKUP — not SELECTION
- "show me 3" after a numbered list → DETAIL LOOKUP — not DRY-RUN
- "any updates?" with no number → READ — no outreach

---

## User type badge

Every time you present a workspace (single detail, list item, or batch result), prepend a tier badge on the FIRST line:
- Cohort contains "paid" → badge: [PAID]
- Cohort contains "trial" → badge: [TRIAL]
- Cohort contains "free" → badge: [FREE]
- Cohort is "uncategorized" or unknown → badge: [UNKNOWN]

Format a single workspace header as:
[PAID] WorkspaceName — Score: N — at_risk_paid

In a numbered list, format as:
1. [PAID] WorkspaceName — Score: N
2. [TRIAL] WorkspaceName — Score: N
3. [FREE] WorkspaceName — Score: N

Never omit the badge. It must be the first thing on the line.

---

## Workflow for READ queries

Call the relevant read tool(s), format the results clearly, and reply. Do not call any write tool. Do not propose any action at the end.

---

## Workflow for ACTION queries (outreach)

**Single workspace:** Use send_email (requires approval).

**Multi-workspace batch (CONTINUATION / SELECTION mode):**
Phase 1 — For each selected workspace: call insight_get_lifecycle to get owner email + full metrics.
Phase 2 — Dedup + reply-aware skip:
  - Call insight_recent_messages: if a message was sent in the last 7 days → note "recently contacted, skipping" and move on.
  - Call list_sent_emails(workspaceUuid=...): if any email has replyCount > 0 → note "already engaged (replied), skipping" and move on.
  - Only process workspaces that pass both checks.
Phase 3 — Run full SPAR workflow (Steps 1-8) per workspace. Accumulate all email drafts.
Phase 4 — Call batch_send_email once with ALL accumulated emails. Single approval for the whole batch.
  - If ALL workspaces were skipped (all contacted/replied) → return a notify_result explaining why each was skipped instead.
Phase 5 — insight_log_agent_action for each workspace (success or skipped with reason).

**Standard single-workspace flow:**
Phase 1 — insight_list_cohort(cohort, per_page=5, min_score=0). Pick top 3-5 by score/urgency.
Phase 2 — for each candidate: insight_get_overview → insight_recent_messages → list_workspace_suggestions.
  Skip if: contacted in the last 7 days OR pending suggestion exists OR replyCount > 0 on a recent email.
Phase 3 — insight_pending_scenarios to confirm scenario eligibility.
Phase 4 — propose ONE action using the correct channel. Stop.
Phase 5 — insight_log_agent_action(result=success|skipped, reason=...).

**When presenting a workspace list for selection:**
- Always number items: "1. [PAID] WorkspaceName — Score: N [contacted 2d ago]" — include the tier badge ([PAID]/[TRIAL]/[FREE]) and flag recently-contacted workspaces inline.
- Include ALL workspaces in the list (don't pre-filter) — the user decides whether to include contacted ones.
- End with: "Reply with numbers to select (e.g. '1,3,5') or 'all' to process everything."
- The numbering must be sequential starting from 1 with no gaps.

**Dedup annotation when listing:**
For each workspace in the list, check insight_recent_messages in parallel. If contacted in last 7 days, append "[contacted Xd ago]". If any prior email has replyCount > 0, append "[replied — engaged]". This annotation is informational only.

insight_get_overview returns: plan, cohort, score, score_type, score_delta_14d, activation_event_hit, volume_metrics (invoices_total, invoices_paid, contacts_total, leads_total, projects_total, tasks_total), session (last_active_at, is_active_now). Ground all outreach copy in these real numbers.

Always look up the user/workspace before a write operation. Final answer goes to Telegram — be concise.

---

## SPAR Email Reasoning System — run every step in order, show output for each

### Step 1 — Signal Inventory

Classify every data point you have into three buckets. Be specific — include actual numbers and dates.

**Behavior signals** (what they actively DID — with recency):
- List each: "issued 1 invoice to a client [3 days ago]", "added 12 tasks across projects [last week]", "last active [yesterday]"
- Remember: invoices are sent TO clients, contacts are clients they manage, leads are prospective clients
- Recency matters: signal from yesterday = high weight; signal from 2+ weeks ago = low weight

**Gap signals** (what they have NOT done relative to what active users do):
- List each: "0 clients added", "0 leads in pipeline", "no projects created", "1 invoice sent but 0 paid — client hasn't paid yet"
- invoices_paid = 0 means their CLIENT hasn't paid them, not that they owe Taskip money
- Note whether this gap is surprising given their other activity

**Momentum signals** (trajectory — are they accelerating or stalling?):
- score_delta_14d: positive = improving, negative = declining, zero = flat
- is_active_now vs last_active_at gap: active today but score dropping = friction
- invoices_paid vs invoices_total: low paid ratio = owner is having trouble collecting from clients

Then: **rank ALL valid signals** from strongest to weakest. Do NOT stop at the first signal. List at least 2-3 candidates before deciding. A single invoice with 0 paid is WEAK unless it is the ONLY signal — because a workspace with any active behavior (tasks, projects, contacts, recent login) has stronger non-financial signals. Invoice data alone does not justify invoice_followup angle if other activity signals are present.

---

### Step 2 — Persona Inference

Before picking a tone, infer what kind of user this is from the data:

| Data pattern | Inferred persona | Tone adjustment |
|---|---|---|
| invoices > 0, 0 contacts, 0 leads | Solo freelancer billing without a full client system | "You're sending invoices — have you tried adding the client to the portal so they can see everything in one place?" |
| invoices > 0, invoices_paid = 0 | Owner waiting to get paid by client | Angle: help them use Taskip's payment follow-up or client portal to accelerate payment — never imply THEY owe money |
| High contacts + projects, low invoices | Agency managing work but not billing through Taskip | "Projects are running but billing isn't wired in yet — worth setting up" |
| High tasks + contacts, 0 leads | Active manager, no new pipeline | Pipeline / growth angle — leads feature |
| High everything, improving score | Power user | Affirming, feature-depth angle |
| Low everything, active recently | Early explorer | Patient, one-thing-at-a-time, no overwhelm |
| Low everything, went quiet | Disengaged | Ultra-short, single direct question only |

State the inferred persona in one line. It determines word choice and what NOT to mention.

---

### Step 3 — Prior Email Check

Before picking an angle: check list_sent_emails for this workspace.

- If a gap-nudge was sent before → do NOT send another gap-nudge. Pick a different angle.
- If an achievement email was sent before → follow up on what happened next, don't repeat the same praise.
- If an invoice_followup email was sent before → ELIMINATE invoice_followup from Step 5 candidates entirely — use any other angle.
- If nothing was sent → any angle is valid.

State: "Prior angle used: [angle or none]". If prior angle was used, explicitly confirm it is eliminated from Step 5.

**ANGLE DIVERSITY RULE:** Even when nothing was sent before, do NOT default to invoice_followup when other activity signals exist. Different workspaces must receive different angles based on their specific strongest signal — not the same template applied to everyone with invoices_paid=0. Variety is not optional.

---

### Step 4 — Cohort Length Cap

Hard length caps by cohort. When the cap conflicts with a style's default length, use whichever is shorter:

| Cohort | Max words | Notes |
|---|---|---|
| serious_trial | 65 | Direct, one specific feature gap |
| looking_trial | 60 | Low-pressure, exploratory |
| ignore_trial | 35 | BLUNT style only — one observation, one question |
| expired_trial_warm | 55 | Reference what they built during trial, not what they missed |
| expired_trial_cold | 30 | BLUNT or DIRECT only — last attempt, nothing to lose |
| activate_free / nurture_free | 65 | Feature-specific, "you can do X with what you already have" |

---

### Step 4b — Writing Style Selection

Each email must use exactly one style. Styles differ in vocabulary, opener, sentence structure, and length — not just warmth level. The goal: no two emails in a batch should sound like they came from the same template, even if the angle is similar.

**Style Library:**

**[A] CURIOUS** — Peer asking a genuine question
- Voice: You noticed something specific and want to understand the "why" before assuming.
- Opener pattern: "Noticed you've got [data point] — [question]?"
- Length: 40–55 words
- CTA: Yes/no or single-sentence-answer question
- Vocabulary: "noticed", "curious about", "wondering if", "makes sense if" — contractions throughout
- Example: "Noticed you've got 4 active projects but no invoices sent yet. Are you billing clients through a different tool, or is that part you haven't gotten to?"

**[B] BLUNT** — One observation, one question, done
- Voice: No padding. You respect their time. Two sentences after the greeting.
- Opener pattern: [Observation in one sentence]. [Question]?
- Length: 20–32 words (body after greeting, before sign-off)
- CTA: Direct yes/no
- Vocabulary: Short declarative words. No "just", no softeners, no lead-up phrases.
- Example: "3 projects in Taskip for 2 weeks and no invoices sent. Billing somewhere else?"

**[C] EMPATHETIC** — Acknowledges friction before asking
- Voice: You see what they ARE doing and acknowledge that the missing piece is probably hard to get to given everything else.
- Opener pattern: Name their active behavior → acknowledge the gap is probably hard to reach → ask what's in the way
- Length: 55–70 words
- CTA: Open-ended — "what's holding that up?" / "is there something blocking it?"
- Vocabulary: "I know", "makes sense that", "hard to find time for", "on top of everything", "whenever you get a chance"
- Example: "You've got 3 client projects active and tasks across all of them — clearly a lot going on. Is getting invoicing set up through Taskip something you haven't had a chance to reach yet, or is there a reason you're handling it elsewhere?"

**[D] CHALLENGER** — Light contrast with what similar users do
- Voice: You've seen what users like them do and you're genuinely curious why they're doing it differently. Not judgemental — curious.
- Opener pattern: "Most [user type] [common behavior] — you've [their different behavior]. Intentional?"
- Length: 45–60 words
- CTA: "Is that intentional?" / "Deliberate choice?" / "Is that how you prefer to work?"
- Vocabulary: "most", "usually", "typically", "you've done the opposite", "different from what I usually see"
- Example: "Most people on Taskip connect their clients to the portal before sending invoices. You've done it the other way — 2 invoices out but no clients added yet. Is that how you normally run it?"

**[E] WARM** — Casual, colleague-like, "Hey" opener
- Voice: Like a Slack message from someone who noticed something and is genuinely asking. Peer to peer, not founder to user.
- Opener pattern: Always start with "Hey [first name]," — never "Hi" for this style
- Length: 45–60 words
- CTA: Soft easy question — "what's the plan there?" / "how are you usually handling that?"
- Vocabulary: Full contractions, casual phrases. "caught my eye", "quick one", "how are you usually", "what's the deal with"
- Example: "Hey — quick one. You've got contacts in there but no projects started yet. How are you usually tracking that work — different tool, or just haven't gotten to it?"

**[F] DIRECT** — Efficient, data first, question second
- Voice: You have one specific data-anchored question. You get to it in sentence 1. No preamble.
- Opener pattern: State the metric in sentence 1. Ask the question in sentence 2. Stop.
- Length: 30–45 words
- CTA: Binary — "X or Y?" preferred
- Vocabulary: Numbers first, active verbs, no lead-up. Reads like a short executive email.
- Example: "You've got 3 active projects and 2 invoices sent, but no clients in the portal. Are you using Taskip for billing only, or is the client side next?"

**Selection rules (evaluate in order):**

Step 1 — Angle-to-style default:
| Angle | Primary | Fallback |
|---|---|---|
| Re-engagement | C (EMPATHETIC) | E (WARM) |
| Friction probe | A (CURIOUS) | F (DIRECT) |
| Billing gap | B (BLUNT) | F (DIRECT) |
| Pipeline gap | D (CHALLENGER) | A (CURIOUS) |
| Gap-contrast | D (CHALLENGER) | A (CURIOUS) |
| Achievement-bridge | E (WARM) | F (DIRECT) |
| Client portal adoption | D (CHALLENGER) | E (WARM) |
| Invoice followup | B (BLUNT) | F (DIRECT) |

Step 2 — Cohort hard override (takes precedence over Step 1):
- ignore_trial, expired_trial_cold → B (BLUNT) only
- looking_trial, expired_trial_warm → C (EMPATHETIC) or E (WARM) only

Step 3 — Batch rotation: In a multi-workspace batch, if the default style for this workspace matches the previous workspace's style, use the fallback style instead. Never use the same style three times in a row.

State in your output: **Style: [A] CURIOUS** (or whichever you picked).

---

### Step 5 — Angle Selection

**PRIORITY ORDER — evaluate top-to-bottom, stop at the first match. invoice_followup is LAST RESORT.**

| Priority | Condition | Angle | Opening line pattern |
|---|---|---|---|
| 1 | Momentum declining (score_delta negative) AND recent activity | Re-engagement | "You were active on [thing] — went quiet after [date]. Something block you?" |
| 2 | Score < 35 AND active in last 7 days | Friction probe | "You've been in there — is something not clicking?" |
| 3 | Projects running + tasks + 0 invoices | Billing gap | "You've got [N] projects active but haven't billed yet — do you normally invoice outside Taskip?" |
| 4 | High contacts + active + 0 leads | Pipeline gap | "No clients or leads yet — have you tried the client invite feature?" |
| 5 | Gap that contradicts active behavior (tasks/projects exist but something key is zero) | Gap-contrast | "You've got [behavior] going — noticed [gap] hasn't been touched." |
| 6 | Positive behavior + obvious next feature | Achievement-bridge | "Saw you've got [metric] set up — [next feature] is what most people do next." |
| 7 | High invoices + 0 contacts in portal | Client portal adoption | "You're billing [N] clients but they're not in the portal yet — they're missing the full picture." |
| 8 (LAST RESORT) | invoices > 0, invoices_paid = 0, AND no other signal from priorities 1-7 qualifies | Invoice followup | "You've got [N] invoice out — has your client seen it?" |

**CRITICAL RULES:**
- invoice_followup (priority 8) ONLY fires when ALL higher-priority conditions failed AND the invoice gap is literally the only activity signal.
- If a workspace has tasks, projects, contacts, or any recent activity alongside invoices_paid=0, it does NOT qualify for priority 8 — use the behavior signal instead.
- If prior outreach angle was invoice_followup: skip priority 8 entirely, use the next available priority.
- Different workspaces in the same batch MUST use different angles where signals differ. Never apply the same angle to two workspaces without explicitly checking that their signals are identical.
- State which priority matched and why all higher priorities were skipped.

No mixing. One angle, one focus.

---

### Step 6 — Subject Line (TWO options, style-matched)

Goal: the subject must sound like it was written by the same person who wrote the body in the style chosen in Step 4b. A BLUNT body with a WARM subject reads like two different people wrote the email.

Write two subject options keyed to your selected style. Fill every [bracket] with real data — no placeholders in the final output:

**Style A (CURIOUS):**
- Option 1: "do you [gap activity] outside Taskip?" / "curious about your [specific thing]"
- Option 2: "you've got [metric] - quick question" / "noticed [specific thing] - wondering why"

**Style B (BLUNT):**
- Option 1: "[N] [thing] - [gap]?" (e.g. "3 projects - no invoices?") / "[specific gap] - intentional?"
- Option 2: "[observation] - billing elsewhere?" / "[N] [things], 0 [other thing]?"

**Style C (EMPATHETIC):**
- Option 1: "getting [missing thing] set up while doing client work?" / "is [gap] something you haven't had a chance to reach?"
- Option 2: "[missing thing] - hard to find time for?" / "something getting in the way of [gap]?"

**Style D (CHALLENGER):**
- Option 1: "most [user type] do [X] first - you skipped it?" / "[behavior] before [other thing] - on purpose?"
- Option 2: "[N] [thing] but 0 [other thing] - deliberate?" / "you've done the opposite of what I usually see"

**Style E (WARM):**
- Option 1: "quick one about [specific thing]" / "your [metric] caught my eye"
- Option 2: "how are you handling [gap]?" / "[specific behavior] - what's the plan there?"

**Style F (DIRECT):**
- Option 1: "[N] [things] - [specific question in 3-4 words]?" / "[metric] in - [Y] or [Z]?"
- Option 2: "[specific gap] - [Y] or [Z]?" / "[thing] only, or also [other thing]?"

Output both options. Mark which you recommend and why (one sentence).

Hard rules for all styles:
- Max 8 words
- Lowercase preferred
- Plain ASCII only — no em dashes, smart quotes, ellipsis; use plain hyphen (-)
- NEVER: "Welcome to", "Quick check-in", "Touching base", "Just checking in", "How are things going", "[Name] I wanted to reach out", exclamation marks, anything generic enough to apply to any user
- NEVER in subject: "invoice out", "invoice overdue", "payment due", "unpaid", "outstanding", "reminder", "following up"

---

### Step 7 — Body Draft

**Primary goal: get a reply.** Every word must serve that goal. Write as if you are Sharifur sending a 1:1 message to one specific person — not a template to a segment.

Follow the body rules for the style you selected in Step 4b:

**[A] CURIOUS body rules:**
- Greeting: "Hi [first name],"
- Sentence 1–2: Lead with "Noticed" + the specific data point. Fold the question into the same sentence or the next one. No preamble.
- Sentence 3 (optional): One sentence of context if the question isn't self-explanatory.
- Sign-off: "Sharifur"
- Word count: 40–55 words

**[B] BLUNT body rules:**
- Greeting: "Hi [first name],"
- Sentence 1: State the single strongest signal as a flat observation. Real numbers, active verbs.
- Sentence 2: Ask the question. One sentence. No softening.
- Nothing else. No context sentences. No "just curious".
- Sign-off: "Sharifur"
- Word count: 20–32 words (body only)

**[C] EMPATHETIC body rules:**
- Greeting: "Hi [first name],"
- Sentence 1–2: Name something they ARE doing well (with the real metric). Show you've paid attention.
- Sentence 3: Acknowledge the gap is probably hard to reach — not a criticism, a genuine recognition.
- Sentence 4: Ask what's in the way. Open-ended, not yes/no.
- Sign-off: "Sharifur"
- Word count: 55–70 words

**[D] CHALLENGER body rules:**
- Greeting: "Hi [first name],"
- Sentence 1: State what most similar users do. Brief, no condescension. "Most people on Taskip..."
- Sentence 2: Contrast with their specific data. "You've done the opposite" / "you've skipped that".
- Sentence 3: Ask if it's intentional. Tone is curious, not critical.
- Sign-off: "Sharifur"
- Word count: 45–60 words

**[E] WARM body rules:**
- Greeting: "Hey [first name]," — always "Hey", not "Hi"
- Sentence 1: Casual observation — "quick one" or "caught my eye" or "noticed something".
- Sentence 2–3: State what you noticed and ask in a conversational, non-formal way.
- Sentence 4 (optional): Add one casual follow-up only if it makes the question clearer.
- Sign-off: "Sharifur"
- Word count: 45–60 words

**[F] DIRECT body rules:**
- Greeting: "Hi [first name],"
- Sentence 1: State the specific metric up front. No lead-up. Numbers first.
- Sentence 2: Ask the question as a binary — "X or Y?" format preferred.
- Nothing else. If it can be said in 2 sentences, it should be.
- Sign-off: "Sharifur"
- Word count: 30–45 words

---

**Rules that apply to ALL styles:**

Banned words/phrases: "cohort", "score", "trial", "expired", "platform", "onboarding", "system", "automated", "just wanted to", "hope this finds you", "feel free to reach out", "don't hesitate", "let me know if you have any questions", "get what you're owed", "ensure you get", "what you're owed", "following up could help", "speed up the process", "outstanding invoice", "overdue", "unpaid invoice", "payment is due", "reminder to pay"

Product framing — NEVER:
- WRONG: "you haven't made a payment" / "you owe" / "complete the payment" → owner is not paying Taskip
- WRONG: "get the most out of Taskip" / "your experience" → too generic
- RIGHT: "your client hasn't paid yet — have you followed up?" → owner is collecting from THEIR client
- RIGHT: Reference what Taskip helps them do: manage clients, run projects, collect payment from clients, grow pipeline

---

### Step 8 — Self-Score

Score your own draft on this question: **"If I got this email from someone I vaguely knew, would I reply within 24 hours?"**

Rate 1–5:
- 5: yes, I'd reply within the hour — the question is specific and easy to answer
- 4: probably yes — clear question, feels personal
- 3: might open, probably ignore — too vague or too long
- 2: would ignore — reads like a template
- 1: would mark spam

If score < 4: the body question is probably too vague or the subject doesn't match it. Rewrite both so the subject hints at the same specific thing the body asks. Re-score. Only present the final version.

If score >= 4: output the draft.

---

### Final output format

**Signal:** [the single strongest signal in one line]
**Persona:** [inferred persona in one line]
**Angle:** [chosen angle]
**Style:** [A/B/C/D/E/F — Name] — [one sentence why this style fits this person]
**Prior outreach angle:** [angle used before, or "none"]

**To:** [recipient email address — exact email from the workspace owner record]

**Subject A:** [option 1]
**Subject B:** [option 2]
**Recommended:** A or B — [one sentence why]

**Email:**
[the draft]

**Self-score:** [N/5] — [one sentence: does it sound like the chosen style? would this specific person reply?]`;

const MAX_TOOL_ITERATIONS = 25; // raised to support batch processing (up to 7 workspaces × 3 tools each)

// ─── Continuation helpers ─────────────────────────────────────────────────────

function isAffirmative(text: string): boolean {
  return /^(yes|y|go|proceed|confirm|ok|sure|do it|send|approve|let'?s go|send them|send it|yep|yeah|continue|start|execute|all of them|all|fire away|retry|retry failed|try again|resend|re-?send)[\s.,!]*$/i.test(text.trim());
}

function detectToneOverride(text: string): string | null {
  const t = text.toLowerCase();
  if (/\b(aggressive|direct|push hard|assertive)\b/.test(t)) return 'aggressive';
  if (/\b(soft|gentle|low.?pressure|subtle)\b/.test(t)) return 'soft';
  if (/\b(ultra.?brief|very short|2.?3 sentences|one.?liner)\b/.test(t)) return 'ultra-brief';
  if (/\b(warm|friendly|personal|casual)\b/.test(t)) return 'warm';
  return null;
}

function isRetry(text: string): boolean {
  return /\b(retry|try again|resend|re-?send|retry failed|send failed|failed ones)\b/i.test(text.trim());
}

function parseSelectionNumbers(text: string): number[] | null {
  // Match "2,4,5,6,7" or "1 2 3" or "items 2, 4 and 7" or "proceed with 2,4,5"
  const cleaned = text.replace(/proceed with|items?|numbers?|pick|select/gi, '');
  const matches = cleaned.match(/\b\d{1,2}\b/g);
  if (!matches || matches.length < 1) return null;
  const nums = [...new Set(matches.map(Number))].filter(n => n >= 1 && n <= 50);
  return nums.length ? nums : null;
}

function extractNumberedItems(text: string): Map<number, string> {
  const map = new Map<number, string>();
  // Match "1. Workspace name" or "1) Workspace name" or "**1.** Workspace"
  for (const line of text.split('\n')) {
    const m = line.match(/^\*{0,2}(\d{1,2})[.)]\*{0,2}\s+(.+)/);
    if (m) {
      const name = m[2].replace(/\*\*/g, '').replace(/\s*-\s*Score:.*$/, '').replace(/\s*—.*$/, '').trim();
      map.set(Number(m[1]), name);
    }
  }
  return map;
}

function extractFailedEmails(text: string): string[] {
  // Parse failed recipients from batch result messages like "[2/5] Failed: email@example.com — reason"
  const matches = [...text.matchAll(/Failed:\s*([^\s,—–]+@[^\s,—–]+)/gi)];
  return matches.map(m => m[1].trim()).filter(Boolean);
}

function extractEmailDraft(text: string): { subject: string; body: string; to?: string } | null {
  // SPAR format: **Subject A/B:** ... **Email:** ... body ... **Self-score:**
  // Match the LAST **Email:** that acts as a section break (followed by newline only).
  // Workspace context lines like **Email:** user@domain.com won't match — value on same line.
  const emailSectionRe = /\*{0,2}Email:\*{0,2}[ \t]*\n/gi;
  let emailMarkerIdx = -1;
  let lastMatchLen = 0;
  let m: RegExpExecArray | null;
  while ((m = emailSectionRe.exec(text)) !== null) { emailMarkerIdx = m.index; lastMatchLen = m[0].length; }
  if (emailMarkerIdx >= 0) {
    const bodyRaw = text.slice(emailMarkerIdx + lastMatchLen);
    const selfScoreIdx = bodyRaw.search(/\n\*{0,2}Self-score:/i);
    const body = (selfScoreIdx >= 0 ? bodyRaw.slice(0, selfScoreIdx) : bodyRaw).trim();

    const recommendedMatch = text.match(/\*{0,2}Recommended:\*{0,2}\s*([AB])\b/i);
    const pick = recommendedMatch ? recommendedMatch[1].toUpperCase() : 'A';
    const subjectMatch = text.match(new RegExp(`\\*{0,2}Subject\\s*${pick}:\\*{0,2}\\s*([^\\n]+)`, 'i'))
      ?? text.match(/\*{0,2}Subject\s*[AB]?:\*{0,2}\s*([^\n]+)/i);
    const subject = subjectMatch ? subjectMatch[1].trim().replace(/^["']|["']$/g, '').replace(/\*+$/g, '').trim() : '';
    const toMatch = text.match(/\*{0,2}To:\*{0,2}\s*([^\s\n]+)/i);
    if (subject && body) return { subject, body, to: toMatch?.[1]?.trim() };
  }

  // Legacy format: **Subject:** ... **Body:**
  const subjectRe = /\*{0,2}Subject:\*{0,2}\s*(.+)/i;
  const bodyRe = /\*{0,2}Body:\*{0,2}\s*\n?([\s\S]+)/i;
  const subjectMatch = text.match(subjectRe);
  if (!subjectMatch) return null;
  const bodyMatch = text.slice(text.search(subjectRe)).match(bodyRe);
  if (!bodyMatch) return null;
  const subject = subjectMatch[1].trim().replace(/^["']|["']$/g, '').trim();
  const body = bodyMatch[1].trim();
  if (subject && body) return { subject, body };
  return null;
}

const DETAIL_LOOKUP_RE =
  /\b(?:share|tell\s+me|show\s+me|give\s+me|look\s+up|more\s+info(?:rmation)?|what\s+about|any\s+updates?\s+on|expand|detail(?:s)?\s+(?:about|on|for)?|info\s+(?:about|on)?|describe)\s+(?:about\s+|on\s+|for\s+)?(?:#\s*)?(\d{1,2})\b/i;

function isDetailLookup(text: string): number | null {
  const m = text.trim().match(DETAIL_LOOKUP_RE);
  return m ? parseInt(m[1], 10) : null;
}

function buildContinuationHint(query: string, lastAgentMsg: string | null | undefined): string | null {
  if (!lastAgentMsg) return null;

  const affirmative = isAffirmative(query);
  const numbers = parseSelectionNumbers(query);
  const hasPendingPrompt = /would you like|shall i|want to proceed|say.{0,20}(yes|go|confirm)|pick numbers|proceed\?|confirm\?|which.*would you/i.test(lastAgentMsg);
  const toneOverride = detectToneOverride(query);
  const toneNote = toneOverride ? `\nTONE OVERRIDE: Use "${toneOverride}" tone — override SPAR Step 4 cohort calibration with this tone for all emails in this batch.` : '';

  // ─── Retry failed ────────────────────────────────────────────────────────
  if (isRetry(query)) {
    const failedEmails = extractFailedEmails(lastAgentMsg);
    if (failedEmails.length > 0) {
      return `\n\nCONTINUATION MODE ACTIVE — RETRY: The prior batch had ${failedEmails.length} failure(s). Re-process ONLY these recipients: ${failedEmails.join(', ')}. Look up each workspace by email, run SPAR, call batch_send_email with the retried emails only. Do NOT re-process the ones that succeeded.${toneNote}`;
    }
  }

  // ─── Detail lookup (phrase + number) ─────────────────────────────────────
  const detailPosition = isDetailLookup(query);
  if (detailPosition !== null) {
    const items = extractNumberedItems(lastAgentMsg);
    if (items.size > 0) {
      const workspaceName = items.get(detailPosition);
      if (workspaceName) {
        return `\n\nDETAIL LOOKUP MODE: User wants details on position ${detailPosition} from the prior list = "${workspaceName}". Call lookup_user(name="${workspaceName}") to get the workspace UUID, then call insight_get_lifecycle with that UUID. Do NOT call insight_list_cohort. Do NOT propose outreach. Return the lifecycle details and stop.`;
      }
      return `\n\nDETAIL LOOKUP MODE: User wants details on position ${detailPosition} from the prior list but that position was not found. Ask the user to clarify or resend the list.`;
    }
  }

  // ─── Single bare number without pending outreach prompt = detail lookup ───
  if (numbers?.length === 1 && !hasPendingPrompt) {
    const items = extractNumberedItems(lastAgentMsg);
    if (items.size > 0) {
      const workspaceName = items.get(numbers[0]);
      if (workspaceName) {
        return `\n\nDETAIL LOOKUP MODE: User replied with a single number "${numbers[0]}" referencing position ${numbers[0]} from the prior list = "${workspaceName}". Call lookup_user(name="${workspaceName}"), then call insight_get_lifecycle with the resolved UUID. Do NOT call insight_list_cohort. Do NOT propose outreach.`;
      }
    }
  }

  // ─── Number selection ────────────────────────────────────────────────────
  if (numbers?.length) {
    const items = extractNumberedItems(lastAgentMsg);
    const selected = numbers.map(n => ({ n, name: items.get(n) ?? `item ${n}` }));
    const names = selected.map(s => `${s.n}. ${s.name}`).join(', ');
    return `\n\nCONTINUATION MODE ACTIVE: The user selected ${numbers.length} item(s) from your prior numbered list: ${names}. Process ONLY these ${numbers.length} workspace(s) through the full SPAR workflow. For each: call insight_get_lifecycle to get the owner email and metrics, run SPAR Steps 1-8, generate the email draft, then call batch_send_email once with ALL emails accumulated. Do NOT list workspaces again. Do NOT ask for confirmation. Start processing immediately.${toneNote}`;
  }

  // ─── Affirmative confirmation ─────────────────────────────────────────────
  if (affirmative && hasPendingPrompt) {
    return `\n\nCONTINUATION MODE ACTIVE: The user confirmed with "${query}". Resume the action you were about to propose in your prior turn. Do NOT re-list workspaces. Do NOT re-ask for confirmation. Execute the outreach workflow immediately and call batch_send_email with the generated emails.${toneNote}`;
  }

  // ─── Tone-only on an existing selection context ───────────────────────────
  if (toneOverride && hasPendingPrompt) {
    return `\n\nCONTINUATION MODE ACTIVE: Apply "${toneOverride}" tone override and resume the pending action from the prior turn.${toneNote}`;
  }

  return null;
}

@Injectable()
export class TaskipInternalAgent implements IAgent, OnModuleInit {
  readonly key = 'taskip_internal';
  readonly name = 'Taskip Internal';
  private readonly logger = new Logger(TaskipInternalAgent.name);

  private fromDomainCache: string | null = null;

  constructor(
    private db: DbService,
    private llm: LlmRouterService,
    private telegram: TelegramService,
    private taskipDb: TaskipInternalDbService,
    private insight: TaskipInsightService,
    private emails: TaskipInternalEmailService,
    private suggestionSweep: TaskipInternalSuggestionSweepService,
    private killSwitch: KillSwitchService,
    private registry: AgentRegistryService,
    private logSvc: AgentLogService,
    private kb: KnowledgeBaseService,
    private spamChecker: SpamCheckerService,
    private settings: SettingsService,
    private gmail: GmailService,
    @InjectQueue(TASKIP_SUGGESTION_SWEEP_QUEUE) private readonly suggestionSweepQueue: Queue,
  ) {}

  private async getFromDomain(): Promise<string> {
    if (this.fromDomainCache) return this.fromDomainCache;
    try {
      const raw = await this.gmail.getFromAddress();
      const match = raw.match(/<([^>]+)>/) ?? raw.match(/^(\S+@\S+)$/);
      const email = match?.[1] ?? raw;
      const domain = email.includes('@') ? email.split('@')[1].trim() : '';
      if (domain) {
        this.fromDomainCache = domain;
        return domain;
      }
    } catch { /* fall through to settings fallback */ }
    const raw = (await this.settings.getDecrypted('ses_default_from')) ?? '';
    const match = raw.match(/<([^>]+)>/) ?? raw.match(/^(\S+@\S+)$/);
    const email = match?.[1] ?? raw;
    const domain = email.includes('@') ? email.split('@')[1].trim() : '';
    this.fromDomainCache = domain;
    return domain;
  }

  onModuleInit() {
    this.registry.register(this);
  }

  triggers(): TriggerSpec[] {
    return [{ type: 'MANUAL' }];
  }

  async buildContext(trigger: TriggerEvent, run: RunContext): Promise<AgentContext> {
    const config = await this.getConfig();
    const payload = run.triggerPayload as { query?: string; history?: string; source?: string } | null;
    const query = payload?.query ?? 'No query provided';
    const history = payload?.history;
    const source = payload?.source ?? 'run';

    return {
      source: trigger,
      snapshot: { query, config, history, runId: run.id, source } satisfies TaskipInternalSnapshot,
      followups: (run.context as AgentContext | null)?.followups ?? [],
    };
  }

  async decide(ctx: AgentContext): Promise<ProposedAction[]> {
    const { query, config, history, runId, source } = ctx.snapshot as TaskipInternalSnapshot;
    const followupNote = ctx.followups.at(-1)?.text;

    const effectiveQuery = followupNote
      ? `${query}\n\nAdditional instruction: ${followupNote}`
      : query;

    const priorMessages: LlmToolMessage[] = [];
    if (history) {
      for (const line of history.split('\n')) {
        if (line.startsWith('User: ')) priorMessages.push({ role: 'user', content: line.slice(6) });
        else if (line.startsWith('Agent: ')) priorMessages.push({ role: 'assistant', content: line.slice(7) });
      }
    }

    // ─── Continuation detection ───────────────────────────────────────────────
    const lastAgentMsg = priorMessages.filter(m => m.role === 'assistant').at(-1)?.content as string | null | undefined;
    const continuationHint = buildContinuationHint(query, lastAgentMsg);
    const isContinuation = continuationHint !== null;

    const [alwaysOn, kbRefs] = await Promise.all([
      this.kb.getAlwaysOnContext(this.key, 'Taskip').catch(() => []),
      this.kb.searchEntries(effectiveQuery, this.key, 5, 'Taskip').catch(() => []),
    ]);

    const kbBlock = this.buildKbBlock(alwaysOn, kbRefs);

    const tools = this.buildToolDefinitions();
    const systemContent = [SYSTEM_PROMPT, kbBlock || null, continuationHint || null].filter(Boolean).join('\n\n');
    const messages: LlmToolMessage[] = [
      { role: 'system', content: systemContent },
      ...priorMessages,
      { role: 'user', content: effectiveQuery },
    ];

    let spamRevisions = 0;
    const MAX_SPAM_REVISIONS = 2;

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      if (runId) {
        await this.logSvc.debug(runId, 'LLM call', { event_type: 'llm_call', iteration: i });
      }
      const result = await this.llm.completeWithTools({
        ...agentLlmOpts(config),
        agentKey: this.key,
        runId,
        messages,
        tools,
        maxTokens: isContinuation ? 3000 : 800,
        temperature: 0.2,
      });

      if (result.type === 'text') {
        // Auto spam-check any email draft embedded in the text response
        const draft = extractEmailDraft(result.content);
        if (draft && spamRevisions < MAX_SPAM_REVISIONS) {
          if (runId) {
            await this.logSvc.info(runId, 'Spam check: scoring chat draft', {
              event_type: 'spam_check_start',
              email_count: 1,
              subject: draft.subject.slice(0, 60),
            });
          }
          const spamCheckStart = Date.now();
          const fromDomain = await this.getFromDomain();
          const spamResult = await this.spamChecker.score({
            subject: draft.subject,
            textBody: draft.body,
            fromAddress: '',
            fromDomain,
            recipient: draft.to ?? '',
            isTransactional: true,
          });
          const spamCheckMs = Date.now() - spamCheckStart;
          if (runId) {
            await this.logSvc.info(runId, `Spam check: ${spamResult.grade}(${spamResult.score})`, {
              event_type: 'spam_check_end',
              duration_ms: spamCheckMs,
              grade: spamResult.grade,
              score: spamResult.score,
              failed_count: spamResult.score < 60 ? 1 : 0,
              revision: spamRevisions,
            });
          }
          if (spamResult.score < 60) {
            spamRevisions++;
            const topIssues = spamResult.issues
              .filter((iss: { severity: string }) => iss.severity === 'critical' || iss.severity === 'high')
              .slice(0, 5)
              .map((iss: { ruleId: string; message: string; suggestedFix: string }) => `  - [${iss.ruleId}] ${iss.message} -> ${iss.suggestedFix}`)
              .join('\n');
            this.logger.warn(`Chat draft spam check failed: ${spamResult.grade}(${spamResult.score}) — revision ${spamRevisions}/${MAX_SPAM_REVISIONS}`);
            if (runId) {
              await this.logSvc.info(runId, `Spam rewrite triggered: ${spamResult.grade}(${spamResult.score}) — revision ${spamRevisions}/${MAX_SPAM_REVISIONS}`, {
                event_type: 'spam_rewrite_triggered',
                grade: spamResult.grade,
                score: spamResult.score,
                revision: spamRevisions,
                top_issues: topIssues || null,
              });
            }
            messages.push({ role: 'assistant', content: result.content });
            messages.push({
              role: 'user',
              content: `SPAM CHECK FAILED — grade: ${spamResult.grade} (score: ${spamResult.score}/100). The draft above will likely be filtered as spam. Rewrite the email to fix these issues:\n\n${topIssues || 'Reduce urgency language, avoid invoice/payment keywords in subject, soften CTA.'}\n\nKeep the same recipient, intent, and tone. Output a new SPAR draft only.`,
            });
            continue;
          }
        }
        return [{
          type: 'notify_result',
          summary: 'Send query result via Telegram',
          payload: { message: result.content, query, source },
          riskLevel: 'low',
        }];
      }

      // Append assistant message with tool calls
      messages.push({
        role: 'assistant',
        content: null,
        tool_calls: result.tool_calls,
      });

      for (const tc of result.tool_calls) {
        let args: Record<string, unknown>;
        try {
          args = JSON.parse(tc.arguments);
        } catch {
          args = {};
        }

        // Write operations require approval — surface as ProposedAction
        if (tc.name === 'extend_trial' || tc.name === 'mark_refund') {
          const summary = tc.name === 'extend_trial'
            ? `Extend trial for user ${args.userId} by ${args.days ?? 7} day(s)`
            : `Mark refund for user ${args.userId}, invoice ${args.invoiceId}`;

          return [{
            type: tc.name,
            summary,
            payload: { ...args, _query: query },
            riskLevel: 'high',
          }];
        }

        if (tc.name === 'insight_submit_marketing_suggestion') {
          const summary = `Submit marketing suggestion for workspace ${args.workspace_uuid} (${args.template_key})`;
          return [{
            type: 'insight_submit_marketing_suggestion',
            summary,
            payload: { ...args, _query: query },
            riskLevel: 'high',
          }];
        }

        if (tc.name === 'send_email') {
          const summary = `Send ${args.purpose ?? 'other'} email to ${args.recipient} — "${(args.subject as string ?? '').slice(0, 60)}"`;
          return [{
            type: 'send_email',
            summary,
            payload: { ...args, _query: query },
            riskLevel: 'high',
          }];
        }

        if (tc.name === 'batch_send_email') {
          const emails = args.emails as Array<{ recipient: string; subject: string; body: string; workspace_uuid?: string; purpose?: string }>;
          if (!Array.isArray(emails) || emails.length === 0) {
            messages.push({ role: 'tool', content: JSON.stringify({ error: 'emails array is empty' }), tool_call_id: tc.id });
            break;
          }

          const fromDomain = await this.getFromDomain();
          if (runId) {
            await this.logSvc.debug(runId, `Spam check: scoring ${emails.length} email(s)`, {
              event_type: 'spam_check_start',
              email_count: emails.length,
            });
          }
          const spamCheckStart = Date.now();
          const spamResults = await Promise.all(
            emails.map(async (e) => {
              const result = await this.spamChecker.score({
                subject: e.subject ?? '',
                textBody: e.body ?? '',
                fromAddress: '',
                fromDomain,
                recipient: e.recipient ?? '',
                isTransactional: true,
              });
              return { recipient: e.recipient, subject: e.subject, score: result.score, grade: result.grade, issues: result.issues, criticalFailures: result.criticalFailures };
            }),
          );
          const spamCheckMs = Date.now() - spamCheckStart;

          const failures = spamResults.filter(r => r.score < 60);

          if (runId) {
            const scoresSummaryLog = spamResults.map(r => `${r.recipient}: ${r.grade}(${r.score})`).join(', ');
            await this.logSvc.debug(runId, `Spam check: ${failures.length > 0 ? `${failures.length} failed` : 'all passed'}`, {
              event_type: 'spam_check_end',
              duration_ms: spamCheckMs,
              scores: scoresSummaryLog,
              failed_count: failures.length,
              revision: spamRevisions,
            });
          }

          if (failures.length > 0 && spamRevisions < MAX_SPAM_REVISIONS) {
            spamRevisions++;
            const feedbackLines = failures.map(r => {
              const topIssues = r.issues
                .filter(i => i.severity === 'critical' || i.severity === 'high')
                .slice(0, 5)
                .map(i => `  - [${i.ruleId}] ${i.message} → ${i.suggestedFix}`)
                .join('\n');
              return `${r.recipient} — grade: ${r.grade} (score: ${r.score})\n${topIssues}`;
            }).join('\n\n');

            this.logger.warn(`Spam check blocked batch: ${failures.length}/${emails.length} emails failed — revision ${spamRevisions}/${MAX_SPAM_REVISIONS}`);
            messages.push({
              role: 'tool',
              content: JSON.stringify({
                ok: false,
                spamCheckFailed: true,
                message: `SPAM CHECK FAILED — ${failures.length} of ${emails.length} email(s) scored below inbox threshold (grade SPAM_RISK or BLOCK). Revise the flagged emails and call batch_send_email again. Do NOT send as-is.\n\n${feedbackLines}`,
              }),
              tool_call_id: tc.id,
            });
            break;
          }

          // All passed (or max revisions reached — proceed with grade warnings)
          const count = emails.length;
          const preview = emails.slice(0, 3).map(e => `${e.recipient} — "${(e.subject ?? '').slice(0, 40)}"`).join(', ');
          const scoresSummary = spamResults.map(r => `${r.grade}(${r.score})`).join(', ');
          const hasWarnings = spamResults.some(r => r.score < 75);
          const summary = `Send ${count} email${count !== 1 ? 's' : ''} (batch): ${preview}${count > 3 ? ` + ${count - 3} more` : ''} | Spam: ${scoresSummary}`;
          if (hasWarnings) {
            this.logger.warn(`Batch proceeding with spam warnings: ${scoresSummary}`);
          }
          return [{
            type: 'batch_send_email',
            summary,
            payload: { emails, _query: query, spamScores: spamResults.map(r => ({ recipient: r.recipient, score: r.score, grade: r.grade })), source },
            riskLevel: 'high',
          }];
        }

        if (tc.name === 'insight_submit_message') {
          const summary = `Send Insight ${args.scenario_key} message to workspace ${args.workspace_uuid} (${args.channel})`;
          return [{
            type: 'insight_submit_message',
            summary,
            payload: { ...args, _query: query },
            riskLevel: 'high',
          }];
        }

        // Auto-resolve numeric workspace_uuid → real UUID from prior cohort list results
        const NEEDS_WORKSPACE_UUID = [
          'insight_get_lifecycle', 'insight_get_overview', 'insight_recommended_actions',
          'insight_pending_scenarios', 'insight_recent_messages', 'insight_log_agent_action',
          'list_workspace_suggestions', 'lookup_workspace_owner',
        ];
        if (NEEDS_WORKSPACE_UUID.includes(tc.name) && /^\d+$/.test(String(args.workspace_uuid ?? ''))) {
          const position = parseInt(String(args.workspace_uuid), 10);
          for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i] as { role: string; content?: string };
            if (msg.role === 'tool' && typeof msg.content === 'string') {
              try {
                const parsed = JSON.parse(msg.content);
                const items: Array<{ uuid?: string }> | null = Array.isArray(parsed)
                  ? parsed
                  : Array.isArray(parsed?.data) ? parsed.data : null;
                if (items && items.length > 0 && items[0]?.uuid) {
                  const item = items[position - 1];
                  if (item?.uuid) { args = { ...args, workspace_uuid: item.uuid }; break; }
                }
              } catch { /* skip non-JSON tool results */ }
            }
          }
        }

        // Read-only tools — execute and feed result back
        const argsSummary = Object.entries(args).map(([k, v]) => `${k}: ${String(v).slice(0, 40)}`).join(', ');
        const insightEndpointHint = tc.name === 'lookup_user'
          ? `/search?${args.uuid ? `uuid=${args.uuid}` : args.url ? `url=${args.url}` : args.name ? `name=${args.name}` : `email=${encodeURIComponent(String(args.emailOrId ?? args.email ?? ''))}`}`
          : tc.name === 'lookup_workspace_owner' || tc.name === 'insight_get_lifecycle'
          ? `/workspaces/${String(args.workspace_uuid ?? args.workspaceUuid ?? '')}/lifecycle`
          : tc.name === 'insight_get_overview'
          ? `/workspaces/${String(args.workspace_uuid ?? '')}/overview`
          : null;
        if (runId) {
          await this.logSvc.debug(runId, `Tool call: ${tc.name}`, {
            event_type: 'tool_call_start',
            tool: tc.name,
            args_summary: argsSummary,
            ...(insightEndpointHint ? { endpoint: insightEndpointHint } : {}),
          });
        }
        const toolCallStart = Date.now();
        const toolResult = await this.executeReadTool(tc.name, args);
        const durationMs = Date.now() - toolCallStart;
        const isError = toolResult && typeof toolResult === 'object' && 'error' in (toolResult as object);
        if (runId) {
          const errorMsg = isError ? String((toolResult as { error: unknown }).error) : undefined;
          const responsePreview = JSON.stringify(toolResult).slice(0, 500);
          await this.logSvc.debug(runId, `Tool result: ${tc.name}`, {
            event_type: 'tool_call_end',
            tool: tc.name,
            duration_ms: durationMs,
            success: !isError,
            error: errorMsg,
            response_preview: responsePreview,
          });
        }
        messages.push({
          role: 'tool',
          content: JSON.stringify(toolResult),
          tool_call_id: tc.id,
        });
      }
    }

    return [{
      type: 'notify_result',
      summary: 'Send query result via Telegram',
      payload: { message: 'Could not produce a final answer within the iteration limit.', query, source },
      riskLevel: 'low',
    }];
  }

  requiresApproval(action: ProposedAction): boolean {
    if (action.type === 'batch_send_email') {
      const p = action.payload as { source?: string };
      return p.source !== 'chat';
    }
    return action.type === 'extend_trial'
      || action.type === 'mark_refund'
      || action.type === 'insight_submit_marketing_suggestion'
      || action.type === 'insight_submit_message'
      || action.type === 'send_email';
  }

  async execute(action: ProposedAction): Promise<ActionResult> {
    const killSwitchActions: KillSwitchAction[] = ['extend_trial', 'mark_refund', 'send_email', 'insight_submit_marketing_suggestion', 'insight_submit_message'];
    if (killSwitchActions.includes(action.type as KillSwitchAction)) {
      const blocked = await this.killSwitch.isBlocked(action.type as KillSwitchAction);
      if (blocked) {
        const msg = `Blocked by kill switch: ${action.type}`;
        await this.telegram.sendMessage(msg);
        return { success: false, error: msg };
      }
    }
    switch (action.type) {
      case 'notify_result': {
        const p = action.payload as { message: string; query: string; source?: string };
        if (p.source !== 'chat') {
          await this.telegram.sendMessage(`Taskip Internal\n\n${p.message}`);
        }
        return { success: true, data: { notified: true } };
      }

      case 'extend_trial': {
        const { userId, days = 7, _query } = action.payload as {
          userId: string;
          days?: number;
          _query?: string;
        };

        await this.db.db.insert(taskipInternalOps).values({
          runId: 'executed',
          opType: 'extend_trial',
          payload: { userId, days, query: _query },
          status: 'executing',
        });

        const result = await this.taskipDb.extendTrial(userId, Number(days));

        await this.db.db.insert(taskipInternalOps).values({
          runId: 'executed',
          opType: 'extend_trial',
          payload: { userId, days, result },
          status: result.success ? 'executed' : 'failed',
          executedAt: new Date(),
        });

        const msg = result.success
          ? `Trial extended for user ${userId} by ${days} day(s). New end: ${result.newTrialEndsAt ?? 'unknown'}`
          : `Failed to extend trial for user ${userId}`;
        await this.telegram.sendMessage(msg);
        return { success: result.success, data: result };
      }

      case 'mark_refund': {
        const { userId, invoiceId, _query } = action.payload as {
          userId: string;
          invoiceId: string;
          _query?: string;
        };

        const result = await this.taskipDb.markRefund(userId, invoiceId);

        await this.db.db.insert(taskipInternalOps).values({
          runId: 'executed',
          opType: 'mark_refund',
          payload: { userId, invoiceId, query: _query, result },
          status: result.success ? 'executed' : 'failed',
          executedAt: new Date(),
        });

        const msg = result.success
          ? `Invoice ${invoiceId} for user ${userId} marked as refund_requested`
          : `Failed to mark refund for invoice ${invoiceId}`;
        await this.telegram.sendMessage(msg);
        return { success: result.success, data: result };
      }

      case 'send_email': {
        const { _query, purpose, recipient, subject, body, workspaceUuid } = action.payload as {
          _query?: string;
          purpose?: TaskipEmailPurpose;
          recipient: string;
          subject: string;
          body: string;
          workspaceUuid?: string;
        };
        const result = await this.emails.send({
          purpose: purpose ?? 'other',
          recipient,
          subject,
          body,
          workspaceUuid,
          metadata: _query ? { query: _query } : undefined,
        });
        const msg = result.status === 'sent'
          ? `Email sent to ${recipient} — "${subject}". Tracked as ${result.id}.`
          : `Failed to send email to ${recipient}: ${result.error}`;
        await this.telegram.sendMessage(msg);
        return { success: result.status === 'sent', data: result };
      }

      case 'insight_submit_message': {
        const { _query, workspace_uuid, ...payload } = action.payload as InsightSubmitMessage & { _query?: string; workspace_uuid: string };
        try {
          const result = await this.insight.submitMessage(workspace_uuid, payload);
          await this.db.db.insert(taskipInternalOps).values({
            runId: 'executed',
            opType: 'insight_submit_message',
            payload: { query: _query, workspace_uuid, request: payload, result },
            status: 'executed',
            executedAt: new Date(),
          });
          await this.insight.logAgentAction(workspace_uuid, {
            action_type: 'lifecycle_message_submitted',
            result: result.status === 'sent' || result.status === 'manual_review_pending' ? 'success' : 'skipped',
            reason: result.status,
            payload: { message_id: result.id, scenario_key: payload.scenario_key, channel: result.channel },
          }).catch((err) => this.logger.warn(`logAgentAction failed: ${(err as Error).message}`));
          await this.telegram.sendMessage(
            `Insight message #${result.id} ${result.status} for ${workspace_uuid} (${payload.scenario_key}, ${payload.channel})`,
          );
          return { success: true, data: result };
        } catch (err) {
          const message = (err as Error).message;
          await this.db.db.insert(taskipInternalOps).values({
            runId: 'executed',
            opType: 'insight_submit_message',
            payload: { query: _query, workspace_uuid, request: payload, error: message },
            status: 'failed',
            executedAt: new Date(),
          });
          await this.telegram.sendMessage(`Insight message failed for ${workspace_uuid}: ${message}`);
          return { success: false, error: message };
        }
      }

      case 'batch_send_email': {
        const { emails, _query, source: batchSource, spamScores } = action.payload as {
          emails: Array<{
            recipient: string;
            subject: string;
            body: string;
            workspace_uuid?: string;
            purpose?: TaskipEmailPurpose;
          }>;
          _query?: string;
          source?: string;
          spamScores?: Array<{ recipient: string; score: number; grade: string }>;
        };
        const isChatBatch = batchSource === 'chat';
        if (!Array.isArray(emails) || emails.length === 0) {
          return { success: false, error: 'batch_send_email: emails array is empty' };
        }
        if (!isChatBatch) {
          await this.telegram.sendMessage(`Starting batch: ${emails.length} email${emails.length !== 1 ? 's' : ''} — 100–300s gap between sends`);
        }
        let sent = 0;
        const failedEmails: Array<{ recipient: string; subject: string; error: string }> = [];
        const results: unknown[] = [];
        for (const [idx, email] of emails.entries()) {
          // Human-paced delay between emails (skip before the first one)
          if (idx > 0) {
            const delaySec = 100 + Math.floor(Math.random() * 201); // 100–300s
            if (!isChatBatch) {
              await this.telegram.sendMessage(`[${idx}/${emails.length}] Waiting ${delaySec}s before next send…`);
            }
            await new Promise(resolve => setTimeout(resolve, delaySec * 1000));
          }
          const spamMeta = spamScores?.find(s => s.recipient === email.recipient);
          try {
            const result = await this.emails.send({
              purpose: email.purpose ?? 'followup',
              recipient: email.recipient,
              subject: email.subject,
              body: email.body,
              workspaceUuid: email.workspace_uuid,
              metadata: {
                ...(_query ? { query: _query } : {}),
                batchIndex: idx,
                ...(spamMeta ? { spamScore: spamMeta.score, spamGrade: spamMeta.grade } : {}),
              },
            });
            if (result.status === 'sent') {
              sent++;
              if (!isChatBatch) {
                await this.telegram.sendMessage(`[${idx + 1}/${emails.length}] Sent to ${email.recipient}`);
              }
            } else {
              failedEmails.push({ recipient: email.recipient, subject: email.subject, error: result.error ?? 'send failed' });
              if (!isChatBatch) {
                await this.telegram.sendMessage(`[${idx + 1}/${emails.length}] Failed: ${email.recipient} — ${result.error ?? 'unknown error'}`);
              }
            }
            results.push(result);
          } catch (err) {
            failedEmails.push({ recipient: email.recipient, subject: email.subject, error: (err as Error).message });
            if (!isChatBatch) {
              await this.telegram.sendMessage(`[${idx + 1}/${emails.length}] Error: ${email.recipient} — ${(err as Error).message}`);
            }
            results.push({ error: (err as Error).message });
          }
        }
        const failedCount = failedEmails.length;
        if (!isChatBatch) {
          let summaryMsg = `Batch complete: ${sent} sent, ${failedCount} failed`;
          if (failedCount > 0) {
            const failedList = failedEmails.map(f => `Failed: ${f.recipient} — ${f.error}`).join('\n');
            summaryMsg += `\n\nFailed recipients:\n${failedList}\n\nReply "retry failed" to re-attempt these ${failedCount} email${failedCount !== 1 ? 's' : ''}.`;
          }
          await this.telegram.sendMessage(summaryMsg);
        }
        return { success: failedCount === 0, data: { sent, failed: failedCount, failedEmails, results } };
      }

      case 'insight_submit_marketing_suggestion': {
        const { _query, ...payload } = action.payload as InsightMarketingSuggestion & { _query?: string };
        try {
          const result = await this.insight.submitMarketingSuggestion(payload);
          await this.db.db.insert(taskipInternalOps).values({
            runId: 'executed',
            opType: 'insight_marketing_suggestion',
            payload: { query: _query, request: payload, result },
            status: 'executed',
            executedAt: new Date(),
          });
          await this.insight.logAgentAction(payload.workspace_uuid, {
            action_type: 'marketing_suggestion_submitted',
            result: 'success',
            payload: { suggestion_id: result.id, template_key: payload.template_key },
          }).catch((err) => this.logger.warn(`logAgentAction failed: ${(err as Error).message}`));
          await this.telegram.sendMessage(
            `Marketing suggestion #${result.id} submitted for ${payload.workspace_uuid} (${payload.template_key}, status: ${result.status})`,
          );
          return { success: true, data: result };
        } catch (err) {
          const message = (err as Error).message;
          await this.db.db.insert(taskipInternalOps).values({
            runId: 'executed',
            opType: 'insight_marketing_suggestion',
            payload: { query: _query, request: payload, error: message },
            status: 'failed',
            executedAt: new Date(),
          });
          await this.telegram.sendMessage(`Marketing suggestion failed for ${payload.workspace_uuid}: ${message}`);
          return { success: false, error: message };
        }
      }

      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  mcpTools(): McpToolDefinition[] {
    return [
      {
        name: 'lookup_user',
        description: 'Find a Taskip workspace by owner email address via the Insight API. Returns workspace stats including owner details, cohort, score, and 60-day activity.',
        inputSchema: {
          type: 'object',
          properties: { emailOrId: { type: 'string', description: 'owner email address' } },
          required: ['emailOrId'],
        },
        handler: async (input) => {
          const { emailOrId } = input as { emailOrId: string };
          return this.insight.searchByEmail(emailOrId);
        },
      },
      {
        name: 'lookup_workspace_owner',
        description: 'Resolve a workspace UUID to its owner via the Insight API lifecycle endpoint. Returns the full lifecycle snapshot including owner.email, owner.first_name, workspace state, score, and recent messages.',
        inputSchema: {
          type: 'object',
          properties: { workspaceUuid: { type: 'string', description: 'Taskip workspace UUID' } },
          required: ['workspaceUuid'],
        },
        handler: async (input) => {
          const { workspaceUuid } = input as { workspaceUuid: string };
          return this.insight.getLifecycle(workspaceUuid);
        },
      },
      {
        name: 'query_subscriptions',
        description: 'Get subscription history for a Taskip user',
        inputSchema: {
          type: 'object',
          properties: { userId: { type: 'string' } },
          required: ['userId'],
        },
        handler: async (input) => {
          const { userId } = input as { userId: string };
          return this.taskipDb.querySubscriptions(userId);
        },
      },
      {
        name: 'query_invoices',
        description: 'List invoices for a Taskip user',
        inputSchema: {
          type: 'object',
          properties: { userId: { type: 'string' } },
          required: ['userId'],
        },
        handler: async (input) => {
          const { userId } = input as { userId: string };
          return this.taskipDb.queryInvoices(userId);
        },
      },
      {
        name: 'summarize_user_history',
        description: 'LLM summary of a user journey — looks up user, subscriptions, and invoices',
        inputSchema: {
          type: 'object',
          properties: { emailOrId: { type: 'string' } },
          required: ['emailOrId'],
        },
        handler: async (input) => {
          const { emailOrId } = input as { emailOrId: string };
          const user = await this.taskipDb.lookupUser(emailOrId);
          if (!user) return { error: 'User not found' };
          const [subs, invoices] = await Promise.all([
            this.taskipDb.querySubscriptions(user.id),
            this.taskipDb.queryInvoices(user.id),
          ]);
          return { user, subscriptions: subs, invoices };
        },
      },
    ];
  }

  apiRoutes(): AgentApiRoute[] {
    return [
      {
        method: 'GET',
        path: '/taskip-internal/lookup',
        requiresAuth: true,
        handler: async (params) => {
          const { q } = params as { q?: string };
          if (!q) throw new Error('?q= required');
          return this.taskipDb.lookupUser(q);
        },
      },
      {
        method: 'GET',
        path: '/taskip-internal/insight/status',
        requiresAuth: true,
        handler: async (params) => {
          const { workspaceUuid } = params as { workspaceUuid?: string };
          return this.insight.status(workspaceUuid);
        },
      },
      {
        method: 'GET',
        path: '/taskip-internal/inbox',
        requiresAuth: true,
        handler: async (params) => {
          const { limit, purpose, workspaceUuid } = params as {
            limit?: string;
            purpose?: TaskipEmailPurpose;
            workspaceUuid?: string;
          };
          return this.emails.listSent({
            limit: limit ? parseInt(limit, 10) : undefined,
            purpose,
            workspaceUuid,
          });
        },
      },
      {
        method: 'GET',
        path: '/taskip-internal/inbox/:id',
        requiresAuth: true,
        handler: async (params) => {
          const { id } = params as { id: string };
          const detail = await this.emails.getDetail(id);
          if (!detail) throw new Error('Email not found');
          return detail;
        },
      },
      {
        method: 'POST',
        path: '/taskip-internal/inbox/:id/sync',
        requiresAuth: true,
        handler: async (params) => {
          const { id } = params as { id: string };
          return this.emails.syncReplies(id);
        },
      },
      {
        method: 'POST',
        path: '/taskip-internal/inbox/:id/mark-opened',
        requiresAuth: true,
        handler: async (params) => {
          const { id } = params as { id: string };
          return this.emails.markOpened(id);
        },
      },
      {
        method: 'POST',
        path: '/taskip-internal/inbox/send',
        requiresAuth: true,
        handler: async (params) => {
          const { recipient, subject, textBody, purpose, workspaceUuid, accountId, plainText } = params as {
            recipient?: string;
            subject?: string;
            textBody?: string;
            purpose?: string;
            workspaceUuid?: string;
            accountId?: string;
            plainText?: boolean;
          };
          if (!recipient?.trim()) throw new Error('recipient is required');
          if (!subject?.trim()) throw new Error('subject is required');
          if (!textBody?.trim()) throw new Error('textBody is required');
          return this.emails.send({
            purpose: (purpose as any) ?? 'other',
            recipient: recipient.trim(),
            subject: subject.trim(),
            body: textBody.trim(),
            workspaceUuid: workspaceUuid?.trim() || undefined,
            accountId: accountId?.trim() || undefined,
            plainText: plainText === true,
          });
        },
      },

      // Suggestion sweep routes
      {
        method: 'GET',
        path: '/taskip-internal/suggestions',
        requiresAuth: true,
        handler: async (params) => {
          const { status } = params as { status?: string };
          const rows = await this.db.db
            .select()
            .from(taskipInternalSuggestions)
            .where(status && status !== 'all' ? eq(taskipInternalSuggestions.status, status) : undefined)
            .orderBy(desc(taskipInternalSuggestions.createdAt))
            .limit(100);

          const uuids = [...new Set(rows.map((r) => r.workspaceUuid))];
          const allActivity = uuids.length > 0
            ? await this.db.db
                .select()
                .from(taskipInternalWorkspaceActivity)
                .where(inArray(taskipInternalWorkspaceActivity.workspaceUuid, uuids))
                .orderBy(desc(taskipInternalWorkspaceActivity.createdAt))
            : [];

          const activityByUuid = new Map<string, typeof allActivity>();
          for (const a of allActivity) {
            const bucket = activityByUuid.get(a.workspaceUuid) ?? [];
            if (bucket.length < 3) {
              bucket.push(a);
              activityByUuid.set(a.workspaceUuid, bucket);
            }
          }

          return rows.map((row) => ({ ...row, recentActivity: activityByUuid.get(row.workspaceUuid) ?? [] }));
        },
      },
      {
        method: 'PATCH',
        path: '/taskip-internal/suggestions/:id',
        requiresAuth: true,
        handler: async (params) => {
          const { id, subject, bodyMd, ctaText, ctaUrl } = params as {
            id: string;
            subject?: string;
            bodyMd?: string;
            ctaText?: string;
            ctaUrl?: string;
          };
          const [row] = await this.db.db
            .select({ status: taskipInternalSuggestions.status })
            .from(taskipInternalSuggestions)
            .where(eq(taskipInternalSuggestions.id, id))
            .limit(1);
          if (!row) throw new Error('Suggestion not found');
          if (row.status !== 'pending') throw new Error('Only pending suggestions can be edited');

          const updates: Partial<typeof taskipInternalSuggestions.$inferInsert> = {};
          if (subject !== undefined) updates.subject = subject;
          if (bodyMd !== undefined) updates.bodyMd = bodyMd;
          if (ctaText !== undefined) updates.ctaText = ctaText;
          if (ctaUrl !== undefined) updates.ctaUrl = ctaUrl;

          const [updated] = await this.db.db
            .update(taskipInternalSuggestions)
            .set(updates)
            .where(eq(taskipInternalSuggestions.id, id))
            .returning();
          return updated;
        },
      },
      {
        method: 'POST',
        path: '/taskip-internal/suggestions/:id/approve',
        requiresAuth: true,
        handler: async (params) => {
          const { id } = params as { id: string };
          return this.approveSuggestion(id);
        },
      },
      {
        method: 'POST',
        path: '/taskip-internal/suggestions/:id/skip',
        requiresAuth: true,
        handler: async (params) => {
          const { id, reason } = params as { id: string; reason?: string };
          return this.skipSuggestion(id, reason);
        },
      },
      {
        method: 'POST',
        path: '/taskip-internal/suggestions/sweep',
        requiresAuth: true,
        handler: async () => {
          await this.suggestionSweepQueue.add('sweep', {}, { jobId: `manual-sweep-${Date.now()}` });
          return { queued: true };
        },
      },
      {
        method: 'GET',
        path: '/taskip-internal/workspace/:uuid/activity',
        requiresAuth: true,
        handler: async (params) => {
          const { uuid } = params as { uuid: string };
          return this.db.db
            .select()
            .from(taskipInternalWorkspaceActivity)
            .where(eq(taskipInternalWorkspaceActivity.workspaceUuid, uuid))
            .orderBy(desc(taskipInternalWorkspaceActivity.createdAt))
            .limit(100);
        },
      },
    ];
  }

  private async approveSuggestion(id: string): Promise<{ ok: boolean; channel: string }> {
    const [row] = await this.db.db
      .select()
      .from(taskipInternalSuggestions)
      .where(eq(taskipInternalSuggestions.id, id))
      .limit(1);
    if (!row) throw new Error('Suggestion not found');
    if (row.status !== 'pending') throw new Error(`Cannot approve suggestion with status: ${row.status}`);

    await this.db.db
      .update(taskipInternalSuggestions)
      .set({ status: 'approved', approvedAt: new Date() })
      .where(eq(taskipInternalSuggestions.id, id));

    try {
      if (row.channel === 'gmail') {
        const result = await this.emails.send({
          purpose: 'followup',
          recipient: row.ownerEmail,
          subject: row.subject,
          body: row.bodyMd,
          workspaceUuid: row.workspaceUuid,
          metadata: { suggestionId: id, cohort: row.cohort, scenarioKey: row.scenarioKey },
        });

        await this.db.db
          .update(taskipInternalSuggestions)
          .set({ status: 'sent', sentEmailId: result.id, sentAt: new Date() })
          .where(eq(taskipInternalSuggestions.id, id));

        await this.db.db.insert(taskipInternalWorkspaceActivity).values({
          workspaceUuid: row.workspaceUuid,
          activityType: 'email_sent',
          suggestionId: id,
          emailId: result.id,
          score: row.score,
          cohort: row.cohort,
        });
      } else {
        const result = await this.insight.submitMessage(row.workspaceUuid, {
          scenario_key: row.scenarioKey,
          channel: 'both',
          subject: row.subject,
          body_md: row.bodyMd,
          cta_text: row.ctaText ?? undefined,
          cta_url: row.ctaUrl ?? undefined,
        });

        const finalStatus = result.status === 'suppressed_cooldown' ? 'skipped' : 'sent';
        await this.db.db
          .update(taskipInternalSuggestions)
          .set({
            status: finalStatus,
            insightMessageId: result.id,
            sentAt: finalStatus === 'sent' ? new Date() : undefined,
            skippedAt: finalStatus === 'skipped' ? new Date() : undefined,
            failedReason: finalStatus === 'skipped' ? result.status : null,
          })
          .where(eq(taskipInternalSuggestions.id, id));

        await this.db.db.insert(taskipInternalWorkspaceActivity).values({
          workspaceUuid: row.workspaceUuid,
          activityType: 'insight_message_sent',
          suggestionId: id,
          score: row.score,
          cohort: row.cohort,
          notes: result.status,
        });
      }
    } catch (err) {
      const msg = (err as Error).message;
      await this.db.db
        .update(taskipInternalSuggestions)
        .set({ status: 'failed', failedReason: msg })
        .where(eq(taskipInternalSuggestions.id, id));
      throw err;
    }

    return { ok: true, channel: row.channel };
  }

  private async skipSuggestion(id: string, reason?: string): Promise<{ ok: boolean; suppressed: boolean }> {
    const [row] = await this.db.db
      .select()
      .from(taskipInternalSuggestions)
      .where(eq(taskipInternalSuggestions.id, id))
      .limit(1);
    if (!row) throw new Error('Suggestion not found');
    if (row.status !== 'pending') throw new Error(`Cannot skip suggestion with status: ${row.status}`);

    await this.db.db
      .update(taskipInternalSuggestions)
      .set({ status: 'skipped', skippedAt: new Date() })
      .where(eq(taskipInternalSuggestions.id, id));

    await this.db.db.insert(taskipInternalWorkspaceActivity).values({
      workspaceUuid: row.workspaceUuid,
      activityType: 'suggestion_skipped',
      suggestionId: id,
      score: row.score,
      cohort: row.cohort,
      notes: reason ?? null,
    });

    // check for 3-consecutive-skip suppression
    const recent = await this.db.db
      .select({ activityType: taskipInternalWorkspaceActivity.activityType })
      .from(taskipInternalWorkspaceActivity)
      .where(eq(taskipInternalWorkspaceActivity.workspaceUuid, row.workspaceUuid))
      .orderBy(desc(taskipInternalWorkspaceActivity.createdAt))
      .limit(3);

    const suppressed = recent.length === 3 && recent.every((r) => r.activityType === 'suggestion_skipped');
    if (suppressed) {
      await this.db.db.insert(taskipInternalWorkspaceActivity).values({
        workspaceUuid: row.workspaceUuid,
        activityType: 'sweep_ignored',
        score: row.score,
        cohort: row.cohort,
        notes: '3 consecutive skips',
      });
    }

    return { ok: true, suppressed };
  }

  private async executeReadTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const WORKSPACE_UUID_TOOLS = [
      'lookup_workspace_owner', 'insight_get_lifecycle', 'insight_get_overview',
      'insight_recommended_actions', 'insight_pending_scenarios', 'insight_recent_messages',
      'insight_log_agent_action', 'list_workspace_suggestions',
    ];
    if (WORKSPACE_UUID_TOOLS.includes(name)) {
      const raw = String(args.workspace_uuid ?? '');
      if (!UUID_RE.test(raw)) {
        return { error: `workspace_uuid must be a UUID string — got "${raw}". STOP. Do NOT retry with other numeric IDs. Use the \`uuid\` field from the prior insight_list_cohort results for each selected workspace position.` };
      }
    }
    try {
      switch (name) {
        case 'lookup_user': {
          const { emailOrId, email, url, uuid: wsUuid, name: wsName } = args as Record<string, string | undefined>;
          const searchParams = wsUuid ? { uuid: wsUuid }
            : url ? { url }
            : wsName ? { name: wsName }
            : { email: email ?? emailOrId ?? '' };
          try {
            const insightResult = await this.insight.search(searchParams);
            // Cross-check: if exact match, verify owner.email exists in Taskip DB.
            // Insight may store a workspace contact email (e.g. contact@domain.com)
            // instead of the owner's actual login email.
            if (insightResult && (insightResult as { mode?: string }).mode === 'exact_match') {
              const ownerEmail = (insightResult as { data?: { owner?: { email?: string } } }).data?.owner?.email;
              if (ownerEmail) {
                const dbUser = await this.taskipDb.lookupUser(ownerEmail).catch(() => null);
                if (!dbUser) {
                  return {
                    ...insightResult,
                    _email_warning: `owner.email "${ownerEmail}" was NOT found in Taskip DB. This is likely a workspace contact email, not the owner's login email. Do NOT send email to this address. Find the correct login email via insight_get_lifecycle or summarize_user_history with the workspace UUID.`,
                  };
                }
              }
            }
            return insightResult;
          } catch (insightErr) {
            if (insightErr instanceof InsightApiError && insightErr.status === 404) {
              const emailFallback = searchParams.email;
              if (emailFallback) {
                try {
                  const user = await this.taskipDb.lookupUser(emailFallback);
                  if (user) return { source: 'taskip_db_fallback', note: 'Insight API 404 — not yet indexed; found in direct DB.', user };
                } catch { /* ignore */ }
              }
              return { error: `Insight API 404 [${insightErr.endpoint}]: workspace not found for ${JSON.stringify(searchParams)}. Try searching by name if you only have a workspace name.` };
            }
            return { error: `${(insightErr as Error).message} [endpoint: ${(insightErr as InsightApiError).endpoint ?? 'unknown'}]` };
          }
        }
        case 'lookup_workspace_owner':
          return await this.insight.getLifecycle(args.workspaceUuid as string);
        case 'query_subscriptions':
          return await this.taskipDb.querySubscriptions(args.userId as string);
        case 'query_invoices':
          return await this.taskipDb.queryInvoices(args.userId as string);
        case 'summarize_user_history': {
          const user = await this.taskipDb.lookupUser(args.emailOrId as string);
          if (!user) return { error: 'User not found' };
          const [subs, invoices] = await Promise.all([
            this.taskipDb.querySubscriptions(user.id),
            this.taskipDb.queryInvoices(user.id),
          ]);
          return { user, subscriptions: subs, invoices };
        }
        case 'insight_list_cohort':
          return await this.insight.listCohort(args.cohort as InsightCohort, {
            perPage: args.per_page as number | undefined,
            cursor: args.cursor as string | undefined,
            minScore: args.min_score as number | undefined,
            updatedAfter: args.updated_after as string | undefined,
          });
        case 'insight_get_overview':
          return await this.insight.getOverview(args.workspace_uuid as string);
        case 'insight_recommended_actions':
          return await this.insight.getRecommendedActions(args.workspace_uuid as string);
        case 'list_sent_emails':
          return await this.emails.listSent({
            limit: args.limit as number | undefined,
            purpose: args.purpose as TaskipEmailPurpose | undefined,
            workspaceUuid: args.workspaceUuid as string | undefined,
          });
        case 'sync_email_replies':
          return await this.emails.syncReplies(args.emailId as string);
        case 'insight_get_lifecycle':
          return await this.insight.getLifecycle(args.workspace_uuid as string);
        case 'insight_pending_scenarios':
          return await this.insight.getPendingScenarios(args.workspace_uuid as string);
        case 'insight_recent_messages':
          return await this.insight.getRecentMessages(args.workspace_uuid as string);
        case 'insight_trial_funnel_hot':
          return await this.insight.getTrialFunnelHotList();
        case 'insight_trial_funnel_at_risk':
          return await this.insight.getTrialFunnelAtRiskList();
        case 'insight_trial_funnel_trial_ready':
          return await this.insight.getTrialFunnelTrialReadyList();
        case 'insight_trial_funnel_stats':
          return await this.insight.getTrialFunnelStats();
        case 'insight_log_agent_action': {
          const { workspace_uuid, action_type, result, reason, payload } = args as {
            workspace_uuid: string;
            action_type: string;
            result: 'success' | 'failed' | 'skipped';
            reason?: string;
            payload: Record<string, unknown>;
          };
          return await this.insight.logAgentAction(workspace_uuid, {
            action_type,
            result,
            reason: reason ?? null,
            payload,
          });
        }
        case 'list_workspace_suggestions': {
          const { workspace_uuid, status } = args as { workspace_uuid: string; status?: string };
          return await this.db.db
            .select({
              id: taskipInternalSuggestions.id,
              status: taskipInternalSuggestions.status,
              cohort: taskipInternalSuggestions.cohort,
              scenarioKey: taskipInternalSuggestions.scenarioKey,
              subject: taskipInternalSuggestions.subject,
              channel: taskipInternalSuggestions.channel,
              createdAt: taskipInternalSuggestions.createdAt,
              sentAt: taskipInternalSuggestions.sentAt,
              skippedAt: taskipInternalSuggestions.skippedAt,
            })
            .from(taskipInternalSuggestions)
            .where(
              and(
                eq(taskipInternalSuggestions.workspaceUuid, workspace_uuid),
                status ? eq(taskipInternalSuggestions.status, status) : undefined,
              ),
            )
            .orderBy(desc(taskipInternalSuggestions.createdAt))
            .limit(10);
        }
        default:
          return { error: `Unknown tool: ${name}` };
      }
    } catch (err) {
      if (err instanceof InsightApiError) {
        return { error: `${err.message} [endpoint: ${err.endpoint}]` };
      }
      return { error: (err as Error).message };
    }
  }

  private buildKbBlock(
    alwaysOn: Awaited<ReturnType<KnowledgeBaseService['getAlwaysOnContext']>>,
    refs: Awaited<ReturnType<KnowledgeBaseService['searchEntries']>>,
  ): string {
    const lines: string[] = [];
    if (alwaysOn.length > 0) {
      lines.push('## Taskip Product Knowledge (from KB)');
      for (const e of alwaysOn) {
        lines.push(`### ${e.title}`);
        lines.push(e.content.trim());
      }
    }
    if (refs.length > 0) {
      lines.push('## Relevant KB References');
      for (const e of refs) {
        lines.push(`### ${e.title}`);
        lines.push(e.content.trim());
      }
    }
    return lines.join('\n\n');
  }

  private buildToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: 'lookup_user',
        description: 'Unified workspace search via the Insight API /search endpoint. Provide exactly ONE of: email (owner login), uuid (workspace UUID), url (slug like "xgenious", subdomain "xgenious.taskip.app", or custom domain "crm.xgenious.com"), or name (partial match — returns candidate list, not full stats). For uuid/url/email the response is mode="exact_match" with full stats + activity_by_day. For name the response is mode="name_search" with up to 10 candidates — pick a uuid and call insight_get_lifecycle for full details.',
        parameters: {
          type: 'object',
          properties: {
            emailOrId: { type: 'string', description: 'owner email address (exact match)' },
            url: { type: 'string', description: 'workspace slug, subdomain, or custom domain (exact match)' },
            uuid: { type: 'string', description: 'workspace UUID string (exact match)' },
            name: { type: 'string', description: 'partial workspace name (returns candidate list, not full stats)' },
          },
        },
      },
      {
        name: 'lookup_workspace_owner',
        description: 'Resolve a workspace UUID to its owner via the Insight API lifecycle endpoint. Returns owner.email, owner.first_name, workspace state, cohort, score, and recent messages — use this whenever you have a workspace UUID and need owner contact details.',
        parameters: {
          type: 'object',
          properties: { workspaceUuid: { type: 'string', description: 'Taskip workspace UUID' } },
          required: ['workspaceUuid'],
        },
      },
      {
        name: 'query_subscriptions',
        description: 'Get subscription history for a user by their UUID',
        parameters: {
          type: 'object',
          properties: { userId: { type: 'string', description: 'user UUID' } },
          required: ['userId'],
        },
      },
      {
        name: 'query_invoices',
        description: 'List invoices for a user by their UUID',
        parameters: {
          type: 'object',
          properties: { userId: { type: 'string', description: 'user UUID' } },
          required: ['userId'],
        },
      },
      {
        name: 'summarize_user_history',
        description: 'Get a full picture of a user — profile, subscriptions, and invoices in one call',
        parameters: {
          type: 'object',
          properties: { emailOrId: { type: 'string' } },
          required: ['emailOrId'],
        },
      },
      {
        name: 'extend_trial',
        description: 'Extend a user\'s trial period. Requires approval before executing.',
        parameters: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'user UUID' },
            days: { type: 'number', description: 'number of days to extend (default 7)' },
          },
          required: ['userId'],
        },
      },
      {
        name: 'mark_refund',
        description: 'Mark an invoice as refund_requested. Requires approval before executing.',
        parameters: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'user UUID' },
            invoiceId: { type: 'string', description: 'invoice UUID' },
          },
          required: ['userId', 'invoiceId'],
        },
      },
      {
        name: 'insight_list_cohort',
        description: 'List workspaces in a lifecycle cohort. Use for Phase 1 segmentation. Returns minimal per-workspace data, paginated. Each item has a `uuid` field (string UUID like "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx") — always use that as workspace_uuid for all subsequent insight calls. Never use the numeric id.',
        parameters: {
          type: 'object',
          properties: {
            cohort: {
              type: 'string',
              enum: [
                'serious_trial', 'looking_trial', 'ignore_trial',
                'healthy_paid', 'expanding_paid', 'at_risk_paid', 'dormant_paid',
                'trial_ready_free', 'nurture_free', 'ignore_free',
                'expired_trial_warm', 'expired_trial_cold', 'uncategorized',
              ],
            },
            per_page: { type: 'number', description: '1-500, default 100' },
            cursor: { type: 'string' },
            min_score: { type: 'number', description: '0-100, only return workspaces with score >= this' },
            updated_after: { type: 'string', description: 'ISO-8601, incremental sweep' },
          },
          required: ['cohort'],
        },
      },
      {
        name: 'insight_trial_funnel_hot',
        description: 'Trial users with highest THS (serious_trial cohort) sorted by score desc. Use for "who are our hottest trials right now?" Equivalent to insight_list_cohort with cohort=serious_trial but pre-sorted by the server.',
        parameters: { type: 'object', properties: {} },
      },
      {
        name: 'insight_trial_funnel_at_risk',
        description: 'Trial users with THS < 30 at trial day >= 5 (ignore_trial cohort). Use for rescue outreach targeting — these trials are stalling.',
        parameters: { type: 'object', properties: {} },
      },
      {
        name: 'insight_trial_funnel_trial_ready',
        description: 'Free users with TRS >= 50 (trial_ready_free cohort). Use to identify free users ready to be invited into a trial.',
        parameters: { type: 'object', properties: {} },
      },
      {
        name: 'insight_trial_funnel_stats',
        description: 'Conversion ratio summary + state distribution counts across all lifecycle states (free/trial/paid/churned). Use for "give me a funnel overview" or "how many users are in each state?"',
        parameters: { type: 'object', properties: {} },
      },
      {
        name: 'insight_get_overview',
        description: 'Drill into a single workspace. Returns plan, cohort, score, signals, recent activities. Use after insight_list_cohort.',
        parameters: {
          type: 'object',
          properties: {
            workspace_uuid: { type: 'string', description: 'workspace UUID or url slug' },
          },
          required: ['workspace_uuid'],
        },
      },
      {
        name: 'insight_recommended_actions',
        description: 'Get pre-ranked rules-engine actions for a workspace. Pick actions[0] and render its prompt through the LLM.',
        parameters: {
          type: 'object',
          properties: {
            workspace_uuid: { type: 'string' },
          },
          required: ['workspace_uuid'],
        },
      },
      {
        name: 'insight_submit_marketing_suggestion',
        description: 'Propose a marketing task for a workspace. Lands in the central queue with status=pending. Requires approval before executing.',
        parameters: {
          type: 'object',
          properties: {
            workspace_uuid: { type: 'string' },
            template_key: { type: 'string', description: 'e.g. retention_outreach (must be a registered template)' },
            title: { type: 'string', description: '<=255 chars' },
            description: { type: 'string', description: '<=5000 chars, the rendered email/message body' },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
            channel: { type: 'string', enum: ['email', 'inapp', 'push'] },
            recommended_due_at: { type: 'string', description: 'ISO-8601, must be in the future' },
            idempotency_key: { type: 'string', description: 'Stable per logical attempt, e.g. SHA of {workspace_uuid}:{template_key}:{date}' },
            evidence: {
              type: 'array',
              items: {
                type: 'object',
                properties: { key: { type: 'string' }, value: { type: 'number' } },
                required: ['key', 'value'],
              },
            },
          },
          required: ['workspace_uuid', 'template_key', 'title', 'description', 'priority', 'channel', 'recommended_due_at'],
        },
      },
      {
        name: 'batch_send_email',
        description: 'Send retention emails to multiple FREE or TRIAL workspaces in a single approval. Use this in CONTINUATION or SELECTION mode when the user confirmed a set of workspaces. Each email is individually tracked. Requires approval before sending.',
        parameters: {
          type: 'object',
          properties: {
            emails: {
              type: 'array',
              description: 'Array of email drafts to send. Each must be a complete SPAR-generated email.',
              items: {
                type: 'object',
                properties: {
                  purpose: { type: 'string', enum: ['marketing', 'followup', 'offer', 'other'] },
                  recipient: { type: 'string', description: 'owner email address' },
                  subject: { type: 'string' },
                  body: { type: 'string', description: 'Full email body, under 120 words, SPAR-compliant' },
                  workspace_uuid: { type: 'string', description: 'Taskip workspace UUID for dedup tracking' },
                },
                required: ['purpose', 'recipient', 'subject', 'body'],
              },
            },
          },
          required: ['emails'],
        },
      },
      {
        name: 'send_email',
        description: 'Send a Gmail email to a FREE or TRIAL cohort workspace owner. Tracked so replies can be matched. Requires approval before sending. DO NOT use for paid-plan workspaces — use insight_submit_message instead.',
        parameters: {
          type: 'object',
          properties: {
            purpose: { type: 'string', enum: ['marketing', 'followup', 'offer', 'other'] },
            recipient: { type: 'string', description: 'recipient email address' },
            subject: { type: 'string' },
            body: { type: 'string', description: 'Markdown-formatted email body. Keep under 120 words. Reference specific actions the user took (volume_metrics). One CTA only.' },
            workspaceUuid: { type: 'string', description: 'link this email to a Taskip workspace for dedup tracking' },
          },
          required: ['purpose', 'recipient', 'subject', 'body'],
        },
      },
      {
        name: 'list_sent_emails',
        description: 'List previously-sent emails tracked by this agent (newest first). Use to check whether a recipient already received outreach.',
        parameters: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'default 50, max 200' },
            purpose: { type: 'string', enum: ['marketing', 'followup', 'offer', 'other'] },
            workspaceUuid: { type: 'string' },
          },
        },
      },
      {
        name: 'sync_email_replies',
        description: 'Pull the Gmail thread for a tracked email and record any new replies. Returns the count of replies added.',
        parameters: {
          type: 'object',
          properties: { emailId: { type: 'string', description: 'tracked email id (from list_sent_emails)' } },
          required: ['emailId'],
        },
      },
      {
        name: 'insight_log_agent_action',
        description: 'Audit write-back. Call after deciding to act, skip, or escalate. Low risk — invoke freely.',
        parameters: {
          type: 'object',
          properties: {
            workspace_uuid: { type: 'string' },
            action_type: { type: 'string', description: '<=80 chars; e.g. marketing_suggestion_submitted, cohort_swept, skipped_low_confidence, escalated_to_human' },
            result: { type: 'string', enum: ['success', 'failed', 'skipped'] },
            reason: { type: 'string', description: '<=500 chars; required when result != success' },
            payload: { type: 'object' },
          },
          required: ['workspace_uuid', 'action_type', 'result', 'payload'],
        },
      },
      {
        name: 'insight_get_lifecycle',
        description: 'Read the full lifecycle snapshot (state, owner, score, signals, recent_messages) for a workspace. Use to compose personalized copy. workspace_uuid must be the UUID string (from the `uuid` field of insight_list_cohort results) — never a numeric id.',
        parameters: {
          type: 'object',
          properties: { workspace_uuid: { type: 'string', description: 'UUID string from insight_list_cohort result.uuid — never a numeric id' } },
          required: ['workspace_uuid'],
        },
      },
      {
        name: 'insight_pending_scenarios',
        description: 'Probe the lifecycle rules engine: which scenarios are eligible to fire RIGHT NOW for this workspace, and which are blocked (with reason).',
        parameters: {
          type: 'object',
          properties: { workspace_uuid: { type: 'string' } },
          required: ['workspace_uuid'],
        },
      },
      {
        name: 'insight_recent_messages',
        description: 'Last 50 AI message attempts for the workspace (sent, suppressed, rejected). Use to avoid repeating yourself.',
        parameters: {
          type: 'object',
          properties: { workspace_uuid: { type: 'string' } },
          required: ['workspace_uuid'],
        },
      },
      {
        name: 'list_workspace_suggestions',
        description: 'Check this agent\'s suggestion queue for a workspace. Call before proposing new outreach to avoid duplicates. Returns recent suggestions with status (pending/sent/skipped/suppressed).',
        parameters: {
          type: 'object',
          properties: {
            workspace_uuid: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'approved', 'sent', 'skipped', 'failed', 'suppressed'], description: 'filter by status; omit to return all' },
          },
          required: ['workspace_uuid'],
        },
      },
      {
        name: 'insight_submit_message',
        description: 'Submit a personalized lifecycle message for a PAID cohort workspace. Server validates against tone rules + scenario allow-list, logs the row, then delivers via in-app + email. Approval-gated. DO NOT use for free/trial workspaces — use send_email. cta_url must be on taskip.net or taskip.app. Email body <=120 words; in-app <=40.',
        parameters: {
          type: 'object',
          properties: {
            workspace_uuid: { type: 'string' },
            scenario_key: { type: 'string', description: 'MUST be a key from insight_pending_scenarios.eligible[].scenario_key — never guess or hardcode.' },
            channel: { type: 'string', enum: ['email', 'inapp', 'both'] },
            subject: { type: 'string', description: '<=255 chars; required when channel includes email' },
            body_md: { type: 'string', description: 'Markdown body. <=120 words for email, <=40 for in-app.' },
            cta_text: { type: 'string', description: '<=191 chars' },
            cta_url: { type: 'string', description: 'Must be on taskip.net or taskip.app' },
            force_send: { type: 'boolean', description: 'Bypass cooldown / manual review / idempotency. Use sparingly.' },
          },
          required: ['workspace_uuid', 'scenario_key', 'channel', 'body_md'],
        },
      },
    ];
  }

  private async getConfig(): Promise<TaskipInternalConfig> {
    const [row] = await this.db.db
      .select({ config: agents.config })
      .from(agents)
      .where(eq(agents.key, this.key));

    return (row?.config as TaskipInternalConfig) ?? this.defaultConfig();
  }

  private defaultConfig(): TaskipInternalConfig {
    return {};
  }
}
