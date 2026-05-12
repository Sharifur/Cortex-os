import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { SettingsService } from '../settings/settings.service';
import type { ImageProvider } from './types';

function sanitizePrompt(p: string): string {
  return p
    .replace(/ignore previous instructions?/gi, '')
    .replace(/system prompt/gi, '')
    .slice(0, 800);
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
  ): Promise<{ buffer: Buffer; provider: string }> {
    const sanitized = sanitizePrompt(prompt);
    const order = this.buildOrder(preferred ?? 'auto');

    for (const provider of order) {
      try {
        const buf = await this.tryProvider(provider, sanitized, dims);
        if (buf) return { buffer: buf, provider };
      } catch (err) {
        this.logger.warn(`image gen failed on ${provider}: ${(err as Error).message} — trying next`);
      }
    }

    // All providers failed — return a transparent 1x1 PNG sentinel
    this.logger.warn('all image providers failed, returning empty buffer');
    return { buffer: Buffer.alloc(0), provider: 'none' };
  }

  private buildOrder(preferred: ImageProvider): string[] {
    const full = ['gpt-image-1', 'dalle3', 'gemini', 'dalle2'];
    if (preferred === 'auto') return full;
    if (preferred === 'openai') return ['gpt-image-1', 'dalle3', 'dalle2'];
    if (preferred === 'gemini') return ['gemini', 'gpt-image-1', 'dalle3'];
    if (preferred === 'dalle2') return ['dalle2', 'dalle3', 'gpt-image-1'];
    return full;
  }

  private async tryProvider(provider: string, prompt: string, dims: { width: number; height: number }): Promise<Buffer | null> {
    const apiKey = await this.settings.getDecrypted('openai_api_key');

    if (provider === 'gpt-image-1') {
      if (!apiKey) return null;
      const client = new OpenAI({ apiKey });
      const size = snapDalleSize(dims.width, dims.height);
      const res = await client.images.generate({
        model: 'gpt-image-1',
        prompt,
        n: 1,
        size,
      } as Parameters<typeof client.images.generate>[0]) as { data?: Array<{ url?: string }> };
      const url = res.data?.[0]?.url;
      if (!url) return null;
      return this.downloadBuffer(url);
    }

    if (provider === 'dalle3') {
      if (!apiKey) return null;
      const client = new OpenAI({ apiKey });
      const size = snapDalleSize(dims.width, dims.height);
      const res = await client.images.generate({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size,
        quality: 'standard',
        response_format: 'url',
      });
      const url = res.data?.[0]?.url;
      if (!url) return null;
      return this.downloadBuffer(url);
    }

    if (provider === 'dalle2') {
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
      return this.downloadBuffer(url);
    }

    if (provider === 'gemini') {
      return this.tryGemini(prompt);
    }

    return null;
  }

  private async tryGemini(prompt: string): Promise<Buffer | null> {
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
          return Buffer.from(p.inlineData.data, 'base64');
        }
      }
    } catch (err) {
      this.logger.warn(`gemini image gen error: ${(err as Error).message}`);
    }
    return null;
  }

  private async downloadBuffer(url: string): Promise<Buffer> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`image download failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
}
