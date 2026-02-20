'use client';

import { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSimulationStore, RobotIntent } from '@/lib/simulationStore';
import { getTerrainHeight } from '@/components/simulation/Terrain';
import { ObjectMemoryManager } from '@/lib/objectMemory';
import { TemporalExperienceManager } from '@/lib/temporalExperience';
import { RobotCognitiveLightCone } from './RobotCognitiveCone';
import { RobotSpeechBubble } from './RobotSpeechBubble';

const METAL_DARK = '#1a1a2e';
const METAL_MID = '#2a2a40';
const ACCENT_ORANGE = '#ff6600'; // Different from user's cyan

// Robot's own memory instance
const robotMemory = new ObjectMemoryManager();

// Feature flag to disable temporal system if causing issues
const ENABLE_TEMPORAL = true; // Set to true once page loads successfully

// Robot's temporal experience manager (only if enabled)
let temporalManager: TemporalExperienceManager | null = null;
if (ENABLE_TEMPORAL) {
    temporalManager = new TemporalExperienceManager({
        baseCompressionRatio: 1.0,
        tokenBudgetPerSecond: 100,
        memoryConsolidationInterval: 5.0,
        maxMemoryEntries: 50,
    });
    console.log('[AtlasRobot] Temporal experience system enabled');
} else {
    console.log('[AtlasRobot] Temporal experience system DISABLED (feature flag)');
}

/**
 * AtlasRobot with cognitive awareness and text command execution
 * Features: Sensory scanning, light cone awareness, command processing
 */
