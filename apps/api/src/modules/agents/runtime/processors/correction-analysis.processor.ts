import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { sql } from 'drizzle-orm';
import { DbService } from '../../../../db/db.service';
import { kbProposals } from '../../../../db/schema';
import { LlmRouterService } from '../../../llm/llm-router.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { QUEUE_NAMES } from '../../../../common/queue/queue.constants';
import { getAgentProfile } from '../self-improvement-profile';
import { createId } from '@paralleldrive/cuid2';
import type { KbProposalNotifyEvent } from '../../../knowledge-base/self-improvement.service';

type CorrectionRow = {
  agent_key: string;
  signal_type: string;
  draft_text: string | null;
  correction_text: string | null;
  rejection_reason: string | null;
  [key: string]: unknown;
};

interface LlmPattern {
  patternSummary: string;
  occurrenceCount: number;
  entryType: string;
  title: string;
  content: string;
  reasoning: string;
}

const ANALYSIS_SYSTEM = `You are an AI knowledge base curator analyzing quality signals to find recurring patterns.

Given a list of rejection reasons and followup corrections for an AI agent, identify patterns that appear 3 or more times (exact or semantically similar — "don't say X" and "avoid X" and "never mention X" are the same pattern).

For each confirmed pattern (3+ occurrences), propose ONE KB entry that prevents it.

Return a JSON array (empty array if no confirmed patterns):
[{
  "patternSummary": "one-line description of the recurring problem",
  "occurrenceCount": 4,
  "entryType": "fact" | "blocklist" | "writing_sample",
  "title": "max 8 words",
  "content": "the actual rule, phrase to block, or example to avoid",
  "reasoning": "one sentence: why this entry prevents the pattern"
}]

Return only the JSON array — no markdown, no explanation.`;

@Processor(QUEUE_NAMES.CORRECTION_ANALYSIS, { autorun: false })
export class CorrectionAnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(CorrectionAnalysisProcessor.name);

  constructor(
    private readonly db: DbService,
    private readonly llm: LlmRouterService,
    private readonly events: EventEmitter2,
  ) {
    super();
  }

  startWorker(): void {
    this.worker.run().catch((err) => this.logger.error('Worker crashed', err));
  }

  async process(_job: Job): Promise<void> {
    this.logger.log('Running weekly correction analysis');

    const rows = await this.db.db.execute<CorrectionRow>(sql`
      SELECT agent_key, signal_type, draft_text, correction_text, rejection_reason
      FROM correction_signals
      WHERE captured_at >= NOW() - INTERVAL '30 days'
        AND signal_type IN ('rejected', 'followup')
      ORDER BY agent_key, captured_at DESC
      LIMIT 500
    `);

    const byAgent = new Map<string, CorrectionRow[]>();
    for (const row of rows) {
      const key = row.agent_key;
      if (!byAgent.has(key)) byAgent.set(key, []);
      byAgent.get(key)!.push(row);
    }

    for (const [agentKey, signals] of byAgent.entries()) {
      const profile = getAgentProfile(agentKey);
      if (!profile.trackCorrections) continue;
      if (signals.length < profile.patternThreshold) continue;

      await this.analyzeAgent(agentKey, signals, profile.patternThreshold);
    }
  }

  private async analyzeAgent(agentKey: string, signals: CorrectionRow[], threshold: number) {
    const rejections = signals
      .filter((s) => s.signal_type === 'rejected' && s.rejection_reason?.trim())
      .map((s, i) => `${i + 1}. "${s.rejection_reason!.slice(0, 200)}"`);

    const corrections = signals
      .filter((s) => s.signal_type === 'followup' && s.correction_text?.trim())
      .map((s, i) => `${i + 1}. "${s.correction_text!.slice(0, 200)}"`);

    if (rejections.length + corrections.length < threshold) return;

    const userContent = [
      `Agent: ${agentKey}`,
      `Minimum pattern threshold: ${threshold}`,
      rejections.length > 0 ? `\nRejection reasons (${rejections.length}):\n${rejections.slice(0, 20).join('\n')}` : null,
      corrections.length > 0 ? `\nFollowup corrections (${corrections.length}):\n${corrections.slice(0, 20).join('\n')}` : null,
    ].filter(Boolean).join('\n');

    let patterns: LlmPattern[];
    try {
      const response = await this.llm.complete({
        messages: [
          { role: 'system', content: ANALYSIS_SYSTEM },
          { role: 'user', content: userContent },
        ],
        provider: 'auto',
        model: 'gpt-4o-mini',
        maxTokens: 800,
        temperature: 0.2,
      });
      const text = response.content.trim();
      const match = text.match(/\[[\s\S]*\]/);
      patterns = JSON.parse(match?.[0] ?? text);
      if (!Array.isArray(patterns)) return;
    } catch (err) {
      this.logger.error(`Correction analysis LLM failed for ${agentKey}: ${err}`);
      return;
    }

    for (const pattern of patterns) {
      if (!pattern.entryType || !pattern.title || !pattern.content) continue;
      if ((pattern.occurrenceCount ?? 0) < threshold) continue;

      const cooldownDays = getAgentProfile(agentKey).proposalCooldownDays;
      const recentDuplicate = await this.db.db.execute<{ count: number; [key: string]: unknown }>(sql`
        SELECT COUNT(*)::int AS count FROM kb_proposals
        WHERE agent_key = ${agentKey}
          AND title = ${pattern.title}
          AND source_type = 'correction_analysis'
          AND created_at >= NOW() - (${cooldownDays} || ' days')::interval
      `);
      if (((recentDuplicate[0]?.count as number) ?? 0) > 0) continue;

      const [row] = await this.db.db.insert(kbProposals).values({
        id: createId(),
        agentKey,
        proposedEntryType: pattern.entryType,
        title: pattern.title,
        content: pattern.content,
        polarity: pattern.entryType === 'writing_sample' ? 'negative' : null,
        reasoning: pattern.reasoning ?? '',
        category: 'general',
        sourceType: 'correction_analysis',
      }).returning();

      const text = [
        `*Weekly Pattern Analysis — KB Proposal*`,
        `Agent: \`${agentKey}\``,
        ``,
        `Pattern found ${pattern.occurrenceCount}x: ${pattern.patternSummary}`,
        ``,
        `Proposed ${pattern.entryType}: *${pattern.title}*`,
        `_${pattern.content.slice(0, 300)}_`,
        ``,
        `Why: ${pattern.reasoning}`,
        ``,
        `Add this to the Knowledge Base?`,
      ].join('\n');

      this.events.emit('telegram.kb_proposal', { proposalId: row.id, text } as KbProposalNotifyEvent);
      this.logger.log(`Proposed KB entry for ${agentKey}: "${pattern.title}" (${pattern.occurrenceCount}x pattern)`);
    }
  }
}
