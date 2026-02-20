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
    type: 'tree' | 'rock' | 'portal' | 'boundary' | 'building' | 'chair' | 'table' | 'structure' | 'log' | 'door';
    position: Vec3;
    size: Vec3;
    interactable: boolean;
    climbable: boolean;
    allowMultiple?: boolean;
    metadata?: {
        displayName?: string;
        action?: 'sit' | 'pickup' | 'open' | 'close' | 'enter';
        state?: string; // 'open', 'closed', etc.
        buildingName?: string;
        isInside?: boolean;
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
    type: 'move' | 'turn' | 'stop' | 'interact' | 'patrol' | 'follow' | 'idle' | 'query' | 'chat';
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
    // Memory of seen objects for permanence
    knownObjects: Record<string, {
        type: string;
        firstSeen: number;
        lastSeen: number;
        position: Vec3;
    }>;
    registerObject: (id: string, type: string, position: Vec3) => void;
    isSitting: boolean;
    sittingPosition?: Vec3;
    currentSpeech?: {
        text: string;
        timestamp: number;
        duration: number;
    };
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
}

export interface SimulationStore {
    // Environment
    environment: EnvironmentConfig;
    colliders: ColliderBox[];
    overlaySourceUrl: string | null;

    // Robot & User
    robot: RobotState;
    user: UserState;

    // Sensory
    sensoryBuffer: SensoryInput[];
    visionConeAngle: number;
    visionConeRange: number;
    hearingRange: number;
    touchRange: number;

    // Biological layers
    eukaryotePackets: EukaryotePacket[];
    myceliumNodes: MyceliumNode[];
    myceliumPulses: MyceliumPulse[];
    sensoryGrowthFactor: number;

    // Snapshots
    snapshotHistory: string[];

    // Camera
    cameraMode: 'orbit' | 'first-person' | 'follow';
    showSensoryOverlay: boolean;
    showMycelium: boolean;
    showEukaryote: boolean;
    showLightCone: boolean;
    showColliders: boolean;
    isChatOpen: boolean;
    interactionTrigger: { id: string; action: string; timestamp: number } | null;

    // Actions
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

    // Robot Commands
    setRobotIntent: (intent: RobotIntent) => void;
    queueRobotIntent: (intent: RobotIntent) => void;
    processNextIntent: () => void;
    clearRobotIntent: () => void;
    updateNearbyObjects: (objects: string[]) => void;
    setRobotSitting: (sitting: boolean, position?: Vec3) => void;
    setRobotTemporalMetrics: (metrics: RobotState['temporalMetrics']) => void;
    setRobotCompressionRatio: (ratio: number) => void;
    setRobotSpeech: (text: string, duration?: number) => void;
    setChatOpen: (isOpen: boolean) => void;
    triggerInteraction: (id: string, action: string) => void;

    // User Actions
    setUserSitting: (isSitting: boolean, position?: Vec3) => void;
    setUserPosition: (position: Vec3) => void;
}

/* ─── Default environment ─── */

export const DEFAULT_ENVIRONMENT: EnvironmentConfig = {
    id: 'default-field',
    name: 'Qualia Field',
    terrain: {
        size: 142,   // ~142m x 142m ≈ 5 acres
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
                // Update last seen
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
            // Register new
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
    },

    user: {
        position: { x: 0, y: 0, z: 0 },
        isSitting: false,
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

    loadEnvironment: (config) => {
        set({ environment: config, colliders: [], robot: { ...get().robot, position: config.robot.startPosition } });
    },

    setRobotPosition: (pos) => set(s => ({ robot: { ...s.robot, position: pos } })),

    setRobotAnimation: (anim) => set(s => ({ robot: { ...s.robot, animation: anim } })),

    moveRobot: (direction, dt) => {
        const { robot, colliders } = get();
        const speed = robot.animation === 'running' ? 8 : 3;

        // Guard against NaNs
        const dx = isNaN(direction.x) ? 0 : direction.x;
        const dz = isNaN(direction.z) ? 0 : direction.z;

        const newPos = {
            x: robot.position.x + dx * speed * dt,
            y: robot.position.y,
            z: robot.position.z + dz * speed * dt,
        };

        if (isNaN(newPos.x) || isNaN(newPos.z)) return; // Abort if invalid

        // Check collisions
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
            // Boundary clamp
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
            // Fire sensory input for touch collision
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
            const buffer = [...s.sensoryBuffer, input].slice(-100); // Keep last 100
            return { sensoryBuffer: buffer };
        });
    },

    sendEukaryotePacket: (packet) => {
        set(s => ({
            eukaryotePackets: [...s.eukaryotePackets, packet].slice(-50),
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

    updateNearbyObjects: (objects) => set(s => ({
        robot: { ...s.robot, nearbyObjects: objects }
    })),

    setRobotSitting: (sitting, position) => set(s => ({
        robot: {
            ...s.robot,
            isSitting: sitting,
            sittingPosition: position,
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
        // Note: This is read by AtlasRobot which accesses temporalManager directly
        // We store it here for UI synchronization
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

    triggerInteraction: (id, action) => set({ interactionTrigger: { id, action, timestamp: Date.now() } }),

    setUserSitting: (isSitting, position) => set(state => ({
        user: {
            ...state.user,
            isSitting,
            sittingPosition: position
        }
    })),

    setUserPosition: (position) => set(state => ({
        user: {
            ...state.user,
            position
        }
    })),
}));
