'use client';

import { useSimulationStore } from '@/lib/simulationStore';

/**
 * Simple Rewards HUD to track Atlas Robot motion exploration metrics
 */
export default function RewardsHUD() {
    const robotPosition = useSimulationStore(s => s.robot.position);
    const robotRotation = useSimulationStore(s => s.robot.rotation);

    // Calculate distance from spawn (15, 15)
    const distanceTraveled = Math.sqrt(
        Math.pow(robotPosition.x - 15, 2) +
        Math.pow(robotPosition.z - 15, 2)
    ).toFixed(1);

    return (
        <div className="fixed top-4 right-4 bg-black/70 backdrop-blur-sm border border-cyan-500/30 rounded-lg p-4 text-cyan-400 font-mono text-sm min-w-[200px]">
            <div className="text-cyan-300 font-bold mb-2 text-xs uppercase tracking-wide">
                Atlas Metrics
            </div>

            <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-xs">Distance</span>
                    <span className="text-cyan-400 font-semibold">{distanceTraveled}m</span>
                </div>

                <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-xs">Position</span>
                    <span className="text-cyan-400 text-xs">
                        {robotPosition.x.toFixed(1)}, {robotPosition.z.toFixed(1)}
                    </span>
                </div>

                <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-xs">Heading</span>
                    <span className="text-cyan-400 text-xs">
                        {((robotRotation.y * 180 / Math.PI) % 360).toFixed(0)}°
                    </span>
                </div>
            </div>

            <div className="mt-3 pt-3 border-t border-cyan-500/20">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">
                    Controls: I/K/J/L/U/O
                </div>
            </div>
        </div>
    );
}
