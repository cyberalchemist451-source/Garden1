'use client';

import { useState } from 'react';
import { useSimulationStore } from '@/lib/simulationStore';

export default function ExperienceMonitor() {
    const [isOpen, setIsOpen] = useState(false);

    // Get temporal metrics from store
    const temporalMetrics = useSimulationStore(s => s.robot.temporalMetrics);
    const setCompressionRatio = useSimulationStore(s => s.setRobotCompressionRatio);

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                style={{
                    position: 'fixed',
                    bottom: 80,
                    right: 20,
                    background: '#ff6600',
                    color: '#fff',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '12px',
                    zIndex: 100,
                    fontFamily: 'monospace',
                }}
            >
                🤖 Experience
            </button>
        );
    }

    return (
        <div style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            background: 'rgba(20, 20, 30, 0.95)',
            border: '1px solid #ff6600',
            borderRadius: '8px',
            padding: '16px',
            width: '280px',
            color: '#fff',
            fontSize: '13px',
            zIndex: 100,
            fontFamily: 'monospace',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <strong style={{ color: '#ff6600' }}>ATLAS EXPERIENCE</strong>
                <button
                    onClick={() => setIsOpen(false)}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: '#fff',
                        cursor: 'pointer',
                        fontSize: '16px',
                    }}
                >
                    ✕
                </button>
            </div>

            {/* Time Display */}
            <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #333' }}>
                <div style={{ fontSize: '10px', opacity: 0.6, marginBottom: '4px' }}>EXPERIENTIAL TIME</div>
                <div style={{ color: '#ff6600', fontSize: '14px', fontWeight: 'bold' }}>
                    {formatTime(temporalMetrics?.experiencedTime || 0)}
                </div>
                <div style={{ fontSize: '10px', opacity: 0.6, marginTop: '2px' }}>
                    Real: {formatTime(temporalMetrics?.realTime || 0)}
                </div>
            </div>

            {/* Compression Ratio */}
            <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '10px', opacity: 0.6, marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>TIME COMPRESSION</span>
                    <span style={{ color: '#ff6600', fontWeight: 'bold' }}>
                        {temporalMetrics?.compressionRatio.toFixed(1)}x
                    </span>
                </div>
                <input
                    type="range"
                    min="0.1"
                    max="5.0"
                    step="0.1"
                    value={temporalMetrics?.compressionRatio || 1.0}
                    onChange={(e) => {
                        setCompressionRatio(parseFloat(e.target.value));
                    }}
                    style={{
                        width: '100%',
                        accentColor: '#ff6600',
                    }}
                />
                <div style={{ fontSize: '9px', opacity: 0.5, marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>0.1x slow</span>
                    <span>1.0x real</span>
                    <span>5.0x fast</span>
                </div>
            </div>

            {/* Token Usage */}
            <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '10px', opacity: 0.6, marginBottom: '6px' }}>TOKEN BUDGET</div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{
                        flex: 1,
                        background: '#222',
                        borderRadius: '4px',
                        height: '12px',
                        overflow: 'hidden',
                        border: '1px solid #333',
                    }}>
                        <div style={{
                            width: `${Math.min(100, ((temporalMetrics?.tokensUsed || 0) / (temporalMetrics?.tokenBudget || 1)) * 100)}%`,
                            height: '100%',
                            background: (temporalMetrics?.tokensUsed || 0) > (temporalMetrics?.tokenBudget || 1)
                                ? '#ff4444'
                                : '#00ff88',
                            transition: 'width 0.3s, background 0.3s',
                        }}></div>
                    </div>
                    <div style={{ fontSize: '10px', minWidth: '60px', textAlign: 'right' }}>
                        {temporalMetrics?.tokensUsed || 0}/{temporalMetrics?.tokenBudget || 0}
                    </div>
                </div>
            </div>

            {/* Memory Coherence */}
            <div>
                <div style={{ fontSize: '10px', opacity: 0.6, marginBottom: '6px' }}>MEMORY COHERENCE</div>
                <div style={{
                    display: 'flex',
                    gap: '4px',
                    alignItems: 'center',
                }}>
                    <div style={{
                        flex: 1,
                        background: '#222',
                        borderRadius: '4px',
                        height: '8px',
                        overflow: 'hidden',
                        border: '1px solid #333',
                    }}>
                        <div style={{
                            width: `${(temporalMetrics?.memoryCoherence || 0) * 100}%`,
                            height: '100%',
                            background: `hsl(${(temporalMetrics?.memoryCoherence || 0) * 120}, 70%, 50%)`,
                            transition: 'width 0.5s, background 0.5s',
                        }}></div>
                    </div>
                    <div style={{ fontSize: '10px', minWidth: '40px', textAlign: 'right' }}>
                        {((temporalMetrics?.memoryCoherence || 0) * 100).toFixed(0)}%
                    </div>
                </div>
            </div>
        </div>
    );
}

function formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}h ${mins}m ${secs}s`;
    } else if (mins > 0) {
        return `${mins}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
}
