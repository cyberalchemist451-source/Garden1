import { create } from 'zustand';

export type WeaponType = 'bow';
export type ZombieType = 'normal' | 'brute';
export type SpellType = 'fireball' | 'lightning' | 'frostbolt' | 'shadowbolt';
export type ZombieState = 'chasing' | 'attacking' | 'stunned' | 'dying' | 'dead';

export interface Vec3 { x: number; y: number; z: number; }

export interface DotEffect {
    id: string;
    damage: number;       // per tick
    tickInterval: number;
    tickTimer: number;
    remaining: number;
    isSpread: boolean;
}

export interface LightningArc {
    id: string; from: Vec3; to: Vec3; ttl: number;
}

export interface PlayerState {
    hp: number; maxHp: number; xp: number; level: number; skillPoints: number;
    damage: number; speed: number;
    activeWeapon: WeaponType; isBlocking: boolean;
    spells: Record<SpellType, { unlocked: boolean; tier: number }>;
    spellCooldowns: Record<SpellType, number>;
    upgrades: { maxHp: number; damage: number; speed: number };
}

export interface ZombieData {
    id: string; position: Vec3; rotation: number;
    hp: number; maxHp: number; type: ZombieType; state: ZombieState;
    stunTimer: number; slowTimer: number; attackCooldown: number;
    dotEffects: DotEffect[];
}

export interface ProjectileData {
    id: string;
    type: 'arrow' | 'fireball' | 'lightning' | 'frostbolt' | 'shadowbolt';
    position: Vec3; direction: Vec3;
    speed: number; damage: number; ttl: number; hitRadius: number;
    ownerId: 'player';
    // Optional per-type extras
    aoeRadius?: number;      // fireball AOE damage (tier 3+)
    chainCount?: number;     // lightning chains (tier 3+)
    chillRadius?: number;    // frostbolt AOE slow (tier 3+)
    dotDps?: number;         // shadowbolt DOT per second
    dotDuration?: number;    // shadowbolt DOT total duration
    dotRadius?: number;      // shadowbolt AOE DOT (tier 3+)
}

export interface ExplosionData {
    id: string; position: Vec3; radius: number;
    progress: number; duration: number;
    style: 'fire' | 'shadow';
}

export interface WaveState {
    number: number; phase: 'waiting' | 'active' | 'resting' | 'game_over';
    zombiesRemaining: number; restTimer: number; totalSpawned: number;
    // Staggered spawn state
    pendingSpawns: number;        // enemies yet to enter the arena
    spawnBatchTimer: number;      // countdown until next batch
    pendingEntries: { position: Vec3; type: ZombieType }[]; // queued positions
}

export interface GameStore {
    player: PlayerState; zombies: ZombieData[];
    projectiles: ProjectileData[]; explosions: ExplosionData[];
    lightningArcs: LightningArc[]; wave: WaveState;
    gameRunning: boolean; gameOver: boolean; gamePaused: boolean;
    skillMenuOpen: boolean; targetedZombieId: string | null;
    damageNumbers: { id: string; position: Vec3; amount: number; type: 'player' | 'zombie'; timestamp: number }[];

    setActiveWeapon: (w: WeaponType) => void;
    setBlocking: (b: boolean) => void;
    damagePlayer: (amount: number) => void;
    healPlayer: (amount: number) => void;
    gainXP: (amount: number) => void;
    spendSkillPoint: (upg: 'maxHp' | 'damage' | 'speed' | SpellType) => void;
    setSpellCooldown: (spell: SpellType, s: number) => void;
    tickSpellCooldowns: (dt: number) => void;

    spawnZombies: (entries: { position: Vec3; type: ZombieType }[]) => void;
    damageZombie: (id: string, amount: number, effect?: 'stun' | 'slow') => void;
    applyDot: (zombieId: string, dot: { dps: number; duration: number; isSpread: boolean }) => void;
    spreadDotFromPosition: (position: Vec3, dot: DotEffect) => void;
    tickZombies: (dt: number, playerPos: Vec3) => void;
    removeDeadZombies: () => void;

