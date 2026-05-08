import { Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, gt } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { taskipInternalSuggestions, taskipInternalWorkspaceActivity } from '../../../db/schema';
import { LlmRouterService } from '../../llm/llm-router.service';
import { TelegramService } from '../../telegram/telegram.service';
import {
  TaskipInsightService,
  type InsightCohortListItem,
  type InsightLifecycleSnapshot,
  type InsightPendingScenarios,
} from './taskip-insight.service';

const GMAIL_COHORTS = new Set(['serious_trial', 'looking_trial', 'trial_ready_free']);
const SWEEP_COHORTS = ['serious_trial', 'looking_trial', 'trial_ready_free', 'at_risk_paid', 'dormant_paid'] as const;

interface DraftResult {
  subject: string;
  bodyMd: string;
  ctaText: string | null;
  ctaUrl: string | null;
}

@Injectable()
export class TaskipInternalSuggestionSweepService {
  private readonly logger = new Logger(TaskipInternalSuggestionSweepService.name);

  constructor(
    private readonly db: DbService,
    private readonly insight: TaskipInsightService,
    private readonly llm: LlmRouterService,
    private readonly telegram: TelegramService,
  ) {}

  async runSweep(): Promise<{ drafted: number; skipped: number }> {
    let drafted = 0;
    let skipped = 0;

    const cohortWorkspaces = await this.fetchAllCohorts();

    for (const { cohort, workspace } of cohortWorkspaces) {
      try {
        const result = await this.processSingleWorkspace(cohort, workspace);
        if (result === 'drafted') drafted++;
        else skipped++;
      } catch (err) {
        this.logger.warn(`sweep error for ${workspace.uuid} (${cohort}): ${(err as Error).message}`);
        skipped++;
      }
    }

    if (drafted > 0) {
      await this.telegram.sendMessage(
        `Taskip Internal: ${drafted} new suggestion${drafted === 1 ? '' : 's'} ready for review.`,
      ).catch((err) => this.logger.warn(`telegram notify failed: ${(err as Error).message}`));
    }

    this.logger.log(`sweep complete drafted=${drafted} skipped=${skipped}`);
    return { drafted, skipped };
  }

  private async processSingleWorkspace(
    cohort: string,
    workspace: InsightCohortListItem,
  ): Promise<'drafted' | 'skipped'> {
    const [cooldown, dedup] = await Promise.all([
      this.checkCooldown(workspace.uuid),
      this.checkDedup(workspace.uuid),
    ]);

    if (cooldown || dedup) {
      await this.writeActivityLog(workspace.uuid, 'sweep_skipped_cooldown', null, workspace.score, cohort,
        cooldown ? '48h cooldown active' : 'pending suggestion already exists');
      return 'skipped';
    }

    const suppressed = await this.checkSkipSuppression(workspace.uuid);
    if (suppressed) {
      await this.writeActivityLog(workspace.uuid, 'sweep_ignored', null, workspace.score, cohort,
        '3 consecutive skips with no send');
      return 'skipped';
    }

    const [lifecycle, scenariosResult] = await Promise.all([
      this.insight.getLifecycle(workspace.uuid),
      this.insight.getPendingScenarios(workspace.uuid),
    ]);

    // respect opt-out preferences from Insight
    const prefs = lifecycle.owner.preferences;
    if (prefs?.ai_messages_enabled === false || prefs?.marketing_emails_enabled === false) {
      return 'skipped';
    }

    if (scenariosResult.eligible.length === 0) {
      return 'skipped';
    }

    const scenario = scenariosResult.eligible[0];
    const draft = await this.generateDraft(lifecycle, scenariosResult, cohort);
    if (!draft) return 'skipped';

    const channel = GMAIL_COHORTS.has(cohort) ? 'gmail' : 'taskip_system';
    const scoreTier = this.scoreTier(workspace.score);

    await this.db.db.insert(taskipInternalSuggestions).values({
      workspaceUuid: workspace.uuid,
      ownerEmail: lifecycle.owner.email,
      ownerName: `${lifecycle.owner.first_name}${lifecycle.owner.last_name ? ' ' + lifecycle.owner.last_name : ''}`.trim(),
      cohort,
      scenarioKey: scenario.scenario_key,
      score: workspace.score,
      scoreTier,
      lifecycleState: lifecycle.workspace.lifecycle_state,
      daysSinceSignup: lifecycle.workspace.trial_started_at
        ? Math.floor((Date.now() - new Date(lifecycle.workspace.trial_started_at).getTime()) / 86400000)
        : 0,
      subject: draft.subject,
      bodyMd: draft.bodyMd,
      ctaText: draft.ctaText,
      ctaUrl: draft.ctaUrl,
      channel,
      channelLockedAt: new Date(),
      status: 'pending',
    });

    await this.writeActivityLog(workspace.uuid, 'suggestion_created', null, workspace.score, cohort, null);

    return 'drafted';
  }

