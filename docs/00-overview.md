# AI Agent Platform — Overview

**Version:** 1.1  
**Owner:** Sharifur (Taskip / Xgenious)  
**Deployment:** Self-hosted VPS via Coolify (Coolify-native resources only)

## Purpose

A self-hosted multi-agent platform to automate repetitive owner/founder tasks across Taskip, Xgenious, and personal workflows. Every agent action that touches the outside world is gated by a Telegram **Approve / Reject / Follow up** confirmation before execution.

## Changelog from v1.0

- ORM swapped from Prisma to **Drizzle ORM** (SQL-first, Laravel-query-builder-like feel)
- Telegram approval flow extended from Approve/Reject to **Approve / Reject / Follow up**
- Infrastructure constrained to **Coolify-native resources only** (no AWS managed DBs, no external SaaS)
- Each agent now exposes **its own MCP tool surface** and **its own HTTP API surface**

## Key Constraints

- Single-owner system — no multi-tenant, no RBAC beyond owner
- All infrastructure via Coolify catalog (Postgres, Redis, MinIO, Uptime Kuma, Grafana)
- AWS SES is the only AWS dependency (remote SMTP/HTTP API, not infra)
- Secrets only in Coolify env vars — never in DB or repo
