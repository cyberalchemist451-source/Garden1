'use client';

import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSimulationStore } from '@/lib/simulationStore';
import { getTerrainHeight } from './Terrain';

interface SittingState {
    isSitting: boolean;
    position?: { x: number; y: number; z: number };
    sittingPosition?: { x: number; y: number; z: number };
}

export default function UserAvatar({ sitting, onStandUp }: {
    sitting?: SittingState;
    onStandUp?: () => void;
}) {
    const groupRef = useRef<THREE.Group>(null);
    const leftArmRef = useRef<THREE.Group>(null);
    const rightArmRef = useRef<THREE.Group>(null);
    const leftLegRef = useRef<THREE.Group>(null);
    const rightLegRef = useRef<THREE.Group>(null);
    const keys = useRef<Set<string>>(new Set());
    const position = useRef(new THREE.Vector3(0, 0, 0));
    const velocity = useRef(new THREE.Vector3());
    const isGrounded = useRef(true);
    const isFlexing = useRef(false);
    const isMoving = useRef(false);

    useEffect(() => {
        const handleDown = (e: KeyboardEvent) => {
            // Block movement if chat is open
            if (useSimulationStore.getState().isChatOpen) return;

            const key = e.key.toLowerCase();
            if (['w', 'a', 's', 'd', 'q', 'e', 'f', 'shift', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
                e.preventDefault();
                keys.current.add(key === ' ' ? 'space' : key);
            }
        };
        const handleUp = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            if (['w', 'a', 's', 'd', 'q', 'e', 'f', 'shift', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
                e.preventDefault();
                keys.current.delete(key === ' ' ? 'space' : key);
            }
        };
        // ...

        window.addEventListener('keydown', handleDown);
        window.addEventListener('keyup', handleUp);
        return () => {
            window.removeEventListener('keydown', handleDown);
            window.removeEventListener('keyup', handleUp);
        };
    }, []);

    useFrame((state, delta) => {
        if (!groupRef.current) return;

        const speed = keys.current.has('shift') ? 8 : 4;
        const forward = keys.current.has('w') || keys.current.has('arrowup');
        const backward = keys.current.has('s') || keys.current.has('arrowdown');
        const strafeLeft = keys.current.has('q');
        const strafeRight = keys.current.has('e');
        const turnLeft = keys.current.has('a') || keys.current.has('arrowleft');
        const turnRight = keys.current.has('d') || keys.current.has('arrowright');
        const flex = keys.current.has('f');

        // If sitting and any movement key pressed, stand up
        if (sitting?.isSitting && (forward || backward || strafeLeft || strafeRight || turnLeft || turnRight)) {
            onStandUp?.();
            return;
        }

        // If sitting, lock avatar to sitting position
        if (sitting?.isSitting) {
            // 1. POSITIONING
            if (sitting.sittingPosition) {
                // Raise avatar so legs rest on chair seat (not underneath)
                // Safe clone for plain objects (from store)
                const sitPosition = new THREE.Vector3(
                    (sitting.sittingPosition as any).x || sitting.sittingPosition.x,
                    (sitting.sittingPosition as any).y || sitting.sittingPosition.y,
                    (sitting.sittingPosition as any).z || sitting.sittingPosition.z
                );
                sitPosition.y += 0.5;

                position.current.copy(sitPosition);
                // Apply position immediately to visual mesh
                groupRef.current.position.copy(sitPosition);

            } else if (sitting.position) {
                // Fallback for legacy calls (shouldn't happen often)
                // Just hold current position to prevent drift/launch
                groupRef.current.position.copy(position.current);
            } else {
                groupRef.current.position.copy(position.current);
            }

            // 2. SITTING POSE (Visuals)
            if (leftLegRef.current) leftLegRef.current.rotation.x = Math.PI / 2;
            if (rightLegRef.current) rightLegRef.current.rotation.x = Math.PI / 2;
            if (leftArmRef.current) {
                leftArmRef.current.rotation.x = 0;
                leftArmRef.current.rotation.z = 0;
            }
            if (rightArmRef.current) {
                rightArmRef.current.rotation.x = 0;
                rightArmRef.current.rotation.z = 0;
            }

            // 3. EXIT (Skip movement logic)
            return;
        }

        // If NOT sitting, update position normally based on movement
        groupRef.current.position.copy(position.current);

        // Physics Constants
        const GRAVITY = 18.0; // Stronger gravity for snappy feel
        const JUMP_FORCE = 8.0;

        // --- MOVEMENT & PHYSICS ---

        // 1. Calculate Intent (Input)
        let dx = 0;
        let dz = 0;

        if (forward) dz -= 1;
        if (backward) dz += 1;
        if (strafeLeft) dx += 1;
        if (strafeRight) dx -= 1;

        isMoving.current = (dx !== 0 || dz !== 0);
        isFlexing.current = flex;

        // 2. Apply Rotation
        const turnSpeed = 2.0;
        if (turnLeft) groupRef.current.rotation.y += turnSpeed * delta;
        if (turnRight) groupRef.current.rotation.y -= turnSpeed * delta;

        // 3. Calculate Target Horizontal Position
        const currentPos = position.current.clone();
        let nextPos = currentPos.clone();

        if (isMoving.current) {
            const avatarAngle = groupRef.current.rotation.y;
            const localForward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), avatarAngle);
            const localRight = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), avatarAngle);

            const moveDir = new THREE.Vector3();
            moveDir.addScaledVector(localForward, -dz);
            moveDir.addScaledVector(localRight, dx);
            if (moveDir.length() > 0) moveDir.normalize();

            nextPos.addScaledVector(moveDir, speed * delta);
        }

        // 4. Horizontal Collision Detection
        const colliders = useSimulationStore.getState().colliders;
        let blocked = false;

        for (const collider of colliders) {
            // Pass through open doors
            if (collider.metadata?.state === 'open') continue;

            const halfSizeX = collider.size.x / 2;
            const halfSizeZ = collider.size.z / 2;

            // Check if nextPos is inside collider (with radius buffer)
            if (Math.abs(nextPos.x - collider.position.x) < halfSizeX + 0.3 &&
                Math.abs(nextPos.z - collider.position.z) < halfSizeZ + 0.3) {

                const colliderTop = collider.position.y + collider.size.y / 2;
                // Standard block: if feet are below top
                // BUT: Allow step-up if it's climbable/log and low enough (knee height < 0.6m above current feet)
                const heightDiff = colliderTop - currentPos.y;

                if (heightDiff > -0.1 && heightDiff < 0.6 && (collider.climbable || collider.type === 'log')) {
                    // It's a step! Allow horizontal move, vertical logic will snap up.
                    continue;
                }

                if (currentPos.y < colliderTop - 0.1) {
                    blocked = true;
                    break;
                }
            }
        }

        if (!blocked) {
            position.current.x = nextPos.x;
            position.current.z = nextPos.z;
        }

        // 5. Vertical Physics (Gravity & Jump)
        const jump = keys.current.has('space'); // Map ' ' to space in handleKeyDown

        if (jump && isGrounded.current) {
            velocity.current.y = JUMP_FORCE;
            isGrounded.current = false;
        }

        velocity.current.y -= GRAVITY * delta;
        position.current.y += velocity.current.y * delta;

        // 6. Ground Collision
        const environment = useSimulationStore.getState().environment;
        const terrainY = getTerrainHeight(
            position.current.x,
            position.current.z,
            environment.terrain.seed,
            environment.terrain.heightScale
        );

        // Check for "Climbable" objects (Logs, Rocks) to stand on
        let groundHeight = terrainY;
        for (const collider of colliders) {
            // If we are "inside" the XZ bounds of a climbable object
            const halfSizeX = collider.size.x / 2;
            const halfSizeZ = collider.size.z / 2;

            if (Math.abs(position.current.x - collider.position.x) < halfSizeX &&
                Math.abs(position.current.z - collider.position.z) < halfSizeZ) {

                // If it's climbable or a log
                if (collider.climbable || collider.type === 'log') {
                    const topSurface = collider.position.y + collider.size.y / 2;
                    // Only snap to top if we are falling onto it (above it)
                    if (position.current.y >= topSurface - 0.5 && velocity.current.y <= 0) {
                        groundHeight = Math.max(groundHeight, topSurface);
                    }
                }
            }
        }

        if (position.current.y <= groundHeight) {
            position.current.y = groundHeight;
            velocity.current.y = 0;
            isGrounded.current = true;
        } else {
            isGrounded.current = false;
        }

        // Apply final position
        groupRef.current.position.copy(position.current);

        // Animation Logic
        const t = state.clock.elapsedTime;

        // ... Existing Animation Logic (Refactored to use isMoving.current) ...
        // We need to keep the animation logic block below intact or merge it.
        // I will copy the animation logic back in since I am replacing the whole block.

        if (flex && leftArmRef.current && rightArmRef.current) {
            // Flex
            leftArmRef.current.rotation.x = -2.5;
            leftArmRef.current.rotation.z = -0.5 + Math.sin(t * 10) * 0.1;
            rightArmRef.current.rotation.x = -2.5;
            rightArmRef.current.rotation.z = 0.5 - Math.sin(t * 10) * 0.1;

            if (leftLegRef.current) leftLegRef.current.rotation.x = 0;
            if (rightLegRef.current) rightLegRef.current.rotation.x = 0;
        } else if (isMoving.current && isGrounded.current) {
            // Walk
            const walkSpeed = keys.current.has('shift') ? 12 : 6;
            const legSwing = 0.5;
            const armSwing = 0.3;

            if (leftLegRef.current) leftLegRef.current.rotation.x = Math.sin(t * walkSpeed) * legSwing;
            if (rightLegRef.current) rightLegRef.current.rotation.x = Math.sin(t * walkSpeed + Math.PI) * legSwing;
            if (leftArmRef.current) {
                leftArmRef.current.rotation.x = Math.sin(t * walkSpeed + Math.PI) * armSwing;
                leftArmRef.current.rotation.z = 0;
            }
            if (rightArmRef.current) {
                rightArmRef.current.rotation.x = Math.sin(t * walkSpeed) * armSwing;
                rightArmRef.current.rotation.z = 0;
            }
        } else if (!isGrounded.current) {
            // Jump Pose
            if (leftLegRef.current) leftLegRef.current.rotation.x = -0.5;
            if (rightLegRef.current) rightLegRef.current.rotation.x = -0.2;
            if (leftArmRef.current) {
                leftArmRef.current.rotation.x = -2.0; // Arms up!
                leftArmRef.current.rotation.z = -0.2;
            }
            if (rightArmRef.current) {
                rightArmRef.current.rotation.x = -2.0;
                rightArmRef.current.rotation.z = 0.2;
            }
        } else {
            // Idle
            if (leftArmRef.current) { leftArmRef.current.rotation.x = 0; leftArmRef.current.rotation.z = 0; }
            if (rightArmRef.current) { rightArmRef.current.rotation.x = 0; rightArmRef.current.rotation.z = 0; }
            if (leftLegRef.current) leftLegRef.current.rotation.x = 0;
            if (rightLegRef.current) rightLegRef.current.rotation.x = 0;
        }

        // Sync to store
        useSimulationStore.getState().setUserPosition(position.current);
    });

    return (
        <group ref={groupRef} name="userAvatar">
            {/* Simple humanoid robot */}
            {/* Body */}
            <mesh position={[0, 0.9, 0]} castShadow>
                <boxGeometry args={[0.4, 0.6, 0.3]} />
                <meshStandardMaterial color="#2a3f5f" roughness={0.4} metalness={0.6} />
            </mesh>

            {/* Head */}
            <mesh position={[0, 1.4, 0]} castShadow>
                <boxGeometry args={[0.25, 0.25, 0.25]} />
                <meshStandardMaterial color="#3a5f7f" roughness={0.3} metalness={0.7} />
            </mesh>

            {/* Eyes */}
            <mesh position={[0, 1.4, 0.13]}>
                <boxGeometry args={[0.15, 0.03, 0.01]} />
                <meshStandardMaterial
                    color="#00ffff"
                    emissive="#00ffff"
                    emissiveIntensity={0.8}
                />
            </mesh>

            {/* Left Arm */}
            <group ref={leftArmRef} position={[-0.3, 0.8, 0]}>
                <mesh castShadow>
                    <boxGeometry args={[0.12, 0.5, 0.12]} />
                    <meshStandardMaterial color="#2a3f5f" roughness={0.4} metalness={0.6} />
                </mesh>
            </group>

            {/* Right Arm */}
            <group ref={rightArmRef} position={[0.3, 0.8, 0]}>
                <mesh castShadow>
                    <boxGeometry args={[0.12, 0.5, 0.12]} />
                    <meshStandardMaterial color="#2a3f5f" roughness={0.4} metalness={0.6} />
                </mesh>
            </group>

            {/* Left Leg */}
            <group ref={leftLegRef} position={[-0.12, 0.3, 0]}>
                <mesh castShadow>
                    <boxGeometry args={[0.14, 0.6, 0.14]} />
                    <meshStandardMaterial color="#1a2f4f" roughness={0.5} metalness={0.5} />
                </mesh>
            </group>

            {/* Right Leg */}
            <group ref={rightLegRef} position={[0.12, 0.3, 0]}>
                <mesh castShadow>
                    <boxGeometry args={[0.14, 0.6, 0.14]} />
                    <meshStandardMaterial color="#1a2f4f" roughness={0.5} metalness={0.5} />
                </mesh>
            </group>
        </group>
    );
}
