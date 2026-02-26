'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore, WEAPON_DAMAGE, WEAPON_COOLDOWN, SPELL_BASE_DAMAGE, SPELL_COOLDOWN_BASE, SPELL_DAMAGE_PER_TIER, SpellType, WeaponType } from '@/lib/gameStore';
import { useSimulationStore } from '@/lib/simulationStore';
import { getTerrainHeight } from '@/components/simulation/Terrain';

export const playerWorldPosition = { x: 0, y: 0, z: 0 };

const PLATE = { color: '#4a5568', metalness: 0.9, roughness: 0.25 } as const;
const PLATE_D = { color: '#2d3748', metalness: 0.85, roughness: 0.3 } as const;
const GOLD = { color: '#c8a000', metalness: 0.9, roughness: 0.15 } as const;
const TALON = { color: '#1a1a1a', metalness: 0.6, roughness: 0.7 } as const;

export default function PlayerAvatar() {
    const groupRef = useRef<THREE.Group>(null);
    const torsoRef = useRef<THREE.Group>(null);
    const leftArmRef = useRef<THREE.Group>(null);
    const rightArmRef = useRef<THREE.Group>(null);
    const leftThighRef = useRef<THREE.Group>(null);
    const rightThighRef = useRef<THREE.Group>(null);
    const leftShinRef = useRef<THREE.Group>(null);
    const rightShinRef = useRef<THREE.Group>(null);

    const keys = useRef<Set<string>>(new Set());
    const position = useRef(new THREE.Vector3(0, 0, 0));
    const velocity = useRef(new THREE.Vector3());
    const isGrounded = useRef(true);
    const attackCooldown = useRef(0);
    const isAttacking = useRef(false);
    const attackTimer = useRef(0);
    const isMoving = useRef(false);
    const landTimer = useRef(0);

    const setBlocking = useGameStore(s => s.setBlocking);
    const setSpellCooldown = useGameStore(s => s.setSpellCooldown);
    const addProjectile = useGameStore(s => s.addProjectile);
    const tickSpellCooldowns = useGameStore(s => s.tickSpellCooldowns);
    const setTargetedZombie = useGameStore(s => s.setTargetedZombie);

    // ── Key handling ──────────────────────────────────────────────────────
    useEffect(() => {
        const handleDown = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            const captured = ['w', 'a', 's', 'd', 'q', 'e', 'shift', ' ',
                'arrowup', 'arrowdown', 'arrowleft', 'arrowright', '1', '2', '3', '4', 'tab', 'escape'];
            if (captured.includes(key)) e.preventDefault();

            if (key === 'escape') { setTargetedZombie(null); return; }
            keys.current.add(key === ' ' ? 'space' : key);

            if (key === 'tab') {
                const { zombies, targetedZombieId } = useGameStore.getState();
                const alive = zombies.filter(z => z.state !== 'dying' && z.state !== 'dead');
                if (alive.length === 0) { setTargetedZombie(null); return; }
                const cur = alive.findIndex(z => z.id === targetedZombieId);
                setTargetedZombie(alive[(cur + 1) % alive.length].id);
            }
        };
        const handleUp = (e: KeyboardEvent) => {
            keys.current.delete(e.key.toLowerCase() === ' ' ? 'space' : e.key.toLowerCase());
        };
        window.addEventListener('keydown', handleDown);
        window.addEventListener('keyup', handleUp);
        return () => {
            window.removeEventListener('keydown', handleDown);
            window.removeEventListener('keyup', handleUp);
        };
    }, [setTargetedZombie]);

    // ── Attack click (crossbow) ───────────────────────────────────────────
    useEffect(() => {
        const handleClick = () => {
            const { player, gameRunning, skillMenuOpen, zombies, targetedZombieId,
                addProjectile: addProj } = useGameStore.getState();
            if (!gameRunning || skillMenuOpen) return;
            if (!groupRef.current) return;
            if (!targetedZombieId) return;
            if (attackCooldown.current > 0) return;

            attackCooldown.current = WEAPON_COOLDOWN['bow'];
            isAttacking.current = true;
            attackTimer.current = 0.4;

            const target = zombies.find(z => z.id === targetedZombieId && z.state !== 'dying' && z.state !== 'dead');
            let dir = new THREE.Vector3(0, 0, 1).applyQuaternion(groupRef.current.quaternion);
            if (target) {
                dir = new THREE.Vector3(
                    target.position.x - groupRef.current.position.x, 0,
                    target.position.z - groupRef.current.position.z).normalize();
            }
            addProj({
                type: 'arrow',
                position: { x: groupRef.current.position.x + dir.x * 0.5, y: groupRef.current.position.y + 1.4, z: groupRef.current.position.z + dir.z * 0.5 },
                direction: { x: dir.x, y: 0.03, z: dir.z },
                speed: 18, damage: WEAPON_DAMAGE['bow'] + player.damage, ttl: 3.0, hitRadius: 0.8, ownerId: 'player',
            });
        };
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, [addProjectile]);

    // ── Spells 1/2/3 ─────────────────────────────────────────────────────
    const castSpell = useCallback((spell: SpellType) => {
        if (!groupRef.current) return;
        const { player, gameRunning, skillMenuOpen, zombies, targetedZombieId } = useGameStore.getState();
        if (!gameRunning || skillMenuOpen || !player.spells[spell].unlocked) return;
        if (player.spellCooldowns[spell] > 0) return;
        const tier = player.spells[spell].tier;
        const damage = SPELL_BASE_DAMAGE[spell] + (tier - 1) * SPELL_DAMAGE_PER_TIER[spell];
        const cd = Math.max(1, SPELL_COOLDOWN_BASE[spell] - (tier - 1) * 0.5);
        setSpellCooldown(spell, cd);
        const target = zombies.find(z => z.id === targetedZombieId && z.state !== 'dying' && z.state !== 'dead');
        const dir = target
            ? new THREE.Vector3(target.position.x - groupRef.current.position.x, 0, target.position.z - groupRef.current.position.z).normalize()
            : new THREE.Vector3(0, 0, 1).applyQuaternion(groupRef.current.quaternion);
        const startPos = { x: groupRef.current.position.x + dir.x * 0.6, y: groupRef.current.position.y + 1.5, z: groupRef.current.position.z + dir.z * 0.6 };
        if (spell === 'fireball') {
            addProjectile({
                type: 'fireball', position: startPos, direction: { x: dir.x, y: 0, z: dir.z }, speed: 12, damage, ttl: 5, hitRadius: 0.7,
                aoeRadius: tier >= 3 ? 2.5 : undefined, ownerId: 'player'
            });
        } else if (spell === 'lightning') {
            addProjectile({
                type: 'lightning', position: startPos, direction: { x: dir.x, y: 0, z: dir.z }, speed: 60, damage, ttl: 0.4, hitRadius: 1.2,
                chainCount: tier >= 3 ? Math.min(tier - 2, 5) : 0, ownerId: 'player'
            });
        } else if (spell === 'frostbolt') {
            addProjectile({
                type: 'frostbolt', position: startPos, direction: { x: dir.x, y: 0, z: dir.z }, speed: 15, damage, ttl: 4, hitRadius: 0.7,
                chillRadius: tier >= 3 ? 3.0 : undefined, ownerId: 'player'
            });
        } else if (spell === 'shadowbolt') {
            const dotDps = damage * 0.5;
            addProjectile({
                type: 'shadowbolt', position: startPos, direction: { x: dir.x, y: 0, z: dir.z }, speed: 14, damage, ttl: 4, hitRadius: 0.7,
                dotDps, dotDuration: 6, dotRadius: tier >= 3 ? 2.5 : undefined, ownerId: 'player'
            });
        }
    }, [addProjectile, setSpellCooldown]);

    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            if (e.key === '1') castSpell('fireball');
            if (e.key === '2') castSpell('lightning');
            if (e.key === '3') castSpell('frostbolt');
            if (e.key === '4') castSpell('shadowbolt');
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [castSpell]);

    // ── Frame loop ────────────────────────────────────────────────────────
    useFrame((state, delta) => {
        if (!groupRef.current) return;
        const { player, gameRunning, gameOver } = useGameStore.getState();
        if (!gameRunning || gameOver) return;

        tickSpellCooldowns(delta);
        if (attackCooldown.current > 0) attackCooldown.current -= delta;
        if (attackTimer.current > 0) { attackTimer.current -= delta; if (attackTimer.current <= 0) isAttacking.current = false; }
        if (landTimer.current > 0) landTimer.current -= delta;

        setBlocking(false); // crossbow-only: no blocking

        const sprint = keys.current.has('shift');
        const walkSpeed = player.speed ?? 4;
        const speed = sprint ? walkSpeed * 2 : walkSpeed;
        const fwdKey = keys.current.has('w') || keys.current.has('arrowup');
        const backKey = keys.current.has('s') || keys.current.has('arrowdown');
        const strafeL = keys.current.has('q');
        const strafeR = keys.current.has('e');
        const turnL = keys.current.has('a') || keys.current.has('arrowleft');
        const turnR = keys.current.has('d') || keys.current.has('arrowright');

        let dx = 0, dz = 0;
        if (fwdKey) dz += 1;
        if (backKey) dz -= 1;
        if (strafeL) dx += 1;
        if (strafeR) dx -= 1;
        isMoving.current = (dx !== 0 || dz !== 0);

        if (turnL) groupRef.current.rotation.y += 2.0 * delta;
        if (turnR) groupRef.current.rotation.y -= 2.0 * delta;

        let nextPos = position.current.clone();
        if (isMoving.current) {
            const angle = groupRef.current.rotation.y;
            const fwd = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
            const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
            const dir = new THREE.Vector3();
            dir.addScaledVector(fwd, dz);
            dir.addScaledVector(right, dx);
            if (dir.length() > 0) dir.normalize();
            nextPos.addScaledVector(dir, speed * delta);
        }

        const environment = useSimulationStore.getState().environment;
        const half = environment.terrain.size / 2 - 2;
        nextPos.x = THREE.MathUtils.clamp(nextPos.x, -half, half);
        nextPos.z = THREE.MathUtils.clamp(nextPos.z, -half, half);
        position.current.x = nextPos.x;
        position.current.z = nextPos.z;

        const GRAVITY = 18.0;
        const jump = keys.current.has('space');
        if (jump && isGrounded.current) { velocity.current.y = 8.0; isGrounded.current = false; }
        velocity.current.y -= GRAVITY * delta;
        position.current.y += velocity.current.y * delta;
        const terrainY = getTerrainHeight(position.current.x, position.current.z, environment.terrain.seed, environment.terrain.heightScale);
        if (position.current.y <= terrainY) {
            if (!isGrounded.current && velocity.current.y < -3) landTimer.current = 0.15;
            position.current.y = terrainY;
            velocity.current.y = 0;
            isGrounded.current = true;
        } else { isGrounded.current = false; }

        groupRef.current.position.copy(position.current);
        playerWorldPosition.x = position.current.x;
        playerWorldPosition.y = position.current.y;
        playerWorldPosition.z = position.current.z;

        // Auto-face target — normalized diff prevents 180° flip
        const { targetedZombieId, zombies } = useGameStore.getState();
        if (targetedZombieId) {
            const tgt = zombies.find(z => z.id === targetedZombieId);
            if (tgt) {
                const tdx = tgt.position.x - position.current.x;
                const tdz = tgt.position.z - position.current.z;
                const targetAngle = Math.atan2(tdx, tdz);
                let diff = targetAngle - groupRef.current.rotation.y;
                if (diff > Math.PI) diff -= Math.PI * 2;
                if (diff < -Math.PI) diff += Math.PI * 2;
                groupRef.current.rotation.y += diff * 0.08;
            }
        }

        // ── Animations ─────────────────────────────────────────────────
        const t = state.clock.elapsedTime;
        const ws = sprint ? 14 : 7;
        const LT = leftThighRef.current, RT = rightThighRef.current;
        const LS = leftShinRef.current, RS = rightShinRef.current;

        if (!isGrounded.current) {
            if (LT) { LT.rotation.x = 0.6; LT.rotation.z = -0.08; }
            if (RT) { RT.rotation.x = 0.6; RT.rotation.z = 0.08; }
            if (LS) LS.rotation.x = -1.5;
            if (RS) RS.rotation.x = -1.5;
            if (leftArmRef.current) { leftArmRef.current.rotation.x = -1.8; leftArmRef.current.rotation.z = -0.35; }
            if (rightArmRef.current) { rightArmRef.current.rotation.x = -1.8; rightArmRef.current.rotation.z = 0.35; }
        } else if (landTimer.current > 0) {
            const p = landTimer.current / 0.15;
            if (LT) { LT.rotation.x = 0.4 + p * 0.3; LT.rotation.z = -0.08; }
            if (RT) { RT.rotation.x = 0.4 + p * 0.3; RT.rotation.z = 0.08; }
            if (LS) LS.rotation.x = -1.1 - p * 0.4;
            if (RS) RS.rotation.x = -1.1 - p * 0.4;
        } else if (isAttacking.current) {
            const prog = Math.min(1, 1 - attackTimer.current / 0.4);
            if (rightArmRef.current) { rightArmRef.current.rotation.x = THREE.MathUtils.lerp(-0.5, 0.8, prog); rightArmRef.current.rotation.z = -0.1; }
            if (leftArmRef.current) { leftArmRef.current.rotation.x = THREE.MathUtils.lerp(-0.4, 0.3, prog); leftArmRef.current.rotation.z = 0.1; }
            if (LT) { LT.rotation.x = 0.25; LT.rotation.z = -0.08; }
            if (RT) { RT.rotation.x = 0.25; RT.rotation.z = 0.08; }
            if (LS) LS.rotation.x = -0.85;
            if (RS) RS.rotation.x = -0.85;
        } else if (isMoving.current) {
            const stride = sprint ? 0.45 : 0.32, shinBias = sprint ? -1.0 : -0.85, shinStride = sprint ? 0.38 : 0.28;
            const walkL = Math.sin(t * ws), walkR = Math.sin(t * ws + Math.PI);
            if (LT) { LT.rotation.x = 0.25 + walkL * stride; LT.rotation.z = -0.08 + walkL * 0.05; }
            if (RT) { RT.rotation.x = 0.25 + walkR * stride; RT.rotation.z = 0.08 + walkR * 0.05; }
            if (LS) LS.rotation.x = shinBias - walkL * shinStride;
            if (RS) RS.rotation.x = shinBias - walkR * shinStride;
            if (leftArmRef.current) { leftArmRef.current.rotation.x = Math.sin(t * ws + Math.PI) * 0.28; leftArmRef.current.rotation.z = 0; }
            if (rightArmRef.current) { rightArmRef.current.rotation.x = Math.sin(t * ws) * 0.28; rightArmRef.current.rotation.z = 0; }
            if (torsoRef.current) torsoRef.current.position.y = Math.abs(Math.sin(t * ws * 2)) * 0.04;
        } else {
            const breathe = Math.sin(t * 1.2) * 0.03;
            if (LT) { LT.rotation.x = 0.25; LT.rotation.z = -0.08; }
            if (RT) { RT.rotation.x = 0.25; RT.rotation.z = 0.08; }
            if (LS) LS.rotation.x = -0.85;
            if (RS) RS.rotation.x = -0.85;
            if (leftArmRef.current) { leftArmRef.current.rotation.x = breathe; leftArmRef.current.rotation.z = 0; }
            if (rightArmRef.current) { rightArmRef.current.rotation.x = -breathe; rightArmRef.current.rotation.z = 0; }
            if (torsoRef.current) torsoRef.current.position.y = breathe;
        }
    });

    return (
        <group ref={groupRef} name="playerAvatar">

            {/* ── TORSO + HELM ─────────────────────────────────────── */}
            <group ref={torsoRef} position={[0, 0, 0]}>
                <mesh position={[0, 1.05, 0]} castShadow><boxGeometry args={[0.52, 0.68, 0.32]} /><meshStandardMaterial {...PLATE} /></mesh>
                <mesh position={[0, 1.15, 0.17]}><boxGeometry args={[0.14, 0.28, 0.04]} /><meshStandardMaterial {...GOLD} /></mesh>
                <mesh position={[0, 0.72, 0.02]} castShadow><boxGeometry args={[0.46, 0.22, 0.26]} /><meshStandardMaterial {...PLATE_D} /></mesh>
                <mesh position={[0, 1.05, -0.18]}><boxGeometry args={[0.50, 0.64, 0.06]} /><meshStandardMaterial {...PLATE_D} /></mesh>
                <mesh position={[0, 1.46, 0]}><cylinderGeometry args={[0.13, 0.16, 0.14, 8]} /><meshStandardMaterial {...PLATE} /></mesh>
                {/* Helm */}
                <mesh position={[0, 1.68, 0]} castShadow><boxGeometry args={[0.32, 0.30, 0.30]} /><meshStandardMaterial {...PLATE} /></mesh>
                <mesh position={[0, 1.67, 0.158]}><boxGeometry args={[0.18, 0.04, 0.01]} /><meshStandardMaterial color="#00eeff" emissive="#00eeff" emissiveIntensity={1.6} /></mesh>
                <mesh position={[0, 1.60, 0.158]}><boxGeometry args={[0.12, 0.025, 0.01]} /><meshStandardMaterial color="#00eeff" emissive="#00eeff" emissiveIntensity={0.9} /></mesh>
                <mesh position={[-0.175, 1.63, 0.05]}><boxGeometry args={[0.04, 0.18, 0.22]} /><meshStandardMaterial {...PLATE_D} /></mesh>
                <mesh position={[0.175, 1.63, 0.05]}><boxGeometry args={[0.04, 0.18, 0.22]} /><meshStandardMaterial {...PLATE_D} /></mesh>
                <mesh position={[0, 1.845, 0]}><boxGeometry args={[0.07, 0.06, 0.30]} /><meshStandardMaterial {...GOLD} /></mesh>
                {[-0.1, 0, 0.1].map((pz, i) => (
                    <mesh key={i} position={[0, 1.95 - i * 0.03, pz]} rotation={[0.15 - i * 0.08, 0, 0]}>
                        <coneGeometry args={[0.022, 0.18, 5]} /><meshStandardMaterial color="#8b0000" roughness={0.8} />
                    </mesh>
                ))}
            </group>

            {/* ── LEFT ARM ─────────────────────────────────────────── */}
            <group ref={leftArmRef} position={[-0.34, 1.18, 0]}>
                <mesh position={[0, 0.08, 0]} castShadow><sphereGeometry args={[0.14, 8, 6]} /><meshStandardMaterial {...PLATE} /></mesh>
                <mesh position={[0, 0.01, 0]}><cylinderGeometry args={[0.12, 0.10, 0.08, 8]} /><meshStandardMaterial {...GOLD} /></mesh>
                <mesh position={[0, -0.19, 0]} castShadow><cylinderGeometry args={[0.085, 0.07, 0.28, 7]} /><meshStandardMaterial {...PLATE} /></mesh>
                <mesh position={[0, -0.44, 0]} castShadow><cylinderGeometry args={[0.065, 0.075, 0.24, 7]} /><meshStandardMaterial {...PLATE_D} /></mesh>
                <mesh position={[0, -0.60, 0]}><boxGeometry args={[0.12, 0.12, 0.10]} /><meshStandardMaterial {...PLATE} /></mesh>
            </group>

            {/* ── RIGHT ARM + CROSSBOW ─────────────────────────────── */}
            <group ref={rightArmRef} position={[0.34, 1.18, 0]}>
                <mesh position={[0, 0.08, 0]} castShadow><sphereGeometry args={[0.14, 8, 6]} /><meshStandardMaterial {...PLATE} /></mesh>
                <mesh position={[0, 0.01, 0]}><cylinderGeometry args={[0.12, 0.10, 0.08, 8]} /><meshStandardMaterial {...GOLD} /></mesh>
                <mesh position={[0, -0.19, 0]} castShadow><cylinderGeometry args={[0.085, 0.07, 0.28, 7]} /><meshStandardMaterial {...PLATE} /></mesh>
                <mesh position={[0, -0.44, 0]} castShadow><cylinderGeometry args={[0.065, 0.075, 0.24, 7]} /><meshStandardMaterial {...PLATE_D} /></mesh>
                <mesh position={[0, -0.60, 0]}><boxGeometry args={[0.12, 0.12, 0.10]} /><meshStandardMaterial {...PLATE} /></mesh>
                {/* Crossbow */}
                <group position={[0.05, -0.38, 0.06]} rotation={[0.12, 0, 0.14]}>
                    <mesh><torusGeometry args={[0.28, 0.020, 6, 20, Math.PI * 1.35]} /><meshStandardMaterial color="#4a2a08" roughness={0.8} /></mesh>
                    <mesh><cylinderGeometry args={[0.004, 0.004, 0.55, 4]} /><meshStandardMaterial color="#c8aa70" /></mesh>
                    <mesh position={[0, 0, -0.04]} rotation={[Math.PI / 2, 0, 0]}>
                        <cylinderGeometry args={[0.007, 0.007, 0.46, 4]} /><meshStandardMaterial color="#8a6030" />
                    </mesh>
                </group>
            </group>

            {/* ── AVIAN LEFT LEG ───────────────────────────────────── */}
            <group ref={leftThighRef} position={[-0.14, 0.58, 0]} rotation={[0.25, 0, -0.08]}>
                <mesh position={[0, -0.13, 0]} castShadow><boxGeometry args={[0.17, 0.30, 0.19]} /><meshStandardMaterial {...PLATE} /></mesh>
                <mesh position={[0, -0.30, 0.06]}><cylinderGeometry args={[0.09, 0.08, 0.06, 8]} /><meshStandardMaterial {...PLATE_D} /></mesh>
                <group ref={leftShinRef} position={[0, -0.32, 0.0]} rotation={[-0.85, 0, 0]}>
                    <mesh position={[0, -0.22, 0]} castShadow><cylinderGeometry args={[0.048, 0.038, 0.46, 6]} /><meshStandardMaterial color="#2a2a2a" metalness={0.5} roughness={0.7} /></mesh>
                    <mesh position={[0, -0.22, 0.04]}><boxGeometry args={[0.10, 0.38, 0.04]} /><meshStandardMaterial {...PLATE_D} /></mesh>
                    <group position={[0, -0.46, 0.04]} rotation={[0.75, 0, 0]}>
                        <mesh position={[0, -0.10, 0]}><cylinderGeometry args={[0.038, 0.028, 0.22, 5]} /><meshStandardMaterial {...TALON} /></mesh>
                        <mesh position={[0, -0.21, 0.08]} rotation={[-0.6, 0, 0]}><cylinderGeometry args={[0.022, 0.010, 0.18, 4]} /><meshStandardMaterial {...TALON} /></mesh>
                        <mesh position={[-0.07, -0.21, 0.04]} rotation={[-0.3, 0.5, 0]}><cylinderGeometry args={[0.018, 0.008, 0.14, 4]} /><meshStandardMaterial {...TALON} /></mesh>
                        <mesh position={[0.07, -0.21, 0.04]} rotation={[-0.3, -0.5, 0]}><cylinderGeometry args={[0.018, 0.008, 0.14, 4]} /><meshStandardMaterial {...TALON} /></mesh>
                        <mesh position={[0, -0.29, 0.16]} rotation={[-0.9, 0, 0]}><coneGeometry args={[0.014, 0.08, 4]} /><meshStandardMaterial color="#111" roughness={0.5} /></mesh>
                    </group>
                </group>
            </group>

            {/* ── AVIAN RIGHT LEG ──────────────────────────────────── */}
            <group ref={rightThighRef} position={[0.14, 0.58, 0]} rotation={[0.25, 0, 0.08]}>
                <mesh position={[0, -0.13, 0]} castShadow><boxGeometry args={[0.17, 0.30, 0.19]} /><meshStandardMaterial {...PLATE} /></mesh>
                <mesh position={[0, -0.30, 0.06]}><cylinderGeometry args={[0.09, 0.08, 0.06, 8]} /><meshStandardMaterial {...PLATE_D} /></mesh>
                <group ref={rightShinRef} position={[0, -0.32, 0.0]} rotation={[-0.85, 0, 0]}>
                    <mesh position={[0, -0.22, 0]} castShadow><cylinderGeometry args={[0.048, 0.038, 0.46, 6]} /><meshStandardMaterial color="#2a2a2a" metalness={0.5} roughness={0.7} /></mesh>
                    <mesh position={[0, -0.22, 0.04]}><boxGeometry args={[0.10, 0.38, 0.04]} /><meshStandardMaterial {...PLATE_D} /></mesh>
                    <group position={[0, -0.46, 0.04]} rotation={[0.75, 0, 0]}>
                        <mesh position={[0, -0.10, 0]}><cylinderGeometry args={[0.038, 0.028, 0.22, 5]} /><meshStandardMaterial {...TALON} /></mesh>
                        <mesh position={[0, -0.21, 0.08]} rotation={[-0.6, 0, 0]}><cylinderGeometry args={[0.022, 0.010, 0.18, 4]} /><meshStandardMaterial {...TALON} /></mesh>
                        <mesh position={[-0.07, -0.21, 0.04]} rotation={[-0.3, 0.5, 0]}><cylinderGeometry args={[0.018, 0.008, 0.14, 4]} /><meshStandardMaterial {...TALON} /></mesh>
                        <mesh position={[0.07, -0.21, 0.04]} rotation={[-0.3, -0.5, 0]}><cylinderGeometry args={[0.018, 0.008, 0.14, 4]} /><meshStandardMaterial {...TALON} /></mesh>
                        <mesh position={[0, -0.29, 0.16]} rotation={[-0.9, 0, 0]}><coneGeometry args={[0.014, 0.08, 4]} /><meshStandardMaterial color="#111" roughness={0.5} /></mesh>
                    </group>
                </group>
            </group>
        </group>
    );
}
