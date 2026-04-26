# Agent: Email Manager

**Key:** `email_manager`  
**Phase:** 3

## Purpose

Surface important emails, draft replies.

## Trigger

- CRON: every 30 minutes (Gmail/IMAP polling)

## Context

- Inbox
- Sender importance map
- Prior email threads

## Decision

Classify emails: `must-reply | nice-to-reply | newsletter | spam`  
Draft reply for must-reply emails.

## Actions

| Action | Approval Required |
|---|---|
| `send_reply` | Yes |
| `archive` | Auto |
| `label` | Auto |
| `notify_owner` | Auto |

## MCP Tools

| Tool | Description |
|---|---|
| `list_unread` | List unread emails |
| `get_thread` | Fetch a full email thread |
| `draft_reply` | LLM-draft a reply |
| `archive` | Archive an email |
| `label` | Apply a label |

## API Routes

| Method | Path | Purpose |
|---|---|---|
| GET | `/unread` | List unread emails |
| POST | `/draft-reply/:msgId` | Draft a reply for a message |

## Schema

```sql
email_items {
  id              text PK
  externalMsgId   text
  threadId        text
  from            text
  subject         text
  snippet         text
  classification  text       -- must-reply | nice-to-reply | newsletter | spam
  draftReply      text
  status          text
  receivedAt      timestamp
}
```
