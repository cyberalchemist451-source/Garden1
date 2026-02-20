import { Vec3, ColliderBox, SensoryInput } from './simulationStore';

/* ─── Object Memory Entry ─── */

export interface MemoryEntry {
    id: string;
    objectType: 'tree' | 'rock' | 'portal' | 'terrain_feature' | 'chair' | 'user_avatar' | 'unknown';
    position: Vec3;
    size: Vec3;
    firstSeen: number;
    lastSeen: number;
    interactionCount: number;
    interactionHistory: InteractionEvent[];
    decayFactor: number;        // 1.0 = fully remembered, 0.0 = forgotten
    sensorySignature: {
        visual: boolean;
        auditory: boolean;
        tactile: boolean;
    };
    tags: string[];
    socialTags?: string[];  // For social entities like user_avatar: ['self-similar', 'conscious', 'interactive']
    metadata: Record<string, unknown>;
}

export interface InteractionEvent {
    type: 'seen' | 'touched' | 'climbed' | 'heard' | 'collided';
    timestamp: number;
    senseUsed: 'vision' | 'hearing' | 'touch';
    intensity: number;
}

export interface EnvironmentSnapshot {
    id: string;
    name: string;
    timestamp: number;
    description: string;
    environmentId: string;
    robotPosition: Vec3;
    robotRotation: Vec3;
    memories: MemoryEntry[];
    myceliumTopology: { nodeCount: number; connectionCount: number };
    eukaryotePacketCount: number;
    sensoryGrowthFactor: number;
    metadata: Record<string, unknown>;
}

/* ─── Object Memory Manager ─── */

export class ObjectMemoryManager {
    private memories: Map<string, MemoryEntry> = new Map();
    private contextWindowSize: number = 100;
    private decayRate: number = 0.001; // per second
    private snapshots: EnvironmentSnapshot[] = [];

    getMemories(): MemoryEntry[] {
        return Array.from(this.memories.values());
    }

    getActiveMemories(): MemoryEntry[] {
        return this.getMemories()
            .filter(m => m.decayFactor > 0.1)
            .sort((a, b) => b.lastSeen - a.lastSeen)
            .slice(0, this.contextWindowSize);
    }

    setContextWindowSize(size: number): void {
        this.contextWindowSize = Math.max(10, Math.min(1000, size));
    }

    getContextWindowSize(): number {
        return this.contextWindowSize;
    }

    /** Register or update an object in memory */
    perceive(
        objectId: string,
        objectType: MemoryEntry['objectType'],
        position: Vec3,
        size: Vec3,
        sense: 'vision' | 'hearing' | 'touch',
        intensity: number = 1.0
    ): MemoryEntry {
        const now = Date.now();
        const existing = this.memories.get(objectId);

        if (existing) {
            existing.lastSeen = now;
            existing.interactionCount++;
            existing.decayFactor = Math.min(1.0, existing.decayFactor + 0.2);
            existing.sensorySignature[
                sense === 'vision' ? 'visual' : sense === 'hearing' ? 'auditory' : 'tactile'
            ] = true;
            existing.interactionHistory.push({
                type: sense === 'touch' ? 'touched' : sense === 'vision' ? 'seen' : 'heard',
                timestamp: now,
                senseUsed: sense,
                intensity,
            });
            // Keep last 50 interactions
            if (existing.interactionHistory.length > 50) {
                existing.interactionHistory = existing.interactionHistory.slice(-50);
            }
            return existing;
        }

        const entry: MemoryEntry = {
            id: objectId,
            objectType,
            position,
            size,
            firstSeen: now,
            lastSeen: now,
            interactionCount: 1,
            interactionHistory: [{
                type: sense === 'touch' ? 'touched' : sense === 'vision' ? 'seen' : 'heard',
                timestamp: now,
                senseUsed: sense,
                intensity,
            }],
            decayFactor: 1.0,
            sensorySignature: {
                visual: sense === 'vision',
                auditory: sense === 'hearing',
                tactile: sense === 'touch',
            },
            tags: [],
            metadata: {},
        };

        this.memories.set(objectId, entry);
        return entry;
    }

    /** Process a collision event and register the object */
    processCollision(collider: ColliderBox, senseInput: SensoryInput): MemoryEntry {
        return this.perceive(
            collider.id,
            collider.type as MemoryEntry['objectType'],
            collider.position,
            collider.size,
            senseInput.type,
            senseInput.intensity
        );
    }

    /** Apply time-based memory decay */
    tick(dtSeconds: number): void {
        for (const [id, mem] of this.memories) {
            const timeSinceLastSeen = (Date.now() - mem.lastSeen) / 1000;
            if (timeSinceLastSeen > 10) {
                mem.decayFactor = Math.max(0, mem.decayFactor - this.decayRate * dtSeconds);
            }
            // Remove fully decayed memories past the threshold
            if (mem.decayFactor <= 0 && this.memories.size > this.contextWindowSize) {
                this.memories.delete(id);
            }
        }
    }

    /** Reinforce memory of an object (re-observation) */
    reinforce(objectId: string): void {
        const mem = this.memories.get(objectId);
        if (mem) {
            mem.decayFactor = Math.min(1.0, mem.decayFactor + 0.3);
            mem.lastSeen = Date.now();
        }
    }

    /** Take a snapshot of the current environment state */
    takeSnapshot(
        name: string,
        description: string,
        environmentId: string,
        robotPosition: Vec3,
        robotRotation: Vec3,
        myceliumNodeCount: number,
        myceliumConnectionCount: number,
        eukaryotePacketCount: number,
        sensoryGrowthFactor: number
    ): EnvironmentSnapshot {
        const snapshot: EnvironmentSnapshot = {
            id: `snapshot-${Date.now()}`,
            name,
            timestamp: Date.now(),
            description,
            environmentId,
            robotPosition: { ...robotPosition },
            robotRotation: { ...robotRotation },
            memories: this.getMemories().map(m => ({ ...m, interactionHistory: [...m.interactionHistory] })),
            myceliumTopology: { nodeCount: myceliumNodeCount, connectionCount: myceliumConnectionCount },
            eukaryotePacketCount,
            sensoryGrowthFactor,
            metadata: {},
        };

        this.snapshots.push(snapshot);
        return snapshot;
    }

    /** Get all snapshots */
    getSnapshots(): EnvironmentSnapshot[] {
        return [...this.snapshots];
    }

    /** Restore from a snapshot (memories only) */
    restoreFromSnapshot(snapshot: EnvironmentSnapshot): void {
        this.memories.clear();
        for (const mem of snapshot.memories) {
            this.memories.set(mem.id, { ...mem, interactionHistory: [...mem.interactionHistory] });
        }
    }

    /** Export all memories as JSON string */
    exportAsJSON(): string {
        return JSON.stringify({
            contextWindowSize: this.contextWindowSize,
            memories: this.getMemories(),
            snapshots: this.snapshots,
        }, null, 2);
    }

    /** Import from JSON */
    importFromJSON(json: string): void {
        const data = JSON.parse(json);
        if (data.contextWindowSize) this.contextWindowSize = data.contextWindowSize;
        if (Array.isArray(data.memories)) {
            this.memories.clear();
            for (const mem of data.memories) {
                this.memories.set(mem.id, mem);
            }
        }
        if (Array.isArray(data.snapshots)) {
            this.snapshots = data.snapshots;
        }
    }
}

/** Singleton memory manager instance */
export const objectMemory = new ObjectMemoryManager();
