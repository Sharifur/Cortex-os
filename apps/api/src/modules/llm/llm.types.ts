export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmCompleteOpts {
  messages: ChatMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  provider?: 'openai' | 'gemini' | 'deepseek' | 'auto';
}

export interface LlmResponse {
  content: string;
  provider: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}
