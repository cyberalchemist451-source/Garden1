'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useSimulationStore } from '@/lib/simulationStore';
import Terrain, { getTerrainHeight } from '@/components/simulation/Terrain';
import OakTrees from '@/components/simulation/OakTrees';
import Rocks from '@/components/simulation/Rocks';
import AtlasRobot from '@/components/simulation/AtlasRobot';
// RobotCognitiveLightCone moved inside AtlasRobot for performance
import Cabin from '@/components/simulation/Cabin';
import LogObstacle from '@/components/simulation/LogObstacle';
import PicnicArea, { PicnicAreaMesh } from '@/components/simulation/PicnicArea';

// ...
import UserAvatar from '@/components/simulation/UserAvatar';

// Helper component for positioning objects on terrain
function TreeOnTerrain({ position }: { position: [number, number, number] }) {
    const groupRef = useRef<THREE.Group>(null);
    const environment = useSimulationStore(s => s.environment);
    const addCollider = useSimulationStore(s => s.addCollider);

    useEffect(() => {
        if (groupRef.current) {
            // ... existing logic ...
            const terrainY = getTerrainHeight(
                position[0],
                position[2],
                environment.terrain.seed,
                environment.terrain.heightScale
            );
            groupRef.current.position.set(position[0], terrainY, position[2]);

            // Register collider for this specific tree
            addCollider({
                id: `lone-tree-${position[0]}-${position[2]}`,
                type: 'tree',
                position: { x: position[0], y: terrainY, z: position[2] },
                size: { x: 2, y: 5, z: 2 },
                interactable: false,
                climbable: false,
            });
        }
    }, [position, environment, addCollider]);

    return (
        <group ref={groupRef}>
            {/* Tree trunk */}
            <mesh position={[0, 1.5, 0]} castShadow>
                <cylinderGeometry args={[0.3, 0.4, 3, 8]} />
                <meshStandardMaterial color="#3d2817" roughness={0.9} />
            </mesh>
            {/* Tree canopy */}
            <mesh position={[0, 3.5, 0]} castShadow>
                <coneGeometry args={[2, 3, 8]} />
                <meshStandardMaterial color="#2d4a1f" roughness={0.8} />
            </mesh>
        </group>
    );
}

