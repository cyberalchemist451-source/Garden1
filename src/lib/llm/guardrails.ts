import { estimateUsdFromUsage } from './tokenCost';

/**
 * Guardrails System
 * Prevents API abuse and manages costs via token budgeting and rate limiting.
 */

// Simple in-memory storage for now.
// In a real app, this should be Redis or a database.
const usageStore = {
    dailyTokens: 0,
    promptTokens: 0,
    completionTokens: 0,
    estimatedUsd: 0,
    lastReset: Date.now(),
    requestTimestamps: [] as number[],
};

const CONFIG = {
    MAX_DAILY_TOKENS: 100000, // raised — passive vision + chat is higher usage
    MAX_REQUESTS_PER_MINUTE: 20, // raised — Gemini free tier allows 15 RPM, Groq much higher
    RESET_INTERVAL_MS: 24 * 60 * 60 * 1000,
};

export class Guardrails {
    static checkBudget(): boolean {
        this.resetIfNewDay();
        return usageStore.dailyTokens < CONFIG.MAX_DAILY_TOKENS;
    }

    /**
     * Record a completion from an OpenAI-compatible `usage` object.
     * `modelId` should be the model string returned by the provider (used for USD estimate).
     */
    static consumeUsage(
        usage: {
            total_tokens?: number;
            prompt_tokens?: number;
            completion_tokens?: number;
        },
        modelId: string
    ) {
        this.resetIfNewDay();
        const prompt = usage.prompt_tokens ?? 0;
        const completion = usage.completion_tokens ?? 0;
        const totalFromApi = usage.total_tokens ?? prompt + completion;
        if (totalFromApi <= 0 && prompt === 0 && completion === 0) return;

        usageStore.dailyTokens += totalFromApi;
        usageStore.promptTokens += prompt;
        usageStore.completionTokens += completion;
        usageStore.estimatedUsd += estimateUsdFromUsage(
            {
                total_tokens: usage.total_tokens,
                prompt_tokens: usage.prompt_tokens,
                completion_tokens: usage.completion_tokens,
            },
            modelId
        );
    }

    static checkRateLimit(): boolean {
        const now = Date.now();
        // Remove timestamps older than 1 minute
        usageStore.requestTimestamps = usageStore.requestTimestamps.filter(t => now - t < 60000);

        if (usageStore.requestTimestamps.length >= CONFIG.MAX_REQUESTS_PER_MINUTE) {
            return false;
        }

        usageStore.requestTimestamps.push(now);
        return true;
    }

    static getUsageStats() {
        this.resetIfNewDay();
        return {
            used: usageStore.dailyTokens,
            promptTokens: usageStore.promptTokens,
            completionTokens: usageStore.completionTokens,
            estimatedUsd: usageStore.estimatedUsd,
            limit: CONFIG.MAX_DAILY_TOKENS,
            remaining: CONFIG.MAX_DAILY_TOKENS - usageStore.dailyTokens,
            isRateLimited: usageStore.requestTimestamps.length >= CONFIG.MAX_REQUESTS_PER_MINUTE,
        };
    }

    private static resetIfNewDay() {
        const now = Date.now();
        if (now - usageStore.lastReset > CONFIG.RESET_INTERVAL_MS) {
            usageStore.dailyTokens = 0;
            usageStore.promptTokens = 0;
            usageStore.completionTokens = 0;
            usageStore.estimatedUsd = 0;
            usageStore.lastReset = now;
            usageStore.requestTimestamps = [];
            console.log('[Guardrails] Daily token budget reset.');
        }
    }
}
