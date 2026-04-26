# Agent: Taskip Internal AI Agent

**Key:** `taskip_internal`  
**Phase:** 3

## Purpose

Internal ops on Taskip — user lookups, refund prep, ad-hoc DB queries via natural language.

## Trigger

- MANUAL (panel, Telegram command, MCP, API)

## Context

- Taskip Postgres (read-only user)
- `api.taskip.net`

## Decision

LLM with tool-use over the MCP tools below.

## Actions

| Action | Approval Required |
|---|---|
| Read-only queries | Auto (no approval) |
| `extend_trial` | Yes |
| `mark_refund` | Yes |

## MCP Tools

| Tool | Description |
|---|---|
| `lookup_user` | Find user by email/ID |
| `query_subscriptions` | Get subscription details |
| `query_invoices` | List invoices for a user |
| `extend_trial` | Extend a user's trial period |
| `mark_refund` | Mark a user for refund |
| `summarize_user_history` | LLM summary of user journey |

## API Routes

| Method | Path | Purpose |
|---|---|---|
| POST | `/lookup` | Find user |
| POST | `/extend-trial` | Extend trial |
| POST | `/refund` | Initiate refund |
