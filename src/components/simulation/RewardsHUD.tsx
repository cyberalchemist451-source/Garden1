'use client';

import { useState, useEffect, useRef } from 'react';
import { useSimulationStore } from '@/lib/simulationStore';

/* ─── Task Definitions ─── */

interface Task {
    id: string;
    label: string;
    description: string;
    icon: string;
    check: (state: ReturnType<typeof useSimulationStore.getState>) => boolean;
    scoreOnComplete: number;
    category: 'navigate' | 'interact' | 'explore' | 'social';
}

const TASKS: Task[] = [
    {
        id: 'reach-cabin',
        label: 'Reach the Cabin',
        description: 'Navigate Atlas to within 8m of the cabin',
        icon: '🏠',
        check: (s) => {
            const p = s.robot.position;
            return Math.sqrt(Math.pow(p.x + 20, 2) + Math.pow(p.z + 20, 2)) < 8;
        },
        scoreOnComplete: 100,
        category: 'navigate',
    },
    {
        id: 'sit-down',
        label: 'Find a Seat',
        description: 'Have Atlas sit on a chair',
        icon: '🪑',
        check: (s) => s.robot.isSitting,
        scoreOnComplete: 50,
        category: 'interact',
    },
    {
        id: 'explore-25m',
        label: 'Explorer I',
        description: 'Move 25m from spawn',
        icon: '🧭',
        check: (s) => {
            const p = s.robot.position;
            return Math.sqrt(Math.pow(p.x - 15, 2) + Math.pow(p.z - 15, 2)) > 25;
        },
        scoreOnComplete: 75,
        category: 'explore',
    },
    {
        id: 'know-5-objects',
        label: 'Cartographer',
        description: 'Atlas perceives 5 distinct objects',
        icon: '🗺️',
        check: (s) => Object.keys(s.robot.knownObjects || {}).length >= 5,
        scoreOnComplete: 80,
        category: 'explore',
    },
    {
        id: 'approach-user',
        label: 'Social Presence',
        description: 'Atlas comes within 5m of the user',
        icon: '🤝',
        check: (s) => {
            const r = s.robot.position;
            const u = s.user.position;
            if (!u) return false;
            return Math.sqrt(Math.pow(r.x - u.x, 2) + Math.pow(r.z - u.z, 2)) < 5;
        },
        scoreOnComplete: 60,
        category: 'social',
    },
    {
        id: 'touch-tree',
        label: 'Naturalist',
        description: 'Atlas touches a tree',
        icon: '🌲',
        check: (s) => s.robot.touchingObjects.some(id => id.includes('tree')),
        scoreOnComplete: 40,
        category: 'interact',
    },
    {
        id: 'full-lap',
        label: 'Full Circuit',
        description: 'Reach 50m from spawn then return within 10m',
        icon: '🔄',
        check: () => false, // tracked via component-level logic below
        scoreOnComplete: 150,
        category: 'navigate',
    },
];

const CATEGORY_COLORS: Record<string, string> = {
    navigate: '#00d4ff',
    interact: '#ff9500',
    explore: '#00ff88',
    social: '#ff6eb4',
};

