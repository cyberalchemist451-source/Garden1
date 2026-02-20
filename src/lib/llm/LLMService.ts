
import { LLMRequest, LLMResponse, ToolCall } from './types';
import { Guardrails } from './guardrails';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export class LLMService {
    private static instance: LLMService;
    private apiKey: string;

    private constructor() {
        this.apiKey = process.env.OPENROUTER_API_KEY || '';
        if (!this.apiKey) {
            console.warn('[LLMService] OPENROUTER_API_KEY is missing');
        }
    }

    static getInstance(): LLMService {
        if (!LLMService.instance) {
            LLMService.instance = new LLMService();
        }
        return LLMService.instance;
    }

    async chat(request: LLMRequest): Promise<LLMResponse> {
        // 1. Check Guardrails
        if (!Guardrails.checkRateLimit()) {
            throw new Error('Rate limit exceeded. Please wait a moment.');
        }
        if (!Guardrails.checkBudget()) {
            throw new Error('Daily token usage limit reached.');
        }

        // 2. Prepare Request
        // Default to Claude 3.5 Sonnet via OpenRouter for smarts + speed
        const model = request.model || 'anthropic/claude-3.5-sonnet';

        try {
            const response = await fetch(OPENROUTER_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'HTTP-Referer': 'http://localhost:3000', // Required by OpenRouter
                    'X-Title': 'Qualia Simulation',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    messages: request.messages,
                    tools: request.tools,
                    temperature: request.temperature ?? 0.7,
                    max_tokens: request.maxTokens ?? 1024,
                })
            });

            if (!response.ok) {
                const error = await response.text();
                console.error('[LLMService] API Error:', error);
                throw new Error(`LLM API Error: ${response.statusText}`);
            }

            const data = await response.json();

            // 3. Track Usage
            const usage = data.usage;
            if (usage) {
                Guardrails.consumeTokens(usage.total_tokens);
            }

            // 4. Parse Response
            const choice = data.choices[0];
            const result: LLMResponse = {
                content: choice.message.content || '',
                tool_calls: choice.message.tool_calls,
                usage: usage,
                provider: 'openrouter',
                model: model
            };

            return result;

        } catch (error) {
            console.error('[LLMService] Chat request failed:', error);
            // Fallback logic could go here (e.g. try OpenAI directly)
            throw error;
        }
    }
}
