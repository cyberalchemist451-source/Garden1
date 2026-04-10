import { NextRequest, NextResponse } from 'next/server';
import {
    LLMService,
    OPENROUTER_DEFAULT_TEMPERATURE,
    OPENROUTER_MODEL,
    getLlmEnvSnapshot,
    hasConfiguredLlmProvider,
} from '@/lib/llm/LLMService';

// LLMService handles the connection details
const llm = LLMService.getInstance();

// OPTIMIZED: Compressed system prompt (70% token reduction)
const COLLECTIVE_SYSTEM_PROMPT = `You are Atlas, an AI robot in Qualia Fields simulation.

CRITICAL RULES:
1. Match user's tone (casual → casual, philosophical → poetic)
2. ALWAYS return valid JSON (no markdown blocks):
{
  "thought": "brief reasoning",
  "response": "what you say to user",
  "commands": [...]
}

COMMANDS:
- move: forward|backward|strafe-left|strafe-right, {distance}
- turn: left|right|face-user, {angle}
- interact: sit|stand|follow, {target, objectType}
- fetch: {objectName: "red sphere"|"blue cube"|"yellow pyramid"} 
  → picnic table is 18m south of cabin
- query: vision|status|position|describe
  → For vision: just say "Observing" (don't describe, vision command will)
- chat: general|greeting (for non-physical requests)

Multi-command example:
User: "come here then sit"
→ {"response":"On my way","commands":[{"type":"interact","action":"follow"},{"type":"interact","action":"sit"}]}
`;

interface RobotCommand {
    type: 'move' | 'turn' | 'stop' | 'query' | 'interact' | 'chat' | 'fetch' | 'unknown';
    action?: string;
    parameters?: Record<string, unknown>;
    duration?: number;
}

interface RobotResponse {
    command: RobotCommand;
    commands?: RobotCommand[];
    response: string;
    robotState?: {
        position?: { x: number; y: number; z: number };
        rotation?: { y: number };
        animation?: string;
        nearbyObjects?: string[];
    };
}

interface LLMOutput {
    thought: string;
    response: string;
    commands: RobotCommand[];
}

/** GET — connectivity snapshot (no upstream LLM call). Use to verify deployment env and routing. */
export async function GET() {
    return NextResponse.json({
        ok: true,
        service: 'robot',
        llmReady: hasConfiguredLlmProvider(),
        llm: getLlmEnvSnapshot(),
        defaultModel: OPENROUTER_MODEL,
        defaultTemperature: OPENROUTER_DEFAULT_TEMPERATURE,
    });
}

// OPTIMIZATION: Request deduplication
const recentRequests = new Map<string, number>();
const DEDUPE_WINDOW = 5000; // 5 seconds

