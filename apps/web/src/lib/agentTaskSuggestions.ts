// Per-agent quick-task suggestions surfaced as clickable chips.
// Click → fills the input textarea. The agent itself decides what to do with the prompt.

export const AGENT_TASK_SUGGESTIONS: Record<string, string[]> = {
  taskip_internal: [
    'List at_risk_paid workspaces with score below 40 needing retention outreach',
    'Show trial_ready_free workspaces signed up 3+ days ago for upgrade follow-up',
    'Find hot_leads in the trial funnel with high activation score',
    'Show dormant_paid workspaces with no activity in 30 days',
    'Run proactive suggestion sweep across all cohorts now',
    'Show pending follow-up suggestions awaiting approval',
    'Propose a retention email for workspace [uuid]',
    'Show suggestion activity and send history for workspace [uuid]',
    'List activate_free workspaces that have not connected an inbox',
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
    'Draft a reply to this client email:',
    'Write an onboarding reply for a new Taskip customer asking about setup',
    'Write a follow-up for a client who has not responded in 3 days',
    'Write a polite refund decline for an Envato customer',
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
    'Generate salary slips for this month',
    'Check today\'s leave and WFH requests',
    'Show pending leave requests',
    'Who is on leave today?',
    'Who is working from home today?',
    'Any upcoming birthdays or anniversaries?',
    'List all active employees',
    'Show payslips for this month',
    'Download payslip CSV for this month',
  ],

  canva: [
    // Post Format Engine — LinkedIn carousels
    'Generate a linkedin-tips-carousel for brand taskip about "5 ways to save time on client work"',
    'Generate a linkedin-howto-carousel for brand taskip about "how to set up a client portal in 3 steps"',
    'Generate a linkedin-list-carousel for brand taskip about "tools every freelancer needs in 2025"',
    // Post Format Engine — LinkedIn single cards
    'Generate a linkedin-stat-single for brand taskip about "87% of freelancers waste 4 hours a week on admin"',
    'Generate a linkedin-quote-single for brand taskip with a quote about client management',
    // Post Format Engine — Instagram
    'Generate an instagram-carousel-edu for brand taskip about "why client portals beat email threads"',
    'Generate an instagram-fact for brand taskip about Taskip customer growth',
    'Generate an instagram-story-tip for brand taskip about "one habit that saves 2 hours a week"',
    'Generate an instagram-story-announce for brand taskip — announce the new Insight analytics feature',
    // Post Format Engine — other platforms
    'Generate a twitter-announcement for brand taskip about a new feature launch',
    'Generate a facebook-ad-banner for brand taskip targeting freelancers',
    'Generate a generic-checklist for brand taskip about "before you launch: agency checklist"',
    // Legacy Canva MCP designs
    'Create a Facebook banner carousel for our product launch',
    'Make a LinkedIn carousel: 5 business growth tips for SaaS founders',
    'Design an announcement post: we just launched a new feature',
    'Design a testimonial carousel with 3 customer quotes',
    'Create a social proof post: we just hit 10,000 customers',
  ],
};

export function getAgentSuggestions(agentKey: string): string[] {
  return AGENT_TASK_SUGGESTIONS[agentKey] ?? [];
}
