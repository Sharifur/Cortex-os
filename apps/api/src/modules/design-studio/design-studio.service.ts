import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { eq, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { DbService } from '../../db/db.service';
import { LlmRouterService } from '../llm/llm-router.service';
import { QUEUE_NAMES } from '../../common/queue/queue.constants';
import { designStudioTemplates, designStudioJobs, DesignSpec, TemplateParameter, SpecElement } from './schema';
import type { DesignStudioJobData } from './design-studio.processor';

@Injectable()
export class DesignStudioService {
  private readonly logger = new Logger(DesignStudioService.name);

  constructor(
    private readonly db: DbService,
    private readonly llm: LlmRouterService,
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

  async generate(id: string, prompt: string): Promise<Buffer> {
    const [template] = await this.db.db
      .select()
      .from(designStudioTemplates)
      .where(eq(designStudioTemplates.id, id))
      .limit(1);

    if (!template) throw new NotFoundException(`Template ${id} not found`);

    const paramSchema = JSON.stringify(template.parameters, null, 2);
    const fillRes = await this.llm.complete({
      messages: [
        {
          role: 'system',
          content: `You fill design template parameters from a user's chat request.
Given the parameter schema below, return a JSON object mapping each parameter key to its value.
Only return valid JSON — no markdown, no explanation.

Parameter schema:
${paramSchema}`,
        },
        { role: 'user', content: prompt },
      ],
      maxTokens: 800,
      agentKey: 'design-studio',
    });

    let values: Record<string, unknown>;
    const rawFill = fillRes.content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    values = JSON.parse(rawFill) as Record<string, unknown>;

    const resolved = this.resolveSpec(template.spec.root, values);
    return this.renderElement(resolved, template.spec.width, template.spec.height);
  }

  // ─── Spec resolver ───────────────────────────────────────────────────────────

  private resolveValue(val: unknown, params: Record<string, unknown>): unknown {
    if (typeof val !== 'string') return val;
    if (val.startsWith('{{') && val.endsWith('}}')) {
      return params[val.slice(2, -2).trim()] ?? val;
    }
    return val;
  }

  private resolveStyle(
    style: Record<string, string | number> | undefined,
    params: Record<string, unknown>,
  ): Record<string, unknown> {
    if (!style) return {};
    return Object.fromEntries(
      Object.entries(style).map(([k, v]) => [k, this.resolveValue(v, params)]),
    );
  }

  private resolveSpec(node: SpecElement, params: Record<string, unknown>): object {
    const style = this.resolveStyle(node.style, params);

    if (node.type === 'img') {
      return { type: 'img', props: { src: this.resolveValue(node.src, params) ?? '', style } };
    }

    const children: unknown = node.text !== undefined
      ? this.resolveValue(node.text, params)
      : node.children?.map(c => this.resolveSpec(c, params));

    return { type: node.type, props: { style, children } };
  }

  // ─── Satori render ───────────────────────────────────────────────────────────

  private async renderElement(tree: object, width: number, height: number): Promise<Buffer> {
    const satori = (await import('satori')).default;
    const { Resvg } = await import('@resvg/resvg-js');
    const { readFileSync, existsSync } = await import('fs');
    const { join } = await import('path');

    const fontPaths = [
      join(process.cwd(), 'fonts', 'Inter-Regular.ttf'),
      join(process.cwd(), 'fonts', 'Inter-Bold.ttf'),
      join(__dirname, '../../../../fonts/Inter-Regular.ttf'),
      join(__dirname, '../../../../fonts/Inter-Bold.ttf'),
    ];

    const fonts: Array<{ name: string; data: ArrayBuffer; weight: 400 | 700; style: 'normal' }> = [];
    const regularPath = fontPaths.find(p => existsSync(p) && p.includes('Regular'));
    const boldPath = fontPaths.find(p => existsSync(p) && p.includes('Bold'));

    if (regularPath) fonts.push({ name: 'Inter', data: readFileSync(regularPath).buffer, weight: 400, style: 'normal' });
    if (boldPath) fonts.push({ name: 'Inter', data: readFileSync(boldPath).buffer, weight: 700, style: 'normal' });

    if (fonts.length === 0) {
      this.logger.warn('No Inter fonts found — Satori will use fallback');
    }

    const svg = await satori(tree as Parameters<typeof satori>[0], { width, height, fonts });
    const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: width } });
    return Buffer.from(resvg.render().asPng());
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
