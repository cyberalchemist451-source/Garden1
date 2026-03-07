import { useState, useEffect, useRef } from 'react';
import { useSimulationStore, compressKnownObjects } from '@/lib/simulationStore';
import { Send, Loader2, MessageCircle, X } from 'lucide-react';

export default function SimulationChat() {
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const {
        chatHistory,
        addChatMessage,
        isChatOpen,
        setChatOpen,
        robot: robotState,
        user: userState,
        queueRobotIntent,
    } = useSimulationStore();

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory]);

    const handleSend = async () => {
        if (!userInput.trim() || isLoading) return;

        const msg = userInput.trim();
        setUserInput('');

        // Add user message to chat
        addChatMessage({
            role: 'user',
            text: msg,
        });

        setIsLoading(true);

        try {
            // OPTIMIZED: Compress all state before sending
            const response = await fetch('/api/robot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: msg,
                    robotState: {
                        // Compressed position (1 decimal place)
                        position: {
                            x: Math.round(robotState.position.x * 10) / 10,
                            y: Math.round(robotState.position.y * 10) / 10,
                            z: Math.round(robotState.position.z * 10) / 10
                        },
                        rotation: { y: Math.round(robotState.rotation.y * 100) / 100 },
                        animation: robotState.animation,
                        // Only send nearby object IDs, max 10
                        nearbyObjects: robotState.nearbyObjects.slice(0, 10),
                        // Compressed known objects summary
                        knownObjectsSummary: compressKnownObjects(robotState.knownObjects || {}),
                    },
                    userState: {
                        position: userState.position ? {
                            x: Math.round(userState.position.x * 10) / 10,
                            y: Math.round(userState.position.y * 10) / 10,
                            z: Math.round(userState.position.z * 10) / 10
                        } : null,
                        isSitting: userState.isSitting
                    },
                    // Only last 10 chat messages
                    recentChatHistory: chatHistory.slice(-10).map(msg => ({
                        role: msg.role,
                        text: msg.text.slice(0, 200) // Truncate long messages
                    }))
                }),
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Network error');
            }

            const data = await response.json();

            // Add collective response
            addChatMessage({
                role: 'collective',
                text: data.response || 'No response.',
                nodeName: 'COLLECTIVE',
            });

            // Queue commands
            const cmds = data.commands || [data.command];
            if (cmds && cmds.length > 0) {
                for (const cmd of cmds) {
                    if (cmd && cmd.type !== 'chat') {
                        queueRobotIntent({
                            ...cmd,
                            completed: false,
                        });
                    }
                }
            }

        } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'Unknown error';
            addChatMessage({
                role: 'collective',
                text: `Error: ${errMsg}`,
                nodeName: 'SYSTEM',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!isChatOpen) {
        return (
            <button
                onClick={() => setChatOpen(true)}
                className="fixed bottom-4 right-4 z-50 pointer-events-auto bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 p-4 rounded-full border border-cyan-500/30 backdrop-blur-sm transition-all"
                title="Open Chat"
            >
                <MessageCircle size={24} />
            </button>
        );
    }

    return (
        <div className="fixed bottom-4 right-4 z-50 pointer-events-auto w-96 h-[500px] bg-black/80 backdrop-blur-md border border-cyan-500/30 rounded-lg shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-cyan-500/30">
                <h3 className="text-cyan-300 font-semibold">Collective Interface</h3>
                <button
                    onClick={() => setChatOpen(false)}
                    className="text-cyan-500/50 hover:text-cyan-300 transition-colors"
                >
                    <X size={20} />
                </button>
            </div>

            {/* Chat History */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 text-sm">
                {chatHistory.map((msg) => (
                    <div
                        key={msg.id}
                        className={`p-2 rounded ${msg.role === 'user'
                            ? 'bg-blue-500/20 text-blue-200 ml-8'
                            : 'bg-cyan-500/10 text-cyan-200 mr-8'
                            }`}
                    >
                        <div className="font-semibold text-xs opacity-70 mb-1">
                            {msg.role === 'user' ? 'You' : msg.nodeName || 'Collective'}
                        </div>
                        <div>{msg.text}</div>
                    </div>
                ))}
                <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-cyan-500/30">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Send a message..."
                        disabled={isLoading}
                        className="flex-1 bg-black/50 border border-cyan-500/30 rounded px-3 py-2 text-cyan-200 placeholder-cyan-700 focus:outline-none focus:border-cyan-500"
                    />
                    <button
                        onClick={handleSend}
                        disabled={isLoading || !userInput.trim()}
                        className="bg-cyan-500/20 hover:bg-cyan-500/30 disabled:bg-gray-500/20 text-cyan-300 disabled:text-gray-500 p-2 rounded transition-colors"
                    >
                        {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                    </button>
                </div>
            </div>
        </div>
    );
}
