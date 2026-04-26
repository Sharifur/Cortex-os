import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { inArray, eq, and, gt } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { agents } from '../../../db/schema';
import { taskipTrialEmailLog, taskipTrialSuppressed } from './schema';
import { AgentRegistryService } from '../runtime/agent-registry.service';
import { LlmRouterService } from '../../llm/llm-router.service';
import { SesService } from '../../ses/ses.service';
import { GmailService } from '../../gmail/gmail.service';
import { TaskipDbService, TaskipUser } from './taskip-db.service';
import type {
  IAgent,
  TriggerSpec,
  TriggerEvent,
  RunContext,
  AgentContext,
  ProposedAction,
  ActionResult,
  McpToolDefinition,
  AgentApiRoute,
} from '../runtime/types';

interface SegmentConfig {
  enabled: boolean;
  templatePromptId: string;
}

interface AgentConfig {
  segments: Record<string, SegmentConfig>;
  llm: { provider: string; model: string };
  emailProvider: 'gmail' | 'ses';
  gmail: { from: string };
  ses: { from: string; configurationSet?: string };
  dailyCap: number;
  maxFollowupsPerEmail: number;
}

interface EmailDraft {
  userId: string;
  email: string;
  name: string;
  segment: string;
  subject: string;
  body: string;
}

interface TrialSnapshot {
  drafts: EmailDraft[];
  config: AgentConfig;
}

const SEGMENT_PROMPTS: Record<string, { system: string; user: (u: TaskipUser) => string }> = {
  trial_day_3: {
    system: `You are Sharifur Rahman, founder of Taskip. Write short, warm, personal emails in first person.
Rules: under 80 words, no marketing fluff, end with a question that invites a reply.
Output JSON: { "subject": "...", "body": "..." }`,
    user: (u) => `User ${u.name} signed up 3 days ago. Their trial started on ${u.createdAt}.
Write a brief founder check-in email. Ask how they're finding Taskip so far. Mention Taspi (Taskip's AI agent) naturally if relevant.`,
  },
  trial_day_5_low_activity: {
    system: `You are Sharifur Rahman, founder of Taskip. Write short, warm, personal emails in first person.
Rules: under 80 words, offer to help, no hard sell.
Output JSON: { "subject": "...", "body": "..." }`,
    user: (u) => `User ${u.name} signed up 5 days ago but hasn't explored much yet.
Write a helpful nudge email offering to help them get started. Mention Taspi (Taskip's AI agent).`,
  },
  trial_expiring_24h: {
    system: `You are Sharifur Rahman, founder of Taskip. Write short, warm urgency emails.
Rules: under 80 words, warm urgency (no pressure), highlight one key benefit.
Output JSON: { "subject": "...", "body": "..." }`,
    user: (u) => `User ${u.name} has trial expiring at ${u.trialEndsAt}.
Write a last-chance email. Keep it warm, not pushy. Mention Taspi if relevant.`,
  },
  paid_at_risk: {
    system: `You are Sharifur Rahman, founder of Taskip. Write short re-engagement emails.
Rules: under 80 words, acknowledge absence warmly, ask what happened.
Output JSON: { "subject": "...", "body": "..." }`,
    user: (u) => `Paid user ${u.name} (plan: ${u.plan}) hasn't been active since ${u.lastActiveAt}.
Write a genuine check-in. Ask if there's anything blocking them.`,
  },
  churned_30d: {
    system: `You are Sharifur Rahman, founder of Taskip. Write very short win-back emails.
Rules: under 60 words, no guilt, just curious and warm.
Output JSON: { "subject": "...", "body": "..." }`,
    user: (u) => `User ${u.name} cancelled 30 days ago.
Write a brief win-back note. Keep it genuine. Ask what we could have done better.`,
  },
};

@Injectable()
export class TaskipTrialAgent implements IAgent, OnModuleInit {
  readonly key = 'taskip_trial';
  readonly name = 'Trial Email Agent';
  private readonly logger = new Logger(TaskipTrialAgent.name);

