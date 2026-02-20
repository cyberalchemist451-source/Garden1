'use client';

import { Canvas } from '@react-three/fiber';
import { Stars, Environment } from '@react-three/drei';
import SimulationScene from '@/components/simulation/SimulationScene';

/**
 * reliable-wrapper:
 * This component handles the 3D context setup.
 * It is meant to be imported dynamically with ssr: false.
 */
export default function SimulationWrapper() {
    console.log('SimulationWrapper: Mounting 3D Context');
    return (
        <Canvas
            style={{ width: '100%', height: '100%' }}
        >
            <SimulationScene />
            <color attach="background" args={['#222']} />
        </Canvas>
    );
}
