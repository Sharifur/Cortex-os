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

export const TELEGRAM_EVENTS = {
  APPROVAL_CREATED: 'approval.created',
  TASK_NOTIFY: 'task.notify',
} as const;
