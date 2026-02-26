'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore, ProjectileData, ExplosionData, LightningArc } from '@/lib/gameStore';

// ── Fireball ──────────────────────────────────────────────────────────────
function Fireball({ proj }: { proj: ProjectileData }) {
    const meshRef = useRef<THREE.Mesh>(null);
    useFrame(({ clock }) => { if (meshRef.current) meshRef.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 14) * 0.14); });
    return (
        <group position={[proj.position.x, proj.position.y, proj.position.z]}>
            <mesh ref={meshRef}><sphereGeometry args={[0.23, 10, 10]} /><meshStandardMaterial color="#ff6600" emissive="#ff3300" emissiveIntensity={2.2} roughness={0.3} /></mesh>
            <pointLight color="#ff4400" intensity={4} distance={6} decay={2} />
        </group>
    );
}

// ── Frostbolt ─────────────────────────────────────────────────────────────
function Frostbolt({ proj }: { proj: ProjectileData }) {
    const meshRef = useRef<THREE.Mesh>(null);
    useFrame(() => { if (meshRef.current) meshRef.current.rotation.z += 0.1; });
    return (
        <group position={[proj.position.x, proj.position.y, proj.position.z]}>
            <mesh ref={meshRef}><octahedronGeometry args={[0.19, 0]} /><meshStandardMaterial color="#88ccff" emissive="#4488ff" emissiveIntensity={1.6} roughness={0.1} metalness={0.3} transparent opacity={0.9} /></mesh>
            <pointLight color="#4488ff" intensity={2.5} distance={4} decay={2} />
        </group>
    );
}

// ── Shadowbolt ────────────────────────────────────────────────────────────
function Shadowbolt({ proj }: { proj: ProjectileData }) {
    const meshRef = useRef<THREE.Mesh>(null);
    const auraRef = useRef<THREE.Mesh>(null);
    useFrame(({ clock }) => {
        if (meshRef.current) { meshRef.current.rotation.x += 0.12; meshRef.current.rotation.z += 0.08; }
        if (auraRef.current) { const p = (Math.sin(clock.elapsedTime * 8) + 1) * 0.5; auraRef.current.scale.setScalar(1.4 + p * 0.4); }
    });
    return (
        <group position={[proj.position.x, proj.position.y, proj.position.z]}>
            <mesh ref={auraRef}><sphereGeometry args={[0.18, 8, 8]} /><meshStandardMaterial color="#220033" emissive="#550088" emissiveIntensity={0.8} transparent opacity={0.3} depthWrite={false} /></mesh>
            <mesh ref={meshRef}><octahedronGeometry args={[0.16, 0]} /><meshStandardMaterial color="#8800cc" emissive="#6600aa" emissiveIntensity={2.5} /></mesh>
            <pointLight color="#9900ff" intensity={4} distance={6} decay={2} />
        </group>
    );
}

// ── Arrow (crossbow bolt) ──────────────────────────────────────────────────
function Arrow({ proj }: { proj: ProjectileData }) {
    const angle = Math.atan2(proj.direction.x, proj.direction.z);
    return (
        <group position={[proj.position.x, proj.position.y, proj.position.z]} rotation={[0, angle, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.025, 0.025, 0.55, 4]} /><meshStandardMaterial color="#5a3a10" roughness={0.8} /></mesh>
            <mesh position={[0, 0, -0.30]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[0.04, 0.14, 4]} /><meshStandardMaterial color="#ccc" metalness={0.9} roughness={0.15} /></mesh>
            <mesh position={[0, 0, 0.26]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[0.055, 0.10, 3]} /><meshStandardMaterial color="#8b0000" roughness={0.9} /></mesh>
        </group>
    );
}

// ── Lightning ─────────────────────────────────────────────────────────────
function Lightning({ proj }: { proj: ProjectileData }) {
    return (
        <group position={[proj.position.x, proj.position.y, proj.position.z]}>
            <mesh><sphereGeometry args={[0.16, 8, 8]} /><meshStandardMaterial color="#ffffff" emissive="#aaddff" emissiveIntensity={6} transparent opacity={0.9} /></mesh>
            <pointLight color="#aaddff" intensity={10} distance={10} decay={2} />
        </group>
    );
}

