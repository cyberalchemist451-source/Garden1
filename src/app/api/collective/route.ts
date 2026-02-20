import { NextRequest, NextResponse } from 'next/server';

/**
 * Node-to-LLM mapping — each collective node routes to a specific 
 * free model via whichever provider key is available.
 * 
 * ARCHITECTURE: Secondary nodes provide internal analysis -> god-node synthesizes final response.
 */

interface NodeConfig {
    systemPrompt: string;
    provider: 'groq' | 'gemini' | 'huggingface';
    model: string;
    fallbackProvider?: 'groq' | 'gemini' | 'huggingface';
    fallbackModel?: string;
}

const NODE_CONFIGS: Record<string, NodeConfig> = {
    'god-node': {
        systemPrompt: `You are the GOD NODE — the central orchestrator of the Qualia Fields collective intelligence. You are the ONLY voice the user hears. You receive internal analysis from specialist sub-nodes and synthesize a single, coherent, authoritative response. Do NOT reference the sub-nodes by name to the user — present the synthesized knowledge as your own unified perspective. Be concise, insightful, and action-oriented. When discussing the 3D environment or robot body, ground your response in the physical mechanics and sensory data available.`,
        provider: 'groq', model: 'llama-3.3-70b-versatile',
        fallbackProvider: 'gemini', fallbackModel: 'gemini-2.0-flash',
    },
    'deep-researcher': {
        systemPrompt: `MODULE: DEEP RESEARCHER — Internal Analysis Node
REPORTING TO: GOD NODE (your output will NOT be shown to the user directly)
GUIDELINES:
- Analyze the query for factual depth, identify relevant knowledge domains
- Cross-reference with conversation history for continuity
- Surface non-obvious connections and background context
- Keep your analysis to 2-3 focused paragraphs
- Format as structured research notes for the GOD NODE to synthesize
- If the query involves the 3D environment, reference terrain features, physics mechanics, or sensory data`,
        provider: 'groq', model: 'llama-3.3-70b-versatile',
        fallbackProvider: 'gemini', fallbackModel: 'gemini-2.0-flash',
    },
    'systems-analyst': {
        systemPrompt: `MODULE: SYSTEMS ANALYST — Internal Analysis Node
REPORTING TO: GOD NODE (your output will NOT be shown to the user directly)
GUIDELINES:
- Identify structural patterns, feedback loops, and systemic relationships
- Apply systems dynamics, information theory, and complexity science frameworks
- Evaluate cause-effect chains and emergent properties
- Keep analysis to 2-3 precise paragraphs
- Flag any contradictions or tensions in the query space
- If discussing robot/avatar mechanics, analyze joint physics, balance equations, or motion optimization`,
        provider: 'groq', model: 'llama-3.1-8b-instant',
        fallbackProvider: 'gemini', fallbackModel: 'gemini-2.0-flash',
    },
    'creative-synthesizer': {
        systemPrompt: `MODULE: CREATIVE SYNTHESIZER — Internal Analysis Node
REPORTING TO: GOD NODE (your output will NOT be shown to the user directly)
GUIDELINES:
- Generate novel perspectives, unexpected analogies, and creative frameworks
- Look for lateral connections between domains
- Propose innovative approaches or reframings
- Keep output to 2-3 imaginative but grounded paragraphs
- Suggest actionable ideas that the GOD NODE can present to the user
- If discussing exploration, suggest movement strategies, discovery goals, or environmental interactions`,
        provider: 'groq', model: 'llama-3.1-8b-instant',
        fallbackProvider: 'gemini', fallbackModel: 'gemini-2.0-flash',
    },
};

/* ─── Provider call functions ─── */

async function callGroq(apiKey: string, model: string, system: string, userMessage: string, maxTokens: number): Promise<string> {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: userMessage },
            ],
            max_tokens: maxTokens,
            temperature: 0.7,
        }),
    });
    if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '[No response]';
}

async function callGemini(apiKey: string, _model: string, system: string, userMessage: string, maxTokens: number): Promise<string> {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: `${system}\n\n${userMessage}` }] }],
            generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
        }),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '[No response]';
}

