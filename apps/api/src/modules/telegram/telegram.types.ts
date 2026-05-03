import type { ProposedAction } from '../agents/runtime/types';

export interface ApprovalCreatedEvent {
  approvalId: string;
  runId: string;
  agentKey: string;
  agentName: string;
  action: ProposedAction;
}

export interface TaskNotifyEvent {
  taskTitle: string;
  agentKey: string;
  summary: string;
}

export interface AgentFailedEvent {
  agentKey: string;
  agentName: string;
  runId: string;
  error: string;
  taskTitle?: string;
}

export const TELEGRAM_EVENTS = {
  APPROVAL_CREATED: 'approval.created',
  TASK_NOTIFY: 'task.notify',
  AGENT_FAILED: 'agent.failed',
} as const;
