'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSimulationStore, MyceliumNode } from '@/lib/simulationStore';
import { getTerrainHeight } from './Terrain';

/* Mycelium Network — underground tube network for sensory redundancy */

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

    // Initialize mycelium network from robot position + trees
    useEffect(() => {
        if (myceliumNodes.length > 0) return;

        // Central node at robot
        const central: MyceliumNode = {
            id: 'myc-central',
            position: { x: robot.position.x, y: -0.5, z: robot.position.z },
            connections: [],
            signalStrength: 1.0,
        };
        addMyceliumNode(central);

        // Radial spread nodes
        const nodeCount = 20 + Math.floor(sensoryGrowthFactor * 10);
        for (let i = 0; i < nodeCount; i++) {
            const angle = (i / nodeCount) * Math.PI * 2 + Math.random() * 0.3;
            const dist = 5 + Math.random() * 30 * sensoryGrowthFactor;
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist;
            const treeCollider = colliders.find(c => c.type === 'tree' && Math.abs(c.position.x - x) < 5 && Math.abs(c.position.z - z) < 5);

            addMyceliumNode({
                id: `myc-${i}`,
                position: { x, y: -0.3 - Math.random() * 0.5, z },
                connections: ['myc-central', ...(i > 0 ? [`myc-${i - 1}`] : [])],
                signalStrength: 0.5 + Math.random() * 0.5,
                linkedObjectId: treeCollider?.id,
            });
        }
    }, [myceliumNodes.length, robot.position, sensoryGrowthFactor, colliders, addMyceliumNode]);

    // Periodic pulse firing
    useEffect(() => {
        const interval = setInterval(() => {
            if (myceliumNodes.length > 2) {
                const from = myceliumNodes[Math.floor(Math.random() * myceliumNodes.length)];
                const to = from.connections.length > 0
                    ? from.connections[Math.floor(Math.random() * from.connections.length)]
                    : myceliumNodes[Math.floor(Math.random() * myceliumNodes.length)].id;

                const colors = ['#00ffaa', '#00aaff', '#ff00aa', '#ffaa00', '#aa00ff'];
                firePulse(from.id, to, colors[Math.floor(Math.random() * colors.length)]);
            }
        }, 800 + Math.random() * 1200);

        return () => clearInterval(interval);
    }, [myceliumNodes, firePulse]);

    // Update pulse positions each frame
    useFrame((_, dt) => {
        updatePulses(dt);
    });

    // Build tube geometry from connections
    const tubes = useMemo(() => {
        const result: { from: THREE.Vector3; to: THREE.Vector3; strength: number }[] = [];
        const nodeMap = new Map(myceliumNodes.map(n => [n.id, n]));

        for (const node of myceliumNodes) {
            for (const connId of node.connections) {
                const target = nodeMap.get(connId);
                if (target) {
                    result.push({
                        from: new THREE.Vector3(node.position.x, node.position.y, node.position.z),
                        to: new THREE.Vector3(target.position.x, target.position.y, target.position.z),
                        strength: (node.signalStrength + target.signalStrength) / 2,
                    });
                }
            }
        }
        return result;
    }, [myceliumNodes]);

    if (!showMycelium) return null;

    return (
        <group ref={groupRef}>
            {/* Underground tubes */}
            {tubes.map((tube, i) => {
                const mid = new THREE.Vector3().lerpVectors(tube.from, tube.to, 0.5);
                mid.y -= 0.3 + Math.random() * 0.3; // Sag below ground
                const curve = new THREE.QuadraticBezierCurve3(tube.from, mid, tube.to);
                const tubeGeo = new THREE.TubeGeometry(curve, 12, 0.02 + tube.strength * 0.03, 6, false);

                return (
                    <mesh key={`tube-${i}`} geometry={tubeGeo}>
                        <meshBasicMaterial
                            color="#00ffaa"
                            transparent
                            opacity={0.15 + tube.strength * 0.15}
                            blending={THREE.AdditiveBlending}
                            depthWrite={false}
                        />
                    </mesh>
                );
            })}

            {/* Mycelium node points */}
            {myceliumNodes.map(node => (
                <mesh key={node.id} position={[node.position.x, node.position.y, node.position.z]}>
                    <sphereGeometry args={[0.06, 6, 6]} />
                    <meshBasicMaterial
                        color={node.linkedObjectId ? '#ffaa00' : '#00ffaa'}
                        transparent
                        opacity={0.4 * node.signalStrength}
                        blending={THREE.AdditiveBlending}
                        depthWrite={false}
                    />
                </mesh>
            ))}

            {/* Pulses traveling along connections */}
            {myceliumPulses.map(pulse => {
                const fromNode = myceliumNodes.find(n => n.id === pulse.fromNode);
                const toNode = myceliumNodes.find(n => n.id === pulse.toNode);
                if (!fromNode || !toNode) return null;

                const pulsPos = new THREE.Vector3().lerpVectors(
                    new THREE.Vector3(fromNode.position.x, fromNode.position.y, fromNode.position.z),
                    new THREE.Vector3(toNode.position.x, toNode.position.y, toNode.position.z),
                    pulse.progress
                );

                return (
                    <mesh key={pulse.id} position={pulsPos}>
                        <sphereGeometry args={[0.06, 6, 6]} />
                        <meshBasicMaterial
                            color={pulse.color}
                            transparent
                            opacity={0.8}
                            blending={THREE.AdditiveBlending}
                            depthWrite={false}
                        />
                    </mesh>
                );
            })}
        </group>
    );
}