  private async checkCooldown(workspaceUuid: string): Promise<boolean> {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const rows = await this.db.db
      .select({ id: taskipInternalSuggestions.id })
      .from(taskipInternalSuggestions)
      .where(
        and(
          eq(taskipInternalSuggestions.workspaceUuid, workspaceUuid),
          gt(taskipInternalSuggestions.createdAt, cutoff),
          // sent emails count as cooldown; skipped ones do not
          eq(taskipInternalSuggestions.status, 'sent'),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  private async checkDedup(workspaceUuid: string): Promise<boolean> {
    const rows = await this.db.db
      .select({ id: taskipInternalSuggestions.id })
      .from(taskipInternalSuggestions)
      .where(
        and(
          eq(taskipInternalSuggestions.workspaceUuid, workspaceUuid),
          eq(taskipInternalSuggestions.status, 'pending'),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  private async checkSkipSuppression(workspaceUuid: string): Promise<boolean> {
    const recent = await this.db.db
      .select({ activityType: taskipInternalWorkspaceActivity.activityType })
      .from(taskipInternalWorkspaceActivity)
      .where(eq(taskipInternalWorkspaceActivity.workspaceUuid, workspaceUuid))
      .orderBy(desc(taskipInternalWorkspaceActivity.createdAt))
      .limit(3);

    if (recent.length < 3) return false;
    return recent.every((r) => r.activityType === 'suggestion_skipped');
  }

  private async generateDraft(
    lifecycle: InsightLifecycleSnapshot,
    scenarios: InsightPendingScenarios,
    cohort: string,
  ): Promise<DraftResult | null> {
    const scenario = scenarios.eligible[0];
    const ws = lifecycle.workspace;
    const owner = lifecycle.owner;
    const score = lifecycle.score;

    const daysSinceSignup = ws.trial_started_at
      ? Math.floor((Date.now() - new Date(ws.trial_started_at).getTime()) / 86400000)
      : 0;

    const recentMessages = (lifecycle.recent_messages ?? [])
      .slice(0, 2)
      .map((m) => `- ${m.scenario_key} (${m.result}): ${m.output_subject ?? 'no subject'}`)
      .join('\n') || 'none';

    const topSignals = score.signals
      .slice(0, 3)
      .map((s) => `- ${s.key}: ${s.value}`)
      .join('\n');

    const prompt = `You are writing a personalized email for the Taskip founder to review before sending.

Workspace: ${ws.name} (${daysSinceSignup} days in ${ws.lifecycle_state})
Owner: ${owner.first_name}
Cohort: ${cohort} | Score: ${score.value}/100 | Delta 14d: ${score.delta_14d ?? 0}
Scenario: ${scenario.scenario_key} — ${scenario.spec.trigger.condition}
Tone: ${scenario.spec.tone}
Personalization vars allowed: ${scenario.spec.allowed_vars.join(', ')}

Top signals from score:
${topSignals}

Recent message history (what was already sent):
${recentMessages}

Write a short, personal email referencing what the user actually DID.
Rules:
- Reference user actions (what they did), never behavior patterns or login counts
- Single CTA, named clearly
- No countdown timers, no exclamation marks doing emotional labor
- No "just checking in" or "we miss you"
- Max 120 words for body
- CTA URL must be on taskip.net or taskip.app

Return JSON only:
{ "subject": "...", "body_md": "...", "cta_text": "...", "cta_url": "..." }`;

    let raw: string;
    try {
      const result = await this.llm.complete({
        agentKey: 'taskip_internal',
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 400,
        temperature: 0.3,
      });
      raw = result.content.trim();
    } catch (err) {
      this.logger.warn(`LLM draft generation failed for ${ws.uuid}: ${(err as Error).message}`);
      return null;
    }

    // strip markdown code fence if present
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

    try {
      const parsed = JSON.parse(jsonStr) as {
        subject?: string;
        body_md?: string;
        cta_text?: string;
        cta_url?: string;
      };
      if (!parsed.subject || !parsed.body_md) {
        this.logger.warn(`LLM draft missing required fields for ${ws.uuid}`);
        return null;
      }
      return {
        subject: parsed.subject,
        bodyMd: parsed.body_md,
        ctaText: parsed.cta_text ?? null,
        ctaUrl: parsed.cta_url ?? null,
      };
    } catch {
      this.logger.warn(`LLM draft JSON parse failed for ${ws.uuid}: ${jsonStr.slice(0, 100)}`);
      return null;
    }
  }

  private async writeActivityLog(
    workspaceUuid: string,
    activityType: string,
    suggestionId: string | null,
    score: number | null,
    cohort: string | null,
    notes: string | null,
  ): Promise<void> {
    await this.db.db.insert(taskipInternalWorkspaceActivity).values({
      workspaceUuid,
      activityType,
      suggestionId,
      score,
      cohort,
      notes,
    });
  }

  private scoreTier(score: number): number {
    if (score <= 25) return 1;
    if (score <= 50) return 2;
    if (score <= 75) return 3;
    return 4;
  }

  private async fetchAllCohorts(): Promise<{ cohort: string; workspace: InsightCohortListItem }[]> {
    const results: { cohort: string; workspace: InsightCohortListItem }[] = [];

    const [hotList, lookingList, trialReadyList, atRiskResp, dormantResp] = await Promise.allSettled([
      this.insight.getTrialFunnelHotList(),
      this.insight.listCohort('looking_trial', { perPage: 50 }),
      this.insight.getTrialFunnelTrialReadyList(),
      this.insight.listCohort('at_risk_paid', { perPage: 50 }),
      this.insight.listCohort('dormant_paid', { perPage: 50 }),
    ]);

    const push = (cohort: string, r: PromiseSettledResult<InsightCohortListItem[] | { workspaces: InsightCohortListItem[] }>) => {
      if (r.status === 'rejected') {
        this.logger.warn(`cohort fetch failed for ${cohort}: ${(r.reason as Error).message}`);
        return;
      }
      const workspaces = Array.isArray(r.value) ? r.value : (r.value as { workspaces: InsightCohortListItem[] }).workspaces;
      for (const workspace of workspaces) {
        results.push({ cohort, workspace });
      }
    };

    push('serious_trial', hotList);
    push('looking_trial', lookingList);
    push('trial_ready_free', trialReadyList);
    push('at_risk_paid', atRiskResp);
    push('dormant_paid', dormantResp);

    return results;
  }
}
