'use client';

import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSimulationStore } from '@/lib/simulationStore';
import { useGameStore } from '@/lib/gameStore';
import Terrain, { getTerrainHeight } from '@/components/simulation/Terrain';
import PlayerAvatar from './PlayerAvatar';
import ZombieEntity from './ZombieEntity';
import ZombieWaveManager from './ZombieWaveManager';
import CaveSpawner from './CaveSpawner';
import ProjectileSystem from './ProjectileSystem';

// Shared camera lock state (read by HUD)
export const cameraState = {
    locked: true,
};

// === Third-person camera ===
function GameCamera() {
    const cameraDistance = useRef(8);
    // Vertical angle – start slightly elevated for a genuine "behind and above" view
    const cameraAngleV = useRef(0.38);
    // Horizontal offset from directly-behind-player (0 = centred behind)
    const cameraRelativeH = useRef(0);
    // When unlocked (C key), this holds the last computed world yaw so the
    // camera stays frozen in that orientation as the player turns.
    const absoluteWorldYaw = useRef(Math.PI);
    const locked = useRef(true);
    const isDragging = useRef(false);
    const lastMouse = useRef({ x: 0, y: 0 });
    // Flag set on C press; synced in useFrame where we have avatar access
    const needsYawSync = useRef(false);

    useEffect(() => {
        const onDown = (e: MouseEvent) => {
            isDragging.current = true;
            lastMouse.current = { x: e.clientX, y: e.clientY };
        };
        const onUp = () => { isDragging.current = false; };
        const onMove = (e: MouseEvent) => {
            if (!isDragging.current) return;
            const dx = e.clientX - lastMouse.current.x;
            const dy = e.clientY - lastMouse.current.y;
            if (locked.current) {
                // Dragging shifts relative-to-player angle
                cameraRelativeH.current -= dx * 0.005;
            } else {
                // Dragging shifts absolute world angle
                absoluteWorldYaw.current -= dx * 0.005;
            }
            cameraAngleV.current = THREE.MathUtils.clamp(
                cameraAngleV.current + dy * 0.005, -0.1, 1.3
            );
            lastMouse.current = { x: e.clientX, y: e.clientY };
        };
        const onWheel = (e: WheelEvent) => {
            cameraDistance.current = THREE.MathUtils.clamp(
                cameraDistance.current + e.deltaY * 0.01, 3, 18
            );
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() !== 'c') return;
            // Toggle; useFrame will sync absoluteWorldYaw from current player yaw
            locked.current = !locked.current;
            cameraState.locked = locked.current;
            needsYawSync.current = true;
        };

        window.addEventListener('mousedown', onDown);
        window.addEventListener('mouseup', onUp);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('wheel', onWheel);
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('mousedown', onDown);
            window.removeEventListener('mouseup', onUp);
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('wheel', onWheel);
            window.removeEventListener('keydown', onKey);
        };
    }, []);

    useFrame((state) => {
        const avatar = state.scene.getObjectByName('playerAvatar');
        if (!avatar) return;

        const avatarPos = avatar.position;
        const playerYaw = (avatar as THREE.Group).rotation.y;

        // On toggle: sync absoluteWorldYaw so camera doesn't jump
        if (needsYawSync.current) {
            needsYawSync.current = false;
            // Current effective world yaw before toggle
            absoluteWorldYaw.current = playerYaw + Math.PI + cameraRelativeH.current;
        }

        // Compute effective world yaw
        // π offset: zero relative angle → directly BEHIND a player facing +Z
        const worldYaw = locked.current
            ? playerYaw + Math.PI + cameraRelativeH.current
            : absoluteWorldYaw.current;

        const dist = cameraDistance.current;
        const cosV = Math.cos(cameraAngleV.current);
        const sinV = Math.sin(cameraAngleV.current);

        const targetPos = new THREE.Vector3(
            avatarPos.x + Math.sin(worldYaw) * dist * cosV,
            avatarPos.y + 2.0 + sinV * dist,
            avatarPos.z + Math.cos(worldYaw) * dist * cosV,
        );

        // Strict follow — lerp closer to 1 = snappier
        state.camera.position.lerp(targetPos, 0.18);

        // Prevent clipping into terrain
        const env = useSimulationStore.getState().environment;
        const groundUnderCam = getTerrainHeight(
            state.camera.position.x, state.camera.position.z,
            env.terrain.seed, env.terrain.heightScale
        );
        if (state.camera.position.y < groundUnderCam + 0.6) {
            state.camera.position.y = groundUnderCam + 0.6;
        }

        state.camera.lookAt(new THREE.Vector3(avatarPos.x, avatarPos.y + 1.1, avatarPos.z));
    });

    return null;
}

