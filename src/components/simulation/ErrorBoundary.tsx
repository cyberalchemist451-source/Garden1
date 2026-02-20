'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    content: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#111', color: '#ff5555', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <h2 style={{ fontSize: '2rem', marginBottom: '1rem', fontWeight: 'bold' }}>Simulation Error</h2>
                    <pre style={{ background: '#222', padding: '1rem', borderRadius: '8px', maxWidth: '800px', overflow: 'auto' }}>
                        {this.state.error?.message}
                        {this.state.error?.stack}
                    </pre>
                    <button
                        onClick={() => window.location.reload()}
                        style={{ marginTop: '2rem', padding: '10px 20px', background: '#ff5555', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        Reload Page
                    </button>
                </div>
            );
        }

        return this.props.content;
    }
}