    addProjectile: (p: Omit<ProjectileData, 'id'>) => void;
    tickProjectiles: (dt: number) => void;
    addExplosion: (position: Vec3, radius: number, style?: 'fire' | 'shadow') => void;
    tickExplosions: (dt: number) => void;
    addLightningArc: (from: Vec3, to: Vec3) => void;
    tickLightningArcs: (dt: number) => void;

    startGame: () => void; nextWave: () => void;
    checkWaveComplete: () => void; tickWaveTimer: (dt: number) => void;
    tickWaveSpawner: (dt: number) => void;
    pauseGame: () => void; resumeGame: () => void; togglePause: () => void;

    setTargetedZombie: (id: string | null) => void;
    toggleSkillMenu: () => void; setSkillMenuOpen: (open: boolean) => void;
    addDamageNumber: (position: Vec3, amount: number, type: 'player' | 'zombie') => void;
    clearOldDamageNumbers: () => void;
}

/* ── Constants ── */
export const XP_PER_LEVEL = 100;
export const XP_PER_KILL = 20;
export const MAX_SKILL_TIER = 10;
export const WEAPON_DAMAGE: Record<WeaponType, number> = { bow: 35 };
export const WEAPON_COOLDOWN: Record<WeaponType, number> = { bow: 0.7 };
const SPAWN_BATCH_SIZE = 20;    // max enemies spawned per batch
const SPAWN_BATCH_INTERVAL = 40; // seconds between batches

export const SPELL_BASE_DAMAGE: Record<SpellType, number> = {
    fireball: 40, lightning: 60, frostbolt: 25, shadowbolt: 20,
};
export const SPELL_COOLDOWN_BASE: Record<SpellType, number> = {
    fireball: 3, lightning: 5, frostbolt: 2, shadowbolt: 4,
};
export const SPELL_DAMAGE_PER_TIER: Record<SpellType, number> = {
    fireball: 15, lightning: 20, frostbolt: 12, shadowbolt: 8,
};

export const CAVE_POSITION: Vec3 = { x: -55, y: 0, z: -55 };
const BRUTE_HP = 280, NORMAL_HP = 80;
const BRUTE_DMG = 18, NORMAL_DMG = 8;
const BRUTE_SPD = 1.6, NORMAL_SPD = 2.5;
const DOT_TICK_INTERVAL = 0.5;

function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

function zombiesForWave(wave: number) {
    return wave <= 6 ? 5 + wave * 3 : Math.round(5 + wave * 3 + (wave - 6) * 4);
}
function bruteCountForWave(wave: number) {
    return wave < 7 ? 0 : Math.min(Math.floor((wave - 6) * 1.5), 8);
}

function initialPlayer(): PlayerState {
    return {
        hp: 100, maxHp: 100, xp: 0, level: 1, skillPoints: 0,
        damage: 20, speed: 4, activeWeapon: 'bow', isBlocking: false,
        spells: {
            fireball: { unlocked: false, tier: 0 },
            lightning: { unlocked: false, tier: 0 },
            frostbolt: { unlocked: false, tier: 0 },
            shadowbolt: { unlocked: false, tier: 0 },
        },
        spellCooldowns: { fireball: 0, lightning: 0, frostbolt: 0, shadowbolt: 0 },
        upgrades: { maxHp: 0, damage: 0, speed: 0 },
    };
}

function makeSpawnEntries(count: number, brutes: number): { position: Vec3; type: ZombieType }[] {
    return Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
        const radius = 3 + Math.random() * 7;
        return {
            type: i < brutes ? 'brute' : 'normal',
            position: { x: CAVE_POSITION.x + Math.cos(angle) * radius, y: 0, z: CAVE_POSITION.z + Math.sin(angle) * radius },
        };
    });
}

/* ── Store ── */
const initialWave = (): WaveState => ({
    number: 0, phase: 'waiting', zombiesRemaining: 0, restTimer: 0, totalSpawned: 0,
    pendingSpawns: 0, spawnBatchTimer: 0, pendingEntries: [],
});

