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

const REJECTION_PROPOSE_SYSTEM = `You are an AI knowledge base curator.
Given a rejected AI draft and the reason it was rejected, propose ONE knowledge base entry to prevent this mistake in future.

Choose the most appropriate type:
- "fact": a factual statement the agent should always remember
- "blocklist": a word, phrase, or pattern the agent must never use
- "writing_sample" (with polarity "negative"): an example of what NOT to write

Return JSON only — no markdown, no explanation:
{
  "entryType": "fact" | "blocklist" | "writing_sample",
  "category": "general" | "product" | "policy" | "faq",
  "title": "short descriptive title (max 8 words)",
  "content": "the actual rule, fact, or example text",
  "polarity": "negative",
  "reasoning": "one sentence: why this entry prevents the mistake"
}`;

const CORRECTION_PROPOSE_SYSTEM = `You are an AI knowledge base curator for a live chat support system.
An operator has corrected an AI response. Your job is to generate a clean, reusable Q&A knowledge base entry from this correction so the AI never makes the same mistake again.

Rules:
- Always use entryType "reference" with a Q&A format
- The question should be a clean, generalized version of what the visitor asked (not word-for-word)
- The answer must be accurate and complete — synthesize it from the operator's correction, not just copy it verbatim
- If the operator correction is terse (e.g. "no, it's $29"), expand it into a full helpful answer
- Choose the most accurate category: "faq", "product", "policy", "general"
- Priority 80 — corrections are high-confidence entries

Return JSON only — no markdown, no explanation:
{
  "entryType": "reference",
  "category": "faq" | "product" | "policy" | "general",
  "title": "short descriptive title (max 8 words)",
  "content": "Q: [clean generalized visitor question]\\nA: [complete synthesized correct answer]",
  "reasoning": "one sentence: what was wrong and what the correct information is"
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
          { role: 'system', content: REJECTION_PROPOSE_SYSTEM },
          {
            role: 'user',
            content: `Agent: ${agentKey}\n\nRejected draft:\n"${draft.slice(0, 500)}"\n\nRejection reason: "${reason.slice(0, 300)}"`,
          },
        ],
        provider: 'auto',
        model: 'gpt-4o-mini',
        maxTokens: 400,
        temperature: 0.3,
      });

      let proposal: { entryType: string; category?: string; title: string; content: string; polarity?: string; reasoning: string };
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
          category: proposal.category ?? 'general',
          sourceType: 'rejection',
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

  async proposeFromCorrection(opts: {
    agentKey: string;
    agentName: string;
    visitorQuestion: string | null;
    aiMessage: string;
    correction: string;
    siteKey?: string | null;
    sessionId?: string | null;
  }): Promise<{ proposalId: string }> {
    const { agentKey, agentName, visitorQuestion, aiMessage, correction, siteKey, sessionId } = opts;

    const userContent = [
      visitorQuestion ? `Visitor asked: "${visitorQuestion.slice(0, 300)}"` : null,
      `AI responded: "${aiMessage.slice(0, 500)}"`,
      `Operator correction: "${correction.slice(0, 400)}"`,
    ].filter(Boolean).join('\n\n');

    const response = await this.llm.complete({
      messages: [
        { role: 'system', content: CORRECTION_PROPOSE_SYSTEM },
        { role: 'user', content: userContent },
      ],
      provider: 'auto',
      model: 'gpt-4o-mini',
      maxTokens: 500,
      temperature: 0.2,
    });

    const raw = response.content.trim();
    const match = raw.match(/\{[\s\S]*\}/);
    const proposal: { entryType: string; category?: string; title: string; content: string; reasoning: string } = JSON.parse(match?.[0] ?? raw);
    if (!proposal.entryType || !proposal.title || !proposal.content) throw new Error('LLM returned incomplete proposal');

    const [row] = await this.db.db
      .insert(kbProposals)
      .values({
        agentKey,
        proposedEntryType: proposal.entryType,
        title: proposal.title,
        content: proposal.content,
        polarity: null,
        reasoning: proposal.reasoning ?? '',
        category: proposal.category ?? 'faq',
        sourceType: 'correction',
        siteKey: siteKey ?? null,
        sessionId: sessionId ?? null,
      })
      .returning();

    const siteLabel = siteKey ? ` (site: \`${siteKey}\`)` : '';
    const text = [
      `*Operator Correction — KB Proposal*`,
      `Agent: *${agentName}* (\`${agentKey}\`)${siteLabel}`,
      ``,
      visitorQuestion ? `Visitor asked: _"${visitorQuestion.slice(0, 120)}"_` : null,
      `AI said: _"${aiMessage.slice(0, 120)}"_`,
      `Correction: "${correction.slice(0, 120)}"`,
      ``,
      `Proposed Q&A entry: *${proposal.title}*`,
      `_${proposal.content.slice(0, 300)}_`,
      ``,
      `Why: ${proposal.reasoning}`,
      ``,
      `Add this to the Knowledge Base?`,
    ].filter(l => l !== null).join('\n');

    this.events.emit('telegram.kb_proposal', { proposalId: row.id, text } as KbProposalNotifyEvent);
    this.logger.log(`Correction-based KB proposal created: ${row.id} for ${agentKey}${siteKey ? ` site=${siteKey}` : ''}`);
    return { proposalId: row.id };
  }

  async approveProposal(proposalId: string): Promise<void> {
    const [proposal] = await this.db.db
      .select()
      .from(kbProposals)
      .where(eq(kbProposals.id, proposalId));

    if (!proposal || proposal.status !== 'pending') return;

    const category = proposal.category ?? 'general';
    const siteKeys = proposal.siteKey ?? null;
    const sourceType = proposal.sourceType ?? 'correction';

    if (proposal.proposedEntryType === 'writing_sample') {
      await this.kb.createSample({
        context: proposal.title,
        sampleText: proposal.content,
        polarity: proposal.polarity ?? 'negative',
        agentKeys: proposal.agentKey,
        siteKeys,
      });
    } else {
      await this.kb.createEntry({
        title: proposal.title,
        content: proposal.content,
        category,
        entryType: proposal.proposedEntryType as 'fact' | 'blocklist' | 'reference' | 'voice_profile',
        priority: sourceType === 'correction' ? 80 : 50,
        agentKeys: proposal.agentKey,
        siteKeys,
        sourceType,
      });
    }

    await this.db.db
      .update(kbProposals)
      .set({ status: 'approved' })
      .where(eq(kbProposals.id, proposalId));

    this.logger.log(`KB proposal approved: ${proposal.title} (${proposal.proposedEntryType}) agent=${proposal.agentKey} site=${proposal.siteKey ?? 'global'}`);
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
