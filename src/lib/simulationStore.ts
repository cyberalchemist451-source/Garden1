import { create } from 'zustand';

/* ─── Types ─── */

export interface Vec3 {
    x: number;
    y: number;
    z: number;
}

export interface EnvironmentConfig {
    id: string;
    name: string;
    terrain: {
        size: number;
        seed: number;
        heightScale: number;
        grassDensity: number;
        dirtPatchCount: number;
    };
    vegetation: {
        treeCount: number;
        treeRadius: number;
    };
    rocks: {
        count: number;
        maxScale: number;
    };
    lighting: {
        sunAngle: number;
        sunIntensity: number;
        ambient: number;
        fogDensity: number;
    };
    robot: {
        startPosition: Vec3;
        scale: number;
    };
    portals: PortalConfig[];
}

export interface PortalConfig {
    id: string;
    position: Vec3;
    targetEnvironment: string;
    label: string;
}

export interface ColliderBox {
    id: string;
    type: 'tree' | 'rock' | 'portal' | 'boundary' | 'building' | 'chair' | 'table' | 'structure' | 'log' | 'door' | 'toy' | 'picnic-table';
    position: Vec3;
    size: Vec3;
    interactable: boolean;
    climbable: boolean;
    allowMultiple?: boolean;
    metadata?: {
        displayName?: string;
        action?: 'sit' | 'pickup' | 'open' | 'close' | 'enter' | 'fetch';
        state?: string;
        buildingName?: string;
        isInside?: boolean;
        color?: string;
        colorName?: string;
        shape?: 'sphere' | 'cube' | 'pyramid';
        fetchable?: boolean;
    };
}

export interface SensoryInput {
    type: 'vision' | 'hearing' | 'touch';
    sourceId: string;
    sourceType: string;
    position: Vec3;
    intensity: number;
    timestamp: number;
    data?: Record<string, unknown>;
}

export interface EukaryotePacket {
    id: string;
    fromNodeId: string;
    toNodeId: string;
    category: 'research' | 'analysis' | 'synthesis' | 'sensory' | 'motor';
    payload: string;
    position: Vec3;
    timestamp: number;
    ttl: number;
}

export interface MyceliumNode {
    id: string;
    position: Vec3;
    connections: string[];
    signalStrength: number;
    linkedObjectId?: string;
}

export interface MyceliumPulse {
    id: string;
    fromNode: string;
    toNode: string;
    progress: number;
    speed: number;
    color: string;
    data?: string;
}

export interface RobotIntent {
    type: 'move' | 'turn' | 'stop' | 'interact' | 'patrol' | 'follow' | 'idle' | 'query' | 'chat' | 'fetch';
    action?: string;
    parameters?: Record<string, unknown>;
    targetPosition?: Vec3;
    duration?: number;
    completed: boolean;
}

export interface RobotState {
    position: Vec3;
    rotation: Vec3;
    velocity: Vec3;
    animation: 'idle' | 'walking' | 'running' | 'reaching' | 'climbing' | 'looking' | 'flex' | 'agility' | 'sitting';
    headLookAt: Vec3;
    isGrounded: boolean;
    touchingObjects: string[];
    coreGlowIntensity: number;
    processingState: 'idle' | 'thinking' | 'active';
    currentIntent?: RobotIntent;
    intentQueue: RobotIntent[];
    nearbyObjects: string[];
    knownObjects: Record<string, {
        type: string;
        firstSeen: number;
        lastSeen: number;
        position: Vec3;
    }>;
    registerObject: (id: string, type: string, position: Vec3) => void;
    isSitting: boolean;
    sittingPosition?: Vec3;
    sittingRotation?: number;
    carriedObjectId: string | null;
    waypoints: Vec3[];
    currentWaypointIdx: number;
    currentSpeech?: {
        text: string;
        timestamp: number;
        duration: number;
    };
    chatHistory: {
        id: string;
        role: 'user' | 'collective' | 'robot';
        text: string;
        nodeName?: string;
        nodeAvatar?: string;
        timestamp: number;
        isRobotCommand?: boolean;
    }[];
    temporalMetrics?: {
        realTime: number;
        experiencedTime: number;
        compressionRatio: number;
        tokensUsed: number;
        tokenBudget: number;
        memoryCoherence: number;
    };
}

