'use client';

import { useEffect } from 'react';
import { useGameStore, SPELL_COOLDOWN_BASE, SpellType } from '@/lib/gameStore';

const SPELL_META: Record<SpellType, { icon: string; label: string; key: string }> = {
    fireball: { icon: '🔥', label: 'Fireball', key: '1' },
    lightning: { icon: '⚡', label: 'Lightning', key: '2' },
    frostbolt: { icon: '❄️', label: 'Frostbolt', key: '3' },
    shadowbolt: { icon: '🌑', label: 'Shadowbolt', key: '4' },
};

const SPELLS: SpellType[] = ['fireball', 'lightning', 'frostbolt', 'shadowbolt'];

export default function GameHUD() {
    const player = useGameStore(s => s.player);
    const wave = useGameStore(s => s.wave);
    const gameOver = useGameStore(s => s.gameOver);
    const gameRunning = useGameStore(s => s.gameRunning);
    const gamePaused = useGameStore(s => s.gamePaused);
    const targetedZombieId = useGameStore(s => s.targetedZombieId);
    const zombies = useGameStore(s => s.zombies);
    const toggleSkillMenu = useGameStore(s => s.toggleSkillMenu);
    const skillMenuOpen = useGameStore(s => s.skillMenuOpen);
    const togglePause = useGameStore(s => s.togglePause);

    // Keyboard shortcut: P to pause/resume
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.code === 'KeyP' && !e.repeat) {
                const { gameRunning, gameOver } = useGameStore.getState();
                if (gameRunning && !gameOver) togglePause();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [togglePause]);

    const targetedZombie = zombies.find(z => z.id === targetedZombieId && z.state !== 'dying' && z.state !== 'dead');
    const hpPct = player.hp / player.maxHp;
    const xpPct = player.xp / 100; // XP_PER_LEVEL

    if (!gameRunning && !gameOver) return null;

    return (
        <div style={{
            position: 'fixed', inset: 0, pointerEvents: 'none',
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
            userSelect: 'none',
        }}>
            {/* ── TOP LEFT: HP + XP ── */}
            <div style={{ position: 'absolute', top: 18, left: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* HP Bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, color: '#ff4444', fontWeight: 700, width: 20 }}>❤️</span>
                    <div style={{ width: 180, height: 14, background: 'rgba(0,0,0,0.6)', borderRadius: 7, border: '1px solid #660000', overflow: 'hidden' }}>
                        <div style={{
                            width: `${hpPct * 100}%`,
                            height: '100%',
                            background: hpPct > 0.5 ? 'linear-gradient(90deg,#cc0000,#ff4444)' : hpPct > 0.25 ? 'linear-gradient(90deg,#cc6600,#ff9900)' : 'linear-gradient(90deg,#880000,#cc0000)',
                            transition: 'width 0.2s, background 0.3s',
                            borderRadius: 7,
                        }} />
                    </div>
                    <span style={{ fontSize: 12, color: '#ffaaaa', minWidth: 55 }}>{player.hp}/{player.maxHp}</span>
                </div>

                {/* XP Bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, color: '#4488ff', fontWeight: 700, width: 20 }}>✨</span>
                    <div style={{ width: 180, height: 10, background: 'rgba(0,0,0,0.6)', borderRadius: 5, border: '1px solid #224488', overflow: 'hidden' }}>
                        <div style={{
                            width: `${xpPct * 100}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg,#1144cc,#4488ff)',
                            transition: 'width 0.3s',
                            borderRadius: 5,
                        }} />
                    </div>
                    <span style={{ fontSize: 11, color: '#aaccff', minWidth: 55 }}>Lv {player.level} · {player.xp}/100</span>
                </div>

                {/* Skill Points Badge */}
                {player.skillPoints > 0 && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 6, marginTop: 2,
                        background: 'rgba(255,200,0,0.15)', border: '1px solid #c8a000',
                        borderRadius: 8, padding: '3px 10px', maxWidth: 210,
                    }}>
                        <span style={{ fontSize: 13 }}>⭐</span>
                        <span style={{ fontSize: 12, color: '#ffdd44', fontWeight: 700 }}>
                            {player.skillPoints} Skill Point{player.skillPoints !== 1 ? 's' : ''} available!
                        </span>
                    </div>
                )}
            </div>

            {/* ── TOP CENTER: Wave Info ── */}
            <div style={{
                position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(0,0,0,0.55)', borderRadius: 10, padding: '6px 20px',
                border: '1px solid rgba(255,100,0,0.4)', textAlign: 'center',
            }}>
                {wave.phase === 'resting' ? (
                    <>
                        <div style={{ color: '#aaffaa', fontSize: 13, fontWeight: 700 }}>WAVE {wave.number} CLEARED 🏆</div>
                        <div style={{ color: '#ffcc88', fontSize: 12 }}>Next wave in {Math.ceil(wave.restTimer)}s…</div>
                    </>
                ) : wave.phase === 'active' ? (
                    <>
                        <div style={{ color: '#ff6622', fontSize: 14, fontWeight: 800, letterSpacing: 1 }}>⚔ WAVE {wave.number}</div>
                        <div style={{ color: '#ffaaaa', fontSize: 12 }}>🧟 {wave.zombiesRemaining} remaining</div>
                        {wave.pendingSpawns > 0 && (
                            <div style={{ color: '#ffcc66', fontSize: 11, marginTop: 1 }}>
                                +{wave.pendingSpawns} incoming in {Math.ceil(wave.spawnBatchTimer)}s
                            </div>
                        )}
                    </>
                ) : wave.phase === 'waiting' ? (
                    <div style={{ color: '#aaaaaa', fontSize: 13 }}>Starting…</div>
                ) : null}
            </div>

            {/* ── TARGET INFO (center-ish, below wave) ── */}
            {targetedZombie && (
                <div style={{
                    position: 'absolute', top: 80, left: '50%', transform: 'translateX(-50%)',
                    background: 'rgba(0,0,0,0.6)', borderRadius: 8, padding: '5px 16px',
                    border: '1px solid #ffdd00', minWidth: 160, textAlign: 'center',
                }}>
                    <div style={{ color: '#ffdd00', fontSize: 12, fontWeight: 700 }}>🎯 Target</div>
                    <div style={{ width: 120, height: 8, background: '#330000', borderRadius: 4, margin: '4px auto', overflow: 'hidden' }}>
                        <div style={{
                            width: `${(targetedZombie.hp / targetedZombie.maxHp) * 100}%`,
                            height: '100%',
                            background: '#cc2200',
                            borderRadius: 4,
                        }} />
                    </div>
                    <div style={{ color: '#ffaaaa', fontSize: 11 }}>{targetedZombie.hp}/{targetedZombie.maxHp}</div>
                </div>
            )}

            {/* ── BOTTOM CENTER: Spells + crossbow indicator ── */}
            <div style={{
                position: 'absolute', bottom: 22, left: '50%', transform: 'translateX(-50%)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            }}>
                {/* Spell bar */}
                <div style={{ display: 'flex', gap: 8 }}>
                    {SPELLS.map(spell => {
                        const meta = SPELL_META[spell];
                        const spellData = player.spells[spell];
                        const cd = player.spellCooldowns[spell];
                        const maxCd = SPELL_COOLDOWN_BASE[spell];
                        const locked = !spellData.unlocked;
                        return (
                            <div key={spell} style={{
                                width: 54, height: 54, borderRadius: 10,
                                background: locked ? 'rgba(0,0,0,0.5)' : 'rgba(20,30,60,0.75)',
                                border: locked ? '1px solid #333' : `1px solid ${cd > 0 ? '#335' : '#4488ff'}`,
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                position: 'relative', overflow: 'hidden', opacity: locked ? 0.4 : 1,
                            }}>
                                {cd > 0 && !locked && (
                                    <div style={{
                                        position: 'absolute', bottom: 0, left: 0, right: 0,
                                        height: `${(cd / maxCd) * 100}%`, background: 'rgba(0,0,0,0.6)'
                                    }} />
                                )}
                                <span style={{ fontSize: 24, position: 'relative', zIndex: 1 }}>{meta.icon}</span>
                                <span style={{ position: 'absolute', bottom: 2, right: 4, fontSize: 9, color: '#aaaaff', fontWeight: 700 }}>{meta.key}</span>
                                {spellData.tier > 0 && (
                                    <span style={{ position: 'absolute', top: 2, right: 3, fontSize: 8, color: '#ffdd44' }}>
                                        {'★'.repeat(Math.min(spellData.tier, 5))}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Crossbow indicator */}
                <div style={{
                    background: 'rgba(255,200,50,0.15)', border: '1px solid rgba(255,200,50,0.4)',
                    borderRadius: 10, padding: '4px 18px', display: 'flex', alignItems: 'center', gap: 8,
                }}>
                    <span style={{ fontSize: 20 }}>🏹</span>
                    <span style={{ color: '#ffcc44', fontSize: 12, fontWeight: 700 }}>Crossbow</span>
                    <span style={{ color: '#888', fontSize: 10 }}>Spd {player.speed.toFixed(1)}</span>
                </div>

                {/* Key hints */}
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, letterSpacing: 0.5 }}>
                    Tab: lock target &nbsp;|&nbsp; Esc: untarget &nbsp;|&nbsp; 1/2/3/4: spells &nbsp;|&nbsp; Click: shoot &nbsp;|&nbsp; C: camera lock &nbsp;|&nbsp; P: pause
                </div>
            </div>

            {/* ── TOP RIGHT: Skill Menu + Pause buttons ── */}
            <div style={{ position: 'absolute', top: 18, right: 18, display: 'flex', gap: 8, pointerEvents: 'auto' }}>
                {/* Pause */}
                <button
                    onClick={togglePause}
                    title="Pause / Resume (P)"
                    style={{
                        background: gamePaused ? 'rgba(255,200,0,0.2)' : 'rgba(0,0,0,0.6)',
                        border: gamePaused ? '1px solid #ffcc00' : '1px solid rgba(255,255,255,0.2)',
                        color: gamePaused ? '#ffcc00' : '#aaa',
                        borderRadius: 10, padding: '8px 14px',
                        fontSize: 13, fontWeight: 700, cursor: 'pointer',
                        transition: 'all 0.2s',
                    }}
                >
                    {gamePaused ? '▶ Resume' : '⏸ Pause'}
                </button>
                {/* Skills */}
                <button
                    onClick={toggleSkillMenu}
                    style={{
                        background: player.skillPoints > 0 ? 'rgba(255,200,0,0.2)' : 'rgba(0,0,0,0.6)',
                        border: player.skillPoints > 0 ? '1px solid #ffcc00' : '1px solid rgba(255,255,255,0.2)',
                        color: player.skillPoints > 0 ? '#ffcc00' : '#aaa',
                        borderRadius: 10, padding: '8px 14px',
                        fontSize: 13, fontWeight: 700, cursor: 'pointer',
                        boxShadow: player.skillPoints > 0 ? '0 0 10px rgba(255,200,0,0.3)' : 'none',
                        transition: 'all 0.2s',
                    }}
                >
                    {skillMenuOpen ? '✕ Close' : '⭐ Skills'}{player.skillPoints > 0 ? ` (${player.skillPoints})` : ''}
                </button>
            </div>

            {/* ── PAUSED OVERLAY ── */}
            {gamePaused && !gameOver && (
                <div style={{
                    position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 90,
                }}>
                    <div style={{
                        background: 'rgba(10,10,30,0.95)', border: '1px solid rgba(100,130,255,0.4)',
                        borderRadius: 20, padding: '36px 60px', textAlign: 'center',
                    }}>
                        <div style={{ fontSize: 44, marginBottom: 8 }}>⏸</div>
                        <div style={{ color: '#aaccff', fontSize: 28, fontWeight: 900, letterSpacing: 2, marginBottom: 6 }}>PAUSED</div>
                        <div style={{ color: '#666', fontSize: 12, marginBottom: 24 }}>Press P or click Resume to continue</div>
                        <button
                            onClick={togglePause}
                            style={{
                                background: 'rgba(80,120,255,0.2)', border: '1px solid #4466cc',
                                color: '#aaccff', borderRadius: 10, padding: '10px 30px',
                                fontSize: 15, fontWeight: 700, cursor: 'pointer', pointerEvents: 'auto',
                            }}
                        >
                            ▶ Resume
                        </button>
                    </div>
                </div>
            )}

            {/* ── GAME OVER ── */}
            {gameOver && (
                <div style={{
                    position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.75)', zIndex: 100,
                }}>
                    <div style={{
                        background: 'rgba(20,0,0,0.9)', border: '2px solid #880000',
                        borderRadius: 20, padding: '40px 60px', textAlign: 'center',
                    }}>
                        <div style={{ fontSize: 52, marginBottom: 8 }}>💀</div>
                        <div style={{ color: '#ff4444', fontSize: 32, fontWeight: 900, letterSpacing: 2, marginBottom: 8 }}>YOU DIED</div>
                        <div style={{ color: '#aaa', fontSize: 14, marginBottom: 24 }}>
                            Survived to Wave {wave.number} · Level {player.level}
                        </div>
                        <button
                            onClick={() => useGameStore.getState().startGame()}
                            style={{
                                background: 'rgba(200,0,0,0.3)', border: '1px solid #cc0000',
                                color: '#ff8888', borderRadius: 10, padding: '10px 30px',
                                fontSize: 16, fontWeight: 700, cursor: 'pointer', pointerEvents: 'auto',
                            }}
                        >
                            ↺ Try Again
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
