import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SettingsService } from '../settings/settings.service';
import {
  ChatMessage,
  LlmCompleteOpts,
  LlmResponse,
  LlmCompleteWithToolsOpts,
  LlmToolResult,
  ToolCall,
} from './llm.types';

@Injectable()
export class LlmRouterService {
  private readonly logger = new Logger(LlmRouterService.name);

  constructor(private readonly settings: SettingsService) {}

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

  async completeWithTools(opts: LlmCompleteWithToolsOpts): Promise<LlmToolResult> {
    const provider = opts.provider ?? 'auto';

    if (provider === 'gemini') {
      throw new Error('Gemini does not support tool calling in this router — use openai or deepseek');
    }

    const resolvedProvider =
      provider !== 'auto'
        ? provider
        : ((await this.settings.getDecrypted('llm_default_provider')) ?? 'openai');

    if (resolvedProvider === 'deepseek') {
      return this.callOpenAiStyleWithTools(opts, 'deepseek');
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

    const res = await client.chat.completions.create({
      model,
      messages: opts.messages as OpenAI.Chat.ChatCompletionMessageParam[],
      tools,
      tool_choice: 'auto',
      max_tokens: opts.maxTokens,
      temperature: opts.temperature,
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
    const providers: Array<() => Promise<LlmResponse>> = [
      () => this.callOpenAi(opts),
      () => this.callGemini(opts),
      () => this.callDeepSeek(opts),
    ];

    for (const call of providers) {
      try {
        return await call();
      } catch (err) {
        this.logger.warn(`LLM provider failed, trying next: ${(err as Error).message}`);
      }
    }
    throw new Error('All LLM providers failed');
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

    return {
      content: res.choices[0]?.message?.content ?? '',
      provider: 'openai',
      model,
      inputTokens: res.usage?.prompt_tokens,
      outputTokens: res.usage?.completion_tokens,
    };
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

    return {
      content: text,
      provider: 'gemini',
      model,
      inputTokens: result.response.usageMetadata?.promptTokenCount,
      outputTokens: result.response.usageMetadata?.candidatesTokenCount,
    };
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

    return {
      content: res.choices[0]?.message?.content ?? '',
      provider: 'deepseek',
      model,
      inputTokens: res.usage?.prompt_tokens,
      outputTokens: res.usage?.completion_tokens,
    };
  }
}
