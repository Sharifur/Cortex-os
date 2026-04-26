# Agent: Daily Task Reminder

**Key:** `daily_reminder`  
**Phase:** 3

## Purpose

Morning brief and end-of-day recap delivered to owner via Telegram.

## Trigger

- CRON: 08:30 (morning brief) — configurable
- CRON: 21:00 (end-of-day recap) — configurable

## Context

- Tasks from Taskip workspace
- Calendar events
- Pending approvals from the platform

## Decision

LLM groups tasks, prioritizes, and writes a personal brief.

## Actions

| Action | Approval Required |
|---|---|
| `send_telegram_brief` | No (informational only) |

## MCP Tools

| Tool | Description |
|---|---|
| `get_today_tasks` | Fetch today's tasks from Taskip |
| `get_calendar_events` | Fetch calendar events |
| `compose_brief` | LLM-compose the brief message |

## API Routes

| Method | Path | Purpose |
|---|---|---|
| GET | `/brief` | Fetch the latest brief |
| POST | `/trigger-brief` | Manually trigger a brief |

## Notes

No approval gate — this agent is purely informational. No DB schema required beyond `agentRuns` and `agentLogs`.
