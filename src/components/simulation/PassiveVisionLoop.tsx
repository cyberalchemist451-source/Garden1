import { useEffect, useRef, useState } from 'react';
import { useSimulationStore, compressKnownObjects } from '@/lib/simulationStore';

export default function PassiveVisionLoop({ enabled = false }: { enabled?: boolean }) {
    const {
        robot: robotState,
        user: userState,
        addChatMessage,
        setRobotSpeech,
        consolidateMemory,
    } = useSimulationStore();

    const [scanCount, setScans] = useState(0);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!enabled) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return;
        }

        // Run memory consolidation every 5 minutes
        const consolidationInterval = setInterval(() => {
            consolidateMemory();
            console.log('[PassiveVision] Memory consolidated');
        }, 300000); // 5 minutes

        // Passive vision scan every 60 seconds
        intervalRef.current = setInterval(async () => {
            setScans(prev => prev + 1);

            try {
                // Filter nearby objects (no terrain, no robot)
                const nearby = robotState.nearbyObjects
                    .filter(o => !o.includes('terrain') && !o.includes('robot'))
                    .slice(0, 5); // Only 5 nearest

                const knownCount = Object.keys(robotState.knownObjects || {}).length;

                // Calculate distance from user
                const dx = robotState.position.x - (userState.position?.x || 0);
                const dz = robotState.position.z - (userState.position?.z || 0);
                const distFromUser = Math.sqrt(dx * dx + dz * dz).toFixed(1);

                // OPTIMIZED: Capture screenshot (compressed, only every 3rd scan)
                let imageData: string | null = null;
                if (scanCount % 3 === 0) {
                    try {
                        const canvas = document.querySelector('canvas');
                        if (canvas) {
                            // Resize for compression
                            const tempCanvas = document.createElement('canvas');
                            tempCanvas.width = 512;
                            tempCanvas.height = 512;
                            const ctx = tempCanvas.getContext('2d');
                            if (ctx) {
                                ctx.drawImage(canvas, 0, 0, 512, 512);
                                imageData = tempCanvas.toDataURL('image/jpeg', 0.3); // Low quality
                            }
                        }
                    } catch (e) {
                        console.warn('[PassiveVision] Screenshot failed:', e);
                    }
                }

                // OPTIMIZED: Minimal payload
                const body = {
                    message: `[PASSIVE VISION SCAN] You are Atlas at (${robotState.position.x.toFixed(1)}, ${robotState.position.z.toFixed(1)}). 
Nearby: ${nearby.slice(0, 5).join(', ') || 'nothing close'}.
You know ${knownCount} objects total.
User is ${distFromUser}m away.
Describe what you observe in 1-2 sentences, present-tense.`,

                    robotState: {
                        position: {
                            x: Math.round(robotState.position.x * 10) / 10,
                            z: Math.round(robotState.position.z * 10) / 10
                        },
                        // Don't send rotation for passive scans
                        nearbyObjects: nearby.slice(0, 5), // Only 5 nearest
                        knownCount, // Just the count, not full registry
                    },
                    userState: {
                        position: userState.position ? {
                            x: Math.round(userState.position.x * 10) / 10,
                            z: Math.round(userState.position.z * 10) / 10
                        } : null
                    },
                    type: 'analysis',
                    // Only send image every 3rd scan
                    ...(imageData ? { image: imageData } : {}),
                };

                const res = await fetch('/api/robot', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });

                if (!res.ok) {
                    console.warn('[PassiveVision] API error:', res.status);
                    return;
                }

                const data = await res.json();

                if (data.response) {
                    // Add to chat history
                    addChatMessage({
                        role: 'robot',
                        text: `[Passive Scan] ${data.response}`,
                        nodeName: 'VISION',
                    });

                    // Show speech bubble
                    setRobotSpeech(data.response, 4000);
                }

            } catch (err) {
                console.error('[PassiveVision] Error:', err);
            }

        }, 60000); // 60 seconds

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            clearInterval(consolidationInterval);
        };
    }, [enabled, robotState.nearbyObjects, robotState.position, userState.position, scanCount]);

    return null; // No UI
}
