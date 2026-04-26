# Security

## Secrets Management

- All secrets in **Coolify environment variables** — never in DB or repo
- LLM keys, SES creds, Telegram bot token, integration tokens, MinIO creds — env only

## Telegram

- Callbacks and follow-up replies validated against `users.telegramChatId`
- Unrecognized chat IDs: silently dropped (no error response)

## Webhook Verification

| Webhook | Verification Method |
|---|---|
| SES | SNS signature validation |
| Telegram | Secret token in URL path |
| WhatsApp | HMAC signature |
| Taskip | Shared secret in header |
| Generic agent webhooks | Per-agent shared secret in header |

## API Access

- Admin panel: JWT 24h + refresh rotation
- Rate-limit login: 5 requests/min
- Per-agent API keys for external systems hitting `/agents/:key/api/*`
- MCP endpoints `/mcp/:key`: JWT or per-agent MCP token

## Database

- Read-only Postgres user for agents reading the Taskip DB

## Runaway Prevention

- **Outbound rate caps** per agent: `config.dailyCap`, `config.minIntervalSec`
- **Follow-up ceiling**: default 5 rounds per run — prevents infinite redraft loops

## Audit Trail

Every approval / rejection / follow-up persisted with:
- Timestamp
- Source (Telegram or admin panel)
- Operator identity
