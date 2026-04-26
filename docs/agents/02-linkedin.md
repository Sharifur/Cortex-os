# Agent: LinkedIn AI Agent

**Key:** `linkedin`  
**Phase:** 4

## Purpose

Comment on relevant posts, draft DMs, post scheduled content.

## Trigger

- CRON: every 4 hours (feed scan)
- MANUAL: for content posting

## Context

- LinkedIn API adapter (Unipile or similar)

## Decision

Pick N posts, draft comments, draft outreach DMs.

## Actions

| Action | Approval Required |
|---|---|
| `post_comment` | Yes |
| `send_dm` | Yes |
| `publish_post` | Yes |

## MCP Tools

| Tool | Description |
|---|---|
| `get_feed` | Fetch recent feed posts |
| `get_lead_profile` | Get a lead's profile details |
| `draft_comment` | LLM-draft a comment for a post |
| `draft_dm` | LLM-draft a direct message |

## API Routes

| Method | Path | Purpose |
|---|---|---|
| POST | `/draft-outreach` | Draft an outreach message |
| POST | `/schedule-post` | Schedule a post |

## Schema

```sql
linkedin_leads {
  id            text PK
  profileUrl    text
  name          text
  headline      text
  status        text
  lastContactedAt timestamp
  notes         text
}
```
