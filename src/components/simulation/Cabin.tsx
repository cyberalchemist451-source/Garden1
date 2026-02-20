'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useSimulationStore } from '@/lib/simulationStore';
import { getTerrainHeight } from './Terrain';

/**
 * "Evil Dead" Style Cabin - Now Larger with Interior Furniture
 * Weathered, dark wood, front porch, table and chair inside
 */
export default function Cabin({ onDoorToggle, onSitClick }: {
    onDoorToggle?: (open: boolean) => void;
    onSitClick?: (chairPosition: THREE.Vector3) => void;
}) {
    const { terrain } = useSimulationStore(s => s.environment);
    const [doorOpen, setDoorOpen] = useState(false);

    // Place cabin at eastern part of the map
    const cx = terrain.size * 0.25;
    const cz = terrain.size * 0.05;
    const cy = getTerrainHeight(cx, cz, terrain.seed, terrain.heightScale);

    const toggleDoor = useCallback(() => {
        setDoorOpen(prev => {
            const next = !prev;
            onDoorToggle?.(next);
            return next;
        });
    }, [onDoorToggle]);

    // Materials - Dark weathered wood
    const wallColor = '#3e2b22'; // Dark rotting wood
    const roofColor = '#2a1d17'; // Darker shingles
    const deckColor = '#4a3a2a'; // Weathered deck
    const doorColor = doorOpen ? '#2a1d17' : '#3e2b22';

    const robotPosition = useSimulationStore(s => s.robot.position);
    const groupRef = useRef<THREE.Group>(null);
    const chairRef = useRef<THREE.Group>(null);

    useFrame(() => {
        if (groupRef.current) {
            // Check distance to robot
            const dx = groupRef.current.position.x - robotPosition.x;
            const dz = groupRef.current.position.z - robotPosition.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            // Make walls transparent when near cabin
            const targetOpacity = dist < 6 ? 0.2 : 1.0;
            groupRef.current.traverse((obj) => {
                if (obj instanceof THREE.Mesh && obj.userData.isWall) {
                    const mat = obj.material as THREE.MeshStandardMaterial;
                    if (!mat.transparent) mat.transparent = true;
                    mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacity, 0.1);
                }
            });
        }
    });

    // Larger cabin dimensions
    const W = 10;  // width (was 7)
    const D = 7;  // depth (was 5)
    const H = 3.5; // wall height
    const porchD = 2.5; // porch depth

    const addCollider = useSimulationStore(s => s.addCollider);
    const removeCollider = useSimulationStore(s => s.removeCollider);

    // Register Static Colliders (Cabin + Furniture)
    useEffect(() => {
        // ... (Static code remains same, omitted for brevity in replace block if possible? No, replace block needs context)
        // I will copy the static parts to ensure no regression, but focus on the structure.

        // Register Cabin Floor/Walls
        addCollider({
            id: 'cabin-structure',
            type: 'building',
            position: { x: cx, y: cy + H / 2, z: cz - porchD / 2 },
            size: { x: W, y: H, z: D + porchD },
            interactable: false,
            climbable: false,
            allowMultiple: false,
            metadata: {
                displayName: 'Log Cabin',
                buildingName: 'Cabin',
                isInside: false
            }
        });

        // Table Collider
        addCollider({
            id: 'cabin-table',
            type: 'table',
            position: { x: cx, y: cy + 0.2 + 0.9 / 2, z: cz - 1 },
            size: { x: 2, y: 0.9, z: 1.2 },
            interactable: true,
            climbable: false,
            allowMultiple: false,
            metadata: {
                displayName: 'Wooden Table',
                action: 'pickup'
            }
        });

        // Chair Colliders
        const chair1Pos = { x: cx, y: cy + 0.2 + 0.5 / 2, z: cz + 0.5 };
        const chair2Pos = { x: cx, y: cy + 0.2 + 0.5 / 2, z: cz - 2.5 };

        addCollider({
            id: 'chair-1',
            type: 'chair',
            position: chair1Pos,
            size: { x: 0.6, y: 0.6, z: 0.6 },
            interactable: true,
            climbable: true,
            allowMultiple: false,
            metadata: {
                displayName: 'Chair (Table Side)',
                action: 'sit'
            }
        });

        addCollider({
            id: 'chair-2',
            type: 'chair',
            position: chair2Pos,
            size: { x: 0.6, y: 0.6, z: 0.6 },
            interactable: true,
            climbable: true,
            allowMultiple: false,
            metadata: {
                displayName: 'Chair (Window Side)',
                action: 'sit'
            }
        });

    }, [addCollider, cx, cy, cz, W, H, D, porchD]);

    const interactionTrigger = useSimulationStore(s => s.interactionTrigger);

    useEffect(() => {
        if (interactionTrigger && interactionTrigger.id === 'cabin-door') {
            // Check if action matches current state (e.g. "open" intent when closed)
            if (interactionTrigger.action === 'open' && !doorOpen) {
                setDoorOpen(true);
            } else if (interactionTrigger.action === 'close' && doorOpen) {
                setDoorOpen(false);
            } else if (interactionTrigger.action === 'toggle') {
                setDoorOpen(prev => !prev);
            }
        }
    }, [interactionTrigger, doorOpen]);

    // Dynamic Door Collider (depends on doorOpen)
    useEffect(() => {
        const doorId = 'cabin-door';

        // Remove existing to update state
        removeCollider(doorId);

        // Add new state
        addCollider({
            id: doorId,
            type: 'door',
            // Positioned at door location
            position: { x: cx - 0.8, y: cy + H / 2, z: cz + D / 2 + 0.1 },
            // If closed: roughly 1.6m wide, H tall, 0.2m thick
            // If open: we make it non-blocking or just small/moved? 
            // Better: Keep it there but use metadata for robot to know state.
            // For PHYSICS blocking: 
            //   Closed: Full size
            //   Open: Small/Passable? 
            //   Actually, let's make it a thin trigger when open.
            size: doorOpen ? { x: 0.1, y: H, z: 0.1 } : { x: 1.6, y: H, z: 0.2 },
            interactable: true,
            climbable: false,
            allowMultiple: false,
            metadata: {
                displayName: 'Wooden Door',
                action: doorOpen ? 'close' : 'open',
                state: doorOpen ? 'open' : 'closed'
            }
        });

        return () => {
            removeCollider(doorId);
        };
    }, [addCollider, removeCollider, doorOpen, cx, cy, cz, H, D]);

    const handleChairClick = useCallback((e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        if (e.nativeEvent.button === 2 && chairRef.current && groupRef.current) { // Right-click
            // Get world position of chair
            const worldPos = new THREE.Vector3();
            chairRef.current.getWorldPosition(worldPos);
            onSitClick?.(worldPos);
        }
    }, [onSitClick]);

    return (
        <group ref={groupRef} position={[cx, cy, cz]} rotation={[0, -0.2, 0]}>
            {/* Main Floor */}
            <mesh position={[0, 0.1, -porchD / 2]} receiveShadow userData={{ isFloor: true }}>
                <boxGeometry args={[W, 0.2, D]} />
                <meshStandardMaterial color={deckColor} roughness={0.95} />
            </mesh>

            {/* Porch Floor - Extending front */}
            <mesh position={[0, 0.1, D / 2]} receiveShadow userData={{ isFloor: true }}>
                <boxGeometry args={[W, 0.2, porchD]} />
                <meshStandardMaterial color={deckColor} roughness={0.95} />
            </mesh>

            {/* Porch Roof Posts */}
            <mesh position={[-W / 2 + 0.2, H / 2, D / 2 + porchD / 2 - 0.2]} castShadow>
                <boxGeometry args={[0.3, H, 0.3]} />
                <meshStandardMaterial color={wallColor} roughness={0.9} />
            </mesh>
            <mesh position={[W / 2 - 0.2, H / 2, D / 2 + porchD / 2 - 0.2]} castShadow>
                <boxGeometry args={[0.3, H, 0.3]} />
                <meshStandardMaterial color={wallColor} roughness={0.9} />
            </mesh>

            {/* Walls */}
            {/* Back */}
            <mesh position={[0, H / 2, -D / 2]} castShadow userData={{ isWall: true }}>
                <boxGeometry args={[W, H, 0.2]} />
                <meshStandardMaterial color={wallColor} roughness={0.95} />
            </mesh>
            {/* Left */}
            <mesh position={[-W / 2, H / 2, 0]} castShadow userData={{ isWall: true }}>
                <boxGeometry args={[0.2, H, D]} />
                <meshStandardMaterial color={wallColor} roughness={0.95} />
            </mesh>
            {/* Right */}
            <mesh position={[W / 2, H / 2, 0]} castShadow userData={{ isWall: true }}>
                <boxGeometry args={[0.2, H, D]} />
                <meshStandardMaterial color={wallColor} roughness={0.95} />
            </mesh>
            {/* Front Left */}
            <mesh position={[-W / 4 - 0.5, H / 2, D / 2]} castShadow userData={{ isWall: true }}>
                <boxGeometry args={[W / 2 - 0.5, H, 0.2]} />
                <meshStandardMaterial color={wallColor} roughness={0.95} />
            </mesh>
            {/* Front Right */}
            <mesh position={[W / 4 + 0.5, H / 2, D / 2]} castShadow userData={{ isWall: true }}>
                <boxGeometry args={[W / 2 - 0.5, H, 0.2]} />
                <meshStandardMaterial color={wallColor} roughness={0.95} />
            </mesh>
            {/* Header above door */}
            <mesh position={[0, H - 0.5, D / 2]} castShadow userData={{ isWall: true }}>
                <boxGeometry args={[2, 1, 0.2]} />
                <meshStandardMaterial color={wallColor} roughness={0.95} />
            </mesh>

            {/* Roof - Large overhang covering porch */}
            {/* Left slope */}
            <mesh position={[-W / 4, H + 1.5, 0.5]} rotation={[0, 0, 0.5]} castShadow userData={{ isWall: true }}>
                <boxGeometry args={[W / 2 + 1, 0.2, D + porchD + 1]} />
                <meshStandardMaterial color={roofColor} roughness={1.0} />
            </mesh>
            {/* Right slope */}
            <mesh position={[W / 4, H + 1.5, 0.5]} rotation={[0, 0, -0.5]} castShadow userData={{ isWall: true }}>
                <boxGeometry args={[W / 2 + 1, 0.2, D + porchD + 1]} />
                <meshStandardMaterial color={roofColor} roughness={1.0} />
            </mesh>

            {/* Door */}
            <group position={[-0.8, 0.1, D / 2 + 0.1]} rotation={[0, doorOpen ? -2 : 0, 0]} onClick={toggleDoor}>
                <mesh position={[0.8, H / 2 - 0.5, 0]} castShadow>
                    <boxGeometry args={[1.6, H - 1, 0.1]} />
                    <meshStandardMaterial color={doorColor} roughness={0.8} />
                </mesh>
                {/* Door handle */}
                <mesh position={[1.4, H / 2 - 0.5, 0.08]}>
                    <boxGeometry args={[0.1, 0.3, 0.1]} />
                    <meshStandardMaterial color="#333" metalness={0.8} />
                </mesh>
            </group>

            {/* Clickable door trigger */}
            <mesh position={[0, H / 2, D / 2 + 0.5]} onClick={toggleDoor} visible={false}>
                <boxGeometry args={[2, H, 1]} />
                <meshBasicMaterial transparent opacity={0} />
            </mesh>

            {/* INTERIOR FURNITURE */}
            {/* Table - Centered in cabin */}
            <group position={[0, 0.2, -1]}>
                {/* Table top */}
                <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
                    <boxGeometry args={[2, 0.1, 1.2]} />
                    <meshStandardMaterial color="#4a3a2a" roughness={0.8} />
                </mesh>
                {/* Table legs */}
                <mesh position={[-0.9, 0.4, -0.5]} castShadow>
                    <cylinderGeometry args={[0.08, 0.08, 0.8, 8]} />
                    <meshStandardMaterial color="#3e2b22" roughness={0.9} />
                </mesh>
                <mesh position={[0.9, 0.4, -0.5]} castShadow>
                    <cylinderGeometry args={[0.08, 0.08, 0.8, 8]} />
                    <meshStandardMaterial color="#3e2b22" roughness={0.9} />
                </mesh>
                <mesh position={[-0.9, 0.4, 0.5]} castShadow>
                    <cylinderGeometry args={[0.08, 0.08, 0.8, 8]} />
                    <meshStandardMaterial color="#3e2b22" roughness={0.9} />
                </mesh>
                <mesh position={[0.9, 0.4, 0.5]} castShadow>
                    <cylinderGeometry args={[0.08, 0.08, 0.8, 8]} />
                    <meshStandardMaterial color="#3e2b22" roughness={0.9} />
                </mesh>
            </group>

            {/* Chair 1 - At table (facing table) */}
            <group
                ref={chairRef}
                position={[0, 0.2, 0.5]}
                rotation={[0, Math.PI, 0]}
                onPointerDown={handleChairClick}
                onContextMenu={(e) => e.nativeEvent.preventDefault()}
            >
                {/* Seat */}
                <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
                    <boxGeometry args={[0.5, 0.1, 0.5]} />
                    <meshStandardMaterial color="#4a3a2a" roughness={0.8} />
                </mesh>
                {/* Backrest */}
                <mesh position={[0, 0.9, -0.22]} castShadow>
                    <boxGeometry args={[0.5, 0.7, 0.08]} />
                    <meshStandardMaterial color="#3e2b22" roughness={0.9} />
                </mesh>
                {/* Chair legs */}
                <mesh position={[-0.2, 0.25, -0.2]} castShadow>
                    <cylinderGeometry args={[0.05, 0.05, 0.5, 8]} />
                    <meshStandardMaterial color="#3e2b22" roughness={0.9} />
                </mesh>
                <mesh position={[0.2, 0.25, -0.2]} castShadow>
                    <cylinderGeometry args={[0.05, 0.05, 0.5, 8]} />
                    <meshStandardMaterial color="#3e2b22" roughness={0.9} />
                </mesh>
                <mesh position={[-0.2, 0.25, 0.2]} castShadow>
                    <cylinderGeometry args={[0.05, 0.05, 0.5, 8]} />
                    <meshStandardMaterial color="#3e2b22" roughness={0.9} />
                </mesh>
                <mesh position={[0.2, 0.25, 0.2]} castShadow>
                    <cylinderGeometry args={[0.05, 0.05, 0.5, 8]} />
                    <meshStandardMaterial color="#3e2b22" roughness={0.9} />
                </mesh>
                {/* Invisible click trigger for easier interaction */}
                <mesh position={[0, 0.5, 0]} visible={false}>
                    <boxGeometry args={[0.8, 1, 0.8]} />
                    <meshBasicMaterial transparent opacity={0} />
                </mesh>
            </group>

            {/* Chair 2 - Opposite side of table (facing table) */}
            <group
                position={[0, 0.2, -2.5]}
                rotation={[0, 0, 0]}
                onPointerDown={handleChairClick}
                onContextMenu={(e) => e.nativeEvent.preventDefault()}
            >
                {/* Seat */}
                <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
                    <boxGeometry args={[0.5, 0.1, 0.5]} />
                    <meshStandardMaterial color="#4a3a2a" roughness={0.8} />
                </mesh>
                {/* Backrest */}
                <mesh position={[0, 0.9, -0.22]} castShadow>
                    <boxGeometry args={[0.5, 0.7, 0.08]} />
                    <meshStandardMaterial color="#3e2b22" roughness={0.9} />
                </mesh>
                {/* Chair legs */}
                <mesh position={[-0.2, 0.25, -0.2]} castShadow>
                    <cylinderGeometry args={[0.05, 0.05, 0.5, 8]} />
                    <meshStandardMaterial color="#3e2b22" roughness={0.9} />
                </mesh>
                <mesh position={[0.2, 0.25, -0.2]} castShadow>
                    <cylinderGeometry args={[0.05, 0.05, 0.5, 8]} />
                    <meshStandardMaterial color="#3e2b22" roughness={0.9} />
                </mesh>
                <mesh position={[-0.2, 0.25, 0.2]} castShadow>
                    <cylinderGeometry args={[0.05, 0.05, 0.5, 8]} />
                    <meshStandardMaterial color="#3e2b22" roughness={0.9} />
                </mesh>
                <mesh position={[0.2, 0.25, 0.2]} castShadow>
                    <cylinderGeometry args={[0.05, 0.05, 0.5, 8]} />
                    <meshStandardMaterial color="#3e2b22" roughness={0.9} />
                </mesh>
                {/* Invisible click trigger for easier interaction */}
                <mesh position={[0, 0.5, 0]} visible={false}>
                    <boxGeometry args={[0.8, 1, 0.8]} />
                    <meshBasicMaterial transparent opacity={0} />
                </mesh>
            </group>

            {/* Windows - dark and scary */}
            <mesh position={[-W / 2 - 0.05, H / 2, 0]}>
                <planeGeometry args={[0.8, 1]} />
                <meshStandardMaterial color="#000" roughness={0.1} />
            </mesh>
            <mesh position={[W / 2 + 0.05, H / 2, 0]} rotation={[0, Math.PI, 0]}>
                <planeGeometry args={[0.8, 1]} />
                <meshStandardMaterial color="#000" roughness={0.1} />
            </mesh>

            {/* Interior point light - faint warm glow */}
            <pointLight position={[0, H / 2, 0]} intensity={0.5} distance={8} color="#dcb" decay={2} />

        </group>
    );
}
