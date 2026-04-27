# Cortex OS — Production Release Guide

## Table of Contents

- [1. Infrastructure services](#1-infrastructure-services)
- [2. Application overview](#2-application-overview)
- [3. Coolify deployment — API](#3-coolify-deployment--api)
- [4. Coolify deployment — Worker](#4-coolify-deployment--worker)
- [5. Coolify deployment — Web](#5-coolify-deployment--web)
- [6. Environment variables](#6-environment-variables)
- [7. First-run checklist](#7-first-run-checklist)
- [8. Post-deploy verification](#8-post-deploy-verification)
- [9. Ongoing operations](#9-ongoing-operations)

---

## 1. Infrastructure services

### Coolify one-click services

Provision these from Coolify → Services before deploying the apps.

| Service | Version | Purpose |
|---|---|---|
| PostgreSQL | 16 | Primary database — agents, runs, approvals, settings, tasks |
| Redis | 7 | BullMQ job queues, KB cache (5-min TTL) |
| Uptime Kuma | latest | Ping `/health` every 60s for uptime monitoring |
| Grafana | latest | Dashboard over Prometheus metrics |

After provisioning, note the **internal hostnames** Coolify assigns to Postgres and Redis — use them in `DATABASE_URL` and `REDIS_URL`.

### External service

| Service | Purpose |
|---|---|
| Cloudflare R2 | S3-compatible object storage for knowledge base file ingestion (PDFs, DOCX). Free tier: 10 GB storage, no egress fees. |

Create a bucket (e.g. `cortex`) in Cloudflare Dashboard → R2, then generate an R2 API token with **Object Read & Write** permissions.

---

## 2. Application overview

Three Coolify applications built from the same GitHub repo.

| App | Base Directory | Build pack | Start command | Port | Domain |
|---|---|---|---|---|---|
| `api` | `apps/api` | Nixpacks | `node dist/src/migrate && node dist/src/main` | 3000 | `api.yourdomain.com` |
| `worker` | `apps/api` | Nixpacks | `node dist/src/worker` | — | *(no domain)* |
| `web` | `apps/web` | Nixpacks | *(auto-detected)* | 80 | `yourdomain.com` |

**Migrations run automatically** — the API start command runs `dist/src/migrate` before `dist/src/main`. No manual step needed on deploy.

---

## 3. Coolify deployment — API

1. **New Resource → Application** → connect GitHub repo → select the `main` branch.
2. **General tab:**
   - Build pack: `Nixpacks`
   - Base Directory: `apps/api`
   - Start Command: `node dist/src/migrate && node dist/src/main`
   - Ports Exposes: `3000`
   - Domain: `https://api.yourdomain.com`
3. **Healthchecks tab:**
   - Type: `HTTP`
   - Method: `GET`
   - Host: `localhost`
   - Port: `3000`
   - Path: `/health`
   - Return Code: `200`
   - Start Period: `30` seconds (migrations can take a few seconds on first boot)
4. **Environment Variables tab:** paste all variables from [Section 6](#6-environment-variables).
5. **Save → Deploy.**

Check logs for:
```
Migrations complete
[NestApplication] Nest application successfully started
```

---

## 4. Coolify deployment — Worker

1. **New Resource → Application** → same GitHub repo → same branch.
2. **General tab:**
   - Build pack: `Nixpacks`
   - Base Directory: `apps/api`
   - Start Command: `node dist/src/worker`
   - Ports Exposes: *(leave empty — no HTTP port)*
   - Domain: *(leave empty)*
3. **Healthchecks tab:** disable healthcheck (worker has no HTTP endpoint).
4. **Environment Variables tab:** same variables as the API app.
5. **Save → Deploy.**

---

## 5. Coolify deployment — Web

1. **New Resource → Application** → same GitHub repo → same branch.
2. **General tab:**
   - Build pack: `Nixpacks`
   - Base Directory: `apps/web`
   - Start Command: *(leave empty — Nixpacks auto-detects Vite and serves static files)*
   - Ports Exposes: `80`
   - Domain: `https://yourdomain.com`
3. **Environment Variables tab:**
   - `VITE_API_URL` = `https://api.yourdomain.com`
4. **Healthchecks tab:**
   - Type: `HTTP`, Port: `80`, Path: `/`
5. **Save → Deploy.**

> The web app uses `VITE_API_URL` to reach the API. This variable is baked into the static build by Vite — set it before deploying.

---

## 6. Environment variables

Set these in Coolify for the **`api`** and **`worker`** apps (both use the same image, both need the same vars).

### Core

| Variable | Required | Example / Notes |
|---|---|---|
| `DATABASE_URL` | yes | `postgresql://user:pass@postgres-hostname:5432/cortex` |
| `REDIS_URL` | yes | `redis://redis-hostname:6379` |
| `PORT` | no | `3000` (default) |
| `NODE_ENV` | yes | `production` |
| `LOG_LEVEL` | no | `info` (default in production) |

### Auth

| Variable | Required | Notes |
|---|---|---|
| `JWT_SECRET` | yes | Long random string — signs login tokens |
| `SETTINGS_ENCRYPTION_KEY` | yes | 32-byte hex string (`openssl rand -hex 32`) — encrypts secrets in the DB. **Do not rotate without re-encrypting existing values.** |

> Default admin on first boot: **`admin@cortex.local`** / **`changeme123`**. Log in and update from **Settings → Account**.

### Telegram

| Variable | Required | Notes |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | yes | From @BotFather |
| `TELEGRAM_OWNER_CHAT_ID` | yes | Your personal Telegram chat ID |
| `TELEGRAM_WEBHOOK_SECRET` | no | Random string for webhook signature verification |

### LLM providers (at least one required)

| Variable | Notes |
|---|---|
| `OPENAI_API_KEY` | Primary provider. Starts with `sk-` |
| `GEMINI_API_KEY` | Google AI Studio key |
| `DEEPSEEK_API_KEY` | DeepSeek API key |

The LLM router falls back in order: OpenAI → Gemini → DeepSeek.

### Cloudflare R2 (object storage)

Can also be configured via **Integrations → Storage** in the UI — settings take precedence over env vars.

| Variable | Required | Value for R2 |
|---|---|---|
| `MINIO_ENDPOINT` | yes | `<account-id>.r2.cloudflarestorage.com` |
| `MINIO_PORT` | yes | `443` |
| `MINIO_USE_SSL` | yes | `true` |
| `MINIO_ACCESS_KEY` | yes | R2 API token Access Key ID |
| `MINIO_SECRET_KEY` | yes | R2 API token Secret Access Key |
| `MINIO_BUCKET` | yes | Bucket name, e.g. `cortex` |

### AWS SES (email sending)

| Variable | Notes |
|---|---|
| `AWS_ACCESS_KEY_ID` | IAM user with `ses:SendEmail` |
| `AWS_SECRET_ACCESS_KEY` | |
| `AWS_REGION` | e.g. `ap-south-1` |
| `SES_CONFIG_SET` | e.g. `ses-monitoring` |

### Taskip internal

| Variable | Notes |
|---|---|
| `TASKIP_DB_URL_READONLY` | Read-only Postgres URL for Taskip database |
| `TASKIP_API_BASE` | e.g. `https://api.taskip.net` |
| `TASKIP_WEBHOOK_SECRET` | Webhook signature secret |

---

## 7. First-run checklist

After the first successful deploy, open the web UI and complete setup.

### Settings → Account

- [ ] Update login email (default: `admin@cortex.local`)
- [ ] Update password (default: `changeme123`)

### Settings page (`/settings`)

- [ ] Default LLM provider + API key(s)
- [ ] Default models for OpenAI / Gemini / DeepSeek
- [ ] Embedding model (used by knowledge base)

### Integrations page (`/integrations`)

| Tab | What to fill in |
|---|---|
| Telegram | Bot token + Owner chat ID. Hit **Test connection** — must show "chat verified". |
| Crisp | Add one entry per Crisp site (label, Website ID, Identifier, API Key). Add webhook URL in Crisp → Settings → Integrations → Webhooks, event `message:send`. |
| WhatsApp | API token, Phone Number ID. Set webhook URL in Meta for Developers. |
| LinkedIn | Unipile API key + DSN (recommended) or direct access token. |
| Reddit | Client ID, secret, username, password. |
| Email (SES) | AWS credentials, from address. |
| Gmail | OAuth2 client ID, secret, refresh token. |
| License Server | URL, API Signature (`xs_...`), default Envato account slug. |
| Storage (R2) | Endpoint, Access Key, Secret Key, bucket name. Or set via env vars. |

### Agents page (`/agents`)

Enable only the agents you want active. All are disabled by default.

| Agent key | What it does | Dependencies |
|---|---|---|
| `daily_reminder` | Morning/evening Telegram briefs | Telegram |
| `crisp` | Auto-replies to Crisp live chat | Crisp websites configured |
| `support` | Processes support ticket queue | — |
| `email_manager` | Monitors and drafts email replies | Gmail or SES |
| `whatsapp` | Auto-replies to WhatsApp messages | WhatsApp |
| `linkedin` | Monitors LinkedIn DMs / posts | LinkedIn (Unipile) |
| `reddit` | Monitors subreddit mentions | Reddit |
| `social` | Social media post scheduling | LinkedIn / Reddit |
| `shorts` | Generates short-form video scripts | LLM only |
| `taskip_trial` | Manages Taskip trial user flows | `TASKIP_*` vars |
| `taskip_internal` | Internal Taskip automation | `TASKIP_*` vars |
| `hr` | HR management tasks | — |
| `canva` | Canva design + social content | Canva MCP |

---

## 8. Post-deploy verification

### Health check

```
GET https://api.yourdomain.com/health
```

Expected response:

```json
{
  "status": "ok",
  "checks": {
    "postgres": { "status": "ok" },
    "redis":    { "status": "ok" },
    "storage":  { "status": "ok" },
    "llm":      { "status": "ok", "message": "OpenAI" },
    "telegram": { "status": "ok" }
  }
}
```

`status` is `ok` when postgres and redis are both healthy. All other checks are advisory.

### Telegram smoke test

Go to Integrations → Telegram → **Test connection**. Must return "chat verified". If it returns "chat ID not reachable", send `/start` to your bot in Telegram first.

### Agent run smoke test

Agents page → `daily_reminder` → **Run now**. You should receive a Telegram message within a few seconds. Check the Activity page for run status.

---

## 9. Ongoing operations

| Task | How |
|---|---|
| Deploy new version | Push to `main` — Coolify auto-deploys if the GitHub webhook is configured |
| Add new migrations | Write SQL in `apps/api/drizzle/` — applied automatically on next API deploy |
| Rotate `SETTINGS_ENCRYPTION_KEY` | Re-encrypt all rows in `platform_settings` before swapping the key |
| View agent logs | Activity page in the web UI, or Coolify → api → Logs |
| Approve pending actions | Telegram Approve / Reject buttons, or Approvals page in the web UI |
| Add knowledge base content | Knowledge Base page → Import tab (URL, PDF, DOCX, Markdown) |
| Update admin email/password | Settings → Account |
