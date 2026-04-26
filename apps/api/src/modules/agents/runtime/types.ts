export type TriggerType = 'CRON' | 'WEBHOOK' | 'MANUAL' | 'CHAINED' | 'MCP' | 'API';
export type RunStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXECUTED'
  | 'FAILED'
  | 'FOLLOWUP';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'FOLLOWUP' | 'EXPIRED';
export type RiskLevel = 'low' | 'medium' | 'high';
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface ProposedAction {
  type: string;
  summary: string;
  payload: unknown;
  riskLevel: RiskLevel;
}

export interface AgentContext {
  source: unknown;
  snapshot: unknown;
  followups: Array<{ at: string; text: string }>;
}

export interface TriggerEvent {
  type: TriggerType;
  payload?: unknown;
}

export interface RunContext {
  id: string;
  triggerType: TriggerType;
  triggerPayload: unknown;
  context: AgentContext | null;
}

export interface ActionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface TriggerSpec {
  type: TriggerType;
  cron?: string;
  webhookPath?: string;
}

export interface AgentApiRoute {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  handler: (req: unknown, res: unknown) => Promise<unknown>;
  requiresAuth: boolean;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: object;
  handler: (input: unknown) => Promise<unknown>;
}

export interface IAgent {
  key: string;
  name: string;
  triggers(): TriggerSpec[];
  buildContext(trigger: TriggerEvent, run: RunContext): Promise<AgentContext>;
  decide(ctx: AgentContext): Promise<ProposedAction[]>;
  requiresApproval(action: ProposedAction): boolean;
  execute(action: ProposedAction): Promise<ActionResult>;
  mcpTools(): McpToolDefinition[];
  apiRoutes(): AgentApiRoute[];
}

// BullMQ job payloads
export interface AgentRunJobData {
  agentKey: string;
  runId: string;
}

export interface AgentExecuteJobData {
  agentKey: string;
  runId: string;
  approvalId: string;
  action: ProposedAction;
}

export interface AgentFollowupJobData {
  agentKey: string;
  runId: string;
}
