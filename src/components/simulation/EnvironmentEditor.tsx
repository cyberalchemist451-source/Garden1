'use client';

import { useState } from 'react';
import { useSimulationStore, ColliderBox, EnvironmentConfig } from '@/lib/simulationStore';

/* ─── EnvironmentEditor ─── */
// A click-based panel to modify the 3D world without touching code.
// Place trees, rocks, adjust lighting, terrain, and reset/save environments.

const PRESETS: EnvironmentConfig[] = [
    {
        id: 'default-field',
        name: 'Qualia Field',
        terrain: { size: 142, seed: 42, heightScale: 6, grassDensity: 1500, dirtPatchCount: 12 },
        vegetation: { treeCount: 40, treeRadius: 130 },
        rocks: { count: 60, maxScale: 4 },
        lighting: { sunAngle: 55, sunIntensity: 1.2, ambient: 0.35, fogDensity: 0.003 },
        robot: { startPosition: { x: 0, y: 0, z: 0 }, scale: 1.5 },
        portals: [],
    },
    {
        id: 'sparse-desert',
        name: 'Sparse Desert',
        terrain: { size: 142, seed: 99, heightScale: 3, grassDensity: 300, dirtPatchCount: 40 },
        vegetation: { treeCount: 5, treeRadius: 120 },
        rocks: { count: 120, maxScale: 6 },
        lighting: { sunAngle: 75, sunIntensity: 1.8, ambient: 0.5, fogDensity: 0.001 },
        robot: { startPosition: { x: 0, y: 0, z: 0 }, scale: 1.5 },
        portals: [],
    },
    {
        id: 'dense-forest',
        name: 'Dense Forest',
        terrain: { size: 142, seed: 77, heightScale: 8, grassDensity: 3000, dirtPatchCount: 5 },
        vegetation: { treeCount: 120, treeRadius: 130 },
        rocks: { count: 20, maxScale: 2 },
        lighting: { sunAngle: 30, sunIntensity: 0.8, ambient: 0.25, fogDensity: 0.008 },
        robot: { startPosition: { x: 0, y: 0, z: 0 }, scale: 1.5 },
        portals: [],
    },
    {
        id: 'flat-obstacle',
        name: 'Obstacle Course',
        terrain: { size: 142, seed: 1, heightScale: 1, grassDensity: 800, dirtPatchCount: 8 },
        vegetation: { treeCount: 15, treeRadius: 60 },
        rocks: { count: 80, maxScale: 3 },
        lighting: { sunAngle: 45, sunIntensity: 1.0, ambient: 0.4, fogDensity: 0.002 },
        robot: { startPosition: { x: -30, y: 0, z: 0 }, scale: 1.5 },
        portals: [],
    },
];

