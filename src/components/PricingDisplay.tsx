'use client';

import { useCollectiveStore } from '@/lib/store';
import { formatCost } from '@/lib/models';

export default function PricingDisplay() {
    const { pricing, isHeavyMode, toggleModelMode } = useCollectiveStore();

    return (
        <div className="pricing-panel">
            <div className="panel-header">
                <span className="panel-icon">⊞</span>
                <span>SESSION COST</span>
            </div>
            <div className="pricing-content">
                <div className="cost-main">
                    <span className="cost-value">{formatCost(pricing.sessionCost)}</span>
                </div>
                <div className="cost-breakdown">
                    <div className="cost-row">
                        <span>LLM</span>
                        <span>{formatCost(pricing.llmCost)}</span>
                    </div>
                    <div className="cost-row">
                        <span>Tools</span>
                        <span>{formatCost(pricing.toolCallCost)}</span>
                    </div>
                    <div className="cost-row">
                        <span>Prompt Tokens</span>
                        <span>{pricing.promptTokens.toLocaleString()}</span>
                    </div>
                    <div className="cost-row">
                        <span>Completion</span>
                        <span>{pricing.completionTokens.toLocaleString()}</span>
                    </div>
                </div>
                <button className="mode-toggle" onClick={toggleModelMode}>
                    <span className={`mode-indicator ${isHeavyMode ? 'apex' : 'cerebras'}`} />
                    {isHeavyMode ? 'APEX' : 'CEREBRAS'}
                </button>
            </div>
        </div>
    );
}
