'use client';

import { useState } from 'react';

const DEFAULT_BINDINGS = [
    { action: 'Move Forward', keys: ['W', '↑'], category: 'Movement' },
    { action: 'Move Back', keys: ['S', '↓'], category: 'Movement' },
    { action: 'Move Left', keys: ['A', '←'], category: 'Movement' },
    { action: 'Move Right', keys: ['D', '→'], category: 'Movement' },
    { action: 'Sprint', keys: ['Shift + W'], category: 'Movement' },
    { action: 'Sit / Stand', keys: ['C'], category: 'Posture' },
    { action: 'Interact / Pick Up', keys: ['E'], category: 'Interaction' },
    { action: 'Drop Object', keys: ['Q'], category: 'Interaction' },
    { action: 'Look Around', keys: ['Mouse'], category: 'Camera' },
    { action: 'Zoom In/Out', keys: ['Scroll'], category: 'Camera' },
    { action: 'Camera Mode', keys: ['V'], category: 'Camera' },
    { action: 'Toggle Chat', keys: ['T', 'Enter'], category: 'UI' },
    { action: 'Toggle HUD', keys: ['H'], category: 'UI' },
    { action: 'Toggle Keybinds', keys: ['Esc', 'K'], category: 'UI' },
    { action: 'Toggle Mycelium', keys: ['1'], category: 'Layers' },
    { action: 'Toggle Eukaryote', keys: ['2'], category: 'Layers' },
    { action: 'Toggle Light Cone', keys: ['3'], category: 'Layers' },
    { action: 'Toggle Sensory', keys: ['4'], category: 'Layers' },
    { action: 'Take Snapshot', keys: ['F5'], category: 'System' },
    { action: 'Export Memory', keys: ['F9'], category: 'System' },
];

export default function KeybindMenu({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
    const categories = [...new Set(DEFAULT_BINDINGS.map(b => b.category))];

    return (
        <>
            {/* Toggle Button — top left */}
            <button className="keybind-toggle" onClick={onToggle} title="Keybinds (K)">
                {isOpen ? '✕' : '⌨'}
            </button>

            {isOpen && (
                <div className="keybind-overlay" onClick={(e) => { if (e.target === e.currentTarget) onToggle(); }}>
                    <div className="keybind-panel">
                        <div className="keybind-header">
                            <span>KEYBINDINGS</span>
                            <button className="keybind-close" onClick={onToggle}>✕</button>
                        </div>

                        <div className="keybind-body">
                            {categories.map(cat => (
                                <div key={cat} className="keybind-category">
                                    <div className="keybind-cat-label">{cat.toUpperCase()}</div>
                                    {DEFAULT_BINDINGS.filter(b => b.category === cat).map(bind => (
                                        <div key={bind.action} className="keybind-row">
                                            <span className="keybind-action">{bind.action}</span>
                                            <div className="keybind-keys">
                                                {bind.keys.map(k => (
                                                    <kbd key={k} className="keybind-key">{k}</kbd>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>

                        <div className="keybind-footer">
                            <span>Press K or Esc to close</span>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
