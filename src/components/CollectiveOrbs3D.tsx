'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCollectiveStore, NodeState, CollectiveStore } from '@/lib/store';

function NodeOrb({ node, isGodNode, isSubGod }: { node: NodeState; isGodNode: boolean; isSubGod: boolean }) {
    const meshRef = useRef<THREE.Mesh>(null);
    const glowRef = useRef<THREE.Mesh>(null);
    const wireRef = useRef<THREE.Mesh>(null);
    const phaseRef = useRef(Math.random() * Math.PI * 2);

    const color = useMemo(() => new THREE.Color(node.identity.color), [node.identity.color]);
    const baseScale = isGodNode ? 0.5 : isSubGod ? 0.35 : 0.25;

    useFrame((state) => {
        const t = state.clock.elapsedTime;
        if (meshRef.current) {
            meshRef.current.position.y = node.position.y + 0.15 * Math.sin(0.5 * t + phaseRef.current);
            if (!isGodNode) {
                // Static jitter to avoid heavy recalc
                meshRef.current.rotation.x = 0.1 * t;
                meshRef.current.rotation.y = 0.15 * t;
            }
            // Simple scale pulse
            const pulse = node.isStreaming ? (1 + 0.15 * Math.sin(4 * t)) : 1;
            meshRef.current.scale.setScalar(baseScale * pulse);
        }
    });

    if (isGodNode) {
        return (
            <group position={[node.position.x, node.position.y, node.position.z]}>
                <mesh ref={glowRef} scale={1.1}>
                    <sphereGeometry args={[0.5, 16, 16]} />
                    <meshBasicMaterial color={color} transparent opacity={0.04} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.BackSide} />
                </mesh>
                <mesh ref={meshRef}>
                    <sphereGeometry args={[0.48, 24, 24]} />
                    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} roughness={0.1} metalness={0.8} />
                </mesh>
            </group>
        );
    }

    return (
        <group ref={meshRef} position={[node.position.x, node.position.y, node.position.z]}>
            <mesh>
                <sphereGeometry args={[0.2, 8, 8]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} roughness={0.2} />
            </mesh>
        </group>
    );
}

function ConnectionLines({ nodes }: { nodes: NodeState[] }) {
    // Memoize geometry generation so it only runs when node structure changes (rarely)
    // We assume connections don't change every frame.
    const linesGeometry = useMemo(() => {
        const points: THREE.Vector3[] = [];
        nodes.forEach((node: NodeState) => {
            node.connections.forEach((connId: string) => {
                const target = nodes.find(n => n.id === connId);
                if (target) {
                    points.push(new THREE.Vector3(node.position.x, node.position.y, node.position.z));
                    points.push(new THREE.Vector3(target.position.x, target.position.y, target.position.z));
                }
            });
        });
        return new THREE.BufferGeometry().setFromPoints(points);
    }, [nodes]); // Dependency on nodes array content

    return (
        <lineSegments geometry={linesGeometry}>
            <lineBasicMaterial color="#304060" transparent opacity={0.15} />
        </lineSegments>
    );
}

function DataParticles({ nodes }: { nodes: NodeState[] }) {
    const pointsRef = useRef<THREE.Points>(null);

    // REDUCED PARTICLE COUNT significantly to prevent crash
    const count = 30;

    const { positions, velocities, targets } = useMemo(() => {
        const pos = new Float32Array(count * 3);
        const vel = new Float32Array(count * 3);
        const tgt = new Float32Array(count * 3);
        const activeNodes = nodes.filter(n => n.isStreaming);

        if (activeNodes.length === 0 && nodes.length === 0) return { positions: pos, velocities: vel, targets: tgt };

        for (let i = 0; i < count; i++) {
            const source = activeNodes.length > 0 ? activeNodes[i % activeNodes.length] : nodes[i % nodes.length];
            const target = nodes.find(n => n.id === (source.connections[0] || 'god-node')) || nodes[0];

            pos[3 * i] = source.position.x;
            pos[3 * i + 1] = source.position.y;
            pos[3 * i + 2] = source.position.z;

            tgt[3 * i] = target.position.x;
            tgt[3 * i + 1] = target.position.y;
            tgt[3 * i + 2] = target.position.z;

            vel[3 * i] = (target.position.x - source.position.x) * 0.01;
            vel[3 * i + 1] = (target.position.y - source.position.y) * 0.01;
            vel[3 * i + 2] = (target.position.z - source.position.z) * 0.01;
        }
        return { positions: pos, velocities: vel, targets: tgt };
    }, [nodes]);

    useFrame(() => {
        if (!pointsRef.current) return;
        const posArray = pointsRef.current.geometry.attributes.position.array as Float32Array;
        let needsUpdate = false;

        for (let i = 0; i < count; i++) {
            // Simple linear move
            posArray[3 * i] += velocities[3 * i];
            posArray[3 * i + 1] += velocities[3 * i + 1];
            posArray[3 * i + 2] += velocities[3 * i + 2];

            // Reset logic if close to target
            const dx = posArray[3 * i] - targets[3 * i];
            const dy = posArray[3 * i + 1] - targets[3 * i + 1];
            const dz = posArray[3 * i + 2] - targets[3 * i + 2];

            if (dx * dx + dy * dy + dz * dz < 0.2) {
                // Teleport back to start (approx)
                posArray[3 * i] -= velocities[3 * i] * 100;
                posArray[3 * i + 1] -= velocities[3 * i + 1] * 100;
                posArray[3 * i + 2] -= velocities[3 * i + 2] * 100;
            }
            needsUpdate = true;
        }

        if (needsUpdate) pointsRef.current.geometry.attributes.position.needsUpdate = true;
    });

    return (
        <points ref={pointsRef}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[positions, 3]} />
            </bufferGeometry>
            <pointsMaterial color="#00ffff" size={0.1} transparent opacity={0.6} />
        </points>
    );
}

export default function CollectiveNodesScene() {
    const groupRef = useRef<THREE.Group>(null);
    // Use SELECTORS to minimize re-renders
    const nodes = useCollectiveStore((state: CollectiveStore) => state.nodes);
    const isProcessing = useCollectiveStore((state: CollectiveStore) => state.isProcessing);
    const initializeNodes = useCollectiveStore((state: CollectiveStore) => state.initializeNodes);

    useEffect(() => {
        if (!nodes || nodes.length === 0) {
            initializeNodes();
        }
    }, [nodes, initializeNodes]);

    if (!nodes) return null;

    return (
        <group ref={groupRef} position={[0, 5, 0]} scale={2}>
            <ConnectionLines nodes={nodes} />
            {/* Conditional render of particles to save GPU */}
            {isProcessing && <DataParticles nodes={nodes} />}
            {nodes.map((node: NodeState) => (
                <NodeOrb
                    key={node.id}
                    node={node}
                    isGodNode={node.identity.category === 'god'}
                    isSubGod={node.identity.category === 'sub-god'}
                />
            ))}
        </group>
    );
}
