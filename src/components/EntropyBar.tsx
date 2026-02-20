'use client';

import { useCollectiveStore } from '@/lib/store';

export default function EntropyBar() {
    const { infoTheoryMetrics, isProcessing } = useCollectiveStore();
    const { entropy, redundancy, taskRelevance, informationGain, overallHealth } = infoTheoryMetrics;

    const getEntropyColor = (value: number) => {
        if (value < 30) return '#00ff88';
        if (value < 50) return '#88ff00';
        if (value < 70) return '#ffff00';
        if (value < 85) return '#ff8800';
        return '#ff4400';
    };

    return (
        <div className="entropy-panel">
            <div className="panel-header">
                <span className="panel-icon">◎</span>
                <span>INFORMATION THEORY</span>
                {isProcessing && <span className="analyzing-badge">ANALYZING</span>}
            </div>
            <div className="metrics-grid">
                <MetricRow label="ENTROPY" value={entropy} color={getEntropyColor(entropy)} />
                <MetricRow label="REDUNDANCY" value={redundancy} color="#ff00aa" />
                <MetricRow label="RELEVANCE" value={taskRelevance} color="#00ffaa" />
                <MetricRow label="INFO GAIN" value={informationGain} color="#00aaff" />
                <MetricRow label="HEALTH" value={overallHealth} color="#88ff00" />
            </div>
        </div>
    );
}

function MetricRow({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className="metric-row">
            <div className="metric-label">{label}</div>
            <div className="metric-bar-container">
                <div
                    className="metric-bar-fill"
                    style={{ width: `${Math.min(100, value)}%`, backgroundColor: color }}
                />
            </div>
            <div className="metric-value" style={{ color }}>{value.toFixed(1)}</div>
        </div>
    );
}
