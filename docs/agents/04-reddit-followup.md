# Agent: Reddit Followup Agent

**Key:** `reddit`  
**Phase:** 4

## Purpose

Track keyword mentions, draft non-spammy comments, follow up on prior threads.

## Trigger

- CRON: every 2 hours

## Context

- Reddit API search
- Tracked threads DB

## Decision

Score relevance, draft comment.

## Actions

| Action | Approval Required |
|---|---|
| `post_comment` | Yes |
| `reply_to_comment` | Yes |
| `upvote` | Auto |

## MCP Tools

| Tool | Description |
|---|---|
| `search_reddit` | Search for keyword mentions |
| `get_thread` | Fetch a thread's content |
| `draft_comment` | LLM-draft a non-spammy comment |

## API Routes

| Method | Path | Purpose |
|---|---|---|
| POST | `/track-keyword` | Add a keyword to track |
| GET | `/threads` | List tracked threads |

## Schema

```sql
reddit_threads {
  id              text PK
  threadId        text
  subreddit       text
  title           text
  url             text
  lastEngagedAt   timestamp
  status          text
}
```
