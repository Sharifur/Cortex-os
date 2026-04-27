import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { gt, eq, inArray } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { agents, agentRuns, pendingApprovals } from '../../../db/schema';
import { AgentRegistryService } from '../runtime/agent-registry.service';
import { LlmRouterService } from '../../llm/llm-router.service';
import { TelegramService } from '../../telegram/telegram.service';
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

interface DailyReminderConfig {
  morningCron: string;
  eveningCron: string;
  enableMorning: boolean;
  enableEvening: boolean;
  llm: { provider: string; model: string };
}

interface PendingApprovalSummary {
  id: string;
  agentName: string;
  summary: string;
  createdAt: string;
}

interface RecentRunSummary {
  agentName: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
}

interface BriefSnapshot {
  briefType: 'morning' | 'evening' | 'task';
  pendingApprovals: PendingApprovalSummary[];
  recentRuns: RecentRunSummary[];
  config: DailyReminderConfig;
  taskInstruction?: string;
}

const MORNING_SYSTEM = `You are a personal AI assistant for Sharifur Rahman, founder of Taskip and Xgenious.
Write a concise morning brief in plain text for Telegram (no markdown headers, use emoji sparingly).
Keep it under 200 words. Include: a warm opener, pending actions needing attention, and a short focus note for the day.`;

const EVENING_SYSTEM = `You are a personal AI assistant for Sharifur Rahman, founder of Taskip and Xgenious.
Write a concise end-of-day recap in plain text for Telegram (no markdown headers, use emoji sparingly).
Keep it under 200 words. Include: what automated agents ran today, any outstanding approvals, and a brief closing thought.`;

@Injectable()
export class DailyReminderAgent implements IAgent, OnModuleInit {
  readonly key = 'daily_reminder';
  readonly name = 'Daily Reminder';
  private readonly logger = new Logger(DailyReminderAgent.name);

