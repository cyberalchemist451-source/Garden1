'use client';

import { useCollectiveStore } from '@/lib/store';
import { getZoneColor } from '@/lib/nodes';
import { motion, AnimatePresence } from 'framer-motion';

export default function NodePanel() {
    const { nodes } = useCollectiveStore();

    return (
        <div className="node-panel">
            <div className="panel-header">
                <span className="panel-icon">◆</span>
                <span>COLLECTIVE NODES</span>
                <span className="node-count">{nodes.length}</span>
            </div>
            <div className="node-list">
                <AnimatePresence>
                    {nodes.map(node => (
                        <motion.div
                            key={node.id}
                            className={`node-item ${node.isActive ? 'active' : ''} ${node.isStreaming ? 'streaming' : ''}`}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <div className="node-avatar" style={{ color: node.identity.color, textShadow: `0 0 8px ${node.identity.color}` }}>
                                {node.identity.avatar}
                            </div>
                            <div className="node-info">
                                <div className="node-name" style={{ color: node.identity.color }}>
                                    {node.identity.displayName}
                                </div>
                                <div className="node-model">{node.identity.model}</div>
                            </div>
                            <div className="node-status-indicator">
                                <div
                                    className={`status-dot ${node.status}`}
                                    style={{ backgroundColor: node.isStreaming ? node.identity.color : node.isActive ? '#00ff88' : '#333' }}
                                />
                                <div className="context-bar">
                                    <div
                                        className="context-fill"
                                        style={{
                                            width: `${node.contextState.usagePercent}%`,
                                            backgroundColor: getZoneColor(node.contextState.zone),
                                        }}
                                    />
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
}