export default function SimulationScene() {
    const moveRobot = useSimulationStore(s => s.moveRobot);
    const setRobotAnimation = useSimulationStore(s => s.setRobotAnimation);
    const cameraMode = useSimulationStore(s => s.cameraMode);
    const environment = useSimulationStore(s => s.environment);

    // Refs for manual updates without re-rendering
    const controlsRef = useRef<any>(null);
    const cameraDistance = useRef(8);
    const cameraAngleH = useRef(0); // Horizontal angle offset
    const cameraAngleV = useRef(0.3); // Vertical angle offset
    const isDragging = useRef(false);
    const lastMouse = useRef({ x: 0, y: 0 });

    // Sitting state from store - Get whole user object for UserAvatar
    const userState = useSimulationStore(s => s.user);
    const setSitting = useSimulationStore(s => s.setUserSitting);

    const handleSitClick = useCallback((chairPosition: THREE.Vector3, rotation: number) => {
        setSitting(true, chairPosition, rotation);
    }, [setSitting]);

    const handleStandUp = useCallback(() => {
        setSitting(false);
    }, [setSitting]);

    useEffect(() => {
        const handleMouseDown = (e: MouseEvent) => {
            isDragging.current = true;
            lastMouse.current = { x: e.clientX, y: e.clientY };
        };

        const handleMouseUp = () => {
            isDragging.current = false;
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging.current) return;

            const deltaX = e.clientX - lastMouse.current.x;
            const deltaY = e.clientY - lastMouse.current.y;

            cameraAngleH.current -= deltaX * 0.005;
            cameraAngleV.current = THREE.MathUtils.clamp(
                cameraAngleV.current + deltaY * 0.005, // Inverted: dragging up = look up
                -0.2, // Min angle (looking down slightly)
                1.2   // Max angle (looking up)
            );

            lastMouse.current = { x: e.clientX, y: e.clientY };
        };

        const handleWheel = (e: WheelEvent) => {
            // Check if avatar is inside cabin to limit zoom
            const avatarGroup = document.querySelector('[name="userAvatar"]');
            let maxDistance = 15; // Default max distance

            if (avatarGroup) {
                const pos = (avatarGroup as any).position;
                if (pos) {
                    const environment = useSimulationStore.getState().environment;
                    const cabinX = environment.terrain.size * 0.25;
                    const cabinZ = environment.terrain.size * 0.05;
                    const cabinW = 10;
                    const cabinD = 7;

                    // Check if avatar is inside cabin
                    const isInsideCabin =
                        Math.abs(pos.x - cabinX) < cabinW / 2 - 0.5 &&
                        Math.abs(pos.z - cabinZ) < cabinD / 2 - 0.5;

                    if (isInsideCabin) {
                        maxDistance = 5; // Limit zoom when inside cabin
                    }
                }
            }

            cameraDistance.current = THREE.MathUtils.clamp(
                cameraDistance.current + e.deltaY * 0.01,
                3,  // Min distance
                maxDistance
            );
        };

        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('wheel', handleWheel);

        return () => {
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('wheel', handleWheel);
        };
    }, []);

    useFrame((state, delta) => {
        // Third-person camera following avatar
        const avatarGroup = state.scene.getObjectByName('userAvatar');
        if (avatarGroup) {
            const avatarPos = avatarGroup.position;

            // Calculate camera position combining manual offset AND avatar rotation
            // This makes camera turn with avatar when using A/D keys
            const cameraYaw = cameraAngleH.current + avatarGroup.rotation.y;

            const offsetX = Math.sin(cameraYaw) * cameraDistance.current * Math.cos(cameraAngleV.current);
            const offsetZ = Math.cos(cameraYaw) * cameraDistance.current * Math.cos(cameraAngleV.current);
            const offsetY = 2 + Math.sin(cameraAngleV.current) * cameraDistance.current;

            const targetCamPos = new THREE.Vector3(
                avatarPos.x + offsetX,
                avatarPos.y + offsetY,
                avatarPos.z + offsetZ
            );

            // Smoothly move camera
            state.camera.position.lerp(targetCamPos, 0.1);

            // Prevent camera from going below terrain
            const environment = useSimulationStore.getState().environment;
            const camTerrainY = getTerrainHeight(
                state.camera.position.x,
                state.camera.position.z,
                environment.terrain.seed,
                environment.terrain.heightScale
            );

            // Keep camera at least 0.5 units above terrain
            if (state.camera.position.y < camTerrainY + 0.5) {
                state.camera.position.y = camTerrainY + 0.5;
            }

            // Cabin bounds (shared for collision and distance limiting)
            const cabinX = environment.terrain.size * 0.25;
            const cabinZ = environment.terrain.size * 0.05;
            const cabinW = 10;
            const cabinD = 7;
            const cabinH = 3.5;

            const isInsideCabin =
                Math.abs(avatarPos.x - cabinX) < cabinW / 2 - 0.5 &&
                Math.abs(avatarPos.z - cabinZ) < cabinD / 2 - 0.5;

            // Limit camera distance when inside cabin to prevent shuddering
            if (isInsideCabin && cameraDistance.current > 5) {
                cameraDistance.current = THREE.MathUtils.lerp(cameraDistance.current, 5, 0.1);
            }

            // Check if camera is inside cabin bounds
            const relX = state.camera.position.x - cabinX;
            const relZ = state.camera.position.z - cabinZ;

            const isInsideCabinXZ = Math.abs(relX) < cabinW / 2 && Math.abs(relZ) < cabinD / 2;
            const isAboveFloor = state.camera.position.y > camTerrainY + 0.2;
            const isBelowCeiling = state.camera.position.y < camTerrainY + cabinH + 2;

            // If camera would be blocked by walls, move it inside with the avatar
            if (isInsideCabinXZ && isAboveFloor && isBelowCeiling) {
                // Camera is inside cabin volume - allow it (don't clamp)
            } else if (
                // Avatar is inside cabin
                Math.abs(avatarPos.x - cabinX) < cabinW / 2 - 0.5 &&
                Math.abs(avatarPos.z - cabinZ) < cabinD / 2 - 0.5
            ) {
                // Avatar is inside but camera would be outside
                // DISABLED: Clamping causes shudder/fighting with lerp. 
                // Better to let it clip or use a smarter solver later.
                /*
                const clampedX = THREE.MathUtils.clamp(
                    state.camera.position.x,
                    cabinX - cabinW / 2 + 1,
                    cabinX + cabinW / 2 - 1
                );
                const clampedZ = THREE.MathUtils.clamp(
                    state.camera.position.z,
                    cabinZ - cabinD / 2 + 1,
                    cabinZ + cabinD / 2 - 1
                );

                state.camera.position.x = clampedX;
                state.camera.position.z = clampedZ;
                */
            }

            // Look at avatar (slightly above center)
            const lookTarget = new THREE.Vector3(
                avatarPos.x,
                avatarPos.y + 1.2,
                avatarPos.z
            );
            state.camera.lookAt(lookTarget);
        }
    });

    return (
        <group>
            <ambientLight intensity={0.4} />
            <directionalLight
                position={[50, 80, 50]}
                intensity={1.2}
                castShadow
                shadow-mapSize={[1024, 1024]}
            />

            <Terrain />

            {/* Safe Mode: Heavy assets disabled */}
            {/* <OakTrees /> */}
            {/* <Rocks /> */}

            {/* UI Components inside Canvas */}
            {/* Compass removed as per user request */}


            {/* Single Tree positioned on terrain */}
            <TreeOnTerrain position={[5, 0, -5]} />
            <TreeOnTerrain position={[25, 0, 25]} />

            {/* Log Obstacle near Cabin */}
            <LogObstacle position={[58, getTerrainHeight(58, 18, environment.terrain.seed, environment.terrain.heightScale), 18]} scale={2} rotation={[0, 0.5, 0]} />

            {/* Cabin */}
            <Cabin onSitClick={handleSitClick} />

            {/* Atlas Robot - With Cognitive Awareness */}
            <AtlasRobot />

            {/* Picnic Area — table with toys + log obstacle for fetch missions */}
            <PicnicArea />
            <PicnicAreaMesh />

            {/* User Avatar - Third Person */}
            <UserAvatar sitting={userState} onStandUp={handleStandUp} />
        </group>
    );
}
