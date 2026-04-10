'use client';

import { useEffect, useState } from 'react';

type UsagePayload = {
    used: number;
    estimatedUsd: number;
    limit: number;
    remaining: number;
};

function formatUsd(n: number): string {
    if (n < 0.0001 && n > 0) return `<$0.0001`;
    if (n < 0.01) return `~$${n.toFixed(4)}`;
    if (n < 1) return `~$${n.toFixed(3)}`;
    return `~$${n.toFixed(2)}`;
}

export default function TokenTracker() {
    const [stats, setStats] = useState<UsagePayload | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const fetchUsage = async () => {
            try {
                const res = await fetch('/api/usage', { cache: 'no-store' });
                if (!res.ok) throw new Error('bad response');
                const data = await res.json();
                if (!cancelled) {
                    setStats({
                        used: data.used ?? 0,
                        estimatedUsd: data.estimatedUsd ?? 0,
                        limit: data.limit ?? 0,
                        remaining: data.remaining ?? 0,
                    });
                    setError(false);
                }
            } catch {
                if (!cancelled) setError(true);
            }
        };

        fetchUsage();
        const id = window.setInterval(fetchUsage, 2500);
        return () => {
            cancelled = true;
            window.clearInterval(id);
        };
    }, []);

    const usedStr = stats != null ? stats.used.toLocaleString() : '—';
    const usdStr = stats != null ? formatUsd(stats.estimatedUsd) : '—';
    const pct =
        stats != null && stats.limit > 0
            ? Math.min(100, (stats.used / stats.limit) * 100)
            : 0;

    return (
        <div
            style={{
                position: 'fixed',
                top: 16,
                right: 16,
                zIndex: 102,
                background: 'rgba(8,8,16,0.92)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,200,120,0.28)',
                borderRadius: 10,
                padding: '10px 14px',
                fontFamily: 'monospace',
                fontSize: 11,
                color: '#f0e8dc',
                minWidth: 168,
                boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
            }}
        >
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 6,
                    letterSpacing: '0.12em',
                    fontSize: 10,
                    color: 'rgba(255,200,120,0.85)',
                    fontWeight: 700,
                }}
            >
                <span>API USAGE (24H)</span>
                {error && (
                    <span style={{ color: '#f66', letterSpacing: 0, fontSize: 9 }}>offline</span>
                )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                    <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 9, marginBottom: 2 }}>TOKENS</div>
                    <div style={{ color: '#7fdcff', fontWeight: 600, fontSize: 13 }}>{usedStr}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 9, marginBottom: 2 }}>EST. USD</div>
                    <div style={{ color: '#ffc966', fontWeight: 600, fontSize: 13 }}>{usdStr}</div>
                </div>
            </div>
            {stats != null && stats.limit > 0 && (
                <div style={{ marginTop: 8 }}>
                    <div
                        style={{
                            height: 4,
                            borderRadius: 2,
                            background: 'rgba(255,255,255,0.08)',
                            overflow: 'hidden',
                        }}
                    >
                        <div
                            style={{
                                width: `${pct}%`,
                                height: '100%',
                                background:
                                    pct > 90
                                        ? 'linear-gradient(90deg, #ff6b4a, #ffaa44)'
                                        : 'linear-gradient(90deg, #44aaff, #7fdcff)',
                                transition: 'width 0.4s ease',
                            }}
                        />
                    </div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.32)', marginTop: 4 }}>
                        budget {stats.used.toLocaleString()} / {stats.limit.toLocaleString()}
                    </div>
                </div>
            )}
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.28)', marginTop: 6, lineHeight: 1.35 }}>
                Estimates use published per-1M rates; actual OpenRouter charges may differ slightly.
            </div>
        </div>
    );
}
