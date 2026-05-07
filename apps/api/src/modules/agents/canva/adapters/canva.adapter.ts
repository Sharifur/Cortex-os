import { Injectable, Logger } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import * as crypto from 'crypto';
import { CanvaMcpService } from '../canva-mcp.service';
import { ApprovalFolderService } from '../approval-folder.service';
import { AuditLogService } from '../audit-log.service';
import { CanvaDebugService } from '../canva-debug.service';
import type { BackendAdapter, Candidate, GenerationTask } from './types';

@Injectable()
export class CanvaAdapter implements BackendAdapter {
  private readonly logger = new Logger(CanvaAdapter.name);
  private readonly openTxns = new Set<string>(); // transaction cleanup guard (T22)

  constructor(
    private readonly canvaMcp: CanvaMcpService,
    private readonly folder: ApprovalFolderService,
    private readonly audit: AuditLogService,
    private readonly debug: CanvaDebugService,
  ) {}

  async generate(task: GenerationTask): Promise<Candidate> {
    const t0 = Date.now();
    const candidateId = createId();
    const sessionId = task.brief.briefHash ? task.id.slice(0, 8) : task.id;

    await this.debug.log({
      sessionId: task.id,
      candidateId,
      step: 'canva_call',
      actor: 'CanvaAdapter',
      data: { skill: task.skill, intent: task.brief.intent, variant: task.variant },
      debugMode: false,
    });

    let designId: string | undefined;
    let txnId: string | undefined;

    try {
      // 1. Resolve brand kit
      let brandKitId: string | undefined = task.brief.brand.kitId;
      if (!brandKitId && task.brief.brand.name) {
        const kits = await this.canvaMcp.listBrandKits();
        const matched = kits.find((k) => k.name.toLowerCase().includes(task.brief.brand.name!.toLowerCase()));
        brandKitId = matched?.id;
      }

      // 2. Build rich brief payload for Canva MCP
      const b = task.brief;
      const briefPayload: Record<string, unknown> = {
        intent: b.intent,
        subject: b.subject,
        audience: b.audience,
        tone: b.tone,
        dimensions: b.dimensions,
        copy: b.copy,
        constraints: b.constraints,
        variant: task.variant,
        // Rich design directions passed directly to Canva
        ...(b.visualStyle          && { visualStyle: b.visualStyle }),
        ...(b.layoutDescription    && { layoutDescription: b.layoutDescription }),
        ...(b.elements?.length     && { elements: b.elements }),
        ...(b.colorDirections      && { colorDirections: b.colorDirections }),
        ...(b.typographySuggestions && { typographySuggestions: b.typographySuggestions }),
        ...(b.backgroundDescription && { backgroundDescription: b.backgroundDescription }),
        ...(b.compositionNotes     && { compositionNotes: b.compositionNotes }),
        ...(b.moodKeywords?.length && { moodKeywords: b.moodKeywords }),
        ...(b.platformContext      && { platformContext: b.platformContext }),
        ...(b.designDirections?.length && { designDirections: b.designDirections }),
        // Brand identity fields
        ...(b.brand.voiceProfile   && { brandVoice: b.brand.voiceProfile }),
        ...(b.brand.palette?.length && { brandPalette: b.brand.palette }),
        ...(b.brand.fonts?.length  && { brandFonts: b.brand.fonts }),
        // Category context
        ...(b.category && { contentCategory: b.category }),
      };

      const { designId: did } = await this.withRetry(() =>
        this.canvaMcp.generateDesignStructured(briefPayload, brandKitId),
      );
      designId = did;

      // 3. Editing transaction
      const { transactionId } = await this.canvaMcp.startEditingTransaction(designId);
      txnId = transactionId;
      this.openTxns.add(txnId);

      // Brand palette overlay — set colors if provided
      if (task.brief.brand.palette?.length) {
        await this.canvaMcp.performEditingOperations(txnId, [
          { type: 'set_palette', palette: task.brief.brand.palette },
        ]).catch(() => {}); // non-fatal — palette ops may not be supported by all templates
      }

      await this.canvaMcp.commitEditingTransaction(txnId);
      this.openTxns.delete(txnId);
      txnId = undefined;

      // 4. Export
      const formats = await this.canvaMcp.getExportFormats(designId);
      const fmt = formats.includes(task.brief.format) ? task.brief.format : 'png';
      const { url: exportUrl } = await this.withRetry(() =>
        this.canvaMcp.exportDesign(designId!, fmt),
      );

      // 5. Download to approval folder
      const bytes = await this.downloadBytes(exportUrl);
      const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');

      const candidate: Candidate = {
        id: candidateId,
        sessionId: task.id,
        backend: 'canva',
        tool: 'export-design',
        format: fmt as any,
        width: task.brief.dimensions.width,
        height: task.brief.dimensions.height,
        sizeBytes: bytes.length,
        sha256,
        costUsd: 0, // Canva MCP has no per-call token cost
        rationale: task.rationale,
        canvaDesignId: designId,
        canvaEditUrl: `https://www.canva.com/design/${designId}/edit`,
        iteration: 1,
        status: 'pending',
      };

      // 6. Save to approval folder
      const filePath = await this.folder.saveCandidate(task.id, candidate, bytes);
      candidate.filePath = filePath;

      // 7. Thumbnail
      try {
        const { url: thumbUrl } = await this.canvaMcp.getDesignThumbnail(designId);
        const thumbBytes = await this.downloadBytes(thumbUrl);
        candidate.thumbnailPath = await this.folder.saveThumbnail(task.id, candidateId, thumbBytes);
      } catch { /* non-fatal */ }

      await this.audit.append({
        sessionId: task.id,
        candidateId,
        actor: 'CanvaAdapter',
        action: 'canva.export-design',
        inputHash: this.audit.hash(briefPayload),
        outputHash: this.audit.hash({ sha256, sizeBytes: bytes.length }),
        latencyMs: Date.now() - t0,
        outcome: 'success',
      });

      return candidate;
    } catch (err) {
      // T22: Always cancel open transaction on error
      if (txnId) {
        await this.canvaMcp.cancelEditingTransaction(txnId);
        this.openTxns.delete(txnId);
      }

      await this.audit.append({
        sessionId: task.id,
        candidateId,
        actor: 'CanvaAdapter',
        action: 'canva.generate',
        latencyMs: Date.now() - t0,
        outcome: 'error',
        error: (err as Error).message,
      });

      return {
        id: candidateId,
        sessionId: task.id,
        backend: 'canva',
        tool: 'generate-design-structured',
        format: task.brief.format,
        costUsd: 0,
        rationale: task.rationale,
        iteration: 1,
        status: 'failed',
        error: (err as Error).message,
      };
    }
  }

  // T21: Exponential backoff retry (transient errors only)
  private async withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
    let lastErr: Error | undefined;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err as Error;
        const status = (err as any)?.status ?? (err as any)?.response?.status;
        const isTransient = !status || [429, 500, 502, 503, 504].includes(status);
        if (!isTransient || attempt === maxAttempts) throw err;
        const delay = Math.min(1000 * 2 ** (attempt - 1), 8000);
        this.logger.warn(`Retry ${attempt}/${maxAttempts} after ${delay}ms: ${(err as Error).message}`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw lastErr;
  }

  private async downloadBytes(url: string): Promise<Buffer> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed: ${res.status} ${url}`);
    return Buffer.from(await res.arrayBuffer());
  }

  // T22: Cancel all open transactions on shutdown
  async cleanupOpenTransactions(): Promise<void> {
    for (const txnId of this.openTxns) {
      await this.canvaMcp.cancelEditingTransaction(txnId);
    }
    this.openTxns.clear();
  }
}
