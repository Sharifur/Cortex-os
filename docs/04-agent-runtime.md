# Agent Runtime Contract

The runtime owns: trigger registration, queueing, persistence, Telegram routing, and approval state.  
Agents only implement the contract methods.

## IAgent Interface

```ts
interface IAgent {
  key: string;
  name: string;

  // Triggers this agent listens to
  triggers(): TriggerSpec[];

  // Build context snapshot; called once per run, re-called when followups arrive
  buildContext(trigger: TriggerEvent, run: AgentRun): Promise<AgentContext>;

  // LLM-driven decision; returns actions (may be empty)
  decide(ctx: AgentContext): Promise<ProposedAction[]>;

  // Decide whether an action needs human approval
  requiresApproval(action: ProposedAction): boolean;

  // Execute the action (called only after approval if required)
  execute(action: ProposedAction): Promise<ActionResult>;

  // MCP tools this agent exposes (consumed by its own LLM AND served externally)
  mcpTools(): McpToolDefinition[];

  // HTTP routes mounted under /agents/:key/api/*
  apiRoutes(): AgentApiRoute[];
}
```

## Supporting Interfaces

```ts
interface ProposedAction {
  type: string;          // "send_email", "post_reply", etc.
  summary: string;       // shown in Telegram approval message
  payload: any;
  riskLevel: 'low' | 'medium' | 'high';
}

interface AgentContext {
  source: any;
  snapshot: any;
  followups: { at: string; text: string }[];  // appended on each follow-up cycle
}

interface AgentApiRoute {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;          // relative to /agents/:key/api
  handler: (req, res) => Promise<any>;
  requiresAuth: boolean;
}

interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: object;   // JSON schema
  handler: (input: any) => Promise<any>;
}
```

## Runtime Responsibilities

1. **Trigger registration** — maps TriggerSpec to BullMQ jobs or webhook routes
2. **Job enqueueing** — wraps every trigger in an `agent-run` BullMQ job
3. **Persistence** — writes every state transition to Postgres (durability rule)
4. **LLM orchestration** — calls agent.decide(), passes agent's MCP tools to LLM Router
5. **Approval routing** — if `requiresApproval()` → persist PendingApproval, send Telegram message
6. **Follow-up handling** — appends follow-up text to AgentRun.context.followups, re-runs decide()
7. **Execution** — calls agent.execute() after approval, logs result
8. **Metrics** — increments Prometheus counters per run/action
