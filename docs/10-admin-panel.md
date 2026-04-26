# Admin Panel

**Stack:** React 18 + TypeScript + Vite + Zustand + TanStack Query + Tailwind + shadcn/ui

## Pages

| Page | Content |
|---|---|
| Login | Single-owner auth |
| Dashboard | Runs today/week, pending approvals, failures |
| Agents | List with status, last run, success rate, enable toggle |
| Agent Detail | Config (JSON form), prompts, MCP tools list, API routes with copy-curl, runs, manual trigger |
| Runs | Global filterable list; detail shows context, proposed actions, follow-up thread, logs |
| Approvals | Pending list with Approve / Reject / Follow-up (mirrors Telegram) |
| Integrations | Status grid, test buttons |
| MCP | Exposed MCP servers (one per agent) + external MCP servers configured |
| Settings | Owner profile, Telegram chat ID, LLM keys, SES, MinIO, agent API keys |

## State Management

**Zustand stores:**
- `authStore` — JWT, user profile
- `agentsStore` — agents list, selected agent
- `runsStore` — runs list, active run detail
- `approvalsStore` — pending approvals
- `uiStore` — modals, loading states, sidebar

**TanStack Query** — server cache for all API data with optimistic updates

## Real-Time

- **SSE** for live run logs (`GET /runs/:id/logs`)
- **Polling (10s)** for dashboard counts and approvals

## Deployment

Static React build served by **Caddy** — separate Coolify app from the NestJS API.
