import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { ApprovalFolderService } from './approval-folder.service';

export interface AuditEntry {
  timestamp: string;
  sessionId: string;
  candidateId?: string;
  actor: string;
  action: string;
  inputHash?: string;
  outputHash?: string;
  latencyMs?: number;
  outcome: 'success' | 'error';
  error?: string;
  prevHash?: string;  // chained hash for tamper-evidence
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);
  // last hash per session for chain
  private chainHeads = new Map<string, string>();

  constructor(private readonly folder: ApprovalFolderService) {}

  async append(entry: Omit<AuditEntry, 'timestamp' | 'prevHash'>): Promise<void> {
    const prevHash = this.chainHeads.get(entry.sessionId) ?? '0000000000000000';
    const full: AuditEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
      prevHash,
    };

    const line = JSON.stringify(full) + '\n';
    const newHash = crypto.createHash('sha256').update(prevHash + line).digest('hex').slice(0, 16);
    this.chainHeads.set(entry.sessionId, newHash);

    try {
      const auditPath = path.join(this.folder.sessionDir(entry.sessionId), 'audit.jsonl');
      await fs.appendFile(auditPath, line);
    } catch (err) {
      this.logger.warn(`audit log write failed: ${(err as Error).message}`);
    }
  }

  hash(data: unknown): string {
    return 'sha256:' + crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex').slice(0, 16);
  }
}
