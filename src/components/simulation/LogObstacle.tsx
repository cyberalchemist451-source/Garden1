import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSimulationStore } from '@/lib/simulationStore';
import * as THREE from 'three';

export interface LogProps {
    position: [number, number, number];
    rotation?: [number, number, number];
    scale?: number;
}

export default function LogObstacle({ position, rotation = [0, 0, 0], scale = 1 }: LogProps) {
    const id = useRef(`log-${Math.random().toString(36).substr(2, 9)}`).current;

    useEffect(() => {
        // Register collider
        // Log is roughly cylinder: radius ~0.3 * scale, length ~2 * scale
        useSimulationStore.getState().addCollider({
            id,
            type: 'log', // Custom type we can check for collision
            position: { x: position[0], y: position[1], z: position[2] },
            size: { x: 2 * scale, y: 0.6 * scale, z: 0.6 * scale }, // Length, Height, Width approx
            interactable: false,
            climbable: true,
        });
    }, [id, position, scale]);

    return (
        <group position={position} rotation={rotation} scale={scale}>
            {/* Visual Mesh */}
            <mesh castShadow receiveShadow rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.3, 0.3, 2, 8]} />
                <meshStandardMaterial color="#5d4037" roughness={0.9} />
            </mesh>
            {/* End caps */}
            <mesh position={[0, 1, 0]} rotation={[0, 0, 0]}>
                <circleGeometry args={[0.3, 8]} />
                <meshStandardMaterial color="#8d6e63" />
            </mesh>
            <mesh position={[0, -1, 0]} rotation={[Math.PI, 0, 0]}>
                <circleGeometry args={[0.3, 8]} />
                <meshStandardMaterial color="#8d6e63" />
            </mesh>
        </group>
    );
}
