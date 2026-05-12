import 'dotenv/config';
import { db } from './client';
import { users, agents } from './schema';
import { eq, sql } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';

const AGENT_SEEDS = [
  {
    key: 'hr',
    name: 'HR Manager Agent',
    description: 'Generates salary sheets on the 25th, processes leave requests, and sends daily HR alerts (probation endings, contract expirations).',
    enabled: false,
    config: {
      companyName: 'Xgenious',
      currency: 'BDT',
      workingDaysPerMonth: 26,
      llm: { provider: 'auto', model: 'gpt-4o-mini' },
    },
  },
  {
    key: 'canva',
    name: 'Social Media Banner Design Agent',
    description: 'Generates a 30-idea monthly content calendar on the 1st of each month and creates Canva designs for approved ideas.',
    enabled: false,
    config: {
      brands: ['taskip', 'xgenious'],
      formats: ['carousel', 'reel', 'post', 'story', 'youtube'],
      targetCount: 30,
      brandVoice: 'educational, relatable, and slightly witty — for SaaS founders and project managers',
      llm: { provider: 'openai', model: 'gpt-4o' },
    },
  },
  {
    key: 'taskip_internal',
    name: 'Taskip Internal',
    description: 'On-demand internal ops assistant — look up users, check subscriptions/invoices, extend trials, mark refunds.',
    enabled: true,
    config: {
      llm: { provider: 'openai', model: 'gpt-4o' },
    },
  },
  {
    key: 'email_manager',
    name: 'Email Manager',
    description: 'Polls Gmail every 30 minutes, classifies emails, drafts replies for important senders, auto-archives newsletters and spam.',
    enabled: false,
    config: {
      maxEmailsPerRun: 20,
      importantSenders: [],
      autoArchiveDomains: [],
      llm: { provider: 'auto', model: 'gpt-4o-mini' },
    },
  },
  {
    key: 'daily_reminder',
    name: 'Daily Reminder',
    description: 'Morning brief and evening recap via Telegram. Summarises pending approvals and agent activity.',
    enabled: true,
    config: {
      morningCron: '30 2 * * *',
      eveningCron: '0 15 * * *',
      enableMorning: true,
      enableEvening: true,
      llm: { provider: 'auto', model: 'gpt-4o-mini' },
    },
  },
  {
    key: 'support',
    name: 'Support Ticket Manager',
    description: 'Ingests support tickets via webhook or sweeps open tickets every 30 min. Classifies, prioritises, and drafts replies for Telegram approval.',
    enabled: false,
    config: {
      autoCloseCategories: [],
      escalateKeywords: ['urgent', 'lawsuit', 'refund', 'legal', 'fraud'],
      maxTicketsPerRun: 20,
      llm: { provider: 'auto', model: 'gpt-4o-mini' },
    },
  },
  {
    key: 'whatsapp',
    name: 'WhatsApp Business Watcher',
    description: 'Monitors WhatsApp Business messages every 10 minutes. Classifies urgency, sends Telegram alerts, and drafts auto-replies for approval.',
    enabled: false,
    config: {
      offlineStart: 21,
      offlineEnd: 10,
      timezone: 'Asia/Dhaka',
      holdingMessage: 'Thanks for reaching out! We\'ll get back to you during business hours.',
      llm: { provider: 'auto', model: 'gpt-4o-mini' },
    },
  },
  {
    key: 'linkedin',
    name: 'LinkedIn AI Agent',
    description: 'Scans LinkedIn feed every 4 hours, drafts comments on relevant posts, and prepares outreach DMs — all requiring Telegram approval.',
    enabled: false,
    config: {
      targetTopics: ['SaaS', 'productivity', 'startup', 'project management'],
      maxCommentsPerRun: 3,
      commentTone: 'professional, concise, adds value — never salesy',
      llm: { provider: 'auto', model: 'gpt-4o-mini' },
    },
  },
  {
    key: 'reddit',
    name: 'Reddit Followup Agent',
    description: 'Searches Reddit every 2 hours for keyword mentions. Drafts genuine comments and sends them to Telegram for approval before posting.',
    enabled: false,
    config: {
      defaultKeywords: ['Taskip', 'project management tool', 'task management SaaS'],
      maxPostsPerKeyword: 5,
      commentTone: 'helpful and genuine — add value, no promotion, no spam',
      llm: { provider: 'auto', model: 'gpt-4o-mini' },
    },
  },
  {
    key: 'taskip_trial',
    name: 'Trial Email Agent',
    description: 'Behavior-based outreach to Taskip trial, paid, and churned users via AWS SES.',
    enabled: true,
    config: {
      segments: {
        trial_day_3: { enabled: true, templatePromptId: 'trial_d3' },
        trial_day_5_low_activity: { enabled: true, templatePromptId: 'trial_d5_low' },
        trial_expiring_24h: { enabled: true, templatePromptId: 'trial_expiring' },
        paid_at_risk: { enabled: true, templatePromptId: 'paid_at_risk' },
        churned_30d: { enabled: false, templatePromptId: 'churned_d30' },
      },
      llm: { provider: 'openai', model: 'gpt-4o-mini' },
      emailProvider: 'gmail',
      gmail: { from: 'Sharifur <sharifur@taskip.net>' },
      ses: { from: 'Sharifur <sharifur@taskip.net>', configurationSet: 'ses-monitoring' },
      dailyCap: 50,
      maxFollowupsPerEmail: 5,
    },
  },
];

