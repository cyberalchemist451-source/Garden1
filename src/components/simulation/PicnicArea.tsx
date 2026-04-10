'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useSimulationStore } from '@/lib/simulationStore';
import {
    OBSTACLE_LOG_X,
    OBSTACLE_LOG_Z,
    PICNIC_TABLE_X,
    PICNIC_TABLE_Z,
    PICNIC_TOY_OFFSETS,
} from '@/lib/worldContext';
import { getTerrainHeight } from './Terrain';

const TABLE_X = PICNIC_TABLE_X;
const TABLE_Z = PICNIC_TABLE_Z;
const LOG_X = OBSTACLE_LOG_X;
const LOG_Z = OBSTACLE_LOG_Z;

const TOYS = [...PICNIC_TOY_OFFSETS];

export default function PicnicArea() {
    const { addCollider, removeCollider, environment } = useSimulationStore();
    const registeredRef = useRef(false);

    useEffect(() => {
        if (registeredRef.current) return;
        registeredRef.current = true;

        const terrainY = getTerrainHeight(TABLE_X, TABLE_Z, environment.terrain.seed, environment.terrain.heightScale);
        const ty = terrainY; // table sits on terrain

        // Picnic table body
        addCollider({
            id: 'picnic-table',
            type: 'picnic-table',
            position: { x: TABLE_X, y: ty + 0.5, z: TABLE_Z },
            size: { x: 3.0, y: 1.0, z: 1.4 },
            interactable: false,
            climbable: false,
        });

        // Toys (on top of the table surface)
        for (const toy of TOYS) {
            addCollider({
                id: toy.id,
                type: 'toy',
                position: { x: TABLE_X + toy.ox, y: ty + 1.05, z: TABLE_Z + toy.oz },
                size: { x: 0.4, y: 0.4, z: 0.4 },
                interactable: true,
                climbable: false,
                metadata: {
                    displayName: `${toy.colorName} ${toy.shape}`,
                    action: 'fetch',
                    fetchable: true,
                    shape: toy.shape,
                    color: toy.color,
                    colorName: toy.colorName,
                },
            });
        }

        // Log obstacle
        const logY = getTerrainHeight(LOG_X, LOG_Z, environment.terrain.seed, environment.terrain.heightScale);
        addCollider({
            id: 'obstacle-log',
            type: 'log',
            position: { x: LOG_X, y: logY + 0.25, z: LOG_Z },
            size: { x: 3.5, y: 0.5, z: 0.5 },
            interactable: false,
            climbable: true,
        });

        return () => {
            removeCollider('picnic-table');
            removeCollider('obstacle-log');
            for (const toy of TOYS) removeCollider(toy.id);
        };
    }, [addCollider, removeCollider, environment.terrain.seed, environment.terrain.heightScale]);

    return null; // Colliders are registered; visual meshes rendered below via R3F
}

// ── Visual component rendered inside the Canvas ───────────────────────────────
export function PicnicAreaMesh() {
    const environment = useSimulationStore(s => s.environment);
    const colliders = useSimulationStore(s => s.colliders);
    const robotCarry = useSimulationStore(s => s.robot.carriedObjectId);
    const userCarry = useSimulationStore(s => s.user.carriedObjectId);

    const carried = new Set([robotCarry, userCarry].filter(Boolean));

    // Compute terrain height once
    const terrainY = getTerrainHeight(TABLE_X, TABLE_Z, environment.terrain.seed, environment.terrain.heightScale);
    const logY = getTerrainHeight(LOG_X, LOG_Z, environment.terrain.seed, environment.terrain.heightScale);

    return (
        <group>
            {/* Picnic table */}
            <group position={[TABLE_X, terrainY, TABLE_Z]}>
                {/* Table top */}
                <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
                    <boxGeometry args={[3.0, 0.12, 1.4]} />
                    <meshStandardMaterial color="#5c4033" roughness={0.9} />
                </mesh>
                {/* Table legs */}
                {[[-1.2, -0.4], [1.2, -0.4], [-1.2, 0.4], [1.2, 0.4]].map(([lx, lz], i) => (
                    <mesh key={i} position={[lx, 0.45, lz]} castShadow>
                        <boxGeometry args={[0.1, 0.9, 0.1]} />
                        <meshStandardMaterial color="#4a3427" roughness={1} />
                    </mesh>
                ))}
                {/* Benches */}
                {[-0.9, 0.9].map((bz, i) => (
                    <mesh key={i} position={[0, 0.55, bz]} castShadow receiveShadow>
                        <boxGeometry args={[2.8, 0.1, 0.35]} />
                        <meshStandardMaterial color="#6d4c41" roughness={0.85} />
                    </mesh>
                ))}

                {/* Toys — hidden when carried */}
                {TOYS.map(toy => {
                    if (carried.has(toy.id)) return null;
                    // Check if removed from colliders (dropped elsewhere)
                    const col = colliders.find(c => c.id === toy.id);
                    if (!col) return null;
                    const localX = col.position.x - TABLE_X;
                    const localZ = col.position.z - TABLE_Z;
                    const localY = col.position.y - terrainY;
                    return (
                        <group key={toy.id} position={[localX, localY, localZ]}>
                            {toy.shape === 'sphere' && (
                                <mesh castShadow>
                                    <sphereGeometry args={[0.18, 12, 12]} />
                                    <meshStandardMaterial color={toy.color} roughness={0.4} metalness={0.1} />
                                </mesh>
                            )}
                            {toy.shape === 'cube' && (
                                <mesh castShadow>
                                    <boxGeometry args={[0.3, 0.3, 0.3]} />
                                    <meshStandardMaterial color={toy.color} roughness={0.5} />
                                </mesh>
                            )}
                            {toy.shape === 'pyramid' && (
                                <mesh castShadow>
                                    <coneGeometry args={[0.18, 0.36, 4]} />
                                    <meshStandardMaterial color={toy.color} roughness={0.45} />
                                </mesh>
                            )}
                        </group>
                    );
                })}
            </group>

            {/* Log obstacle */}
            <mesh position={[LOG_X, logY + 0.25, LOG_Z]} castShadow receiveShadow>
                <cylinderGeometry args={[0.25, 0.25, 3.5, 10]} />
                <meshStandardMaterial color="#6b4423" roughness={1} />
            </mesh>
        </group>
    );
}
