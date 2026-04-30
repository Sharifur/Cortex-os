import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { eq, inArray, desc } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { livechatAttachments } from './schema';
import { StorageService } from '../../storage/storage.service';

export interface AttachmentRow {
  id: string;
  sessionId: string;
  messageId: string | null;
  uploaderRole: 'visitor' | 'operator';
  uploaderId: string | null;
  mimeType: string;
  sizeBytes: number;
  originalFilename: string;
  url: string;
  createdAt: Date;
}

@Injectable()
export class LivechatAttachmentsService {
  constructor(private db: DbService, private storage: StorageService) {}

  async upload(input: {
    siteKey: string;
    sessionId: string;
    uploaderRole: 'visitor' | 'operator';
    uploaderId: string | null;
    body: Buffer;
    mimeType: string;
    originalFilename: string;
  }): Promise<AttachmentRow> {
    const stored = await this.storage.upload({
      module: 'livechat',
      refKey: `${input.siteKey}/${input.sessionId}`,
      body: input.body,
      declaredMime: input.mimeType,
      originalFilename: input.originalFilename,
    });

    const [row] = await this.db.db
      .insert(livechatAttachments)
      .values({
        sessionId: input.sessionId,
        uploaderRole: input.uploaderRole,
        uploaderId: input.uploaderId,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
        r2Key: stored.key,
        originalFilename: stored.originalFilename,
      })
      .returning();

    return this.toRow(row, stored.url);
  }

  async linkToMessage(attachmentIds: string[], messageId: string, expectedSessionId: string): Promise<void> {
    if (!attachmentIds.length) return;
    const existing = await this.db.db
      .select({ id: livechatAttachments.id, sessionId: livechatAttachments.sessionId, messageId: livechatAttachments.messageId })
      .from(livechatAttachments)
      .where(inArray(livechatAttachments.id, attachmentIds));
    for (const a of existing) {
      if (a.sessionId !== expectedSessionId) {
        throw new BadRequestException(`Attachment ${a.id} does not belong to session ${expectedSessionId}`);
      }
      if (a.messageId && a.messageId !== messageId) {
        throw new BadRequestException(`Attachment ${a.id} already linked to a different message`);
      }
    }
    await this.db.db
      .update(livechatAttachments)
      .set({ messageId })
      .where(inArray(livechatAttachments.id, attachmentIds));
  }

  async getById(id: string): Promise<AttachmentRow> {
    const [row] = await this.db.db.select().from(livechatAttachments).where(eq(livechatAttachments.id, id)).limit(1);
    if (!row) throw new NotFoundException(`Attachment not found: ${id}`);
    return this.toRow(row, await this.storage.urlFor(row.r2Key));
  }

  async getForMessages(messageIds: string[]): Promise<Map<string, AttachmentRow[]>> {
    const map = new Map<string, AttachmentRow[]>();
    if (!messageIds.length) return map;
    const rows = await this.db.db
      .select()
      .from(livechatAttachments)
      .where(inArray(livechatAttachments.messageId, messageIds))
      .orderBy(desc(livechatAttachments.createdAt));
    for (const r of rows) {
      if (!r.messageId) continue;
      const url = await this.storage.urlFor(r.r2Key);
      const list = map.get(r.messageId) ?? [];
      list.push(this.toRow(r, url));
      map.set(r.messageId, list);
    }
    return map;
  }

  private toRow(r: typeof livechatAttachments.$inferSelect, url: string): AttachmentRow {
    return {
      id: r.id,
      sessionId: r.sessionId,
      messageId: r.messageId,
      uploaderRole: r.uploaderRole as 'visitor' | 'operator',
      uploaderId: r.uploaderId,
      mimeType: r.mimeType,
      sizeBytes: r.sizeBytes,
      originalFilename: r.originalFilename,
      url,
      createdAt: r.createdAt,
    };
  }
}
