'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGameStore } from '@/lib/gameStore';
import GameHUD from '@/components/game/GameHUD';
import SkillMenu from '@/components/game/SkillMenu';

// Dynamic import to avoid SSR issues with Three.js
const GameScene = dynamic(() => import('@/components/game/GameScene'), { ssr: false });

function StartScreen() {
    const startGame = useGameStore(s => s.startGame);
    return (
        <div style={{
            position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: 'radial-gradient(ellipse at center, #0a0f1e 0%, #000 100%)',
            fontFamily: "'Inter','Segoe UI',sans-serif",
            userSelect: 'none',
            zIndex: 200,
        }}>
            <div style={{ textAlign: 'center', maxWidth: 560 }}>
                <div style={{ fontSize: 64, marginBottom: 8 }}>💀</div>
                <h1 style={{
                    color: '#ff4422', fontSize: 42, fontWeight: 900, margin: '0 0 6px',
                    textShadow: '0 0 30px rgba(255,50,0,0.5)',
                    letterSpacing: 2,
                }}>UNDEAD SIEGE</h1>
                <p style={{ color: '#666', fontSize: 14, marginBottom: 32 }}>
                    Survive the waves emerging from the cave. Earn XP, level up, spend skill points.
                </p>

                {/* Controls */}
                <div style={{
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 14, padding: '18px 28px', marginBottom: 28, textAlign: 'left',
                }}>
                    <div style={{ color: '#888', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>CONTROLS</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px' }}>
                        {[
                            ['W/A/S/D', 'Move / Turn'],
                            ['Q / E', 'Strafe left / right'],
                            ['R', 'Cycle weapon'],
                            ['Tab', 'Lock-on target'],
                            ['Shift', 'Sprint'],
                            ['Space', 'Jump / Shield block'],
                            ['Click', 'Attack'],
                            ['Scroll', 'Zoom camera'],
                            ['Mouse drag', 'Rotate camera'],
                            ['1 / 2 / 3', 'Cast Fireball / Lightning / Frostbolt'],
                            ['Skills button', 'Open skill menu'],
                        ].map(([key, desc]) => (
                            <div key={key} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                                <span style={{
                                    color: '#aabbff', fontSize: 11, fontWeight: 700,
                                    background: 'rgba(100,130,255,0.1)', borderRadius: 4,
                                    padding: '1px 6px', whiteSpace: 'nowrap', flexShrink: 0,
                                }}>{key}</span>
                                <span style={{ color: '#666', fontSize: 11 }}>{desc}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <button
                    onClick={startGame}
                    style={{
                        background: 'linear-gradient(135deg, #8b0000, #cc2200)',
                        border: '1px solid #ff4422',
                        color: '#fff',
                        borderRadius: 14, padding: '14px 48px',
                        fontSize: 18, fontWeight: 800,
                        cursor: 'pointer', letterSpacing: 1,
                        boxShadow: '0 0 30px rgba(200,30,0,0.4)',
                        transition: 'transform 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                >
                    ▶ Begin Siege
                </button>
            </div>
        </div>
    );
}

export default function UndeadSiegePage() {
    const gameRunning = useGameStore(s => s.gameRunning);
    const gameOver = useGameStore(s => s.gameOver);
    const showScene = gameRunning || gameOver;

    return (
        <div style={{ width: '100vw', height: '100vh', background: '#000', overflow: 'hidden' }}>
            {/* 3D Canvas — always mounted to avoid remounting all components */}
            <div style={{ position: 'absolute', inset: 0, opacity: showScene ? 1 : 0, transition: 'opacity 0.5s' }}>
                <Canvas
                    shadows
                    camera={{ fov: 60, near: 0.1, far: 500, position: [0, 10, 15] }}
                    gl={{ antialias: true, powerPreference: 'high-performance' }}
                >
                    <Suspense fallback={null}>
                        <GameScene />
                    </Suspense>
                </Canvas>
            </div>

            {/* HUD (DOM overlay) */}
            <GameHUD />

            {/* Skill menu (modal overlay) */}
            <SkillMenu />

            {/* Start screen (shown before game starts) */}
            {!showScene && <StartScreen />}
        </div>
    );
}

