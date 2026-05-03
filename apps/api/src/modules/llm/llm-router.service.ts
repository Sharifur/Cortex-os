import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SettingsService } from '../settings/settings.service';
import { LlmUsageService } from './llm-usage.service';
import {
  ChatMessage,
  LlmCompleteOpts,
  LlmResponse,
  LlmStreamCompleteOpts,
  LlmCompleteWithToolsOpts,
  LlmToolResult,
  ToolCall,
} from './llm.types';

@Injectable()
export class LlmRouterService {
  private readonly logger = new Logger(LlmRouterService.name);

  constructor(
    private readonly settings: SettingsService,
    private readonly usage: LlmUsageService,
  ) {}

  private trackUsage(opts: { agentKey?: string; runId?: string }, res: LlmResponse | { provider: string; model: string; inputTokens?: number; outputTokens?: number }) {
    void this.usage.record({
      agentKey: opts.agentKey ?? null,
      runId: opts.runId ?? null,
      provider: res.provider,
      model: res.model,
      inputTokens: res.inputTokens ?? 0,
      outputTokens: res.outputTokens ?? 0,
    });
  }

  async complete(opts: LlmCompleteOpts): Promise<LlmResponse> {
    const explicitProvider = opts.provider;

    // If caller specified a provider, use it directly
    if (explicitProvider && explicitProvider !== 'auto') {
      switch (explicitProvider) {
        case 'openai': return this.callOpenAi(opts);
        case 'gemini': return this.callGemini(opts);
        case 'deepseek': return this.callDeepSeek(opts);
      }
    }

    // Read configured default provider from settings
    const configuredDefault = await this.settings.getDecrypted('llm_default_provider') ?? 'auto';

    if (configuredDefault !== 'auto') {
      switch (configuredDefault) {
        case 'openai': return this.callOpenAi(opts);
        case 'gemini': return this.callGemini(opts);
        case 'deepseek': return this.callDeepSeek(opts);
      }
    }

    return this.autoRoute(opts);
  }

  /**
   * Streaming variant of complete(). Calls `onToken` for every text delta
   * the provider emits, then resolves with the full assembled LlmResponse
   * (including usage tokens) once the stream ends. Falls back to a single
   * non-streaming call if the provider doesn't support streaming or fails
   * mid-stream — onToken is called once with the full text in that case.
   */
  async streamComplete(opts: LlmStreamCompleteOpts): Promise<LlmResponse> {
    const provider = opts.provider && opts.provider !== 'auto'
      ? opts.provider
      : (await this.settings.getDecrypted('llm_default_provider')) ?? 'openai';
    try {
      if (provider === 'openai') return await this.streamOpenAi(opts);
      if (provider === 'deepseek') return await this.streamDeepSeek(opts);
      // Gemini supports streaming but the SDK shape is different; route to
      // a "fake stream" fallback for now (single call, single delta) — still
      // gives the visitor a result, just without progressive paint.
      return await this.fakeStream(opts);
    } catch (err) {
      this.logger.warn(`stream failed (${provider}): ${(err as Error).message} — falling back`);
      return this.fakeStream(opts);
    }
  }

  private async streamOpenAi(opts: LlmStreamCompleteOpts): Promise<LlmResponse> {
    const apiKey = await this.settings.getDecrypted('openai_api_key');
    if (!apiKey) throw new Error('OpenAI API key not configured');
    const defaultModel = (await this.settings.getDecrypted('openai_default_model')) ?? 'gpt-4o-mini';
    const model = opts.model ?? defaultModel;
    const client = new OpenAI({ apiKey });
    return this.streamOpenAiCompatible(client, opts, model, 'openai');
  }

  private async streamDeepSeek(opts: LlmStreamCompleteOpts): Promise<LlmResponse> {
    const apiKey = await this.settings.getDecrypted('deepseek_api_key');
    if (!apiKey) throw new Error('DeepSeek API key not configured');
    const defaultModel = (await this.settings.getDecrypted('deepseek_default_model')) ?? 'deepseek-chat';
    const model = opts.model ?? defaultModel;
    const client = new OpenAI({ apiKey, baseURL: 'https://api.deepseek.com' });
    return this.streamOpenAiCompatible(client, opts, model, 'deepseek');
  }

  private async streamOpenAiCompatible(
    client: OpenAI,
    opts: LlmStreamCompleteOpts,
    model: string,
    provider: 'openai' | 'deepseek',
  ): Promise<LlmResponse> {
    const stream = await client.chat.completions.create({
      model,
      messages: opts.messages as OpenAI.Chat.ChatCompletionMessageParam[],
      max_tokens: opts.maxTokens,
      temperature: opts.temperature,
      stream: true,
      stream_options: { include_usage: true },
    });

    let assembled = '';
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;
    for await (const chunk of stream) {
      // Usage frame arrives last with empty choices array.
      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens;
        outputTokens = chunk.usage.completion_tokens;
      }
      const delta = chunk.choices?.[0]?.delta?.content ?? '';
      if (delta) {
        assembled += delta;
        await opts.onToken({ delta });
      }
    }