export interface UserState {
    position: Vec3;
    isSitting: boolean;
    sittingPosition?: Vec3;
    sittingRotation?: number;
    carriedObjectId: string | null;
}

export interface SimulationStore {
    environment: EnvironmentConfig;
    colliders: ColliderBox[];
    overlaySourceUrl: string | null;

    robot: RobotState;
    user: UserState;

    sensoryBuffer: SensoryInput[];
    visionConeAngle: number;
    visionConeRange: number;
    hearingRange: number;
    touchRange: number;

    eukaryotePackets: EukaryotePacket[];
    myceliumNodes: MyceliumNode[];
    myceliumPulses: MyceliumPulse[];
    sensoryGrowthFactor: number;

    snapshotHistory: string[];

    cameraMode: 'orbit' | 'first-person' | 'follow';
    showSensoryOverlay: boolean;
    showMycelium: boolean;
    showEukaryote: boolean;
    showLightCone: boolean;
    showColliders: boolean;
    isChatOpen: boolean;
    interactionTrigger: { id: string; action: string; timestamp: number } | null;
    chatHistory: {
        id: string;
        role: 'user' | 'collective' | 'robot';
        text: string;
        nodeName?: string;
        nodeAvatar?: string;
        timestamp: number;
        isRobotCommand?: boolean;
    }[];

    loadEnvironment: (config: EnvironmentConfig) => void;
    setRobotPosition: (pos: Vec3) => void;
    setRobotAnimation: (anim: RobotState['animation']) => void;
    moveRobot: (direction: Vec3, dt: number) => void;
    addCollider: (collider: ColliderBox) => void;
    removeCollider: (id: string) => void;
    updateCollider: (id: string, updates: Partial<ColliderBox>) => void;
    addSensoryInput: (input: SensoryInput) => void;
    sendEukaryotePacket: (packet: EukaryotePacket) => void;
    addMyceliumNode: (node: MyceliumNode) => void;
    firePulse: (fromId: string, toId: string, color: string) => void;
    updatePulses: (dt: number) => void;
    setCameraMode: (mode: SimulationStore['cameraMode']) => void;
    toggleOverlay: (layer: 'sensory' | 'mycelium' | 'eukaryote' | 'lightCone' | 'colliders') => void;
    setOverlayUrl: (url: string | null) => void;
    growSensoryConnections: () => void;

    setRobotIntent: (intent: RobotIntent) => void;
    queueRobotIntent: (intent: RobotIntent) => void;
    processNextIntent: () => void;
    clearRobotIntent: () => void;
    completeIntent: () => void;
    updateNearbyObjects: (objects: string[]) => void;
    setRobotSitting: (sitting: boolean, position?: Vec3, rotation?: number) => void;
    setRobotTemporalMetrics: (metrics: RobotState['temporalMetrics']) => void;
    setRobotCompressionRatio: (ratio: number) => void;
    setRobotSpeech: (text: string, duration?: number) => void;
    setChatOpen: (isOpen: boolean) => void;
    triggerInteraction: (id: string, action: string) => void;
    setCarriedObject: (id: string | null) => void;
    setUserCarriedObject: (id: string | null) => void;
    setWaypoints: (waypoints: Vec3[]) => void;
    advanceWaypoint: () => void;
    addChatMessage: (message: {
        role: 'user' | 'collective' | 'robot';
        text: string;
        nodeName?: string;
        nodeAvatar?: string;
        isRobotCommand?: boolean;
    }) => void;
    consolidateMemory: () => void;

    setUserSitting: (isSitting: boolean, position?: Vec3, rotation?: number) => void;
    setUserPosition: (position: Vec3) => void;
}

/* ─── OPTIMIZATION: Memory Compression Helpers ─── */

/**
 * Compresses the knownObjects registry into a lightweight summary
 * Reduces token usage by ~200-500 tokens per API request
 */
