# cortex-os

Self-hosted AI agent platform for automating founder tasks. Every agent action is gated by Telegram Approve / Reject before execution.

## Stack

| Layer | Technology |
|---|---|
| API | NestJS (Fastify adapter), TypeScript |
| ORM | Drizzle ORM |
| Queue | BullMQ |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Storage | Cloudflare R2 (S3-compatible via MinIO client) |
| Notifications | Telegram (grammy) |
| Deployment | Coolify (self-hosted VPS) |

---

## Quick Start (local development)

### Prerequisites

- Node.js 20+
- PostgreSQL 16
- Redis 7
- npm 9+

### 1. Clone and install

```bash
git clone https://github.com/Sharifur/cortex-os.git
cd cortex-os
npm install --workspace=apps/api
npm install --workspace=apps/web
```

### 2. Configure environment

```bash
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env` with your local values.

### 3. Run migrations

```bash
cd apps/api
node -r dotenv/config dist/src/migrate
```

Or in development with ts-node:

```bash
npx ts-node -r dotenv/config src/migrate.ts
```

### 4. Start development

```bash
# API
cd apps/api && npm run start:dev

# Web (separate terminal)
cd apps/web && npm run dev
```

API runs on `http://localhost:3000`, web on `http://localhost:5173`.

---

## Environment Variables

All variables go in `apps/api/.env`. Integration credentials (WhatsApp, LinkedIn, Gmail, etc.) are **not** needed as env vars — configure them after login via the **Integrations** page in the UI.

### Required — Core Infrastructure

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string, e.g. `postgres://user:pass@localhost:5432/cortex` |
| `REDIS_URL` | Redis connection string, e.g. `redis://localhost:6379` |
| `JWT_SECRET` | Secret for signing JWT tokens — use a long random string in production |
| `SETTINGS_ENCRYPTION_KEY` | 32-byte hex string (`openssl rand -hex 32`) — encrypts secrets in the DB |
| `OWNER_EMAIL` | Email address for the initial admin account (created on first boot) |
| `OWNER_PASSWORD` | Password for the initial admin account |

### Required — Telegram (approval notifications)

| Variable | Description |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather |
| `TELEGRAM_OWNER_CHAT_ID` | Your personal Telegram chat ID — get it from @userinfobot |
| `TELEGRAM_WEBHOOK_SECRET` | Random string used to verify webhook requests from Telegram |

### Required — LLM (at least one)

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key (recommended — used for GPT-4o-mini by default) |
| `GEMINI_API_KEY` | Google Gemini API key (fallback) |
| `DEEPSEEK_API_KEY` | DeepSeek API key (second fallback) |

> The LLM router tries providers in order: OpenAI → Gemini → DeepSeek. Set at least one.

### Optional — Storage (Cloudflare R2)

Storage credentials can be set here as env vars **or** via the Integrations → Storage tab in the UI. Settings panel takes precedence over env vars.

| Variable | Value for R2 |
|---|---|
| `MINIO_ENDPOINT` | `<account-id>.r2.cloudflarestorage.com` |
| `MINIO_PORT` | `443` |
| `MINIO_USE_SSL` | `true` |
| `MINIO_ACCESS_KEY` | R2 API token Access Key ID |
| `MINIO_SECRET_KEY` | R2 API token Secret Access Key |
| `MINIO_BUCKET` | Bucket name, e.g. `cortex` |

### Optional — Taskip integration

| Variable | Description |
|---|---|
| `TASKIP_DB_URL_READONLY` | Read-only Postgres URL for Taskip DB (used by the trial email agent) |
| `TASKIP_API_BASE` | Taskip API base URL, default `https://api.taskip.net` |
| `TASKIP_WEBHOOK_SECRET` | Webhook secret for Taskip callbacks |

### App

| Variable | Description |
|---|---|
| `PORT` | HTTP port, default `3000` |
| `NODE_ENV` | `development` or `production` |
| `LOG_LEVEL` | Pino log level: `debug`, `info`, `warn`, `error` |
| `JWT_EXPIRY` | JWT expiry duration, default `24h` |

---

## Integration Credentials (configured in UI)

These are stored encrypted in the database — do **not** put them in `.env`.

Configure them after logging in at **Integrations** in the sidebar.

