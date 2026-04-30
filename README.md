# cortex-os

Self-hosted AI agent platform for automating founder tasks. Most outbound agent actions are gated by Telegram Approve / Reject before execution. The **Live Chat** module is the exception — it serves real-time AI replies to website visitors and supports an in-app moderation queue instead of Telegram approval.

---

## Table of Contents

- [Stack](#stack)
- [Quick Start (local)](#quick-start-local-development)
- [Environment Variables](#environment-variables)
- [Integration Credentials](#integration-credentials-configured-in-ui)
- [Agents](#agents)
- [Live Chat](#live-chat)
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
| Storage | Cloudflare R2 (S3 SDK for live chat, MinIO client for KB ingestion) |
| Real-time | Socket.io (operator inbox + visitor widget, path `/ws` + `/livechat-ws`) |
| GeoIP | MaxMind GeoLite2 (offline `.mmdb` for visitor enrichment) |
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

> **Live chat attachments use Settings, not env vars.** Configure R2 in the UI: **Integrations → Storage**. The env vars below are an optional fallback for KB-ingestion code paths only.

| Variable | Value for R2 |
|---|---|
| `MINIO_ENDPOINT` | `<account-id>.r2.cloudflarestorage.com` |
| `MINIO_PORT` | `443` |
| `MINIO_USE_SSL` | `true` |
| `MINIO_ACCESS_KEY` | R2 API token Access Key ID |
| `MINIO_SECRET_KEY` | R2 API token Secret Access Key |
| `MINIO_BUCKET` | Bucket name, e.g. `cortex` |

### Optional — Live Chat extras

The Live Chat module needs zero env vars beyond the core ones. Two operator-side files are however required for full functionality:

- **MaxMind GeoLite2 database** at `apps/api/data/GeoLite2-City.mmdb` — enables visitor country / city / timezone enrichment. Free MaxMind account required; refresh quarterly. Falls back to nulls if missing. See [`apps/api/data/README.md`](apps/api/data/README.md).
- **AWS SES inbound** (DNS + Receipt Rule) — required only if you want visitors' replies to transcript emails to thread back into the conversation. Setup runbook in [`docs/livechat-module.md`](docs/livechat-module.md) under "LC-27 runbook".

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
| **Live Chat** | No external credentials — configure per-site via the Live Chat → Sites tab |

---

## Agents

| Agent | Key | Trigger | Description |
|---|---|---|---|
| **Live Chat** | `livechat` | Synchronous (visitor message) | KB-grounded AI replies on bytesed.com / xgenious.com / taskip.net; auto-send by default with optional moderation queue, file attachments via R2, transcript-on-close, email-to-thread |
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

## Live Chat

Self-hosted multi-site AI live chat embedded as a single `<script>` tag on bytesed.com / xgenious.com / taskip.net. One bundle serves every site; per-site appearance, persona, welcome message, brand color, position, LLM override, and moderation behavior are configured in the admin UI.

### Operator surface

- **Live Chat → Conversations** — Crisp-style 3-column inbox with live visitor count, page-journey timeline, and bidirectional typing indicators
- **Live Chat → Sites** — per-site config (Identity / Persona / Transcript / Advanced) + auto-shown Install Instructions modal on create
- **Live Chat → Setup** — copy-paste install snippet per site + manual test checklist

### Visitor surface

- Bottom-right (or bottom-left) chat bubble injected via `<script src="https://api.<your-domain>/livechat.js" data-site="<key>" defer></script>`
- Vanilla TS, Shadow DOM (no host-page CSS bleed), ~21 kB gzipped
- Lazy email capture, paste-to-upload images, file picker, URL auto-linkifying, persistent session across page reloads, SPA history hooks
- Sends pageview heartbeats every 30s while the tab is visible — drives the operator's "X online" panel

### Capabilities

- **Auto-send AI replies** (default ON) — KB-grounded agent with self-critique loop and `needs_human` fallback on blocklist hits or LLM failures
- **Moderation queue** (auto-send OFF) — drafts queue with inline Approve / Edit / Reject buttons; visitor never sees pending content
- **File attachments** via Cloudflare R2 (`StorageService` is module-namespaced and reusable from other agents)
- **Transcript on close** — HTML email of the full conversation via SES, with `Reply-To` that threads visitor replies back into the session
- **Email-to-thread** — `POST /livechat/inbound` (SES → SNS → cortex) reopens closed sessions when visitors reply
- **Cross-session visitor history** — past conversations surfaced in the visitor sidebar
- **Cloudflare integration** — R2 config in **Integrations → Storage** (no env vars)

### Module documentation

Full sprint-by-sprint changelog, AWS setup runbooks (R2, SES inbound, MaxMind), and operator runbooks live in **[`docs/livechat-module.md`](docs/livechat-module.md)**.

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
| GET | `/agents/livechat/sites` | List live chat sites |
| POST | `/agents/livechat/sites` | Add a live chat site |
| GET | `/agents/livechat/sessions?status=&siteKey=&hasPendingDrafts=` | Inbox list with filters |
| GET | `/agents/livechat/sessions/pending-count` | Moderation queue size |
| GET | `/agents/livechat/sessions/:id` | Session detail with messages + attachments |
| POST | `/agents/livechat/sessions/:id/{takeover,release,close,message}` | Operator actions |
| POST | `/agents/livechat/sessions/:id/send-transcript` | Manual transcript send |
| POST | `/agents/livechat/messages/:id/{approve,edit-and-approve,reject}` | Moderation queue actions |
| GET | `/agents/livechat/visitors/live` | Visitors online in the last 60s |
| GET | `/agents/livechat/visitors/:id/{sessions,pageviews}` | Visitor history |
| GET | `/livechat.js` | Embeddable widget bundle |
| POST | `/livechat/{message,upload,track/pageview,track/heartbeat,track/leave,identify,config}` | Visitor-facing endpoints (origin-gated, rate-limited) |
| POST | `/livechat/inbound` | SES inbound webhook for email-to-thread |

Full API reference: [`docs/09-rest-api.md`](docs/09-rest-api.md)