// === Decorative trees near the map edges ===
function SceneryTrees() {
    const environment = useSimulationStore(s => s.environment);
    const trees = useRef([
        [8, -8], [20, 15], [-12, 20], [30, -20], [-25, -10],
        [15, 35], [-30, 30], [-40, -30], [35, 5], [-20, -40],
    ]);

    return (
        <>
            {trees.current.map(([tx, tz], i) => {
                const ty = getTerrainHeight(tx, tz, environment.terrain.seed, environment.terrain.heightScale);
                return (
                    <group key={i} position={[tx, ty, tz]}>
                        <mesh position={[0, 1.5, 0]} castShadow>
                            <cylinderGeometry args={[0.3, 0.45, 3, 7]} />
                            <meshStandardMaterial color="#2d1a08" roughness={0.95} />
                        </mesh>
                        <mesh position={[0, 3.8, 0]} castShadow>
                            <coneGeometry args={[2, 3.5, 8]} />
                            <meshStandardMaterial color="#1a3a10" roughness={0.8} />
                        </mesh>
                    </group>
                );
            })}
        </>
    );
}

// === Rocks scattered near cave ===
function SceneryRocks() {
    const environment = useSimulationStore(s => s.environment);
    const rocks = useRef([
        [-52, -48], [-58, -52], [-50, -58], [-45, -50],
        [-60, -45], [-55, -60], [-48, -55],
    ]);
    return (
        <>
            {rocks.current.map(([rx, rz], i) => {
                const ry = getTerrainHeight(rx, rz, environment.terrain.seed, environment.terrain.heightScale);
                const s = 0.5 + Math.sin(i * 3.7) * 0.3;
                return (
                    <mesh key={i} position={[rx, ry + s * 0.5, rz]} castShadow>
                        <dodecahedronGeometry args={[s, 0]} />
                        <meshStandardMaterial color="#444444" roughness={0.95} />
                    </mesh>
                );
            })}
        </>
    );
}

export default function GameScene() {
    const zombies = useGameStore(s => s.zombies);

    return (
        <group>
            {/* Lighting — darker/eerie atmosphere */}
            <ambientLight intensity={0.25} color="#334466" />
            <directionalLight
                position={[40, 70, 30]}
                intensity={0.9}
                color="#fff5e0"
                castShadow
                shadow-mapSize={[1024, 1024]}
            />
            {/* Moonlight fill from opposite */}
            <directionalLight
                position={[-30, 40, -40]}
                intensity={0.25}
                color="#aabbff"
            />

            {/* Terrain */}
            <Terrain />

            {/* Scenery */}
            <SceneryTrees />
            <SceneryRocks />

            {/* Cave */}
            <CaveSpawner />

            {/* Player */}
            <PlayerAvatar />

            {/* Zombies */}
            {zombies.map(zombie => (
                <ZombieEntity key={zombie.id} zombie={zombie} />
            ))}

            {/* Wave Management (logic only) */}
            <ZombieWaveManager />

            {/* Projectiles */}
            <ProjectileSystem />

            {/* Camera */}
            <GameCamera />

            {/* === Atlas Robot Player — RESERVED (not yet added) ===
            // Compatible with the collective's intent queue system.
            // Team health bar hook: useGameStore.getState().atlasHp
            // Targeting: shares zombies array, separate teammate aggro.
            //
            // <AtlasRobotPlayer />
            */}
        </group>
    );
}
