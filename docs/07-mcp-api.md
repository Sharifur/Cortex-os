# MCP Tools and Per-Agent HTTP API

## MCP Tools (Dual-Purpose)

Each agent declares `mcpTools()`. These serve two purposes simultaneously:

1. **Available to its own LLM call** — runtime maps them into provider tool/function-calling format
2. **Served as MCP server endpoint** at `/mcp/:agentKey` — external MCP clients (Claude Desktop, Cursor, other agents) can call them

### MCP Server Discovery

`GET /mcp` → lists all agent MCP servers and their tools

### MCP Client Capability

The platform also acts as an **MCP client**. Agents may consume external MCP servers configured in `Agent.config.externalMcp[]`. Connections are lazily established and pooled.

### Auth for MCP Endpoints

`/mcp/:key` requires either:
- JWT (same as admin panel)
- Per-agent MCP token

## Per-Agent HTTP API

Each agent declares `apiRoutes()`. These are mounted at `/agents/:key/api/*`.

### Examples

| Method | Path | Purpose |
|---|---|---|
| POST | `/agents/taskip_trial/api/run-segment` | Manually trigger a segment |
| POST | `/agents/support/api/ingest-ticket` | Push a ticket into the agent |
| GET | `/agents/hr/api/salary-sheet/:month` | Fetch generated sheet |
| POST | `/agents/whatsapp/api/mark-read/:msgId` | Mark message read |

### Auth for Agent API Routes

Same JWT as admin panel **OR** per-agent API key in `Agent.config.apiKey` (rotated via panel) for external systems.

### OpenAPI Discovery

`GET /agents/:key/api` → OpenAPI spec for that agent's HTTP surface

## Metrics

Prometheus tracks:
- `mcp_calls_total{agent,tool,direction}` where direction = `inbound | outbound`
