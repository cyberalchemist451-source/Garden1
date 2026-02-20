'use client';

import { useState, useRef, useEffect } from 'react';
import { useCollectiveStore } from '@/lib/store';
import { motion } from 'framer-motion';

export default function ChatInterface() {
    const [input, setInput] = useState('');
    const { isProcessing, lastResponse, startQuery, endQuery, simulateActivity } = useCollectiveStore();
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isProcessing) return;

        startQuery(input.trim());
        setInput('');

        // Simulate the collective processing
        simulateActivity();

        // Simulate response after delay
        setTimeout(() => {
            endQuery(
                `[COLLECTIVE SYNTHESIS] The network has processed your query through ${3 + Math.floor(Math.random() * 5)} active nodes. ` +
                `Information entropy stabilized at ${(40 + Math.random() * 30).toFixed(1)}/100. ` +
                `The God Node coordinated synthesis across the Deep Researcher, Systems Analyst, and Creative Synthesizer nodes. ` +
                `\n\nQuery: "${input.trim()}" has been analyzed through the collective intelligence framework. ` +
                `The INFORMATION ANALYST scored the response with ${(70 + Math.random() * 25).toFixed(1)}% relevance. ` +
                `\n\n— dispatched by CENTRAL ORCHESTRATOR`
            );
        }, 4000 + Math.random() * 3000);
    };

    useEffect(() => {
        if (!isProcessing && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isProcessing]);

    return (
        <div className="chat-interface">
            {lastResponse && (
                <motion.div
                    className="response-display"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <div className="response-label">COLLECTIVE RESPONSE</div>
                    <div className="response-text">{lastResponse}</div>
                </motion.div>
            )}
            <form onSubmit={handleSubmit} className="chat-form">
                <div className="input-container">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Query the collective intelligence..."
                        disabled={isProcessing}
                        rows={2}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit(e);
                            }
                        }}
                    />
                    <button type="submit" disabled={isProcessing || !input.trim()} className="send-btn">
                        {isProcessing ? (
                            <span className="processing-indicator">◆</span>
                        ) : (
                            '→'
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
