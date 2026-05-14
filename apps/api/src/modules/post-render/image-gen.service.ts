import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { SettingsService } from '../settings/settings.service';
import type { ImageProvider } from './types';

// Cost per image in USD (approximate, 1024×1024 high quality)
const MODEL_COST: Record<string, number> = {
  'gpt-image-1':                         0.19,
  'gpt-image-2':                         0.211,
  'dall-e-3-hd':                         0.08,
  'dall-e-3':                            0.04,
  'dall-e-2':                            0.018,
  'gemini-2.0-flash-exp':                0.02,
  'stable-image-core':                   0.003,  // 0.3 credits @ $10/1000
  'stable-diffusion-xl-1024-v1-0':       0.002,  // 0.2 credits
  'stable-image-ultra':                  0.008,  // 0.8 credits
};

function sanitizePrompt(p: string): string {
  return p
    .replace(/ignore previous instructions?/gi, '')
    .replace(/system prompt/gi, '')
    .slice(0, 4000);
}

function snapDalleSize(w: number, h: number): '1024x1024' | '1024x1792' | '1792x1024' {
  if (h > w) return '1024x1792';
  if (w > h) return '1792x1024';
  return '1024x1024';
}

@Injectable()
export class ImageGenService {
  private readonly logger = new Logger(ImageGenService.name);

  constructor(private readonly settings: SettingsService) {}

  async generate(
    prompt: string,
    dims: { width: number; height: number },
    preferred?: ImageProvider,
  ): Promise<{ buffer: Buffer; provider: string; model: string; estimatedCostUsd: number }> {
    const sanitized = sanitizePrompt(prompt);
    const providerPref = preferred ?? ((await this.settings.getDecrypted('image_gen_provider')) as ImageProvider | null) ?? 'auto';
    const order = this.buildOrder(providerPref);

    for (const provider of order) {
      try {
        const result = await this.tryProvider(provider, sanitized, dims);
        if (result) {
          const cost = MODEL_COST[result.model] ?? 0;
          this.logger.log(`image gen: ${result.model} provider=${provider} cost=$${cost.toFixed(4)} size=${result.buffer.length}B`);
          return { buffer: result.buffer, provider, model: result.model, estimatedCostUsd: cost };
        }
      } catch (err) {
        this.logger.warn(`image gen failed on ${provider}: ${(err as Error).message} — trying next`);
      }
    }

    this.logger.warn('all image providers failed, returning empty buffer');
    return { buffer: Buffer.alloc(0), provider: 'none', model: 'none', estimatedCostUsd: 0 };
  }

  private buildOrder(preferred: string): string[] {
    if (preferred === 'auto') return ['openai', 'stability', 'gemini', 'dalle2'];
    if (preferred === 'openai') return ['openai', 'dalle2'];
    if (preferred === 'gemini') return ['gemini', 'openai'];
    if (preferred === 'stability') return ['stability', 'openai'];
    if (preferred === 'dalle2') return ['dalle2', 'openai'];
    if (preferred === 'openai-stability') return ['openai', 'stability'];
    return ['openai', 'stability', 'gemini', 'dalle2'];
  }

  private async tryProvider(provider: string, prompt: string, dims: { width: number; height: number }): Promise<{ buffer: Buffer; model: string } | null> {
    if (provider === 'openai') {
      return this.tryOpenAi(prompt, dims);
    }
    if (provider === 'dalle2') {
      return this.tryDalle2(prompt);
    }
    if (provider === 'gemini') {
      return this.tryGemini(prompt);
    }
    if (provider === 'stability') {
      return this.tryStability(prompt, dims);
    }
    return null;
  }

  private async tryOpenAi(prompt: string, dims: { width: number; height: number }): Promise<{ buffer: Buffer; model: string } | null> {
    const apiKey = await this.settings.getDecrypted('openai_api_key');
    if (!apiKey) return null;

    const configuredModel = (await this.settings.getDecrypted('image_gen_openai_model')) || 'gpt-image-1';
    const client = new OpenAI({ apiKey });

    if (configuredModel === 'dall-e-3' || configuredModel === 'dall-e-3-hd') {
      const size = snapDalleSize(dims.width, dims.height);
      const quality = configuredModel === 'dall-e-3-hd' ? 'hd' : 'standard';
      const res = await client.images.generate({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size,
        quality,
        response_format: 'url',
      });
      const url = res.data?.[0]?.url;
      if (!url) return null;
      return { buffer: await this.downloadBuffer(url), model: configuredModel };
    }

    if (configuredModel === 'dall-e-2') {
      return this.tryDalle2(prompt);
    }

    // gpt-image-1 or gpt-image-2
    const size = snapDalleSize(dims.width, dims.height);
    const res = await client.images.generate({
      model: configuredModel,
      prompt,
      n: 1,
      size,
    } as Parameters<typeof client.images.generate>[0]) as { data?: Array<{ url?: string; b64_json?: string }> };

    const item = res.data?.[0];
    if (!item) return null;

    if (item.b64_json) {
      return { buffer: Buffer.from(item.b64_json, 'base64'), model: configuredModel };
    }
    if (item.url) {
      return { buffer: await this.downloadBuffer(item.url), model: configuredModel };
    }
    return null;
  }

