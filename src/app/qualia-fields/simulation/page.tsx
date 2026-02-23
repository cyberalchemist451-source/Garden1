'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useSimulationStore } from '@/lib/simulationStore';
import KeybindMenu from '@/components/simulation/KeybindMenu';
import RewardsHUD from '@/components/simulation/RewardsHUD';
import SimulationChat from '@/components/simulation/SimulationChat';
import ErrorBoundary from '@/components/simulation/ErrorBoundary';
import ExperienceMonitor from '@/components/simulation/ExperienceMonitor';
import MemoryMapOverlay from '@/components/simulation/MemoryMapOverlay';
import PassiveVisionLoop from '@/components/simulation/PassiveVisionLoop';
import EnvironmentEditor from '@/components/simulation/EnvironmentEditor';

// Dynamic import of the WRAPPER (contains Canvas + Scene)
// This ensures that ALL 3D code stays on the client side only.
const SimulationWrapper = dynamic(() => import('@/components/simulation/SimulationWrapper'), {
    ssr: false,
    loading: () => <Loader />
});

function Loader() {
    return (
        <div className="absolute inset-0 flex items-center justify-center text-emerald-400 font-mono tracking-widest z-50 bg-black">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <div className="animate-pulse">LOADING SIMULATION...</div>
            </div>
        </div>
    );
}

export default function SimulationPage() {
    const [showKeys, setShowKeys] = useState(false);
    const showChat = useSimulationStore(s => s.isChatOpen);
    const setChatOpen = useSimulationStore(s => s.setChatOpen);

    const [mounted, setMounted] = useState(false);
    const [debugError, setDebugError] = useState<string | null>(null);

    useEffect(() => {
        setMounted(true);

        const handleError = (event: ErrorEvent) => {
            setDebugError(`${event.message}\n${event.filename}:${event.lineno}`);
        };
        const handleRejection = (event: PromiseRejectionEvent) => {
            setDebugError(`Unhandled Promise Rejection: ${event.reason}`);
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter' && !useSimulationStore.getState().isChatOpen) {
                e.preventDefault();
                setChatOpen(true);
            }
            if (e.key === 'Escape' && useSimulationStore.getState().isChatOpen) {
                setChatOpen(false);
            }
        };

        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleRejection);
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleRejection);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    if (debugError) {
        return (
            <div className="fixed inset-0 z-[9999] bg-red-900/90 text-white p-8 font-mono overflow-auto">
                <h1 className="text-2xl font-bold mb-4">CRITICAL STARTUP ERROR</h1>
                <pre className="text-sm whitespace-pre-wrap">{debugError}</pre>
                <button
                    onClick={() => window.location.reload()}
                    className="mt-8 px-4 py-2 bg-white text-red-900 font-bold rounded"
                >
                    RELOAD
                </button>
            </div>
        );
    }

    if (!mounted) return <Loader />;

    return (
        <div style={{ width: '100vw', height: '100vh', background: '#050a08', position: 'relative' }}>
            <ErrorBoundary content={
                <div className="absolute inset-0 z-0">
                    <SimulationWrapper />
                </div>
            } />

            {/* Top Left - Keybinds */}
            <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 10 }}>
                <KeybindMenu isOpen={showKeys} onToggle={() => setShowKeys(!showKeys)} />
            </div>

            {/* Top Right - Rewards HUD (Feature 1: Task & Reward System) */}
            <RewardsHUD />

            {/* Bottom Left - Memory Map (Feature 2) */}
            <MemoryMapOverlay />

            {/* Right side stack - Passive Vision (Feature 3) */}
            <PassiveVisionLoop />

            {/* Right side stack - World Editor (Feature 4) */}
            <EnvironmentEditor />

            {/* Bottom Right - Controls legend */}
            <div style={{
                position: 'absolute',
                bottom: 20,
                right: 20,
                color: 'rgba(255,255,255,0.35)',
                fontFamily: 'monospace',
                fontSize: '11px',
                zIndex: 10,
                textAlign: 'right',
                pointerEvents: 'none',
            }}>
                <p><strong style={{ color: 'rgba(255,255,255,0.5)' }}>User:</strong> WASD/QE | Shift Sprint | F Flex | Right-click Chair</p>
                <p><strong style={{ color: 'rgba(255,255,255,0.5)' }}>Atlas:</strong> IJKL/UO to control robot</p>
                <p>Scroll to Zoom | Drag to Rotate | Enter to Chat</p>
            </div>

            {/* Chat Interface */}
            <SimulationChat isOpen={showChat} onToggle={() => setChatOpen(!showChat)} />

            {/* Experience Monitor */}
            <ExperienceMonitor />
        </div>
    );
}
