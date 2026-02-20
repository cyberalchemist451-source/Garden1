'use client';

import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useSimulationStore } from '@/lib/simulationStore';
import { getTerrainHeight } from './Terrain';

/**
 * Rocks rendered with instanced meshes for performance.
 */
export default function Rocks() {
    const environment = useSimulationStore(s => s.environment);
    const addCollider = useSimulationStore(s => s.addCollider);
    const count = Math.floor(environment.rocks.count * 0.5);
    const { maxScale } = environment.rocks;

    const { matrices, colors, colliderData } = useMemo(() => {
        const mat = new Float32Array(count * 16);
        const col = new Float32Array(count * 3);
        const colliders: { id: string; pos: [number, number, number]; scale: [number, number, number]; isLarge: boolean }[] = [];

        const dummy = new THREE.Matrix4();
        const halfSize = environment.terrain.size / 2 - 10;

        for (let i = 0; i < count; i++) {
            const x = (Math.random() - 0.5) * halfSize * 2;
            const z = (Math.random() - 0.5) * halfSize * 2;
            // Avoid spawn area
            if (x * x + z * z < 64) {
                // Push out if too close
                const angle = Math.atan2(z, x);
                // Move to radius 9
                // NOTE: This modifies local x/z variables logic
                // Since we can't easily modify 'x' and 'z' in place without changing more lines, let's just make them 0 scale if close
            }

            const dist = Math.sqrt(x * x + z * z);
            let finalX = x; // use new variable names to avoid const errors if we were to reassign
            let finalZ = z;

            if (dist < 8) {
                const angle = Math.random() * Math.PI * 2;
                const rad = 8 + Math.random() * 5;
                finalX = Math.cos(angle) * rad;
                finalZ = Math.sin(angle) * rad;
            }

            const y = getTerrainHeight(finalX, finalZ, environment.terrain.seed, environment.terrain.heightScale);

            const baseScale = 0.3 + Math.random() * maxScale;
            const sx = baseScale * (0.7 + Math.random() * 0.6);
            const sy = baseScale * (0.5 + Math.random() * 0.5);
            const sz = baseScale * (0.7 + Math.random() * 0.6);

            const rx = Math.random() * 0.5;
            const ry = Math.random() * Math.PI * 2;
            const rz = Math.random() * 0.3;

            dummy.makeRotationFromEuler(new THREE.Euler(rx, ry, rz));
            dummy.scale(new THREE.Vector3(sx, sy, sz));
            dummy.setPosition(finalX, y + sy * 0.3, finalZ);
            dummy.toArray(mat, i * 16);

            const shade = 0.35 + Math.random() * 0.1;
            col[i * 3] = shade;
            col[i * 3 + 1] = shade - 0.03;
            col[i * 3 + 2] = shade - 0.07;

            if (baseScale > maxScale * 0.6) {
                colliders.push({ id: `rock-${i}`, pos: [finalX, y + sy * 0.3, finalZ], scale: [sx, sy, sz], isLarge: true });
            }
        }

        return { matrices: mat, colors: col, colliderData: colliders };
    }, [count, maxScale, environment.terrain.size, environment.terrain.seed, environment.terrain.heightScale]);

    useEffect(() => {
        colliderData.forEach(rock => {
            addCollider({
                id: rock.id, type: 'rock',
                position: { x: rock.pos[0], y: rock.pos[1], z: rock.pos[2] },
                size: { x: rock.scale[0] * 2, y: rock.scale[1] * 2, z: rock.scale[2] * 2 },
                interactable: true, climbable: rock.scale[1] < 2,
            });
        });
    }, [colliderData, addCollider]);

    return (
        <instancedMesh args={[undefined, undefined, count]} castShadow receiveShadow
            ref={(mesh) => {
                if (!mesh) return;
                const d = new THREE.Matrix4();
                const c = new THREE.Color();
                for (let i = 0; i < count; i++) {
                    d.fromArray(matrices, i * 16);
                    mesh.setMatrixAt(i, d);
                    c.setRGB(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]);
                    mesh.setColorAt(i, c);
                }
                mesh.instanceMatrix.needsUpdate = true;
                if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
            }}
        >
            <icosahedronGeometry args={[1, 1]} />
            <meshStandardMaterial vertexColors roughness={0.98} metalness={0.02} flatShading />
        </instancedMesh>
    );
}