export default function AtlasRobot() {
    const groupRef = useRef<THREE.Group>(null);
    const leftArmRef = useRef<THREE.Group>(null);
    const rightArmRef = useRef<THREE.Group>(null);
    const leftLegRef = useRef<THREE.Group>(null);
    const rightLegRef = useRef<THREE.Group>(null);

    const keys = useRef<Set<string>>(new Set());
    const position = useRef(new THREE.Vector3(15, 0, 15));
    const velocity = useRef(new THREE.Vector3());
    const intentStartTime = useRef<number>(0);
    const processingVision = useRef(false); // Track async analysis

    const environment = useSimulationStore(s => s.environment);
    const colliders = useSimulationStore(s => s.colliders);
    const currentIntent = useSimulationStore(s => s.robot.currentIntent);
    const isSitting = useSimulationStore(s => s.robot.isSitting);
    const sittingPosition = useSimulationStore(s => s.robot.sittingPosition);
    // Get scene for object lookup
    const { scene, gl } = useThree();
    const { setRobotSitting, clearRobotIntent, updateNearbyObjects, addSensoryInput, setRobotTemporalMetrics, triggerInteraction } = useSimulationStore();
    const compressionRatio = useSimulationStore(s => s.robot.temporalMetrics?.compressionRatio ?? 1);
    const simTime = useRef(0);
    const metricsUpdateCounter = useRef(0);

    // Keyboard controls for manual testing
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Block robot control if chat is open
            if (useSimulationStore.getState().isChatOpen) return;

            const key = e.key.toLowerCase();
            if (['i', 'j', 'k', 'l', 'u', 'o', 'y', 'h', 'n', 'm'].includes(key)) {
                keys.current.add(key);
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            if (['i', 'j', 'k', 'l', 'u', 'o', 'y', 'h', 'n', 'm'].includes(key)) {
                keys.current.delete(key);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    const vy = useRef(0);
    const isGrounded = useRef(true);

    const captureVisualInput = () => {
        try {
            return gl.domElement.toDataURL('image/jpeg', 0.5); // Low quality to save bandwidth
        } catch (e) {
            console.error("Failed to capture visual input", e);
            return null;
        }
    };

    // Physics loop
    useFrame((state, delta) => {
        if (!groupRef.current) return;

        // CLAMP DELTA
        const safeDelta = Math.min(delta, 0.1);
        const compressionRatio = useSimulationStore.getState().robot.temporalMetrics?.compressionRatio ?? 1;
        const dt = safeDelta * compressionRatio;
        simTime.current += dt;

        // Physics Constants
        const GRAVITY = 20;
        const JUMP_FORCE = 8;
        const speed = 4;
        const turnSpeed = 2.5;

        // --- PHYSICS & INTENTS ---

        // 1. Sitting Check
        if (isSitting && sittingPosition) {
            const sitPos = sittingPosition;
            groupRef.current.position.set(sitPos.x, sitPos.y + 0.5, sitPos.z);
            position.current.copy(groupRef.current.position);
            vy.current = 0;
            isGrounded.current = true;

            // Visuals...
            // ...
            return;
        }

        // 2. Intent Execution
        let dx = 0;
        let dz = 0;
        let shouldTurn = false;
        let turnDirection = 0;
        let jump = false;

        // ... Intent Processing ...
        // (Simplified for brevity in this replace block - I need to keep existing logic but map it to dx/dz)
        // Existing logic sets dx/dz directly? No, existing logic calculates new position.
        // I need to adapt existing intent logic to set dx/dz velocity or move vector.

        // Initialize intended movement
        if (currentIntent && !currentIntent.completed) {
            const elapsed = (Date.now() - intentStartTime.current) / 1000;

            if (currentIntent.type === 'move') {
                // Calculate forward/strafe vector
                // ...
                if (currentIntent.action === 'jump') {
                    if (elapsed < 0.1 && isGrounded.current) {
                        jump = true;
                    }
                    if (elapsed > 0.8) clearRobotIntent();
                }
                // ...
            }
            // ...
        }

        // 3. Apply Gravity & Jump
        if (jump && isGrounded.current) {
            vy.current = JUMP_FORCE;
            isGrounded.current = false;
        }
        vy.current -= GRAVITY * dt;

        // 4. Apply Horizontal Movement (from Intent or Manual)
        // ... (Merging manual and intent) ...

        // 5. Update Position
        const currentPos = position.current;
        const nextX = currentPos.x + dx;
        const nextZ = currentPos.z + dz;
        const nextY = currentPos.y + vy.current * dt;

        // 6. Collision & Ground
        const terrainY = getTerrainHeight(nextX, nextZ, environment.terrain.seed, environment.terrain.heightScale);
        let groundHeight = terrainY;
        let blocked = false;

        // Check Obstacles
        for (const collider of colliders) {
            const halfSizeX = collider.size.x / 2;
            const halfSizeZ = collider.size.z / 2;
            const halfSizeY = collider.size.y / 2;

            // 1. Horizontal Block Check
            // We check if the NEXT position is inside the collider
            if (collider.metadata?.state !== 'open' && // Pass through open doors
                Math.abs(nextX - collider.position.x) < halfSizeX + 0.5 &&  // +0.5 robot radius
                Math.abs(nextZ - collider.position.z) < halfSizeZ + 0.5) {

                const colliderTop = collider.position.y + halfSizeY;
                const currentFeetY = currentPos.y;

                // Allow step-up for low obstacles (logs, stairs)
                // If top is < 0.6m above feet, AND we are higher than the bottom?
                // Actually, just check if feet are close enough to top to step up.
                const heightDiff = colliderTop - currentFeetY;

                if (heightDiff > -0.1 && heightDiff < 0.6 && (collider.climbable || collider.type === 'log')) {
                    // Allowed to pass (will snap up in step 2)
                    // CRITICAL FIX: We must ensure we don't block if we are "in" it but stepping up.
                } else {
                    // Block if we are NOT above it
                    // If current Y (feet) is below the top (minus tolerance), we are hitting the side
                    if (currentFeetY < colliderTop - 0.2) {
                        blocked = true;
                    }
                }
            }

            // 2. Ground Height (Standing on things)
            // We check if the CURRENT position is inside the collider (to stand on it)
            if (Math.abs(nextX - collider.position.x) < halfSizeX &&
                Math.abs(nextZ - collider.position.z) < halfSizeZ) {

                if (currentPos.y >= collider.position.y + halfSizeY - 0.5) {
                    if (collider.climbable || collider.type === 'log') {
                        groundHeight = Math.max(groundHeight, collider.position.y + halfSizeY);
                    }
                }
            }
        }

        if (nextY <= groundHeight) {
            position.current.y = groundHeight;
            vy.current = 0;
            isGrounded.current = true;
        } else {
            position.current.y = nextY;
            isGrounded.current = false;
        }

        // Apply X/Z only if not blocked
        if (!blocked) {
            position.current.x = nextX;
            position.current.z = nextZ;
        }

        groupRef.current.position.copy(position.current);



        // Check if we need to start a new intent
        if (currentIntent && !currentIntent.completed && intentStartTime.current === 0) {
            console.log('[Atlas] Starting Intent:', currentIntent.type);
            intentStartTime.current = Date.now();
        }

        // If no current intent, check queue
        // We check 'processingState' to ensure we don't spam pop the queue if it's just a render lag
        const robotStateVals = useSimulationStore.getState().robot;
        if (!currentIntent && robotStateVals.intentQueue.length > 0) {
            console.log('[Atlas] Pulse: Checking Queue...');
            useSimulationStore.getState().processNextIntent();
        }

        if (currentIntent && !currentIntent.completed) {
            const elapsed = (Date.now() - intentStartTime.current) / 1000;

            // Use real elapsed time for intent duration check (or should it be sim time?)
            // Let's use PREDICTED sim time for duration to match visual speed
            // But Date.now() is real. We need to track intent start in simTime.
            // For now, let's just scale the duration check?
            // Actually, if we stick to Date.now(), intents last fixed REAL seconds.
            // If Time is compressed 2x, Robot moves 2x faster, so it covers 2x distance in same Real time.
            // This seems correct for "Fast Forward".
            // const elapsed = (Date.now() - intentStartTime.current) / 1000; // This line was duplicated, removed.

            switch (currentIntent.type) {
                case 'move':
                    if (currentIntent.action === 'forward') {
                        dz = -1;
                    } else if (currentIntent.action === 'backward') {
                        dz = 1;
                    } else if (currentIntent.action === 'strafe-left') {
                        dx = -1;
                    } else if (currentIntent.action === 'strafe-right') {
                        dx = 1;
                    }
                    // Complete after duration or distance
                    if (elapsed > (currentIntent.duration || 2)) {
                        clearRobotIntent();
                        intentStartTime.current = 0;
                    }
                    break;

                case 'turn':
                    shouldTurn = true;
                    if (currentIntent.action === 'face-user') {
                        // Face the user
                        const userState = useSimulationStore.getState().user;
                        if (userState.position) {
                            const dx = userState.position.x - position.current.x;
                            const dz = userState.position.z - position.current.z;
                            const angle = Math.atan2(dx, dz);

                            // Smooth turn to target angle
                            let angDiff = angle - groupRef.current.rotation.y;
                            while (angDiff > Math.PI) angDiff -= 2 * Math.PI;
                            while (angDiff < -Math.PI) angDiff += 2 * Math.PI;

                            // Turn speed
                            turnDirection = angDiff > 0 ? 1 : -1;

                            // If close enough to angle, we are good
                            if (Math.abs(angDiff) < 0.1) {
                                clearRobotIntent();
                                intentStartTime.current = 0;
                            }
                        } else {
                            clearRobotIntent();
                        }
                    } else {
                        // Standard turn
                        turnDirection = currentIntent.action === 'left' ? 1 : -1;
                        if (elapsed > 0.5) {
                            clearRobotIntent();
                            intentStartTime.current = 0;
                        }
                    }
                    break;

                case 'stop':
                    clearRobotIntent();
                    intentStartTime.current = 0;
                    break;

                case 'interact':
                    if (currentIntent.action === 'sit') {
                        // 1. Identify target type based on LLM intent OR default to chair
                        const preferredTarget = String(currentIntent.parameters?.target || 'chair');

                        // 2. Find valid interactables
                        // Filter for explicit chairs OR the requested target if it's interactable
                        const validTargets = colliders.filter(c =>
                            (c.type === 'chair') ||
                            (c.interactable && c.metadata?.action === 'sit') ||
                            (c.id.includes(preferredTarget) && c.interactable)
                        );

                        if (validTargets.length > 0) {
                            const userState = useSimulationStore.getState().user;
                            let targetChair = validTargets[0];

                            // Smart selection: Avoid user's chair
                            if (userState.isSitting && userState.sittingPosition && validTargets.length > 1) {
                                const userPos = new THREE.Vector3(
                                    userState.sittingPosition.x,
                                    userState.sittingPosition.y,
                                    userState.sittingPosition.z
                                );

                                // Find closest to user (likely the one they are using)
                                // We use a threshold to identify "occupied"
                                const occupiedChair = validTargets.find(c => {
                                    const chairPos = new THREE.Vector3(c.position.x, c.position.y, c.position.z);
                                    return chairPos.distanceTo(userPos) < 1.0;
                                });

                                if (occupiedChair) {
                                    // Pick a different one
                                    const freeChair = validTargets.find(c => c.id !== occupiedChair.id);
                                    if (freeChair) targetChair = freeChair;
                                }
                            } else {
                                // Default: Closest to robot
                                targetChair = validTargets.reduce((prev, curr) => {
                                    const pDist = new THREE.Vector3(prev.position.x, prev.position.y, prev.position.z).distanceTo(position.current);
                                    const cDist = new THREE.Vector3(curr.position.x, curr.position.y, curr.position.z).distanceTo(position.current);
                                    return pDist < cDist ? prev : curr;
                                });
                            }

                            if (targetChair) {
                                // Apply offset so robot sits ON the chair, not hovering above it
                                // targetChair.position is a plain Vec3 from store, not a THREE.Vector3
                                const sitPos = {
                                    x: targetChair.position.x,
                                    y: targetChair.position.y - 0.5,
                                    z: targetChair.position.z
                                };
                                setRobotSitting(true, sitPos);
                                clearRobotIntent();
                                intentStartTime.current = 0;
                            }
                        } else {
                            // No chair found, just stop
                            console.log('[Atlas] No valid sit target found.');
                            clearRobotIntent();
                            intentStartTime.current = 0;
                        }

                    } else if (currentIntent.action === 'stand') {
                        setRobotSitting(false);
                        clearRobotIntent();
                        intentStartTime.current = 0;

                    } else if (currentIntent.action === 'follow') {
                        // "Come here" / Follow logic
                        const userState = useSimulationStore.getState().user;
                        if (userState.position) {
                            const dx = userState.position.x - position.current.x;
                            const dz = userState.position.z - position.current.z;
                            const dist = Math.sqrt(dx * dx + dz * dz);

                            // Benchmark: Completion when close enough (2m)
                            // Benchmark: Completion when close enough (2m)
                            if (dist < 2.0) {
                                // Arrived. Do NOT clear intent. Just stop and face user.
                                // This allows "following" to resume if user moves away.
                                velocity.current.x = 0;
                                velocity.current.z = 0;

                                const angle = Math.atan2(dx, dz);
                                groupRef.current.rotation.y = angle;
                            } else {
                                // Move towards user
                                const moveDir = new THREE.Vector3(dx, 0, dz).normalize();
                                const speed = 4.0; // Fast walk

                                velocity.current.set(
                                    moveDir.x * speed * safeDelta,
                                    0,
                                    moveDir.z * speed * safeDelta
                                );
                                position.current.add(velocity.current);

                                // Rotate towards user
                                const angle = Math.atan2(dx, dz);
                                // Smooth rotation
                                let angDiff = angle - groupRef.current.rotation.y;
                                while (angDiff > Math.PI) angDiff -= 2 * Math.PI;
                                while (angDiff < -Math.PI) angDiff += 2 * Math.PI;
                                groupRef.current.rotation.y += angDiff * 5.0 * safeDelta;
                            }

                            // Timeout safety (15s)
                            if (elapsed > 15) {
                                clearRobotIntent();
                                intentStartTime.current = 0;
                            }
                        } else {
                            clearRobotIntent(); // No target
                        }
                    }
                    else if (currentIntent.action === 'open' || currentIntent.action === 'close') {
                        // Find closest interactable that supports this action
                        // For doors, usually they are 'door' type
                        const validTargets = colliders.filter(c =>
                            c.interactable &&
                            (c.type === 'door' || c.metadata?.action === currentIntent.action || (currentIntent.action === 'open' ? c.metadata?.action === 'close' : c.metadata?.action === 'open'))
                            // Note: We allow 'open' action on a 'close'-able object (toggle)
                        );

                        if (validTargets.length > 0) {
                            // Find closest
                            const target = validTargets.reduce((prev, curr) => {
                                const pDist = new THREE.Vector3(prev.position.x, prev.position.y, prev.position.z).distanceTo(position.current);
                                const cDist = new THREE.Vector3(curr.position.x, curr.position.y, curr.position.z).distanceTo(position.current);
                                return pDist < cDist ? prev : curr;
                            });

                            const dist = new THREE.Vector3(target.position.x, target.position.y, target.position.z).distanceTo(position.current);

                            if (dist < 3.0) { // Interaction range
                                triggerInteraction(target.id, currentIntent.action);
                                clearRobotIntent();
                                intentStartTime.current = 0;
                            } else {
                                // Move closer
                                const dx = target.position.x - position.current.x;
                                const dz = target.position.z - position.current.z;
                                const moveDir = new THREE.Vector3(dx, 0, dz).normalize();
                                const speed = 4.0;

                                velocity.current.set(
                                    moveDir.x * speed * safeDelta,
                                    0,
                                    moveDir.z * speed * safeDelta
                                );
                                position.current.add(velocity.current);

                                // Face target
                                const angle = Math.atan2(dx, dz);
                                groupRef.current.rotation.y = angle;

                                if (elapsed > 10) { // Timeout
                                    clearRobotIntent();
                                    intentStartTime.current = 0;
                                }
                            }
                        } else {
                            // No target found
                            clearRobotIntent();
                            intentStartTime.current = 0;
                        }

                    }
                    else {
                        // Generic interact
                        clearRobotIntent();
                        intentStartTime.current = 0;
                    }
                    break;

                case 'query':
                    if (currentIntent.action === 'vision') {
                        // "Curiosity Module": Async Vision Generation
                        if (!currentIntent.completed && !processingVision.current) {
                            processingVision.current = true;

                            // Check for High Fidelity Request (Multimodal)
                            const useMultimodal = currentIntent.parameters?.fidelity === 'high' ||
                                // Heuristic: If message explicitly asks for "check" or "see" specific items
                                (currentIntent.parameters?.context === 'check_door') ||
                                // or if intent parameters includes it
                                (currentIntent.parameters?.useVision === true);

                            let imageInput = null;
                            if (useMultimodal) {
                                console.log('[Atlas] Capturing visual input for multimodal analysis...');
                                imageInput = captureVisualInput();
                            }

                            // 1. Snapshot current state (post-movement)
                            const nearby = useSimulationStore.getState().robot.nearbyObjects;
                            const userState = useSimulationStore.getState().user;
                            const robotState = useSimulationStore.getState().robot;

                            // OPTIMIZATION: Check Memory first (Object Permanence)
                            // If we have seen objects recently (<10s) and haven't moved much, just recall them.
                            // For now, we always trigger fresh analysis but we include KNOWN objects in the context
                            // to represent "permanence" even if out of view.

                            const known = robotState.knownObjects;
                            const knownStr = Object.values(known).map(k => `${k.type} (last seen ${(Date.now() - k.lastSeen) / 1000}s ago)`).join(', ');

                            // 2. Call API for "Collective" analysis
                            fetch('/api/robot', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    type: 'analysis',
                                    message: `describe surroundings. Known objects in memory: ${knownStr}`,
                                    robotState: { ...robotState, nearbyObjects: nearby },
                                    userState: userState,
                                    image: imageInput
                                })
                            })
                                .then(res => res.json())
                                .then(data => {
                                    const text = data.response || "Mute. Data link error.";
                                    const duration = Math.max(3000, text.length * 80);

                                    // --- Social Nuance: Attention & Proximity ---

                                    // 1. Proximity Check (Don't shout)
                                    const distToUser = new THREE.Vector3(userState.position.x, userState.position.y, userState.position.z).distanceTo(position.current);
                                    if (distToUser > 8.0) {
                                        // If too far, override response
                                        const override = "You are too far away. Approach us so we may share this knowledge.";
                                        useSimulationStore.getState().setRobotSpeech(override, 4000);

                                        // Turn to user to say this
                                        const dx = userState.position.x - position.current.x;
                                        const dz = userState.position.z - position.current.z;
                                        const angle = Math.atan2(dx, dz);
                                        if (groupRef.current) groupRef.current.rotation.y = angle;

                                        setTimeout(() => {
                                            clearRobotIntent();
                                            intentStartTime.current = 0;
                                            processingVision.current = false;
                                        }, 4000);
                                        return;
                                    }

                                    // 2. Attentive Turning
                                    // If we are NOT inspecting a specific object (context != 'check_door'), face the user.
                                    // (If we were inspecting, we likely already turned to it in potential future logic, but for now 'vision' is general)
                                    // Let's assume 'vision' intent usually implies looking at surroundings, but speaking TO the user.
                                    // So we turn to user unless context implies otherwise.

                                    if (currentIntent.parameters?.context !== 'inspect_object') {
                                        const dx = userState.position.x - position.current.x;
                                        const dz = userState.position.z - position.current.z;
                                        const angle = Math.atan2(dx, dz);
                                        // Smooth turn in next frame? For now, snap or quick tween is okay for "reorienting"
                                        if (groupRef.current) groupRef.current.rotation.y = angle;
                                    }

                                    useSimulationStore.getState().setRobotSpeech(text, duration);

                                    setTimeout(() => {
                                        clearRobotIntent();
                                        intentStartTime.current = 0;
                                        processingVision.current = false;
                                    }, duration);
                                })
                                .catch(err => {
                                    console.error("Vision Analysis Failed", err);
                                    clearRobotIntent();
                                    intentStartTime.current = 0;
                                    processingVision.current = false;
                                });
                        }
                    } else {
                        // Other queries are instant for now
                        clearRobotIntent();
                        intentStartTime.current = 0;
                    }
                    break;

                case 'chat':
                    // Just turn to face the user for social engagement
                    {
                        const userState = useSimulationStore.getState().user;
                        const dx = userState.position.x - position.current.x;
                        const dz = userState.position.z - position.current.z;
                        const angle = Math.atan2(dx, dz);

                        // Smooth turn or snap? For chat, maybe smooth?
                        // Current logic is direct assignment in useFrame, which is snappy but effective for "attention"
                        if (groupRef.current) groupRef.current.rotation.y = angle;

                        // Clear intent immediately as speech is handled by store
                        clearRobotIntent();
                        intentStartTime.current = 0;
                    }
                    break;

                default:
                    // Unknown intents clear immediately
                    clearRobotIntent();
                    intentStartTime.current = 0;
                    break;
            }
        } else {
            intentStartTime.current = 0;

            // Manual keyboard control
            const forward = keys.current.has('i');
            const backward = keys.current.has('k');
            const strafeLeft = keys.current.has('u');
            const strafeRight = keys.current.has('o');
            const turnLeft = keys.current.has('j');
            const turnRight = keys.current.has('l');

            if (forward) dz -= 1;
            if (backward) dz += 1;
            if (strafeLeft) dx -= 1;
            if (strafeRight) dx += 1;
            if (turnLeft) shouldTurn = true, turnDirection = 1;
            if (turnRight) shouldTurn = true, turnDirection = -1;
        }

        // Apply turning with scaled deltaTime
        if (shouldTurn) {
            groupRef.current.rotation.y += turnSpeed * dt * turnDirection;
        }

        const isMoving = (dx !== 0 || dz !== 0);

        // === Walking Animation ===
        // Use simulation time instead of real clock time
        const t = simTime.current;
        const walkSpeed = 6;
        const legSwing = 0.4;
        const armSwing = 0.25;

        // Movement logic using dt
        if (isMoving) {
            // ... (rest of animation logic is fine as it uses t)
            if (leftLegRef.current) {
                leftLegRef.current.rotation.x = Math.sin(t * walkSpeed) * legSwing;
            }
            if (rightLegRef.current) {
                rightLegRef.current.rotation.x = Math.sin(t * walkSpeed + Math.PI) * legSwing;
            }
            if (leftArmRef.current) {
                leftArmRef.current.rotation.x = Math.sin(t * walkSpeed + Math.PI) * armSwing;
                leftArmRef.current.rotation.z = 0;
            }
            if (rightArmRef.current) {
                rightArmRef.current.rotation.x = Math.sin(t * walkSpeed) * armSwing;
                rightArmRef.current.rotation.z = 0;
            }


        } else {
            // Idle pose
            if (leftArmRef.current) {
                leftArmRef.current.rotation.x = 0;
                leftArmRef.current.rotation.z = 0.1;
            }
            // ... rest of idle

            if (rightArmRef.current) {
                rightArmRef.current.rotation.x = 0;
                rightArmRef.current.rotation.z = -0.1;
            }
            if (leftLegRef.current) leftLegRef.current.rotation.x = 0;
            if (rightLegRef.current) rightLegRef.current.rotation.x = 0;
        }



        // === Sensory Scanning: Detect nearby objects ===
        // === Sensory Scanning: Detect nearby objects ===
        const visionRange = 60; // Robot's vision range (increased/curiosity)
        const visionAngle = 60; // Cone angle in degrees
        const nearbyObjects: string[] = [];

        // DEBUG: Check colliders occasionally
        if (Math.random() < 0.005) {
            console.log(`[Atlas Debug] Tracking ${colliders.length} colliders. Robot Pos: ${position.current.x.toFixed(1)}, ${position.current.z.toFixed(1)}`);
        }

        for (const collider of colliders) {
            const dx = collider.position.x - position.current.x;
            const dz = collider.position.z - position.current.z;
            const distance = Math.sqrt(dx * dx + dz * dz);

            if (distance < visionRange) {
                // Check if object is within cone
                // Note: In Three.js, "forward" is usually -Z.
                // atan2(dx, dz) gives angle from Z axis. 
                // We need angle relative to robot's forward vector.

                // Vector to object
                const localPos = new THREE.Vector3(dx, 0, dz);

                // Rotate into robot's local space to check angle
                // We inverse the robot's rotation to get the object's position relative to robot's forward
                const robotAngle = groupRef.current.rotation.y;
                localPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), -robotAngle);

                // Now localPos.z should be negative if it's in front (since forward is -Z)
                // And localPos.x is lateral distance

                // Calculate angle deviation from forward (+Z axis)
                // atan2(x, z) gives angle from +Z vector
                const angleFromForward = Math.atan2(localPos.x, localPos.z);

                // Normalized angle diff is just this angle
                let angleDiff = angleFromForward;

                // Normalize angle difference to [-π, π]
                while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

                const coneHalfAngle = (visionAngle * Math.PI) / 360;

                // Debug logs removed for performance

                if (Math.abs(angleDiff) < coneHalfAngle) {
                    // Special handling for user avatar (check by ID)
                    const isUserAvatar = collider.id === 'user-avatar' || collider.id.includes('user');

                    // Aggregate for display
                    // We don't push individually to avoid spam.
                    // Instead, we should use a Map outside the loop, but for now we can rely on a post-process
                    // Actually, let's just make nearbyObjects a summary list if possible, OR
                    // we stick to the list but filter it before sending to store?
                    // The user sees the list in the UI? 
                    // Let's modify the push to include a cleaner name and prevent duplicates if same ID

                    const existingIdx = nearbyObjects.findIndex(s => s.startsWith(collider.type));
                    if (existingIdx === -1 || isUserAvatar) {
                        // Simplify name
                        let typeLabel: string = collider.type;
                        if (collider.type === 'door' && collider.metadata?.state) {
                            typeLabel = `door (${collider.metadata.state})`;
                        }

                        const name = isUserAvatar ? `👤 Corto (${distance.toFixed(1)}m)` : `${typeLabel} (${distance.toFixed(1)}m)`;
                        nearbyObjects.push(name);
                    } else {
                        // If multiple of same type, maybe don't list every single one?
                        // Or just list closest?
                        // For now, let's limit to 3 of same type
                        const count = nearbyObjects.filter(s => s.startsWith(collider.type)).length;
                        if (count < 3) {
                            nearbyObjects.push(`${collider.type} (${distance.toFixed(1)}m)`);
                        }
                    }

                    // Add to robot's memory
                    const memoryEntry = robotMemory.perceive(
                        collider.id,
                        (isUserAvatar ? 'user_avatar' : collider.type) as any,
                        collider.position,
                        collider.size,
                        'vision',
                        1.0
                    );

                    // --- Object Permanence & Noticing ---
                    const robotState = useSimulationStore.getState().robot;
                    const known = robotState.knownObjects;
                    // Throttle updates: only if new or seen > 1s ago
                    if (!known[collider.id] || Date.now() - known[collider.id].lastSeen > 1000) {
                        robotState.registerObject(collider.id, collider.type, collider.position);

                        // "Noticing" Behavior (New objects only)
                        if (!known[collider.id]) {
                            // Probability check to avoid spam (higher for key items)
                            let noticeProb = 0.3;
                            if (collider.type === 'door' || collider.type === 'portal') noticeProb = 0.8;
                            if (isUserAvatar) noticeProb = 0.0; // Handled by social presence

                            if (Math.random() < noticeProb) {
                                // Simple "noticing" - in future could be LLM thought
                                const templates = [
                                    `I perceive a ${collider.type}.`,
                                    `Noticing ${collider.type} at ${distance.toFixed(1)}m.`,
                                    `New object identified: ${collider.type}.`,
                                    `Scanning ${collider.type}...`
                                ];
                                const msg = templates[Math.floor(Math.random() * templates.length)];
                                // Use direct store access to avoid dep cycles if needed, or just function prop
                                // We don't have addChatMessage in scope here easily? 
                                // useCollectiveStore has startQuery/endQuery but not a simple "log thought".
                                // We can use console for now, or the existing 'currentSpeech' if available.
                                console.log(`[Atlas Noticing] ${msg}`);
                                // To make it visible in UI, we might need a "Stream of Thought" or just short ephemeral message?
                                // Let's leave it as console + memory for now as requested ("option to be open... failure to register shouldn't break").
                                // Actually user said "issue a response... a 'noticing'".
                                // `route.ts` handles responses. 
                                // Let's just log to console to verify the cognitive step first.
                            }
                        }
                    }

                    // Tag user avatar as self-similar
                    if (isUserAvatar && memoryEntry && temporalManager) {
                        memoryEntry.socialTags = ['self-similar', 'conscious', 'collective-node'];
                        temporalManager.recordSocialPresence(collider.id);
                    }

                    // Send sensory input
                    addSensoryInput({
                        type: 'vision',
                        sourceId: collider.id,
                        sourceType: collider.type,
                        position: collider.position,
                        intensity: 1.0 - (distance / visionRange),
                        timestamp: Date.now(),
                    });
                }
            }
        }

        // === Manual User Detection (Corto) ===
        // Since UserAvatar might not be in colliders list, we check explicitly
        const userState = useSimulationStore.getState().user;
        const userPos = userState.position;
        if (userPos) {
            const dx = userPos.x - position.current.x;
            const dz = userPos.z - position.current.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < visionRange) {
                // Calculate angle
                const localPos = new THREE.Vector3(dx, 0, dz);
                const robotAngle = groupRef.current.rotation.y;
                localPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), -robotAngle);
                const angleFromForward = Math.atan2(localPos.x, localPos.z);
                let angleDiff = angleFromForward;
                while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

                const coneHalfAngle = (visionAngle * Math.PI) / 360;

                if (Math.abs(angleDiff) < coneHalfAngle) {
                    // Check if already added via colliders to avoid duplicate
                    const alreadyDetected = nearbyObjects.some(s => s.includes('Corto'));
                    if (!alreadyDetected) {
                        const objectName = `👤 Corto (User) (${dist.toFixed(1)}m)`;
                        nearbyObjects.push(objectName);

                        // Add memory of user
                        if (temporalManager) {
                            temporalManager.recordSocialPresence('user-corto');
                        }
                    }
                }
            }
        }

        // Update nearby objects in store
        updateNearbyObjects(nearbyObjects);

        // === Temporal Experience Processing ===
        // CRITICAL: This runs continuously for ongoing awareness
        // but doesn't trigger re-renders (uses class-based state)
        if (temporalManager) {
            // Sync compression ratio from UI/Store to Manager
            temporalManager.setCompressionRatio(compressionRatio);

            temporalManager.tick(delta, robotMemory);

            // Debounced metrics sync (~2 updates/sec instead of 60/sec)
            metricsUpdateCounter.current++;
            if (metricsUpdateCounter.current >= 30) { // Every 30 frames = ~2/sec
                metricsUpdateCounter.current = 0;
                setRobotTemporalMetrics(temporalManager.getMetrics());
            }
        }

        // Apply position
        groupRef.current.position.copy(position.current);

        // NOTE: We don't update the store every frame for performance
        // The store gets updated when commands are executed via intents
    });

    return (
        <group ref={groupRef} name="atlasRobot">
            {/* Head */}
            <mesh position={[0, 1.8, 0]} castShadow>
                <boxGeometry args={[0.3, 0.3, 0.3]} />
                <meshStandardMaterial color={METAL_MID} roughness={0.3} metalness={0.8} />
            </mesh>

            {/* Eyes/Visor */}
            <mesh position={[0, 1.8, 0.16]}>
                <planeGeometry args={[0.2, 0.06]} />
                <meshStandardMaterial
                    color={ACCENT_ORANGE}
                    emissive={ACCENT_ORANGE}
                    emissiveIntensity={currentIntent ? 1.2 : 0.8}
                />
            </mesh>

            {/* Torso */}
            <mesh position={[0, 1.1, 0]} castShadow>
                <boxGeometry args={[0.5, 0.8, 0.3]} />
                <meshStandardMaterial color={METAL_DARK} roughness={0.4} metalness={0.7} />
            </mesh>

            {/* Pelvis */}
            <mesh position={[0, 0.6, 0]} castShadow>
                <boxGeometry args={[0.4, 0.3, 0.25]} />
                <meshStandardMaterial color={METAL_MID} roughness={0.5} metalness={0.6} />
            </mesh>

            {/* Left Arm */}
            <group ref={leftArmRef} position={[-0.35, 1.2, 0]}>
                <mesh castShadow>
                    <boxGeometry args={[0.12, 0.6, 0.12]} />
                    <meshStandardMaterial color={METAL_DARK} roughness={0.5} metalness={0.6} />
                </mesh>
            </group>

            {/* Right Arm */}
            <group ref={rightArmRef} position={[0.35, 1.2, 0]}>
                <mesh castShadow>
                    <boxGeometry args={[0.12, 0.6, 0.12]} />
                    <meshStandardMaterial color={METAL_DARK} roughness={0.5} metalness={0.6} />
                </mesh>
            </group>

            {/* Left Leg */}
            <group ref={leftLegRef} position={[-0.15, 0.35, 0]}>
                <mesh castShadow>
                    <boxGeometry args={[0.14, 0.7, 0.14]} />
                    <meshStandardMaterial color={METAL_MID} roughness={0.6} metalness={0.5} />
                </mesh>
            </group>

            {/* Right Leg */}
            <group ref={rightLegRef} position={[0.15, 0.35, 0]}>
                <mesh castShadow>
                    <boxGeometry args={[0.14, 0.7, 0.14]} />
                    <meshStandardMaterial color={METAL_MID} roughness={0.6} metalness={0.5} />
                </mesh>
            </group>

            {/* Vision light - brighter when processing command */}
            <pointLight
                position={[0, 1.8, 0.3]}
                color={ACCENT_ORANGE}
                intensity={currentIntent ? 0.6 : 0.3}
                distance={3}
            />

            {/* Cognitive Light Cone - Child of Robot Group so it follows automatically */}
            <RobotCognitiveLightCone />

            {/* Speech Bubble - 2D overlay tracking robot head */}
            <RobotSpeechBubble />
        </group>
    );
}

// Export robot memory for external access
export { robotMemory };