export function compressKnownObjects(knownObjects: Record<string, {
    type: string;
    firstSeen: number;
    lastSeen: number;
    position: Vec3;
}>) {
    const now = Date.now();
    
    return {
        count: Object.keys(knownObjects).length,
        // Type distribution (e.g., "tree: 12, rock: 8, cabin: 1")
        types: Object.values(knownObjects).reduce((acc, obj) => {
            acc[obj.type] = (acc[obj.type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>),
        // Only objects seen in last 30 seconds (actively relevant context)
        recentlySeen: Object.entries(knownObjects)
            .filter(([, obj]) => now - obj.lastSeen < 30000)
            .slice(0, 20) // Max 20 recent objects
            .map(([id, obj]) => ({
                id,
                type: obj.type,
                pos: {
                    x: Math.round(obj.position.x * 10) / 10, // 1 decimal precision
                    z: Math.round(obj.position.z * 10) / 10
                }
            }))
    };
}

/**
 * Compresses nearby objects by grouping them by type
 * Reduces "tree-1, tree-2, rock-1, rock-2" to "2 trees, 2 rocks"
 */
export function compressNearbyObjects(nearbyObjects: string[]): string {
    const nearby = nearbyObjects.filter(o => !o.includes('terrain') && !o.includes('robot'));
    
    if (nearby.length === 0) return 'Empty area';
    
    const byType = nearby.reduce((acc, obj) => {
        const type = obj.split('-')[0]; // Extract type from "tree-1"
        acc[type] = (acc[type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(byType)
        .map(([type, count]) => count > 1 ? `${count} ${type}s` : `1 ${type}`)
        .join(', ');
}

/* ─── Default environment ─── */

export const DEFAULT_ENVIRONMENT: EnvironmentConfig = {
    id: 'default-field',
    name: 'Qualia Field',
    terrain: {
        size: 142,
        seed: 42,
        heightScale: 6,
        grassDensity: 1500,
        dirtPatchCount: 12,
    },
    vegetation: {
        treeCount: 40,
        treeRadius: 130,
    },
    rocks: {
        count: 60,
        maxScale: 4,
    },
    lighting: {
        sunAngle: 55,
        sunIntensity: 1.2,
        ambient: 0.35,
        fogDensity: 0.003,
    },
    robot: {
        startPosition: { x: 0, y: 0, z: 0 },
        scale: 1.5,
    },
    portals: [],
};

/* ─── Store ─── */

export const useSimulationStore = create<SimulationStore>((set, get) => ({
    environment: DEFAULT_ENVIRONMENT,
    colliders: [],
    overlaySourceUrl: null,

    robot: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        animation: 'idle',
        headLookAt: { x: 0, y: 0, z: 5 },
        isGrounded: true,
        touchingObjects: [],
        coreGlowIntensity: 1.0,
        processingState: 'idle',
        currentIntent: undefined,
        intentQueue: [],
        nearbyObjects: [],
        knownObjects: {},
        registerObject: (id, type, position) => set(state => {
            const known = state.robot.knownObjects;
            if (known[id]) {
                // Update existing object
                return {
                    robot: {
                        ...state.robot,
                        knownObjects: {
                            ...known,
                            [id]: { ...known[id], lastSeen: Date.now(), position }
                        }
                    }
                };
            }
            // Register new object
            return {
                robot: {
                    ...state.robot,
                    knownObjects: {
                        ...known,
                        [id]: { type, firstSeen: Date.now(), lastSeen: Date.now(), position }
                    }
                }
            };
        }),
        isSitting: false,
        sittingPosition: undefined,
        carriedObjectId: null,
        waypoints: [],
        currentWaypointIdx: 0,
        chatHistory: [],
    },

    user: {
        position: { x: 0, y: 0, z: 0 },
        isSitting: false,
        carriedObjectId: null,
    },

    sensoryBuffer: [],
    visionConeAngle: 60,
    visionConeRange: 30,
    hearingRange: 20,
    touchRange: 1.5,

    eukaryotePackets: [],
    myceliumNodes: [],
    myceliumPulses: [],
    sensoryGrowthFactor: 1.0,

    snapshotHistory: [],

    cameraMode: 'orbit',
    showSensoryOverlay: false,
    showMycelium: false,
    showEukaryote: false,
    showLightCone: true,
    showColliders: false,
    isChatOpen: false,
    interactionTrigger: null,
    chatHistory: [
        {
            id: 'welcome',
            role: 'collective',
            text: 'Collective intelligence online. All nodes active. Awaiting query.',
            nodeName: 'GOD NODE',
            nodeAvatar: 'Γùå',
            timestamp: Date.now(),
        },
    ],

    loadEnvironment: (config) => {
        set({ environment: config, colliders: [], robot: { ...get().robot, position: config.robot.startPosition } });
    },

    setRobotPosition: (pos) => set(s => ({ robot: { ...s.robot, position: pos } })),

    setRobotAnimation: (anim) => set(s => ({ robot: { ...s.robot, animation: anim } })),

    moveRobot: (direction, dt) => {
        const { robot, colliders } = get();
        const speed = robot.animation === 'running' ? 8 : 3;

        const dx = isNaN(direction.x) ? 0 : direction.x;
        const dz = isNaN(direction.z) ? 0 : direction.z;

        const newPos = {
            x: robot.position.x + dx * speed * dt,
            y: robot.position.y,
            z: robot.position.z + dz * speed * dt,
        };

        if (isNaN(newPos.x) || isNaN(newPos.z)) return;

        let blocked = false;
        const touching: string[] = [];
        for (const c of colliders) {
            const dx = Math.abs(newPos.x - c.position.x);
            const dz = Math.abs(newPos.z - c.position.z);
            if (dx < c.size.x / 2 + 0.5 && dz < c.size.z / 2 + 0.5) {
                if (!c.climbable) blocked = true;
                touching.push(c.id);
            }
        }

        if (!blocked) {
            const half = get().environment.terrain.size / 2 - 2;
            newPos.x = Math.max(-half, Math.min(half, newPos.x));
            newPos.z = Math.max(-half, Math.min(half, newPos.z));

            set(s => ({
                robot: {
                    ...s.robot,
                    position: newPos,
                    touchingObjects: touching,
                    animation: Math.abs(direction.x) + Math.abs(direction.z) > 0.01 ? 'walking' : 'idle',
                },
            }));
        } else {
            set(s => ({ robot: { ...s.robot, touchingObjects: touching } }));
            get().addSensoryInput({
                type: 'touch',
                sourceId: touching[0] || 'unknown',
                sourceType: 'collider',
                position: newPos,
                intensity: 1,
                timestamp: Date.now(),
            });
        }
    },

    addCollider: (collider) => set(s => ({ colliders: [...s.colliders, collider] })),

    removeCollider: (id: string) => set(s => ({ colliders: s.colliders.filter(c => c.id !== id) })),

    updateCollider: (id: string, updates: Partial<ColliderBox>) => set(s => ({
        colliders: s.colliders.map(c => c.id === id ? { ...c, ...updates } : c)
    })),

    addSensoryInput: (input) => {
        set(s => {
            const buffer = [...s.sensoryBuffer, input].slice(-100); // Keep last 100 inputs
            return { sensoryBuffer: buffer };
        });
    },

    sendEukaryotePacket: (packet) => {
        set(s => ({
            eukaryotePackets: [...s.eukaryotePackets, packet].slice(-50), // Keep last 50 packets
        }));
    },

    addMyceliumNode: (node) => set(s => ({ myceliumNodes: [...s.myceliumNodes, node] })),

    firePulse: (fromId, toId, color) => {
        set(s => ({
            myceliumPulses: [...s.myceliumPulses, {
                id: `pulse-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                fromNode: fromId,
                toNode: toId,
                progress: 0,
                speed: 0.3 + Math.random() * 0.4,
                color,
            }],
        }));
    },

    updatePulses: (dt) => {
        set(s => ({
            myceliumPulses: s.myceliumPulses
                .map(p => ({ ...p, progress: p.progress + p.speed * dt }))
                .filter(p => p.progress < 1),
        }));
    },

    setCameraMode: (mode) => set({ cameraMode: mode }),

    toggleOverlay: (layer) => {
        set(s => {
            switch (layer) {
                case 'sensory': return { showSensoryOverlay: !s.showSensoryOverlay };
                case 'mycelium': return { showMycelium: !s.showMycelium };
                case 'eukaryote': return { showEukaryote: !s.showEukaryote };
                case 'lightCone': return { showLightCone: !s.showLightCone };
                case 'colliders': return { showColliders: !s.showColliders };
                default: return {};
            }
        });
    },

    setOverlayUrl: (url) => set({ overlaySourceUrl: url }),

    growSensoryConnections: () => {
        set(s => ({ sensoryGrowthFactor: Math.min(3.0, s.sensoryGrowthFactor + 0.05) }));
    },

    setRobotIntent: (intent) => set(s => ({
        robot: { ...s.robot, currentIntent: intent, processingState: 'active' }
    })),

    queueRobotIntent: (intent) => set(s => ({
        robot: { ...s.robot, intentQueue: [...s.robot.intentQueue, intent] }
    })),

    processNextIntent: () => set(s => {
        if (s.robot.intentQueue.length === 0) return {};
        const [next, ...rest] = s.robot.intentQueue;
        return {
            robot: {
                ...s.robot,
                currentIntent: next,
                intentQueue: rest,
                processingState: 'active'
            }
        };
    }),

    clearRobotIntent: () => set(s => ({
        robot: { ...s.robot, currentIntent: undefined, processingState: 'idle' }
    })),

    completeIntent: () => set(s => {
        const queue = s.robot.intentQueue;
        if (queue.length === 0) {
            return { robot: { ...s.robot, currentIntent: undefined, processingState: 'idle' } };
        }
        const [next, ...rest] = queue;
        return {
            robot: {
                ...s.robot,
                currentIntent: next,
                intentQueue: rest,
                processingState: 'active',
            }
        };
    }),

    updateNearbyObjects: (objects) => set(s => ({
        robot: { ...s.robot, nearbyObjects: objects }
    })),

    setRobotSitting: (sitting, position, rotation) => set(s => ({
        robot: {
            ...s.robot,
            isSitting: sitting,
            sittingPosition: position,
            sittingRotation: rotation,
            animation: sitting ? 'sitting' : 'idle'
        }
    })),

    setRobotTemporalMetrics: (metrics) => set(s => ({
        robot: { ...s.robot, temporalMetrics: metrics }
    })),

    setRobotSpeech: (text, duration = 5000) => set(s => ({
        robot: {
            ...s.robot,
            currentSpeech: {
                text,
                timestamp: Date.now(),
                duration
            }
        }
    })),

    setRobotCompressionRatio: (ratio) => {
        set(s => ({
            robot: {
                ...s.robot,
                temporalMetrics: s.robot.temporalMetrics ? {
                    ...s.robot.temporalMetrics,
                    compressionRatio: ratio
                } : undefined
            }
        }));
    },

    setChatOpen: (isOpen) => set({ isChatOpen: isOpen }),

    triggerInteraction: (id: string, action: string) => set({ interactionTrigger: { id, action, timestamp: Date.now() } }),

    setCarriedObject: (id) => set(s => ({ robot: { ...s.robot, carriedObjectId: id } })),

    setUserCarriedObject: (id) => set(s => ({ user: { ...s.user, carriedObjectId: id } })),

    setWaypoints: (waypoints) => set(s => ({ robot: { ...s.robot, waypoints, currentWaypointIdx: 0 } })),

    advanceWaypoint: () => set(s => ({ robot: { ...s.robot, currentWaypointIdx: s.robot.currentWaypointIdx + 1 } })),

    // OPTIMIZATION: Limit chat history to 50 messages
    addChatMessage: (msg) => set(s => ({
        chatHistory: [...s.chatHistory, {
            id: `msg-${Date.now()}-${Math.random()}`,
            timestamp: Date.now(),
            ...msg
        }].slice(-50) // Keep only last 50 messages
    })),

    // OPTIMIZATION: Memory consolidation - removes objects not seen in 5 minutes
    consolidateMemory: () => set(state => {
        const now = Date.now();
        const known = state.robot.knownObjects;
        
        const beforeCount = Object.keys(known).length;
        
        // Remove objects not seen in 5 minutes
        const consolidated = Object.fromEntries(
            Object.entries(known).filter(([, obj]) => 
                now - obj.lastSeen < 300000 // 5 minutes
            )
        );
        
        const afterCount = Object.keys(consolidated).length;
        const removed = beforeCount - afterCount;
        
        if (removed > 0) {
            console.log(`[Memory] Consolidated: removed ${removed} old objects (${beforeCount} → ${afterCount})`);
        }
        
        return {
            robot: {
                ...state.robot,
                knownObjects: consolidated
            }
        };
    }),

    setUserSitting: (isSitting, position, rotation) => set(state => ({
        user: {
            ...state.user,
            isSitting,
            sittingPosition: position,
            sittingRotation: rotation
        }
    })),

    setUserPosition: (position) => set(state => ({
        user: {
            ...state.user,
            position
        }
    })),
}));