async function seed() {
  // Seed default admin — reads OWNER_EMAIL / OWNER_PASSWORD from .env, falls back to hardcoded defaults
  const DEFAULT_EMAIL = process.env.OWNER_EMAIL || 'admin@cortex.local';
  const DEFAULT_PASSWORD = process.env.OWNER_PASSWORD || 'changeme123';

  const existing = await db.select().from(users).limit(1);
  if (existing.length === 0) {
    const hash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
    await db.insert(users).values({ email: DEFAULT_EMAIL, password: hash });
    console.log(`Default admin created: ${DEFAULT_EMAIL} / ${DEFAULT_PASSWORD}`);
  } else {
    console.log('Admin already exists, skipping');
  }

  // Seed agents (idempotent)
  for (const agent of AGENT_SEEDS) {
    const [existing] = await db.select({ id: agents.id }).from(agents).where(eq(agents.key, agent.key));
    if (!existing) {
      await db.insert(agents).values(agent);
      console.log(`Agent seeded: ${agent.key}`);
    } else {
      console.log(`Agent already exists: ${agent.key}`);
    }
  }

  // Seed dummy inbox emails for local testing.
  // Uses raw SQL with only stable columns — avoids breaking on envs where
  // migration 0063 (tracking_token, open_count, etc.) hasn't run yet.
  const existingEmails = await db.execute(sql`SELECT id FROM taskip_internal_emails LIMIT 1`);
  if ((existingEmails as any[]).length === 0) {
    const now = new Date();
    const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();
    type Row = { id: string; purpose: string; workspace_uuid: string | null; recipient: string; subject: string; body: string; status: string; error: string | null; metadata: Record<string, unknown> | null; sent_at: string };
    const rows: Row[] = [
      { id: 'seed-inbox-001', purpose: 'marketing', workspace_uuid: 'ws-demo-001', recipient: 'contact@xgenious.com', subject: 'your invoice is still pending — any updates?', body: 'Hi Xgenious Team,\n\nI noticed that you have 1 invoice issued, but it hasn\'t been marked as paid yet. It\'s important for you to receive timely payments, and I want to help you with that.\n\nHave you had a chance to follow up with your client about it?\n\nSharifur', status: 'sent', error: null, metadata: { spamScore: 0.12, spamGrade: 'A' }, sent_at: daysAgo(1) },
      { id: 'seed-inbox-002', purpose: 'trial_followup', workspace_uuid: 'ws-demo-002', recipient: 'john@acmecorp.io', subject: 'how is your Taskip trial going?', body: 'Hi John,\n\nYou\'ve been on the Taskip trial for 5 days now. I wanted to check in and see if you have any questions or if there\'s anything I can help you with.\n\nAre you finding it useful for managing your client projects?\n\nBest,\nSharifur', status: 'sent', error: null, metadata: { spamScore: 0.08, spamGrade: 'A', pixelOpened: true, pixelOpenedAt: daysAgo(2) }, sent_at: daysAgo(3) },
      { id: 'seed-inbox-003', purpose: 'marketing', workspace_uuid: 'ws-demo-003', recipient: 'sara@designstudio.com', subject: 'client portal update — new feature this week', body: 'Hi Sara,\n\nWe just shipped a new feature in Taskip: your clients can now view project timelines directly from their portal without logging in.\n\nThis should reduce the back-and-forth on status updates significantly.\n\nWorth a look?\n\nSharifur', status: 'sent', error: null, metadata: { spamScore: 0.21, spamGrade: 'B', manuallyOpened: true, manuallyOpenedAt: daysAgo(4) }, sent_at: daysAgo(5) },
      { id: 'seed-inbox-004', purpose: 'trial_followup', workspace_uuid: 'ws-demo-004', recipient: 'mike@freelancehq.dev', subject: 'your trial ends in 2 days', body: 'Hi Mike,\n\nJust a heads-up — your Taskip trial ends in 2 days. If you\'d like to continue, you can upgrade to any plan at taskip.app/billing.\n\nIf you have questions before deciding, just reply to this email.\n\nSharifur', status: 'sent', error: null, metadata: { spamScore: 0.05, spamGrade: 'A', pixelOpened: true, pixelOpenedAt: daysAgo(6) }, sent_at: daysAgo(7) },
      { id: 'seed-inbox-005', purpose: 'other', workspace_uuid: null, recipient: 'billing@bigclient.com', subject: 'invoice #1042 — payment confirmation', body: 'Hi,\n\nThis is a confirmation that invoice #1042 for $299 has been processed successfully.\n\nThank you for your business.\n\nTaskip Billing', status: 'failed', error: 'Gmail API error: invalid_grant — token expired', metadata: null, sent_at: daysAgo(10) },
    ];
    for (const r of rows) {
      await db.execute(sql`
        INSERT INTO taskip_internal_emails
          (id, purpose, workspace_uuid, recipient, subject, body, status, error, metadata, sent_at)
        VALUES
          (${r.id}, ${r.purpose}, ${r.workspace_uuid}, ${r.recipient}, ${r.subject}, ${r.body},
           ${r.status}, ${r.error}, ${r.metadata}, ${r.sent_at}::timestamptz)
        ON CONFLICT (id) DO NOTHING
      `);
    }
    console.log(`Seeded ${rows.length} dummy inbox emails`);
  } else {
    console.log('Inbox emails already exist, skipping dummy seed');
  }

  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
