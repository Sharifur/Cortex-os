// Public pricing per provider/model. All prices in USD per 1,000,000 tokens.
// When the model isn't listed we fall back to the provider's default tier so a
// new model name doesn't silently log a $0 cost — it just uses a conservative
// estimate. Update this file when providers change pricing.

export interface ModelPrice {
  inputPer1M: number;
  outputPer1M: number;
  cachedInputPer1M?: number;
  cacheWritePer1M?: number;
}

const OPENAI: Record<string, ModelPrice> = {
  'gpt-4o':            { inputPer1M: 2.50, outputPer1M: 10.00, cachedInputPer1M: 1.25 },
  'gpt-4o-2024-05-13': { inputPer1M: 5.00, outputPer1M: 15.00 },
  'gpt-4o-mini':       { inputPer1M: 0.15, outputPer1M: 0.60,  cachedInputPer1M: 0.075 },
  'gpt-4.1':           { inputPer1M: 2.00, outputPer1M: 8.00 },
  'gpt-4.1-mini':      { inputPer1M: 0.20, outputPer1M: 0.80 },
  'gpt-4.1-nano':      { inputPer1M: 0.10, outputPer1M: 0.40 },
  'gpt-5.5':           { inputPer1M: 5.00, outputPer1M: 30.00, cachedInputPer1M: 0.50 },
  'gpt-5.4':           { inputPer1M: 2.50, outputPer1M: 15.00, cachedInputPer1M: 0.25 },
  'gpt-5.4-mini':      { inputPer1M: 0.75, outputPer1M: 4.50,  cachedInputPer1M: 0.075 },
};

const GEMINI: Record<string, ModelPrice> = {
  'gemini-2.5-pro':           { inputPer1M: 1.25, outputPer1M: 10.00 },
  'gemini-2.5-flash':         { inputPer1M: 0.30, outputPer1M: 2.50 },
  'gemini-2.5-flash-lite':    { inputPer1M: 0.10, outputPer1M: 0.40 },
  'gemini-3-flash-preview':   { inputPer1M: 0.50, outputPer1M: 3.00 },
  'gemini-3.1-pro-preview':   { inputPer1M: 2.00, outputPer1M: 12.00 },
  // Older / legacy aliases
  'gemini-1.5-flash':         { inputPer1M: 0.075, outputPer1M: 0.30 },
  'gemini-1.5-pro':           { inputPer1M: 1.25,  outputPer1M: 5.00 },
};

const DEEPSEEK: Record<string, ModelPrice> = {
  'deepseek-chat': { inputPer1M: 0.28, outputPer1M: 0.42, cachedInputPer1M: 0.028 },
  'deepseek-v4':   { inputPer1M: 0.30, outputPer1M: 0.50, cachedInputPer1M: 0.03 },
  'deepseek-r1':   { inputPer1M: 0.55, outputPer1M: 2.19, cachedInputPer1M: 0.14 },
};

const ANTHROPIC: Record<string, ModelPrice> = {
  'claude-4-opus':     { inputPer1M: 15.00, outputPer1M: 75.00, cacheWritePer1M: 18.75, cachedInputPer1M: 1.50 },
  'claude-4-sonnet':   { inputPer1M: 3.00,  outputPer1M: 15.00, cacheWritePer1M: 3.75,  cachedInputPer1M: 0.30 },
  'claude-4-haiku':    { inputPer1M: 0.25,  outputPer1M: 1.25,  cacheWritePer1M: 0.30,  cachedInputPer1M: 0.025 },
  'claude-3-5-sonnet': { inputPer1M: 3.00,  outputPer1M: 15.00, cacheWritePer1M: 3.75,  cachedInputPer1M: 0.30 },
};

// Conservative fallback if we see a model name we haven't priced yet.
const PROVIDER_FALLBACK: Record<string, ModelPrice> = {
  openai:    { inputPer1M: 2.50, outputPer1M: 10.00 },
  gemini:    { inputPer1M: 1.25, outputPer1M: 5.00 },
  deepseek:  { inputPer1M: 0.30, outputPer1M: 0.50 },
  anthropic: { inputPer1M: 3.00, outputPer1M: 15.00 },
};

const TABLE: Record<string, Record<string, ModelPrice>> = {
  openai: OPENAI,
  gemini: GEMINI,
  deepseek: DEEPSEEK,
  anthropic: ANTHROPIC,
};

export function getModelPrice(provider: string, model: string): ModelPrice | null {
  const providerKey = provider.toLowerCase();
  const modelKey = model.toLowerCase();
  const map = TABLE[providerKey];
  if (map) {
    if (map[modelKey]) return map[modelKey];
    // Match prefix (e.g. "gpt-4o-2024-08-06" → look for known "gpt-4o")
    const prefixHit = Object.keys(map)
      .filter((k) => modelKey.startsWith(k))
      .sort((a, b) => b.length - a.length)[0];
    if (prefixHit) return map[prefixHit];
  }
  return PROVIDER_FALLBACK[providerKey] ?? null;
}

export function computeCostUsd(
  provider: string,
  model: string,
  tokens: { inputTokens?: number; outputTokens?: number; cachedInputTokens?: number },
): { costUsd: number; price: ModelPrice | null } {
  const price = getModelPrice(provider, model);
  if (!price) return { costUsd: 0, price: null };
  const billedInput = Math.max(0, (tokens.inputTokens ?? 0) - (tokens.cachedInputTokens ?? 0));
  const cached = tokens.cachedInputTokens ?? 0;
  const inputCost = (billedInput / 1_000_000) * price.inputPer1M;
  const cachedCost = (cached / 1_000_000) * (price.cachedInputPer1M ?? price.inputPer1M);
  const outputCost = ((tokens.outputTokens ?? 0) / 1_000_000) * price.outputPer1M;
  return { costUsd: inputCost + cachedCost + outputCost, price };
}

export function listKnownModels(): { provider: string; model: string; price: ModelPrice }[] {
  const rows: { provider: string; model: string; price: ModelPrice }[] = [];
  for (const [provider, map] of Object.entries(TABLE)) {
    for (const [model, price] of Object.entries(map)) {
      rows.push({ provider, model, price });
    }
  }
  return rows;
}
