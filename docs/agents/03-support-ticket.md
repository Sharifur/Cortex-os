# Agent: Support Ticket Manager

**Key:** `support`  
**Phase:** 4

## Purpose

Triage tickets, draft replies, escalate.

## Trigger

- WEBHOOK: ticketing system
- CRON: 30-minute sweep

## Context

- Ticket body
- User history
- RAG over past resolutions (Postgres FTS)

## Decision

Categorize, draft reply, set priority, suggest assignee.

## Actions

| Action | Approval Required |
|---|---|
| `post_reply` | Yes |
| `escalate_to_owner` | Yes |
| `set_priority` | Auto |
| `assign` | Auto |
| `close_ticket` | Auto |

## MCP Tools

| Tool | Description |
|---|---|
| `get_ticket` | Fetch ticket details |
| `search_similar_tickets` | Postgres FTS for similar past tickets |
| `draft_reply` | LLM-draft a reply |
| `escalate` | Escalate to owner |

## API Routes

| Method | Path | Purpose |
|---|---|---|
| POST | `/ingest-ticket` | Push a ticket into the agent |
| GET | `/tickets/:id` | Fetch ticket status |
| POST | `/tickets/:id/reply` | Post a reply |

## Schema

```sql
support_tickets {
  id          text PK
  externalId  text
  subject     text
  body        text
  userEmail   text
  category    text
  priority    text
  status      text
  assignedTo  text
  lastDraft   text
  createdAt   timestamp
}
```