  constructor(
    private db: DbService,
    private llm: LlmRouterService,
    private telegram: TelegramService,
    private registry: AgentRegistryService,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  triggers(): TriggerSpec[] {
    return [
      { type: 'CRON', cron: '30 2 * * *' },  // 08:30 Asia/Dhaka = 02:30 UTC
      { type: 'CRON', cron: '0 15 * * *' },   // 21:00 Asia/Dhaka = 15:00 UTC
    ];
  }

  async buildContext(trigger: TriggerEvent, run: RunContext): Promise<AgentContext> {
    const config = await this.getConfig();

    // Manual task with explicit instructions — skip brief generation
    const taskInstruction = (trigger.payload as Record<string, string> | undefined)?.instructions;
    if (taskInstruction) {
      return {
        source: trigger,
        snapshot: { briefType: 'task' as const, taskInstruction, config },
        followups: (run.context as AgentContext | null)?.followups ?? [],
      };
    }

    const utcHour = new Date().getUTCHours();
    const briefType: 'morning' | 'evening' = utcHour < 12 ? 'morning' : 'evening';

    if (briefType === 'morning' && !config.enableMorning) {
      return { source: trigger, snapshot: { briefType, skip: true }, followups: [] };
    }
    if (briefType === 'evening' && !config.enableEvening) {
      return { source: trigger, snapshot: { briefType, skip: true }, followups: [] };
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [pendingRows, recentRunRows] = await Promise.all([
      this.db.db
        .select({
          id: pendingApprovals.id,
          action: pendingApprovals.action,
          createdAt: pendingApprovals.createdAt,
          agentId: agentRuns.agentId,
        })
        .from(pendingApprovals)
        .innerJoin(agentRuns, eq(pendingApprovals.runId, agentRuns.id))
        .where(inArray(pendingApprovals.status, ['PENDING'])),
      this.db.db
        .select({
          agentName: agents.name,
          status: agentRuns.status,
          startedAt: agentRuns.startedAt,
          finishedAt: agentRuns.finishedAt,
        })
        .from(agentRuns)
        .innerJoin(agents, eq(agentRuns.agentId, agents.id))
        .where(gt(agentRuns.startedAt, since))
        .orderBy(agentRuns.startedAt),
    ]);

    const agentIds = [...new Set(pendingRows.map(r => r.agentId))];
    let agentNameMap: Record<string, string> = {};
    if (agentIds.length) {
      const rows = await this.db.db
        .select({ id: agents.id, name: agents.name })
        .from(agents)
        .where(inArray(agents.id, agentIds));
      agentNameMap = Object.fromEntries(rows.map(r => [r.id, r.name]));
    }

    const pendingSummaries: PendingApprovalSummary[] = pendingRows.map(r => ({
      id: r.id,
      agentName: agentNameMap[r.agentId] ?? 'Unknown',
      summary: (r.action as { summary?: string })?.summary ?? 'Action pending',
      createdAt: r.createdAt.toISOString(),
    }));

    const recentSummaries: RecentRunSummary[] = recentRunRows.map(r => ({
      agentName: r.agentName,
      status: r.status,
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt?.toISOString() ?? null,
    }));

    const snapshot: BriefSnapshot = {
      briefType,
      pendingApprovals: pendingSummaries,
      recentRuns: recentSummaries,
      config,
    };

    this.logger.log(`buildContext: ${briefType} brief — ${pendingSummaries.length} pending, ${recentSummaries.length} recent runs`);

    return { source: trigger, snapshot, followups: (run.context as AgentContext | null)?.followups ?? [] };
  }

  async decide(ctx: AgentContext): Promise<ProposedAction[]> {
    const snapshot = ctx.snapshot as BriefSnapshot & { skip?: boolean; taskInstruction?: string };
    if (snapshot.skip) return [];

    const { briefType, config } = snapshot;

    // Task-triggered: handle direct reminder or LLM-composed instruction
    if (briefType === 'task' && snapshot.taskInstruction) {
      // REMINDER: prefix means send the message exactly as-is — no LLM
      if (snapshot.taskInstruction.startsWith('REMINDER:')) {
        const message = snapshot.taskInstruction.slice('REMINDER:'.length).trim();
        return [
          {
            type: 'send_telegram_brief',
            summary: `Send reminder: ${message}`,
            payload: { message: `Reminder: ${message}`, briefType: 'task' },
            riskLevel: 'low',
          },
        ];
      }

      const response = await this.llm.complete({
        provider: config.llm.provider as 'openai' | 'gemini' | 'deepseek' | 'auto',
        model: config.llm.model,
        messages: [
          {
            role: 'system',
            content: 'You are a Telegram assistant for Sharifur. Follow the task instruction exactly. Reply with only the message text to send — nothing else.',
          },
          { role: 'user', content: snapshot.taskInstruction },
        ],
        maxTokens: 200,
        temperature: 0.5,
      });

      return [
        {
          type: 'send_telegram_brief',
          summary: `Send task message: ${snapshot.taskInstruction}`,
          payload: { message: response.content, briefType: 'task' },
          riskLevel: 'low',
        },
      ];
    }

    const { pendingApprovals: pending, recentRuns } = snapshot;
    const followupNote = ctx.followups.at(-1)?.text;

    const userMsg = this.buildPrompt(briefType as 'morning' | 'evening', pending, recentRuns, followupNote);
    const systemMsg = briefType === 'morning' ? MORNING_SYSTEM : EVENING_SYSTEM;

    const response = await this.llm.complete({
      provider: config.llm.provider as 'openai' | 'gemini' | 'deepseek' | 'auto',
      model: config.llm.model,
      messages: [
        { role: 'system', content: systemMsg },
        { role: 'user', content: userMsg },
      ],
      maxTokens: 400,
      temperature: 0.7,
    });

    return [
      {
        type: 'send_telegram_brief',
        summary: `Send ${briefType} brief to Telegram`,
        payload: { message: response.content, briefType },
        riskLevel: 'low',
      },
    ];
  }

  requiresApproval(_action: ProposedAction): boolean {
    return false;
  }

  async execute(action: ProposedAction): Promise<ActionResult> {
    if (action.type !== 'send_telegram_brief') {
      return { success: false, error: `Unknown action: ${action.type}` };
    }

    const { message } = action.payload as { message: string; briefType: string };
    await this.telegram.sendMessage(message);
    return { success: true, data: { sent: true } };
  }

  mcpTools(): McpToolDefinition[] {
    return [
      {
        name: 'send_custom_brief',
        description: 'Send a custom message to Telegram immediately',
        inputSchema: {
          type: 'object',
          properties: { message: { type: 'string' } },
          required: ['message'],
        },
        handler: async (input) => {
          const { message } = input as { message: string };
          await this.telegram.sendMessage(message);
          return { sent: true };
        },
      },
    ];
  }

  apiRoutes(): AgentApiRoute[] {
    return [
      {
        method: 'GET',
        path: '/daily-reminder/status',
        requiresAuth: true,
        handler: async () => {
          const config = await this.getConfig();
          return { morningCron: config.morningCron, eveningCron: config.eveningCron };
        },
      },
    ];
  }

  private buildPrompt(
    type: 'morning' | 'evening',
    pending: PendingApprovalSummary[],
    runs: RecentRunSummary[],
    followupNote?: string,
  ): string {
    const lines: string[] = [];

    if (type === 'morning') {
      lines.push('Good morning! Here is the morning brief data:');
    } else {
      lines.push('End of day. Here is the recap data:');
    }

    if (pending.length) {
      lines.push(`\nPending approvals (${pending.length}):`);
      for (const p of pending.slice(0, 5)) {
        lines.push(`- [${p.agentName}] ${p.summary}`);
      }
      if (pending.length > 5) lines.push(`  ...and ${pending.length - 5} more`);
    } else {
      lines.push('\nNo pending approvals.');
    }

    if (runs.length) {
      lines.push(`\nAgent activity last 24h (${runs.length} runs):`);
      const summary = runs.reduce<Record<string, Record<string, number>>>((acc, r) => {
        if (!acc[r.agentName]) acc[r.agentName] = {};
        acc[r.agentName][r.status] = (acc[r.agentName][r.status] ?? 0) + 1;
        return acc;
      }, {});
      for (const [name, statuses] of Object.entries(summary)) {
        const statusStr = Object.entries(statuses).map(([s, n]) => `${n} ${s}`).join(', ');
        lines.push(`- ${name}: ${statusStr}`);
      }
    } else {
      lines.push('\nNo agent runs in the last 24 hours.');
    }

    if (followupNote) {
      lines.push(`\nAdditional instruction: ${followupNote}`);
    }

    return lines.join('\n');
  }

  private async getConfig(): Promise<DailyReminderConfig> {
    const [row] = await this.db.db
      .select({ config: agents.config })
      .from(agents)
      .where(eq(agents.key, this.key));

    return (row?.config as DailyReminderConfig) ?? this.defaultConfig();
  }

  private defaultConfig(): DailyReminderConfig {
    return {
      morningCron: '30 2 * * *',
      eveningCron: '0 15 * * *',
      enableMorning: true,
      enableEvening: true,
      llm: { provider: 'auto', model: 'gpt-4o-mini' },
    };
  }
}
