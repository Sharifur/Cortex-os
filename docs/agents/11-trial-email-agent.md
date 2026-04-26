# Agent: Trial User Email Agent (Reference Implementation)

**Key:** `taskip_trial`  
**Phase:** 2 — build this immediately after platform core to validate the full runtime end-to-end

## Purpose

Behavior-based outreach to Taskip trial / paid / churned users.

## Trigger

- CRON: daily 10:00 Asia/Dhaka
- WEBHOOK: Taskip on signup, trial-expiring, churn events

## Context

Pulled from Taskip Postgres:
- Signup date, trial end date, plan, last login, feature usage counters
- Segments: `trial_day_3`, `trial_day_5_low_activity`, `trial_expiring_24h`, `paid_at_risk`, `churned_30d`

## Decision

For each user matching a segment, LLM drafts a short founder-voiced email per Sharifur's preferences:
- Single variant unless direction unclear
- Very short, reply-generating, not informational
- Inline pipe-separated A/B variations within one email body where relevant
- Highlights **Taspi** (Taskip's AI agent) where relevant
- Warm urgency, no hard-sell

## Actions

| Action | Approval Required |
|---|---|
| `send_email` (via SES) | Yes — one Telegram message per email |

Approval message shows: subject + body preview + recipient + Approve / Reject / Follow up.  
Follow-up = owner sends "make it shorter" / "mention Taspi" / etc., agent redrafts and re-asks.

## Bounce / Complaint Handling

- Reuse `SESWebhookController` pattern
- On hard bounce: set `email_suppressed = true`, skip in future runs

## MCP Tools

| Tool | Description |
|---|---|
| `list_segment_users` | List users in a given segment |
| `draft_email_for_user` | LLM-draft personalized email |
| `send_email` | Send via SES |
| `mark_user_suppressed` | Mark user as email-suppressed |

## API Routes

| Method | Path | Purpose |
|---|---|---|
| POST | `/run-segment` | Manually run a segment |
| GET | `/segments/:key/users` | List users in a segment |
| POST | `/draft/:userId` | Draft email for a specific user |

## Agent Config (agents.config)

```json
{
  "segments": {
    "trial_day_3":              { "enabled": true,  "templatePromptId": "trial_d3" },
    "trial_day_5_low_activity": { "enabled": true,  "templatePromptId": "trial_d5_low" },
    "trial_expiring_24h":       { "enabled": true,  "templatePromptId": "trial_expiring" },
    "paid_at_risk":             { "enabled": true,  "templatePromptId": "paid_at_risk" },
    "churned_30d":              { "enabled": false, "templatePromptId": "churned_d30" }
  },
  "llm": { "provider": "openai", "model": "gpt-4o-mini" },
  "ses": { "from": "Sharifur <sharifur@taskip.net>", "configurationSet": "ses-monitoring" },
  "dailyCap": 50,
  "maxFollowupsPerEmail": 5
}
```

## Prompt Templates

Stored in `prompt_templates` keyed by `templatePromptId` — tunable from admin panel without redeploy.
