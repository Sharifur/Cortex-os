import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { eq, and } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { pendingApprovals, agentRuns, agents } from '../../../db/schema';
import { AgentRegistryService } from './agent-registry.service';
import { AgentLogService } from './agent-log.service';
import { QUEUE_NAMES } from '../../../common/queue/queue.constants';
import type { AgentExecuteJobData, AgentFollowupJobData, ProposedAction } from './types';

const APPROVAL_TTL_MS = 24 * 60 * 60 * 1000; // 24h

@Injectable()
export class ApprovalService {
  constructor(
    private db: DbService,
    private registry: AgentRegistryService,
    private logSvc: AgentLogService,
    private events: EventEmitter2,
    @InjectQueue(QUEUE_NAMES.AGENT_EXECUTE) private executeQueue: Queue,
    @InjectQueue(QUEUE_NAMES.AGENT_FOLLOWUP) private followupQueue: Queue,
  ) {}

  async createApproval(runId: string, action: ProposedAction) {
    const expiresAt = new Date(Date.now() + APPROVAL_TTL_MS);
    const [approval] = await this.db.db
      .insert(pendingApprovals)
      .values({ runId, action, status: 'PENDING', expiresAt })
      .returning();

    const enriched = await this.getEnrichedApproval(approval.id);
    if (enriched) this.events.emit('approval.created', enriched);

    return approval;
  }

  async getPending() {
    return this.db.db
      .select({
        id: pendingApprovals.id,
        runId: pendingApprovals.runId,
        agentKey: agents.key,
        agentName: agents.name,
        runStatus: agentRuns.status,
        action: pendingApprovals.action,
        status: pendingApprovals.status,
        followupMessages: pendingApprovals.followupMessages,
        createdAt: pendingApprovals.createdAt,
        resolvedAt: pendingApprovals.resolvedAt,
        expiresAt: pendingApprovals.expiresAt,
      })
      .from(pendingApprovals)
      .innerJoin(agentRuns, eq(pendingApprovals.runId, agentRuns.id))
      .innerJoin(agents, eq(agentRuns.agentId, agents.id))
      .where(eq(pendingApprovals.status, 'PENDING'));
  }

  async getById(id: string) {
    const [approval] = await this.db.db
      .select()
      .from(pendingApprovals)
      .where(eq(pendingApprovals.id, id));
    return approval ?? null;
  }

  async approve(approvalId: string) {
    const approval = await this.getById(approvalId);
    if (!approval) throw new NotFoundException(`Approval not found: ${approvalId}`);
    if (approval.status !== 'PENDING' && approval.status !== 'FOLLOWUP') {
      throw new Error(`Approval already resolved: ${approval.status}`);
    }

    await this.db.db
      .update(pendingApprovals)
      .set({ status: 'APPROVED', resolvedAt: new Date() })
      .where(eq(pendingApprovals.id, approvalId));

    const run = await this.getRunForApproval(approval.runId);
    await this.db.db
      .update(agentRuns)
      .set({ status: 'APPROVED' })
      .where(eq(agentRuns.id, approval.runId));

    await this.logSvc.info(approval.runId, `Approval ${approvalId} approved`);
    this.events.emit('approval.removed', { id: approvalId });

    await this.executeQueue.add(
      'execute',
      {
        agentKey: run.agentKey,
        runId: approval.runId,
        approvalId,
        action: approval.action as ProposedAction,
      } satisfies AgentExecuteJobData,
      { attempts: 3, backoff: { type: 'exponential', delay: 60_000 } },
    );
  }

  async reject(approvalId: string) {
    return this.rejectWithReason(approvalId, null);
  }

  async rejectWithReason(approvalId: string, reason: string | null) {
    const approval = await this.getById(approvalId);
    if (!approval) throw new NotFoundException(`Approval not found: ${approvalId}`);

    await this.db.db
      .update(pendingApprovals)
      .set({ status: 'REJECTED', resolvedAt: new Date(), rejectionReason: reason })
      .where(eq(pendingApprovals.id, approvalId));

    await this.db.db
      .update(agentRuns)
      .set({ status: 'REJECTED', finishedAt: new Date() })
      .where(eq(agentRuns.id, approval.runId));

    await this.logSvc.info(
      approval.runId,
      `Approval ${approvalId} rejected${reason ? `: "${reason}"` : ''}`,
    );
    this.events.emit('approval.removed', { id: approvalId });

    if (reason?.trim()) {
      const [runRow] = await this.db.db
        .select({ agentKey: agents.key, agentName: agents.name })
        .from(agentRuns)
        .innerJoin(agents, eq(agentRuns.agentId, agents.id))
        .where(eq(agentRuns.id, approval.runId));

      if (runRow) {
        const action = approval.action as { payload?: { draft?: string; comment?: string }; summary?: string };
        const draft = action?.payload?.draft ?? action?.payload?.comment ?? action?.summary ?? '';
        if (draft) {
          this.events.emit('kb.rejection', {
            agentKey: runRow.agentKey,
            agentName: runRow.agentName,
            draft,
            reason,
          });
        }
      }
    }
  }

