import { Injectable, Logger } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import { DbService } from '../../../db/db.service';
import { canvaSessions } from './schema';
import { ApprovalFolderService } from './approval-folder.service';
import { ApprovalManagerService } from './approval-manager.service';
import type { Candidate, DesignBrief, GenerationPlan } from './adapters/types';
import { CanvaAdapter } from './adapters/canva.adapter';
import { AIImageAdapter } from './adapters/ai-image.adapter';
import { LocalRenderAdapter } from './adapters/local-render.adapter';

// Hamming distance threshold for pHash dedup (lower = stricter)
const PHASH_THRESHOLD = 10;

@Injectable()
export class CandidateAggregatorService {
  private readonly logger = new Logger(CandidateAggregatorService.name);

  constructor(
    private readonly db: DbService,
    private readonly folder: ApprovalFolderService,
    private readonly approval: ApprovalManagerService,
    private readonly canvaAdapter: CanvaAdapter,
    private readonly aiImageAdapter: AIImageAdapter,
    private readonly localAdapter: LocalRenderAdapter,
  ) {}

  async run(plan: GenerationPlan, brief: DesignBrief, debugMode = false): Promise<{ sessionId: string; candidates: Candidate[] }> {
    // Create session in DB
    const sessionId = createId();
    await this.db.db.insert(canvaSessions).values({
      id: sessionId,
      brief: brief as any,
      status: 'active',
      approvalFolderPath: this.folder.sessionDir(sessionId),
    });

    // Ensure approval folder exists
    await this.folder.ensureSession(sessionId, brief);

    // Patch sessionId into all tasks (plan was built before session was created)
    const tasks = plan.tasks.map((t) => ({ ...t, id: sessionId }));

    // Dispatch up to 4 tasks in parallel (NFR-020)
    const results = await Promise.allSettled(
      tasks.map((task) => {
        switch (task.backend) {
          case 'canva':    return this.canvaAdapter.generate(task);
          case 'ai_image': return this.aiImageAdapter.generate(task);
          case 'local':    return this.localAdapter.generate(task);
        }
      }),
    );

    const candidates: Candidate[] = results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      this.logger.warn(`Task ${i} failed: ${(r.reason as Error).message}`);
      return {
        id: createId(),
        sessionId,
        backend: tasks[i].backend,
        tool: 'unknown',
        format: brief.format,
        costUsd: 0,
        rationale: tasks[i].rationale,
        iteration: 1,
        status: 'failed' as const,
        error: (r.reason as Error).message,
      };
    });

    // Dedup near-identical candidates via pHash
    const deduped = this.deduplicateByPhash(candidates);
    if (deduped.length < candidates.length) {
      this.logger.log(`pHash dedup: removed ${candidates.length - deduped.length} near-duplicate(s)`);
    }

    // Persist to Postgres
    await this.approval.persistCandidates(sessionId, deduped);

    return { sessionId, candidates: deduped };
  }

  private deduplicateByPhash(candidates: Candidate[]): Candidate[] {
    const unique: Candidate[] = [];
    for (const c of candidates) {
      if (!c.phash || c.status === 'failed') {
        unique.push(c);
        continue;
      }
      const isDup = unique.some(
        (u) => u.phash && this.hammingDistance(c.phash!, u.phash!) < PHASH_THRESHOLD,
      );
      if (!isDup) unique.push(c);
    }
    return unique;
  }

  private hammingDistance(a: string, b: string): number {
    let dist = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (a[i] !== b[i]) dist++;
    }
    return dist;
  }
}
