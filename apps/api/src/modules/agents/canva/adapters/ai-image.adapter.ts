import { Injectable, Logger } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import * as crypto from 'crypto';
import OpenAI from 'openai';
import { SettingsService } from '../../../settings/settings.service';
import { ApprovalFolderService } from '../approval-folder.service';
import { AuditLogService } from '../audit-log.service';
import type { BackendAdapter, Candidate, GenerationTask, ImageRequest, ImageResult } from './types';

// T26: DALL·E 3 cost per image (USD)
const DALLE3_COST: Record<string, number> = {
  '1024x1024-standard': 0.04,
  '1024x1024-hd':       0.08,
  '1024x1792-standard': 0.08,
  '1024x1792-hd':       0.12,
  '1792x1024-standard': 0.08,
  '1792x1024-hd':       0.12,
};

// Prompt injection sanitization — remove instruction-override patterns (FR-090)
function sanitizePrompt(prompt: string): string {
  return prompt
    .replace(/ignore previous instructions?/gi, '')
    .replace(/system prompt/gi, '')
    .replace(/\[INST\]|\[\/INST\]/g, '')
    .replace(/<<SYS>>|<\/SYS>/g, '')
    .slice(0, 1000);
}

// Snap to supported DALL·E 3 sizes
function snapDalleSize(w: number, h: number): { size: '1024x1024' | '1024x1792' | '1792x1024'; quality: 'standard' | 'hd' } {
  if (h > w) return { size: '1024x1792', quality: 'standard' };
  if (w > h) return { size: '1792x1024', quality: 'standard' };
  return { size: '1024x1024', quality: 'standard' };
}

@Injectable()
export class AIImageAdapter implements BackendAdapter {
  private readonly logger = new Logger(AIImageAdapter.name);

  constructor(
    private readonly settings: SettingsService,
    private readonly folder: ApprovalFolderService,
    private readonly audit: AuditLogService,
  ) {}

  async generate(task: GenerationTask): Promise<Candidate> {
    const t0 = Date.now();
    const candidateId = createId();
    const brief = task.brief;

    const prompt = this.buildPrompt(task);
    const sanitized = sanitizePrompt(prompt);

    let result: ImageResult;
    try {
      result = await this.generateDalle3(sanitized, brief.dimensions, task.brief.brand.voiceProfile);
    } catch (dalleErr) {
      this.logger.warn(`DALL-E 3 failed, trying Stability: ${(dalleErr as Error).message}`);
      try {
        result = await this.generateStability(sanitized, brief.dimensions);
      } catch (stabErr) {
        this.logger.warn(`Stability also failed: ${(stabErr as Error).message}`);
        await this.audit.append({
          sessionId: task.id,
          candidateId,
          actor: 'AIImageAdapter',
          action: 'ai_image.generate',
          latencyMs: Date.now() - t0,
          outcome: 'error',
          error: (stabErr as Error).message,
        });
        return {
          id: candidateId,
          sessionId: task.id,
          backend: 'ai_image',
          tool: 'dalle3',
          format: 'png',
          costUsd: 0,
          rationale: task.rationale,
          iteration: 1,
          status: 'failed',
          error: (stabErr as Error).message,
        };
      }
    }

    const sha256 = crypto.createHash('sha256').update(result.bytes).digest('hex');

    const candidate: Candidate = {
      id: candidateId,
      sessionId: task.id,
      backend: 'ai_image',
      tool: result.provider === 'stability' ? 'stability-ai' : 'dalle3',
      format: 'png',
      width: brief.dimensions.width,
      height: brief.dimensions.height,
      sizeBytes: result.bytes.length,
      sha256,
      costUsd: result.costUsd,
      rationale: task.rationale,
      iteration: 1,
      status: 'pending',
    };

    const filePath = await this.folder.saveCandidate(task.id, candidate, result.bytes);
    candidate.filePath = filePath;

    await this.audit.append({
      sessionId: task.id,
      candidateId,
      actor: 'AIImageAdapter',
      action: `ai_image.${result.provider}`,
      inputHash: this.audit.hash({ prompt: sanitized }),
      outputHash: this.audit.hash({ sha256, cost: result.costUsd }),
      latencyMs: Date.now() - t0,
      outcome: 'success',
    });

    return candidate;
  }

  private buildPrompt(task: GenerationTask): string {
    const b = task.brief;
    const parts = [b.subject];
    if (b.tone.length) parts.push(`Tone: ${b.tone.join(', ')}`);
    if (b.brand.voiceProfile) parts.push(`Style: ${b.brand.voiceProfile}`);
    if (b.copy?.headline) parts.push(`Headline: ${b.copy.headline}`);
    if (b.constraints?.length) parts.push(`Constraints: ${b.constraints.join('; ')}`);
    if (b.brand.palette?.length) parts.push(`Color palette: ${b.brand.palette.slice(0, 3).join(', ')}`);
    return parts.join('. ');
  }

  private async generateDalle3(
    prompt: string,
    dims: { width: number; height: number },
    voiceProfile?: string,
  ): Promise<ImageResult> {
    const apiKey = await this.settings.getDecrypted('openai_api_key');
    if (!apiKey) throw new Error('OpenAI API key not configured');

    const { size, quality } = snapDalleSize(dims.width, dims.height);
    const costKey = `${size}-${quality}`;
    const costUsd = DALLE3_COST[costKey] ?? 0.04;

    const client = new OpenAI({ apiKey });
    const res = await client.images.generate({
      model: 'dall-e-3',
      prompt,
      size,
      quality,
      n: 1,
      response_format: 'b64_json',
    });

    const b64 = res.data?.[0]?.b64_json;
    if (!b64) throw new Error('DALL-E 3 returned no image data');

    return {
      bytes: Buffer.from(b64, 'base64'),
      provider: 'openai',
      model: 'dall-e-3',
      costUsd,
    };
  }

  private async generateStability(
    prompt: string,
    dims: { width: number; height: number },
  ): Promise<ImageResult> {
    const apiKey = await this.settings.getDecrypted('stability_api_key');
    if (!apiKey) throw new Error('Stability AI API key not configured');

    // Snap to multiples of 64 (Stability requirement)
    const w = Math.round(dims.width / 64) * 64 || 1024;
    const h = Math.round(dims.height / 64) * 64 || 1024;

    const res = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      body: JSON.stringify({
        text_prompts: [{ text: prompt, weight: 1 }],
        cfg_scale: 7,
        height: h,
        width: w,
        steps: 30,
        samples: 1,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Stability AI error ${res.status}: ${body}`);
    }

    const json = await res.json() as { artifacts: Array<{ base64: string }> };
    const b64 = json.artifacts?.[0]?.base64;
    if (!b64) throw new Error('Stability AI returned no image');

    return {
      bytes: Buffer.from(b64, 'base64'),
      provider: 'stability',
      model: 'stable-diffusion-xl-1024-v1-0',
      costUsd: 0.002, // approximate per-image cost
    };
  }
}
