'use client';

import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useSimulationStore } from '@/lib/simulationStore';
import { getTerrainHeight } from './Terrain';

/**
 * Optimized OakTrees — higher density with more branch detail,
 * but uses instanced meshes for trunks and canopies instead of
 * individual mesh components. Trees are scattered across the full
 * map but only rendered if within view frustum (handled by Three.js).
 */

interface TreeData {
    x: number; y: number; z: number;
    trunkH: number; canopyR: number;
    branches: { ox: number; oy: number; oz: number; rx: number; ry: number; rz: number; len: number; }[];
    id: string;
}

function seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
    };
}

export default function OakTrees() {
    const environment = useSimulationStore(s => s.environment);
    const addCollider = useSimulationStore(s => s.addCollider);
    const { treeCount } = environment.vegetation;
    const terrainSeed = environment.terrain.seed;
    const terrainSize = environment.terrain.size;
    const heightScale = environment.terrain.heightScale;

    // Generate trees scattered across the full map
    const totalTrees = treeCount * 1;

    const trees = useMemo(() => {
        const rng = seededRandom(terrainSeed + 42);
        const result: TreeData[] = [];
        const halfSize = terrainSize / 2 - 15;

        for (let i = 0; i < totalTrees; i++) {
            const x = (rng() - 0.5) * halfSize * 2;
            const z = (rng() - 0.5) * halfSize * 2;
            // Avoid spawn area (r=8)
            if (x * x + z * z < 64) continue;

            const y = getTerrainHeight(x, z, terrainSeed, heightScale);
            const trunkH = 3 + rng() * 5;
            const canopyR = 2 + rng() * 3;

            // Generate 3-6 branches (more complex)
            const branchCount = 3 + Math.floor(rng() * 4);
            const branches: TreeData['branches'] = [];
            for (let b = 0; b < branchCount; b++) {
                const frac = 0.3 + rng() * 0.5; // height fraction along trunk
                const angle = rng() * Math.PI * 2;
                const tilt = Math.PI / 6 + rng() * Math.PI / 4;
                branches.push({
                    ox: Math.cos(angle) * 0.3,
                    oy: trunkH * frac,
                    oz: Math.sin(angle) * 0.3,
                    rx: Math.cos(angle) * tilt,
                    ry: angle,
                    rz: Math.sin(angle) * tilt,
                    len: 0.8 + rng() * 1.5,
                });
            }

            result.push({ x, y, z, trunkH, canopyR, branches, id: `tree-${i}` });
        }
        return result;
    }, [totalTrees, terrainSeed, terrainSize, heightScale]);

    // Instanced trunks
    const { trunkMatrices, trunkColors, canopyMatrices, canopyColors, branchMatrices } = useMemo(() => {
        const tm = new Float32Array(totalTrees * 16);
        const tc = new Float32Array(totalTrees * 3);
        const cm = new Float32Array(totalTrees * 16);
        const cc = new Float32Array(totalTrees * 3);

        // Branches: up to 6 per tree, estimate total
        const maxBranches = totalTrees * 6;
        const bm = new Float32Array(maxBranches * 16);
        let branchIdx = 0;

        const dummy = new THREE.Matrix4();

        for (let i = 0; i < trees.length; i++) {
            const t = trees[i];

            // Trunk matrix
            dummy.identity();
            dummy.makeScale(0.2, t.trunkH, 0.2);
            dummy.setPosition(t.x, t.y + t.trunkH / 2, t.z);
            dummy.toArray(tm, i * 16);
            tc[i * 3] = 0.29; tc[i * 3 + 1] = 0.21; tc[i * 3 + 2] = 0.13;

            // Canopy matrix
            dummy.identity();
            dummy.makeScale(t.canopyR, t.canopyR * 0.8, t.canopyR);
            dummy.setPosition(t.x, t.y + t.trunkH, t.z);
            dummy.toArray(cm, i * 16);
            const g = 0.25 + (i % 7) * 0.04;
            cc[i * 3] = 0.1; cc[i * 3 + 1] = g; cc[i * 3 + 2] = 0.06;

            // Branch matrices
            for (const br of t.branches) {
                if (branchIdx >= maxBranches) break;
                dummy.identity();
                dummy.makeRotationFromEuler(new THREE.Euler(br.rx, br.ry, br.rz));
                dummy.scale(new THREE.Vector3(0.06, br.len, 0.06));
                dummy.setPosition(t.x + br.ox, t.y + br.oy, t.z + br.oz);
                dummy.toArray(bm, branchIdx * 16);
                branchIdx++;
            }
        }

        return {
            trunkMatrices: tm, trunkColors: tc,
            canopyMatrices: cm, canopyColors: cc,
            branchMatrices: { data: bm, count: branchIdx },
        };
    }, [trees, totalTrees]);

    // Register colliders
    useEffect(() => {
        trees.forEach(t => {
            addCollider({
                id: t.id, type: 'tree',
                position: { x: t.x, y: t.y, z: t.z },
                size: { x: 1.5, y: t.trunkH, z: 1.5 },
                interactable: true, climbable: true,
            });
        });
    }, [trees, addCollider]);

    return (
        <group>
            {/* Instanced trunks */}
            <instancedMesh args={[undefined, undefined, totalTrees]} castShadow
                ref={(mesh) => {
                    if (!mesh) return;
                    const dummy = new THREE.Matrix4();
                    const color = new THREE.Color();
                    for (let i = 0; i < totalTrees; i++) {
                        dummy.fromArray(trunkMatrices, i * 16);
                        mesh.setMatrixAt(i, dummy);
                        color.setRGB(trunkColors[i * 3], trunkColors[i * 3 + 1], trunkColors[i * 3 + 2]);
                        mesh.setColorAt(i, color);
                    }
                    mesh.instanceMatrix.needsUpdate = true;
                    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
                }}
            >
                <cylinderGeometry args={[0.5, 1, 1, 6]} />
                <meshStandardMaterial vertexColors roughness={0.95} metalness={0} />
            </instancedMesh>

            {/* Instanced canopies */}
            <instancedMesh args={[undefined, undefined, totalTrees]} castShadow
                ref={(mesh) => {
                    if (!mesh) return;
                    const dummy = new THREE.Matrix4();
                    const color = new THREE.Color();
                    for (let i = 0; i < totalTrees; i++) {
                        dummy.fromArray(canopyMatrices, i * 16);
                        mesh.setMatrixAt(i, dummy);
                        color.setRGB(canopyColors[i * 3], canopyColors[i * 3 + 1], canopyColors[i * 3 + 2]);
                        mesh.setColorAt(i, color);
                    }
                    mesh.instanceMatrix.needsUpdate = true;
                    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
                }}
            >
                <sphereGeometry args={[1, 6, 5]} />
                <meshStandardMaterial vertexColors roughness={0.9} metalness={0} />
            </instancedMesh>

            {/* Instanced branches */}
            <instancedMesh args={[undefined, undefined, branchMatrices.count]}
                ref={(mesh) => {
                    if (!mesh) return;
                    const dummy = new THREE.Matrix4();
                    const color = new THREE.Color(0.29, 0.21, 0.13);
                    for (let i = 0; i < branchMatrices.count; i++) {
                        dummy.fromArray(branchMatrices.data, i * 16);
                        mesh.setMatrixAt(i, dummy);
                        mesh.setColorAt(i, color);
                    }
                    mesh.instanceMatrix.needsUpdate = true;
                    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
                }}
            >
                <cylinderGeometry args={[0.3, 0.8, 1, 4]} />
                <meshStandardMaterial vertexColors roughness={0.95} metalness={0} />
            </instancedMesh>
        </group>
    );
}
