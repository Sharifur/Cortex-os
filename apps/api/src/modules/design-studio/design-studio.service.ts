import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { eq, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import OpenAI from 'openai';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { DbService } from '../../db/db.service';
import { LlmRouterService } from '../llm/llm-router.service';
import { SettingsService } from '../settings/settings.service';
import { QUEUE_NAMES } from '../../common/queue/queue.constants';
import { designStudioTemplates, designStudioJobs } from './schema';
import type { DesignStudioJobData } from './design-studio.processor';
import type { DesignDNA } from './design-studio.processor';

const DNA_RENDERS_DIR = path.join(os.homedir(), 'Designs', 'AI-Agent', 'DnaRenders');

type ImageSize = '1024x1024' | '1024x1536' | '1536x1024';

function snapImageSize(dna: DesignDNA): ImageSize {
  if (dna.orientation === 'portrait') return '1024x1536';
  if (dna.orientation === 'landscape') return '1536x1024';
  return '1024x1024';
}

@Injectable()
export class DesignStudioService {
  private readonly logger = new Logger(DesignStudioService.name);

  constructor(
    private readonly db: DbService,
    private readonly llm: LlmRouterService,
    private readonly settings: SettingsService,
    @InjectQueue(QUEUE_NAMES.DESIGN_STUDIO) private readonly queue: Queue,
  ) {}

  // ─── Batch import ────────────────────────────────────────────────────────────

  async importBatch(items: Array<{ name: string; imageBase64: string; mimeType?: string }>) {
    const jobs: Array<typeof designStudioJobs.$inferSelect> = [];

    for (const item of items) {
      const jobId = createId();
      const mimeType = item.mimeType ?? 'image/png';

      const [row] = await this.db.db
        .insert(designStudioJobs)
        .values({
          id: jobId,
          name: item.name,
          status: 'pending',
          previewData: `data:${mimeType};base64,${item.imageBase64}`,
        })
        .returning();

      const jobData: DesignStudioJobData = {
        jobId,
        name: item.name,
        imageBase64: item.imageBase64,
        mimeType,
      };

      await this.queue.add('analyze', jobData, {
        jobId: `ds-${jobId}`,
        attempts: 2,
        backoff: { type: 'fixed', delay: 5000 },
      });

      jobs.push(row);
    }

    return jobs;
  }

  // ─── Jobs ────────────────────────────────────────────────────────────────────

  async listJobs() {
    return this.db.db
      .select()
      .from(designStudioJobs)
      .orderBy(sql`created_at DESC`)
      .limit(50);
  }

  // ─── Generate ────────────────────────────────────────────────────────────────

  async generate(id: string, userPrompt: string): Promise<Buffer> {
    const [template] = await this.db.db
      .select()
      .from(designStudioTemplates)
      .where(eq(designStudioTemplates.id, id))
      .limit(1);

    if (!template) throw new NotFoundException(`Template ${id} not found`);

    const dna = template.spec as unknown as DesignDNA;

    if (!dna?.stylePrompt) {
      throw new Error('This template was created with the old Satori renderer. Delete it and re-upload the image to extract a DesignDNA.');
    }

    // Content must lead the prompt so gpt-image-1 treats it as the primary directive.
    // Style description is secondary — if style leads, the model regenerates the original
    // training slide's content and ignores the user's headline entirely.
    const parts = userPrompt.split(' | ');
    const headline = (parts[0] ?? '').trim();
    const bodyText = parts.slice(1).join(' | ').trim();

    const dallePrompt = [
      'Create a single social media carousel slide image.',
      '',
      'REQUIRED CONTENT — render this text exactly as written, no substitutions:',
      `Headline: ${headline}`,
      bodyText ? `Body: ${bodyText}` : '',
      '',
      'VISUAL STYLE — apply this design treatment to the content above (do not copy text from this description):',
      dna.stylePrompt,
      '',
      `Critical: the slide must show only the headline${bodyText ? ' and body' : ''} specified above. Do not add, invent, or replace any text.`,
    ].filter(Boolean).join('\n');

    const apiKey = await this.settings.getDecrypted('openai_api_key');
    if (!apiKey) throw new Error('openai_api_key not configured in Settings');

    const client = new OpenAI({ apiKey });
    const size = snapImageSize(dna);

    this.logger.log(`Generating with gpt-image-1: size=${size} template=${id}`);

    const res = await client.images.generate({
      model: 'gpt-image-1',
      prompt: dallePrompt.slice(0, 4000),
      size,
      quality: 'medium',
      n: 1,
    } as any);

    const b64 = res.data?.[0]?.b64_json;
    if (!b64) throw new Error('DALL-E 3 returned no image data');

    return Buffer.from(b64, 'base64');
  }

  // ─── Generate + save ─────────────────────────────────────────────────────────

  async generateAndSave(id: string, userPrompt: string): Promise<{ renderId: string; url: string }> {
    const png = await this.generate(id, userPrompt);
    const renderId = createId();
    await fs.mkdir(DNA_RENDERS_DIR, { recursive: true });
    await fs.writeFile(path.join(DNA_RENDERS_DIR, `${renderId}.png`), png);
    return { renderId, url: `/design-studio/renders/${renderId}` };
  }

  async getRender(renderId: string): Promise<Buffer> {
    const file = path.join(DNA_RENDERS_DIR, `${renderId}.png`);
    return fs.readFile(file);
  }

  // ─── Templates CRUD ──────────────────────────────────────────────────────────

  async listTemplates() {
    return this.db.db
      .select({
        id: designStudioTemplates.id,
        name: designStudioTemplates.name,
        previewData: designStudioTemplates.previewData,
        parameters: designStudioTemplates.parameters,
        createdAt: designStudioTemplates.createdAt,
      })
      .from(designStudioTemplates)
      .orderBy(sql`created_at DESC`);
  }

  async getTemplate(id: string) {
    const [row] = await this.db.db
      .select()
      .from(designStudioTemplates)
      .where(eq(designStudioTemplates.id, id))
      .limit(1);
    if (!row) throw new NotFoundException(`Template ${id} not found`);
    return row;
  }

  async deleteTemplate(id: string) {
    await this.db.db.delete(designStudioTemplates).where(eq(designStudioTemplates.id, id));
  }
}