export const useGameStore = create<GameStore>((set, get) => ({
    player: initialPlayer(), zombies: [], projectiles: [], explosions: [],
    lightningArcs: [],
    wave: initialWave(),
    gameRunning: false, gameOver: false, gamePaused: false, skillMenuOpen: false,
    targetedZombieId: null, damageNumbers: [],

    setActiveWeapon: w => set(s => ({ player: { ...s.player, activeWeapon: w } })),
    setBlocking: b => set(s => ({ player: { ...s.player, isBlocking: b } })),

    damagePlayer: amount => {
        const { player } = get();
        const hp = Math.max(0, player.hp - (player.isBlocking ? Math.round(amount * 0.6) : amount));
        set(s => ({ player: { ...s.player, hp } }));
        if (hp <= 0) set({ gameOver: true, gameRunning: false });
    },

    healPlayer: amount => set(s => ({ player: { ...s.player, hp: Math.min(s.player.maxHp, s.player.hp + amount) } })),

    gainXP: amount => {
        const { player } = get();
        let xp = player.xp + amount, level = player.level, sp = player.skillPoints;
        while (xp >= XP_PER_LEVEL) { xp -= XP_PER_LEVEL; level++; sp++; }
        set(s => ({ player: { ...s.player, xp, level, skillPoints: sp } }));
    },

    spendSkillPoint: upg => {
        const { player } = get();
        if (player.skillPoints <= 0) return;
        const updates: Partial<PlayerState> = { skillPoints: player.skillPoints - 1 };
        if (upg === 'maxHp' && player.upgrades.maxHp < MAX_SKILL_TIER) {
            const newMax = player.maxHp + 25;
            updates.maxHp = newMax; updates.hp = newMax;
            updates.upgrades = { ...player.upgrades, maxHp: player.upgrades.maxHp + 1 };
        } else if (upg === 'damage' && player.upgrades.damage < MAX_SKILL_TIER) {
            updates.damage = player.damage + 10;
            updates.upgrades = { ...player.upgrades, damage: player.upgrades.damage + 1 };
        } else if (upg === 'speed' && player.upgrades.speed < MAX_SKILL_TIER) {
            updates.speed = player.speed + 0.5;
            updates.upgrades = { ...player.upgrades, speed: player.upgrades.speed + 1 };
        } else if (upg in player.spells) {
            const spell = player.spells[upg as SpellType];
            if (spell.tier >= MAX_SKILL_TIER) return;
            updates.spells = { ...player.spells, [upg]: { unlocked: true, tier: spell.tier + 1 } };
        } else return;
        set(s => ({ player: { ...s.player, ...updates } }));
    },

    setSpellCooldown: (spell, s) => set(st => ({ player: { ...st.player, spellCooldowns: { ...st.player.spellCooldowns, [spell]: s } } })),
    tickSpellCooldowns: dt => set(s => ({
        player: {
            ...s.player, spellCooldowns: {
                fireball: Math.max(0, s.player.spellCooldowns.fireball - dt),
                lightning: Math.max(0, s.player.spellCooldowns.lightning - dt),
                frostbolt: Math.max(0, s.player.spellCooldowns.frostbolt - dt),
                shadowbolt: Math.max(0, s.player.spellCooldowns.shadowbolt - dt),
            }
        }
    })),

    spawnZombies: entries => {
        const newZombies: ZombieData[] = entries.map(e => ({
            id: uid(), position: { ...e.position }, rotation: Math.random() * Math.PI * 2,
            type: e.type,
            hp: e.type === 'brute' ? BRUTE_HP : NORMAL_HP,
            maxHp: e.type === 'brute' ? BRUTE_HP : NORMAL_HP,
            state: 'chasing', stunTimer: 0, slowTimer: 0, attackCooldown: 0, dotEffects: [],
        }));
        set(s => ({
            zombies: [...s.zombies.filter(z => z.state !== 'dead'), ...newZombies],
            wave: { ...s.wave, zombiesRemaining: s.wave.zombiesRemaining + entries.length, totalSpawned: s.wave.totalSpawned + entries.length },
        }));
    },

    damageZombie: (id, amount, effect) => {
        const { zombies, wave } = get();
        const idx = zombies.findIndex(z => z.id === id);
        if (idx === -1) return;
        const zombie = zombies[idx];
        if (zombie.state === 'dying' || zombie.state === 'dead') return;
        const hp = Math.max(0, zombie.hp - amount);
        const isDying = hp <= 0;
        const updates: Partial<ZombieData> = { hp };
        if (effect === 'stun' && !isDying) updates.stunTimer = 1.5;
        if (effect === 'slow' && !isDying) updates.slowTimer = 3;
        if (isDying) { updates.state = 'dying'; get().gainXP(zombie.type === 'brute' ? XP_PER_KILL * 3 : XP_PER_KILL); }
        const newZombies = zombies.map((z, i) => i === idx ? { ...z, ...updates } : z);
        set({ zombies: newZombies });
        if (isDying) {
            const alive = newZombies.filter(z => z.state !== 'dying' && z.state !== 'dead');
            if (alive.length === 0 && wave.phase === 'active') {
                set(s => ({ wave: { ...s.wave, zombiesRemaining: 0, phase: 'resting', restTimer: 10 } }));
            } else {
                set(s => ({ wave: { ...s.wave, zombiesRemaining: Math.max(0, s.wave.zombiesRemaining - 1) } }));
            }
            // DOT spread on natural death
            const nonSpreadDots = zombie.dotEffects.filter(d => !d.isSpread);
            if (nonSpreadDots.length > 0) get().spreadDotFromPosition(zombie.position, nonSpreadDots[0]);
        }
    },

    applyDot: (zombieId, { dps, duration, isSpread }) => {
        const dot: DotEffect = {
            id: uid(), damage: dps * DOT_TICK_INTERVAL,
            tickInterval: DOT_TICK_INTERVAL, tickTimer: DOT_TICK_INTERVAL,
            remaining: duration, isSpread,
        };
        set(s => ({
            zombies: s.zombies.map(z =>
                z.id === zombieId && z.state !== 'dying' && z.state !== 'dead'
                    ? { ...z, dotEffects: [...z.dotEffects, dot] } : z
            )
        }));
    },

    spreadDotFromPosition: (position, templateDot) => {
        const { zombies } = get();
        const alive = zombies.filter(z => z.state !== 'dying' && z.state !== 'dead');
        const nearest5 = [...alive]
            .sort((a, b) => Math.hypot(a.position.x - position.x, a.position.z - position.z) - Math.hypot(b.position.x - position.x, b.position.z - position.z))
            .slice(0, 5);
        if (nearest5.length === 0) return;
        const ids = new Set(nearest5.map(z => z.id));
        set(s => ({
            zombies: s.zombies.map(z => {
                if (!ids.has(z.id)) return z;
                const spread: DotEffect = { id: uid(), damage: templateDot.damage, tickInterval: DOT_TICK_INTERVAL, tickTimer: DOT_TICK_INTERVAL, remaining: Math.min(templateDot.remaining, 6), isSpread: true };
                return { ...z, dotEffects: [...z.dotEffects, spread] };
            })
        }));
    },

    tickZombies: (dt, playerPos) => {
        const { zombies, wave } = get();
        const ATTACK_RANGE = 1.8, SEP_R = 1.4, SEP_S = 1.8;
        const died: { zombie: ZombieData }[] = [];

        const updated = zombies.map(zombie => {
            if (zombie.state === 'dying' || zombie.state === 'dead') return zombie;
            let { stunTimer, slowTimer, attackCooldown, state, position, rotation, hp, dotEffects } = zombie;

            // Process DOT ticks
            let totalDotDmg = 0;
            const newDotEffects: DotEffect[] = [];
            for (const dot of dotEffects) {
                const newTimer = dot.tickTimer - dt;
                const newRemaining = dot.remaining - dt;
                if (newTimer <= 0) totalDotDmg += dot.damage;
                if (newRemaining > 0) newDotEffects.push({ ...dot, tickTimer: newTimer <= 0 ? dot.tickInterval : newTimer, remaining: newRemaining });
            }
            hp = Math.max(0, hp - totalDotDmg);
            dotEffects = newDotEffects;

            if (hp <= 0) {
                died.push({ zombie: { ...zombie, dotEffects } });
                return { ...zombie, hp: 0, state: 'dying' as ZombieState, dotEffects };
            }

            if (stunTimer > 0) stunTimer = Math.max(0, stunTimer - dt);
            if (slowTimer > 0) slowTimer = Math.max(0, slowTimer - dt);
            if (attackCooldown > 0) attackCooldown = Math.max(0, attackCooldown - dt);
            if (stunTimer > 0) return { ...zombie, hp, dotEffects, stunTimer, slowTimer, attackCooldown, state: 'stunned' as ZombieState };

            const dx = playerPos.x - position.x, dz = playerPos.z - position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            const baseSpeed = zombie.type === 'brute' ? BRUTE_SPD : NORMAL_SPD;
            const spd = slowTimer > 0 ? baseSpeed * 0.5 : baseSpeed;

            if (dist > ATTACK_RANGE) {
                const nx = dx / dist, nz = dz / dist;
                let sx = 0, sz = 0;
                for (const o of zombies) {
                    if (o.id === zombie.id || o.state === 'dying' || o.state === 'dead') continue;
                    const ox = position.x - o.position.x, oz = position.z - o.position.z;
                    const od = Math.sqrt(ox * ox + oz * oz);
                    if (od < SEP_R && od > 0.01) { const ov = (SEP_R - od) / SEP_R; sx += (ox / od) * ov * SEP_S; sz += (oz / od) * ov * SEP_S; }
                }
                position = { x: position.x + (nx * spd + sx) * dt, y: position.y, z: position.z + (nz * spd + sz) * dt };
                rotation = Math.atan2(nx, nz);
                state = 'chasing';
            } else {
                state = 'attacking';
                if (attackCooldown <= 0) {
                    attackCooldown = zombie.type === 'brute' ? 2.0 : 1.5;
                    get().damagePlayer(zombie.type === 'brute' ? BRUTE_DMG : NORMAL_DMG);
                }
            }
            return { ...zombie, hp, dotEffects, position, rotation, stunTimer, slowTimer, attackCooldown, state };
        });

        set({ zombies: updated });

        // Handle DOT deaths post-set
        for (const { zombie } of died) {
            get().gainXP(zombie.type === 'brute' ? XP_PER_KILL * 3 : XP_PER_KILL);
            const nonSpreadDots = zombie.dotEffects.filter(d => !d.isSpread);
            if (nonSpreadDots.length > 0) get().spreadDotFromPosition(zombie.position, nonSpreadDots[0]);
            set(s => ({ wave: { ...s.wave, zombiesRemaining: Math.max(0, s.wave.zombiesRemaining - 1) } }));
        }
        if (died.length > 0) get().checkWaveComplete();
    },

    removeDeadZombies: () => set(s => ({ zombies: s.zombies.filter(z => z.state !== 'dead') })),

    addProjectile: p => set(s => ({ projectiles: [...s.projectiles, { ...p, id: uid() }] })),

    tickProjectiles: dt => {
        const { projectiles, zombies } = get();
        const removed = new Set<string>();
        type Hit = { id: string; amount: number; effect?: 'stun' | 'slow'; dot?: { dps: number; duration: number }; chainFrom?: Vec3; chainCount?: number; chillPos?: Vec3; chillRadius?: number; dotAoePos?: Vec3; dotAoeRadius?: number; dotDps?: number; dotDur?: number; explodeAt?: Vec3; explodeRadius?: number; explodeStyle?: 'fire' | 'shadow' };
        const hits: Hit[] = [];

        const updatedProj = projectiles.map(proj => {
            if (proj.ttl <= 0) { removed.add(proj.id); return proj; }
            const pos: Vec3 = {
                x: proj.position.x + proj.direction.x * proj.speed * dt,
                y: proj.position.y + proj.direction.y * proj.speed * dt - (proj.type === 'arrow' ? 0.5 * dt : 0),
                z: proj.position.z + proj.direction.z * proj.speed * dt,
            };
            for (const zombie of zombies) {
                if (zombie.state === 'dying' || zombie.state === 'dead') continue;
                const ddx = pos.x - zombie.position.x, ddz = pos.z - zombie.position.z;
                if (Math.sqrt(ddx * ddx + ddz * ddz) >= proj.hitRadius) continue;

                removed.add(proj.id);
                const hit: Hit = { id: zombie.id, amount: proj.damage };

                if (proj.type === 'fireball') {
                    if (proj.aoeRadius) {
                        // AOE damage (tier 3+)
                        for (const z2 of zombies) {
                            if (z2.state === 'dying' || z2.state === 'dead') continue;
                            const d2x = pos.x - z2.position.x, d2z = pos.z - z2.position.z;
                            if (Math.sqrt(d2x * d2x + d2z * d2z) < proj.aoeRadius) hits.push({ id: z2.id, amount: proj.damage });
                        }
                        hit.amount = 0; // already pushed above for initial target
                    }
                    hit.explodeAt = { ...pos }; hit.explodeRadius = proj.aoeRadius ?? 1.5; hit.explodeStyle = 'fire';
                } else if (proj.type === 'frostbolt') {
                    hit.effect = 'slow';
                    if (proj.chillRadius) { hit.chillPos = { ...pos }; hit.chillRadius = proj.chillRadius; }
                } else if (proj.type === 'lightning') {
                    if (proj.chainCount && proj.chainCount > 0) {
                        hit.chainFrom = { ...pos }; hit.chainCount = proj.chainCount;
                    }
                } else if (proj.type === 'shadowbolt') {
                    if (proj.dotDps) hit.dot = { dps: proj.dotDps, duration: proj.dotDuration ?? 6 };
                    if (proj.dotRadius) { hit.dotAoePos = { ...pos }; hit.dotAoeRadius = proj.dotRadius; hit.dotDps = proj.dotDps; hit.dotDur = proj.dotDuration; hit.explodeAt = { ...pos }; hit.explodeRadius = proj.dotRadius; hit.explodeStyle = 'shadow'; }
                }
                hits.push(hit);
                break;
            }
            return { ...proj, position: pos, ttl: proj.ttl - dt };
        });

        // Apply hits
        for (const h of hits) {
            if (h.amount > 0 || h.effect) get().damageZombie(h.id, h.amount, h.effect);
            if (h.dot) get().applyDot(h.id, { dps: h.dot.dps, duration: h.dot.duration, isSpread: false });
            if (h.explodeAt) get().addExplosion(h.explodeAt, h.explodeRadius ?? 2.5, h.explodeStyle);
            if (h.chillPos && h.chillRadius) {
                const cur = get().zombies;
                for (const z of cur) {
                    if (z.state === 'dying' || z.state === 'dead') continue;
                    const dx = h.chillPos.x - z.position.x, dz = h.chillPos.z - z.position.z;
                    if (Math.sqrt(dx * dx + dz * dz) < h.chillRadius) get().damageZombie(z.id, 0, 'slow');
                }
            }
            if (h.chainFrom && h.chainCount) {
                const cur = get().zombies;
                const chains = cur.filter(z => z.id !== h.id && z.state !== 'dying' && z.state !== 'dead')
                    .sort((a, b) => Math.hypot(a.position.x - h.chainFrom!.x, a.position.z - h.chainFrom!.z) - Math.hypot(b.position.x - h.chainFrom!.x, b.position.z - h.chainFrom!.z))
                    .slice(0, h.chainCount);
                for (const c of chains) {
                    get().damageZombie(c.id, Math.round(h.amount * 0.65));
                    get().addLightningArc(h.chainFrom, c.position);
                }
            }
            if (h.dotAoePos && h.dotAoeRadius && h.dotDps) {
                const cur = get().zombies;
                for (const z of cur) {
                    if (z.id === h.id || z.state === 'dying' || z.state === 'dead') continue;
                    const dx = h.dotAoePos.x - z.position.x, dz = h.dotAoePos.z - z.position.z;
                    if (Math.sqrt(dx * dx + dz * dz) < h.dotAoeRadius) get().applyDot(z.id, { dps: h.dotDps, duration: h.dotDur ?? 6, isSpread: false });
                }
            }
        }
        set({ projectiles: updatedProj.filter(p => !removed.has(p.id) && p.ttl > 0) });
    },

    addExplosion: (position, radius, style = 'fire') => set(s => ({
        explosions: [...s.explosions, { id: uid(), position: { ...position }, radius, progress: 0, duration: 0.7, style }]
    })),
    tickExplosions: dt => set(s => ({
        explosions: s.explosions.map(e => ({ ...e, progress: e.progress + dt / e.duration })).filter(e => e.progress < 1)
    })),

    addLightningArc: (from, to) => set(s => ({
        lightningArcs: [...s.lightningArcs, { id: uid(), from: { ...from }, to: { ...to }, ttl: 0.5 }]
    })),
    tickLightningArcs: dt => set(s => ({
        lightningArcs: s.lightningArcs.map(a => ({ ...a, ttl: a.ttl - dt })).filter(a => a.ttl > 0)
    })),

    startGame: () => {
        const waveNum = 1;
        const total = zombiesForWave(waveNum);
        const brutes = bruteCountForWave(waveNum);
        const allEntries = makeSpawnEntries(total, brutes);
        const firstBatch = allEntries.slice(0, SPAWN_BATCH_SIZE);
        const rest = allEntries.slice(SPAWN_BATCH_SIZE);
        set({
            player: initialPlayer(), zombies: [], projectiles: [], explosions: [], lightningArcs: [],
            gameRunning: true, gameOver: false, gamePaused: false,
            wave: {
                number: waveNum, phase: 'active', zombiesRemaining: 0, restTimer: 0, totalSpawned: 0,
                pendingSpawns: rest.length, spawnBatchTimer: SPAWN_BATCH_INTERVAL, pendingEntries: rest,
            }
        });
        get().spawnZombies(firstBatch);
    },

    nextWave: () => {
        const waveNum = get().wave.number + 1;
        const total = zombiesForWave(waveNum);
        const brutes = bruteCountForWave(waveNum);
        const allEntries = makeSpawnEntries(total, brutes);
        const firstBatch = allEntries.slice(0, SPAWN_BATCH_SIZE);
        const rest = allEntries.slice(SPAWN_BATCH_SIZE);
        set(s => ({
            zombies: [],
            wave: {
                number: waveNum, phase: 'active', zombiesRemaining: 0, restTimer: 0, totalSpawned: 0,
                pendingSpawns: rest.length, spawnBatchTimer: SPAWN_BATCH_INTERVAL, pendingEntries: rest,
            }
        }));
        get().spawnZombies(firstBatch);
    },

    checkWaveComplete: () => {
        const { wave, zombies } = get();
        if (wave.phase !== 'active') return;
        if (wave.pendingSpawns > 0) return; // more to come
        const alive = zombies.filter(z => z.state !== 'dying' && z.state !== 'dead');
        if (alive.length === 0 && wave.totalSpawned > 0) set(s => ({ wave: { ...s.wave, phase: 'resting', restTimer: 10 } }));
    },

    tickWaveTimer: dt => {
        const { wave } = get();
        if (wave.phase !== 'resting') return;
        const restTimer = Math.max(0, wave.restTimer - dt);
        if (restTimer <= 0) get().nextWave();
        else set(s => ({ wave: { ...s.wave, restTimer } }));
    },

    tickWaveSpawner: dt => {
        const { wave, gamePaused } = get();
        if (gamePaused || wave.phase !== 'active' || wave.pendingSpawns <= 0) return;
        const newTimer = wave.spawnBatchTimer - dt;
        if (newTimer <= 0) {
            const batch = wave.pendingEntries.slice(0, SPAWN_BATCH_SIZE);
            const remaining = wave.pendingEntries.slice(SPAWN_BATCH_SIZE);
            set(s => ({
                wave: {
                    ...s.wave,
                    pendingSpawns: remaining.length,
                    spawnBatchTimer: SPAWN_BATCH_INTERVAL,
                    pendingEntries: remaining,
                }
            }));
            get().spawnZombies(batch);
        } else {
            set(s => ({ wave: { ...s.wave, spawnBatchTimer: newTimer } }));
        }
    },

    pauseGame: () => set({ gamePaused: true }),
    resumeGame: () => set({ gamePaused: false }),
    togglePause: () => set(s => ({ gamePaused: !s.gamePaused })),

    setTargetedZombie: id => set({ targetedZombieId: id }),
    toggleSkillMenu: () => set(s => ({ skillMenuOpen: !s.skillMenuOpen })),
    setSkillMenuOpen: open => set({ skillMenuOpen: open }),
    addDamageNumber: (position, amount, type) => set(s => ({ damageNumbers: [...s.damageNumbers, { id: uid(), position, amount, type, timestamp: Date.now() }] })),
    clearOldDamageNumbers: () => { const now = Date.now(); set(s => ({ damageNumbers: s.damageNumbers.filter(d => now - d.timestamp < 1200) })); },
}));
