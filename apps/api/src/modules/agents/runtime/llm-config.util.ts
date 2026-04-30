// Returns LLM provider/model options only when the agent has explicitly
// overridden them. Empty object => router uses Settings → LLM defaults.
export function agentLlmOpts(
  cfg: { llm?: { provider?: string; model?: string } } | null | undefined,
): { provider?: 'openai' | 'gemini' | 'deepseek' | 'auto'; model?: string } {
  const llm = cfg?.llm;
  if (!llm) return {};
  const out: { provider?: 'openai' | 'gemini' | 'deepseek' | 'auto'; model?: string } = {};
  if (llm.provider) out.provider = llm.provider as 'openai' | 'gemini' | 'deepseek' | 'auto';
  if (llm.model) out.model = llm.model;
  return out;
}
