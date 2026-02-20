'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSimulationStore } from '@/lib/simulationStore';

const ROBOT_CONE_COLOR = '#ff6600'; // Orange for robot (vs cyan for user)

/** Cognitive Light Cone for AtlasRobot */
export function RobotCognitiveLightCone() {
    const coneRef = useRef<THREE.Mesh>(null);
    const innerRef = useRef<THREE.Mesh>(null);
    const robot = useSimulationStore(s => s.robot);
    const showLightCone = useSimulationStore(s => s.showLightCone);
    const visionRange = 15; // Robot's vision range
    const visionAngle = 60; // Robot's vision cone angle

    useFrame((state) => {
        const t = state.clock.elapsedTime;
        const isProcessing = robot.processingState === 'active' || robot.currentIntent !== undefined;

        if (coneRef.current) {
            // Position is relative to parent (Robot)
            // Head height is ~1.8m
            coneRef.current.position.set(0, 1.8, 0);

            // Rotation: Point forward (local Z is forward? No, usually -Z or Z)
            // Cone is usually Y-up. We need to rotate it to point forward relative to robot.
            // Robot forward is -Z.
            // Cone geometry is Y-up range. 
            // Rotate X by -PI/2 to point along -Z? 
            // Actually, let's keep the wobbling animation but relative to local space

            coneRef.current.rotation.x = -Math.PI / 2 + Math.sin(t * 0.3) * 0.05;
            // No need to set rotation.y, it inherits from parent!

            // Pulse more when processing commands
            const baseOpacity = isProcessing ? 0.08 : 0.04;
            (coneRef.current.material as THREE.MeshBasicMaterial).opacity =
                baseOpacity + 0.02 * Math.sin(t * (isProcessing ? 2.5 : 1.5));
        }

        if (innerRef.current) {
            innerRef.current.position.set(0, 1.8, 0);

            innerRef.current.rotation.x = -Math.PI / 2 + Math.sin(t * 0.3) * 0.05;
            // No need to set rotation.y

            const baseOpacity = isProcessing ? 0.12 : 0.06;
            (innerRef.current.material as THREE.MeshBasicMaterial).opacity =
                baseOpacity + 0.04 * Math.sin(t * (isProcessing ? 3 : 2));
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
                    color={ROBOT_CONE_COLOR}
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
                    color={ROBOT_CONE_COLOR}
                    transparent
                    opacity={0.08}
                    side={THREE.DoubleSide}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                />
            </mesh>
        </group>
    );
}