export default function EnvironmentEditor() {
    const [isOpen, setIsOpen] = useState(false);
    const [tab, setTab] = useState<'presets' | 'terrain' | 'objects' | 'lighting'>('presets');
    const [feedback, setFeedback] = useState<string | null>(null);

    const environment = useSimulationStore(s => s.environment);
    const colliders = useSimulationStore(s => s.colliders);
    const loadEnvironment = useSimulationStore(s => s.loadEnvironment);
    const addCollider = useSimulationStore(s => s.addCollider);
    const removeCollider = useSimulationStore(s => s.removeCollider);

    const [terrainSeed, setTerrainSeed] = useState(environment.terrain.seed);
    const [heightScale, setHeightScale] = useState(environment.terrain.heightScale);
    const [treeCount, setTreeCount] = useState(environment.vegetation.treeCount);
    const [rockCount, setRockCount] = useState(environment.rocks.count);
    const [sunAngle, setSunAngle] = useState(environment.lighting.sunAngle);
    const [fogDensity, setFogDensity] = useState(environment.lighting.fogDensity);
    const [ambient, setAmbient] = useState(environment.lighting.ambient);

    const flash = (msg: string) => {
        setFeedback(msg);
        setTimeout(() => setFeedback(null), 2000);
    };

    const applyTerrain = () => {
        loadEnvironment({
            ...environment,
            terrain: { ...environment.terrain, seed: terrainSeed, heightScale },
            vegetation: { ...environment.vegetation, treeCount },
            rocks: { ...environment.rocks, count: rockCount },
            lighting: { ...environment.lighting, sunAngle, fogDensity, ambient },
        });
        flash('✓ Environment updated! Reload the page to regenerate terrain.');
    };

    const placeRandomObject = (type: 'tree' | 'rock' | 'log') => {
        const robotPos = useSimulationStore.getState().robot.position;
        const offset = { x: (Math.random() - 0.5) * 20, z: (Math.random() - 0.5) * 20 };
        const newCollider: ColliderBox = {
            id: `placed-${type}-${Date.now()}`,
            type: type === 'log' ? 'log' : type,
            position: {
                x: robotPos.x + offset.x,
                y: 0,
                z: robotPos.z + offset.z,
            },
            size: type === 'tree' ? { x: 2, y: 5, z: 2 } :
                type === 'rock' ? { x: 2, y: 1.5, z: 2 } :
                    { x: 3, y: 0.6, z: 0.6 },
            interactable: false,
            climbable: type === 'log',
        };
        addCollider(newCollider);
        flash(`✓ Placed ${type} near Atlas`);
    };

    const clearPlacedObjects = () => {
        const placed = colliders.filter(c => c.id.startsWith('placed-'));
        placed.forEach(c => removeCollider(c.id));
        flash(`✓ Removed ${placed.length} placed objects`);
    };

    const placedCount = colliders.filter(c => c.id.startsWith('placed-')).length;

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                style={{
                    position: 'fixed',
                    bottom: 210,
                    right: 20,
                    background: 'rgba(8,8,16,0.9)',
                    border: '1px solid rgba(170,168,255,0.35)',
                    borderRadius: 8,
                    color: '#aaa8ff',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    padding: '8px 12px',
                    cursor: 'pointer',
                    zIndex: 100,
                    letterSpacing: '0.08em',
                }}
            >
                🌍 World Editor
            </button>
        );
    }

    return (
        <div style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            width: 280,
            background: 'rgba(4,6,14,0.97)',
            border: '1px solid rgba(170,168,255,0.3)',
            borderRadius: 12,
            overflow: 'hidden',
            zIndex: 100,
            fontFamily: 'monospace',
            boxShadow: '0 0 30px rgba(170,168,255,0.08)',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                flexShrink: 0,
            }}>
                <div style={{ color: '#aaa8ff', fontSize: '11px', letterSpacing: '0.1em', fontWeight: 'bold' }}>
                    🌍 WORLD EDITOR
                </div>
                <button
                    onClick={() => setIsOpen(false)}
                    style={{ background: 'none', border: 'none', color: '#556', cursor: 'pointer', fontSize: '14px' }}
                >✕</button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
                {(['presets', 'terrain', 'objects', 'lighting'] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        style={{
                            flex: 1,
                            background: tab === t ? 'rgba(170,168,255,0.1)' : 'none',
                            border: 'none',
                            borderBottom: tab === t ? '2px solid #aaa8ff' : '2px solid transparent',
                            color: tab === t ? '#aaa8ff' : '#445',
                            fontFamily: 'monospace',
                            fontSize: '10px',
                            padding: '7px 4px',
                            cursor: 'pointer',
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase',
                        }}
                    >
                        {t}
                    </button>
                ))}
            </div>

            {/* Feedback */}
            {feedback && (
                <div style={{
                    padding: '6px 14px',
                    background: 'rgba(0,255,136,0.08)',
                    borderBottom: '1px solid rgba(0,255,136,0.15)',
                    color: '#00ff88',
                    fontSize: '11px',
                    flexShrink: 0,
                }}>
                    {feedback}
                </div>
            )}

            {/* Content */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '12px 14px' }}>

                {/* PRESETS TAB */}
                {tab === 'presets' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ fontSize: '10px', color: '#445', marginBottom: 4 }}>
                            Choose a preset environment. Reloads terrain and objects.
                        </div>
                        {PRESETS.map(preset => (
                            <button
                                key={preset.id}
                                onClick={() => {
                                    loadEnvironment(preset);
                                    flash(`✓ Loaded "${preset.name}" — reload page to see new terrain`);
                                }}
                                style={{
                                    background: environment.id === preset.id
                                        ? 'rgba(170,168,255,0.12)' : 'rgba(255,255,255,0.03)',
                                    border: `1px solid ${environment.id === preset.id ? 'rgba(170,168,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                                    borderRadius: 8,
                                    color: environment.id === preset.id ? '#aaa8ff' : '#778',
                                    fontFamily: 'monospace',
                                    fontSize: '12px',
                                    padding: '10px 12px',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    width: '100%',
                                }}
                            >
                                <div style={{ fontWeight: 'bold', marginBottom: 3 }}>{preset.name}</div>
                                <div style={{ fontSize: '10px', opacity: 0.6 }}>
                                    {preset.vegetation.treeCount} trees · {preset.rocks.count} rocks · h={preset.terrain.heightScale}
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {/* TERRAIN TAB */}
                {tab === 'terrain' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ fontSize: '10px', color: '#445' }}>Adjust terrain parameters then click Apply.</div>
                        {[
                            { label: 'Terrain Seed', value: terrainSeed, min: 1, max: 999, step: 1, set: setTerrainSeed, desc: 'Changes terrain shape' },
                            { label: 'Height Scale', value: heightScale, min: 0, max: 15, step: 0.5, set: setHeightScale, desc: 'Hill height' },
                            { label: 'Tree Count', value: treeCount, min: 0, max: 200, step: 5, set: setTreeCount, desc: 'Trees in world' },
                            { label: 'Rock Count', value: rockCount, min: 0, max: 200, step: 5, set: setRockCount, desc: 'Rocks in world' },
                        ].map(({ label, value, min, max, step, set, desc }) => (
                            <div key={label}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <span style={{ fontSize: '11px', color: '#aaa8ff' }}>{label}</span>
                                    <span style={{ fontSize: '11px', color: '#fff' }}>{value}</span>
                                </div>
                                <input
                                    type="range" min={min} max={max} step={step} value={value}
                                    onChange={e => set(Number(e.target.value))}
                                    style={{ width: '100%', accentColor: '#aaa8ff' }}
                                />
                                <div style={{ fontSize: '9px', color: '#334' }}>{desc}</div>
                            </div>
                        ))}
                        <button onClick={applyTerrain} style={{ background: '#aaa8ff', border: 'none', borderRadius: 6, color: '#000', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '12px', padding: '9px', cursor: 'pointer', marginTop: 4 }}>
                            Apply Changes
                        </button>
                    </div>
                )}

                {/* OBJECTS TAB */}
                {tab === 'objects' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ fontSize: '10px', color: '#445', marginBottom: 4 }}>Place objects near Atlas's current position.</div>
                        {[
                            { type: 'tree' as const, icon: '🌲', label: 'Place Tree', desc: 'Adds a tree obstacle near Atlas' },
                            { type: 'rock' as const, icon: '🪨', label: 'Place Rock', desc: 'Adds a rock near Atlas' },
                            { type: 'log' as const, icon: '🪵', label: 'Place Log', desc: 'Adds a climbable log near Atlas' },
                        ].map(({ type, icon, label, desc }) => (
                            <button
                                key={type}
                                onClick={() => placeRandomObject(type)}
                                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#aaa8ff', fontFamily: 'monospace', fontSize: '12px', padding: '10px 12px', cursor: 'pointer', textAlign: 'left', width: '100%', display: 'flex', gap: 10, alignItems: 'center' }}
                            >
                                <span style={{ fontSize: '18px' }}>{icon}</span>
                                <div>
                                    <div style={{ fontWeight: 'bold' }}>{label}</div>
                                    <div style={{ fontSize: '10px', opacity: 0.5 }}>{desc}</div>
                                </div>
                            </button>
                        ))}
                        {placedCount > 0 && (
                            <button onClick={clearPlacedObjects} style={{ background: 'rgba(255,60,60,0.08)', border: '1px solid rgba(255,60,60,0.2)', borderRadius: 8, color: '#ff6060', fontFamily: 'monospace', fontSize: '11px', padding: '8px 12px', cursor: 'pointer', marginTop: 4 }}>
                                🗑 Clear {placedCount} placed objects
                            </button>
                        )}
                        <div style={{ fontSize: '10px', color: '#334', marginTop: 4 }}>Total colliders: {colliders.length} · Placed: {placedCount}</div>
                    </div>
                )}

                {/* LIGHTING TAB */}
                {tab === 'lighting' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ fontSize: '10px', color: '#445' }}>Adjust lighting and atmosphere.</div>
                        {[
                            { label: 'Sun Angle', value: sunAngle, min: 0, max: 90, step: 1, set: setSunAngle, desc: 'Sun elevation angle' },
                            { label: 'Ambient Light', value: ambient, min: 0, max: 1, step: 0.05, set: setAmbient, desc: 'Overall brightness' },
                            { label: 'Fog Density', value: fogDensity, min: 0, max: 0.02, step: 0.001, set: setFogDensity, desc: 'How thick the fog is' },
                        ].map(({ label, value, min, max, step, set, desc }) => (
                            <div key={label}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <span style={{ fontSize: '11px', color: '#aaa8ff' }}>{label}</span>
                                    <span style={{ fontSize: '11px', color: '#fff' }}>{value}</span>
                                </div>
                                <input
                                    type="range" min={min} max={max} step={step} value={value}
                                    onChange={e => set(Number(e.target.value))}
                                    style={{ width: '100%', accentColor: '#aaa8ff' }}
                                />
                                <div style={{ fontSize: '9px', color: '#334' }}>{desc}</div>
                            </div>
                        ))}
                        <button onClick={applyTerrain} style={{ background: '#aaa8ff', border: 'none', borderRadius: 6, color: '#000', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '12px', padding: '9px', cursor: 'pointer', marginTop: 4 }}>
                            Apply Lighting
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
