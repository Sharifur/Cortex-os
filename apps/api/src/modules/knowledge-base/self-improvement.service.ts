import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { eq } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { kbProposals } from './schema';
import { KnowledgeBaseService } from './knowledge-base.service';
import { LlmRouterService } from '../llm/llm-router.service';

export interface KbRejectionEvent {
  agentKey: string;
  agentName: string;
  draft: string;
  reason: string;
}

export interface KbProposalNotifyEvent {
  proposalId: string;
  text: string;
}

const PROPOSE_SYSTEM = `You are an AI knowledge base curator.
Given a rejected AI draft and the reason it was rejected, propose ONE knowledge base entry to prevent this mistake in future.

Choose the most appropriate type:
- "fact": a factual statement the agent should always remember
- "blocklist": a word, phrase, or pattern the agent must never use
- "writing_sample" (with polarity "negative"): an example of what NOT to write

Return JSON only — no markdown, no explanation:
{
  "entryType": "fact" | "blocklist" | "writing_sample",
  "title": "short descriptive title (max 8 words)",
  "content": "the actual rule, fact, or example text",
  "polarity": "negative",
  "reasoning": "one sentence: why this entry prevents the mistake"
}`;

@Injectable()
export class SelfImprovementService {
  private readonly logger = new Logger(SelfImprovementService.name);

  constructor(
    private readonly db: DbService,
    private readonly kb: KnowledgeBaseService,
    private readonly llm: LlmRouterService,
    private readonly events: EventEmitter2,
  ) {}

  @OnEvent('kb.rejection')
  async onRejection(event: KbRejectionEvent): Promise<void> {
    const { agentKey, agentName, draft, reason } = event;
    if (!reason?.trim() || !draft?.trim()) return;

    try {
      const response = await this.llm.complete({
        messages: [
          { role: 'system', content: PROPOSE_SYSTEM },
          {
            role: 'user',
            content: `Agent: ${agentKey}\n\nRejected draft:\n"${draft.slice(0, 500)}"\n\nRejection reason: "${reason.slice(0, 300)}"`,
          },
        ],
        provider: 'auto',
        model: 'gpt-4o-mini',
        maxTokens: 300,
        temperature: 0.3,
      });

      let proposal: { entryType: string; title: string; content: string; polarity?: string; reasoning: string };
      try {
        const text = response.content.trim();
        const match = text.match(/\{[\s\S]*\}/);
        proposal = JSON.parse(match?.[0] ?? text);
        if (!proposal.entryType || !proposal.title || !proposal.content) throw new Error('incomplete');
      } catch {
        this.logger.warn(`Self-improvement: failed to parse LLM proposal for ${agentKey}`);
        return;
      }

      const [row] = await this.db.db
        .insert(kbProposals)
        .values({
          agentKey,
          proposedEntryType: proposal.entryType,
          title: proposal.title,
          content: proposal.content,
          polarity: proposal.polarity ?? null,
          reasoning: proposal.reasoning ?? '',
        })
        .returning();

      const typeLabel = { fact: 'Fact', blocklist: 'Blocklist rule', writing_sample: 'Negative example' }[proposal.entryType] ?? proposal.entryType;
      const text = [
        `*Self-Improvement Proposal*`,
        `Agent: *${agentName}* (\`${agentKey}\`)`,
        ``,
        `${typeLabel}: *${proposal.title}*`,
        `_${proposal.content.slice(0, 250)}_`,
        ``,
        `Why: ${proposal.reasoning}`,
        ``,
        `Add this to the Knowledge Base?`,
      ].join('\n');

      this.events.emit('telegram.kb_proposal', { proposalId: row.id, text } as KbProposalNotifyEvent);
    } catch (err) {
      this.logger.error(`Self-improvement proposal failed for ${agentKey}: ${err}`);
    }
  }

  async approveProposal(proposalId: string): Promise<void> {
    const [proposal] = await this.db.db
      .select()
      .from(kbProposals)
      .where(eq(kbProposals.id, proposalId));

    if (!proposal || proposal.status !== 'pending') return;

    if (proposal.proposedEntryType === 'writing_sample') {
      await this.kb.createSample({
        context: proposal.title,
        sampleText: proposal.content,
        polarity: proposal.polarity ?? 'negative',
        agentKeys: proposal.agentKey,
      });
    } else {
      await this.kb.createEntry({
        title: proposal.title,
        content: proposal.content,
        category: 'auto-learned',
        entryType: proposal.proposedEntryType as 'fact' | 'blocklist' | 'reference' | 'voice_profile',
        agentKeys: proposal.agentKey,
      });
    }

    await this.db.db
      .update(kbProposals)
      .set({ status: 'approved' })
      .where(eq(kbProposals.id, proposalId));

    this.logger.log(`KB proposal approved and added: ${proposal.title} (${proposal.proposedEntryType}) for ${proposal.agentKey}`);
  }

  async rejectProposal(proposalId: string): Promise<void> {
    await this.db.db
      .update(kbProposals)
      .set({ status: 'rejected' })
      .where(eq(kbProposals.id, proposalId));
  }

  async listProposals(status?: string) {
    const rows = await this.db.db.select().from(kbProposals);
    if (status) return rows.filter(r => r.status === status);
    return rows;
  }
}
