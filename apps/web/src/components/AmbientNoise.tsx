'use client';
import { useRef, useState } from 'react';

const AMBIENT_OPTIONS = [
  { label: 'Off', value: 'off' },
  { label: 'Rain', value: 'rain' },
  { label: 'White noise', value: 'white' },
  { label: 'Brown noise', value: 'brown' },
];

// Generate noise using Web Audio API — no external files needed
function createNoiseNode(ctx: AudioContext, type: 'white' | 'brown' | 'rain'): AudioBufferSourceNode {
  const bufferSize = ctx.sampleRate * 4; // 4 second loop
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
    // Normalize
    const max = Math.max(...Array.from(data).map(Math.abs));
    for (let i = 0; i < bufferSize; i++) data[i] /= max;
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
  return source;
}

interface AmbientNoiseProps {
  className?: string;
}

export function AmbientNoise({ className }: AmbientNoiseProps) {
  const [active, setActive] = useState('off');
  const [showMenu, setShowMenu] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  function stop() {
    sourceRef.current?.stop();
    sourceRef.current = null;
  }

  function play(type: 'white' | 'brown' | 'rain') {
    stop();
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new AudioContext();
    }
    const ctx = ctxRef.current;
    if (!gainRef.current) {
      gainRef.current = ctx.createGain();
      gainRef.current.gain.value = 0.15; // quiet background
      gainRef.current.connect(ctx.destination);
    }
    const source = createNoiseNode(ctx, type);
    source.connect(gainRef.current);
    source.start(0);
    sourceRef.current = source;
  }

  function select(value: string) {
    setActive(value);
    setShowMenu(false);
    if (value === 'off') { stop(); return; }
    play(value as 'white' | 'brown' | 'rain');
  }

  return (
    <div className={`relative ${className || ''}`}>
      <button
        onClick={() => setShowMenu(s => !s)}
        className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
      >
        {active === 'off' ? 'Ambient ▾' : `${AMBIENT_OPTIONS.find(o => o.value === active)?.label} ▾`}
      </button>
      {showMenu && (
        <div className="absolute bottom-full mb-2 left-0 bg-slate-900 border border-white/10 rounded-lg py-1 min-w-[120px]">
          {AMBIENT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => select(opt.value)}
              className={`block w-full text-left px-3 py-2 text-xs transition-colors ${
                active === opt.value ? 'text-white bg-white/5' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
