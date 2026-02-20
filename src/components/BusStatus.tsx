'use client';

import { useCollectiveStore } from '@/lib/store';

export default function BusStatus() {
    const { busStatus, isProcessing } = useCollectiveStore();

    return (
        <div className={`bus-status ${isProcessing ? 'active' : ''}`}>
            <span className="bus-prefix">SYS.BUS</span>
            <span className="bus-separator">›</span>
            <span className="bus-message">{busStatus}</span>
            {isProcessing && <span className="bus-activity">●</span>}
        </div>
    );
}