  constructor(
    private db: DbService,
    private llm: LlmRouterService,
    private ses: SesService,
    private gmail: GmailService,
    private taskipDb: TaskipDbService,
    private registry: AgentRegistryService,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  triggers(): TriggerSpec[] {
    return [
      { type: 'CRON', cron: '0 4 * * *' }, // 10:00 Asia/Dhaka = 04:00 UTC
      { type: 'WEBHOOK', webhookPath: '/taskip-trial/webhook' },
    ];
  }

  async buildContext(trigger: TriggerEvent, run: RunContext): Promise<AgentContext> {
    const config = await this.getConfig();
    const segmentsToRun = this.resolveSegments(trigger, config);

    const usersBySegment: Record<string, TaskipUser[]> = {};
    for (const segment of segmentsToRun) {
      const users = await this.taskipDb.getUsersForSegment(segment, config.dailyCap);
      const filtered = await this.filterEligible(users, segment);
      usersBySegment[segment] = filtered;
    }

    const totalUsers = Object.values(usersBySegment).reduce((s, arr) => s + arr.length, 0);
    this.logger.log(`buildContext: ${totalUsers} eligible users across ${segmentsToRun.join(', ')}`);

    return {
      source: { trigger: trigger.type, payload: trigger.payload, segmentsToRun },
      snapshot: { usersBySegment, config } as unknown,
      followups: (run.context as AgentContext | null)?.followups ?? [],
    };
  }

  async decide(ctx: AgentContext): Promise<ProposedAction[]> {
    const snapshot = ctx.snapshot as { usersBySegment: Record<string, TaskipUser[]>; config: AgentConfig };
    const { usersBySegment, config } = snapshot;

    const actions: ProposedAction[] = [];
    const followupNote = ctx.followups.at(-1)?.text;

    for (const [segment, users] of Object.entries(usersBySegment)) {
      for (const user of users) {
        try {
          const draft = await this.draftEmail(user, segment, config, followupNote);
          actions.push({
            type: 'send_email',
            summary: `Send "${draft.subject}" to ${user.email} [${segment}]`,
            payload: draft,
            riskLevel: 'medium',
          });
        } catch (err) {
          this.logger.warn(`Failed to draft email for ${user.email}: ${(err as Error).message}`);
        }
      }
    }

    return actions;
  }

  requiresApproval(action: ProposedAction): boolean {
    return action.type === 'send_email';
  }

  async execute(action: ProposedAction): Promise<ActionResult> {
    if (action.type !== 'send_email') {
      return { success: false, error: `Unknown action: ${action.type}` };
    }

    const draft = action.payload as EmailDraft;
    const config = await this.getConfig();

    const provider = config.emailProvider ?? 'gmail';
    let messageId: string;

    if (provider === 'gmail' && this.gmail.isConfigured()) {
      messageId = await this.gmail.sendEmail({
        to: draft.email,
        from: config.gmail?.from ?? process.env.GMAIL_FROM ?? draft.email,
        subject: draft.subject,
        textBody: draft.body,
      });
    } else {
      messageId = await this.ses.sendEmail({
        to: draft.email,
        from: config.ses.from,
        subject: draft.subject,
        textBody: draft.body,
        configurationSet: config.ses.configurationSet,
      });
    }

    await this.db.db.insert(taskipTrialEmailLog).values({
      runId: '',
      userId: draft.userId,
      email: draft.email,
      segment: draft.segment,
      subject: draft.subject,
      body: draft.body,
      sesMessageId: messageId,
    });

    return { success: true, data: { messageId, provider, to: draft.email } };
  }

  mcpTools(): McpToolDefinition[] {
    return [
      {
        name: 'list_segment_users',
        description: 'List users matching a Taskip segment',
        inputSchema: {
          type: 'object',
          properties: {
            segment: { type: 'string', enum: Object.keys(SEGMENT_PROMPTS) },
            limit: { type: 'number', default: 10 },
          },
          required: ['segment'],
        },
        handler: async (input) => {
          const { segment, limit = 10 } = input as { segment: string; limit?: number };
          return this.taskipDb.getUsersForSegment(segment, limit);
        },
      },
      {
        name: 'draft_email_for_user',
        description: 'Draft a personalized email for a Taskip user',
        inputSchema: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
            segment: { type: 'string' },
            instruction: { type: 'string' },
          },
          required: ['userId', 'segment'],
        },
        handler: async (input) => {
          const { userId, segment, instruction } = input as { userId: string; segment: string; instruction?: string };
          const config = await this.getConfig();
          const [user] = await this.taskipDb.getUsersForSegment(segment, 100)
            .then(users => users.filter(u => u.id === userId));
          if (!user) throw new Error(`User ${userId} not found in segment ${segment}`);
          return this.draftEmail(user, segment, config, instruction);
        },
      },
      {
        name: 'mark_user_suppressed',
        description: 'Mark a user email as suppressed (skip in future runs)',
        inputSchema: {
          type: 'object',
          properties: { email: { type: 'string' }, reason: { type: 'string' } },
          required: ['email'],
        },
        handler: async (input) => {
          const { email, reason = 'manual' } = input as { email: string; reason?: string };
          await this.db.db.insert(taskipTrialSuppressed).values({ email, reason });
          return { suppressed: true, email };
        },
      },
    ];
  }

  apiRoutes(): AgentApiRoute[] {
    return [
      {
        method: 'POST',
        path: '/taskip-trial/run-segment',
        requiresAuth: true,
        handler: async (req) => {
          const { segment } = (req as { body: { segment: string } }).body;
          const config = await this.getConfig();
          if (!config.segments[segment]) throw new Error(`Unknown segment: ${segment}`);
          return this.taskipDb.getUsersForSegment(segment, config.dailyCap);
        },
      },
      {
        method: 'GET',
        path: '/taskip-trial/segments/:key/users',
        requiresAuth: true,
        handler: async (req) => {
          const { key } = (req as { params: { key: string } }).params;
          const config = await this.getConfig();
          return this.taskipDb.getUsersForSegment(key, config.dailyCap);
        },
      },
      {
        method: 'POST',
        path: '/taskip-trial/draft/:userId',
        requiresAuth: true,
        handler: async (req) => {
          const { userId } = (req as { params: { userId: string } }).params;
          const { segment } = (req as { body: { segment: string } }).body;
          const config = await this.getConfig();
          const users = await this.taskipDb.getUsersForSegment(segment, 100);
          const user = users.find(u => u.id === userId);
          if (!user) throw new Error(`User ${userId} not in segment ${segment}`);
          return this.draftEmail(user, segment, config);
        },
      },
    ];
  }

  private async draftEmail(
    user: TaskipUser,
    segment: string,
    config: AgentConfig,
    followupInstruction?: string,
  ): Promise<EmailDraft> {
    const prompt = SEGMENT_PROMPTS[segment];
    if (!prompt) throw new Error(`No prompt for segment: ${segment}`);

    const userMsg = followupInstruction
      ? `${prompt.user(user)}\n\nRevision instruction: ${followupInstruction}`
      : prompt.user(user);

    const response = await this.llm.complete({
      provider: config.llm.provider as 'openai' | 'gemini' | 'deepseek' | 'auto',
      model: config.llm.model,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: userMsg },
      ],
      maxTokens: 400,
      temperature: 0.7,
    });

    let parsed: { subject: string; body: string };
    try {
      const json = response.content.replace(/```json\n?|```/g, '').trim();
      parsed = JSON.parse(json);
    } catch {
      throw new Error(`LLM returned non-JSON for user ${user.id}: ${response.content.slice(0, 100)}`);
    }

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      segment,
      subject: parsed.subject,
      body: parsed.body,
    };
  }

  private async getConfig(): Promise<AgentConfig> {
    const [row] = await this.db.db
      .select({ config: agents.config })
      .from(agents)
      .where(eq(agents.key, this.key));

    return (row?.config as AgentConfig) ?? this.defaultConfig();
  }

  private defaultConfig(): AgentConfig {
    return {
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
    };
  }

  private resolveSegments(trigger: TriggerEvent, config: AgentConfig): string[] {
    if (trigger.type === 'WEBHOOK') {
      const payload = trigger.payload as { segment?: string } | null;
      const seg = payload?.segment;
      if (seg && config.segments[seg]?.enabled) return [seg];
      return [];
    }
    return Object.entries(config.segments)
      .filter(([, v]) => v.enabled)
      .map(([k]) => k);
  }

  private async filterEligible(users: TaskipUser[], segment: string): Promise<TaskipUser[]> {
    if (!users.length) return [];

    const emails = users.map(u => u.email);
    const ids = users.map(u => u.id);

    const [suppressed, recentEmails] = await Promise.all([
      this.db.db
        .select({ email: taskipTrialSuppressed.email })
        .from(taskipTrialSuppressed)
        .where(inArray(taskipTrialSuppressed.email, emails)),
      this.db.db
        .select({ userId: taskipTrialEmailLog.userId })
        .from(taskipTrialEmailLog)
        .where(
          and(
            inArray(taskipTrialEmailLog.userId, ids),
            eq(taskipTrialEmailLog.segment, segment),
            gt(taskipTrialEmailLog.sentAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
          ),
        ),
    ]);

    const suppressedSet = new Set(suppressed.map(r => r.email));
    const recentSet = new Set(recentEmails.map(r => r.userId));

    return users.filter(u => !suppressedSet.has(u.email) && !recentSet.has(u.id));
  }
}
