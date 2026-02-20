'use client';

import { useState, useRef, useEffect } from 'react';
import { useSimulationStore, RobotIntent } from '@/lib/simulationStore';

export interface ChatMessage {
    id: string;
    role: 'user' | 'collective' | 'robot';
    text: string;
    nodeId?: string;
    nodeName?: string;
    nodeAvatar?: string;
    timestamp: number;
    isRobotCommand?: boolean;
}

export default function SimulationChat({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: 'welcome',
            role: 'collective',
            text: 'Collective intelligence online. All nodes active. Awaiting query.',
            nodeName: 'GOD NODE',
            nodeAvatar: '◆',
            timestamp: Date.now(),
        },
    ]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Auto-scroll to latest
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Focus input when chat opens
    useEffect(() => {
        if (isOpen) inputRef.current?.focus();
    }, [isOpen]);

    const handleSend = async () => {
        if (!input.trim() || isThinking) return;

        const userMsg: ChatMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            text: input.trim(),
            timestamp: Date.now(),
        };
        setMessages(prev => [...prev, userMsg]);
        const userInput = input.trim();
        setInput('');
        setIsThinking(true);

        try {
            // Send to Robot API for unified processing (commands + conversation)
            const robotState = useSimulationStore.getState().robot;
            const userState = useSimulationStore.getState().user;

            const response = await fetch('/api/robot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userInput,
                    robotState: {
                        position: robotState.position,
                        rotation: { y: robotState.rotation.y },
                        animation: robotState.animation,
                        nearbyObjects: robotState.nearbyObjects,
                    },
                    userState: {
                        position: userState.position,
                        isSitting: userState.isSitting
                    }
                }),
            });

            if (!response.ok) throw new Error('API Error');

            const data = await response.json();

            // Handle command if present
            // Handle commands if present
            if (data.commands && Array.isArray(data.commands) && data.commands.length > 0) {
                // Multi-command support
                data.commands.forEach((cmd: any) => {
                    if (cmd.type !== 'unknown') {
                        const intent: RobotIntent = {
                            type: cmd.type,
                            action: cmd.action,
                            parameters: cmd.parameters,
                            duration: cmd.duration || 2,
                            completed: false,
                        };
                        useSimulationStore.getState().queueRobotIntent(intent);
                    }
                });

                // Trigger processing if idle
                useSimulationStore.getState().processNextIntent();

            } else if (data.command && data.command.type !== 'unknown') {
                // Backwards compatibility / single command
                const intent: RobotIntent = {
                    type: data.command.type,
                    action: data.command.action,
                    parameters: data.command.parameters,
                    duration: data.command.duration || 2,
                    completed: false,
                };
                useSimulationStore.getState().setRobotIntent(intent);
            }

            const robotResponse: ChatMessage = {
                id: `robot-${Date.now()}`,
                role: 'robot',
                text: data.response,
                nodeName: 'ATLAS ROBOT',
                nodeAvatar: '◇',
                timestamp: Date.now(),
                isRobotCommand: true, // Treat all responses as "valid" robot interactions
            };
            setMessages(prev => [...prev, robotResponse]);

            // Show speech bubble in 3D
            useSimulationStore.getState().setRobotSpeech(data.response);
        } catch (error) {
            const errorMsg: ChatMessage = {
                id: `error-${Date.now()}`,
                role: 'robot',
                text: 'Robot communication error. Please check connection.',
                nodeName: 'SYSTEM',
                nodeAvatar: '⚠',
                timestamp: Date.now(),
            };
            setMessages(prev => [...prev, errorMsg]);
        }
        setIsThinking(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="sim-chat-container">
            {/* Header */}
            <div className="sim-chat-header">
                <span className="sim-chat-title">◆ COLLECTIVE INTERFACE</span>
                <div className="sim-chat-header-actions">
                    <button
                        className={`sim-chat-history-btn ${showHistory ? 'active' : ''}`}
                        onClick={() => setShowHistory(!showHistory)}
                        title="Session History"
                    >
                        ▾ History ({messages.length})
                    </button>
                    <button className="sim-chat-close" onClick={onToggle}>✕</button>
                </div>
            </div>

            {/* History dropdown */}
            {showHistory && (
                <div className="sim-chat-history-dropdown">
                    <div className="sim-chat-history-label">SESSION CONTEXT — {messages.length} messages</div>
                    {messages.map(msg => (
                        <div key={msg.id} className={`sim-chat-history-item ${msg.role}`}>
                            <span className="sim-chat-history-time">
                                {new Date(msg.timestamp).toLocaleTimeString()}
                            </span>
                            <span className="sim-chat-history-sender">
                                {msg.role === 'user' ? 'YOU' : msg.nodeName || 'COLLECTIVE'}
                            </span>
                            <span className="sim-chat-history-preview">
                                {msg.text.slice(0, 60)}{msg.text.length > 60 ? '...' : ''}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Messages */}
            <div className="sim-chat-messages">
                {messages.map(msg => (
                    <div key={msg.id} className={`sim-chat-bubble ${msg.role}`}>
                        {msg.role === 'collective' && (
                            <div className="sim-chat-node-tag">
                                <span className="sim-chat-avatar">{msg.nodeAvatar}</span>
                                <span className="sim-chat-node-name">{msg.nodeName}</span>
                            </div>
                        )}
                        {msg.role === 'robot' && (
                            <div className="sim-chat-node-tag robot-tag">
                                <span className="sim-chat-avatar" style={{ color: '#ff6600' }}>{msg.nodeAvatar}</span>
                                <span className="sim-chat-node-name" style={{ color: '#ff6600' }}>{msg.nodeName}</span>
                            </div>
                        )}
                        {msg.role === 'user' && (
                            <div className="sim-chat-node-tag user-tag">
                                <span className="sim-chat-avatar">●</span>
                                <span className="sim-chat-node-name">YOU</span>
                            </div>
                        )}
                        <div className="sim-chat-text">{msg.text}</div>
                        <div className="sim-chat-time">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                        </div>
                    </div>
                ))}
                {isThinking && (
                    <div className="sim-chat-bubble collective thinking">
                        <div className="sim-chat-node-tag">
                            <span className="sim-chat-avatar">◆</span>
                            <span className="sim-chat-node-name">PROCESSING</span>
                        </div>
                        <div className="sim-chat-thinking-dots">
                            <span>●</span><span>●</span><span>●</span>
                        </div>
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="sim-chat-input-area">
                <textarea
                    ref={inputRef}
                    className="sim-chat-input"
                    placeholder="Query the collective..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                />
                <button
                    className="sim-chat-send"
                    onClick={handleSend}
                    disabled={!input.trim() || isThinking}
                >
                    {isThinking ? '⟳' : '→'}
                </button>
            </div>
        </div>
    );
}