    const response: LlmResponse = { content: assembled, provider, model, inputTokens, outputTokens };
    this.trackUsage(opts, response);
    return response;
  }

  /** Fallback: do a single non-streaming call and emit the whole text in one delta. */
  private async fakeStream(opts: LlmStreamCompleteOpts): Promise<LlmResponse> {
    const res = await this.complete(opts);
    if (res.content) await opts.onToken({ delta: res.content });
    return res;
  }

  /**
   * Embed a single string with OpenAI text-embedding-3-small (1536 dims).
   * Used for hybrid KB retrieval. Returns null if the API key isn't set so
   * callers can transparently fall back to FTS-only.
   */
  async embed(text: string): Promise<number[] | null> {
    const apiKey = await this.settings.getDecrypted('openai_api_key');
    if (!apiKey) return null;
    try {
      const client = new OpenAI({ apiKey });
      const res = await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: text.slice(0, 8000),
      });
      return res.data[0]?.embedding ?? null;
    } catch (err) {
      this.logger.warn(`embed() failed: ${(err as Error).message}`);
      return null;
    }
  }

  async completeWithTools(opts: LlmCompleteWithToolsOpts): Promise<LlmToolResult> {
    const provider = opts.provider ?? 'auto';

    const resolvedProvider =
      provider !== 'auto'
        ? provider
        : ((await this.settings.getDecrypted('llm_default_provider')) ?? 'openai');

    if (resolvedProvider === 'deepseek') {
      return this.callOpenAiStyleWithTools(opts, 'deepseek');
    }

    // Gemini does not support OpenAI-style tool calling; fall back to openai with a warning.
    if (resolvedProvider === 'gemini') {
      this.logger.warn('completeWithTools: gemini does not support tool calling — falling back to openai');
      return this.callOpenAiStyleWithTools(opts, 'openai');
    }

    return this.callOpenAiStyleWithTools(opts, 'openai');
  }

  private async callOpenAiStyleWithTools(
    opts: LlmCompleteWithToolsOpts,
    backend: 'openai' | 'deepseek',
  ): Promise<LlmToolResult> {
    let apiKey: string | null;
    let baseURL: string | undefined;
    let defaultModel: string;

    if (backend === 'deepseek') {
      apiKey = await this.settings.getDecrypted('deepseek_api_key');
      baseURL = 'https://api.deepseek.com';
      defaultModel = (await this.settings.getDecrypted('deepseek_default_model')) ?? 'deepseek-chat';
    } else {
      apiKey = await this.settings.getDecrypted('openai_api_key');
      defaultModel = (await this.settings.getDecrypted('openai_default_model')) ?? 'gpt-4o-mini';
    }

    if (!apiKey) throw new Error(`${backend} API key not configured`);

    const model = opts.model ?? defaultModel;
    const client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });

    const tools = opts.tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters as Record<string, unknown>,
      },
    }));

    // Convert our internal ToolCall shape { id, name, arguments } back to what
    // OpenAI requires in assistant messages: { id, type, function: { name, arguments } }
    const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = opts.messages.map((m) => {
      if (m.role === 'assistant' && Array.isArray((m as any).tool_calls) && (m as any).tool_calls.length) {
        return {
          role: 'assistant' as const,
          content: (m as any).content ?? null,
          tool_calls: (m as any).tool_calls.map((tc: any) => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.name, arguments: tc.arguments },
          })),
        };
      }
      return m as OpenAI.Chat.ChatCompletionMessageParam;
    });

    const res = await client.chat.completions.create({
      model,
      messages: openAiMessages,
      tools,
      tool_choice: 'auto',
      max_tokens: opts.maxTokens,
      temperature: opts.temperature,
    });

    void this.usage.record({
      agentKey: opts.agentKey ?? null,
      runId: opts.runId ?? null,
      provider: backend,
      model,
      inputTokens: res.usage?.prompt_tokens ?? 0,
      outputTokens: res.usage?.completion_tokens ?? 0,
    });

    const msg = res.choices[0]?.message;
    if (msg?.tool_calls?.length) {
      const toolCalls: ToolCall[] = msg.tool_calls
        .filter((tc): tc is OpenAI.Chat.ChatCompletionMessageToolCall & { function: { name: string; arguments: string } } =>
          'function' in tc && typeof tc.function?.name === 'string',
        )
        .map((tc) => ({
          id: tc.id,
          name: tc.function.name,
          arguments: tc.function.arguments,
        }));
      return { type: 'tool_calls', tool_calls: toolCalls, provider: backend, model };
    }

    return { type: 'text', content: msg?.content ?? '', provider: backend, model };
  }

  private async autoRoute(opts: LlmCompleteOpts): Promise<LlmResponse> {
    const orderRaw = (await this.settings.getDecrypted('llm_fallback_order')) ?? 'openai,deepseek,gemini';
    const order = orderRaw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s): s is 'openai' | 'gemini' | 'deepseek' =>
        s === 'openai' || s === 'gemini' || s === 'deepseek',
      );

    const enabledChecks = await Promise.all(
      order.map(async (p) => ({ name: p, enabled: await this.isProviderEnabled(p) })),
    );
    const active = enabledChecks.filter((e) => e.enabled).map((e) => e.name);

    if (!active.length) {
      throw new Error('No LLM providers are enabled. Toggle at least one provider on in Settings.');
    }

    for (const name of active) {
      try {
        switch (name) {
          case 'openai': return await this.callOpenAi(opts);
          case 'gemini': return await this.callGemini(opts);
          case 'deepseek': return await this.callDeepSeek(opts);
        }
      } catch (err) {
        this.logger.warn(`LLM provider ${name} failed, trying next: ${(err as Error).message}`);
      }
    }
    throw new Error('All enabled LLM providers failed');
  }

  private async isProviderEnabled(name: 'openai' | 'gemini' | 'deepseek'): Promise<boolean> {
    const v = await this.settings.getDecrypted(`${name}_enabled`);
    if (v === null) return name !== 'gemini';
    return v.toLowerCase() === 'true';
  }

  private async callOpenAi(opts: LlmCompleteOpts): Promise<LlmResponse> {
    const apiKey = await this.settings.getDecrypted('openai_api_key');
    if (!apiKey) throw new Error('OpenAI API key not configured');

    const defaultModel = (await this.settings.getDecrypted('openai_default_model')) ?? 'gpt-4o-mini';
    const model = opts.model ?? defaultModel;

    const client = new OpenAI({ apiKey });
    const res = await client.chat.completions.create({
      model,
      messages: opts.messages as OpenAI.Chat.ChatCompletionMessageParam[],
      max_tokens: opts.maxTokens,
      temperature: opts.temperature,
    });

    const response: LlmResponse = {
      content: res.choices[0]?.message?.content ?? '',
      provider: 'openai',
      model,
      inputTokens: res.usage?.prompt_tokens,
      outputTokens: res.usage?.completion_tokens,
    };
    this.trackUsage(opts, response);
    return response;
  }

  private async callGemini(opts: LlmCompleteOpts): Promise<LlmResponse> {
    const apiKey = await this.settings.getDecrypted('gemini_api_key');
    if (!apiKey) throw new Error('Gemini API key not configured');

    const defaultModel = (await this.settings.getDecrypted('gemini_default_model')) ?? 'gemini-1.5-flash';
    const model = opts.model ?? defaultModel;

    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({ model });

    const systemMsg = opts.messages.find((m) => m.role === 'system')?.content;
    const history = opts.messages
      .filter((m) => m.role !== 'system')
      .slice(0, -1)
      .map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));

    const lastUserMsg = opts.messages.filter((m) => m.role !== 'system').at(-1)?.content ?? '';

    const chat = geminiModel.startChat({
      history,
      ...(systemMsg ? { systemInstruction: systemMsg } : {}),
    });

    const result = await chat.sendMessage(lastUserMsg);
    const text = result.response.text();

    const response: LlmResponse = {
      content: text,
      provider: 'gemini',
      model,
      inputTokens: result.response.usageMetadata?.promptTokenCount,
      outputTokens: result.response.usageMetadata?.candidatesTokenCount,
    };
    this.trackUsage(opts, response);
    return response;
  }

  private async callDeepSeek(opts: LlmCompleteOpts): Promise<LlmResponse> {
    const apiKey = await this.settings.getDecrypted('deepseek_api_key');
    if (!apiKey) throw new Error('DeepSeek API key not configured');

    const defaultModel = (await this.settings.getDecrypted('deepseek_default_model')) ?? 'deepseek-chat';
    const model = opts.model ?? defaultModel;

    const client = new OpenAI({
      apiKey,
      baseURL: 'https://api.deepseek.com',
    });

    const res = await client.chat.completions.create({
      model,
      messages: opts.messages as OpenAI.Chat.ChatCompletionMessageParam[],
      max_tokens: opts.maxTokens,
      temperature: opts.temperature,
    });

    const response: LlmResponse = {
      content: res.choices[0]?.message?.content ?? '',
      provider: 'deepseek',
      model,
      inputTokens: res.usage?.prompt_tokens,
      outputTokens: res.usage?.completion_tokens,
    };
    this.trackUsage(opts, response);
    return response;
  }
}
