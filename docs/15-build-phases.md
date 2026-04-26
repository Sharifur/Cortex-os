# Build Phases

**Rule: Do not start a phase until the previous one is operational.**

---

## Phase 1 — Platform Core

- [ ] NestJS scaffold, Drizzle ORM, Postgres, Redis, MinIO, BullMQ
- [ ] Auth module, JWT, owner seed
- [ ] Agent Runtime (interfaces, runner, persistence)
- [ ] LLM Router (OpenAI first, then Gemini, DeepSeek)
- [ ] Telegram Bot + Approve / Reject / Follow-up flow + webhook
- [ ] MCP server framework + MCP client
- [ ] Approval expiry sweeper (every 15 min)
- [ ] Admin panel: login, dashboard, agents list, run detail, approvals page, MCP page
- [ ] Health endpoint, Prometheus metrics, Pino logs

---

## Phase 2 — Reference Agent

- [ ] Trial User Email Agent end-to-end (`taskip_trial`)
- [ ] SES integration + bounce/complaint handling (reuse `SESWebhookController`)

---

## Phase 3 — High-Leverage Agents

- [ ] Email Manager (`email_manager`)
- [ ] Daily Task Reminder (`daily_reminder`)
- [ ] Taskip Internal AI Agent (`taskip_internal`)

---

## Phase 4 — Integration-Heavy Agents

- [ ] Support Ticket Manager (`support`)
- [ ] WhatsApp Business Watcher (`whatsapp`)
- [ ] LinkedIn AI Agent (`linkedin`)
- [ ] Reddit Followup Agent (`reddit`)

---

## Phase 5 — Bespoke Agents

- [ ] HR Manager Agent (`hr`)
- [ ] Social Media Handler (`social`)
- [ ] Canva + Social Content Agent (`canva`)

---

## Acceptance Criteria (per agent)

An agent is "done" when all of the following pass:

1. Triggers fire reliably (BullMQ board shows them; webhooks return 200 and create runs)
2. A run produces at least one `ProposedAction` for a realistic test case
3. Telegram message arrives with Approve / Reject / Follow up buttons
4. Approve executes the action; Reject ends the run; Follow-up redrafts and re-asks
5. Failures retry 3× and surface in admin panel without poisoning the queue
6. All actions appear in `agent_runs.result` and `agent_logs`
7. Metrics increment correctly
8. `/mcp/:key` exposes the agent's declared tools and they execute
9. `/agents/:key/api/*` routes work with both JWT and per-agent API key auth
10. Admin panel can manually trigger and view the run

---

## Out of Scope (v1)

- Multi-user / multi-tenant
- Vector DB / RAG (use Postgres FTS; revisit if quality demands it)
- Mobile app
- Plugin marketplace
- RBAC beyond single owner
- Self-improving / auto-prompt-tuning loops
