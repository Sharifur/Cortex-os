# Cortex OS — Production Release Guide

## 1. Infrastructure services

### Coolify one-click services

Provision these from Coolify → Services before deploying the apps.

| Service | Version | Purpose |
|---|---|---|
| PostgreSQL | 16 | Primary database — agents, runs, approvals, settings, tasks |
| Redis | 7 | BullMQ job queues, KB cache (5-min TTL) |
| Uptime Kuma | latest | Ping `/health` every 60s for uptime monitoring |
| Grafana | latest | Dashboard over Prometheus metrics |

### External service

| Service | Purpose |
|---|---|
| Cloudflare R2 | S3-compatible object storage for knowledge base file ingestion (PDFs, DOCX). Free tier: 10GB storage, no egress fees. |

Create a bucket named `cortex` (or your preferred name) in Cloudflare Dashboard → R2, then generate an R2 API token with Object Read & Write permissions.

---

## 2. Application services

Three apps built from the same monorepo. Deploy all three in Coolify.

| App | Dockerfile | Start command | Port |
|---|---|---|---|
| `api` | `docker/Dockerfile.api` | *(default CMD)* | 3000 |
| `worker` | `docker/Dockerfile.api` | `node -r dotenv/config dist/src/worker` | — |
| `web` | `docker/Dockerfile.web` | *(static, served by Caddy)* | 80 |

**Migrations run automatically** — the API container runs `node dist/src/migrate` before starting. No manual migration step needed on deploy.

---

## 3. Environment variables

Set these in Coolify for the `api` and `worker` apps (both use the same image).

### Core

| Variable | Required | Example / Notes |
|---|---|---|
| `DATABASE_URL` | yes | `postgresql://user:pass@host:5432/cortex` |
| `REDIS_URL` | yes | `redis://host:6379` |
| `PORT` | no | `3000` (default) |
| `NODE_ENV` | yes | `production` |
| `LOG_LEVEL` | no | `info` (default in production) |

### Auth

| Variable | Required | Notes |
|---|---|---|
| `JWT_SECRET` | yes | Long random string — used for login tokens and as fallback encryption key |
| `SETTINGS_ENCRYPTION_KEY` | yes | 32-byte hex string (`openssl rand -hex 32`) — encrypts secrets stored in the DB. **Do not rotate without re-encrypting existing values.** |
| `OWNER_EMAIL` | yes | Login email for the web UI |
| `OWNER_PASSWORD` | yes | Login password for the web UI |

### Cloudflare R2 (object storage)

The app uses the MinIO client which is S3-compatible — point it at R2 with these values.

| Variable | Required | Value for R2 |
|---|---|---|
| `MINIO_ENDPOINT` | yes | `<account-id>.r2.cloudflarestorage.com` — find Account ID in Cloudflare Dashboard → R2 |
| `MINIO_PORT` | yes | `443` |
| `MINIO_USE_SSL` | yes | `true` |
| `MINIO_ACCESS_KEY` | yes | R2 API token Access Key ID |
| `MINIO_SECRET_KEY` | yes | R2 API token Secret Access Key |
| `MINIO_BUCKET` | yes | Bucket name, e.g. `cortex` |

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

The LLM router falls back in order: OpenAI → Gemini → DeepSeek. Configure at least one.

### AWS SES (email sending)

| Variable | Notes |
|---|---|
| `AWS_ACCESS_KEY_ID` | IAM user with `ses:SendEmail` |
| `AWS_SECRET_ACCESS_KEY` | |
| `AWS_REGION` | e.g. `ap-south-1` |
| `SES_CONFIG_SET` | e.g. `ses-monitoring` |

### Taskip internal (taskip_internal + taskip_trial agents)

| Variable | Notes |
|---|---|
| `TASKIP_DB_URL_READONLY` | Read-only Postgres URL for Taskip database |
| `TASKIP_API_BASE` | e.g. `https://api.taskip.net` |
| `TASKIP_WEBHOOK_SECRET` | Webhook signature secret |