// ── Lightning Arc ─────────────────────────────────────────────────────────
// Pre-seeded jitter so points stay stable per-arc (not flickering every frame)
function buildArcPoints(
    from: { x: number; y: number; z: number },
    to: { x: number; y: number; z: number },
    segments: number,
    jitterAmt: number,
    seed: number
): [number, number, number][] {
    const pts: [number, number, number][] = [];
    let r = seed;
    const rand = () => { r = (r * 16807 + 0) % 2147483647; return (r / 2147483647) - 0.5; };
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const j = i > 0 && i < segments ? jitterAmt : 0;
        pts.push([
            from.x + (to.x - from.x) * t + rand() * j,
            from.y + (to.y - from.y) * t + 0.65 + rand() * j * 0.5,
            from.z + (to.z - from.z) * t + rand() * j,
        ]);
    }
    return pts;
}

function LightningArcLine({ arc }: { arc: LightningArc }) {
    const life = Math.max(0, arc.ttl / 0.5); // 0→1 fade out (ttl is 0.5s now)
    const seed = parseInt(arc.id.replace(/\D/g, '').slice(0, 8) || '12345');

    // Core jagged line (12 segments, heavy jitter)
    const core = buildArcPoints(arc.from, arc.to, 12, 0.65, seed);
    // Glow fringe (8 segments, less jitter — offset slightly)
    const fringe = buildArcPoints(arc.from, arc.to, 8, 0.3, seed + 99);

    // Fork branch from midpoint
    const midIdx = Math.floor(core.length / 2);
    const mid = core[midIdx];
    const forkEnd = {
        x: mid[0] + (Math.sin(seed * 0.1) * 1.2),
        y: mid[1] + 0.5,
        z: mid[2] + (Math.cos(seed * 0.1) * 1.2),
    };
    const forkPts = buildArcPoints(
        { x: mid[0], y: mid[1], z: mid[2] },
        forkEnd, 5, 0.3, seed + 777
    );

    const impactScale = life * 0.55;

    return (
        <group>
            {/* Outer glow fringe */}
            <Line points={fringe} color="#6699ff" lineWidth={6}
                transparent opacity={life * 0.35} depthWrite={false} />
            {/* Bright core */}
            <Line points={core} color="#ffffff" lineWidth={2.5}
                transparent opacity={life * 0.95} />
            {/* Electric blue mid-tone overlay */}
            <Line points={core} color="#aaddff" lineWidth={4}
                transparent opacity={life * 0.55} depthWrite={false} />
            {/* Fork branch */}
            <Line points={forkPts} color="#88bbff" lineWidth={1.5}
                transparent opacity={life * 0.6} />

            {/* Impact flash at target */}
            {impactScale > 0 && (
                <group position={[arc.to.x, arc.to.y + 0.65, arc.to.z]}>
                    <mesh scale={[impactScale, impactScale, impactScale]}>
                        <sphereGeometry args={[1, 8, 8]} />
                        <meshStandardMaterial
                            color="#ffffff" emissive="#aaddff" emissiveIntensity={6}
                            transparent opacity={life * 0.8} depthWrite={false}
                        />
                    </mesh>
                    <pointLight
                        color="#88ccff" intensity={12 * life}
                        distance={5} decay={2}
                    />
                </group>
            )}
        </group>
    );
}

