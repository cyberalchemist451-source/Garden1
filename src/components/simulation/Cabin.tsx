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
    onSitClick?: (chairPosition: THREE.Vector3, rotation: number) => void;
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

    // Larger cabin dimensions
    const W = 10;  // width
    const D = 7;   // depth
    const H = 3.5; // wall height
    const porchD = 2.5; // porch depth

    // Chair positions as stable objects
    const chair1Pos = new THREE.Vector3(cx, cy + 0.2 + 0.5 / 2, cz + 0.5);
    const chair2Pos = new THREE.Vector3(cx, cy + 0.2 + 0.5 / 2, cz - 2.5);

    const addCollider = useSimulationStore(s => s.addCollider);
    const removeCollider = useSimulationStore(s => s.removeCollider);

    // Register Static Colliders (Cabin + Furniture)
    useEffect(() => {
        // Register Cabin WALLS
        addCollider({
            id: 'cabin-back',
            type: 'structure',
            position: { x: cx, y: cy + H / 2, z: cz - D / 2 },
            size: { x: W, y: H, z: 0.2 },
            interactable: false,
            climbable: false,
            allowMultiple: false
        });

        addCollider({
            id: 'cabin-left',
            type: 'structure',
            position: { x: cx - W / 2, y: cy + H / 2, z: cz },
            size: { x: 0.2, y: H, z: D },
            interactable: false,
            climbable: false,
            allowMultiple: false
        });

        addCollider({
            id: 'cabin-right',
            type: 'structure',
            position: { x: cx + W / 2, y: cy + H / 2, z: cz },
            size: { x: 0.2, y: H, z: D },
            interactable: false,
            climbable: false,
            allowMultiple: false
        });

        addCollider({
            id: 'cabin-front-left',
            type: 'structure',
            position: { x: cx - W / 4 - 0.5, y: cy + H / 2, z: cz + D / 2 },
            size: { x: W / 2 - 0.5, y: H, z: 0.2 },
            interactable: false,
            climbable: false,
            allowMultiple: false
        });

        addCollider({
            id: 'cabin-front-right',
            type: 'structure',
            position: { x: cx + W / 4 + 0.5, y: cy + H / 2, z: cz + D / 2 },
            size: { x: W / 2 - 0.5, y: H, z: 0.2 },
            interactable: false,
            climbable: false,
            allowMultiple: false
        });

        // Table Collider
        addCollider({
            id: 'cabin-table',
            type: 'table',
            position: { x: cx, y: cy + 0.2 + 0.9 / 2, z: cz - 1 },
            size: { x: 2, y: 0.9, z: 1.2 },
            interactable: true,
            climbable: true,
            allowMultiple: false,
            metadata: {
                displayName: 'Wooden Table',
                action: 'pickup'
            }
        });

        // Chair 1
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

        // Chair 2
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

        return () => {
            ['cabin-back', 'cabin-left', 'cabin-right', 'cabin-front-left', 'cabin-front-right', 'cabin-table', 'chair-1', 'chair-2'].forEach(id => removeCollider(id));
        };
    }, [addCollider, removeCollider, cx, cy, cz, W, H, D]);

    const interactionTrigger = useSimulationStore(s => s.interactionTrigger);
    const lastProcessedRef = useRef<number>(0);

    useEffect(() => {
        if (interactionTrigger &&
            interactionTrigger.id === 'cabin-door' &&
            interactionTrigger.timestamp > lastProcessedRef.current
        ) {
            lastProcessedRef.current = interactionTrigger.timestamp;
            if (interactionTrigger.action === 'open') setDoorOpen(true);
            else if (interactionTrigger.action === 'close') setDoorOpen(false);
            else if (interactionTrigger.action === 'toggle') setDoorOpen(prev => !prev);
        }
    }, [interactionTrigger]);

    // Dynamic Door Collider
    // Gap in world space: x = [cx-0.75, cx+0.75], z = cz+D/2
    // Hinge at left edge of gap: world x = cx-0.75
    // Closed: 1.5-wide slab in the gap. Open: 0.1-wide slab in porch beside left wall.
    useEffect(() => {
        const doorId = 'cabin-door';
        removeCollider(doorId);
        addCollider({
            id: doorId,
            type: 'door',
            position: doorOpen
                // Open: swings into porch (+z), centred 0.75 ahead of hinge, at hinge x
                ? { x: cx - 0.75, y: cy + H / 2, z: cz + D / 2 + 0.75 }
                // Closed: centred in the gap
                : { x: cx, y: cy + H / 2, z: cz + D / 2 },
            size: doorOpen
                ? { x: 0.15, y: H, z: 1.5 }  // thin slab flush with left wall, in porch
                : { x: 1.5, y: H, z: 0.15 },  // slab across doorway
            interactable: true,
            climbable: false,
            allowMultiple: false,
            metadata: {
                displayName: 'Wooden Door',
                action: doorOpen ? 'close' : 'open',
                state: doorOpen ? 'open' : 'closed',
            },
        });
        return () => removeCollider(doorId);
    }, [addCollider, removeCollider, doorOpen, cx, cy, cz, H, D, W]);

    const handleChairClick = useCallback((e: ThreeEvent<MouseEvent>, position: THREE.Vector3, rotation: number) => {
        e.stopPropagation();
        onSitClick?.(position, rotation);
    }, [onSitClick]);

    useFrame(() => {
        if (groupRef.current) {
            const dx = groupRef.current.position.x - robotPosition.x;
            const dz = groupRef.current.position.z - robotPosition.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
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

    return (
        <group ref={groupRef} position={[cx, cy, cz]}>
            {/* Main Floor */}
            <mesh position={[0, 0.1, -porchD / 2]} receiveShadow userData={{ isFloor: true }}>
                <boxGeometry args={[W, 0.2, D]} />
                <meshStandardMaterial color={deckColor} roughness={0.95} />
            </mesh>

            {/* Porch Floor */}
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
            <mesh position={[0, H / 2, -D / 2]} castShadow userData={{ isWall: true }}>
                <boxGeometry args={[W, H, 0.2]} />
                <meshStandardMaterial color={wallColor} roughness={0.95} />
            </mesh>
            <mesh position={[-W / 2, H / 2, 0]} castShadow userData={{ isWall: true }}>
                <boxGeometry args={[0.2, H, D]} />
                <meshStandardMaterial color={wallColor} roughness={0.95} />
            </mesh>
            <mesh position={[W / 2, H / 2, 0]} castShadow userData={{ isWall: true }}>
                <boxGeometry args={[0.2, H, D]} />
                <meshStandardMaterial color={wallColor} roughness={0.95} />
            </mesh>
            <mesh position={[-W / 4 - 0.5, H / 2, D / 2]} castShadow userData={{ isWall: true }}>
                <boxGeometry args={[W / 2 - 0.5, H, 0.2]} />
                <meshStandardMaterial color={wallColor} roughness={0.95} />
            </mesh>
            <mesh position={[W / 4 + 0.5, H / 2, D / 2]} castShadow userData={{ isWall: true }}>
                <boxGeometry args={[W / 2 - 0.5, H, 0.2]} />
                <meshStandardMaterial color={wallColor} roughness={0.95} />
            </mesh>
            <mesh position={[0, H - 0.5, D / 2]} castShadow userData={{ isWall: true }}>
                <boxGeometry args={[2, 1, 0.2]} />
                <meshStandardMaterial color={wallColor} roughness={0.95} />
            </mesh>

            {/* Roof */}
            <mesh position={[-W / 4, H + 1.5, 0.5]} rotation={[0, 0, 0.5]} castShadow userData={{ isWall: true }}>
                <boxGeometry args={[W / 2 + 1, 0.2, D + porchD + 1]} />
                <meshStandardMaterial color={roofColor} roughness={1.0} />
            </mesh>
            <mesh position={[W / 4, H + 1.5, 0.5]} rotation={[0, 0, -0.5]} castShadow userData={{ isWall: true }}>
                <boxGeometry args={[W / 2 + 1, 0.2, D + porchD + 1]} />
                <meshStandardMaterial color={roofColor} roughness={1.0} />
            </mesh>

            {/* Door — hinge at left edge of doorway gap (local x = -0.75) */}
            {/* Gap is exactly 1.5 wide: from local x=-0.75 to x=+0.75, z=D/2 */}
            <group
                position={[-0.75, 0.1, D / 2]}
                rotation={[0, doorOpen ? Math.PI / 2 : 0, 0]}
                onClick={(e) => { e.stopPropagation(); toggleDoor(); }}
                onContextMenu={(e) => { e.nativeEvent.preventDefault(); e.stopPropagation(); toggleDoor(); }}
            >
                {/* Door panel: 1.5 wide (matches gap), pivots from x=0 (the hinge) */}
                <mesh position={[0.75, (H - 1) / 2, 0]} castShadow>
                    <boxGeometry args={[1.5, H - 1, 0.1]} />
                    <meshStandardMaterial color={doorColor} roughness={0.8} />
                </mesh>
                {/* Handle at right side of door */}
                <mesh position={[1.35, (H - 1) / 2, 0.08]}>
                    <boxGeometry args={[0.1, 0.3, 0.1]} />
                    <meshStandardMaterial color="#333" metalness={0.8} />
                </mesh>
            </group>

            {/* Interior Furniture */}
            <group position={[0, 0.2, -1]}>
                <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
                    <boxGeometry args={[2, 0.1, 1.2]} />
                    <meshStandardMaterial color="#4a3a2a" roughness={0.8} />
                </mesh>
                {[[-0.9, -0.5], [0.9, -0.5], [-0.9, 0.5], [0.9, 0.5]].map(([x, z], i) => (
                    <mesh key={i} position={[x, 0.4, z]} castShadow>
                        <cylinderGeometry args={[0.08, 0.08, 0.8, 8]} />
                        <meshStandardMaterial color="#3e2b22" roughness={0.9} />
                    </mesh>
                ))}
            </group>

            {/* Chair 1 - facing table */}
            <group
                position={[0, 0.2, 0.5]}
                rotation={[0, Math.PI, 0]}
                onPointerDown={(e) => handleChairClick(e, chair1Pos, Math.PI)}
            >
                <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
                    <boxGeometry args={[0.5, 0.1, 0.5]} />
                    <meshStandardMaterial color="#4a3a2a" roughness={0.8} />
                </mesh>
                <mesh position={[0, 0.9, -0.22]} castShadow>
                    <boxGeometry args={[0.5, 0.7, 0.08]} />
                    <meshStandardMaterial color="#3e2b22" roughness={0.9} />
                </mesh>
                {[[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].map(([x, z], i) => (
                    <mesh key={i} position={[x, 0.25, z]} castShadow>
                        <cylinderGeometry args={[0.05, 0.05, 0.5, 8]} />
                        <meshStandardMaterial color="#3e2b22" roughness={0.9} />
                    </mesh>
                ))}
                <mesh position={[0, 0.5, 0]} visible={false}>
                    <boxGeometry args={[0.8, 1, 0.8]} />
                    <meshBasicMaterial transparent opacity={0} />
                </mesh>
            </group>

            {/* Chair 2 - facing table */}
            <group
                position={[0, 0.2, -2.5]}
                rotation={[0, 0, 0]}
                onPointerDown={(e) => handleChairClick(e, chair2Pos, 0)}
            >
                <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
                    <boxGeometry args={[0.5, 0.1, 0.5]} />
                    <meshStandardMaterial color="#4a3a2a" roughness={0.8} />
                </mesh>
                <mesh position={[0, 0.9, -0.22]} castShadow>
                    <boxGeometry args={[0.5, 0.7, 0.08]} />
                    <meshStandardMaterial color="#3e2b22" roughness={0.9} />
                </mesh>
                {[[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].map(([x, z], i) => (
                    <mesh key={i} position={[x, 0.25, z]} castShadow>
                        <cylinderGeometry args={[0.05, 0.05, 0.5, 8]} />
                        <meshStandardMaterial color="#3e2b22" roughness={0.9} />
                    </mesh>
                ))}
                <mesh position={[0, 0.5, 0]} visible={false}>
                    <boxGeometry args={[0.8, 1, 0.8]} />
                    <meshBasicMaterial transparent opacity={0} />
                </mesh>
            </group>

            <pointLight position={[0, H / 2, 0]} intensity={0.5} distance={8} color="#dcb" decay={2} />
        </group>
    );
}
