'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSimulationStore, MyceliumNode } from '@/lib/simulationStore';
import { getTerrainHeight } from './Terrain';

export default function MyceliumNetwork() {
    const groupRef = useRef<THREE.Group>(null);
    const showMycelium = useSimulationStore(s => s.showMycelium);
    const robot = useSimulationStore(s => s.robot);
    const environment = useSimulationStore(s => s.environment);
    const myceliumNodes = useSimulationStore(s => s.myceliumNodes);
    const myceliumPulses = useSimulationStore(s => s.myceliumPulses);
    const addMyceliumNode = useSimulationStore(s => s.addMyceliumNode);
    const firePulse = useSimulationStore(s => s.firePulse);
    const updatePulses = useSimulationStore(s => s.updatePulses);
    const colliders = useSimulationStore(s => s.colliders);
    const sensoryGrowthFactor = useSimulationStore(s => s.sensoryGrowthFactor);
    const sensoryBuffer = useSimulationStore(s => s.sensoryBuffer);
    const nearbyObjects = useSimulationStore(s => s.robot.nearbyObjects);

    // ─── Initialize mycelium network ───
    useEffect(() => {
        if (myceliumNodes.length > 0) return;

        const central: MyceliumNode = {
            id: 'myc-central',
            position: { x: robot.position.x, y: -0.5, z: robot.position.z },
            connections: [],
            signalStrength: 1.0,
        };
        addMyceliumNode(central);

        const nodeCount = 20 + Math.floor(sensoryGrowthFactor * 10);
        for (let i = 0; i < nodeCount; i++) {
            const angle = (i / nodeCount) * Math.PI * 2 + Math.random() * 0.3;
            const dist = 5 + Math.random() * 30 * sensoryGrowthFactor;
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist;
            const treeCollider = colliders.find(c =>
                c.type === 'tree' &&
                Math.abs(c.position.x - x) < 5 &&
                Math.abs(c.position.z - z) < 5
            );

            addMyceliumNode({
                id: `myc-${i}`,
                position: { x, y: -0.3 - Math.random() * 0.5, z },
                connections: ['myc-central', ...(i > 0 ? [`myc-${i - 1}`] : [])],
                signalStrength: 0.5 + Math.random() * 0.5,
                linkedObjectId: treeCollider?.id,
            });
        }
    }, [myceliumNodes.length, robot.position, sensoryGrowthFactor, colliders, addMyceliumNode]);

    // ─── PERCEPTION-DRIVEN PULSE FIRING ───
    const lastSensoryCount = useRef(0);
    const lastNearbyRef = useRef<string[]>([]);

    useEffect(() => {
        if (myceliumNodes.length < 2) return;

        if (sensoryBuffer.length > lastSensoryCount.current) {
            const newInputs = sensoryBuffer.slice(lastSensoryCount.current);
            lastSensoryCount.current = sensoryBuffer.length;

            newInputs.forEach(input => {
                const color = input.type === 'vision' ? '#00ff88' :
                    input.type === 'touch' ? '#ff8800' : '#8060ff';

                const nearestNode = myceliumNodes.reduce((best, node) => {
                    const d = Math.sqrt(
                        Math.pow(node.position.x - input.position.x, 2) +
                        Math.pow(node.position.z - input.position.z, 2)
                    );
                    const bd = Math.sqrt(
                        Math.pow(best.position.x - input.position.x, 2) +
                        Math.pow(best.position.z - input.position.z, 2)
                    );
                    return d < bd ? node : best;
                }, myceliumNodes[0]);

                if (nearestNode.id !== 'myc-central') {
                    firePulse(nearestNode.id, 'myc-central', color);
                }

                const nearby = myceliumNodes.filter(n => n.id !== 'myc-central').slice(0, 5);
                if (nearby.length > 0) {
                    const pick = nearby[Math.floor(Math.random() * nearby.length)];
                    firePulse('myc-central', pick.id, color);
                }
            });
        }

        const newNearby = nearbyObjects.filter(id => !lastNearbyRef.current.includes(id));
        if (newNearby.length > 0) {
            lastNearbyRef.current = nearbyObjects;
            newNearby.forEach(() => {
                if (myceliumNodes.length > 2) {
                    const randFrom = myceliumNodes[Math.floor(Math.random() * myceliumNodes.length)];
                    const randTo = myceliumNodes[Math.floor(Math.random() * myceliumNodes.length)];
                    if (randFrom.id !== randTo.id) {
                        firePulse(randFrom.id, randTo.id, '#00d4ff');
                    }
                }
            });
        }
    }, [sensoryBuffer, nearbyObjects, myceliumNodes, firePulse]);

    // ─── Background idle pulses ───
    useEffect(() => {
        if (myceliumNodes.length < 2) return;
        const interval = setInterval(() => {
            const from = myceliumNodes[Math.floor(Math.random() * myceliumNodes.length)];
            const toIdx = Math.floor(Math.random() * from.connections.length);
            const toId = from.connections[toIdx];
            if (toId) firePulse(from.id, toId, `hsl(${Math.random() * 60 + 140},70%,60%)`);
        }, 2500);
        return () => clearInterval(interval);
    }, [myceliumNodes, firePulse]);

    useFrame((_, delta) => { updatePulses(delta); });

    const lineSegments = useMemo(() => {
        if (!showMycelium || myceliumNodes.length < 2) return null;
        const positions: number[] = [];
        const processed = new Set<string>();

        myceliumNodes.forEach(node => {
            node.connections.forEach(connId => {
                const key = [node.id, connId].sort().join('-');
                if (processed.has(key)) return;
                processed.add(key);
                const target = myceliumNodes.find(n => n.id === connId);
                if (!target) return;

                const sy = getTerrainHeight(node.position.x, node.position.z, environment.terrain.seed, environment.terrain.heightScale) - 0.1;
                const ty = getTerrainHeight(target.position.x, target.position.z, environment.terrain.seed, environment.terrain.heightScale) - 0.1;

                positions.push(node.position.x, sy, node.position.z, target.position.x, ty, target.position.z);
            });
        });

        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        return geom;
    }, [showMycelium, myceliumNodes, environment]);

    if (!showMycelium) return null;

    return (
        <group ref={groupRef}>
            {lineSegments && (
                <lineSegments geometry={lineSegments}>
                    <lineBasicMaterial color="#2d8a4e" transparent opacity={0.25} blending={THREE.AdditiveBlending} depthWrite={false} />
                </lineSegments>
            )}

            {myceliumPulses.map(pulse => {
                const fromNode = myceliumNodes.find(n => n.id === pulse.fromNode);
                const toNode = myceliumNodes.find(n => n.id === pulse.toNode);
                if (!fromNode || !toNode) return null;

                const x = fromNode.position.x + (toNode.position.x - fromNode.position.x) * pulse.progress;
                const z = fromNode.position.z + (toNode.position.z - fromNode.position.z) * pulse.progress;
                const y = getTerrainHeight(x, z, environment.terrain.seed, environment.terrain.heightScale) + 0.05;
                const pulseSize = 0.12 + 0.08 * Math.sin(pulse.progress * Math.PI);

                return (
                    <mesh key={pulse.id} position={[x, y, z]}>
                        <sphereGeometry args={[pulseSize, 6, 6]} />
                        <meshBasicMaterial color={pulse.color} transparent opacity={0.8 * (1 - pulse.progress * 0.3)} blending={THREE.AdditiveBlending} depthWrite={false} />
                    </mesh>
                );
            })}

            {myceliumNodes.map(node => {
                const y = getTerrainHeight(node.position.x, node.position.z, environment.terrain.seed, environment.terrain.heightScale) - 0.05;
                return (
                    <mesh key={node.id} position={[node.position.x, y, node.position.z]}>
                        <sphereGeometry args={[0.08, 5, 5]} />
                        <meshBasicMaterial
                            color={node.id === 'myc-central' ? '#ff6600' : '#2d8a4e'}
                            transparent
                            opacity={0.5 * node.signalStrength}
                            blending={THREE.AdditiveBlending}
                            depthWrite={false}
                        />
                    </mesh>
                );
            })}
        </group>
    );
}
