# Project Structure

```
/apps
  /api
    /src
      /modules
        /auth
        /agents
          /runtime         ← AgentRuntimeService, ApprovalService, FollowupService
          /mcp             ← McpServerService, McpClientService
          /taskip-trial
            agent.ts
            schema.ts
            tools.ts
            routes.ts
            prompts/
          /taskip-internal
          /linkedin
          /support
          /reddit
          /canva
          /hr
          /whatsapp
          /social
          /daily-reminder
          /email-manager
        /llm               ← router, providers/
        /telegram
        /integrations
          /ses
          /taskip
          /linkedin
          /reddit
          /whatsapp
          /canva
          /minio
        /webhooks
        /metrics
      /db
        schema.ts          ← barrel re-exporting all module schemas
        client.ts          ← drizzle client
      /common              ← guards, interceptors, queue
      main.ts
      worker.ts
    drizzle.config.ts
    /drizzle               ← generated migrations

  /web
    /src
      /pages
      /components
      /stores              ← zustand stores
      /api                 ← TanStack Query hooks

/docker
  Dockerfile.api
  Dockerfile.web

docker-compose.yml         ← local dev only
```

## Key Conventions

- Each agent module is self-contained: `agent.ts`, `schema.ts`, `tools.ts`, `routes.ts`, `prompts/`
- Agent schemas are imported into `/db/schema.ts` barrel — `drizzle-kit` reads them all
- Worker entry (`worker.ts`) is a separate process, same Docker image as API
- Integration adapters live in `/integrations/` — agents import from there, not from each other
