# Tech Stack (Locked)

| Layer | Choice |
|---|---|
| Backend | NestJS (Node.js 20+), Fastify adapter |
| ORM | **Drizzle ORM** with `drizzle-orm/postgres-js` |
| Migrations | `drizzle-kit` (`drizzle-kit generate`, `drizzle-kit migrate`) |
| Database | PostgreSQL 16 (Coolify-managed) |
| Queue | BullMQ on Redis 7 (Coolify-managed) |
| Object Storage | MinIO (Coolify-managed, S3-compatible SDK) |
| Frontend | React 18 + TypeScript + Vite + Zustand + TanStack Query + Tailwind + shadcn/ui |
| Auth | Single-owner JWT (no multi-tenant) |
| LLM Providers | Gemini, DeepSeek, OpenAI (pluggable, configurable per agent) |
| MCP | `@modelcontextprotocol/sdk` — client (consuming) + server (exposing) |
| Email | AWS SES `ap-south-1`, reuse `ses-monitoring` config set + `SESWebhookController` |
| Telegram | `grammy` |
| Deployment | Coolify on VPS — separate apps: `api`, `worker`, `web` |
| Observability | Pino logs, Prometheus metrics endpoint |
| Secrets | Coolify env-var management |

## Notes

- Drizzle preferred for its SQL-first, Laravel-query-builder-like feel
- Each agent module contributes its own schema file, imported into the central barrel
- Migrations run on `api` startup automatically via `drizzle-kit migrate`
- No Prisma — fully replaced by Drizzle in v1.1
