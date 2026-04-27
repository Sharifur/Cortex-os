# cortex-os

Self-hosted AI agent platform for automating founder tasks. Every agent action is gated by Telegram Approve / Reject before execution.

---

## Table of Contents

- [Stack](#stack)
- [Quick Start (local)](#quick-start-local-development)
- [Environment Variables](#environment-variables)
- [Integration Credentials](#integration-credentials-configured-in-ui)
- [Agents](#agents)
- [Architecture](#architecture)
- [Production Deployment](#production-deployment)
- [API Reference](#api)

---

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
npx ts-node -r dotenv/config src/migrate.ts
```

### 4. Start development

```bash
# API (terminal 1)
cd apps/api && npm run start:dev

# Web (terminal 2)
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
| `JWT_SECRET` | Long random string — signs login tokens |
| `SETTINGS_ENCRYPTION_KEY` | 32-byte hex string (`openssl rand -hex 32`) — encrypts secrets in the DB |

> On first boot a default admin is created: **`admin@cortex.local`** / **`changeme123`**. Update from **Settings → Account** after logging in.

### Required — Telegram

| Variable | Description |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather |
| `TELEGRAM_OWNER_CHAT_ID` | Your personal Telegram chat ID — get it from @userinfobot |
| `TELEGRAM_WEBHOOK_SECRET` | Random string used to verify webhook requests from Telegram |

### Required — LLM (at least one)

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key — recommended, starts with `sk-` |
| `GEMINI_API_KEY` | Google Gemini API key (fallback) |
| `DEEPSEEK_API_KEY` | DeepSeek API key (second fallback) |

> The LLM router tries providers in order: OpenAI → Gemini → DeepSeek.

### Optional — Storage (Cloudflare R2)

Can also be configured via **Integrations → Storage** in the UI after deployment.

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
| `TASKIP_DB_URL_READONLY` | Read-only Postgres URL for Taskip DB |
| `TASKIP_API_BASE` | Taskip API base URL, default `https://api.taskip.net` |
| `TASKIP_WEBHOOK_SECRET` | Webhook secret for Taskip callbacks |

### App

| Variable | Description |
|---|---|
| `PORT` | HTTP port, default `3000` |
| `NODE_ENV` | `development` or `production` |
| `LOG_LEVEL` | Pino log level: `debug`, `info`, `warn`, `error` |

---

## Integration Credentials (configured in UI)

Stored encrypted in the database — do **not** put them in `.env`.

Configure after logging in at **Integrations** in the sidebar.

| Integration | Where to get credentials |
|---|---|
| **WhatsApp** | Meta for Developers → WhatsApp → API Setup |
| **LinkedIn** | Unipile dashboard (recommended) or direct OAuth2 token |
| **Reddit** | reddit.com/prefs/apps → create a script app |
| **Crisp** | Crisp → Settings → Website → API Keys (multi-site supported) |
| **Gmail** | Google Cloud Console → OAuth2 credentials (`https://mail.google.com/` scope) |
| **Amazon SES** | AWS IAM → user with `ses:SendEmail` permission |
| **Telegram** | Integrations → Telegram tab |
| **License Server** | Xgenious license server → Dashboard → Public API |
| **Storage (R2)** | Cloudflare Dashboard → R2 → Manage R2 API Tokens |

---

## Agents

| Agent | Key | Trigger | Description |
|---|---|---|---|
| Crisp | `crisp` | CRON 15min + webhook | Instant replies to Crisp chat (no approval) |
| Support | `support` | CRON 30min + webhook | Triages and replies to support tickets |
| WhatsApp | `whatsapp` | CRON 10min + webhook | Classifies and replies to WhatsApp messages |
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
    ↓ HTTPS  (cortex.xgenious.com)
NestJS API (Fastify)  (api.cortex.xgenious.com)
    ↓ BullMQ jobs → Worker
Agent Runner (Postgres-persisted state)
    ↓ Telegram
Owner approves / rejects each action
    ↓ on approve
Agent executes (sends message, posts, replies, etc.)
```

Every state transition writes to Postgres before acting. No fire-and-forget.

---

## Production Deployment

Full step-by-step guide: **[docs/production-release.md](docs/production-release.md)**

### Quick overview

Three Coolify applications deployed from this monorepo:

| App | Base Directory | Build | Port | Domain example |
|---|---|---|---|---|
| `api` | `apps/api` | Nixpacks | 3000 | `api.cortex.xgenious.com` |
| `worker` | `apps/api` | Nixpacks | — | *(no domain)* |
| `web` | `apps/web` | Nixpacks | 80 | `cortex.xgenious.com` |

Coolify infrastructure services required: **PostgreSQL 16**, **Redis 7**.
External storage: **Cloudflare R2** (provision separately, configure via Integrations → Storage).

> See [docs/production-release.md](docs/production-release.md) for env vars, health check setup, first-run checklist, and ongoing operations.

---

## API

Base URL: `https://api.cortex.xgenious.com` (production) or `http://localhost:3000` (local)

All endpoints require `Authorization: Bearer <jwt>` except `/auth/login` and `/health`.

| Method | Path | Description |
|---|---|---|
| POST | `/auth/login` | Login, returns JWT |
| GET | `/auth/me` | Current user profile |
| PUT | `/auth/profile` | Update login email |
| PUT | `/auth/password` | Change password |
| GET | `/health` | Service health check |
| GET | `/agents` | List all agents |
| POST | `/agents/:key/trigger` | Manually trigger an agent |
| GET | `/approvals` | List pending approvals |
| GET | `/settings` | List all settings |
| PUT | `/settings/:key` | Save a setting |
| POST | `/integrations/:key/test` | Test an integration connection |
| GET | `/tasks` | List tasks |
| POST | `/tasks` | Create a task |
| GET | `/knowledge-base/entries` | List KB entries |
| POST | `/knowledge-base/ingest/document` | Ingest a PDF/DOCX/MD file |
| POST | `/knowledge-base/ingest/link` | Ingest a URL |
| GET | `/crisp/websites` | List Crisp websites |
| POST | `/crisp/websites` | Add a Crisp website |

Full API reference: [`docs/09-rest-api.md`](docs/09-rest-api.md)
