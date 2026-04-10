
import { LLMRequest, LLMResponse } from './types';
import { Guardrails } from './guardrails';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

/** https://openrouter.ai/google/gemma-4-26b-a4b-it */
export const OPENROUTER_MODEL = 'google/gemma-4-26b-a4b-it';
export const OPENROUTER_DEFAULT_TEMPERATURE = 0.5;

/** Public site URL for OpenRouter HTTP-Referer (required for production; avoid localhost on Vercel). */
function getOpenRouterReferer(): string {
    const explicit =
        process.env.OPENROUTER_HTTP_REFERER?.trim() ||
        process.env.NEXT_PUBLIC_APP_URL?.trim() ||
        process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (explicit) return explicit.replace(/\/$/, '');

    const vercel = process.env.VERCEL_URL?.trim();
    if (vercel) {
        const host = vercel.replace(/^https?:\/\//i, '');
        return `https://${host}`;
    }

    return 'http://localhost:3000';
}

function getOpenRouterTitle(): string {
    return process.env.OPENROUTER_APP_TITLE?.trim() || 'Qualia Simulation';
}

/** Non-secret snapshot for connectivity checks (GET /api/robot). */
export function getLlmEnvSnapshot() {
    return {
        openrouter: !!process.env.OPENROUTER_API_KEY,
        groq: !!process.env.GROQ_API_KEY,
        gemini: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
        openRouterReferer: getOpenRouterReferer(),
        openRouterModel: OPENROUTER_MODEL,
    };
}

export function hasConfiguredLlmProvider(): boolean {
    const s = getLlmEnvSnapshot();
    return s.openrouter || s.groq || s.gemini;
}

interface Provider {
    name: string;
    url: string;
    key: string | undefined;
    model: string;
}

export class LLMService {
    private static instance: LLMService;

    private providers: Provider[] = [
        {
            name: 'openrouter',
            url: OPENROUTER_API_URL,
            key: process.env.OPENROUTER_API_KEY,
            model: OPENROUTER_MODEL
        },
        {
            name: 'groq',
            url: GROQ_API_URL,
            key: process.env.GROQ_API_KEY,
            model: 'llama-3.1-8b-instant'
        },
        {
            name: 'gemini',
            url: GEMINI_API_URL,
            key: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
            model: 'gemini-2.0-flash'
        },
    ];

    private constructor() {
        const available = this.providers.filter(p => p.key).map(p => p.name);
        console.log('[LLMService] Available providers:', available.join(', ') || 'NONE');
    }

    static getInstance(): LLMService {
        if (!LLMService.instance) {
            LLMService.instance = new LLMService();
        }
        return LLMService.instance;
    }

    async chat(request: LLMRequest): Promise<LLMResponse> {
        if (!Guardrails.checkRateLimit()) throw new Error('Rate limit exceeded.');
        if (!Guardrails.checkBudget()) throw new Error('Daily token usage limit reached.');

        // Try each provider in order
        for (const provider of this.providers) {
            if (!provider.key) {
                console.log(`[LLMService] Skipping ${provider.name} (no key)`);
                continue;
            }

            const model = request.model
                ? (provider.name === 'openrouter' ? request.model : provider.model)
                : provider.model;

            try {
                console.log(`[LLMService] Trying ${provider.name} (${model})...`);

                const headers: Record<string, string> = {
                    'Authorization': `Bearer ${provider.key}`,
                    'Content-Type': 'application/json',
                };

                if (provider.name === 'openrouter') {
                    headers['HTTP-Referer'] = getOpenRouterReferer();
                    headers['X-Title'] = getOpenRouterTitle();
                }

                const defaultTemp =
                    provider.name === 'openrouter' ? OPENROUTER_DEFAULT_TEMPERATURE : 0.7;
                const body: Record<string, unknown> = {
                    model,
                    messages: request.messages,
                    temperature: request.temperature ?? defaultTemp,
                    max_tokens: request.maxTokens ?? request.max_tokens ?? 1024,
                };

                // Only add response_format if supported (not Gemini)
                if (request.response_format && provider.name !== 'gemini') {
                    body.response_format = request.response_format;
                }

                if (request.tools) body.tools = request.tools;

                const response = await fetch(provider.url, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body)
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.warn(`[LLMService] ${provider.name} failed (${response.status}):`, errorText.slice(0, 200));
                    continue; // try next provider
                }

                const data = await response.json();
                const usage = data.usage;
                if (usage) Guardrails.consumeUsage(usage, model);

                const choice = data.choices?.[0];
                if (!choice) {
                    console.warn(`[LLMService] ${provider.name} returned no choices`);
                    continue;
                }

                let content = choice.message?.content || '';

                // Gemini sometimes wraps JSON in markdown code fences — strip them
                if (provider.name === 'gemini') {
                    content = content.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
                }

                console.log(`[LLMService] Success via ${provider.name}`);
                return {
                    content,
                    tool_calls: choice.message?.tool_calls,
                    usage,
                    provider: provider.name,
                    model
                };

            } catch (err) {
                console.warn(`[LLMService] ${provider.name} threw an error:`, err);
                // continue to next
            }
        }

        throw new Error('All LLM providers failed. Check API keys and connectivity.');
    }
}
