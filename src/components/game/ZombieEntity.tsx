'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore, ZombieData } from '@/lib/gameStore';
import { getTerrainHeight } from '@/components/simulation/Terrain';
import { useSimulationStore } from '@/lib/simulationStore';

interface Props { zombie: ZombieData; }

export default function ZombieEntity({ zombie }: Props) {
    const groupRef = useRef<THREE.Group>(null);
    const leftArmRef = useRef<THREE.Group>(null);
    const rightArmRef = useRef<THREE.Group>(null);
    const leftLegRef = useRef<THREE.Group>(null);
    const rightLegRef = useRef<THREE.Group>(null);
    const dyingTimer = useRef(0);

    const environment = useSimulationStore(s => s.environment);
    const targetedZombieId = useGameStore(s => s.targetedZombieId);
    const isTargeted = targetedZombieId === zombie.id;
    const isBrute = zombie.type === 'brute';

    useFrame((state, delta) => {
        if (!groupRef.current) return;

        if (zombie.state === 'dying') {
            dyingTimer.current += delta;
            groupRef.current.position.y -= delta * 1.4;
            if (groupRef.current.scale.y > 0) groupRef.current.scale.y = Math.max(0, 1 - dyingTimer.current / 1.0);
            return;
        }
        if (zombie.state === 'dead') return;

        const terrainY = getTerrainHeight(zombie.position.x, zombie.position.z, environment.terrain.seed, environment.terrain.heightScale);
        groupRef.current.position.set(zombie.position.x, terrainY, zombie.position.z);
        groupRef.current.rotation.y = zombie.rotation;

        const t = state.clock.elapsedTime + zombie.position.x * 0.3;
        const isChasing = zombie.state === 'chasing';
        const isAttacking = zombie.state === 'attacking';
        const isStunned = zombie.state === 'stunned';

        groupRef.current.rotation.z = isStunned ? Math.sin(t * 22) * 0.28 : 0;

        const spd = zombie.slowTimer > 0 ? 5 : (isBrute ? 6 : 9);
        if (isChasing) {
            if (leftLegRef.current) leftLegRef.current.rotation.x = Math.sin(t * spd) * 0.52;
            if (rightLegRef.current) rightLegRef.current.rotation.x = Math.sin(t * spd + Math.PI) * 0.52;
            if (leftArmRef.current) leftArmRef.current.rotation.x = -1.5 + Math.sin(t * spd + 0.4) * 0.25;
            if (rightArmRef.current) rightArmRef.current.rotation.x = -1.5 + Math.sin(t * spd) * 0.25;
        } else if (isAttacking) {
            if (leftArmRef.current) leftArmRef.current.rotation.x = -1.8 + Math.sin(t * 7) * 0.65;
            if (rightArmRef.current) rightArmRef.current.rotation.x = -1.8 + Math.sin(t * 7 + Math.PI / 2) * 0.65;
            if (leftLegRef.current) leftLegRef.current.rotation.x = 0;
            if (rightLegRef.current) rightLegRef.current.rotation.x = 0;
        } else {
            if (leftArmRef.current) leftArmRef.current.rotation.x = -1.3 + Math.sin(t * 1.3) * 0.1;
            if (rightArmRef.current) rightArmRef.current.rotation.x = -1.3 + Math.sin(t * 1.3 + Math.PI) * 0.1;
        }
    });

    if (zombie.state === 'dead') return null;

    const hpPct = zombie.hp / zombie.maxHp;
    const isFrosted = zombie.slowTimer > 0;

    // Visual palette differs for brutes
    const skinColor = isFrosted
        ? (isBrute ? '#3a7a6f' : '#4a9a7f')
        : (isBrute ? '#3a5a20' : '#4a7a3a');
    const armorColor = isBrute ? '#2a1a08' : undefined;
    const eyeColor = zombie.state === 'attacking' ? '#ff0000' : '#cc2200';
    const modelScale = isBrute ? 1.65 : 1.0;

    return (
        <group ref={groupRef} scale={[modelScale, modelScale, modelScale]}>
            {/* Target ring */}
            {isTargeted && (
                <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[0.7, 0.88, 28]} />
                    <meshStandardMaterial color="#ffdd00" emissive="#ffdd00" emissiveIntensity={1.8} transparent opacity={0.9} />
                </mesh>
            )}

            {/* HP bar */}
            <Html position={[0, isBrute ? 3.2 : 2.5, 0]} center distanceFactor={10} occlude>
                <div style={{
                    width: isBrute ? 70 : 50, height: 7,
                    background: '#330000', borderRadius: 3,
                    border: isTargeted ? '1px solid #ffdd00' : (isBrute ? '1px solid #aa4400' : '1px solid #660000'),
                    overflow: 'hidden', pointerEvents: 'none'
                }}>
                    <div style={{
                        width: `${hpPct * 100}%`, height: '100%',
                        background: hpPct > 0.5 ? '#22cc22' : hpPct > 0.25 ? '#ee9900' : '#cc2200',
                        transition: 'width 0.1s'
                    }} />
                </div>
                {isBrute && <div style={{ textAlign: 'center', color: '#ff6622', fontSize: 8, fontWeight: 800, marginTop: 1 }}>BRUTE</div>}
            </Html>

            {/* Body */}
            <mesh position={[0, 0.85, 0]} castShadow>
                <boxGeometry args={[isBrute ? 0.54 : 0.42, 0.62, isBrute ? 0.38 : 0.30]} />
                <meshStandardMaterial color={skinColor} roughness={0.85} />
            </mesh>
            {isBrute && (
                <mesh position={[0, 0.85, 0.2]}>
                    <boxGeometry args={[0.48, 0.55, 0.06]} />
                    <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
                </mesh>
            )}
            {/* Head */}
            <mesh position={[0, 1.42, 0]} castShadow>
                <boxGeometry args={[isBrute ? 0.36 : 0.28, isBrute ? 0.36 : 0.28, isBrute ? 0.34 : 0.27]} />
                <meshStandardMaterial color={skinColor} roughness={0.9} />
            </mesh>
            {/* Eyes */}
            {[-0.08, 0.08].map((ex, i) => (
                <mesh key={i} position={[ex, 1.44, isBrute ? 0.18 : 0.14]}>
                    <sphereGeometry args={[0.045, 6, 6]} />
                    <meshStandardMaterial color={eyeColor} emissive={eyeColor} emissiveIntensity={isBrute ? 2.5 : 1.5} />
                </mesh>
            ))}
            {/* Brute horns */}
            {isBrute && (
                <>
                    <mesh position={[-0.12, 1.7, 0]} rotation={[0, 0, -0.4]}>
                        <coneGeometry args={[0.04, 0.22, 5]} />
                        <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
                    </mesh>
                    <mesh position={[0.12, 1.7, 0]} rotation={[0, 0, 0.4]}>
                        <coneGeometry args={[0.04, 0.22, 5]} />
                        <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
                    </mesh>
                </>
            )}
            {/* Left arm */}
            <group ref={leftArmRef} position={[-0.30, 0.88, 0]} rotation={[0, 0, 0.15]}>
                <mesh castShadow>
                    <boxGeometry args={[0.14, 0.55, 0.13]} />
                    <meshStandardMaterial color={skinColor} roughness={0.88} />
                </mesh>
                <mesh position={[0, -0.30, 0]}>
                    <boxGeometry args={[0.15, 0.14, 0.08]} />
                    <meshStandardMaterial color={armorColor ?? '#3a5a2a'} roughness={0.9} />
                </mesh>
            </group>
            {/* Right arm */}
            <group ref={rightArmRef} position={[0.30, 0.88, 0]} rotation={[0, 0, -0.15]}>
                <mesh castShadow>
                    <boxGeometry args={[0.14, 0.55, 0.13]} />
                    <meshStandardMaterial color={skinColor} roughness={0.88} />
                </mesh>
                <mesh position={[0, -0.30, 0]}>
                    <boxGeometry args={[0.15, 0.14, 0.08]} />
                    <meshStandardMaterial color={armorColor ?? '#3a5a2a'} roughness={0.9} />
                </mesh>
            </group>
            {/* Left leg */}
            <group ref={leftLegRef} position={[-0.13, 0.28, 0]}>
                <mesh castShadow>
                    <boxGeometry args={[0.16, 0.60, 0.15]} />
                    <meshStandardMaterial color={armorColor ?? '#2a3a1a'} roughness={0.9} />
                </mesh>
            </group>
            {/* Right leg */}
            <group ref={rightLegRef} position={[0.13, 0.28, 0]}>
                <mesh castShadow>
                    <boxGeometry args={[0.16, 0.60, 0.15]} />
                    <meshStandardMaterial color={armorColor ?? '#2a3a1a'} roughness={0.9} />
                </mesh>
            </group>
            {/* Frost slow overlay */}
            {isFrosted && (
                <mesh position={[0, 0.9, 0]}>
                    <boxGeometry args={[0.55, 0.75, 0.40]} />
                    <meshStandardMaterial color="#88ddff" transparent opacity={0.28} roughness={0.1} metalness={0.2} />
                </mesh>
            )}
            {/* Shadow DOT overlay */}
            {zombie.dotEffects.length > 0 && (
                <mesh position={[0, 0.9, 0]}>
                    <sphereGeometry args={[isBrute ? 0.62 : 0.45, 8, 8]} />
                    <meshStandardMaterial color="#660099" emissive="#440066" emissiveIntensity={0.8}
                        transparent opacity={0.28 + zombie.dotEffects[0].remaining / 20} depthWrite={false} />
                </mesh>
            )}
        </group>
    );
}
