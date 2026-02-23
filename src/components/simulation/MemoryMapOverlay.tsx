'use client';

import { useEffect, useRef, useState } from 'react';
import { useSimulationStore } from '@/lib/simulationStore';

/* ─── MemoryMapOverlay ─── */
// Shows a top-down 2D map of everything Atlas currently remembers.
// Objects glow brighter the more recently / frequently Atlas perceived them.
// Dots fade as memory decays. Renders as a canvas overlay.

const OBJECT_COLORS: Record<string, string> = {
    tree: '#2dff6e',
    rock: '#aaa8ff',
    portal: '#ff6eb4',
    chair: '#ffb347',
    table: '#ffb347',
    building: '#00d4ff',
    cabin: '#00d4ff',
    user_avatar: '#ffffff',
    unknown: '#556677',
};

export default function MemoryMapOverlay() {
    const [isOpen, setIsOpen] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const robotPosition = useSimulationStore(s => s.robot.position);
    const userPosition = useSimulationStore(s => s.user.position);
    const knownObjects = useSimulationStore(s => s.robot.knownObjects);
    const colliders = useSimulationStore(s => s.colliders);
    const environment = useSimulationStore(s => s.environment);

    const MAP_SIZE = 220;
    const WORLD_SIZE = environment.terrain.size;

    useEffect(() => {
        if (!isOpen) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const draw = () => {
            ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE);

            // Background
            ctx.fillStyle = 'rgba(4, 6, 14, 0.95)';
            ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

            // Grid
            ctx.strokeStyle = 'rgba(255,255,255,0.04)';
            ctx.lineWidth = 0.5;
            for (let i = 0; i < MAP_SIZE; i += 22) {
                ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, MAP_SIZE); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(MAP_SIZE, i); ctx.stroke();
            }

            // World to canvas transform
            const toCanvas = (wx: number, wz: number) => ({
                x: ((wx + WORLD_SIZE / 2) / WORLD_SIZE) * MAP_SIZE,
                y: ((wz + WORLD_SIZE / 2) / WORLD_SIZE) * MAP_SIZE,
            });

            const now = Date.now();

            // Draw known objects from Atlas's memory
            Object.entries(knownObjects || {}).forEach(([, obj]) => {
                const pos = toCanvas(obj.position.x, obj.position.z);
                const age = (now - obj.lastSeen) / 1000;
                const freshness = Math.max(0, 1 - age / 30);
                const color = OBJECT_COLORS[obj.type] || OBJECT_COLORS.unknown;

                // Glow halo (simplified)
                ctx.globalAlpha = 0.15 * freshness;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 7, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();

                // Core dot
                ctx.globalAlpha = 0.4 + 0.6 * freshness;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 2.5, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();

                ctx.globalAlpha = 1;
            });

            // Draw all colliders as faint outlines
            colliders.forEach(c => {
                if (c.type === 'boundary') return;
                const pos = toCanvas(c.position.x, c.position.z);
                const w = (c.size.x / WORLD_SIZE) * MAP_SIZE;
                const h = (c.size.z / WORLD_SIZE) * MAP_SIZE;
                ctx.globalAlpha = 0.06;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(pos.x - w / 2, pos.y - h / 2, w, h);
                ctx.globalAlpha = 1;
            });

            // User position
            if (userPosition) {
                const userPos = toCanvas(userPosition.x, userPosition.z);
                ctx.globalAlpha = 1;
                ctx.beginPath();
                ctx.arc(userPos.x, userPos.y, 4, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();
                ctx.font = '8px monospace';
                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                ctx.fillText('YOU', userPos.x + 5, userPos.y + 3);
            }

            // Robot position with heading arrow
            const rPos = toCanvas(robotPosition.x, robotPosition.z);
            ctx.beginPath();
            ctx.arc(rPos.x, rPos.y, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#ff6600';
            ctx.fill();
            ctx.strokeStyle = '#ff9900';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Heading indicator
            const robotRot = useSimulationStore.getState().robot.rotation.y;
            ctx.beginPath();
            ctx.moveTo(rPos.x, rPos.y);
            ctx.lineTo(
                rPos.x + Math.sin(robotRot) * 10,
                rPos.y + Math.cos(robotRot) * 10,
            );
            ctx.strokeStyle = '#ffbb00';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.font = '8px monospace';
            ctx.fillStyle = 'rgba(255,100,0,0.7)';
            ctx.fillText('ATLAS', rPos.x + 6, rPos.y + 3);
        };

        let rafId: number;
        const loop = () => { draw(); rafId = requestAnimationFrame(loop); };
        rafId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(rafId);
    }, [isOpen, robotPosition, userPosition, knownObjects, colliders, WORLD_SIZE]);

    const memCount = Object.keys(knownObjects || {}).length;
    const now = Date.now();
    const freshCount = Object.values(knownObjects || {}).filter(o => (now - o.lastSeen) < 10000).length;

    return (
        <>
            {/* Toggle button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    style={{
                        position: 'fixed',
                        bottom: 130,
                        right: 20,
                        background: 'rgba(8,8,16,0.9)',
                        border: '1px solid rgba(45,255,110,0.4)',
                        borderRadius: 8,
                        color: '#2dff6e',
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        padding: '8px 12px',
                        cursor: 'pointer',
                        zIndex: 100,
                        letterSpacing: '0.08em',
                    }}
                >
                    🧠 Memory Map ({memCount})
                </button>
            )}

            {/* Map panel */}
            {isOpen && (
                <div style={{
                    position: 'fixed',
                    bottom: 20,
                    left: 20,
                    background: 'rgba(4,6,14,0.97)',
                    border: '1px solid rgba(45,255,110,0.3)',
                    borderRadius: 12,
                    overflow: 'hidden',
                    zIndex: 100,
                    fontFamily: 'monospace',
                    boxShadow: '0 0 30px rgba(45,255,110,0.1)',
                }}>
                    {/* Header */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                    }}>
                        <div style={{ color: '#2dff6e', fontSize: '11px', letterSpacing: '0.1em', fontWeight: 'bold' }}>
                            🧠 ATLAS MEMORY MAP
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            style={{ background: 'none', border: 'none', color: '#556', cursor: 'pointer', fontSize: '14px' }}
                        >✕</button>
                    </div>

                    {/* Canvas */}
                    <canvas
                        ref={canvasRef}
                        width={MAP_SIZE}
                        height={MAP_SIZE}
                        style={{ display: 'block' }}
                    />

                    {/* Legend */}
                    <div style={{ padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 5 }}>
                            {Object.entries(OBJECT_COLORS).filter(([k]) => k !== 'unknown').map(([type, color]) => (
                                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
                                    <span style={{ fontSize: '9px', color: '#445' }}>{type}</span>
                                </div>
                            ))}
                        </div>
                        <div style={{ fontSize: '10px', color: '#334', display: 'flex', justifyContent: 'space-between' }}>
                            <span>{memCount} remembered · {freshCount} fresh</span>
                            <span style={{ color: '#ff6600' }}>● Atlas</span>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
