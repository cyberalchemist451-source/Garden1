'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSimulationStore } from '@/lib/simulationStore';
import { useCollectiveStore } from '@/lib/store';

/* Eukaryote System — Internal node communication visualized as cellular particles */

interface CellParticle {
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    nodeId: string;
    category: 'research' | 'analysis' | 'synthesis' | 'sensory' | 'motor';
    life: number;
    maxLife: number;
}

export default function EukaryoteSystem() {
    const pointsRef = useRef<THREE.Points>(null);
    const showEukaryote = useSimulationStore(s => s.showEukaryote);
    const robot = useSimulationStore(s => s.robot);
    const { nodes } = useCollectiveStore();

    const PARTICLE_COUNT = 200;

    const { positions, colors, lifetimes } = useMemo(() => {
        const pos = new Float32Array(PARTICLE_COUNT * 3);
        const col = new Float32Array(PARTICLE_COUNT * 3);
        const life = new Float32Array(PARTICLE_COUNT);

        const categoryColors: Record<string, THREE.Color> = {
            research: new THREE.Color('#00ff80'),
            analysis: new THREE.Color('#0080ff'),
            synthesis: new THREE.Color('#8000ff'),
            sensory: new THREE.Color('#ff8000'),
            motor: new THREE.Color('#ff0080'),
        };

        const categories = Object.keys(categoryColors);

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            // Spawn around robot body
            const angle = Math.random() * Math.PI * 2;
            const radius = 0.3 + Math.random() * 0.8;
            const height = Math.random() * 1.5;

            pos[3 * i] = Math.cos(angle) * radius;
            pos[3 * i + 1] = height;
            pos[3 * i + 2] = Math.sin(angle) * radius;

            const cat = categories[Math.floor(Math.random() * categories.length)];
            const color = categoryColors[cat];
            col[3 * i] = color.r;
            col[3 * i + 1] = color.g;
            col[3 * i + 2] = color.b;

            life[i] = Math.random();
        }

        return { positions: pos, colors: col, lifetimes: life };
    }, []);

    useFrame((state) => {
        if (!pointsRef.current || !showEukaryote) return;
        const t = state.clock.elapsedTime;
        const posArray = pointsRef.current.geometry.attributes.position.array as Float32Array;

        const activeCount = nodes.filter(n => n.isActive).length;
        const activity = Math.max(0.2, activeCount / Math.max(1, nodes.length));

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            // Orbital motion around robot core
            const phase = lifetimes[i] * Math.PI * 2;
            const orbitSpeed = 0.3 + lifetimes[i] * 0.5;
            const radius = 0.3 + lifetimes[i] * 0.6;
            const height = (lifetimes[i] * 1.5) + Math.sin(t * orbitSpeed + phase) * 0.2;

            posArray[3 * i] = robot.position.x + Math.cos(t * orbitSpeed + phase) * radius;
            posArray[3 * i + 1] = robot.position.y + height;
            posArray[3 * i + 2] = robot.position.z + Math.sin(t * orbitSpeed + phase) * radius;

            // Life cycle: fade and respawn
            lifetimes[i] += 0.001 * activity;
            if (lifetimes[i] > 1) lifetimes[i] = 0;
        }

        pointsRef.current.geometry.attributes.position.needsUpdate = true;
        // Position the whole group to float
        pointsRef.current.position.set(0, 0, 0);
    });

    if (!showEukaryote) return null;

    return (
        <group>
            <points ref={pointsRef}>
                <bufferGeometry>
                    <bufferAttribute attach="attributes-position" args={[positions, 3]} />
                    <bufferAttribute attach="attributes-color" args={[colors, 3]} />
                </bufferGeometry>
                <pointsMaterial
                    vertexColors
                    size={0.08}
                    transparent
                    opacity={0.7}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                    sizeAttenuation
                />
            </points>

            {/* Membrane visualization — outer boundary around robot */}
            <mesh position={[robot.position.x, robot.position.y + 0.75, robot.position.z]}>
                <sphereGeometry args={[1.2, 16, 12]} />
                <meshBasicMaterial
                    color="#00ffaa"
                    transparent
                    opacity={0.02}
                    side={THREE.BackSide}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                />
            </mesh>

            {/* Nucleus — core processing center at chest */}
            <mesh position={[robot.position.x, robot.position.y + 0.75, robot.position.z]}>
                <sphereGeometry args={[0.15, 12, 12]} />
                <meshBasicMaterial
                    color="#00ffff"
                    transparent
                    opacity={0.15}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                />
            </mesh>
        </group>
    );
}
