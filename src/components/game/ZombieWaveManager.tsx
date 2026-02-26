'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '@/lib/gameStore';
import { playerWorldPosition } from './PlayerAvatar';

const ZOMBIE_CLEANUP_INTERVAL = 2.0; // seconds

export default function ZombieWaveManager() {
    const tickZombies = useGameStore(s => s.tickZombies);
    const tickWaveTimer = useGameStore(s => s.tickWaveTimer);
    const tickWaveSpawner = useGameStore(s => s.tickWaveSpawner);
    const checkWaveComplete = useGameStore(s => s.checkWaveComplete);
    const removeDeadZombies = useGameStore(s => s.removeDeadZombies);

    const cleanupTimer = useRef(0);
    const dyingTransitionTimer = useRef<Record<string, number>>({});

    useFrame((_, delta) => {
        const { gameRunning, gameOver, gamePaused } = useGameStore.getState();
        if (!gameRunning || gameOver || gamePaused) return;

        // Tick zombie AI, passing current player position
        tickZombies(delta, playerWorldPosition);

        // Wave timer (rest → next wave)
        tickWaveTimer(delta);

        // Staggered batch spawner
        tickWaveSpawner(delta);

        // Periodic cleanup of dead zombies
        cleanupTimer.current += delta;
        if (cleanupTimer.current >= ZOMBIE_CLEANUP_INTERVAL) {
            cleanupTimer.current = 0;
            // Mark dying zombies as dead after 1.2s
            const { zombies } = useGameStore.getState();
            const now = Date.now();
            zombies.forEach(z => {
                if (z.state === 'dying') {
                    if (!dyingTransitionTimer.current[z.id]) {
                        dyingTransitionTimer.current[z.id] = now;
                    } else if (now - dyingTransitionTimer.current[z.id] > 1200) {
                        // Mark dead
                        useGameStore.setState(s => ({
                            zombies: s.zombies.map(zz =>
                                zz.id === z.id ? { ...zz, state: 'dead' } : zz
                            )
                        }));
                        delete dyingTransitionTimer.current[z.id];
                    }
                }
            });
            removeDeadZombies();
        }

        checkWaveComplete();
    });

    return null; // no visual output — logic only
}
