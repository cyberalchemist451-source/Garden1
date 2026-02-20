'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSimulationStore } from '@/lib/simulationStore';
import { getTerrainHeight } from './Terrain';

/**
 * Optimized GrassField — only renders grass within ~45m of camera.
 * Uses a fixed pool of instances that get repositioned each frame
 * based on camera position (chunked for performance).
 */
const LOCAL_RADIUS = 45; // ~2 acres around camera
const INSTANCE_COUNT = 2000; // reduced further for performance
const UPDATE_INTERVAL = 10; // only recompute every N frames

export default function GrassField() {
    const { terrain } = useSimulationStore(s => s.environment);
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const frameCount = useRef(0);
    const lastChunkX = useRef(999);
    const lastChunkZ = useRef(999);
    const { camera } = useThree();

    // Pre-generate a seeded random sequence for stable grass positions
    const rng = useMemo(() => {
        const values: number[] = [];
        let s = terrain.seed;
        for (let i = 0; i < INSTANCE_COUNT * 5; i++) {
            s = (s * 1103515245 + 12345) & 0x7fffffff;
            values.push(s / 0x7fffffff);
        }
        return values;
    }, [terrain.seed]);

    useFrame(() => {
        if (!meshRef.current) return;
        frameCount.current++;
        if (frameCount.current % UPDATE_INTERVAL !== 0) return;

        const cx = camera.position.x;
        const cz = camera.position.z;

        // Only rebuild if camera moved significantly (chunked by 10m)
        const chunkX = Math.floor(cx / 10);
        const chunkZ = Math.floor(cz / 10);
        if (chunkX === lastChunkX.current && chunkZ === lastChunkZ.current) return;
        lastChunkX.current = chunkX;
        lastChunkZ.current = chunkZ;

        const mesh = meshRef.current;
        const dummy = new THREE.Matrix4();
        const color = new THREE.Color();
        const halfMap = terrain.size / 2 - 5;

        for (let i = 0; i < INSTANCE_COUNT; i++) {
            const ri = i * 5;
            const ox = (rng[ri] - 0.5) * LOCAL_RADIUS * 2;
            const oz = (rng[ri + 1] - 0.5) * LOCAL_RADIUS * 2;
            const x = cx + ox;
            const z = cz + oz;

            // Clamp to map bounds
            if (Math.abs(x) > halfMap || Math.abs(z) > halfMap) {
                dummy.makeScale(0, 0, 0);
                dummy.setPosition(0, -100, 0);
                mesh.setMatrixAt(i, dummy);
                continue;
            }

            const y = getTerrainHeight(x, z, terrain.seed, terrain.heightScale);
            const height = 0.15 + rng[ri + 2] * 0.35;
            const rotY = rng[ri + 3] * Math.PI * 2;
            const lean = (rng[ri + 4] - 0.5) * 0.3;

            dummy.makeRotationY(rotY);
            dummy.multiply(new THREE.Matrix4().makeRotationZ(lean));
            dummy.multiply(new THREE.Matrix4().makeScale(0.02, height, 0.02));
            dummy.setPosition(x, y + height * 0.5, z);
            mesh.setMatrixAt(i, dummy);

            color.setRGB(0.15 + rng[ri] * 0.2, 0.4 + rng[ri + 1] * 0.35, 0.05 + rng[ri + 2] * 0.1);
            mesh.setColorAt(i, color);
        }

        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, INSTANCE_COUNT]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial
                vertexColors
                roughness={0.85}
                metalness={0.0}
                side={THREE.DoubleSide}
            />
        </instancedMesh>
    );
}