export default function RewardsHUD() {
    const robotPosition = useSimulationStore(s => s.robot.position);
    const robotRotation = useSimulationStore(s => s.robot.rotation);
    const knownObjects = useSimulationStore(s => s.robot.knownObjects);
    const isSitting = useSimulationStore(s => s.robot.isSitting);
    const touchingObjects = useSimulationStore(s => s.robot.touchingObjects);
    const userPosition = useSimulationStore(s => s.user.position);

    const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
    const [score, setScore] = useState(0);
    const [recentBadge, setRecentBadge] = useState<string | null>(null);
    const [expanded, setExpanded] = useState(false);
    const [sessionStart] = useState(Date.now());
    const [collisions, setCollisions] = useState(0);
    const [maxReached, setMaxReached] = useState(0);
    const prevTouching = useRef<string[]>([]);

    const distanceTraveled = Math.sqrt(
        Math.pow(robotPosition.x - 15, 2) +
        Math.pow(robotPosition.z - 15, 2)
    );

    useEffect(() => {
        if (distanceTraveled > maxReached) setMaxReached(distanceTraveled);
    }, [distanceTraveled, maxReached]);

    useEffect(() => {
        const newTouches = touchingObjects.filter(id => !prevTouching.current.includes(id));
        if (newTouches.length > 0) setCollisions(c => c + newTouches.length);
        prevTouching.current = touchingObjects;
    }, [touchingObjects]);

    useEffect(() => {
        const interval = setInterval(() => {
            const state = useSimulationStore.getState();
            TASKS.forEach(task => {
                if (completedTasks.has(task.id)) return;

                let passed = false;
                if (task.id === 'full-lap') {
                    passed = maxReached > 50 && distanceTraveled < 10;
                } else {
                    passed = task.check(state);
                }

                if (passed) {
                    setCompletedTasks(prev => new Set([...prev, task.id]));
                    setScore(prev => prev + task.scoreOnComplete);
                    setRecentBadge(`${task.icon} ${task.label}`);
                    setTimeout(() => setRecentBadge(null), 3500);
                }
            });
        }, 500);
        return () => clearInterval(interval);
    }, [completedTasks, maxReached, distanceTraveled]);

    // suppress unused-var warnings for store selectors only used for reactivity
    void isSitting; void userPosition; void knownObjects;

    const sessionSeconds = Math.floor((Date.now() - sessionStart) / 1000);
    const sessionTime = `${Math.floor(sessionSeconds / 60)}m ${sessionSeconds % 60}s`;
    const completionPct = Math.round((completedTasks.size / TASKS.length) * 100);

    // Equip HUD
    const atlasCarry = useSimulationStore(s => s.robot.carriedObjectId);
    const userCarry = useSimulationStore(s => s.user.carriedObjectId);
    const equipId = atlasCarry || userCarry;
    const equipLabel = equipId ? equipId.replace('toy-', '').replace(/-/g, ' ') : null;
    const swatchMap: Record<string, string> = { 'toy-sphere': '#ef4444', 'toy-cube': '#3b82f6', 'toy-pyramid': '#eab308' };
    const equipSwatch = equipId ? swatchMap[equipId] || '#888' : null;
    const iconMap: Record<string, string> = { sphere: '●', cube: '■', pyramid: '▲' };
    const equipIcon = equipLabel ? iconMap[equipLabel.trim()] || '◆' : null;

    return (
        <>
            {/* Equip HUD — bottom-center */}
            <div style={{
                position: 'fixed',
                bottom: 24,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: equipId ? 'rgba(8,8,20,0.92)' : 'rgba(8,8,20,0.55)',
                border: equipId ? '1px solid rgba(0,212,255,0.5)' : '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10,
                padding: '8px 16px',
                minWidth: 140,
                fontFamily: 'monospace',
                fontSize: 12,
                color: '#ccd',
                zIndex: 200,
                backdropFilter: 'blur(10px)',
                transition: 'all 0.3s ease',
            }}>
                {equipId ? (
                    <>
                        <span style={{ fontSize: 18, color: equipSwatch || '#fff' }}>{equipIcon}</span>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 11, color: equipSwatch || '#ccd', textTransform: 'capitalize' }}>{equipLabel}</div>
                            <div style={{ fontSize: 10, color: '#556', marginTop: 1 }}>carrying</div>
                        </div>
                        <span style={{ fontSize: 10, color: '#445', border: '1px solid #334', borderRadius: 4, padding: '2px 5px' }}>[G] Drop</span>
                    </>
                ) : (
                    <span style={{ color: '#334', fontSize: 11, letterSpacing: '0.1em' }}>— empty hands —</span>
                )}
            </div>

            {/* Badge popup */}
            {recentBadge && (
                <div style={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: 'rgba(0,0,0,0.92)',
                    border: '2px solid #00ff88',
                    borderRadius: '12px',
                    padding: '16px 28px',
                    color: '#00ff88',
                    fontFamily: 'monospace',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    zIndex: 9999,
                    textAlign: 'center',
                    boxShadow: '0 0 40px rgba(0,255,136,0.3)',
                    pointerEvents: 'none',
                }}>
                    <div style={{ fontSize: '11px', opacity: 0.7, marginBottom: 4, letterSpacing: '0.15em' }}>TASK COMPLETE</div>
                    {recentBadge}
                    <div style={{ fontSize: '13px', marginTop: 4, color: '#fff' }}>+{TASKS.find(t => recentBadge!.includes(t.label))?.scoreOnComplete} pts</div>
                </div>
            )}

            {/* Main HUD */}
            <div style={{
                position: 'fixed',
                top: 100,
                right: 16,
                background: 'rgba(8,8,16,0.92)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(0,212,255,0.25)',
                borderRadius: '12px',
                padding: '14px 16px',
                color: '#e0e8ff',
                fontFamily: 'monospace',
                fontSize: '12px',
                minWidth: '220px',
                zIndex: 100,
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ color: '#00d4ff', fontWeight: 'bold', fontSize: '11px', letterSpacing: '0.12em' }}>
                        ATLAS METRICS
                    </div>
                    <button
                        onClick={() => setExpanded(e => !e)}
                        style={{ background: 'none', border: 'none', color: '#00d4ff', cursor: 'pointer', fontSize: '14px', padding: 0 }}
                    >
                        {expanded ? '▲' : '▼'}
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {[
                        ['Distance', `${distanceTraveled.toFixed(1)}m`],
                        ['Position', `${robotPosition.x.toFixed(1)}, ${robotPosition.z.toFixed(1)}`],
                        ['Heading', `${((robotRotation.y * 180 / Math.PI) % 360).toFixed(0)}°`],
                        ['Objects Known', Object.keys(knownObjects || {}).length.toString()],
                        ['Collisions', collisions.toString()],
                    ].map(([label, value]) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#556', fontSize: '11px' }}>{label}</span>
                            <span style={{ color: '#00d4ff', fontWeight: 600 }}>{value}</span>
                        </div>
                    ))}
                </div>

                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: '11px', color: '#556' }}>SCORE</span>
                        <span style={{ color: '#ffd700', fontWeight: 'bold' }}>{score} pts</span>
                    </div>
                    <div style={{ background: '#111', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                        <div style={{ width: `${completionPct}%`, height: '100%', background: 'linear-gradient(90deg, #00d4ff, #00ff88)', transition: 'width 0.5s ease' }} />
                    </div>
                    <div style={{ fontSize: '10px', color: '#445', marginTop: 3 }}>
                        {completedTasks.size}/{TASKS.length} tasks · {completionPct}%
                    </div>
                </div>

                {expanded && (
                    <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 10 }}>
                        <div style={{ fontSize: '10px', color: '#445', marginBottom: 8, letterSpacing: '0.1em' }}>TRAINING TASKS</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
                            {TASKS.map(task => {
                                const done = completedTasks.has(task.id);
                                return (
                                    <div key={task.id} style={{
                                        display: 'flex', alignItems: 'flex-start', gap: 8,
                                        opacity: done ? 1 : 0.55, padding: '5px 7px', borderRadius: 6,
                                        background: done ? 'rgba(0,255,136,0.06)' : 'transparent',
                                        border: done ? '1px solid rgba(0,255,136,0.2)' : '1px solid transparent',
                                        transition: 'all 0.3s',
                                    }}>
                                        <span style={{ fontSize: '14px', flexShrink: 0 }}>{task.icon}</span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '11px', fontWeight: 600, color: done ? '#00ff88' : CATEGORY_COLORS[task.category], display: 'flex', justifyContent: 'space-between' }}>
                                                <span>{task.label}</span>
                                                <span style={{ color: '#ffd700', fontSize: '10px' }}>+{task.scoreOnComplete}</span>
                                            </div>
                                            <div style={{ fontSize: '10px', color: '#445', marginTop: 1 }}>{task.description}</div>
                                        </div>
                                        {done && <span style={{ color: '#00ff88', fontSize: '12px', flexShrink: 0 }}>✓</span>}
                                    </div>
                                );
                            })}
                        </div>
                        <div style={{ marginTop: 8, fontSize: '10px', color: '#334', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 6 }}>
                            Session: {sessionTime} · Max dist: {maxReached.toFixed(1)}m
                        </div>
                    </div>
                )}

                <div style={{ marginTop: 8, fontSize: '10px', color: '#334' }}>CONTROLS: I/K/J/L/U/O · G=Drop</div>
            </div>

            <style>{`
                @keyframes fadeInOut {
                    0% { opacity: 0; transform: translate(-50%, -60%); }
                    15% { opacity: 1; transform: translate(-50%, -50%); }
                    80% { opacity: 1; transform: translate(-50%, -50%); }
                    100% { opacity: 0; transform: translate(-50%, -40%); }
                }
            `}</style>
        </>
    );
}

