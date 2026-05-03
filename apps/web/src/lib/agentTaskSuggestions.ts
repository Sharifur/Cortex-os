// Per-agent quick-task suggestions surfaced as clickable chips.
// Click → fills the input textarea. The agent itself decides what to do with the prompt.

export const AGENT_TASK_SUGGESTIONS: Record<string, string[]> = {
  taskip_internal: [
    'Look up user — enter an email',
    'Show subscriptions for user',
    'List invoices for user',
    'Extend trial by 7 days for user',
    'Mark invoice as refund for user',
    'List at_risk_paid workspaces with score below 40',
    'Drill into workspace acme and propose a retention outreach',
    'Find trial_ready_free workspaces that signed up 3+ days ago',
    'Send a celebrate_activation message to workspace acme',
  ],

  support: [
    'Show open support tickets sorted by priority',
    'Draft replies for the 3 oldest unanswered tickets',
    'Find tickets containing the keyword "urgent" or "down"',
    'Escalate billing-related tickets',
  ],

  whatsapp: [
    'Summarize unread WhatsApp messages',
    'Draft a reply to the most recent customer message',
    'Find messages with purchase intent',
    'List conversations from the last 7 days that are unanswered',
  ],

  email_manager: [
    'Summarize my Gmail inbox from today',
    'Draft a polite reply to the latest important email',
    'Find emails awaiting my response',
    'Highlight emails containing a meeting request',
  ],

  linkedin: [
    'Draft 5 cold outreach messages for SaaS founders',
    'Suggest a connection note for a recent profile view',
    'Compose a follow-up to last week\'s outreach',
    'Pitch Taskip to an agency owner',
  ],

  reddit: [
    'Track new threads mentioning "project management"',
    'Find subreddits where Taskip is mentioned',
    'Draft a helpful comment for a recent thread',
    'Summarize top posts in r/saas this week',
  ],

  social: [
    'Schedule a LinkedIn post about our Insight launch',
    'Draft a 280-char tweet about today\'s product update',
    'Plan tomorrow\'s social calendar',
    'Repurpose our latest blog into 3 social posts',
  ],

  shorts: [
    'Generate a 30-second Shorts script about Taskip\'s Insight feature',
    'Write 3 hook ideas for a Reddit growth video',
    'Outline a 60-second tutorial for live chat routing',
    'List Shorts scripts created this week',
  ],

  taskip_trial: [
    'Run the day-3 trial segment',
    'Show users in the activated-late segment',
    'Draft a follow-up email for users who never connected an inbox',
    'Suppress a bouncing email address',
  ],

  daily_reminder: [
    'Show me today\'s briefing',
    'List pending approvals',
    'Summarize agent runs from the last 24h',
    'Show system health status',
  ],

  hr: [
    'Who is on leave today?',
    'Show pending leave requests',
    'Who is working from home today?',
    'Any upcoming birthdays or anniversaries?',
    'List all active employees',
    'Show payslips for this month',
    'Download payslip CSV for this month',
    'Generate salary slips for this month',
  ],

  canva: [
    'Generate next month\'s social calendar',
    'List upcoming designs in this month\'s calendar',
    'Suggest a carousel layout for our pricing announcement',
  ],
};

export function getAgentSuggestions(agentKey: string): string[] {
  return AGENT_TASK_SUGGESTIONS[agentKey] ?? [];
}