// ── Explosion ─────────────────────────────────────────────────────────────
function Explosion({ exp }: { exp: ExplosionData }) {
    const p = exp.progress;
    const isShadow = exp.style === 'shadow';
    const easeOut = 1 - Math.pow(1 - p, 2);
    const scale = easeOut * exp.radius * 1.6;
    const opacity = Math.max(0, 1 - p * 1.4);
    const coreScale = Math.max(0, (1 - p * 1.8)) * exp.radius * 0.7;
    const coreOpacity = Math.max(0, 1 - p * 2);
    const debrisR = easeOut * exp.radius * 1.2;

    const outerColor = isShadow ? '#6600cc' : '#ff4400';
    const outerEmit = isShadow ? '#440088' : '#ff2200';
    const lightColor = isShadow ? '#9900ff' : '#ff5500';
    const d1 = isShadow ? '#9900cc' : '#ff6600';
    const d2 = isShadow ? '#440066' : '#cc2200';

    return (
        <group position={[exp.position.x, exp.position.y + 0.5, exp.position.z]}>
            {scale > 0 && <mesh scale={[scale, scale * 0.55, scale]}>
                <sphereGeometry args={[1, 12, 12]} />
                <meshStandardMaterial color={outerColor} emissive={outerEmit} emissiveIntensity={1.5 * opacity} transparent opacity={opacity * 0.55} depthWrite={false} />
            </mesh>}
            {coreScale > 0 && <mesh scale={[coreScale, coreScale, coreScale]}>
                <sphereGeometry args={[1, 8, 8]} />
                <meshStandardMaterial color={isShadow ? '#cc88ff' : '#ffffff'} emissive={isShadow ? '#aa44ff' : '#ffee88'} emissiveIntensity={4} transparent opacity={coreOpacity} depthWrite={false} />
            </mesh>}
            {[0, 1, 2, 3, 4, 5].map(i => {
                const a = (i / 6) * Math.PI * 2;
                const dr = debrisR * (0.6 + (i % 3) * 0.2);
                const dy = -p * 1.5 * (i % 2 === 0 ? 1.2 : 0.6);
                const ds = Math.max(0, (0.25 - p * 0.3)) * exp.radius * 0.5;
                if (ds <= 0) return null;
                return <mesh key={i} position={[Math.cos(a) * dr, dy, Math.sin(a) * dr]} scale={[ds, ds, ds]}>
                    <sphereGeometry args={[1, 6, 6]} />
                    <meshStandardMaterial color={i % 2 === 0 ? d1 : d2} emissive={i % 2 === 0 ? d1 : d2} emissiveIntensity={0.8} transparent opacity={Math.max(0, opacity * 1.2)} depthWrite={false} />
                </mesh>;
            })}
            {opacity > 0.05 && <pointLight color={lightColor} intensity={8 * opacity} distance={exp.radius * 4} decay={2} />}
        </group>
    );
}

// ── Main system ───────────────────────────────────────────────────────────
export default function ProjectileSystem() {
    const projectiles = useGameStore(s => s.projectiles);
    const explosions = useGameStore(s => s.explosions);
    const lightningArcs = useGameStore(s => s.lightningArcs);
    const tickProjectiles = useGameStore(s => s.tickProjectiles);
    const tickExplosions = useGameStore(s => s.tickExplosions);
    const tickLightArcs = useGameStore(s => s.tickLightningArcs);

    useFrame((_, delta) => {
        const { gamePaused } = useGameStore.getState();
        if (gamePaused) return;
        tickProjectiles(delta);
        tickExplosions(delta);
        tickLightArcs(delta);
    });

    return (
        <>
            {projectiles.map(proj => {
                switch (proj.type) {
                    case 'fireball': return <Fireball key={proj.id} proj={proj} />;
                    case 'frostbolt': return <Frostbolt key={proj.id} proj={proj} />;
                    case 'shadowbolt': return <Shadowbolt key={proj.id} proj={proj} />;
                    case 'arrow': return <Arrow key={proj.id} proj={proj} />;
                    case 'lightning': return <Lightning key={proj.id} proj={proj} />;
                    default: return null;
                }
            })}
            {explosions.map(exp => <Explosion key={exp.id} exp={exp} />)}
            {lightningArcs.map(arc => <LightningArcLine key={arc.id} arc={arc} />)}
        </>
    );
}
