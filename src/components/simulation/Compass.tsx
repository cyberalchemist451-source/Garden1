'use client';

import { useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';

/**
 * A small compass HUD rendered as an HTML overlay.
 * This is a 2D compass that rotates based on camera direction,
 * always showing N/S/E/W correctly.
 */
export default function Compass() {
    const { camera } = useThree();
    const compassRef = useRef<HTMLDivElement>(null);

    useFrame(() => {
        if (!compassRef.current) return;

        // Get camera's forward direction projected onto XZ plane
        const dir = new THREE.Vector3(0, 0, -1);
        dir.applyQuaternion(camera.quaternion);
        // Angle relative to North (negative Z)
        const angle = Math.atan2(dir.x, -dir.z) * (180 / Math.PI);

        // Direct DOM update - Zero React overhead
        compassRef.current.style.transform = `rotate(${-angle}deg)`;

        // Update tick labels counter-rotation if needed, or just let them spin
        // For simple HUD, spinning the dial is enough
    });

    return (
        <Html fullscreen style={{ pointerEvents: 'none', zIndex: 100 }}>
            <div style={{ position: 'absolute', top: 20, right: 20, width: '100px', height: '100px' }}>
                <div className="compass-container">
                    <div ref={compassRef} className="compass-ring">
                        {['N', 'E', 'S', 'W'].map((label, i) => (
                            <div key={label} className="compass-letter"
                                style={{
                                    transform: `rotate(${i * 90}deg) translateY(-22px)`,
                                    color: label === 'N' ? '#ff4444' : '#aaa',
                                }}
                            >
                                <span style={{ transform: `rotate(${-i * 90}deg)`, display: 'inline-block' }}>
                                    {label}
                                </span>
                            </div>
                        ))}
                        {/* Tick marks */}
                        {Array.from({ length: 12 }, (_, i) => (
                            <div key={i} className="compass-tick"
                                style={{ transform: `rotate(${i * 30}deg)` }}
                            />
                        ))}
                    </div>
                    <div className="compass-needle" />
                </div>
            </div>
        </Html>
    );
}
