# Queue Design (BullMQ)

| Queue | Purpose | Concurrency |
|---|---|---|
| `agent-run` | Decide phase | 5 |
| `agent-execute` | Execute approved actions | 3 |
| `agent-followup` | Re-run decide() with follow-up context | 3 |
| `scheduled-triggers` | Cron jobs that enqueue `agent-run` | 1 |
| `integrations-poll` | Polling jobs (LinkedIn, Reddit, Gmail) | 2 |
| `approval-sweep` | Expire stale approvals (every 15 min) | 1 |

## Retry Policy

All jobs: **3 retries**, exponential backoff: 1m → 5m → 15m. Failures logged.

## Durability

Every job state transition also writes to Postgres. If the worker process dies, the run resumes from the last persisted step.

## Scheduled Jobs

Cron triggers are implemented as BullMQ **repeatable jobs** inside the `scheduled-triggers` queue, which then enqueue individual `agent-run` jobs.

## Monitoring

BullMQ board (via BullBoard) can be enabled in the admin panel to inspect queue depth, job states, and failures.

Prometheus metric: `queue_depth{queue}` tracks current pending jobs per queue.