---

## 4. Coolify deployment steps

1. **Create Coolify services** — PostgreSQL 16, Redis 7, Uptime Kuma, Grafana. Note the internal hostnames Coolify assigns to Postgres and Redis.
   **Create the R2 bucket** in Cloudflare Dashboard → R2 and generate an API token.

2. **Add a new application** from the GitHub repo for each of the three apps.

3. For `api` and `worker`: set Dockerfile path to `docker/Dockerfile.api`. Override the start command for `worker` to:
   ```
   node -r dotenv/config dist/src/worker
   ```

4. **Paste all environment variables** from section 3 into Coolify's env editor for `api` and `worker`.

5. **Deploy `api` first** — it seeds the database on first run. Check logs for `Migrations complete` and the `[NestApplication] Nest application successfully started` line.

6. **Deploy `worker`** — it connects to the same DB/Redis and processes the BullMQ queues.

7. **Deploy `web`** — point Coolify to `docker/Dockerfile.web`. No env vars needed (it talks to the API via the browser).

8. **Configure a domain and HTTPS** for `api` and `web` in Coolify. The web frontend proxies all `/auth`, `/agents`, `/runs` etc. paths to the API — make sure the reverse proxy is set up correctly.

---

## 5. First-run checklist

After the first successful deploy, open the web UI and complete setup.

### Settings page (`/settings`)

Configure at minimum:

- [ ] Default LLM provider + API key(s)
- [ ] Default models for OpenAI / Gemini / DeepSeek
- [ ] Embedding model (used by knowledge base)

### Integrations page (`/integrations`)

Configure each service you intend to use:

| Tab | What to fill in |
|---|---|
| Telegram | Bot token + Owner chat ID. Hit **Test connection** — it must show "chat verified" before agents can send messages. |
| Crisp | Add one website entry per Crisp site (label, Website ID, Identifier, API Key). Configure webhook URL in each Crisp website's Settings → Integrations → Webhooks, event `message:send`. |
| WhatsApp | API token, Phone Number ID. Set webhook URL in Meta for Developers. |
| LinkedIn | Unipile API key + DSN (recommended) or direct access token. |
| Reddit | Client ID, secret, username, password. |
| Email (SES) | AWS credentials, from address. |
| Gmail | OAuth2 client ID, secret, refresh token. |
| License Server | URL, API Signature (xs\_...), default Envato account slug. |

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

Each agent has a **Setup** sub-tab on its detail page with configuration fields specific to that agent.

---

## 6. Post-deploy verification

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
    "minio":    { "status": "ok" },
    "llm":      { "status": "ok", "message": "OpenAI" },
    "telegram": { "status": "ok" }
  }
}
```

`status` is `ok` when postgres and redis are both healthy. All other checks are advisory.

### Telegram smoke test

Go to Integrations → Telegram → **Test connection**. It must return "chat verified". If it returns "chat ID not reachable", send `/start` to your bot in Telegram and test again.

### Agent run smoke test

On the Agents page, find `daily_reminder`, open it, and click **Run now**. Within a few seconds you should receive a Telegram message. Check the Activity page for the run status.

---

## 7. Ongoing operations

| Task | How |
|---|---|
| Deploy new version | Push to `main` — Coolify auto-deploys if webhook is configured |
| Add new migrations | Write SQL in `apps/api/drizzle/` — applied automatically on next deploy |
| Rotate `SETTINGS_ENCRYPTION_KEY` | Re-encrypt all secrets in `platform_settings` before changing the key |
| View agent logs | Activity page in the web UI, or `docker logs` on the api container |
| Approve pending actions | Telegram `Approve` / `Reject` buttons, or Approvals page in the web UI |
| Add knowledge base content | Knowledge Base page → Import tab (URL, PDF, DOCX, Markdown) |
