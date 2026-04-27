import 'dotenv/config';
import { db } from './client';
import { users, agents } from './schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';

const AGENT_SEEDS = [
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
