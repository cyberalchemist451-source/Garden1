export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  promptPrice: number;
  completionPrice: number;
  contextLength: number;
  description: string;
  category: 'cerebras' | 'apex';
  isFree?: boolean;
}

export const CEREBRAS_MODELS: ModelConfig[] = [
  { id: 'google/gemini-3-flash-preview', name: 'Gemini 3 Flash Preview', provider: 'Google', promptPrice: 5e-7, completionPrice: 3e-6, contextLength: 1048576, description: 'High speed thinking model for agentic workflows', category: 'cerebras' },
  { id: 'deepseek/deepseek-v3.2', name: 'DeepSeek V3.2', provider: 'DeepSeek', promptPrice: 25e-8, completionPrice: 38e-8, contextLength: 163840, description: 'GPT-5 class reasoning at ultra-low cost', category: 'cerebras' },
  { id: 'anthropic/claude-haiku-4.5', name: 'Claude Haiku 4.5', provider: 'Anthropic', promptPrice: 8e-7, completionPrice: 4e-6, contextLength: 200000, description: 'Fast, precise, excellent for coding', category: 'cerebras' },
  { id: 'mistralai/devstral-2512', name: 'Devstral 2', provider: 'Mistral', promptPrice: 5e-8, completionPrice: 22e-8, contextLength: 262144, description: 'State-of-the-art agentic coding model', category: 'cerebras' },
  { id: 'mistralai/ministral-8b-2512', name: 'Ministral 3 8B', provider: 'Mistral', promptPrice: 15e-8, completionPrice: 15e-8, contextLength: 262144, description: 'Efficient tiny model with vision', category: 'cerebras' },
  { id: 'bytedance-seed/seed-1.6-flash', name: 'Seed 1.6 Flash', provider: 'ByteDance', promptPrice: 75e-9, completionPrice: 3e-7, contextLength: 262144, description: 'Ultra-fast multimodal thinking', category: 'cerebras' },
  { id: 'arcee-ai/trinity-mini', name: 'Trinity Mini', provider: 'Arcee', promptPrice: 45e-9, completionPrice: 15e-8, contextLength: 131072, description: 'MoE model for reasoning and agents', category: 'cerebras' },
  { id: 'nvidia/nemotron-3-nano-30b-a3b', name: 'Nemotron 3 Nano', provider: 'NVIDIA', promptPrice: 6e-8, completionPrice: 24e-8, contextLength: 262144, description: 'Efficient agentic AI systems', category: 'cerebras' },
];

export const FREE_MODELS: ModelConfig[] = [
  { id: 'mistralai/devstral-2512:free', name: 'Devstral 2 (Free)', provider: 'Mistral', promptPrice: 0, completionPrice: 0, contextLength: 262144, description: 'Free agentic coding model', category: 'cerebras', isFree: true },
  { id: 'xiaomi/mimo-v2-flash:free', name: 'MiMo V2 Flash (Free)', provider: 'Xiaomi', promptPrice: 0, completionPrice: 0, contextLength: 262144, description: 'Top open-source model, comparable to Sonnet 4.5', category: 'cerebras', isFree: true },
  { id: 'nvidia/nemotron-3-nano-30b-a3b:free', name: 'Nemotron 3 Nano (Free)', provider: 'NVIDIA', promptPrice: 0, completionPrice: 0, contextLength: 256000, description: 'Free efficient AI for agents', category: 'cerebras', isFree: true },
  { id: 'arcee-ai/trinity-mini:free', name: 'Trinity Mini (Free)', provider: 'Arcee', promptPrice: 0, completionPrice: 0, contextLength: 131072, description: 'Free MoE reasoning model', category: 'cerebras', isFree: true },
];

export const APEX_MODELS: ModelConfig[] = [
  { id: 'anthropic/claude-opus-4.5', name: 'Claude Opus 4.5', provider: 'Anthropic', promptPrice: 5e-6, completionPrice: 25e-6, contextLength: 200000, description: 'Frontier reasoning, agentic workflows', category: 'apex' },
  { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5', provider: 'Anthropic', promptPrice: 3e-6, completionPrice: 15e-6, contextLength: 200000, description: 'Balanced power and efficiency', category: 'apex' },
  { id: 'openai/gpt-5.2', name: 'GPT-5.2', provider: 'OpenAI', promptPrice: 175e-8, completionPrice: 14e-6, contextLength: 400000, description: 'Frontier adaptive reasoning', category: 'apex' },
  { id: 'openai/gpt-5.2-pro', name: 'GPT-5.2 Pro', provider: 'OpenAI', promptPrice: 21e-6, completionPrice: 168e-6, contextLength: 400000, description: 'Maximum capability model', category: 'apex' },
  { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google', promptPrice: 25e-7, completionPrice: 15e-6, contextLength: 1048576, description: 'Deep thinking and analysis', category: 'apex' },
  { id: 'mistralai/mistral-large-2512', name: 'Mistral Large 3', provider: 'Mistral', promptPrice: 5e-7, completionPrice: 15e-7, contextLength: 262144, description: '675B MoE, Apache 2.0', category: 'apex' },
];

export function calculateRequestCost(model: ModelConfig, promptTokens: number, completionTokens: number): number {
  return model.promptPrice * promptTokens + model.completionPrice * completionTokens;
}

export function formatCost(cost: number): string {
  if (cost === 0) return '$0.00';
  if (cost < 1e-4) return `$${(1e6 * cost).toFixed(4)}µ`;
  if (cost < 0.01) return `$${cost.toFixed(6)}`;
  return `$${cost.toFixed(4)}`;
}

export function getModelById(id: string): ModelConfig | undefined {
  return [...CEREBRAS_MODELS, ...FREE_MODELS, ...APEX_MODELS].find(m => m.id === id);
}