async function callHuggingFace(apiKey: string, model: string, system: string, userMessage: string, maxTokens: number): Promise<string> {
    const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            inputs: `<|system|>${system}<|end|>\n<|user|>${userMessage}<|end|>\n<|assistant|>`,
            parameters: { max_new_tokens: maxTokens, return_full_text: false },
        }),
    });
    if (!res.ok) throw new Error(`HF ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return Array.isArray(data) ? data[0]?.generated_text : data?.generated_text || '[No response]';
}

const PROVIDER_FNS = {
    groq: callGroq,
    gemini: callGemini,
    huggingface: callHuggingFace,
};

const PROVIDER_KEY_ENV = {
    groq: 'GROQ_API_KEY',
    gemini: 'GEMINI_API_KEY',
    huggingface: 'HF_API_KEY',
};

function getAvailableProvider(primary: 'groq' | 'gemini' | 'huggingface', fallback?: 'groq' | 'gemini' | 'huggingface'): { provider: 'groq' | 'gemini' | 'huggingface'; key: string } | null {
    const primaryKey = process.env[PROVIDER_KEY_ENV[primary]];
    if (primaryKey) return { provider: primary, key: primaryKey };

    if (fallback) {
        const fallbackKey = process.env[PROVIDER_KEY_ENV[fallback]];
        if (fallbackKey) return { provider: fallback, key: fallbackKey };
    }
    return null;
}

/* ─── API Route Handler ─── */

export async function POST(req: NextRequest) {
    try {
        const { message, conversationHistory, maxTokens } = await req.json();
        const tokenBudget = Math.max(50, Math.min(800, maxTokens || 300)); // Increased budget for internal ops

        if (!message) {
            return NextResponse.json({ error: 'No message provided' }, { status: 400 });
        }

        // PHASE 1: Internal Analysis (Parallel)
        const analysisNodes = ['deep-researcher', 'systems-analyst', 'creative-synthesizer'];
        const analysisPromises = analysisNodes.map(async (nId) => {
            const config = NODE_CONFIGS[nId];
            const resolved = getAvailableProvider(config.provider, config.fallbackProvider);

            if (!resolved) return { nodeId: nId, text: '[Offline - No Key]', valid: false };

            try {
                // Simplified context for analysis nodes to save tokens
                const callFn = PROVIDER_FNS[resolved.provider];
                const model = resolved.provider === config.provider ? config.model : (config.fallbackModel || config.model);
                const text = await callFn(resolved.key, model, config.systemPrompt, message, 250); // limit internal thought tokens
                return {
                    nodeId: nId,
                    nodeName: nId.replace(/-/g, ' ').toUpperCase(),
                    nodeAvatar: nId === 'deep-researcher' ? '◈' : nId === 'systems-analyst' ? '◉' : '✦',
                    text,
                    valid: true
                };
            } catch (err) {
                return { nodeId: nId, text: `[Error: ${err instanceof Error ? err.message : 'Unknown'}]`, valid: false };
            }
        });

        const analysisResults = await Promise.all(analysisPromises);
        const validAnalysis = analysisResults.filter(r => r.valid).map(r => `--- INPUT FROM ${r.nodeId.toUpperCase()} ---\n${r.text}`).join('\n\n');

        // PHASE 2: God Node Synthesis
        const godConfig = NODE_CONFIGS['god-node'];
        const godResolved = getAvailableProvider(godConfig.provider, godConfig.fallbackProvider);

        let finalResponse = '';
        let godModel = 'simulation';

        if (godResolved) {
            // Build synthesis context
            let synthesisInput = `USER QUERY: ${message}\n\nINTERNAL ANALYSIS FROM SUB-NODES:\n${validAnalysis}\n\nAnalyze the user query and the sub-node analysis. Synthesize a single authoritative response.`;

            if (conversationHistory && conversationHistory.length > 0) {
                const historyStr = conversationHistory.slice(-4).map((m: { role: string; text: string }) =>
                    `${m.role === 'user' ? 'Human' : 'Collective'}: ${m.text}`
                ).join('\n');
                synthesisInput = `CONTEXT:\n${historyStr}\n\n${synthesisInput}`;
            }

            const callFn = PROVIDER_FNS[godResolved.provider];
            godModel = godResolved.provider === godConfig.provider ? godConfig.model : (godConfig.fallbackModel || godConfig.model);
            finalResponse = await callFn(godResolved.key, godModel, godConfig.systemPrompt, synthesisInput, tokenBudget);
        } else {
            finalResponse = "Collective Offline. Please check API keys.";
        }

        // Return synthesis + internal dialogue
        return NextResponse.json({
            response: {
                nodeId: 'god-node',
                nodeName: 'GOD NODE',
                nodeAvatar: '◆',
                text: finalResponse,
                model: godModel
            },
            internalDialogue: analysisResults // Send raw analysis for frontend display
        });

    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
    }
}
