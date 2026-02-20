import { ObjectMemoryManager } from './objectMemory';

/* ─── Configuration ─── */

export interface ExperienceConfig {
    baseCompressionRatio: number;       // 1.0 = real-time, 2.0 = 2x speed
    tokenBudgetPerSecond: number;       // Max tokens/sec for experience processing
    memoryConsolidationInterval: number; // Seconds between memory compression
    maxMemoryEntries: number;           // Cap on active memories
}

export interface TemporalMetrics {
    realTime: number;
    experiencedTime: number;
    compressionRatio: number;
    tokensUsed: number;
    tokenBudget: number;
    memoryCoherence: number;            // 0.0 - 1.0
}

/* ─── Temporal Experience Manager ─── */

export class TemporalExperienceManager {
    private realTimeElapsed: number = 0;
    private experiencedTimeElapsed: number = 0;
    private compressionRatio: number;

    // Token tracking
    private tokenBudgetPerSecond: number;
    private tokensUsedThisSecond: number = 0;
    private tokenResetTimer: number = 0;

    // Memory compression
    private consolidationTimer: number = 0;
    private config: ExperienceConfig;

    // Safety limits
    private readonly MAX_COMPRESSION = 5.0;
    private readonly MIN_COMPRESSION = 0.1;

    // Social awareness
    private socialPresences: Set<string> = new Set();

    constructor(config: ExperienceConfig) {
        this.config = config;
        this.compressionRatio = config.baseCompressionRatio;
        this.tokenBudgetPerSecond = config.tokenBudgetPerSecond;

        console.log('[TemporalManager] Initialized with config:', config);
    }

    /**
     * Called every frame to advance temporal experience
     */
    tick(deltaReal: number, objectMemory: ObjectMemoryManager): void {
        // 1. Update real time
        this.realTimeElapsed += deltaReal;

        // 2. Reset token counter every second
        this.tokenResetTimer += deltaReal;
        if (this.tokenResetTimer >= 1.0) {
            this.tokensUsedThisSecond = 0;
            this.tokenResetTimer = 0;
        }

        // 3. Check token budget before processing
        if (!this.hasTokenBudget()) {
            // Gracefully throttle by reducing compression
            this.compressionRatio = Math.max(
                this.MIN_COMPRESSION,
                this.compressionRatio * 0.9
            );
            console.warn('[TemporalManager] Token budget exceeded, throttling to',
                this.compressionRatio.toFixed(2) + 'x');
            return;
        }

        // 4. Process at compressed rate
        const deltaExperienced = deltaReal * this.compressionRatio;
        this.experiencedTimeElapsed += deltaExperienced;

        // 5. Memory consolidation (periodic)
        this.consolidationTimer += deltaReal;
        if (this.consolidationTimer >= this.config.memoryConsolidationInterval) {
            this.compressMemories(objectMemory);
            this.consolidationTimer = 0;
            this.trackTokenUsage(50); // Estimate token cost for consolidation
        }

        // 6. Tick object memory at experiential rate (not real-time rate)
        objectMemory.tick(deltaExperienced);
    }

    /**
     * Compress memories to prevent overflow
     */
    private compressMemories(memory: ObjectMemoryManager): void {
        const memories = memory.getActiveMemories();

        if (memories.length <= this.config.maxMemoryEntries) {
            return; // No compression needed
        }

        // Sort by importance (recency + interaction count)
        const sorted = memories.sort((a, b) => {
            const scoreA = (a.interactionCount * a.decayFactor) +
                (Date.now() - a.lastSeen) / 1000;
            const scoreB = (b.interactionCount * b.decayFactor) +
                (Date.now() - b.lastSeen) / 1000;
            return scoreB - scoreA;
        });

        // Keep top N, accelerate decay on rest
        sorted.forEach((mem, idx) => {
            if (idx >= this.config.maxMemoryEntries) {
                mem.decayFactor *= 0.5; // Fast decay for low-priority memories
            }
        });

        console.log('[TemporalManager] Compressed memories:',
            `${sorted.length} → ${this.config.maxMemoryEntries} active`);
    }

    /**
     * Check if we have token budget remaining
     */
    private hasTokenBudget(): boolean {
        return this.tokensUsedThisSecond < this.tokenBudgetPerSecond;
    }

    /**
     * Track token usage
     */
    private trackTokenUsage(tokens: number): void {
        this.tokensUsedThisSecond += tokens;
    }

    /**
     * Record presence of social entity (user avatar)
     */
    recordSocialPresence(entityId: string): void {
        if (!this.socialPresences.has(entityId)) {
            console.log('[TemporalManager] Detected social presence:', entityId);
            this.socialPresences.add(entityId);
            this.trackTokenUsage(10); // Small token cost for social awareness
        }
    }

    /**
     * Set compression ratio with safety limits
     */
    setCompressionRatio(ratio: number): void {
        const clamped = Math.max(
            this.MIN_COMPRESSION,
            Math.min(this.MAX_COMPRESSION, ratio)
        );

        if (clamped !== this.compressionRatio) {
            console.log('[TemporalManager] Compression ratio changed:',
                `${this.compressionRatio.toFixed(2)}x → ${clamped.toFixed(2)}x`);
            this.compressionRatio = clamped;
        }
    }

    /**
     * Get current temporal metrics for UI display
     */
    getMetrics(): TemporalMetrics {
        return {
            realTime: this.realTimeElapsed,
            experiencedTime: this.experiencedTimeElapsed,
            compressionRatio: this.compressionRatio,
            tokensUsed: this.tokensUsedThisSecond,
            tokenBudget: this.tokenBudgetPerSecond,
            memoryCoherence: this.calculateMemoryCoherence(),
        };
    }

    /**
     * Calculate how coherent the robot's memory is
     */
    private calculateMemoryCoherence(): number {
        // For now, simple metric based on compression ratio
        // Lower compression = more coherent (processing carefully)
        // Higher compression = less coherent (rushing through experience)
        const normalized = (this.compressionRatio - this.MIN_COMPRESSION) /
            (this.MAX_COMPRESSION - this.MIN_COMPRESSION);
        return 1.0 - normalized;
    }
}
