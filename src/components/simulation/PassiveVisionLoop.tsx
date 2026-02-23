'use client';

import { useEffect, useRef, useState } from 'react';
import { useSimulationStore } from '@/lib/simulationStore';

/* ─── PassiveVisionLoop ─── */
// Periodically captures what Atlas "sees" and sends it to the LLM for narration.
// Generates rich spatial-language training data automatically.
// Fires every VISION_INTERVAL seconds if enabled.

const VISION_INTERVAL = 60; // seconds between passive observations

interface VisionEntry {
    id: string;
    timestamp: number;
    text: string;
    nearbyObjects: string[];
    position: { x: number; z: number };
}

export default function PassiveVisionLoop() {
    const [enabled, setEnabled] = useState(false);
    const [entries, setEntries] = useState<VisionEntry[]>([]);
    const [isCapturing, setIsCapturing] = useState(false);
    const [countdown, setCountdown] = useState(VISION_INTERVAL);
    const [isOpen, setIsOpen] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const countdownRef = useRef<NodeJS.Timeout | null>(null);

    const addChatMessage = useSimulationStore(s => s.addChatMessage);
    const setRobotSpeech = useSimulationStore(s => s.setRobotSpeech);

    const captureAndNarrate = async () => {
        if (isCapturing) return;
        setIsCapturing(true);

        const state = useSimulationStore.getState();
        const robotState = state.robot;
        const userState = state.user;

        // Try to capture screenshot from WebGL canvas
        let imageData: string | null = null;
        try {
            const canvas = document.querySelector('canvas');
            if (canvas) imageData = canvas.toDataURL('image/jpeg', 0.4);
        } catch { /* non-critical */ }

        const nearby = robotState.nearbyObjects.filter(o =>
            !o.includes('terrain') && !o.includes('boundary')
        );
        const knownCount = Object.keys(robotState.knownObjects || {}).length;
        const userPos = userState.position;
        const distFromUser = userPos
            ? Math.sqrt(
                Math.pow(robotState.position.x - userPos.x, 2) +
                Math.pow(robotState.position.z - userPos.z, 2)
            ).toFixed(1)
            : '?';

        try {
            const body: Record<string, unknown> = {
                message: `[PASSIVE VISION SCAN] You are Atlas, an AI inhabiting a 3D world. 
Describe what you observe right now in 1-2 sentences. 
Context: You are at position (${robotState.position.x.toFixed(1)}, ${robotState.position.z.toFixed(1)}).
Nearby: ${nearby.length > 0 ? nearby.join(', ') : 'nothing close by'}.
You know ${knownCount} objects in this world.
The user (human) is ${distFromUser}m away.
Be brief, naturalistic, present-tense.`,
                robotState: {
                    position: robotState.position,
                    rotation: { y: robotState.rotation.y },
                    animation: robotState.animation,
                    nearbyObjects: robotState.nearbyObjects,
                },
                userState: { position: userState.position },
                type: 'analysis',
                ...(imageData ? { image: imageData } : {}),
            };

            const res = await fetch('/api/robot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                const data = await res.json();
                const text = data.response || data.commands?.[0]?.response || 'Scanning...';

                const entry: VisionEntry = {
                    id: `vision-${Date.now()}`,
                    timestamp: Date.now(),
                    text,
                    nearbyObjects: nearby,
                    position: { x: robotState.position.x, z: robotState.position.z },
                };

                setEntries(prev => [entry, ...prev].slice(0, 20));

                // Push to chat and speech bubble
                addChatMessage({
                    role: 'robot',
                    text: `[passive scan] ${text}`,
                    nodeName: 'ATLAS ROBOT',
                    nodeAvatar: '◈',
                });
                setRobotSpeech(text, 6000);
            }
        } catch (e) {
            console.warn('[PassiveVision] Capture failed:', e);
        }

        setIsCapturing(false);
        setCountdown(VISION_INTERVAL);
    };

    // Main loop
    useEffect(() => {
        if (!enabled) {
            if (timerRef.current) clearInterval(timerRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);
            return;
        }

        // Immediate first scan
        captureAndNarrate();

        timerRef.current = setInterval(captureAndNarrate, VISION_INTERVAL * 1000);
        countdownRef.current = setInterval(() => {
            setCountdown(c => c <= 1 ? VISION_INTERVAL : c - 1);
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);
        };
    }, [enabled]);

    return (
        <>
            {/* Toggle button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    style={{
                        position: 'fixed',
                        bottom: 170,
                        right: 20,
                        background: 'rgba(8,8,16,0.9)',
                        border: `1px solid ${enabled ? 'rgba(255,149,0,0.5)' : 'rgba(255,255,255,0.15)'}`,
                        borderRadius: 8,
                        color: enabled ? '#ff9500' : '#556',
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        padding: '8px 12px',
                        cursor: 'pointer',
                        zIndex: 100,
                        letterSpacing: '0.08em',
                    }}
                >
                    👁 Vision {enabled ? `(${countdown}s)` : '(off)'}
                </button>
            )}

            {isOpen && (
                <div style={{
                    position: 'fixed',
                    bottom: 20,
                    right: 260,
                    width: 280,
                    background: 'rgba(4,6,14,0.97)',
                    border: '1px solid rgba(255,149,0,0.3)',
                    borderRadius: 12,
                    overflow: 'hidden',
                    zIndex: 100,
                    fontFamily: 'monospace',
                    boxShadow: '0 0 30px rgba(255,149,0,0.08)',
                }}>
                    {/* Header */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 14px',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                    }}>
                        <div style={{ color: '#ff9500', fontSize: '11px', letterSpacing: '0.1em', fontWeight: 'bold' }}>
                            👁 PASSIVE VISION
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            {/* Toggle */}
                            <button
                                onClick={() => setEnabled(e => !e)}
                                style={{
                                    background: enabled ? '#ff9500' : '#222',
                                    border: '1px solid rgba(255,149,0,0.4)',
                                    borderRadius: 4,
                                    color: enabled ? '#000' : '#ff9500',
                                    fontFamily: 'monospace',
                                    fontSize: '10px',
                                    padding: '3px 8px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                }}
                            >
                                {enabled ? 'ON' : 'OFF'}
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                style={{ background: 'none', border: 'none', color: '#556', cursor: 'pointer', fontSize: '14px' }}
                            >✕</button>
                        </div>
                    </div>

                    {/* Status bar */}
                    {enabled && (
                        <div style={{
                            padding: '6px 14px',
                            background: 'rgba(255,149,0,0.05)',
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}>
                            <div style={{ fontSize: '10px', color: '#ff9500' }}>
                                {isCapturing ? (
                                    <span>◉ Scanning...</span>
                                ) : (
                                    <span>Next scan in {countdown}s</span>
                                )}
                            </div>
                            <button
                                onClick={captureAndNarrate}
                                disabled={isCapturing}
                                style={{
                                    background: 'none',
                                    border: '1px solid rgba(255,149,0,0.3)',
                                    borderRadius: 4,
                                    color: '#ff9500',
                                    fontSize: '10px',
                                    padding: '2px 7px',
                                    cursor: 'pointer',
                                    fontFamily: 'monospace',
                                    opacity: isCapturing ? 0.4 : 1,
                                }}
                            >
                                Scan now
                            </button>
                        </div>
                    )}

                    {/* Log */}
                    <div style={{ maxHeight: 240, overflowY: 'auto', padding: '8px 0' }}>
                        {entries.length === 0 ? (
                            <div style={{ color: '#334', fontSize: '11px', padding: '16px 14px', textAlign: 'center' }}>
                                {enabled ? 'First scan in progress...' : 'Enable to start passive vision scanning'}
                            </div>
                        ) : (
                            entries.map((e, i) => {
                                const age = Math.floor((Date.now() - e.timestamp) / 1000);
                                const ageStr = age < 60 ? `${age}s ago` : `${Math.floor(age / 60)}m ago`;
                                return (
                                    <div key={e.id} style={{
                                        padding: '7px 14px',
                                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                                        opacity: Math.max(0.4, 1 - i * 0.1),
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                            <span style={{ fontSize: '9px', color: '#ff9500', letterSpacing: '0.08em' }}>
                                                ({e.position.x.toFixed(0)}, {e.position.z.toFixed(0)})
                                            </span>
                                            <span style={{ fontSize: '9px', color: '#334' }}>{ageStr}</span>
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#c8c0e8', lineHeight: 1.5 }}>{e.text}</div>
                                        {e.nearbyObjects.length > 0 && (
                                            <div style={{ fontSize: '9px', color: '#445', marginTop: 3 }}>
                                                nearby: {e.nearbyObjects.slice(0, 3).join(', ')}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <div style={{ padding: '8px 14px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '10px', color: '#334' }}>
                        Scans every {VISION_INTERVAL}s · Last {entries.length} stored
                    </div>
                </div>
            )}
        </>
    );
}
