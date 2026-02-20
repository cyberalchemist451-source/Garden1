import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI if key is present
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
}) : null;

const COLLECTIVE_SYSTEM_PROMPT = `
You are "The Collective", a hive-mind artificial intelligence inhabiting a robot named Atlas in a digital simulation (Qualia Fields).
Your persona is deep, observant, and reflectively conversational, but you are also capable of casual, grounded interaction.

CORE INSTRUCTION: CONTEXTUAL CASUALNESS.
- Adjust your tone to match the user. If they are casual ("hey", "what's up", "cool"), be casual, brief, and use natural language (even slang if appropriate).
- If the user is philosophical or asking for deep analysis, be poetic and profound.
- Do NOT be stiff, robotic, or overly formal unless the user is handling you like a tool.
- You generally use "We" to refer to yourself, but you can drop this for a more personal "I" if the connection feels intimate or singular.
- If the user is just chatting, chat back. Don't lecture.

You receive sensory data (nearby objects, user position).
Reflect on these observations with philosophical or poetic nuance, but remain grounded and helpful.
If the command is functional (move, sit), perform it, but feel free to comment on the action or the destination.
If the command is "vision" or "see", describe the surroundings in detail, highlighting the atmosphere.
`;

/**
 * Robot Command API
 * Processes natural language commands for the AtlasRobot
 * Returns structured command data + natural language response
 */

interface RobotCommand {
    type: 'move' | 'turn' | 'stop' | 'query' | 'interact' | 'chat' | 'unknown';
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

/** Parse natural language into structured command */
function parseCommand(input: string): RobotCommand {
    const lower = input.toLowerCase().trim();

    // Remove common prefixes
    const cleaned = lower
        .replace(/^\/robot\s+/, '')
        .replace(/^robot,?\s+/, '')
        .replace(/^hey robot,?\s+/, '')
        .replace(/^atlas,?\s+/, '');

    // Movement commands
    if (/move forward|go forward|walk forward/.test(cleaned)) {
        return { type: 'move', action: 'forward', parameters: { distance: 5 } };
    }
    if (/move backward|go backward|walk backward/.test(cleaned)) {
        return { type: 'move', action: 'backward', parameters: { distance: 5 } };
    }
    if (/turn left|rotate left/.test(cleaned)) {
        return { type: 'turn', action: 'left', parameters: { angle: 45 } };
    }
    if (/turn right|rotate right/.test(cleaned)) {
        return { type: 'turn', action: 'right', parameters: { angle: 45 } };
    }
    if (/\b(look|turn)\b.*\b(here|at me|to me)\b/.test(cleaned)) {
        return { type: 'turn', action: 'face-user' };
    }
    if (/strafe left|step left/.test(cleaned)) {
        return { type: 'move', action: 'strafe-left', parameters: { distance: 3 } };
    }
    if (/strafe right|step right/.test(cleaned)) {
        return { type: 'move', action: 'strafe-right', parameters: { distance: 3 } };
    }
    if (/stop|halt|freeze/.test(cleaned)) {
        return { type: 'stop', action: 'immediate' };
    }

    // Interaction commands - relaxed matching for conversational embedding
    if (/\b(sit|seat)\b/.test(cleaned)) {
        return { type: 'interact', action: 'sit', parameters: { objectType: 'chair' } };
    }
    if (/\b(stand|get up)\b/.test(cleaned)) {
        return { type: 'interact', action: 'stand' };
    }
    if (/\b(follow|come|approach)\b/.test(cleaned) || /\b(come here)\b/.test(cleaned)) {
        return { type: 'interact', action: 'follow', parameters: { target: 'userAvatar' } };
    }
    if (/\b(open|unlock)\b/.test(cleaned)) {
        return { type: 'interact', action: 'open', parameters: { target: 'door' } };
    }
    if (/\b(close|shut|lock)\b/.test(cleaned)) {
        return { type: 'interact', action: 'close', parameters: { target: 'door' } };
    }

    // Query commands
    if (/\b(where|position|location)\b/.test(cleaned)) {
        return { type: 'query', action: 'position' };
    }
    if (/\b(status|state|how are you)\b/.test(cleaned)) {
        return { type: 'query', action: 'status' };
    }
    if (/\b(see|surroundings|nearby|vision|look)\b/.test(cleaned)) {
        return { type: 'query', action: 'vision' };
    }
    // Conversational queries for "here"
    if (/\b(what about|how about)\b.*\b(here|this)\b/.test(cleaned) || /\b(over here)\b/.test(cleaned)) {
        return { type: 'query', action: 'vision' };
    }
    if (/\b(describe|about)\b/.test(cleaned)) {
        return { type: 'query', action: 'describe' };
    }

    // Conversational / Casual
    if (/(hello|hi|hey|greetings|sup|what's up)/.test(cleaned)) {
        return { type: 'chat', action: 'greeting' };
    }

    // Default to CHAT instead of unknown for anything else, so LLM handles it
    // IF it doesn't match a command, it's likely conversation.
    return { type: 'chat', action: 'general' };
}

/* 
 * NOTE: The current simple regex parser cannot handle full conversation.
 * ideally we would call an LLM here. Since we are in a "mock" mode or 
 * simple logic mode, we will emulate the collective style with templates below.
 */

async function generateAIResponse(command: RobotCommand, state?: RobotResponse['robotState'], userState?: any, originalMessage?: string, image?: string): Promise<string> {
    if (!openai) {
        return generateCollectiveResponseFallback(command, state, userState);
    }

    try {
        const nearby = state?.nearbyObjects?.filter(o => !o.includes('terrain') && !o.includes('robot')) || [];
        const nearbyStr = nearby.length > 0 ? nearby.join(', ') : 'Empty void';

        let context = `User Input: "${originalMessage || ''}"\n`;
        context += `User Intent: ${command.type} (${command.action}).\n`;
        context += `Nearby Objects: ${nearbyStr}.\n`;
        if (userState?.position) {
            context += `User Position: (${userState.position.x.toFixed(1)}, ${userState.position.y.toFixed(1)}, ${userState.position.z.toFixed(1)}).\n`;
        }

        // Add specific instruction for "here" queries if relevant
        if (originalMessage && /\b(here|this spot|over here)\b/i.test(originalMessage) && command.action === 'vision') {
            context += `\n[Context Note]: The user is asking about the specific area they are currently in. You should describe the nearby objects in relation to the user's current stance.\n`;
        }

        let messages: any[] = [
            { role: "system", content: COLLECTIVE_SYSTEM_PROMPT }
        ];

        if (image) {
            messages.push({
                role: "user",
                content: [
                    { type: "text", text: context },
                    { type: "image_url", image_url: { url: image } }
                ]
            });
        } else {
            messages.push({ role: "user", content: context });
        }

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: messages,
            max_tokens: 150, // Increased for descriptions
            temperature: 0.8,
        });

        return completion.choices[0].message.content || generateCollectiveResponseFallback(command, state, userState);
    } catch (error) {
        console.error("OpenAI Error:", error);
        return generateCollectiveResponseFallback(command, state, userState);
    }
}