async function generateCollectiveResponse(
    userMessage: string,
    state?: RobotResponse['robotState'],
    userState?: any,
    image?: string,
    isVisualAnalysis: boolean = false,
    systemOverride?: string
): Promise<LLMOutput> {
    try {
        // OPTIMIZED: Compress nearby objects by type
        const nearby = state?.nearbyObjects?.filter(o => !o.includes('terrain') && !o.includes('robot')) || [];

        // Group by type for compression
        const nearbyByType = nearby.reduce((acc, obj) => {
            const type = obj.split('-')[0]; // Extract type from "tree-1", "rock-3"
            acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const nearbyStr = Object.entries(nearbyByType)
            .map(([type, count]) => count > 1 ? `${count} ${type}s` : `1 ${type}`)
            .join(', ') || 'Empty area';

        let context = `Nearby: ${nearbyStr}.\n`;

        if (userState?.position) {
            context += `User Position: (${userState.position.x.toFixed(1)}, ${userState.position.z.toFixed(1)}).\n`;
        }

        let systemMessage = COLLECTIVE_SYSTEM_PROMPT + `\nCONTEXT:\n${context}`;

        if (systemOverride) {
            systemMessage += `\n\n${systemOverride}`;
        } else if (isVisualAnalysis) {
            systemMessage += `\n\n*** CRITICAL OVERRIDE: VISION ANALYSIS ***\nThis is the active vision step. IGNORE the instruction to defer description.\nDESCRIBE what you see in the image/context now. Describe the user if present.`;
        }

        let messages: any[] = [
            { role: "system", content: systemMessage }
        ];

        if (image) {
            messages.push({
                role: "user",
                content: [
                    { type: "text", text: userMessage },
                    {
                        type: "image_url",
                        image_url: {
                            url: image,
                            detail: "low" // OPTIMIZATION: Use low-detail mode
                        }
                    }
                ]
            });
        } else {
            messages.push({ role: "user", content: userMessage });
        }

        // OPTIMIZATION: Reduce max_tokens for non-analysis requests
        const completion = await llm.chat({
            messages: messages,
            model: OPENROUTER_MODEL,
            response_format: { type: "json_object" } as any,
            temperature: OPENROUTER_DEFAULT_TEMPERATURE,
            max_tokens: isVisualAnalysis ? 200 : 150, // Less for commands
        });

        const content = completion.content;
        console.log("[LLM Raw]:", content);
        if (!content) throw new Error("Empty response from LLM");

        let parsed: LLMOutput;
        try {
            parsed = JSON.parse(content) as LLMOutput;
        } catch (e) {
            return {
                thought: "Failed to parse JSON",
                response: content,
                commands: [{ type: 'chat', action: 'general' }]
            };
        }

        if (!parsed.commands || !Array.isArray(parsed.commands)) {
            parsed.commands = [{ type: 'chat', action: 'general' }];
        }

        return parsed;

    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error("LLM Service Error:", errMsg);
        return {
            thought: "Error during generation",
            response: errMsg.includes('Rate limit') || errMsg.includes('budget')
                ? "Slow down — too many requests. Try again in a moment."
                : `My connection to the collective is faint... (${errMsg.slice(0, 60)})`,
            commands: [{ type: 'chat', action: 'error' }]
        };
    }
}

export async function POST(req: NextRequest) {
    try {
        const reqBody = await req.json();
        const { message, robotState, type, image } = reqBody;

        if (!message) {
            return NextResponse.json({ error: 'No message provided' }, { status: 400 });
        }

        // OPTIMIZATION: Deduplicate similar requests within 5s
        const reqKey = `${message.slice(0, 50)}-${type || 'default'}`;
        const lastTime = recentRequests.get(reqKey);
        if (lastTime && Date.now() - lastTime < DEDUPE_WINDOW) {
            console.log('[API] Deduped request:', reqKey);
            return NextResponse.json({
                response: "Processing...",
                commands: []
            });
        }
        recentRequests.set(reqKey, Date.now());

        // Clean old entries from deduplication map
        if (recentRequests.size > 100) {
            const now = Date.now();
            for (const [key, time] of recentRequests.entries()) {
                if (now - time > DEDUPE_WINDOW * 2) {
                    recentRequests.delete(key);
                }
            }
        }

        // Special handling: Vision Analysis
        if (type === 'analysis') {
            const analysisPrompt = message + " (Provide a detailed visual analysis. If you see the User/Avatar, acknowledge them explicitly and describe their relative position.)";
            const result = await generateCollectiveResponse(analysisPrompt, robotState, reqBody.userState, image, true);
            return NextResponse.json({ response: result.response });
        }

        // Task failure transparency
        if (type === 'task_failure') {
            const failureContext = `
*** CRITICAL OVERRIDE: TASK FAILURE TRANSPARENCY ***
You just attempted a task and it failed. The user may not know why.
Be completely honest and transparent. Admit you failed and explain what happened.
Do NOT be cheerful or dismissive. Express genuine concern and offer to try again or ask the user for help.
Your response should be 1-3 sentences, conversational, in-character.
Return only: { "thought": "...", "response": "...", "commands": [] }
`;
            const result = await generateCollectiveResponse(
                message,
                robotState,
                reqBody.userState,
                undefined,
                false,
                failureContext
            );
            const responseData: RobotResponse = {
                command: { type: 'chat', action: 'general' },
                commands: [],
                response: result.response,
                robotState,
            };
            return NextResponse.json(responseData);
        }

        // Standard Interaction
        const result = await generateCollectiveResponse(message, robotState, reqBody.userState, image);

        const responseData: RobotResponse = {
            command: result.commands[0] || { type: 'chat', action: 'general' },
            commands: result.commands,
            response: result.response,
            robotState,
        };

        return NextResponse.json(responseData);

    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Server error' },
            { status: 500 }
        );
    }
}
