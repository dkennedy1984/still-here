'use client';
import { useRef, useState, useEffect } from 'react';

const AMBIENT_OPTIONS = [
  { label: 'Off', value: 'off' },
  { label: 'Rain', value: 'rain' },
  { label: 'White noise', value: 'white' },
  { label: 'Brown noise', value: 'brown' },
];

// Generate noise using Web Audio API — no external files needed
function createNoiseNode(ctx: AudioContext, type: 'white' | 'brown' | 'rain'): { source: AudioBufferSourceNode, output: AudioNode } {
  const bufferSize = ctx.sampleRate * 2; // 2 second loop
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  if (type === 'white') {
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  } else if (type === 'brown') {
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (last + 0.02 * white) / 1.02;
      last = data[i];
    }
    // Normalize without spread operator (avoids stack overflow)
    let max = 0;
    for (let i = 0; i < bufferSize; i++) {
      const abs = Math.abs(data[i]);
      if (abs > max) max = abs;
    }
    if (max > 0) {
      for (let i = 0; i < bufferSize; i++) data[i] /= max;
    }
  } else if (type === 'rain') {
    // Rain-like: filtered white noise with random droplet impulses
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (last + 0.04 * white) / 1.04;
      last = data[i];
      // Random droplet impulse
      if (Math.random() < 0.001) data[i] += (Math.random() - 0.5) * 0.3;
    }
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  if (type === 'white') {
    // Low-pass filter to remove speech frequencies — prevents mic interference
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    source.connect(filter);
    return { source, output: filter };
  } else if (type === 'brown') {
    // High-shelf cut to keep it warm
    const filter = ctx.createBiquadFilter();
    filter.type = 'highshelf';
    filter.frequency.value = 1000;
    filter.gain.value = -12;
    source.connect(filter);
    return { source, output: filter };
  }

  return { source, output: source };
}

interface AmbientNoiseProps {
  className?: string;
  disabled?: boolean; // when true, stop all audio
  externalSound?: string; // AI-controlled sound override
}

export function AmbientNoise({ className, disabled, externalSound }: AmbientNoiseProps) {
  const [active, setActive] = useState('off');
  const [showMenu, setShowMenu] = useState(false);
  const [volume, setVolume] = useState(0.06);
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  function stop() {
    sourceRef.current?.stop();
    sourceRef.current = null;
  }

  function play(type: 'white' | 'brown' | 'rain') {
    stop();
    try {
      if (!ctxRef.current || ctxRef.current.state === 'closed') {
        ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = ctxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      if (!gainRef.current) {
        gainRef.current = ctx.createGain();
        gainRef.current.gain.value = volume;
        gainRef.current.connect(ctx.destination);
      }

      const { source, output } = createNoiseNode(ctx, type);
      output.connect(gainRef.current);
      source.start(0);
      sourceRef.current = source;
    } catch (err) {
      console.error('[ambient] play error:', err);
    }
  }

  // Stop audio when disabled changes to true (e.g. call ended)
  useEffect(() => {
    if (disabled) {
      stop();
      setActive('off');
    }
  }, [disabled]);

  // Respond to AI-controlled sound changes
  useEffect(() => {
    if (externalSound && externalSound !== active) {
      handleSelect(externalSound);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalSound]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      sourceRef.current?.stop();
      sourceRef.current = null;
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
    };
  }, []);

  // Apply volume changes to live gain node
  useEffect(() => {
    if (gainRef.current) gainRef.current.gain.value = volume;
  }, [volume]);

  function handleSelect(value: string) {
    if (value === 'off') {
      stop();
      setActive('off');
    } else {
      play(value as 'white' | 'brown' | 'rain');
      setActive(value);
    }
    setShowMenu(false);
  }

  const activeLabel = AMBIENT_OPTIONS.find(o => o.value === active)?.label ?? 'Off';

  return (
    <div className={`relative ${className ?? ''}`}>
      <button
        onClick={() => setShowMenu(m => !m)}
        className="text-xs text-slate-400 hover:text-white transition px-2 py-1 rounded hover:bg-white/10"
      >
        🎵 {activeLabel}
      </button>

      {showMenu && (
        <div className="absolute bottom-full mb-1 left-0 bg-slate-800 border border-slate-700 rounded shadow-lg z-50 min-w-[140px]">
          {AMBIENT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              className={`block w-full text-left px-3 py-2 text-sm hover:bg-white/10 ${active === opt.value ? 'text-white' : 'text-slate-400'}`}
            >
              {opt.label}
            </button>
          ))}
          {active !== 'off' && (
            <div className="px-3 py-2 flex items-center gap-2">
              <span className="text-xs text-slate-500">Vol</span>
              <input
                type="range"
                min={0}
                max={0.3}
                step={0.01}
                value={volume}
                onChange={e => setVolume(parseFloat(e.target.value))}
                className="w-16 h-1 accent-white/40"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
