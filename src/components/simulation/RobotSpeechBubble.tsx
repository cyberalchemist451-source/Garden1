'use client';

import { useRef, useEffect, useState } from 'react';
import { Html } from '@react-three/drei';
import { useSimulationStore } from '@/lib/simulationStore';
import { useFrame } from '@react-three/fiber';

export function RobotSpeechBubble() {
    const currentSpeech = useSimulationStore(s => s.robot.currentSpeech);
    const [isVisible, setIsVisible] = useState(false);
    const [text, setText] = useState('');

    // Check if speech is active
    useFrame(() => {
        if (!currentSpeech) {
            if (isVisible) setIsVisible(false);
            return;
        }

        const now = Date.now();
        const elapsed = now - currentSpeech.timestamp;

        if (elapsed < currentSpeech.duration) {
            if (!isVisible || text !== currentSpeech.text) {
                setIsVisible(true);
                setText(currentSpeech.text);
            }
        } else {
            if (isVisible) setIsVisible(false);
        }
    });

    if (!isVisible) return null;

    return (
        <Html position={[0, 2.8, 0]} center distanceFactor={10}>
            <div style={{
                background: 'rgba(20, 20, 25, 0.9)',
                border: '1px solid #ff6600',
                borderRadius: '12px',
                padding: '12px 16px',
                color: '#fff',
                fontFamily: 'monospace',
                fontSize: '14px',
                maxWidth: '350px',
                textAlign: 'center',
                boxShadow: '0 0 15px rgba(255, 102, 0, 0.3)',
                pointerEvents: 'none',
                userSelect: 'none',
            }}>
                <div style={{
                    position: 'absolute',
                    bottom: '-6px',
                    left: '50%',
                    transform: 'translateX(-50%) rotate(45deg)',
                    width: '10px',
                    height: '10px',
                    background: 'rgba(20, 20, 25, 0.9)',
                    borderRight: '1px solid #ff6600',
                    borderBottom: '1px solid #ff6600',
                }} />
                {text}
            </div>
        </Html>
    );
}