  private async tryDalle2(prompt: string): Promise<{ buffer: Buffer; model: string } | null> {
    const apiKey = await this.settings.getDecrypted('openai_api_key');
    if (!apiKey) return null;
    const client = new OpenAI({ apiKey });
    const res = await client.images.generate({
      model: 'dall-e-2',
      prompt: prompt.slice(0, 1000),
      n: 1,
      size: '1024x1024',
      response_format: 'url',
    });
    const url = res.data?.[0]?.url;
    if (!url) return null;
    return { buffer: await this.downloadBuffer(url), model: 'dall-e-2' };
  }

  private async tryGemini(prompt: string): Promise<{ buffer: Buffer; model: string } | null> {
    const apiKey = await this.settings.getDecrypted('gemini_api_key');
    if (!apiKey) return null;

    try {
      const { GoogleGenerativeAI: GoogleGenAI } = await import('@google/generative-ai');
      const client = new GoogleGenAI(apiKey);
      const model = client.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      const response = await model.generateContent(prompt);
      const parts = response?.response?.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        const p = part as { inlineData?: { mimeType: string; data: string } };
        if (p.inlineData?.data) {
          return { buffer: Buffer.from(p.inlineData.data, 'base64'), model: 'gemini-2.0-flash-exp' };
        }
      }
    } catch (err) {
      this.logger.warn(`gemini image gen error: ${(err as Error).message}`);
    }
    return null;
  }

  private async tryStability(prompt: string, dims: { width: number; height: number }): Promise<{ buffer: Buffer; model: string } | null> {
    const apiKey = await this.settings.getDecrypted('stability_api_key');
    if (!apiKey) return null;

    const configuredModel = (await this.settings.getDecrypted('image_gen_stability_model')) || 'stable-image-core';

    try {
      if (configuredModel === 'stable-diffusion-xl-1024-v1-0') {
        return this.tryStabilityV1Sdxl(apiKey, prompt, dims);
      }
      // v2beta: stable-image-core or stable-image-ultra
      const endpoint = configuredModel === 'stable-image-ultra'
        ? 'https://api.stability.ai/v2beta/stable-image/generate/ultra'
        : 'https://api.stability.ai/v2beta/stable-image/generate/core';

      const form = new FormData();
      form.append('prompt', prompt);
      form.append('output_format', 'png');
      form.append('aspect_ratio', dims.width === dims.height ? '1:1' : dims.width > dims.height ? '16:9' : '9:16');

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'image/*' },
        body: form,
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => res.status.toString());
        throw new Error(`stability api error: ${res.status} — ${txt}`);
      }
      const arrayBuf = await res.arrayBuffer();
      return { buffer: Buffer.from(arrayBuf), model: configuredModel };
    } catch (err) {
      this.logger.warn(`stability image gen error: ${(err as Error).message}`);
      return null;
    }
  }

  private async tryStabilityV1Sdxl(apiKey: string, prompt: string, dims: { width: number; height: number }): Promise<{ buffer: Buffer; model: string } | null> {
    // Clamp to SDXL-supported sizes
    const w = dims.width > dims.height ? 1344 : dims.width === dims.height ? 1024 : 768;
    const h = dims.height > dims.width ? 1344 : dims.width === dims.height ? 1024 : 768;

    const res = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
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
      const txt = await res.text().catch(() => res.status.toString());
      throw new Error(`stability sdxl error: ${res.status} — ${txt}`);
    }
    const body = (await res.json()) as { artifacts?: Array<{ base64: string; finishReason: string }> };
    const artifact = body.artifacts?.[0];
    if (!artifact?.base64) return null;
    return { buffer: Buffer.from(artifact.base64, 'base64'), model: 'stable-diffusion-xl-1024-v1-0' };
  }

  private async downloadBuffer(url: string): Promise<Buffer> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`image download failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
}