| Integration | Where to get credentials |
|---|---|
| **WhatsApp** | Meta for Developers → WhatsApp → API Setup (API Token + Phone Number ID) |
| **LinkedIn** | Unipile dashboard (preferred) or direct LinkedIn OAuth2 access token |
| **Reddit** | reddit.com/prefs/apps → create a script app |
| **Crisp** | Crisp → Settings → Website → API Keys (supports multiple websites) |
| **Gmail** | Google Cloud Console → Credentials → OAuth2 client (needs `https://mail.google.com/` scope) |
| **Amazon SES** | AWS IAM → create user with `ses:SendEmail` permission |
| **Telegram** | Settings → Telegram tab (same bot token as above, stored for runtime use) |
| **License Server** | Xgenious license server → Dashboard → Public API → Create (xs_... signature) |
| **Storage (R2)** | Cloudflare Dashboard → R2 → Manage R2 API Tokens |

Use the **Test connection** button on each integration's Settings tab to verify credentials are working.

---

## Agents

| Agent | Key | Trigger | Description |
|---|---|---|---|
| Crisp | `crisp` | CRON 15min + webhook | Instant replies to Crisp chat (auto-send, no approval required) |
| Support | `support` | CRON 30min + webhook | Triages and replies to support tickets |
| WhatsApp | `whatsapp` | CRON 10min + webhook | Classifies and replies to WhatsApp Business messages |
| Email Manager | `email_manager` | CRON 30min | Drafts and sends Gmail replies |
| LinkedIn | `linkedin` | CRON 1h | Monitors feed, comments, drafts posts |
| Reddit | `reddit` | CRON 1h | Finds relevant threads and posts comments |
| Social | `social` | CRON 2h | Publishes scheduled social posts |
| YouTube Shorts | `shorts` | CRON daily | Generates YouTube Shorts scripts |
| Daily Reminder | `daily_reminder` | CRON 8am | Sends a daily briefing to Telegram |
| Trial Email | `taskip_trial` | CRON 30min | Follows up with Taskip trial users |
| Taskip Internal | `taskip_internal` | CRON daily | Internal Taskip reports |
| HR | `hr` | CRON daily | Salary sheets, leave processing, HR alerts |
| Canva | `canva` | CRON monthly | Content calendar and Canva design generation |

---

## Architecture

```
Browser (React + Vite)
    ↓ REST API
NestJS API (Fastify)
    ↓ BullMQ jobs
Agent Runner (Postgres-persisted state)
    ↓ Telegram
Owner approves / rejects each action
    ↓ on approve
Agent executes (sends message, posts, replies, etc.)
```

Every state transition writes to Postgres before acting. No fire-and-forget.

---

## Deployment (Coolify)

Three apps are deployed from this monorepo. See `docs/production-release.md` for the full guide.

| App | Dockerfile | Port |
|---|---|---|
| `api` | `docker/Dockerfile.api` | 3000 |
| `worker` | `docker/Dockerfile.api` (override start cmd) | — |
| `web` | `docker/Dockerfile.web` | 80 |

**Migrations run automatically** — the API container runs `node dist/src/migrate` before starting. No manual migration step needed on deploy.

Coolify services to provision:
- PostgreSQL 16
- Redis 7
- Uptime Kuma (health monitoring)
- Grafana (metrics dashboard)

Cloudflare R2 is used for file storage (external — provision separately in Cloudflare Dashboard).

---

## API

Base URL: `http://localhost:3000` (or your deployed domain)

All endpoints require `Authorization: Bearer <jwt>` except `/auth/login` and `/health`.

| Method | Path | Description |
|---|---|---|
| POST | `/auth/login` | Login, returns JWT |
| GET | `/health` | Service health check |
| GET | `/agents` | List all agents |
| POST | `/agents/:key/trigger` | Manually trigger an agent |
| GET | `/approvals` | List pending approvals |
| GET | `/settings` | List all settings |
| PUT | `/settings/:key` | Save a setting |
| POST | `/integrations/:key/test` | Test an integration connection |
| GET | `/tasks` | List tasks |
| POST | `/tasks` | Create a task |
| POST | `/tasks/:id/run` | Run a task immediately |
| GET | `/knowledge-base/entries` | List KB entries |
| POST | `/knowledge-base/ingest/document` | Ingest a PDF/DOCX/MD file |
| POST | `/knowledge-base/ingest/link` | Ingest a URL |
| GET | `/crisp/websites` | List Crisp websites |
| POST | `/crisp/websites` | Add a Crisp website |

Full API reference: `docs/09-rest-api.md`
