# Agent: WhatsApp Business Watcher

**Key:** `whatsapp`  
**Phase:** 4

## Purpose

Alert owner about important WhatsApp messages, especially during offline hours.

## Trigger

- WEBHOOK: WhatsApp Business / Meta Cloud API
- CRON: every 10 minutes (backup sweep)

## Context

- Message body
- Sender history
- Configurable offline-hours window (default: Asia/Dhaka 21:00–10:00)

## Decision

Classify messages as: `urgent | important | normal | spam`  
Draft reply for urgent/important messages.

## Actions

| Action | Approval Required |
|---|---|
| `notify_telegram_priority` | Auto |
| `auto_reply_holding` (offline hours) | Yes |
| `send_reply` | Yes |

## MCP Tools

| Tool | Description |
|---|---|
| `get_recent_messages` | Fetch recent WhatsApp messages |
| `classify_message` | Classify importance of a message |
| `draft_reply` | LLM-draft a reply |

## API Routes

| Method | Path | Purpose |
|---|---|---|
| GET | `/messages/recent` | List recent messages |
| POST | `/reply` | Send a reply |

## Schema

```sql
whatsapp_messages {
  id            text PK
  externalMsgId text
  fromNumber    text
  body          text
  importance    text       -- urgent | important | normal | spam
  draftedReply  text
  mediaKey      text       -- MinIO key for media
  status        text
  receivedAt    timestamp
}
```

## Storage

WhatsApp media stored in **MinIO** private bucket.
