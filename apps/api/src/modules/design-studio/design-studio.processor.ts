import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { LlmRouterService } from '../llm/llm-router.service';
import { QUEUE_NAMES } from '../../common/queue/queue.constants';
import { designStudioJobs, designStudioTemplates } from './schema';
import { createId } from '@paralleldrive/cuid2';

export interface DesignStudioJobData {
  jobId: string;
  name: string;
  imageBase64: string;
  mimeType: string;
}

export interface DesignDNA {
  stylePrompt: string;       // Full DALL-E style guide — used verbatim during generation
  colors: string[];          // Dominant hex colors
  dimensions: { width: number; height: number };
  orientation: 'portrait' | 'landscape' | 'square';
  parameters: Array<{ key: string; description: string; example: string }>;
}

const EXTRACT_SYSTEM = `You are a design analyst. Given a design image, extract a DesignDNA object used to generate new variations with gpt-image-1.

Output ONLY valid JSON — no markdown, no explanation:
{
  "stylePrompt": "<style guide — see rules below>",
  "colors": ["#hex1", "#hex2", "#hex3"],
  "dimensions": { "width": <px>, "height": <px> },
  "orientation": "portrait" | "landscape" | "square",
  "parameters": [
    { "key": "topic", "description": "main subject or topic of the design", "example": "How to Build a Digital Marketing Strategy" }
  ]
}

stylePrompt STRICT rules:
1. Describe ONLY the visual style: layout zones, typography treatment (weight, size, position), color palette, background, graphic/illustration style, composition.
2. NEVER copy, quote, paraphrase, or reference any specific text, title, words, or numbers from the original image. The content prompt will supply all text separately.
3. DO describe: "bold sans-serif multi-line headline occupying the top third", "large centered circular illustration in the middle", "light cream background", "one accent-colored word in the headline", "small footer labels at bottom corners".
4. 3-5 sentences maximum.`;

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
      const res = await this.llm.complete({
        messages: [
          { role: 'system', content: EXTRACT_SYSTEM },
          { role: 'user', content: 'Analyze this design image and extract its DesignDNA.' },
        ],
        imageBase64,
        imageMimeType: mimeType,
        maxTokens: 1000,
        agentKey: 'design-studio',
      });

      const raw = res.content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
      const dna: DesignDNA = JSON.parse(raw);

      const templateId = createId();
      await this.db.db.insert(designStudioTemplates).values({
        id: templateId,
        name,
        previewData: `data:${mimeType};base64,${imageBase64}`,
        parameters: dna.parameters as any,
        spec: dna as any,
      });

      await this.db.db
        .update(designStudioJobs)
        .set({ status: 'done', templateId, updatedAt: new Date() })
        .where(eq(designStudioJobs.id, jobId));

      this.events.emit('design-studio.job.updated', { jobId, status: 'done', templateId });
      this.logger.log(`design-studio job done: ${jobId} → template ${templateId} (DNA extracted)`);
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
