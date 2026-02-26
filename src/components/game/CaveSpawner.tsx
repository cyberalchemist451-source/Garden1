'use client';

import { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { getTerrainHeight } from '@/components/simulation/Terrain';
import { useSimulationStore } from '@/lib/simulationStore';
import { CAVE_POSITION } from '@/lib/gameStore';

export default function CaveSpawner() {
    const environment = useSimulationStore(s => s.environment);
    const mountRef = useRef<THREE.Group>(null);

    // Position cave on terrain
    useEffect(() => {
        if (!mountRef.current) return;
        const terrainY = getTerrainHeight(
            CAVE_POSITION.x, CAVE_POSITION.z,
            environment.terrain.seed,
            environment.terrain.heightScale
        );
        mountRef.current.position.set(CAVE_POSITION.x, terrainY, CAVE_POSITION.z);
    }, [environment]);

    // Animated blood-red glow
    const glowRef = useRef<THREE.PointLight>(null);
    useFrame(({ clock }) => {
        if (glowRef.current) {
            glowRef.current.intensity = 1.5 + Math.sin(clock.elapsedTime * 2) * 0.5;
        }
    });

    return (
        <group ref={mountRef}>
            {/* Cave floor — dark stone circle */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} receiveShadow>
                <circleGeometry args={[4, 16]} />
                <meshStandardMaterial color="#1a1a1a" roughness={1} />
            </mesh>

            {/* Left rock pillar */}
            <mesh position={[-2.2, 2.0, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.7, 1.0, 4, 7]} />
                <meshStandardMaterial color="#333333" roughness={0.95} />
            </mesh>
            {/* Left pillar cap */}
            <mesh position={[-2.2, 4.5, 0]}>
                <coneGeometry args={[1.0, 1.5, 7]} />
                <meshStandardMaterial color="#2a2a2a" roughness={1} />
            </mesh>

            {/* Right rock pillar */}
            <mesh position={[2.2, 2.0, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.7, 1.0, 4, 7]} />
                <meshStandardMaterial color="#333333" roughness={0.95} />
            </mesh>
            {/* Right pillar cap */}
            <mesh position={[2.2, 4.5, 0]}>
                <coneGeometry args={[1.0, 1.5, 7]} />
                <meshStandardMaterial color="#2a2a2a" roughness={1} />
            </mesh>

            {/* Arch lintel across top */}
            <mesh position={[0, 4.3, 0]} castShadow>
                <boxGeometry args={[5.5, 0.8, 1.2]} />
                <meshStandardMaterial color="#2a2a2a" roughness={0.95} />
            </mesh>

            {/* Side rocks (left cluster) */}
            <mesh position={[-3.5, 0.6, 0.5]} castShadow>
                <dodecahedronGeometry args={[1.0, 0]} />
                <meshStandardMaterial color="#2d2d2d" roughness={1} />
            </mesh>
            <mesh position={[-4.2, 0.4, -0.8]}>
                <dodecahedronGeometry args={[0.7, 0]} />
                <meshStandardMaterial color="#222" roughness={1} />
            </mesh>

            {/* Side rocks (right cluster) */}
            <mesh position={[3.5, 0.6, 0.5]} castShadow>
                <dodecahedronGeometry args={[1.0, 0]} />
                <meshStandardMaterial color="#2d2d2d" roughness={1} />
            </mesh>
            <mesh position={[4.3, 0.4, -0.5]}>
                <dodecahedronGeometry args={[0.75, 0]} />
                <meshStandardMaterial color="#222" roughness={1} />
            </mesh>

            {/* Cave darkness plane (occlude interior) */}
            <mesh position={[0, 2.0, 0.3]}>
                <planeGeometry args={[4, 4.5]} />
                <meshStandardMaterial color="#050505" roughness={1} side={THREE.DoubleSide} />
            </mesh>

            {/* Blood-red glow from cave mouth */}
            <pointLight
                ref={glowRef}
                position={[0, 1.5, 0.5]}
                color="#ff1a00"
                intensity={2.0}
                distance={10}
                decay={2}
            />

            {/* Subtle ambient red fill */}
            <pointLight
                position={[0, 0.5, 2]}
                color="#8b0000"
                intensity={0.8}
                distance={15}
                decay={2}
            />

            {/* Skull / bone decorations */}
            {/* Small bone on ground (left) */}
            <mesh position={[-1.5, 0.1, 1.5]} rotation={[0, 0.5, Math.PI / 2]}>
                <capsuleGeometry args={[0.07, 0.3, 4, 6]} />
                <meshStandardMaterial color="#e8dfd0" roughness={0.6} />
            </mesh>
            {/* Small bone on ground (right) */}
            <mesh position={[1.2, 0.1, 1.8]} rotation={[0, -0.3, Math.PI / 2]}>
                <capsuleGeometry args={[0.07, 0.25, 4, 6]} />
                <meshStandardMaterial color="#e8dfd0" roughness={0.6} />
            </mesh>
        </group>
    );
}
