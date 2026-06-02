import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { inArray, eq, and, gt, lte, sql } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { agents } from '../../../db/schema';
import { taskipTrialEmailLog, taskipTrialSuppressed, taskipTrialSequences } from './schema';
import { AgentRegistryService } from '../runtime/agent-registry.service';
import { LlmRouterService } from '../../llm/llm-router.service';
import { SesService } from '../../ses/ses.service';
import { GmailService } from '../../gmail/gmail.service';
import { SettingsService } from '../../settings/settings.service';
import { TaskipDbService, TaskipUser } from './taskip-db.service';
import { TaskipInsightService } from '../taskip-internal/taskip-insight.service';
import { safeEqualString } from '../../../common/webhooks/verify';
import { createId } from '@paralleldrive/cuid2';
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
import { agentLlmOpts } from '../runtime/llm-config.util';

interface SegmentConfig {
  enabled: boolean;
  templatePromptId: string;
}

interface AgentConfig {
  segments: Record<string, SegmentConfig>;
  llm?: { provider?: string; model?: string };
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

const SEQUENCE_ANGLES = [
  'welcome_first_win',
  'core_feature',
  'team_collaboration',
  'checkin_questions',
  'advanced_unlock',
  'social_proof',
  'upgrade_cta',
] as const;

type SequenceAngle = typeof SEQUENCE_ANGLES[number];

const ANGLE_INSTRUCTIONS: Record<SequenceAngle, string> = {
  welcome_first_win: 'Welcome them and highlight the single most immediate value they can get from Taskip right now — one concrete action they can take today to see results.',
  core_feature: 'Highlight the single most valuable feature for their use case. Be specific about what it does and why it matters to their type of business.',
  team_collaboration: 'Encourage them to expand usage — invite a team member, collaborate on a project, or delegate a task. Make it feel like a natural next step.',
  checkin_questions: 'Check in warmly since they haven\'t logged in recently. Ask one open question about whether anything is blocking them or if they need help getting started.',
  advanced_unlock: 'Surface a power feature or workflow they haven\'t used yet. Make it feel like an insider tip.',
  social_proof: 'Share a brief customer win story relevant to their industry or company size. Keep it under 2 sentences. End with a question.',
  upgrade_cta: 'Their trial is ending soon. Make the upgrade case clearly and warmly — one key reason to stay, one clear next step. No pressure.',
};

const SEGMENT_PROMPTS: Record<string, { system: string; user: (u: TaskipUser) => string }> = {
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

interface SequenceRow {
  id: string;
  workspaceUuid: string;
  email: string;
  industry: string | null;
  step: number;
  status: string;
  gmailAccountId: string | null;
  sentAngles: unknown;
  activatedAt: Date;
  nextStepAt: Date;
  lastStepAt: Date | null;
  createdAt: Date;
}

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
    private settings: SettingsService,
    private insight: TaskipInsightService,
    private registry: AgentRegistryService,
  ) {}

  async onModuleInit() {
    this.registry.register(this);
    try {
      await this.db.db.execute(sql`
        CREATE TABLE IF NOT EXISTS taskip_trial_sequences (
          id TEXT PRIMARY KEY,
          workspace_uuid TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL,
          industry TEXT,
          step INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'active',
          gmail_account_id TEXT,
          sent_angles JSONB NOT NULL DEFAULT '[]'::jsonb,
          activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          next_step_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_step_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS taskip_trial_seq_workspace ON taskip_trial_sequences(workspace_uuid);
        CREATE INDEX IF NOT EXISTS taskip_trial_seq_due ON taskip_trial_sequences(status, next_step_at);
      `);
    } catch (err) {
      this.logger.warn(`taskip_trial_sequences table guard failed: ${err}`);
    }
  }

  triggers(): TriggerSpec[] {
    return [
      { type: 'CRON', cron: '0 4 * * *' },
      { type: 'WEBHOOK', webhookPath: '/taskip-trial/trial-activated' },
      { type: 'WEBHOOK', webhookPath: '/taskip-trial/webhook' },
    ];
  }

