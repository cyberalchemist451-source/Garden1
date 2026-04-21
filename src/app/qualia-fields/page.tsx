'use client';

import dynamic from 'next/dynamic';
import NodePanel from '@/components/NodePanel';
import EntropyBar from '@/components/EntropyBar';
import PricingDisplay from '@/components/PricingDisplay';
import BinauralPlayer from '@/components/BinauralPlayer';
import ChatInterface from '@/components/ChatInterface';
import BusStatus from '@/components/BusStatus';
import { useCollectiveStore } from '@/lib/store';
import { useEffect } from 'react';
import Link from 'next/link';

import { Canvas } from '@react-three/fiber';

const CollectiveOrbs3D = dynamic(() => import('@/components/CollectiveOrbs3D'), {
    ssr: false,
});

export default function QualiaFieldsPage() {
    const { initializeNodes, nodes } = useCollectiveStore();

    useEffect(() => {
        if (nodes.length === 0) {
            initializeNodes();
        }
    }, [nodes.length, initializeNodes]);

    return (
        <div className="qualia-container">
            {/* 3D Background */}
            <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
                <Canvas camera={{ position: [0, 8, 20], fov: 50 }}>
                    <ambientLight intensity={0.3} />
                    <pointLight position={[10, 10, 10]} intensity={0.5} />
                    <CollectiveOrbs3D />
                </Canvas>
            </div>

            {/* Header */}
            <header className="qualia-header">
                <div className="header-left">
                    <div className="logo-mark">◆</div>
                    <div className="header-title">
                        <h1>The Living Pattern</h1>
                        <p className="subtitle">Digital Organism Systems — Collective Intelligence Interface</p>
                    </div>
                </div>
                <div className="header-right">
                    <Link href="/qualia-fields/liminal-gallery" style={{
                        padding: '6px 14px', background: 'rgba(179,136,255,0.15)', border: '1px solid rgba(179,136,255,0.4)',
                        borderRadius: '4px', color: '#b388ff', fontSize: '10px', letterSpacing: '1.5px',
                        fontFamily: 'var(--font-mono)', textDecoration: 'none', cursor: 'pointer',
                        transition: 'all 0.2s', marginRight: '8px',
                    }}>▶ LIMINOSITY</Link>
                    <Link href="/qualia-fields/simulation" style={{
                        padding: '6px 14px', background: 'rgba(0,255,136,0.15)', border: '1px solid rgba(0,255,136,0.4)',
                        borderRadius: '4px', color: '#00ff88', fontSize: '10px', letterSpacing: '1.5px',
                        fontFamily: 'var(--font-mono)', textDecoration: 'none', cursor: 'pointer',
                        transition: 'all 0.2s', marginRight: '8px',
                    }}>▶ ENTER 3D SIMULATION</Link>
                    <span className="version-badge">QUALIA FIELDS</span>
                </div>
            </header>

            {/* Left Panel - Nodes */}
            <aside className="panel-left">
                <NodePanel />
            </aside>

            {/* Right Panel - Metrics */}
            <aside className="panel-right">
                <EntropyBar />
                <PricingDisplay />
                <BinauralPlayer />
            </aside>

            {/* Bottom - Chat */}
            <div className="panel-bottom">
                <ChatInterface />
            </div>

            {/* Bus Status Bar */}
            <BusStatus />
        </div>
    );
}
