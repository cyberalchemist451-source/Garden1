'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { useSimulationStore } from '@/lib/simulationStore';

/* Simple hash-based noise for terrain generation */
function hash(x: number, z: number, seed: number): number {
    let h = seed + x * 374761393 + z * 668265263;
    h = (h ^ (h >> 13)) * 1274126177;
    h = h ^ (h >> 16);
    return (h & 0x7fffffff) / 0x7fffffff;
}

function smoothNoise(x: number, z: number, seed: number): number {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = x - ix, fz = z - iz;
    const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
    const n00 = hash(ix, iz, seed);
    const n10 = hash(ix + 1, iz, seed);
    const n01 = hash(ix, iz + 1, seed);
    const n11 = hash(ix + 1, iz + 1, seed);
    const nx0 = n00 + sx * (n10 - n00);
    const nx1 = n01 + sx * (n11 - n01);
    return nx0 + sz * (nx1 - nx0);
}

function fbm(x: number, z: number, seed: number, octaves: number = 4): number {
    let value = 0, amplitude = 1, frequency = 1, total = 0;
    for (let i = 0; i < octaves; i++) {
        value += smoothNoise(x * frequency, z * frequency, seed + i * 1000) * amplitude;
        total += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
    }
    return value / total;
}

export function getTerrainHeight(x: number, z: number, seed: number, heightScale: number): number {
    return fbm(x * 0.02, z * 0.02, seed) * heightScale;
}

export default function Terrain() {
    const { terrain } = useSimulationStore(s => s.environment);
    const segments = 128;

    const { geometry, dirtMask } = useMemo(() => {
        const geo = new THREE.PlaneGeometry(terrain.size, terrain.size, segments, segments);
        geo.rotateX(-Math.PI / 2);

        const pos = geo.attributes.position;
        const colors = new Float32Array(pos.count * 3);

        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const z = pos.getZ(i);
            const h = getTerrainHeight(x, z, terrain.seed, terrain.heightScale);
            pos.setY(i, h);

            // Dirt mask: patches via separate noise
            const dirtNoise = fbm(x * 0.05, z * 0.05, terrain.seed + 500, 3);
            const isDirt = dirtNoise > 0.62;

            if (isDirt) {
                colors[3 * i] = 0.35 + Math.random() * 0.08;
                colors[3 * i + 1] = 0.25 + Math.random() * 0.05;
                colors[3 * i + 2] = 0.12;
            } else {
                const shade = 0.15 + fbm(x * 0.1, z * 0.1, terrain.seed + 200, 2) * 0.25;
                colors[3 * i] = 0.12 + shade * 0.3;
                colors[3 * i + 1] = 0.35 + shade;
                colors[3 * i + 2] = 0.08 + shade * 0.15;
            }
        }

        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geo.computeVertexNormals();

        return { geometry: geo, dirtMask: null };
    }, [terrain.size, terrain.seed, terrain.heightScale]);

    return (
        <group>
            <mesh geometry={geometry} receiveShadow>
                <meshStandardMaterial
                    vertexColors
                    roughness={0.95}
                    metalness={0.0}
                    flatShading={false}
                />
            </mesh>
        </group>
    );
}
