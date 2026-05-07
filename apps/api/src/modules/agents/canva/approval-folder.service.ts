import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type { Candidate, DesignBrief } from './adapters/types';

export interface SessionManifest {
  sessionId: string;
  createdAt: string;
  brief: DesignBrief;
  candidates: ManifestEntry[];
}

export interface ManifestEntry {
  id: string;
  status: string;
  backend: string;
  file: string;
  metadata: string;
  parentCandidateId: string | null;
  canvaEditUrl?: string;
}

const DEFAULT_APPROVAL_ROOT = path.join(os.homedir(), 'Designs', 'AI-Agent', 'Approvals');

@Injectable()
export class ApprovalFolderService {
  private readonly logger = new Logger(ApprovalFolderService.name);

  approvalRoot(): string {
    return process.env.CANVA_APPROVAL_FOLDER ?? DEFAULT_APPROVAL_ROOT;
  }

  sessionDir(sessionId: string): string {
    return path.join(this.approvalRoot(), sessionId);
  }

  async ensureSession(sessionId: string, brief: DesignBrief): Promise<string> {
    const dir = this.sessionDir(sessionId);
    await fs.mkdir(path.join(dir, 'pending'), { recursive: true });
    await fs.mkdir(path.join(dir, 'approved'), { recursive: true });
    await fs.mkdir(path.join(dir, 'rejected'), { recursive: true });

    const manifestPath = path.join(dir, 'manifest.json');
    try {
      await fs.access(manifestPath);
    } catch {
      const manifest: SessionManifest = {
        sessionId,
        createdAt: new Date().toISOString(),
        brief,
        candidates: [],
      };
      await this.atomicWrite(manifestPath, JSON.stringify(manifest, null, 2));
    }
    return dir;
  }

  async saveCandidate(sessionId: string, candidate: Candidate, imageBytes: Buffer): Promise<string> {
    const dir = this.sessionDir(sessionId);
    const ext = candidate.format ?? 'png';
    const filename = `${candidate.id}.${ext}`;
    const filePath = path.join(dir, 'pending', filename);

    await this.atomicWrite(filePath, imageBytes);

    const sidecar = {
      ...candidate,
      savedAt: new Date().toISOString(),
    };
    await this.atomicWrite(
      path.join(dir, 'pending', `${candidate.id}.json`),
      JSON.stringify(sidecar, null, 2),
    );

    await this.addToManifest(sessionId, {
      id: candidate.id,
      status: 'pending',
      backend: candidate.backend,
      file: `pending/${filename}`,
      metadata: `pending/${candidate.id}.json`,
      parentCandidateId: candidate.parentCandidateId ?? null,
      canvaEditUrl: candidate.canvaEditUrl,
    });

    return filePath;
  }

  async saveThumbnail(sessionId: string, candidateId: string, bytes: Buffer): Promise<string> {
    const p = path.join(this.sessionDir(sessionId), 'pending', `${candidateId}_thumb.png`);
    await this.atomicWrite(p, bytes);
    return p;
  }

  async updateStatus(sessionId: string, candidateId: string, status: 'approved' | 'rejected'): Promise<void> {
    const dir = this.sessionDir(sessionId);
    const manifest = await this.readManifest(sessionId);
    const entry = manifest.candidates.find((c) => c.id === candidateId);
    if (!entry) return;

    const ext = path.extname(entry.file);
    const srcFile = path.join(dir, entry.file);
    const dstFile = path.join(dir, status, path.basename(entry.file));

    try {
      await fs.rename(srcFile, dstFile);
      const srcMeta = path.join(dir, entry.metadata);
      const dstMeta = path.join(dir, status, path.basename(entry.metadata));
      await fs.rename(srcMeta, dstMeta);
    } catch (err) {
      this.logger.warn(`moveFile failed for ${candidateId}: ${(err as Error).message}`);
    }

    entry.file = `${status}/${path.basename(entry.file)}`;
    entry.metadata = `${status}/${path.basename(entry.metadata)}`;
    entry.status = status;
    await this.writeManifest(sessionId, manifest);
  }

  async readManifest(sessionId: string): Promise<SessionManifest> {
    const raw = await fs.readFile(path.join(this.sessionDir(sessionId), 'manifest.json'), 'utf-8');
    return JSON.parse(raw);
  }

  private async addToManifest(sessionId: string, entry: ManifestEntry): Promise<void> {
    const manifest = await this.readManifest(sessionId);
    const existing = manifest.candidates.findIndex((c) => c.id === entry.id);
    if (existing >= 0) {
      manifest.candidates[existing] = entry;
    } else {
      manifest.candidates.push(entry);
    }
    await this.writeManifest(sessionId, manifest);
  }

  private async writeManifest(sessionId: string, manifest: SessionManifest): Promise<void> {
    const p = path.join(this.sessionDir(sessionId), 'manifest.json');
    await this.atomicWrite(p, JSON.stringify(manifest, null, 2));
  }

  // Atomic: write to .tmp then rename — prevents corrupt manifest on crash
  private async atomicWrite(filePath: string, data: Buffer | string): Promise<void> {
    const tmp = `${filePath}.tmp`;
    await fs.writeFile(tmp, data);
    await fs.rename(tmp, filePath);
  }

  computerLink(filePath: string): string {
    return `file://${filePath}`;
  }
}
