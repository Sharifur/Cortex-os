import { Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { TelegramService } from '../../telegram/telegram.service';
import { canvaCandidates, canvaSessions } from './schema';
import { ApprovalFolderService } from './approval-folder.service';
import type { Candidate } from './adapters/types';

export interface ApprovalSummary {
  sessionId: string;
  candidates: Candidate[];
  telegramText: string;
}

@Injectable()
export class ApprovalManagerService {
  private readonly logger = new Logger(ApprovalManagerService.name);

  constructor(
    private readonly db: DbService,
    private readonly telegram: TelegramService,
    private readonly folder: ApprovalFolderService,
  ) {}

  async persistCandidates(sessionId: string, candidates: Candidate[]): Promise<void> {
    for (const c of candidates) {
      await this.db.db.insert(canvaCandidates).values({
        id: c.id,
        sessionId,
        status: c.status,
        backend: c.backend,
        tool: c.tool ?? null,
        filePath: c.filePath ?? null,
        format: c.format,
        width: c.width ?? null,
        height: c.height ?? null,
        sizeBytes: c.sizeBytes ?? null,
        sha256: c.sha256 ?? null,
        phash: c.phash ?? null,
        parentCandidateId: c.parentCandidateId ?? null,
        iteration: c.iteration,
        costUsd: c.costUsd,
        rationale: c.rationale,
        canvaDesignId: c.canvaDesignId ?? null,
        canvaEditUrl: c.canvaEditUrl ?? null,
        thumbnailPath: c.thumbnailPath ?? null,
        metadata: c as any,
      }).onConflictDoNothing();
    }

    // Update session total cost
    const totalCost = candidates.reduce((sum, c) => sum + c.costUsd, 0);
    await this.db.db.update(canvaSessions)
      .set({ totalCostUsd: totalCost })
      .where(eq(canvaSessions.id, sessionId));
  }

  buildTelegramText(sessionId: string, candidates: Candidate[]): string {
    const lines: string[] = [
      `Design candidates ready — session ${sessionId.slice(0, 8)}`,
      '',
    ];

    candidates.forEach((c, i) => {
      const num = i + 1;
      const backend = c.backend === 'canva' ? 'Canva MCP' : c.backend === 'ai_image' ? 'AI Image' : 'Local Render';
      const dims = c.width && c.height ? `${c.width}x${c.height}` : 'unknown dims';
      const statusLine = c.status === 'failed' ? 'FAILED' : `${dims} ${c.format?.toUpperCase() ?? 'PNG'}`;

      lines.push(`${num}. [${backend}] ${statusLine}`);
      if (c.rationale) lines.push(`   ${c.rationale}`);
      if (c.canvaEditUrl) lines.push(`   Edit: ${c.canvaEditUrl}`);
      if (c.filePath) lines.push(`   File: ${this.folder.computerLink(c.filePath)}`);
      if (c.costUsd > 0) lines.push(`   Cost: $${c.costUsd.toFixed(4)}`);
    });

    lines.push('');
    lines.push('Reply with: approve <numbers> | reject <numbers> | revise <number> <feedback>');
    lines.push('Example: approve 1 2  /  revise 3 make the headline bigger');

    return lines.join('\n');
  }

  async sendApprovalMessage(sessionId: string, candidates: Candidate[]): Promise<void> {
    const text = this.buildTelegramText(sessionId, candidates);
    await this.telegram.sendMessage(text);
  }

  async approve(sessionId: string, candidateId: string): Promise<void> {
    await this.db.db.update(canvaCandidates)
      .set({ status: 'approved' })
      .where(eq(canvaCandidates.id, candidateId));
    await this.folder.updateStatus(sessionId, candidateId, 'approved');
    this.logger.log(`Candidate ${candidateId} approved`);
  }

  async reject(sessionId: string, candidateId: string): Promise<void> {
    await this.db.db.update(canvaCandidates)
      .set({ status: 'rejected' })
      .where(eq(canvaCandidates.id, candidateId));
    await this.folder.updateStatus(sessionId, candidateId, 'rejected');
    this.logger.log(`Candidate ${candidateId} rejected`);
  }

  async revise(sessionId: string, candidateId: string, feedback: string): Promise<void> {
    await this.db.db.update(canvaCandidates)
      .set({ status: 'revised', feedback })
      .where(eq(canvaCandidates.id, candidateId));
    this.logger.log(`Candidate ${candidateId} marked for revision: ${feedback.slice(0, 80)}`);
  }

  async listSessionCandidates(sessionId: string): Promise<typeof canvaCandidates.$inferSelect[]> {
    return this.db.db.select().from(canvaCandidates).where(eq(canvaCandidates.sessionId, sessionId));
  }
}
