import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { knowledgeEntries } from '../../db/schema';
import { KnowledgeBaseService } from './knowledge-base.service';
import * as cheerio from 'cheerio';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const CHUNK_MAX_CHARS = 1500;

@Injectable()
export class KnowledgeBaseIngestionService {
  constructor(
    private readonly db: DbService,
    private readonly kb: KnowledgeBaseService,
  ) {}

  async ingestFile(
    file: Buffer,
    filename: string,
    mimeType: string,
    dto: { agentKeys?: string; category?: string },
  ) {
    if (file.length > MAX_FILE_BYTES) {
      throw new BadRequestException('File exceeds 10MB limit');
    }

    const ext = filename.split('.').pop()?.toLowerCase();
    let text = '';

    try {
      if (ext === 'pdf' || mimeType === 'application/pdf') {
        text = await this.extractPdf(file);
      } else if (
        ext === 'docx' ||
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        ext === 'doc' ||
        mimeType === 'application/msword'
      ) {
        text = await this.extractDocx(file);
      } else if (ext === 'md' || mimeType === 'text/markdown' || mimeType === 'text/plain') {
        text = file.toString('utf-8');
      } else {
        throw new BadRequestException(`Unsupported file type: ${ext ?? mimeType}`);
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(`Failed to read file: ${(err as Error).message}`);
    }

    text = text.trim();
    if (text.length < 50) {
      throw new BadRequestException(
        'Could not extract text — file may be scanned, password-protected, or empty',
      );
    }

    const sourceType = ext === 'pdf' ? 'pdf' : ext === 'docx' || ext === 'doc' ? 'docx' : 'md';
    const chunks = chunkText(text, CHUNK_MAX_CHARS);
    const baseTitle = filename.replace(/\.[^.]+$/, '');

    // Parent entry (summary)
    const parent = await this.kb.createEntry({
      title: baseTitle,
      content: text.slice(0, 200) + (text.length > 200 ? '…' : ''),
      category: dto.category ?? 'document',
      entryType: 'reference',
      agentKeys: dto.agentKeys,
      sourceType,
    });

    // Chunk entries
    for (let i = 0; i < chunks.length; i++) {
      await this.kb.createEntry({
        title: `${baseTitle} [part ${i + 1}]`,
        content: chunks[i],
        category: dto.category ?? 'document',
        entryType: 'reference',
        agentKeys: dto.agentKeys,
        sourceType,
        parentDocId: parent.id,
      });
    }

    return { parentId: parent.id, chunks: chunks.length, totalChars: text.length };
  }

  async ingestLink(url: string, dto: { agentKeys?: string; category?: string }) {
    if (!/^https?:\/\//i.test(url)) {
      throw new BadRequestException('URL must start with http:// or https://');
    }

    // Duplicate check
    const existing = await this.db.db
      .select({ id: knowledgeEntries.id })
      .from(knowledgeEntries)
      .where(eq(knowledgeEntries.sourceUrl, url))
      .limit(1);
    if (existing.length) {
      throw new ConflictException(
        'This URL was already imported. Delete the existing entry first.',
      );
    }

    let responseData: Buffer;
    let contentType = '';

    try {
      const axios = (await import('axios')).default;
      const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 12_000,
        maxContentLength: 2 * 1024 * 1024,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CortexBot/1.0)' },
      });
      responseData = Buffer.from(res.data);
      contentType = (res.headers['content-type'] as string) ?? '';
    } catch (err: any) {
      const msg = err?.response
        ? `Server returned ${err.response.status}`
        : err?.code === 'ECONNABORTED'
        ? 'Request timed out — page took too long to respond'
        : `Could not fetch URL: ${err?.message}`;
      throw new BadRequestException(msg);
    }

    // If server returns a PDF, delegate to file ingestion
    if (contentType.includes('application/pdf')) {
      const hostname = new URL(url).hostname;
      const result = await this.ingestFile(responseData, `${hostname}.pdf`, 'application/pdf', dto);
      // Update parent's sourceUrl
      await this.db.db
        .update(knowledgeEntries)
        .set({ sourceUrl: url })
        .where(eq(knowledgeEntries.id, result.parentId));
      return result;
    }

    // Parse HTML
    const html = responseData.toString('utf-8');
    const $ = cheerio.load(html);
    $('script, style, nav, footer, header, aside, noscript').remove();

    let text =
      $('article').text() ||
      $('main').text() ||
      $('[role="main"]').text() ||
      $('body').text();

    text = text.replace(/\s+/g, ' ').trim();

    if (text.length < 100) {
      throw new BadRequestException(
        'Page appears JS-rendered or empty — try copy-pasting the content manually',
      );
    }

    const pageTitle = $('title').text().trim() || new URL(url).hostname;
    const chunks = chunkText(text, CHUNK_MAX_CHARS);

    const parent = await this.kb.createEntry({
      title: pageTitle,
      content: text.slice(0, 200) + (text.length > 200 ? '…' : ''),
      category: dto.category ?? 'webpage',
      entryType: 'reference',
      agentKeys: dto.agentKeys,
      sourceType: 'link',
      sourceUrl: url,
    });

    for (let i = 0; i < chunks.length; i++) {
      await this.kb.createEntry({
        title: `${pageTitle} [part ${i + 1}]`,
        content: chunks[i],
        category: dto.category ?? 'webpage',
        entryType: 'reference',
        agentKeys: dto.agentKeys,
        sourceType: 'link',
        sourceUrl: url,
        parentDocId: parent.id,
      });
    }

    return { parentId: parent.id, chunks: chunks.length, totalChars: text.length, title: pageTitle };
  }

  // ─── Private extractors ────────────────────────────────────────────────────

  private async extractPdf(buf: Buffer): Promise<string> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;
      const data = await pdfParse(buf);
      return data.text ?? '';
    } catch (err) {
      throw new BadRequestException(`PDF extraction failed: ${(err as Error).message}`);
    }
  }

  private async extractDocx(buf: Buffer): Promise<string> {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer: buf });
      return result.value ?? '';
    } catch (err) {
      throw new BadRequestException(`DOCX extraction failed — file may be password-protected`);
    }
  }
}

// ─── Chunking ──────────────────────────────────────────────────────────────

function chunkText(text: string, maxChars: number): string[] {
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 30);
  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    if (current.length + para.length + 2 <= maxChars) {
      current = current ? current + '\n\n' + para : para;
    } else {
      if (current) chunks.push(current.trim());
      // Para itself might exceed maxChars — split on sentences
      if (para.length > maxChars) {
        const sentences = para.split(/(?<=\. )/);
        current = '';
        for (const sent of sentences) {
          if (current.length + sent.length <= maxChars) {
            current += sent;
          } else {
            if (current) chunks.push(current.trim());
            current = sent;
          }
        }
      } else {
        current = para;
      }
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(c => c.length >= 30);
}
