# Agent: Canva + Social Content Agent

**Key:** `canva`  
**Phase:** 5

## Purpose

Monthly content calendar — carousels, YouTube, FB reels, social ideas — and Canva designs.

## Trigger

- CRON: 1st of each month
- MANUAL

## Context

- Past 90-day performance data
- Brand voice document
- Current campaigns

## Decision

Generate 30 ideas with format/hook/CTA; generate Canva designs; reel scripts.

## Actions

| Action | Approval Required |
|---|---|
| Calendar batch approval | Yes (one approval for the batch) |
| `create_canva_design` | Auto (post-approval) |
| Store exports in MinIO | Auto |

## MCP Tools

| Tool | Description |
|---|---|
| `generate_calendar` | Generate 30-idea monthly content calendar |
| `create_canva_design` | Create a Canva design via API |
| `draft_reel_script` | LLM-draft a reel/video script |

## API Routes

| Method | Path | Purpose |
|---|---|---|
| POST | `/generate-month` | Trigger monthly calendar generation |
| GET | `/calendar/:month` | Fetch calendar for a month |

## Schema

```sql
content_ideas {
  id            text PK
  month         text
  format        text       -- carousel, reel, post, etc.
  hook          text
  body          text
  cta           text
  canvaDesignId text
  mediaUrl      text       -- MinIO URL
  status        text
  scheduledFor  timestamp
}
```

## Storage

Canva exports stored in **MinIO** private bucket.
