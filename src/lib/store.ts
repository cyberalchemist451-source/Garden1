import { create } from 'zustand';
import { ContextZone } from '@/lib/nodes';

export interface NodeState {
    id: string;
    position: { x: number; y: number; z: number };
    identity: {
        color: string;
        category: 'god' | 'sub-god' | 'memory' | 'default';
        label: string;
        avatar?: string;
        displayName?: string;
        model?: string;
    };
    connections: string[];
    isActive: boolean;
    isStreaming: boolean;
    data?: any;
    status?: string;
    display?: 'hidden' | 'visible'; // To fix 'isStreaming' removal if needed, but keeping changes minimal
    contextState: {
        usagePercent: number;
        zone: ContextZone;
    };
}

export interface CollectiveStore {
    nodes: NodeState[];
    isProcessing: boolean;
    pricing: {
        sessionCost: number;
        llmCost: number;
        toolCallCost: number;
        promptTokens: number;
        completionTokens: number;
    };
    infoTheoryMetrics: {
        overallHealth: number;
        informationGain: number;
        entropy: number;
        redundancy: number;
        taskRelevance: number;
    };
    busStatus: string;
    lastResponse: string;
    startQuery: (query: string) => void;
    endQuery: (response?: string) => void;
    simulateActivity: () => void;
    isHeavyMode: boolean;

    initializeNodes: () => void;
    activateNode: (id: string) => void;
    setProcessing: (processing: boolean) => void;
    toggleModelMode: () => void;
}

export const useCollectiveStore = create<CollectiveStore>((set) => ({
    nodes: [],
    isProcessing: false,
    pricing: {
        sessionCost: 0,
        llmCost: 0,
        toolCallCost: 0,
        promptTokens: 0,
        completionTokens: 0
    },
    infoTheoryMetrics: {
        overallHealth: 1.0,
        informationGain: 0.5,
        entropy: 0.3,
        redundancy: 0.2,
        taskRelevance: 0.8
    },
    simulateActivity: () => { },
    busStatus: 'idle',
    lastResponse: '',
    startQuery: () => { },
    endQuery: (response?: string) => { set({ lastResponse: response || '' }) },
    isHeavyMode: false,

    toggleModelMode: () => set((state) => ({ isHeavyMode: !state.isHeavyMode })),

    initializeNodes: () => {
        // Create initial placeholder nodes if empty
        const initialNodes: NodeState[] = [];

        // God Node
        initialNodes.push({
            id: 'god-node',
            position: { x: 0, y: 4, z: 0 },
            identity: { color: '#ffffff', category: 'god', label: 'PRIME', avatar: '◆', displayName: 'PRIME', model: 'gpt-4o' },
            connections: [],
            isActive: true,
            isStreaming: true,
            contextState: { usagePercent: 0, zone: 'optimal' }
        });

        // 50 Random Nodes
        for (let i = 0; i < 50; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = 3 + Math.random() * 5;

            initialNodes.push({
                id: `node-${i}`,
                position: {
                    x: r * Math.sin(phi) * Math.cos(theta),
                    y: 4 + r * Math.cos(phi),
                    z: r * Math.sin(phi) * Math.sin(theta)
                },
                identity: { color: '#00ff88', category: 'default', label: 'NODE', avatar: '•', displayName: `NODE ${i}`, model: 'gpt-3.5' },
                connections: [],
                isActive: Math.random() > 0.8,
                isStreaming: Math.random() > 0.9,
                contextState: { usagePercent: Math.random() * 100, zone: 'optimal' }
            });
        }

        set({ nodes: initialNodes });
    },

    activateNode: (id) => set(state => ({
        nodes: state.nodes.map(n => n.id === id ? { ...n, isActive: true } : n)
    })),

    setProcessing: (processing) => set({ isProcessing: processing })
}));
