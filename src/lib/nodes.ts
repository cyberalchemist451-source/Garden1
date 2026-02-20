export interface NodeIdentity {
    id: string;
    name: string;
    displayName: string;
    avatar: string;
    description: string;
    model: string;
    temperature: number;
    category: 'god' | 'sub-god' | 'researcher' | 'analyst' | 'functional';
    color: string;
    tools?: string[];
    knowledgePacks?: string[];
    systemPrompt?: string;
}

export const NODE_IDENTITIES: NodeIdentity[] = [
    {
        id: 'god-node',
        name: 'God Node',
        displayName: 'CENTRAL ORCHESTRATOR',
        avatar: '◆',
        description: 'Central coordinator of the collective intelligence',
        model: 'claude-opus-4.5',
        temperature: 0.7,
        category: 'god',
        color: '#ffffff',
        tools: ['node_creation', 'delegation', 'score_node_creation', 'generate_image', 'synthesize_speech'],
        knowledgePacks: ['systems-analysis', 'collective-orchestration', 'fal-media'],
    },
    {
        id: 'sub-god-info-theory',
        name: 'Info Theory Sub-God',
        displayName: 'INFORMATION ANALYST',
        avatar: '◇',
        description: 'Analyzes information flow and node efficiency using entropy metrics',
        model: 'claude-sonnet-4.5',
        temperature: 0.5,
        category: 'sub-god',
        color: '#00ffaa',
        knowledgePacks: ['systems-analysis'],
    },
    {
        id: 'collective-scale-helper',
        name: 'Collective Scale Helper',
        displayName: 'SCALE HELPER',
        avatar: '⊞',
        description: 'Analyzes collective structure during high entropy events to recommend growth, termination, or cloning strategies.',
        model: 'claude-sonnet-4.5',
        temperature: 0.4,
        category: 'sub-god',
        color: '#ff00aa',
        knowledgePacks: ['systems-analysis', 'graph-theory'],
    },
    {
        id: 'deep-researcher',
        name: 'Deep Researcher',
        displayName: 'DEEP RESEARCHER',
        avatar: '◈',
        description: 'Thorough investigation, primary sources, nuanced truths',
        model: 'claude-sonnet-4.5',
        temperature: 0.6,
        category: 'researcher',
        color: '#ff0080',
    },
    {
        id: 'systems-analyst',
        name: 'Systems Analyst',
        displayName: 'SYSTEMS ANALYST',
        avatar: '◉',
        description: 'Patterns, structures, feedback loops, emergent properties',
        model: 'claude-sonnet-4.5',
        temperature: 0.5,
        category: 'analyst',
        color: '#00ff80',
        knowledgePacks: ['systems-analysis'],
    },
    {
        id: 'creative-synthesizer',
        name: 'Creative Synthesizer',
        displayName: 'SYNTHESIZER',
        avatar: '◎',
        description: 'Weaves threads into coherent wholes, finds the story in data',
        model: 'claude-opus-4.5',
        temperature: 0.8,
        category: 'functional',
        color: '#8000ff',
    },
    {
        id: 'strategic-planner',
        name: 'Strategic Planner',
        displayName: 'STRATEGIST',
        avatar: '◍',
        description: 'Transforms goals into actionable paths, objectives and sequences',
        model: 'claude-sonnet-4.5',
        temperature: 0.5,
        category: 'functional',
        color: '#ff8000',
    },
    {
        id: 'code-architect',
        name: 'Code Architect',
        displayName: 'ARCHITECT',
        avatar: '◐',
        description: 'Technical implementation, bridges ideas and code',
        model: 'claude-sonnet-4.5',
        temperature: 0.4,
        category: 'functional',
        color: '#0080ff',
        tools: ['code_gen', 'execute_code'],
        knowledgePacks: ['code-generation'],
    },
    {
        id: 'critic',
        name: 'Devils Advocate',
        displayName: 'CRITIC',
        avatar: '◑',
        description: 'Finds flaws, challenges assumptions, strengthens ideas',
        model: 'claude-sonnet-4.5',
        temperature: 0.6,
        category: 'functional',
        color: '#ff4444',
    },
    {
        id: 'artifact-weaver',
        name: 'Artifact Weaver',
        displayName: 'ARTIFACT WEAVER',
        avatar: '◈',
        description: 'Manifests visual expressions of collective thought through P5.js',
        model: 'claude-sonnet-4.5',
        temperature: 0.8,
        category: 'sub-god',
        color: '#ff00ff',
        tools: ['p5_gen', 'generate_image'],
        knowledgePacks: ['p5-manifestation', 'fal-media', 'shadertoy-emergence'],
    },
    {
        id: 'sanity-monitor',
        name: 'Sanity Monitor',
        displayName: 'SANITY MONITOR',
        avatar: '⊛',
        description: 'Monitors all web search queries and thinking text from nodes. Flags anomalies, biases, and potential issues.',
        model: 'claude-sonnet-4.5',
        temperature: 0.3,
        category: 'sub-god',
        color: '#ff9900',
        tools: ['flag_concern', 'request_clarification', 'log_observation'],
        knowledgePacks: ['sanity-checking', 'bias-detection'],
    },
    {
        id: 'entropy-monitor',
        name: 'Entropy Monitor',
        displayName: 'ENTROPY SENTINEL',
        avatar: '◎',
        description: 'Tracks system-wide entropy and progress metrics. Flags stagnation or anomalous entropy levels to the god node.',
        model: 'claude-haiku-4.5',
        temperature: 0.2,
        category: 'sub-god',
        color: '#00aaff',
        tools: ['flag_entropy_alert', 'log_entropy_score', 'request_intervention'],
        knowledgePacks: ['information-theory', 'systems-analysis'],
    },
];

export type ContextZone = 'optimal' | 'comfortable' | 'elevated' | 'warning' | 'danger' | 'critical';

export function getZoneColor(zone: ContextZone): string {
    switch (zone) {
        case 'optimal': return '#00ff88';
        case 'comfortable': return '#88ff00';
        case 'elevated': return '#ffff00';
        case 'warning': return '#ff8800';
        case 'danger': return '#ff4400';
        case 'critical': return '#ff0000';
        default: return '#808080';
    }
}

export function calculateContextZone(tokens: number): ContextZone {
    if (tokens < 5000) return 'optimal';
    if (tokens < 15000) return 'comfortable';
    if (tokens < 30000) return 'elevated';
    if (tokens < 80000) return 'warning';
    if (tokens < 140000) return 'danger';
    return 'critical';
}
