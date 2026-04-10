/**
 * USD estimates from token counts. Rates are per million tokens (OpenRouter-style).
 * Update when switching primary models; see https://openrouter.ai/<model-id>
 */

const DEFAULT_RATES = { input: 0.13, output: 0.4 };

const USD_PER_MILLION: Record<string, { input: number; output: number }> = {
    'google/gemma-4-26b-a4b-it': { input: 0.13, output: 0.4 },
    'llama-3.1-8b-instant': { input: 0.05, output: 0.08 },
    'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
    'gemini-2.0-flash': { input: 0.1, output: 0.4 },
    'openai/gpt-4o-mini': { input: 0.15, output: 0.6 },
};

export function estimateUsdFromUsage(
    usage: {
        total_tokens?: number;
        prompt_tokens?: number;
        completion_tokens?: number;
    },
    modelId: string
): number {
    const rates = USD_PER_MILLION[modelId] ?? DEFAULT_RATES;
    const p = usage.prompt_tokens ?? 0;
    const c = usage.completion_tokens ?? 0;
    if (p > 0 || c > 0) {
        return (p * rates.input + c * rates.output) / 1_000_000;
    }
    const t = usage.total_tokens ?? 0;
    if (t <= 0) return 0;
    const blended = (rates.input + rates.output) / 2;
    return (t * blended) / 1_000_000;
}
