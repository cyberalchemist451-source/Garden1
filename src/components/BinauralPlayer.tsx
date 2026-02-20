'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export default function BinauralPlayer() {
    const [isPlaying, setIsPlaying] = useState(false);
    const [baseFreq, setBaseFreq] = useState(200);
    const [beatFreq, setBeatFreq] = useState(10);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const oscLeftRef = useRef<OscillatorNode | null>(null);
    const oscRightRef = useRef<OscillatorNode | null>(null);
    const gainRef = useRef<GainNode | null>(null);

    const startAudio = useCallback(() => {
        if (audioCtxRef.current) return;

        const ctx = new AudioContext();
        audioCtxRef.current = ctx;

        const gain = ctx.createGain();
        gain.gain.value = 0.15;
        gain.connect(ctx.destination);
        gainRef.current = gain;

        const merger = ctx.createChannelMerger(2);
        merger.connect(gain);

        const oscL = ctx.createOscillator();
        oscL.type = 'sine';
        oscL.frequency.value = baseFreq;
        oscL.connect(merger, 0, 0);
        oscLeftRef.current = oscL;

        const oscR = ctx.createOscillator();
        oscR.type = 'sine';
        oscR.frequency.value = baseFreq + beatFreq;
        oscR.connect(merger, 0, 1);
        oscRightRef.current = oscR;

        oscL.start();
        oscR.start();
        setIsPlaying(true);
    }, [baseFreq, beatFreq]);

    const stopAudio = useCallback(() => {
        oscLeftRef.current?.stop();
        oscRightRef.current?.stop();
        audioCtxRef.current?.close();
        audioCtxRef.current = null;
        oscLeftRef.current = null;
        oscRightRef.current = null;
        setIsPlaying(false);
    }, []);

    useEffect(() => {
        if (oscLeftRef.current) {
            oscLeftRef.current.frequency.value = baseFreq;
        }
        if (oscRightRef.current) {
            oscRightRef.current.frequency.value = baseFreq + beatFreq;
        }
    }, [baseFreq, beatFreq]);

    return (
        <div className="binaural-panel">
            <div className="panel-header">
                <span className="panel-icon">♫</span>
                <span>BINAURAL FIELD</span>
            </div>
            <div className="binaural-content">
                <button
                    className={`binaural-toggle ${isPlaying ? 'playing' : ''}`}
                    onClick={isPlaying ? stopAudio : startAudio}
                >
                    {isPlaying ? '■ STOP' : '▶ PLAY'}
                </button>
                <div className="freq-control">
                    <label>BASE: {baseFreq}Hz</label>
                    <input
                        type="range"
                        min="80"
                        max="400"
                        value={baseFreq}
                        onChange={(e) => setBaseFreq(Number(e.target.value))}
                    />
                </div>
                <div className="freq-control">
                    <label>BEAT: {beatFreq}Hz</label>
                    <input
                        type="range"
                        min="1"
                        max="40"
                        value={beatFreq}
                        onChange={(e) => setBeatFreq(Number(e.target.value))}
                    />
                </div>
            </div>
        </div>
    );
}
