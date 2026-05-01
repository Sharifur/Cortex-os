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
  /** Optional agent key, attached to the usage log row. */
  agentKey?: string;
  /** Optional run id, attached to the usage log row. */
  runId?: string;
}

export interface LlmStreamChunk {
  /** Newly emitted text since last chunk. Empty string on the final chunk. */
  delta: string;
}

export interface LlmStreamCompleteOpts extends LlmCompleteOpts {
  /** Called for every text delta. Throw to abort. */
  onToken: (chunk: LlmStreamChunk) => void | Promise<void>;
}

export interface LlmResponse {
  content: string;
  provider: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

// ─── Tool-use types ───────────────────────────────────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: object;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string; // raw JSON string
}

export type LlmToolMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; content: string; tool_call_id: string };

export type LlmToolResult =
  | { type: 'text'; content: string; provider: string; model: string }
  | { type: 'tool_calls'; tool_calls: ToolCall[]; provider: string; model: string };

export interface LlmCompleteWithToolsOpts {
  messages: LlmToolMessage[];
  tools: ToolDefinition[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  provider?: 'openai' | 'gemini' | 'deepseek' | 'auto';
  agentKey?: string;
  runId?: string;
}
