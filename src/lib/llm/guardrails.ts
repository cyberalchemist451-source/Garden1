
/**
 * Guardrails System
 * Prevents API abuse and manages costs via token budgeting and rate limiting.
 */

// Simple in-memory storage for now. 
// In a real app, this should be Redis or a database.
const usageStore = {
    dailyTokens: 0,
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

    static consumeTokens(amount: number) {
        this.resetIfNewDay();
        usageStore.dailyTokens += amount;
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
        return {
            used: usageStore.dailyTokens,
            limit: CONFIG.MAX_DAILY_TOKENS,
            remaining: CONFIG.MAX_DAILY_TOKENS - usageStore.dailyTokens,
            isRateLimited: usageStore.requestTimestamps.length >= CONFIG.MAX_REQUESTS_PER_MINUTE
        };
    }

    private static resetIfNewDay() {
        const now = Date.now();
        if (now - usageStore.lastReset > CONFIG.RESET_INTERVAL_MS) {
            usageStore.dailyTokens = 0;
            usageStore.lastReset = now;
            usageStore.requestTimestamps = [];
            console.log('[Guardrails] Daily token budget reset.');
        }
    }
}
