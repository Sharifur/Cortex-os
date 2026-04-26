# LLM Router

## Interface

```ts
interface ILLMRouter {
  complete(opts: {
    provider?: 'gemini' | 'deepseek' | 'openai';
    model?: string;
    system?: string;
    messages: ChatMessage[];
    tools?: ToolSpec[];          // includes agent's MCP tools mapped to provider format
    jsonSchema?: object;
    temperature?: number;
  }): Promise<LLMResponse>;
}
```

## Behavior

- **Default provider** per agent: `Agent.config.llm.provider`
- **Fallback on 5xx / rate-limit:** retry once on same provider, then fall back to next in priority list
- **Token + cost logging:** logged per call into `agent_logs.meta`
- **Structured output:** passes JSON schema to provider; on validation failure, retries once with corrective prompt

## Provider Priority (default)

1. OpenAI (`gpt-4o-mini` default for most agents)
2. Gemini
3. DeepSeek

## MCP Tool Mapping

Agent's `mcpTools()` are mapped to the provider's tool/function-calling format before the LLM call.  
The router handles format translation per provider (OpenAI function calling, Gemini function declarations, etc.)

## Cost Tracking

Per LLM call, logs to `agent_logs.meta`:
```json
{
  "provider": "openai",
  "model": "gpt-4o-mini",
  "inputTokens": 512,
  "outputTokens": 128,
  "estimatedCostUsd": 0.0001
}
```

Prometheus metrics also track:
- `llm_tokens_total{provider,model,direction}`
- `llm_cost_usd_total{provider,model}`
