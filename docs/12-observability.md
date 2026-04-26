# Observability

## Logging

- **Pino** JSON structured logs
- Coolify log viewer for live tailing
- Persisted per-run in `agent_logs` table

## Prometheus Metrics (at `/metrics`)

| Metric | Labels |
|---|---|
| `agent_runs_total` | `{agent, status}` |
| `agent_run_duration_seconds` | `{agent}` — histogram |
| `llm_tokens_total` | `{provider, model, direction}` |
| `llm_cost_usd_total` | `{provider, model}` |
| `approvals_pending` | — |
| `approvals_followup_active` | — |
| `queue_depth` | `{queue}` |
| `mcp_calls_total` | `{agent, tool, direction}` — direction = `inbound\|outbound` |

## Grafana (Optional)

Grafana + Prometheus from Coolify catalog. Use for dashboards over the Prometheus metrics above.

## Uptime Monitoring

**Uptime Kuma** (Coolify catalog) checks health endpoints of each external integration.

## Health Endpoint

`GET /health` — returns service status, DB connectivity, Redis connectivity, queue status.
