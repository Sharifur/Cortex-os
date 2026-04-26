# Deployment (Coolify)

## Applications (3 from one monorepo)

| App | Type | Command |
|---|---|---|
| `api` | NestJS HTTP server | default (port 3000) |
| `worker` | Same Docker image | `node dist/worker.js` |
| `web` | Static React build | served by Caddy |

## Coolify-Managed Services

| Service | Version |
|---|---|
| Postgres | 16 |
| Redis | 7 |
| MinIO | latest (private bucket) |
| Uptime Kuma | optional |
| Grafana | optional |
| Prometheus | optional |

## Environment Variables

```
DATABASE_URL
REDIS_URL

MINIO_ENDPOINT
MINIO_ACCESS_KEY
MINIO_SECRET_KEY
MINIO_BUCKET

JWT_SECRET

TELEGRAM_BOT_TOKEN
TELEGRAM_OWNER_CHAT_ID
TELEGRAM_WEBHOOK_SECRET

OPENAI_API_KEY
GEMINI_API_KEY
DEEPSEEK_API_KEY

AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION=ap-south-1
SES_CONFIG_SET=ses-monitoring

TASKIP_DB_URL_READONLY
TASKIP_API_BASE=https://api.taskip.net
TASKIP_WEBHOOK_SECRET

# Per-integration tokens:
# LinkedIn, Reddit, WhatsApp, Canva, Gmail OAuth, etc.
```

## Migrations

Run automatically on `api` startup via `drizzle-kit migrate`.

## Dockerfiles

- `docker/Dockerfile.api` — NestJS API + worker image
- `docker/Dockerfile.web` — React static build
- `docker-compose.yml` — local dev only (not used in production)
