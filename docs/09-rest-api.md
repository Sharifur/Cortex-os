# REST API Endpoints

## Auth

```
POST   /auth/login
GET    /auth/me
```

## Agents

```
GET    /agents
GET    /agents/:key
PATCH  /agents/:key
POST   /agents/:key/trigger
GET    /agents/:key/runs
```

## Per-Agent Custom Surface

```
ANY    /agents/:key/api/*        (delegated to agent.apiRoutes())
```

## MCP Server Endpoints

```
ANY    /mcp/:key                 (one MCP server per agent)
GET    /mcp                      (list all MCP servers and tools)
```

## Runs

```
GET    /runs/:id
GET    /runs/:id/logs            (SSE stream — live log tailing)
```

## Approvals

```
GET    /approvals
POST   /approvals/:id/approve
POST   /approvals/:id/reject
POST   /approvals/:id/followup   { instruction: string }
```

## Integrations

```
GET    /integrations
POST   /integrations/:key/test
```

## Webhooks

```
POST   /webhooks/telegram
POST   /webhooks/ses
POST   /webhooks/whatsapp
POST   /webhooks/taskip
POST   /webhooks/:agentKey       (generic — dispatched to agent module)
```

## System

```
GET    /metrics                  (Prometheus endpoint)
GET    /health
```

## Auth Strategy

- Admin panel: JWT 24h + refresh rotation
- External systems hitting `/agents/:key/api/*`: per-agent API key in `Agent.config.apiKey`
- MCP endpoints `/mcp/:key`: JWT or per-agent MCP token
- Webhook endpoints: signature verification per provider (SNS, Telegram secret, WhatsApp HMAC, shared secret)
