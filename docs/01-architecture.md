# Architecture

## Style

Single **NestJS monolith** organized as feature modules. Not microservices.

Each agent is a module that registers with a shared **Agent Runtime** and may:
- Declare an MCP tool list (used by its own LLM calls + served externally)
- Expose HTTP routes under `/agents/:key/api/*`

## Top-Level Components

| Component | Responsibility | Coolify Resource |
|---|---|---|
| API Gateway (NestJS) | REST API, webhooks, MCP server endpoints | App (Docker image) |
| Agent Runtime | Trigger → context → LLM → tools → approval → execute → log | Same image as API |
| Worker (BullMQ) | Async agent runs and scheduled jobs | App (Docker image, separate command) |
| Scheduler | Cron triggers via BullMQ repeatable jobs | Inside worker |
| Telegram Bot | Approval prompts, callback handling, follow-up threads | Inside API service |
| Admin Panel | React + TypeScript + Zustand SPA | App (static build, served by Caddy) |
| Postgres | Primary datastore | Coolify Postgres 16 |
| Redis | BullMQ + cache + session for follow-up threads | Coolify Redis 7 |
| MinIO | Object storage (Canva exports, attachments, WhatsApp media, salary sheets) | Coolify MinIO |
| Uptime Kuma | External uptime checks of integrations | Coolify Uptime Kuma |
| Grafana + Prometheus | Optional observability stack | Coolify Grafana / Prometheus |
| LLM Router | Provider abstraction over Gemini, DeepSeek, OpenAI | App-internal module |
| Integration Layer | Adapters for SES, Telegram, WhatsApp, LinkedIn, Reddit, Canva | App-internal modules |

No AWS managed services for infrastructure. SES is the only AWS dependency.

## Run Lifecycle

```
Trigger (cron | webhook | manual | MCP | API)
    │
    ▼
Enqueue AgentRun job (BullMQ)
    │
    ▼
Worker → loads agent config → buildContext()
    │
    ▼
LLM call (LLM Router with agent's MCP tools) → ProposedAction[]
    │
    ▼
For each action requiring approval:
    persist PendingApproval, send Telegram message with 3 buttons, EXIT

Otherwise:
    execute → log → done

[Telegram callback]
    │
    ├─ Approve  → enqueue execute-action job → run tool → log
    ├─ Reject   → mark resolved, log, end run
    └─ Follow up → open conversation thread:
            owner sends free-text instruction in Telegram reply
            runtime appends instruction to AgentRun.context.followups
            re-runs decide() with augmented context
            new ProposedAction[] generated → new approval cycle
```

**Durability rule:** every state transition writes to Postgres. Worker process can die at any point and the run resumes from the last persisted step.
