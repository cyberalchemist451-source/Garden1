
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
    name?: string;
}

export interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string; // JSON string
    };
}

export interface LLMRequest {
    messages: ChatMessage[];
    tools?: ToolDefinition[];
    temperature?: number;
    maxTokens?: number;
    max_tokens?: number; // Alias used by some callers
    response_format?: { type: 'json_object' | 'text' };
    provider?: 'openrouter' | 'openai' | 'anthropic' | 'google';
    model?: string;
}

export interface LLMResponse {
    content: string;
    tool_calls?: ToolCall[];
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    provider: string;
    model: string;
}

export interface ToolDefinition {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: Record<string, any>; // JSON Schema
    };
}

export interface ProviderConfig {
    apiKey: string;
    baseUrl?: string;
    defaultModel: string;
}
