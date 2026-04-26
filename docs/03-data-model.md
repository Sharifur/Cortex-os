# Data Model (Drizzle Schema)

File: `apps/api/src/db/schema.ts` (barrel re-exporting all module schemas)

## Enums

```ts
triggerType  = ['CRON','WEBHOOK','MANUAL','CHAINED','MCP','API']

runStatus    = ['PENDING','RUNNING','AWAITING_APPROVAL','APPROVED',
                'REJECTED','EXECUTED','FAILED','FOLLOWUP']

approvalStatus = ['PENDING','APPROVED','REJECTED','FOLLOWUP','EXPIRED']

logLevel     = ['DEBUG','INFO','WARN','ERROR']
```

## Core Tables

### users
| Column | Type | Notes |
|---|---|---|
| id | text PK | cuid2 |
| email | text | unique, not null |
| password | text | bcrypt |
| telegramChatId | text | nullable |
| createdAt | timestamp | defaultNow |

### agents
| Column | Type | Notes |
|---|---|---|
| id | text PK | cuid2 |
| key | text | unique — e.g. `taskip_trial` |
| name | text | |
| description | text | nullable |
| enabled | boolean | default true |
| config | jsonb | prompts, schedules, llm provider, mcp tools, api routes |
| createdAt | timestamp | |
| updatedAt | timestamp | |

### agentRuns
| Column | Type | Notes |
|---|---|---|
| id | text PK | cuid2 |
| agentId | text | FK → agents.id |
| triggerType | enum | triggerType |
| triggerPayload | jsonb | nullable |
| status | enum | runStatus |
| context | jsonb | `{ source, snapshot, followups: [] }` |
| proposedActions | jsonb | nullable |
| result | jsonb | nullable |
| error | text | nullable |
| startedAt | timestamp | defaultNow |
| finishedAt | timestamp | nullable |

### pendingApprovals
| Column | Type | Notes |
|---|---|---|
| id | text PK | cuid2 |
| runId | text | FK → agentRuns.id |
| action | jsonb | ProposedAction |
| telegramMessageId | text | nullable |
| telegramThreadId | text | for follow-up conversations |
| status | enum | approvalStatus |
| followupMessages | jsonb | `[{ from, text, at }]` |
| createdAt | timestamp | |
| resolvedAt | timestamp | nullable |
| expiresAt | timestamp | not null |

### agentLogs
| Column | Type | Notes |
|---|---|---|
| id | text PK | cuid2 |
| runId | text | FK → agentRuns.id |
| level | enum | logLevel |
| message | text | |
| meta | jsonb | nullable |
| createdAt | timestamp | |

### promptTemplates
| Column | Type | Notes |
|---|---|---|
| id | text PK | cuid2 |
| key | text | unique |
| system | text | |
| userTemplate | text | |
| version | integer | default 1 |
| createdAt | timestamp | |

## Per-Agent Tables

Each agent module contributes its own schema file:
`modules/agents/<agent-name>/schema.ts`

These are imported into the central schema barrel and picked up by `drizzle-kit`.

See individual agent docs for their table definitions.
