'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSimulationStore } from '@/lib/simulationStore';

/* Portal Gate — glowing ring objects that link to other environments */

export default function PortalGate({ position, label, targetEnvironment }: {
    position: [number, number, number];
    label: string;
    targetEnvironment: string;
}) {
    const ringRef = useRef<THREE.Mesh>(null);
    const glowRef = useRef<THREE.Mesh>(null);
    const particlesRef = useRef<THREE.Points>(null);

    // Particle positions for ring effect
    const particlePositions = new Float32Array(60 * 3);
    for (let i = 0; i < 60; i++) {
        const angle = (i / 60) * Math.PI * 2;
        const radius = 1.5 + Math.random() * 0.3;
        particlePositions[3 * i] = Math.cos(angle) * radius;
        particlePositions[3 * i + 1] = Math.sin(angle) * radius;
        particlePositions[3 * i + 2] = (Math.random() - 0.5) * 0.2;
    }

    useFrame((state) => {
        const t = state.clock.elapsedTime;

        if (ringRef.current) {
            ringRef.current.rotation.z = t * 0.3;
        }
        if (glowRef.current) {
            (glowRef.current.material as THREE.MeshBasicMaterial).opacity = 0.15 + 0.08 * Math.sin(t * 2);
            glowRef.current.scale.setScalar(1 + 0.05 * Math.sin(t * 1.5));
        }
        if (particlesRef.current) {
            particlesRef.current.rotation.z = -t * 0.5;
        }
    });

    return (
        <group position={position} rotation={[0, 0, 0]}>
            {/* Main ring */}
            <mesh ref={ringRef}>
                <torusGeometry args={[1.5, 0.08, 8, 32]} />
                <meshStandardMaterial
                    color="#8060ff"
                    emissive="#8060ff"
                    emissiveIntensity={0.8}
                    metalness={0.9}
                    roughness={0.1}
                />
            </mesh>

            {/* Inner secondary ring */}
            <mesh rotation={[0, 0, Math.PI / 6]}>
                <torusGeometry args={[1.35, 0.04, 6, 24]} />
                <meshBasicMaterial
                    color="#00ffff"
                    transparent
                    opacity={0.5}
                />
            </mesh>

            {/* Center glow */}
            <mesh ref={glowRef}>
                <circleGeometry args={[1.3, 24]} />
                <meshBasicMaterial
                    color="#8060ff"
                    transparent
                    opacity={0.15}
                    side={THREE.DoubleSide}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                />
            </mesh>

            {/* Portal particles */}
            <points ref={particlesRef}>
                <bufferGeometry>
                    <bufferAttribute attach="attributes-position" args={[particlePositions, 3]} />
                </bufferGeometry>
                <pointsMaterial
                    color="#00ffff"
                    size={0.08}
                    transparent
                    opacity={0.6}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                    sizeAttenuation
                />
            </points>

            {/* Point light */}
            <pointLight color="#8060ff" intensity={2} distance={10} decay={2} />

            {/* Label (floating text placeholder — using a simple mesh for now) */}
            <mesh position={[0, 2.2, 0]}>
                <boxGeometry args={[0.8, 0.15, 0.02]} />
                <meshBasicMaterial color="#8060ff" transparent opacity={0.3} />
            </mesh>
        </group>
    );
}