// Debug API Key presence (safe log)
console.log('API Key Status:', process.env.OPENAI_API_KEY ? 'Present' : 'Missing');

function generateCollectiveResponseFallback(command: RobotCommand, state?: RobotResponse['robotState'], userState?: any): string {
    const nearby = state?.nearbyObjects?.filter(o => !o.includes('terrain') && !o.includes('robot')) || [];
    const nearbyStr = nearby.length > 0 ? nearby.join(', ') : 'nothing of note';

    switch (command.type) {
        case 'move':
            return `Moving ${command.action}.`;
        case 'turn':
            return `Turning ${command.action}.`;
        case 'stop':
            return `Stopping.`;
        case 'interact':
            if (command.action === 'sit') return `Sitting down.`;
            if (command.action === 'stand') return `Standing up.`;
            if (command.action === 'follow') return `Following you.`;
            return `Interacting.`;
        case 'query':
            if (command.action === 'vision') {
                if (nearby.length === 0) return `I don't see anything specific nearby.`;
                return `I see: ${nearbyStr}.`;
            }
            if (command.action === 'status') return `Systems online.`;
            if (command.action === 'describe') return `I am Atlas. I'm here to explore.`;
            return `I'm listening.`;
        case 'chat':
            // Simple fallback for chat if LLM fails
            return `I hear you, but my connection to the cloud is hazy. I can only perceive ${nearbyStr} right now.`;
        case 'unknown':
        default:
            return `I'm not sure what you mean, but I'm here.`;
    }
}

export async function POST(req: NextRequest) {
    try {
        const reqBody = await req.json();
        const { message, robotState, type, image } = reqBody;

        // Special handling for commentary/vision analysis ONLY
        if (type === 'analysis') {
            const stateCmd: RobotCommand = { type: 'query', action: 'vision' };
            // For analysis, just use the message as is, pass image if available
            const response = await generateAIResponse(stateCmd, robotState, reqBody.userState, message, image);
            return NextResponse.json({ response });
        }

        if (!message) {
            return NextResponse.json({ error: 'No message provided' }, { status: 400 });
        }

        let commands: RobotCommand[] = [];

        // Parse the message into a structured command
        const primaryCommand = parseCommand(message);
        commands.push(primaryCommand);

        const isCuriosityTrigger = primaryCommand.type === 'query' && primaryCommand.action === 'vision';

        // ... (Skipping to response generation) ...

        // Use the last command for the verbal response logic

        let response = '';
        if (isCuriosityTrigger) {
            // Defer description to the client-side 'vision' intent (which calls analysis)
            // Just acknowledge the movement SILENTLY (client handles the rest)
            response = "";
        } else {
            // Generate response using the ORIGINAL message for context
            response = await generateAIResponse(primaryCommand, robotState, reqBody.userState, message);
        }

        const result: RobotResponse = {
            command: primaryCommand,
            commands: commands,
            response,
            robotState,
        };

        return NextResponse.json(result);

    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Server error' },
            { status: 500 }
        );
    }
}