  async buildContext(trigger: TriggerEvent, run: RunContext): Promise<AgentContext> {
    if (trigger.type === 'WEBHOOK' && (trigger.payload as { _route?: string })?._route === '/taskip-trial/trial-activated') {
      return {
        source: { trigger: trigger.type, payload: trigger.payload },
        snapshot: { mode: 'webhook_registered' },
        followups: [],
      };
    }

    const config = await this.getConfig();

    // Sequence sweep: due rows
    const dueRows = await this.db.db
      .select()
      .from(taskipTrialSequences)
      .where(
        and(
          eq(taskipTrialSequences.status, 'active'),
          lte(taskipTrialSequences.nextStepAt, new Date()),
        ),
      )
      .limit(30) as SequenceRow[];

    // Legacy segment sweep (paid_at_risk, churned_30d only)
    const segmentsToRun = this.resolveSegments(trigger, config);
    const usersBySegment: Record<string, TaskipUser[]> = {};
    for (const segment of segmentsToRun) {
      const users = await this.taskipDb.getUsersForSegment(segment, config.dailyCap);
      const filtered = await this.filterEligible(users, segment);
      usersBySegment[segment] = filtered;
    }

    // Fetch live Insight data for each due sequence row
    const sequenceDrafts: SequenceDraftContext[] = [];
    for (const row of dueRows) {
      try {
        const [overview, lifecycle] = await Promise.allSettled([
          this.insight.getOverview(row.workspaceUuid),
          this.insight.getLifecycle(row.workspaceUuid),
        ]);
        sequenceDrafts.push({
          row,
          overview: overview.status === 'fulfilled' ? overview.value : null,
          lifecycle: lifecycle.status === 'fulfilled' ? lifecycle.value : null,
        });
      } catch (err) {
        this.logger.warn(`Insight fetch failed for ${row.workspaceUuid}: ${(err as Error).message}`);
        sequenceDrafts.push({ row, overview: null, lifecycle: null });
      }
    }

    this.logger.log(`buildContext: ${sequenceDrafts.length} sequence rows due, legacy segments: ${segmentsToRun.join(', ')}`);

    return {
      source: { trigger: trigger.type, payload: trigger.payload, segmentsToRun },
      snapshot: { sequenceDrafts, usersBySegment, config } as unknown,
      followups: (run.context as AgentContext | null)?.followups ?? [],
    };
  }

