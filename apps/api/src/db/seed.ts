import 'dotenv/config';
import { db } from './client';
import { users, agents } from './schema';
import { eq } from 'drizzle-orm';
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
    key: 'social',
    name: 'Social Media Handler',
    description: 'Publishes scheduled posts and drafts replies to comments/DMs across FB, IG, X, and LinkedIn for Taskip and Xgenious.',
    enabled: false,
    config: {
      brands: ['taskip', 'xgenious'],
      platforms: ['fb', 'ig', 'x', 'linkedin'],
      replyTone: 'friendly, professional, adds value — never salesy',
      llm: { provider: 'auto', model: 'gpt-4o-mini' },
    },
  },
  {
    key: 'canva',
    name: 'Canva + Social Content Agent',
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
    key: 'crisp',
    name: 'Crisp AI Agent',
    description: 'Monitors open Crisp chat conversations every 15 minutes, drafts AI replies, and sends them to Telegram for approval before posting.',
    enabled: false,
    config: {
      replyTone: 'friendly, concise, and helpful — like a knowledgeable founder replying to a customer',
      productContext: 'Taskip is a project management SaaS for teams.',
      maxConversationsPerRun: 10,
      llm: { provider: 'auto', model: 'gpt-4o-mini' },
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
  // Seed owner
  const email = process.env.OWNER_EMAIL ?? 'admin@example.com';
  const password = process.env.OWNER_PASSWORD ?? 'password';

  const existing = await db.select().from(users).limit(1);
  if (existing.length === 0) {
    const hash = await bcrypt.hash(password, 12);
    await db.insert(users).values({ email, password: hash });
    console.log(`Owner created: ${email}`);
  } else {
    console.log('Owner already exists, skipping');
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

  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
