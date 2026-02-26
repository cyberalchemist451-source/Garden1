'use client';

import { useGameStore, SpellType, MAX_SKILL_TIER } from '@/lib/gameStore';

type UpgradeKey = 'maxHp' | 'damage' | 'speed' | 'fireball' | 'lightning' | 'frostbolt' | 'shadowbolt';

interface UpgradeDef {
    key: UpgradeKey;
    icon: string;
    label: string;
    description: string;
    color: string;
    getLevel: (store: ReturnType<typeof useGameStore.getState>) => number;
}

const UPGRADES: UpgradeDef[] = [
    {
        key: 'maxHp', icon: '❤️', label: 'Fortitude', description: '+25 Max HP per tier (full heal on upgrade)', color: '#44cc88',
        getLevel: s => s.player.upgrades.maxHp
    },
    {
        key: 'damage', icon: '🏹', label: 'Precision', description: '+10 Crossbow & spell damage per tier', color: '#cc6644',
        getLevel: s => s.player.upgrades.damage
    },
    {
        key: 'speed', icon: '💨', label: 'Swiftness', description: '+0.5 move speed per tier (walk & sprint)', color: '#44aaff',
        getLevel: s => s.player.upgrades.speed
    },
    {
        key: 'fireball', icon: '🔥', label: 'Fireball', description: 'Unlock & upgrade fireball. AOE unlocks at tier 3 (key 1)', color: '#ff6600',
        getLevel: s => s.player.spells.fireball.tier
    },
    {
        key: 'lightning', icon: '⚡', label: 'Lightning', description: 'Unlock & upgrade lightning. Chains to enemies at tier 3 (key 2)', color: '#4488ff',
        getLevel: s => s.player.spells.lightning.tier
    },
    {
        key: 'frostbolt', icon: '❄️', label: 'Frostbolt', description: 'Unlock & upgrade frostbolt. AOE chill unlocks at tier 3 (key 3)', color: '#44bbff',
        getLevel: s => s.player.spells.frostbolt.tier
    },
    {
        key: 'shadowbolt', icon: '🌑', label: 'Shadowbolt', description: 'Unlock & upgrade DOT bolt. Spreads on kill. AOE DOT at tier 3 (key 4)', color: '#9900ff',
        getLevel: s => s.player.spells.shadowbolt.tier
    },
];

const MAX = MAX_SKILL_TIER;

// Render less than MAX pips to keep the UI compact; group into segments of 5
function TierPips({ current, color }: { current: number; color: string }) {
    return (
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 6, maxWidth: 240 }}>
            {Array.from({ length: MAX }).map((_, i) => (
                <div key={i} style={{
                    width: 14, height: 5, borderRadius: 2,
                    background: i < current ? color : 'rgba(255,255,255,0.07)',
                    boxShadow: i < current ? `0 0 4px ${color}66` : 'none',
                    marginRight: (i + 1) % 5 === 0 ? 5 : 0, // gap every 5
                }} />
            ))}
        </div>
    );
}

export default function SkillMenu() {
    const player = useGameStore(s => s.player);
    const skillMenuOpen = useGameStore(s => s.skillMenuOpen);
    const spendSkillPoint = useGameStore(s => s.spendSkillPoint);
    const setSkillMenuOpen = useGameStore(s => s.setSkillMenuOpen);

    if (!skillMenuOpen) return null;

    const storeState = useGameStore.getState();

    return (
        <div
            style={{
                position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,0,0,0.55)', zIndex: 50, pointerEvents: 'auto'
            }}
            onClick={e => { if (e.target === e.currentTarget) setSkillMenuOpen(false); }}
        >
            <div style={{
                background: 'rgba(8,12,28,0.97)', border: '1px solid rgba(100,130,255,0.3)',
                borderRadius: 20, padding: '26px 30px', minWidth: 440,
                backdropFilter: 'blur(18px)', boxShadow: '0 8px 60px rgba(0,0,100,0.4)',
                fontFamily: "'Inter','Segoe UI',sans-serif",
            }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                    <div>
                        <div style={{ color: '#eee', fontSize: 19, fontWeight: 800 }}>⭐ Skill Tree</div>
                        <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>Level {player.level} · {player.xp}/100 XP · Max tier {MAX}</div>
                    </div>
                    <div style={{
                        background: player.skillPoints > 0 ? 'rgba(255,200,0,0.15)' : 'rgba(40,40,40,0.5)',
                        border: player.skillPoints > 0 ? '1px solid #c8a000' : '1px solid #444',
                        borderRadius: 10, padding: '5px 13px', textAlign: 'center',
                    }}>
                        <div style={{ color: player.skillPoints > 0 ? '#ffdd44' : '#555', fontSize: 22, fontWeight: 900 }}>{player.skillPoints}</div>
                        <div style={{ color: '#666', fontSize: 10 }}>Points</div>
                    </div>
                </div>

                {/* Upgrades */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {UPGRADES.map(upg => {
                        const current = upg.getLevel(storeState);
                        const maxed = current >= MAX;
                        const canUpgrade = !maxed && player.skillPoints > 0;
                        return (
                            <div key={upg.key} style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                background: 'rgba(255,255,255,0.04)',
                                border: `1px solid ${canUpgrade ? 'rgba(100,130,255,0.3)' : 'rgba(255,255,255,0.06)'}`,
                                borderRadius: 12, padding: '10px 14px', transition: 'border 0.2s',
                            }}>
                                <span style={{ fontSize: 26, flexShrink: 0 }}>{upg.icon}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ color: '#ddd', fontSize: 13, fontWeight: 700 }}>
                                        {upg.label}
                                        <span style={{ color: '#666', fontWeight: 400, fontSize: 11, marginLeft: 6 }}>{current}/{MAX}</span>
                                    </div>
                                    <div style={{ color: '#666', fontSize: 10, marginTop: 1 }}>{upg.description}</div>
                                    <TierPips current={current} color={upg.color} />
                                </div>
                                <button
                                    disabled={!canUpgrade}
                                    onClick={() => spendSkillPoint(upg.key)}
                                    style={{
                                        background: canUpgrade ? 'rgba(80,120,255,0.2)' : 'rgba(40,40,40,0.4)',
                                        border: canUpgrade ? '1px solid rgba(100,140,255,0.6)' : '1px solid #333',
                                        color: canUpgrade ? '#88aaff' : '#444',
                                        borderRadius: 8, padding: '6px 13px', fontSize: 12, fontWeight: 700,
                                        cursor: canUpgrade ? 'pointer' : 'not-allowed', flexShrink: 0,
                                        transition: 'all 0.15s',
                                    }}
                                >{maxed ? 'MAX' : '↑ Up'}</button>
                            </div>
                        );
                    })}
                </div>
                <div style={{ marginTop: 16, textAlign: 'center', color: '#444', fontSize: 10 }}>
                    Click outside to close · Earn points by leveling up
                </div>
            </div>
        </div>
    );
}
