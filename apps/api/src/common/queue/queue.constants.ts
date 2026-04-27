export const QUEUE_NAMES = {
  AGENT_RUN: 'agent-run',
  AGENT_EXECUTE: 'agent-execute',
  AGENT_FOLLOWUP: 'agent-followup',
  SCHEDULED_TRIGGERS: 'scheduled-triggers',
  INTEGRATIONS_POLL: 'integrations-poll',
  APPROVAL_SWEEP: 'approval-sweep',
  TASK_SWEEP: 'task-sweep',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
