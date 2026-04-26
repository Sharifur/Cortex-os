# Agent: Social Media Handler (Taskip + Xgenious)

**Key:** `social`  
**Phase:** 5

## Purpose

Schedule and publish posts across FB/IG/X/LinkedIn for both brands; respond to comments and DMs.

## Trigger

- CRON: hourly (publish due posts)
- CRON: every 30 minutes (engagement sweep)

## Context

- Scheduled post queue
- Post performance data
- Recent comments and DMs

## Decision

- Publish posts due in the schedule
- Draft replies to comments/DMs

## Actions

| Action | Approval Required |
|---|---|
| `publish_post` | Yes |
| `reply_to_comment` | Yes (first-time replies); Auto if confidence high |
| `reply_to_dm` | Yes (always) |

## MCP Tools

| Tool | Description |
|---|---|
| `list_scheduled_posts` | List posts due for publishing |
| `publish_post` | Publish to a platform |
| `get_engagements` | Fetch recent comments/DMs |
| `draft_reply` | LLM-draft a reply |

## API Routes

| Method | Path | Purpose |
|---|---|---|
| POST | `/schedule` | Schedule a new post |
| GET | `/scheduled` | List scheduled posts |
| POST | `/draft-reply` | Draft a reply |

## Schema

```sql
social_posts {
  id              text PK
  brand           text       -- taskip | xgenious
  platform        text       -- fb | ig | x | linkedin
  body            text
  mediaUrls       jsonb
  scheduledFor    timestamp
  status          text
  externalPostId  text
  performance     jsonb
}

social_engagements {
  id            text PK
  postId        text FK → social_posts.id
  type          text       -- comment | dm
  fromUser      text
  body          text
  draftedReply  text
  status        text
}
```
