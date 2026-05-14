import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Job } from 'bullmq';
import { eq, sql } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { LlmRouterService } from '../llm/llm-router.service';
import { QUEUE_NAMES } from '../../common/queue/queue.constants';
import { designStudioJobs, designStudioTemplates, DesignSpec, TemplateParameter } from './schema';
import { createId } from '@paralleldrive/cuid2';

export interface DesignStudioJobData {
  jobId: string;
  name: string;
  imageBase64: string;
  mimeType: string;
}

@Processor(QUEUE_NAMES.DESIGN_STUDIO, { autorun: false })
export class DesignStudioProcessor extends WorkerHost {
  private readonly logger = new Logger(DesignStudioProcessor.name);

  startWorker(): void {
    this.worker.run().catch((err) => this.logger.error('Worker crashed', err));
  }

  constructor(
    private readonly db: DbService,
    private readonly llm: LlmRouterService,
    private readonly events: EventEmitter2,
  ) {
    super();
  }

  async process(job: Job<DesignStudioJobData>): Promise<void> {
    const { jobId, name, imageBase64, mimeType } = job.data;

    await this.setStatus(jobId, 'processing');

    try {
      const systemPrompt = `You are a design analysis AI. Analyze the provided image and extract it as a structured Satori-compatible design spec.

Output ONLY valid JSON with this exact structure:
{
  "parameters": [
    { "key": "string", "type": "text|color|number|lines", "description": "what this field represents", "example": <value> }
  ],
  "spec": {
    "width": <number>,
    "height": <number>,
    "root": <SpecElement>
  }
}

SpecElement schema:
{
  "type": "div" | "span" | "img",
  "style": { <CSS property camelCase>: <value> },
  "text": "static text or {{paramKey}} for dynamic",
  "src": "for img only",
  "children": [ <SpecElement>... ]
}

Rules:
- display:flex ONLY — no grid, block, or inline
- All sizes as px numbers
- Colors as hex strings
- Dynamic values use {{paramKey}} matching a parameter key
- Root element: style.width="100%" style.height="100%"
- Only output JSON — no markdown, no explanation`;

      const res = await this.llm.complete({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Analyze this design image and extract the complete spec.' },
        ],
        imageBase64,
        imageMimeType: mimeType,
        maxTokens: 4000,
        agentKey: 'design-studio',
      });

      let extracted: { parameters: TemplateParameter[]; spec: DesignSpec };
      const raw = res.content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
      extracted = JSON.parse(raw) as { parameters: TemplateParameter[]; spec: DesignSpec };

      const templateId = createId();
      await this.db.db.insert(designStudioTemplates).values({
        id: templateId,
        name,
        previewData: `data:${mimeType};base64,${imageBase64}`,
        parameters: extracted.parameters,
        spec: extracted.spec,
      });

      await this.db.db
        .update(designStudioJobs)
        .set({ status: 'done', templateId, updatedAt: new Date() })
        .where(eq(designStudioJobs.id, jobId));

      this.events.emit('design-studio.job.updated', { jobId, status: 'done', templateId });
      this.logger.log(`design-studio job done: ${jobId} → template ${templateId}`);
    } catch (err) {
      const error = (err as Error).message;
      this.logger.error(`design-studio job failed: ${jobId} — ${error}`);
      await this.db.db
        .update(designStudioJobs)
        .set({ status: 'failed', error, updatedAt: new Date() })
        .where(eq(designStudioJobs.id, jobId));
      this.events.emit('design-studio.job.updated', { jobId, status: 'failed', error });
    }
  }

  private async setStatus(jobId: string, status: 'processing') {
    await this.db.db
      .update(designStudioJobs)
      .set({ status, updatedAt: new Date() })
      .where(eq(designStudioJobs.id, jobId));
    this.events.emit('design-studio.job.updated', { jobId, status });
  }
}