  async decide(ctx: AgentContext): Promise<ProposedAction[]> {
    const snapshot = ctx.snapshot as {
      mode?: string;
      sequenceDrafts?: SequenceDraftContext[];
      usersBySegment?: Record<string, TaskipUser[]>;
      config?: AgentConfig;
    };

    if (snapshot.mode === 'webhook_registered') return [];

    const { sequenceDrafts = [], usersBySegment = {}, config } = snapshot;
    const resolvedConfig = config ?? await this.getConfig();
    const actions: ProposedAction[] = [];
    const followupNote = ctx.followups.at(-1)?.text;

    // Sequence emails
    for (const draft of sequenceDrafts) {
      try {
        const action = await this.buildSequenceAction(draft, resolvedConfig, followupNote);
        if (action) actions.push(action);
      } catch (err) {
        this.logger.warn(`Sequence draft failed for ${draft.row.workspaceUuid}: ${(err as Error).message}`);
      }
    }

    // Legacy segments
    for (const [segment, users] of Object.entries(usersBySegment)) {
      for (const user of users) {
        try {
          const draft = await this.draftLegacyEmail(user, segment, resolvedConfig, followupNote);
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
    return action.type === 'send_email' || action.type === 'send_trial_sequence_email';
  }

  async execute(action: ProposedAction): Promise<ActionResult> {
    if (action.type === 'send_trial_sequence_email') {
      return this.executeSequenceEmail(action);
    }
    if (action.type === 'send_email') {
      return this.executeLegacyEmail(action);
    }
    return { success: false, error: `Unknown action: ${action.type}` };
  }

  apiRoutes(): AgentApiRoute[] {
    return [
      {
        method: 'POST',
        path: '/taskip-trial/trial-activated',
        requiresAuth: false,
        verifySignature: async (_body, headers) => {
          const secret = await this.settings.getDecrypted('taskip_trial_webhook_secret');
          if (!secret) return { ok: false, reason: 'webhook_secret_not_configured' };
          const sent = ((headers as Record<string, string>)['x-webhook-secret'] ?? '').trim();
          return safeEqualString(sent, secret) ? true : { ok: false, reason: 'invalid_secret' };
        },
        handler: async (body) => {
          const { workspaceUuid, email, industry } = body as {
            workspaceUuid: string;
            email: string;
            industry?: string;
          };
          if (!workspaceUuid || !email) {
            throw new Error('workspaceUuid and email are required');
          }
          await this.db.db.execute(sql`
            INSERT INTO taskip_trial_sequences (id, workspace_uuid, email, industry, next_step_at)
            VALUES (${createId()}, ${workspaceUuid}, ${email}, ${industry ?? null}, NOW())
            ON CONFLICT (workspace_uuid) DO NOTHING
          `);
          this.logger.log(`Trial sequence registered: ${workspaceUuid} <${email}>`);
          return { ok: true };
        },
      },
      {
        method: 'POST',
        path: '/taskip-trial/run-segment',
        requiresAuth: true,
        handler: async (req) => {
          const { segment } = (req as { body: { segment: string } }).body;
          const config = await this.getConfig();
          if (!SEGMENT_PROMPTS[segment]) throw new Error(`Unknown segment: ${segment}`);
          return this.taskipDb.getUsersForSegment(segment, config.dailyCap);
        },
      },
      {
        method: 'GET',
        path: '/taskip-trial/sequences',
        requiresAuth: true,
        handler: async () => {
          return this.db.db
            .select()
            .from(taskipTrialSequences)
            .orderBy(taskipTrialSequences.createdAt)
            .limit(100);
        },
      },
      {
        method: 'PATCH',
        path: '/taskip-trial/sequences/:id/cancel',
        requiresAuth: true,
        handler: async (req) => {
          const { id } = (req as { params: { id: string } }).params;
          await this.db.db.execute(sql`
            UPDATE taskip_trial_sequences SET status = 'cancelled'
            WHERE id = ${id} AND status = 'active'
          `);
          return { ok: true, id };
        },
      },
    ];
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
      {
        name: 'cancel_trial_sequence',
        description: 'Cancel a trial onboarding sequence by workspace UUID',
        inputSchema: {
          type: 'object',
          properties: { workspaceUuid: { type: 'string' } },
          required: ['workspaceUuid'],
        },
        handler: async (input) => {
          const { workspaceUuid } = input as { workspaceUuid: string };
          await this.db.db.execute(sql`
            UPDATE taskip_trial_sequences SET status = 'cancelled'
            WHERE workspace_uuid = ${workspaceUuid}
          `);
          return { cancelled: true, workspaceUuid };
        },
      },
    ];
  }

  // ─── Sequence logic ───────────────────────────────────────────────────────

  private async buildSequenceAction(
    draft: SequenceDraftContext,
    config: AgentConfig,
    followupNote?: string,
  ): Promise<ProposedAction | null> {
    const { row, overview, lifecycle } = draft;
    const sentAngles = Array.isArray(row.sentAngles) ? (row.sentAngles as SequenceAngle[]) : [];
    const remainingAngles = SEQUENCE_ANGLES.filter(a => !sentAngles.includes(a));

    if (!remainingAngles.length) {
      this.logger.log(`All angles exhausted for ${row.workspaceUuid} — completing sequence`);
      await this.db.db.execute(sql`
        UPDATE taskip_trial_sequences SET status = 'completed'
        WHERE id = ${row.id}
      `);
      return null;
    }

    // upgrade_cta only allowed from step 5+
    const eligibleAngles = row.step < 5
      ? remainingAngles.filter(a => a !== 'upgrade_cta')
      : remainingAngles;

    if (!eligibleAngles.length) {
      // Only upgrade_cta remains but step < 5: advance without sending
      await this.db.db.execute(sql`
        UPDATE taskip_trial_sequences SET next_step_at = NOW() + INTERVAL '1 day'
        WHERE id = ${row.id}
      `);
      return null;
    }

    // Build user context from available data
    const ownerName = lifecycle?.owner?.first_name ?? row.email.split('@')[0];
    const lastActiveAt = overview?.session?.last_active_at ?? null;
    const daysSinceActive = lastActiveAt
      ? Math.floor((Date.now() - new Date(lastActiveAt).getTime()) / 86_400_000)
      : null;
    const featureCount = (overview?.volume_metrics?.tasks_total as number | undefined) ?? 0;
    const cohort = overview?.cohort ?? lifecycle?.workspace?.cohort ?? null;
    const lifecycleState = lifecycle?.workspace?.lifecycle_state ?? 'trial';
    const industry = row.industry;
    const step = row.step;

    // LLM selects best angle + drafts email
    const systemPrompt = `You are Sharifur Rahman, founder of Taskip — a SaaS platform for agency and service businesses.
Write short, warm, personal founder emails in first person.
Rules:
- Under 120 words
- No marketing fluff or buzzwords
- Never start with "Hi [" or use any bracket placeholders
- End with a genuine question that invites a reply
- Output only valid JSON: { "angle": "<angle_label>", "subject": "...", "body": "..." }
- The "angle" field must be one of: ${eligibleAngles.join(', ')}`;

    const inactivityNote = daysSinceActive !== null && daysSinceActive >= 2
      ? `User has not logged in for ${daysSinceActive} days.`
      : 'User has been recently active.';

    const industryNote = industry ? `User's industry: ${industry}.` : '';

    const userPrompt = `Trial user: ${ownerName} <${row.email}>
Step: ${step + 1} of 7
${industryNote}
Lifecycle state: ${lifecycleState}
Engagement cohort: ${cohort ?? 'unknown'}
${inactivityNote}
Feature usage signal: ${featureCount} tasks created so far.
Angles already sent: ${sentAngles.join(', ') || 'none'}
Available angles to pick from: ${eligibleAngles.join(', ')}

Angle guidance:
${eligibleAngles.map(a => `- ${a}: ${ANGLE_INSTRUCTIONS[a]}`).join('\n')}
${followupNote ? `\nRevision instruction: ${followupNote}` : ''}

Pick the best angle for this user's current state and write the email.`;

    const response = await this.llm.complete({
      ...agentLlmOpts(config),
      agentKey: this.key,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      maxTokens: 500,
      temperature: 0.7,
    });

    let parsed: { angle: SequenceAngle; subject: string; body: string };
    try {
      const json = response.content.replace(/```json\n?|```/g, '').trim();
      parsed = JSON.parse(json);
    } catch {
      throw new Error(`LLM non-JSON for ${row.workspaceUuid}: ${response.content.slice(0, 100)}`);
    }

    if (!parsed.angle || !eligibleAngles.includes(parsed.angle)) {
      parsed.angle = eligibleAngles[0];
    }

    const angleReason = buildAngleReason(parsed.angle, daysSinceActive, featureCount, row.step, industry);

    return {
      type: 'send_trial_sequence_email',
      summary: `Trial step ${step + 1} [${parsed.angle}] for ${row.email}\nReason: ${angleReason}\nSubject: ${parsed.subject}`,
      payload: {
        sequenceId: row.id,
        workspaceUuid: row.workspaceUuid,
        email: row.email,
        step: row.step,
        angleLabel: parsed.angle,
        angleReason,
        subject: parsed.subject,
        body: parsed.body,
        gmailAccountId: row.gmailAccountId ?? null,
      },
      riskLevel: 'low',
    };
  }

  private async executeSequenceEmail(action: ProposedAction): Promise<ActionResult> {
    const {
      sequenceId,
      email,
      subject,
      body,
      gmailAccountId,
      step,
      angleLabel,
    } = action.payload as {
      sequenceId: string;
      workspaceUuid: string;
      email: string;
      step: number;
      angleLabel: SequenceAngle;
      angleReason: string;
      subject: string;
      body: string;
      gmailAccountId: string | null;
    };

    const fromAddress = await this.gmail.getFromAddress(gmailAccountId ?? undefined);
    const messageId = await this.gmail.sendEmail(
      { to: email, from: fromAddress, subject, textBody: body },
      gmailAccountId ?? undefined,
    );

    const newStep = step + 1;
    const completed = newStep >= 7;
    const usedAccountId = gmailAccountId ?? fromAddress.match(/<(.+)>/)?.[1] ?? fromAddress;

    await this.db.db.execute(sql`
      UPDATE taskip_trial_sequences SET
        step = ${newStep},
        status = ${completed ? 'completed' : 'active'},
        gmail_account_id = COALESCE(gmail_account_id, ${usedAccountId}),
        sent_angles = sent_angles || ${JSON.stringify([angleLabel])}::jsonb,
        last_step_at = NOW(),
        next_step_at = NOW() + INTERVAL '1 day'
      WHERE id = ${sequenceId}
    `);

    await this.db.db.insert(taskipTrialEmailLog).values({
      runId: '',
      userId: sequenceId,
      email,
      segment: `sequence_step_${step + 1}_${angleLabel}`,
      subject,
      body,
      sesMessageId: messageId,
    });

    return { success: true, data: { messageId, step: newStep, angleLabel, completed } };
  }

  private async executeLegacyEmail(action: ProposedAction): Promise<ActionResult> {
    const draft = action.payload as EmailDraft;
    const config = await this.getConfig();

    const provider = config.emailProvider ?? 'gmail';
    let messageId: string;

    if (provider === 'gmail' && await this.gmail.isConfigured()) {
      messageId = await this.gmail.sendEmail({
        to: draft.email,
        from: config.gmail?.from ?? draft.email,
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

  // ─── Legacy segment logic ─────────────────────────────────────────────────

  private async draftLegacyEmail(
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
      ...agentLlmOpts(config),
      agentKey: this.key,
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
        paid_at_risk: { enabled: true, templatePromptId: 'paid_at_risk' },
        churned_30d: { enabled: false, templatePromptId: 'churned_d30' },
      },
      emailProvider: 'gmail',
      gmail: { from: 'Sharifur <sharifur@taskip.net>' },
      ses: { from: 'Sharifur <sharifur@taskip.net>', configurationSet: 'ses-monitoring' },
      dailyCap: 50,
      maxFollowupsPerEmail: 5,
    };
  }

  private resolveSegments(trigger: TriggerEvent, config: AgentConfig): string[] {
    if (trigger.type === 'WEBHOOK') return [];
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface SequenceDraftContext {
  row: SequenceRow;
  overview: import('../taskip-internal/taskip-insight.service').InsightWorkspaceOverview | null;
  lifecycle: import('../taskip-internal/taskip-insight.service').InsightLifecycleSnapshot | null;
}

function buildAngleReason(
  angle: SequenceAngle,
  daysSinceActive: number | null,
  featureCount: number,
  step: number,
  industry: string | null,
): string {
  const industryPart = industry ? ` (${industry} user)` : '';
  switch (angle) {
    case 'welcome_first_win': return `Step 1 welcome${industryPart}`;
    case 'core_feature': return `Highlighting key feature${industryPart}`;
    case 'team_collaboration': return `Encouraging team expansion${industryPart}`;
    case 'checkin_questions':
      return daysSinceActive !== null
        ? `No login for ${daysSinceActive} days${industryPart}`
        : `Checking in${industryPart}`;
    case 'advanced_unlock': return `Low feature usage (${featureCount} tasks)${industryPart}`;
    case 'social_proof': return `Social proof nudge at step ${step + 1}${industryPart}`;
    case 'upgrade_cta': return `Trial ending soon — upgrade push${industryPart}`;
  }
}
