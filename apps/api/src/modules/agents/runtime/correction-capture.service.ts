import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '../../../db/db.service';
import { correctionSignals } from '../../../db/schema';
import { createId } from '@paralleldrive/cuid2';
import type { ProposedAction } from './types';

export interface ApprovalSignalEvent {
  approvalId: string;
  runId: string;
  agentKey: string;
  action: ProposedAction;
  createdAt: Date;
  followupMessages?: Array<{ from: string; text: string; at: string }>;
  rejectionReason?: string | null;
  instruction?: string;
}

@Injectable()
export class CorrectionCaptureService {
  private readonly logger = new Logger(CorrectionCaptureService.name);

  constructor(private readonly db: DbService) {}

  async onApproved(event: ApprovalSignalEvent) {
    await this.save({
      agentKey: event.agentKey,
      runId: event.runId,
      approvalId: event.approvalId,
      signalType: 'approved',
      latencyMs: Date.now() - new Date(event.createdAt).getTime(),
      followupCount: (event.followupMessages ?? []).length,
      draftText: this.extractDraft(event.action),
      actionType: event.action.type,
    });
  }

  async onRejected(event: ApprovalSignalEvent) {
    await this.save({
      agentKey: event.agentKey,
      runId: event.runId,
      approvalId: event.approvalId,
      signalType: 'rejected',
      latencyMs: Date.now() - new Date(event.createdAt).getTime(),
      followupCount: (event.followupMessages ?? []).length,
      draftText: this.extractDraft(event.action),
      rejectionReason: event.rejectionReason ?? null,
      actionType: event.action.type,
    });
  }

  async onFollowup(event: ApprovalSignalEvent) {
    await this.save({
      agentKey: event.agentKey,
      runId: event.runId,
      approvalId: event.approvalId,
      signalType: 'followup',
      latencyMs: Date.now() - new Date(event.createdAt).getTime(),
      followupCount: (event.followupMessages ?? []).length,
      draftText: this.extractDraft(event.action),
      correctionText: event.instruction ?? null,
      actionType: event.action.type,
    });
  }

  async captureSimulateRating(agentKey: string, rating: 'good' | 'bad', message: string, response: string) {
    await this.save({
      agentKey,
      signalType: 'simulate_rated',
      draftText: response,
      correctionText: message,
      rating,
    });
  }

  private async save(params: {
    agentKey: string;
    runId?: string | null;
    approvalId?: string | null;
    signalType: string;
    latencyMs?: number | null;
    followupCount?: number;
    draftText?: string | null;
    correctionText?: string | null;
    rejectionReason?: string | null;
    rating?: string | null;
    actionType?: string | null;
    payload?: unknown;
  }) {
    try {
      await this.db.db.insert(correctionSignals).values({
        id: createId(),
        agentKey: params.agentKey,
        runId: params.runId ?? null,
        approvalId: params.approvalId ?? null,
        signalType: params.signalType,
        latencyMs: params.latencyMs ?? null,
        followupCount: params.followupCount ?? 0,
        draftText: params.draftText ?? null,
        correctionText: params.correctionText ?? null,
        rejectionReason: params.rejectionReason ?? null,
        rating: params.rating ?? null,
        actionType: params.actionType ?? null,
        payload: params.payload ?? null,
      });
    } catch (err) {
      this.logger.error(`Failed to capture correction signal: ${(err as Error).message}`);
    }
  }

  private extractDraft(action: ProposedAction): string {
    const p = action.payload as { draft?: string; body?: string; comment?: string } | null;
    return (p?.draft ?? p?.body ?? p?.comment ?? action.summary ?? '').slice(0, 2000);
  }
}
