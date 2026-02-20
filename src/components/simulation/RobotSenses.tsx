'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSimulationStore } from '@/lib/simulationStore';
import { useCollectiveStore } from '@/lib/store';

/** Cognitive Light Cone — projected from robot's head, relevance-tags objects in view */
export function CognitiveLightCone() {
    const coneRef = useRef<THREE.Mesh>(null);
    const innerRef = useRef<THREE.Mesh>(null);
    const robot = useSimulationStore(s => s.robot);
    const showLightCone = useSimulationStore(s => s.showLightCone);
    const visionRange = useSimulationStore(s => s.visionConeRange);
    const visionAngle = useSimulationStore(s => s.visionConeAngle);
    const { infoTheoryMetrics } = useCollectiveStore();

    const coneColor = useMemo(() => {
        const health = infoTheoryMetrics.overallHealth;
        if (health > 70) return new THREE.Color('#00ff88');
        if (health > 40) return new THREE.Color('#ffff00');
        return new THREE.Color('#ff4400');
    }, [infoTheoryMetrics.overallHealth]);

    useFrame((state) => {
        const t = state.clock.elapsedTime;
        if (coneRef.current) {
            coneRef.current.position.set(robot.position.x, robot.position.y + 1.25, robot.position.z);
            coneRef.current.rotation.x = Math.PI / 2 + Math.sin(t * 0.3) * 0.05;
            coneRef.current.rotation.y = robot.rotation.y;
            (coneRef.current.material as THREE.MeshBasicMaterial).opacity = 0.04 + 0.02 * Math.sin(t * 1.5);
        }
        if (innerRef.current) {
            innerRef.current.position.set(robot.position.x, robot.position.y + 1.25, robot.position.z);
            innerRef.current.rotation.x = Math.PI / 2 + Math.sin(t * 0.3) * 0.05;
            innerRef.current.rotation.y = robot.rotation.y;
            (innerRef.current.material as THREE.MeshBasicMaterial).opacity = 0.08 + 0.04 * Math.sin(t * 2);
        }
    });

    if (!showLightCone) return null;

    const radiusTop = 0;
    const radiusBottom = Math.tan((visionAngle * Math.PI) / 360) * visionRange;

    return (
        <group>
            {/* Outer cone */}
            <mesh ref={coneRef}>
                <coneGeometry args={[radiusBottom, visionRange, 24, 1, true]} />
                <meshBasicMaterial
                    color={coneColor}
                    transparent
                    opacity={0.05}
                    side={THREE.DoubleSide}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                />
            </mesh>
            {/* Inner cone — focused attention */}
            <mesh ref={innerRef}>
                <coneGeometry args={[radiusBottom * 0.3, visionRange * 0.6, 12, 1, true]} />
                <meshBasicMaterial
                    color={coneColor}
                    transparent
                    opacity={0.1}
                    side={THREE.DoubleSide}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                />
            </mesh>
        </group>
    );
}

/** Vision sphere — hearing range */
export function HearingSphere() {
    const meshRef = useRef<THREE.Mesh>(null);
    const robot = useSimulationStore(s => s.robot);
    const hearingRange = useSimulationStore(s => s.hearingRange);
    const showSensory = useSimulationStore(s => s.showSensoryOverlay);

    useFrame((state) => {
        if (meshRef.current) {
            meshRef.current.position.set(robot.position.x, robot.position.y + 0.75, robot.position.z);
            (meshRef.current.material as THREE.MeshBasicMaterial).opacity = 0.02 + 0.01 * Math.sin(state.clock.elapsedTime * 2);
        }
    });

    if (!showSensory) return null;

    return (
        <mesh ref={meshRef}>
            <sphereGeometry args={[hearingRange, 24, 16]} />
            <meshBasicMaterial
                color="#8060ff"
                transparent
                opacity={0.03}
                side={THREE.BackSide}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
            />
        </mesh>
    );
}

/** Touch proximity mesh */
export function TouchField() {
    const meshRef = useRef<THREE.Mesh>(null);
    const robot = useSimulationStore(s => s.robot);
    const touchRange = useSimulationStore(s => s.touchRange);
    const showSensory = useSimulationStore(s => s.showSensoryOverlay);
    const isTouching = robot.touchingObjects.length > 0;

    useFrame((state) => {
        if (meshRef.current) {
            meshRef.current.position.set(robot.position.x, robot.position.y + 0.6, robot.position.z);
            const pulse = isTouching ? 0.15 + 0.1 * Math.sin(state.clock.elapsedTime * 8) : 0.05;
            (meshRef.current.material as THREE.MeshBasicMaterial).opacity = pulse;
        }
    });

    if (!showSensory) return null;

    return (
        <mesh ref={meshRef}>
            <sphereGeometry args={[touchRange, 16, 12]} />
            <meshBasicMaterial
                color={isTouching ? '#ff8800' : '#00ffaa'}
                transparent
                opacity={0.05}
                wireframe
                blending={THREE.AdditiveBlending}
                depthWrite={false}
            />
        </mesh>
    );
}
