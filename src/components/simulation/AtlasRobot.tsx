'use client';

import { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSimulationStore, RobotIntent } from '@/lib/simulationStore';
import { buildGrid, astar, isClimbableWaypoint, PathGrid } from '@/lib/pathfinder';
import { getTerrainHeight } from '@/components/simulation/Terrain';
import { ObjectMemoryManager } from '@/lib/objectMemory';
import { TemporalExperienceManager } from '@/lib/temporalExperience';
import { RobotCognitiveLightCone } from './RobotCognitiveCone';
import { RobotSpeechBubble } from './RobotSpeechBubble';

const METAL_DARK = '#1a1a2e';
const METAL_MID = '#2a2a40';
const ACCENT_ORANGE = '#ff6600';

// Robot's own memory instance
const robotMemory = new ObjectMemoryManager();

// Feature flag to disable temporal system if causing issues
const ENABLE_TEMPORAL = true;

// Robot's temporal experience manager
let temporalManager: TemporalExperienceManager | null = null;
if (ENABLE_TEMPORAL) {
    temporalManager = new TemporalExperienceManager({
        baseCompressionRatio: 1.0,
        tokenBudgetPerSecond: 100,
        memoryConsolidationInterval: 5.0,
        maxMemoryEntries: 50,
    });
}

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
    const processingVision = useRef(false);

    // A* state
    const pathGrid = useRef<PathGrid | null>(null);
    const prevColLen = useRef<number>(0);          // rebuild when collider count changes
    // Waypoints live in the store; we mirror the current index here for frame efficiency
    const waypointIdx = useRef<number>(0);
    const waypointList = useRef<import('@/lib/simulationStore').Vec3[]>([]);
    // Fetch FSM: 'idle' | 'toToy' | 'toUser'
    const fetchPhase = useRef<'idle' | 'toToy' | 'toUser'>('idle');
    const fetchToyId = useRef<string | null>(null);
    // Stuck detection for fetch
    const stuckTimer = useRef<number>(0);
    const stuckPos = useRef<{ x: number; z: number }>({ x: 0, z: 0 });
    const fetchFailureReported = useRef<boolean>(false);

    // Jump flag (set by waypoint follower when crossing a log)
    const shouldJump = useRef(false);

    const environment = useSimulationStore(s => s.environment);
    const colliders = useSimulationStore(s => s.colliders);
    const currentIntent = useSimulationStore(s => s.robot.currentIntent);
    const isSitting = useSimulationStore(s => s.robot.isSitting);
    const sittingPosition = useSimulationStore(s => s.robot.sittingPosition);

    const { scene, gl } = useThree();
    const {
        setRobotSitting,
        clearRobotIntent,
        completeIntent,
        updateNearbyObjects,
        addSensoryInput,
        setRobotTemporalMetrics,
        triggerInteraction,
        addChatMessage,
        setCarriedObject,
        setWaypoints,
        advanceWaypoint,
        removeCollider,
    } = useSimulationStore();

    const compressionRatio = useSimulationStore(s => s.robot.temporalMetrics?.compressionRatio ?? 1);
    const simTime = useRef(0);
    const metricsUpdateCounter = useRef(0);
    const scanCounter = useRef(0);
    const prevNearbyRef = useRef<string[]>([]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (useSimulationStore.getState().isChatOpen) return;
            const key = e.key.toLowerCase();
            if (['i', 'j', 'k', 'l', 'u', 'o', 'y', 'h', 'n', 'm'].includes(key)) keys.current.add(key);
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            if (['i', 'j', 'k', 'l', 'u', 'o', 'y', 'h', 'n', 'm'].includes(key)) keys.current.delete(key);
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

    // ─── A* grid rebuild ──────────────────────────────────────────────────────
    // Rebuilds the navigation grid whenever the collider set changes.
    const ensureGrid = () => {
        const state = useSimulationStore.getState();
        if (pathGrid.current && state.colliders.length === prevColLen.current) return pathGrid.current;
        prevColLen.current = state.colliders.length;
        pathGrid.current = buildGrid(state.colliders, state.environment.terrain.size);
        return pathGrid.current;
    };

    // ─── Plan a path and store waypoints ─────────────────────────────────────
    const planPath = (toX: number, toZ: number) => {
        const grid = ensureGrid();
        const from = { x: position.current.x, y: 0, z: position.current.z };
        const to = { x: toX, y: 0, z: toZ };
        const waypts = astar(grid, from, to);
        waypointList.current = waypts;
        waypointIdx.current = 0;
        setWaypoints(waypts);
    };

    // ─── Waypoint follower ────────────────────────────────────────────────────
    // Called each frame from intent handlers that use A* navigation.
    // Returns { dx, dz } to pass to the physics movement system.
    const followWaypoints = (): { dx: number; dz: number; done: boolean } => {
        const waypts = waypointList.current;
        if (waypts.length === 0) return { dx: 0, dz: 0, done: true };

        const idx = waypointIdx.current;
        if (idx >= waypts.length) return { dx: 0, dz: 0, done: true };

        const wp = waypts[idx];
        const rx = wp.x - position.current.x;
        const rz = wp.z - position.current.z;
        const dist = Math.sqrt(rx * rx + rz * rz);

        if (dist < 0.85) {
            // Reached this waypoint — check for log jump before advancing
            const grid = pathGrid.current;
            if (grid && isClimbableWaypoint(wp, grid) && isGrounded.current) {
                shouldJump.current = true;
            }
            waypointIdx.current = idx + 1;
            advanceWaypoint();
            if (waypointIdx.current >= waypts.length) return { dx: 0, dz: 0, done: true };
        }

        // Steer toward current waypoint
        if (groupRef.current && dist > 0.01) {
            const angle = Math.atan2(rx, rz);
            let angDiff = angle - groupRef.current.rotation.y;
            while (angDiff > Math.PI) angDiff -= 2 * Math.PI;
            while (angDiff < -Math.PI) angDiff += 2 * Math.PI;
            groupRef.current.rotation.y += angDiff * 10 * 0.016;
        }

        return dist > 0.01 ? { dx: rx / dist, dz: rz / dist, done: false } : { dx: 0, dz: 0, done: false };
    };

    const captureVisualInput = () => {
        try {
            return gl.domElement.toDataURL('image/jpeg', 0.5);
        } catch (e) {
            console.error("Failed to capture visual input", e);
            return null;
        }
    };

    useFrame((state, delta) => {
        if (!groupRef.current) return;

        const safeDelta = Math.min(delta, 0.1);
        const currentCompression = useSimulationStore.getState().robot.temporalMetrics?.compressionRatio ?? 1;
        const dt = safeDelta * currentCompression;
        simTime.current += dt;

        const GRAVITY = 20;
        const JUMP_FORCE = 8;
        const speed = 4;
        const turnSpeed = 2.5;

        // 1. Sitting Check & Stand Up Logic
        if (isSitting && sittingPosition) {
            // Check if robot needs to stand up to fulfill an intent
            if (currentIntent && !currentIntent.completed) {
                const needsMobility = ['move', 'turn', 'interact'].includes(currentIntent.type) && currentIntent.action !== 'sit';
                if (needsMobility) {
                    setRobotSitting(false);
                }
            }

            const sitPos = sittingPosition;
            groupRef.current.position.set(sitPos.x, sitPos.y + 0.5, sitPos.z);
            position.current.copy(groupRef.current.position);

            const sittingRotation = useSimulationStore.getState().robot.sittingRotation;
            if (sittingRotation !== undefined) {
                groupRef.current.rotation.y = sittingRotation;
            }

            vy.current = 0;
            isGrounded.current = true;
            return;
        }

        // 2. Intent Execution Pre-calc
        let dx = 0;
        let dz = 0;
        let shouldTurn = false;
        let turnDirection = 0;
        let jump = false;

        // Intent Queue Pulse
        if (currentIntent && !currentIntent.completed && intentStartTime.current === 0) {
            intentStartTime.current = Date.now();
        }
        if (!currentIntent && useSimulationStore.getState().robot.intentQueue.length > 0) {
            useSimulationStore.getState().processNextIntent();
        }

        // Processing Intents
        if (currentIntent && !currentIntent.completed) {
            const elapsed = (Date.now() - intentStartTime.current) / 1000;

            switch (currentIntent.type) {
                case 'move':
                    if (currentIntent.action === 'forward') dz = -1;
                    else if (currentIntent.action === 'backward') dz = 1;
                    else if (currentIntent.action === 'strafe-left') dx = -1;
                    else if (currentIntent.action === 'strafe-right') dx = 1;
                    else if (currentIntent.action === 'jump') { if (elapsed < 0.1 && isGrounded.current) jump = true; }

                    if (elapsed > (currentIntent.duration || 2)) {
                        clearRobotIntent();
                        intentStartTime.current = 0;
                    }
                    break;

                case 'turn':
                    shouldTurn = true;
                    if (currentIntent.action === 'face-user') {
                        const userState = useSimulationStore.getState().user;
                        if (userState.position) {
                            const angle = Math.atan2(userState.position.x - position.current.x, userState.position.z - position.current.z);
                            let angDiff = angle - groupRef.current.rotation.y;
                            while (angDiff > Math.PI) angDiff -= 2 * Math.PI;
                            while (angDiff < -Math.PI) angDiff += 2 * Math.PI;
                            turnDirection = angDiff > 0 ? 1 : -1;
                            if (Math.abs(angDiff) < 0.1) {
                                clearRobotIntent();
                                intentStartTime.current = 0;
                            }
                        } else clearRobotIntent();
                    } else {
                        turnDirection = currentIntent.action === 'left' ? 1 : -1;
                        if (elapsed > 0.5) { clearRobotIntent(); intentStartTime.current = 0; }
                    }
                    break;

                case 'stop':
                    clearRobotIntent();
                    intentStartTime.current = 0;
                    break;

                case 'interact':
                    if (currentIntent.action === 'sit') {
                        // Find best chair (not occupied by user)
                        const targets = colliders.filter(c => c.type === 'chair' || (c.interactable && c.metadata?.action === 'sit'));
                        if (targets.length > 0) {
                            const userState = useSimulationStore.getState().user;
                            let target = targets[0];
                            if (userState.isSitting && userState.sittingPosition && targets.length > 1) {
                                const userPosV3 = new THREE.Vector3(userState.sittingPosition.x, userState.sittingPosition.y, userState.sittingPosition.z);
                                const occupied = targets.find(c => new THREE.Vector3(c.position.x, c.position.y, c.position.z).distanceTo(userPosV3) < 1.0);
                                if (occupied) target = targets.find(c => c.id !== occupied.id) || target;
                            }

                            const distToChair = new THREE.Vector3(target.position.x, target.position.y, target.position.z).distanceTo(position.current);

                            if (distToChair < 1.8) {
                                // Close enough — sit down
                                setRobotSitting(true, { x: target.position.x, y: target.position.y - 0.5, z: target.position.z });
                                clearRobotIntent();
                                intentStartTime.current = 0;
                                waypointList.current = [];
                            } else {
                                // Plan A* path on first frame
                                if (elapsed < 0.05) planPath(target.position.x, target.position.z);
                                const nav = followWaypoints();
                                dx = nav.dx; dz = nav.dz;
                                if (elapsed > 20) { clearRobotIntent(); intentStartTime.current = 0; }
                            }
                        } else { clearRobotIntent(); intentStartTime.current = 0; }

                    } else if (currentIntent.action === 'stand') {
                        setRobotSitting(false);
                        clearRobotIntent();
                        intentStartTime.current = 0;

                    } else if (currentIntent.action === 'follow') {
                        const userState = useSimulationStore.getState().user;
                        if (userState.position) {
                            const distToUser = Math.sqrt(
                                Math.pow(userState.position.x - position.current.x, 2) +
                                Math.pow(userState.position.z - position.current.z, 2)
                            );
                            if (distToUser < 2.0) {
                                if (groupRef.current) {
                                    const ux = userState.position.x - position.current.x;
                                    const uz = userState.position.z - position.current.z;
                                    groupRef.current.rotation.y = Math.atan2(ux, uz);
                                }
                                completeIntent();
                                intentStartTime.current = 0;
                                waypointList.current = [];
                            } else {
                                // Replan every 2s as user moves
                                if (elapsed < 0.05 || Math.round(elapsed * 2) % 4 === 0) {
                                    planPath(userState.position.x, userState.position.z);
                                }
                                const nav = followWaypoints();
                                dx = nav.dx; dz = nav.dz;
                            }
                            if (elapsed > 15) { clearRobotIntent(); intentStartTime.current = 0; }
                        } else clearRobotIntent();

                    } else if (currentIntent.action === 'open' || currentIntent.action === 'close') {
                        const targets = colliders.filter(c => c.interactable && (c.type === 'door' || c.metadata?.action === currentIntent.action));
                        if (targets.length > 0) {
                            const target = targets.reduce((p, c) =>
                                new THREE.Vector3(p.position.x, p.position.y, p.position.z).distanceTo(position.current) <
                                    new THREE.Vector3(c.position.x, c.position.y, c.position.z).distanceTo(position.current) ? p : c
                            );
                            const dist = new THREE.Vector3(target.position.x, target.position.y, target.position.z).distanceTo(position.current);
                            if (dist < 3.0) {
                                triggerInteraction(target.id, currentIntent.action);
                                if (groupRef.current) {
                                    groupRef.current.rotation.y = Math.atan2(
                                        target.position.x - position.current.x,
                                        target.position.z - position.current.z
                                    );
                                }
                                clearRobotIntent();
                                intentStartTime.current = 0;
                                waypointList.current = [];
                            } else {
                                if (elapsed < 0.05) planPath(target.position.x, target.position.z);
                                const nav = followWaypoints();
                                dx = nav.dx; dz = nav.dz;
                                if (elapsed > 10) { clearRobotIntent(); intentStartTime.current = 0; }
                            }
                        } else { clearRobotIntent(); intentStartTime.current = 0; }

                    } else { clearRobotIntent(); intentStartTime.current = 0; }
                    break;

                case 'fetch': {
                    const objName = (currentIntent.parameters?.objectName as string || '').toLowerCase();

                    // Resolve toy collider by name match
                    const toyCollider = colliders.find(c =>
                        c.type === 'toy' && c.metadata?.fetchable &&
                        `${c.metadata.colorName} ${c.metadata.shape}`.toLowerCase() === objName
                    );

                    // Helper: abort fetch with an in-character failure message
                    const abortFetch = (reason: string) => {
                        setCarriedObject(null);
                        fetchPhase.current = 'idle';
                        fetchToyId.current = null;
                        stuckTimer.current = 0;
                        fetchFailureReported.current = false;
                        waypointList.current = [];
                        clearRobotIntent();
                        intentStartTime.current = 0;
                        // Emit failure message so the collective is transparent
                        const failureMsg = `I tried to ${objName ? 'fetch the ' + objName : 'complete the task'}, but ${reason}. I'm sorry — I wasn't able to complete it. Can you help me or try again?`;
                        addChatMessage({ role: 'robot', text: failureMsg, nodeName: 'ATLAS', nodeAvatar: '◇', isRobotCommand: true });
                        useSimulationStore.getState().setRobotSpeech(
                            reason.includes('stuck') ? "I'm stuck — I can\'t reach it." : "Task failed.",
                            4000
                        );
                        // Ask the LLM to generate a transparent in-character failure response
                        const robotState = useSimulationStore.getState().robot;
                        fetch('/api/robot', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                type: 'task_failure',
                                message: `I tried to fetch the ${objName} for the user but failed because: ${reason}. Compose a brief, honest, in-character apology. Offer to try again or ask the user for help.`,
                                robotState: { position: robotState.position, rotation: robotState.rotation },
                            })
                        })
                            .then(res => res.json())
                            .then(data => {
                                if (data.response) {
                                    addChatMessage({ role: 'robot', text: data.response, nodeName: 'ATLAS', nodeAvatar: '◇', isRobotCommand: true });
                                    useSimulationStore.getState().setRobotSpeech(data.response, Math.max(4000, data.response.length * 80));
                                }
                            })
                            .catch(() => { });
                    };

                    if (!toyCollider && fetchPhase.current !== 'toUser') {
                        // Not found in current scene AND we haven't picked it up yet — abort.
                        // (When fetchPhase === 'toUser', the toy was intentionally removed from
                        //  colliders because Atlas is carrying it — do NOT abort in that case.)
                        if (!fetchFailureReported.current) {
                            fetchFailureReported.current = true;
                            abortFetch("I couldn't find that object in the environment");
                        } else {
                            clearRobotIntent(); intentStartTime.current = 0;
                        }
                        break;
                    }


                    if (fetchPhase.current === 'idle') {
                        // Phase 1: plan path to an approach position BESIDE the table
                        // (offset 2m from toy toward Atlas's current position to avoid table body)
                        fetchPhase.current = 'toToy';
                        fetchToyId.current = toyCollider.id;
                        stuckTimer.current = 0;
                        fetchFailureReported.current = false;
                        stuckPos.current = { x: position.current.x, z: position.current.z };

                        // Find approach point: step from toy outward toward Atlas until free
                        const toyX = toyCollider.position.x;
                        const toyZ = toyCollider.position.z;
                        const dirX = position.current.x - toyX;
                        const dirZ = position.current.z - toyZ;
                        const dirLen = Math.sqrt(dirX * dirX + dirZ * dirZ) || 1;
                        const approachX = toyX + (dirX / dirLen) * 2.0;
                        const approachZ = toyZ + (dirZ / dirLen) * 2.0;
                        planPath(approachX, approachZ);
                    }

                    if (fetchPhase.current === 'toToy') {
                        const distToToy = Math.sqrt(
                            Math.pow(toyCollider.position.x - position.current.x, 2) +
                            Math.pow(toyCollider.position.z - position.current.z, 2)
                        );

                        if (distToToy < 2.5) {
                            // Close enough to the table — pick up the toy
                            setCarriedObject(toyCollider.id);
                            removeCollider(toyCollider.id);
                            fetchPhase.current = 'toUser';
                            stuckTimer.current = 0;
                            // Plan path to user
                            const uState = useSimulationStore.getState().user;
                            planPath(uState.position?.x ?? 0, uState.position?.z ?? 0);
                        } else {
                            const nav = followWaypoints();
                            dx = nav.dx; dz = nav.dz;

                            // Stuck detection: measure displacement every second
                            stuckTimer.current += safeDelta;
                            if (stuckTimer.current > 5.0) {
                                stuckTimer.current = 0;
                                const moved = Math.sqrt(
                                    Math.pow(position.current.x - stuckPos.current.x, 2) +
                                    Math.pow(position.current.z - stuckPos.current.z, 2)
                                );
                                if (moved < 0.5 && !fetchFailureReported.current) {
                                    fetchFailureReported.current = true;
                                    abortFetch('I got stuck and couldn\'t reach the pickup point');
                                    break;
                                }
                                stuckPos.current = { x: position.current.x, z: position.current.z };
                            }
                        }
                    }

                    if (fetchPhase.current === 'toUser') {
                        const uState = useSimulationStore.getState().user;
                        const distToUser = uState.position
                            ? Math.sqrt(
                                Math.pow(uState.position.x - position.current.x, 2) +
                                Math.pow(uState.position.z - position.current.z, 2)
                            )
                            : 999;

                        if (distToUser < 2.0) {
                            // Drop — re-add collider at current feet position
                            const cid = fetchToyId.current || 'toy-unknown';
                            const orig = cid.replace('toy-', '');
                            const shape = orig === 'sphere' ? 'sphere' : orig === 'cube' ? 'cube' : 'pyramid';
                            const colorMap: Record<string, { color: string; colorName: string }> = {
                                sphere: { color: '#ef4444', colorName: 'red' },
                                cube: { color: '#3b82f6', colorName: 'blue' },
                                pyramid: { color: '#eab308', colorName: 'yellow' },
                            };
                            const cm = colorMap[shape] || { color: '#ffffff', colorName: 'white' };
                            useSimulationStore.getState().addCollider({
                                id: cid,
                                type: 'toy',
                                position: { x: position.current.x + 0.5, y: position.current.y, z: position.current.z + 0.5 },
                                size: { x: 0.4, y: 0.4, z: 0.4 },
                                interactable: true,
                                climbable: false,
                                metadata: { displayName: `${cm.colorName} ${shape}`, action: 'fetch', fetchable: true, shape: shape as 'sphere' | 'cube' | 'pyramid', color: cm.color, colorName: cm.colorName },
                            });
                            setCarriedObject(null);
                            fetchPhase.current = 'idle';
                            fetchToyId.current = null;
                            fetchFailureReported.current = false;
                            waypointList.current = [];
                            clearRobotIntent();
                            intentStartTime.current = 0;
                        } else {
                            // Replan if user moved
                            if (Math.round(elapsed * 2) % 4 === 0 && uState.position) {
                                planPath(uState.position.x, uState.position.z);
                            }
                            const nav = followWaypoints();
                            dx = nav.dx; dz = nav.dz;
                        }
                    }

                    if (elapsed > 40 && !fetchFailureReported.current) {
                        abortFetch('the task timed out after 40 seconds');
                    }
                    break;
                }

                case 'query':
                    if (currentIntent.action === 'vision' && !processingVision.current) {
                        processingVision.current = true;
                        const useMultimodal = currentIntent.parameters?.fidelity === 'high' || currentIntent.parameters?.useVision === true;
                        const image = useMultimodal ? captureVisualInput() : null;
                        const robotState = useSimulationStore.getState().robot;
                        const userState = useSimulationStore.getState().user;
                        const known = Object.values(robotState.knownObjects || {}).map(k => `${k.type} (last seen ${(Date.now() - k.lastSeen) / 1000}s ago)`).join(', ') || 'nothing yet';

                        fetch('/api/robot', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                type: 'analysis',
                                message: `describe surroundings. Known memory: ${known}`,
                                robotState: { ...robotState },
                                userState,
                                image
                            })
                        })
                            .then(res => res.json())
                            .then(data => {
                                const text = data.response || 'I perceive... nothing.';
                                const duration = Math.max(4000, text.length * 80);
                                const uState = useSimulationStore.getState().user;
                                const distToUser = uState.position
                                    ? new THREE.Vector3(uState.position.x, uState.position.y, uState.position.z).distanceTo(position.current)
                                    : 999;

                                if (distToUser > 12.0) {
                                    useSimulationStore.getState().setRobotSpeech('You are too far away.', 3000);
                                } else {
                                    if (groupRef.current && uState.position) {
                                        groupRef.current.rotation.y = Math.atan2(uState.position.x - position.current.x, uState.position.z - position.current.z);
                                    }
                                    useSimulationStore.getState().setRobotSpeech(text, duration);
                                    addChatMessage({ role: 'robot', text, nodeName: 'ATLAS', nodeAvatar: '◇', isRobotCommand: true });
                                }
                                setTimeout(() => { completeIntent(); intentStartTime.current = 0; processingVision.current = false; }, duration);
                            })
                            .catch(err => {
                                const errMsg = err instanceof Error ? err.message : String(err);
                                console.error('[Atlas Vision] Failed:', errMsg);
                                addChatMessage({ role: 'robot', text: `Vision error: ${errMsg}`, nodeName: 'ATLAS', nodeAvatar: '◇', isRobotCommand: true });
                                completeIntent();
                                intentStartTime.current = 0;
                                processingVision.current = false;
                            });
                    }
                    break;

                case 'chat':
                    const userState = useSimulationStore.getState().user;
                    groupRef.current.rotation.y = Math.atan2(userState.position.x - position.current.x, userState.position.z - position.current.z);
                    clearRobotIntent();
                    intentStartTime.current = 0;
                    break;

                default:
                    clearRobotIntent();
                    intentStartTime.current = 0;
                    break;
            }
        } else {
            // Manual Controls
            if (keys.current.has('i')) dz -= 1;
            if (keys.current.has('k')) dz += 1;
            if (keys.current.has('u')) dx -= 1;
            if (keys.current.has('o')) dx += 1;
            if (keys.current.has('j')) { shouldTurn = true; turnDirection = 1; }
            if (keys.current.has('l')) { shouldTurn = true; turnDirection = -1; }
        }

        if (shouldTurn) groupRef.current.rotation.y += turnSpeed * dt * turnDirection;

        // 3. Physics & Collisions
        if (jump && isGrounded.current) { vy.current = JUMP_FORCE; isGrounded.current = false; }
        vy.current -= GRAVITY * dt;

        let moveX = dx * speed * dt;
        let moveZ = dz * speed * dt;
        if (dx !== 0 && dz !== 0) { moveX *= 0.707; moveZ *= 0.707; }

        const nextX = position.current.x + moveX;
        const nextZ = position.current.z + moveZ;
        const nextY = position.current.y + vy.current * dt;

        const terrainY = getTerrainHeight(nextX, nextZ, environment.terrain.seed, environment.terrain.heightScale);
        let groundHeight = terrainY;
        let blocked = false;

        // Trigger jump if waypoint follower flagged a climbable cell
        if (shouldJump.current && isGrounded.current) {
            vy.current = 9;
            isGrounded.current = false;
            shouldJump.current = false;
        }

        for (const collider of colliders) {
            const hX = collider.size.x / 2;
            const hZ = collider.size.z / 2;
            const hY = collider.size.y / 2;
            const isOpen = collider.type === 'door' && collider.metadata?.state === 'open';

            if (!isOpen && Math.abs(nextX - collider.position.x) < hX + 0.5 && Math.abs(nextZ - collider.position.z) < hZ + 0.5) {
                const top = collider.position.y + hY;
                const diff = top - position.current.y;
                if (diff > -0.1 && diff < 0.6 && (collider.climbable || collider.type === 'log')) {
                    // Step up
                } else if (position.current.y < top - 0.2) {
                    blocked = true;
                }
            }
            if (Math.abs(nextX - collider.position.x) < hX && Math.abs(nextZ - collider.position.z) < hZ) {
                if (position.current.y >= collider.position.y + hY - 0.5 && (collider.climbable || collider.type === 'log')) {
                    groundHeight = Math.max(groundHeight, collider.position.y + hY);
                }
            }
        }

        if (nextY <= groundHeight) { position.current.y = groundHeight; vy.current = 0; isGrounded.current = true; }
        else { position.current.y = nextY; isGrounded.current = false; }
        if (!blocked) { position.current.x = nextX; position.current.z = nextZ; }
        groupRef.current.position.copy(position.current);

        // 4. Animation
        const isMoving = dx !== 0 || dz !== 0;
        const t = simTime.current;
        if (isMoving) {
            if (leftLegRef.current) leftLegRef.current.rotation.x = Math.sin(t * 6) * 0.4;
            if (rightLegRef.current) rightLegRef.current.rotation.x = Math.sin(t * 6 + Math.PI) * 0.4;
            if (leftArmRef.current) leftArmRef.current.rotation.x = Math.sin(t * 6 + Math.PI) * 0.25;
            if (rightArmRef.current) rightArmRef.current.rotation.x = Math.sin(t * 6) * 0.25;
        } else {
            if (leftLegRef.current) leftLegRef.current.rotation.x = 0;
            if (rightLegRef.current) rightLegRef.current.rotation.x = 0;
            if (leftArmRef.current) { leftArmRef.current.rotation.x = 0; leftArmRef.current.rotation.z = 0.1; }
            if (rightArmRef.current) { rightArmRef.current.rotation.x = 0; rightArmRef.current.rotation.z = -0.1; }
        }

        // 5. Optimized Sensory Scanning
        scanCounter.current++;
        if (scanCounter.current % 30 === 0) {
            const visionRange = 60;
            const visionRangeSq = visionRange * visionRange;
            const visionAngle = 60;
            const nearby: string[] = [];

            for (const collider of colliders) {
                const cx = collider.position.x - position.current.x;
                const cz = collider.position.z - position.current.z;
                const dSq = cx * cx + cz * cz;
                if (dSq > visionRangeSq) continue;

                const local = new THREE.Vector3(cx, 0, cz).applyAxisAngle(new THREE.Vector3(0, 1, 0), -groupRef.current.rotation.y);
                const angle = Math.abs(Math.atan2(local.x, local.z));
                if (angle < (visionAngle * Math.PI) / 360) {
                    const isUser = collider.id === 'user-avatar' || collider.id.includes('user');
                    const dist = Math.sqrt(dSq);
                    const label = isUser ? `👤 Corto (${dist.toFixed(1)}m)` : `${collider.metadata?.displayName || collider.type} (${dist.toFixed(1)}m)`;
                    nearby.push(label);

                    // Memory & Permanence
                    const robotState = useSimulationStore.getState().robot;
                    if (!robotState.knownObjects[collider.id] || Date.now() - robotState.knownObjects[collider.id].lastSeen > 1000) {
                        robotState.registerObject(collider.id, collider.type, collider.position);
                        if (!robotState.knownObjects[collider.id]) console.log(`[Atlas] Noticed ${collider.type}`);
                    }
                    addSensoryInput({ type: 'vision', sourceId: collider.id, sourceType: collider.type, position: collider.position, intensity: 1.0 - (dist / visionRange), timestamp: Date.now() });
                }
            }

            // Explicit User Check (if not in colliders)
            const uState = useSimulationStore.getState().user;
            if (uState.position && !nearby.some(n => n.includes('Corto'))) {
                const ux = uState.position.x - position.current.x;
                const uz = uState.position.z - position.current.z;
                const udSq = ux * ux + uz * uz;
                if (udSq < visionRangeSq) {
                    const uLocal = new THREE.Vector3(ux, 0, uz).applyAxisAngle(new THREE.Vector3(0, 1, 0), -groupRef.current.rotation.y);
                    if (Math.abs(Math.atan2(uLocal.x, uLocal.z)) < (visionAngle * Math.PI) / 360) {
                        nearby.push(`👤 Corto (${Math.sqrt(udSq).toFixed(1)}m)`);
                    }
                }
            }

            const currentNearbyStr = [...new Set(nearby)].sort().join(',');
            const prevNearbyStr = prevNearbyRef.current.sort().join(',');
            if (currentNearbyStr !== prevNearbyStr) {
                updateNearbyObjects(nearby);
                prevNearbyRef.current = nearby;
            }
        }

        // 6. Temporal Logic
        if (temporalManager) {
            temporalManager.setCompressionRatio(compressionRatio);
            temporalManager.tick(safeDelta, robotMemory);
            metricsUpdateCounter.current++;
            if (metricsUpdateCounter.current >= 30) {
                metricsUpdateCounter.current = 0;
                setRobotTemporalMetrics(temporalManager.getMetrics());
            }
        }
    });

    const carriedId = useSimulationStore(s => s.robot.carriedObjectId);
    const carriedCollider = useSimulationStore(s => s.colliders.find(c => c.id === carriedId));
    // We need the original toy data even after it's removed from colliders,
    // so look it up from a small static map
    const toyDataMap: Record<string, { shape: string; color: string }> = {
        'toy-sphere': { shape: 'sphere', color: '#ef4444' },
        'toy-cube': { shape: 'cube', color: '#3b82f6' },
        'toy-pyramid': { shape: 'pyramid', color: '#eab308' },
    };
    const toyData = carriedId ? toyDataMap[carriedId] : null;

    return (
        <group ref={groupRef} name="atlasRobot">
            {/* Head */}
            <mesh position={[0, 1.8, 0]} castShadow>
                <boxGeometry args={[0.3, 0.3, 0.3]} />
                <meshStandardMaterial color={METAL_MID} roughness={0.3} metalness={0.8} />
            </mesh>
            {/* Eye visor */}
            <mesh position={[0, 1.8, 0.16]}>
                <planeGeometry args={[0.2, 0.06]} />
                <meshStandardMaterial color={ACCENT_ORANGE} emissive={ACCENT_ORANGE} emissiveIntensity={currentIntent ? 1.2 : 0.8} />
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

            {/* Joint spheres: shoulders & hips */}
            {([-0.3, 0.3] as number[]).map((sx, i) => (
                <mesh key={`sh${i}`} position={[sx, 1.48, 0]}>
                    <sphereGeometry args={[0.1, 8, 8]} />
                    <meshStandardMaterial color={METAL_MID} roughness={0.3} metalness={0.7} />
                </mesh>
            ))}
            {([-0.15, 0.15] as number[]).map((hx, i) => (
                <mesh key={`hp${i}`} position={[hx, 0.72, 0]}>
                    <sphereGeometry args={[0.09, 8, 8]} />
                    <meshStandardMaterial color={METAL_MID} roughness={0.4} metalness={0.6} />
                </mesh>
            ))}

            {/* Left arm — keep pivot at shoulder */}
            <group ref={leftArmRef} position={[-0.35, 1.2, 0]}>
                <mesh castShadow><boxGeometry args={[0.12, 0.6, 0.12]} /><meshStandardMaterial color={METAL_DARK} /></mesh>
                {/* Elbow sphere */}
                <mesh position={[0, -0.3, 0]}>
                    <sphereGeometry args={[0.08, 7, 7]} />
                    <meshStandardMaterial color={METAL_DARK} roughness={0.3} metalness={0.8} />
                </mesh>
            </group>

            {/* Right arm — carries item at hand position */}
            <group ref={rightArmRef} position={[0.35, 1.2, 0]}>
                <mesh castShadow><boxGeometry args={[0.12, 0.6, 0.12]} /><meshStandardMaterial color={METAL_DARK} /></mesh>
                {/* Elbow sphere */}
                <mesh position={[0, -0.3, 0]}>
                    <sphereGeometry args={[0.08, 7, 7]} />
                    <meshStandardMaterial color={METAL_DARK} roughness={0.3} metalness={0.8} />
                </mesh>
                {/* Carried item in hand (shown when Atlas carries something) */}
                {toyData && (
                    <group position={[0.05, -0.38, 0.1]}>
                        {toyData.shape === 'sphere' && (
                            <mesh>
                                <sphereGeometry args={[0.14, 10, 10]} />
                                <meshStandardMaterial color={toyData.color} roughness={0.4} metalness={0.1} />
                            </mesh>
                        )}
                        {toyData.shape === 'cube' && (
                            <mesh>
                                <boxGeometry args={[0.22, 0.22, 0.22]} />
                                <meshStandardMaterial color={toyData.color} roughness={0.5} />
                            </mesh>
                        )}
                        {toyData.shape === 'pyramid' && (
                            <mesh>
                                <coneGeometry args={[0.13, 0.26, 4]} />
                                <meshStandardMaterial color={toyData.color} roughness={0.45} />
                            </mesh>
                        )}
                    </group>
                )}
            </group>

            {/* Left leg */}
            <group ref={leftLegRef} position={[-0.15, 0.35, 0]}>
                <mesh castShadow><boxGeometry args={[0.14, 0.7, 0.14]} /><meshStandardMaterial color={METAL_MID} /></mesh>
                {/* Knee sphere */}
                <mesh position={[0, -0.32, 0]}>
                    <sphereGeometry args={[0.08, 7, 7]} />
                    <meshStandardMaterial color={METAL_MID} roughness={0.4} metalness={0.6} />
                </mesh>
            </group>
            {/* Right leg */}
            <group ref={rightLegRef} position={[0.15, 0.35, 0]}>
                <mesh castShadow><boxGeometry args={[0.14, 0.7, 0.14]} /><meshStandardMaterial color={METAL_MID} /></mesh>
                {/* Knee sphere */}
                <mesh position={[0, -0.32, 0]}>
                    <sphereGeometry args={[0.08, 7, 7]} />
                    <meshStandardMaterial color={METAL_MID} roughness={0.4} metalness={0.6} />
                </mesh>
            </group>
            <pointLight position={[0, 1.8, 0.3]} color={ACCENT_ORANGE} intensity={currentIntent ? 0.6 : 0.3} distance={3} />
            <RobotCognitiveLightCone />
            <RobotSpeechBubble />
        </group>
    );
}

export { robotMemory };