  async followup(approvalId: string, instruction: string) {
    const approval = await this.getById(approvalId);
    if (!approval) throw new NotFoundException(`Approval not found: ${approvalId}`);

    const existing = (approval.followupMessages as Array<unknown>) ?? [];
    const newEntry = { from: 'owner', text: instruction, at: new Date().toISOString() };
    const followupMessages = [...existing, newEntry];

    await this.db.db
      .update(pendingApprovals)
      .set({ status: 'FOLLOWUP', followupMessages })
      .where(eq(pendingApprovals.id, approvalId));

    // Append followup to run context
    const [run] = await this.db.db
      .select()
      .from(agentRuns)
      .where(eq(agentRuns.id, approval.runId));

    const ctx = (run.context as { followups?: Array<unknown> }) ?? { followups: [] };
    const followups = [...(ctx.followups ?? []), { at: new Date().toISOString(), text: instruction }];

    await this.db.db
      .update(agentRuns)
      .set({ status: 'FOLLOWUP', context: { ...ctx, followups } })
      .where(eq(agentRuns.id, approval.runId));

    await this.logSvc.info(approval.runId, `Follow-up received: "${instruction}"`);
    this.events.emit('approval.removed', { id: approvalId });

    const runWithAgent = await this.getRunForApproval(approval.runId);
    await this.followupQueue.add(
      'followup',
      {
        agentKey: runWithAgent.agentKey,
        runId: approval.runId,
      } satisfies AgentFollowupJobData,
      { attempts: 3, backoff: { type: 'exponential', delay: 60_000 } },
    );
  }

  async sweepExpired() {
    const now = new Date();
    const expired = await this.db.db
      .select()
      .from(pendingApprovals)
      .where(and(eq(pendingApprovals.status, 'PENDING')));

    const toExpire = expired.filter((a) => a.expiresAt <= now);

    for (const approval of toExpire) {
      await this.db.db
        .update(pendingApprovals)
        .set({ status: 'EXPIRED', resolvedAt: now })
        .where(eq(pendingApprovals.id, approval.id));

      await this.db.db
        .update(agentRuns)
        .set({ status: 'FAILED', error: 'Approval expired', finishedAt: now })
        .where(eq(agentRuns.id, approval.runId));

      await this.logSvc.error(approval.runId, `Approval ${approval.id} expired`);
      this.events.emit('approval.removed', { id: approval.id });
    }

    return toExpire.length;
  }

  private async getEnrichedApproval(approvalId: string) {
    const [row] = await this.db.db
      .select({
        id: pendingApprovals.id,
        runId: pendingApprovals.runId,
        agentKey: agents.key,
        agentName: agents.name,
        runStatus: agentRuns.status,
        action: pendingApprovals.action,
        status: pendingApprovals.status,
        followupMessages: pendingApprovals.followupMessages,
        createdAt: pendingApprovals.createdAt,
        resolvedAt: pendingApprovals.resolvedAt,
        expiresAt: pendingApprovals.expiresAt,
      })
      .from(pendingApprovals)
      .innerJoin(agentRuns, eq(pendingApprovals.runId, agentRuns.id))
      .innerJoin(agents, eq(agentRuns.agentId, agents.id))
      .where(eq(pendingApprovals.id, approvalId));
    return row ?? null;
  }

  private async getRunForApproval(runId: string) {
    const [row] = await this.db.db
      .select({ run: agentRuns, agentKey: agents.key })
      .from(agentRuns)
      .innerJoin(agents, eq(agentRuns.agentId, agents.id))
      .where(eq(agentRuns.id, runId));

    if (!row) throw new NotFoundException(`Run not found: ${runId}`);
    return { ...row.run, agentKey: row.agentKey };
  }
}
