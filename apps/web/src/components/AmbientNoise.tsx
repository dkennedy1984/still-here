'use client';
import { useRef, useState, useEffect } from 'react';

const AMBIENT_OPTIONS = [
  { label: 'Off', value: 'off' },
  { label: 'Presence', value: 'presence' },
  { label: 'Rain', value: 'rain' },
  { label: 'White noise', value: 'white' },
  { label: 'Brown noise', value: 'brown' },
];

interface AmbientNoiseProps {
  disabled?: boolean;
  externalSound?: string;
  className?: string;
}

export function AmbientNoise({ disabled = false, externalSound, className }: AmbientNoiseProps) {
  const [active, setActive] = useState('off');
  const [showMenu, setShowMenu] = useState(false);
  const [volume, setVolume] = useState(0.4);

  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const presenceAudioRef = useRef<HTMLAudioElement | null>(null);

  function stop() {
    try {
      // Close AudioContext (kills all sounds connected to it)
      if (typeof window !== 'undefined' && (window as any).__ambientCtx) {
        try { (window as any).__ambientCtx.close(); } catch {}
        (window as any).__ambientCtx = null;
      }
      if (ctxRef.current) {
        try { ctxRef.current.close(); } catch {}
        ctxRef.current = null;
      }
      // Stop presence HTML Audio
      if (presenceAudioRef.current) {
        presenceAudioRef.current.pause();
        presenceAudioRef.current.currentTime = 0;
        presenceAudioRef.current = null;
      }
      // Remove from DOM
      const domAudio = document.getElementById('swy-presence-audio') as HTMLAudioElement;
      if (domAudio) {
        domAudio.pause();
        domAudio.currentTime = 0;
        domAudio.remove();
      }
      // Clean up global ref
      if (typeof window !== 'undefined' && (window as any).__presenceAudio) {
        (window as any).__presenceAudio.pause();
        (window as any).__presenceAudio.currentTime = 0;
        (window as any).__presenceAudio = null;
      }
      // Stop AudioContext layers
      const layers = (sourceRef.current as any)?.__layers;
      if (layers) {
        layers.forEach((s: AudioBufferSourceNode) => { try { s.stop(); } catch {} });
      }
      if (sourceRef.current) {
        try { sourceRef.current.stop(); } catch {}
      }
    } catch {}
    sourceRef.current = null;
  }


  function playGeneratedPresence(ctx: AudioContext, gain: GainNode) {
          const sr = ctx.sampleRate;
          const DURATION = 120;
          const PRIMES = [sr * DURATION + 1, sr * DURATION + 7, sr * DURATION + 11, sr * DURATION + 17, sr * DURATION + 23];
          const layers: AudioBufferSourceNode[] = [];
  
          PRIMES.forEach((bufLen, li) => {
            const buf = ctx.createBuffer(2, bufLen, sr);
            for (let ch = 0; ch < 2; ch++) {
              const d = buf.getChannelData(ch);
              let typingCluster = 0;
              let clusterLen = 0;
              let clusterGap = 0;
              let breathPhase = Math.random() * Math.PI * 2;
              let shiftPhase = Math.random() * Math.PI * 2;
  
              for (let i = 0; i < bufLen; i++) {
                const t = i / sr;
                let sample = 0;
  
                const roomFreq = 0.3 + li * 0.05;
                sample += Math.sin(2 * Math.PI * roomFreq * t + li) * 0.004;
  
                breathPhase += (2 * Math.PI * 0.2) / sr;
                const breathEnv = (Math.sin(breathPhase) + 1) * 0.5;
                sample += (Math.random() * 2 - 1) * breathEnv * 0.003;
  
                if (i % Math.floor(sr * 8.7) === 0) {
                  shiftPhase = 0;
                }
                if (shiftPhase < sr * 0.4) {
                  const shiftEnv = Math.sin(Math.PI * shiftPhase / (sr * 0.4));
                  sample += (Math.random() * 2 - 1) * shiftEnv * 0.015;
                  shiftPhase++;
                }
  
                if (clusterGap > 0) {
                  clusterGap--;
                } else if (typingCluster > 0) {
                  if (i % Math.floor(sr * (0.08 + Math.random() * 0.12)) === 0) {
                    const keyLen = Math.floor(sr * 0.008);
                    if (i + keyLen < bufLen) {
                      for (let k = 0; k < keyLen; k++) {
                        const env = Math.exp(-k / (sr * 0.003));
                        d[i + k] += (Math.random() * 2 - 1) * env * 0.04;
                      }
                    }
                    typingCluster--;
                    if (typingCluster === 0) {
                      clusterGap = Math.floor(sr * (2 + Math.random() * 10));
                    }
                  }
                } else if (Math.random() < 0.00003) {
                  typingCluster = Math.floor(5 + Math.random() * 25);
                  clusterLen = typingCluster;
                }
  
                if (Math.random() < 0.000001) {
                  const clickLen = Math.floor(sr * 0.005);
                  for (let k = 0; k < clickLen && i + k < bufLen; k++) {
                    const env = Math.exp(-k / (sr * 0.002));
                    d[i + k] += (Math.random() * 2 - 1) * env * 0.035;
                  }
                }
  
                d[i] += sample;
              }
            }
  
            const src = ctx.createBufferSource();
            src.buffer = buf;
            src.loop = true;
  
            const layerGain = ctx.createGain();
            layerGain.gain.value = 0.6 + li * 0.08;
  
            const panner = ctx.createStereoPanner();
            panner.pan.value = (li / (PRIMES.length - 1) - 0.5) * 0.4;
  
            src.connect(layerGain);
            layerGain.connect(panner);
            panner.connect(gain);
            src.start(ctx.currentTime + li * 0.13);
            layers.push(src);
          });
  
          const pseudo = ctx.createBufferSource();
          (pseudo as any).__layers = layers;
          sourceRef.current = pseudo;
  
  }

  function play(type: 'white' | 'brown' | 'rain' | 'presence') {
    console.log('[ambient] play called, type:', type);
    stop();

    try {
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => {});
      }
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      ctxRef.current = ctx;
      (window as any).__ambientCtx = ctx;

      if (ctx.state === 'suspended') {
        ctx.resume().then(() => {
          console.log('[ambient] AudioContext resumed');
        }).catch(() => {
          console.log('[ambient] AudioContext resume failed');
        });
      }

      const gain = ctx.createGain();
      gain.gain.value = volume;
      gain.connect(ctx.destination);
      gainRef.current = gain;

      if (type === 'white') {
        const bufferSize = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 250;
        source.connect(filter);
        filter.connect(gain);
        source.start();
        sourceRef.current = source;
      } else if (type === 'brown') {
        const bufferSize = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let last = 0;
        for (let i = 0; i < bufferSize; i++) {
          const w = Math.random() * 2 - 1;
          last = (last + 0.02 * w) / 1.02;
          data[i] = last * 3.5;
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(gain);
        source.start();
        sourceRef.current = source;
      } else if (type === 'rain') {
        const bufferSize = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let last = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          data[i] = (last + 0.04 * white) / 1.04;
          last = data[i];
          if (Math.random() < 0.001) data[i] += (Math.random() - 0.5) * 0.3;
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(gain);
        source.start();
        sourceRef.current = source;
      } else if (type === 'presence') {
        // Try real audio file first, fall back to generated
        try {
          const audio = new Audio('/audio/presence.mp3');
    audio.id = 'swy-presence-audio';
    audio.style.display = 'none';
    // Remove any existing one first
    document.getElementById('swy-presence-audio')?.remove();
    document.body.appendChild(audio);
          audio.loop = true;
          audio.volume = Math.min(volume * 5, 1.0);

          presenceAudioRef.current = audio;
      // Store globally so it can be stopped from anywhere
      (window as any).__presenceAudio = audio;
          audio.oncanplaythrough = () => {
            audio.play().catch(() => {});
            console.log('[ambient] playing: presence (real audio file)');
          };

          audio.onerror = () => {
            console.log('[ambient] no presence.mp3 found, using generated sounds');
            playGeneratedPresence(ctx, gain);
          };

          audio.load();
        } catch {
          playGeneratedPresence(ctx, gain);
        }
        return;
      }

      console.log('[ambient] playing', type);
    } catch (e) {
      console.error('[ambient] play error', e);
    }
  }

  useEffect(() => {
    if (gainRef.current) {
      gainRef.current.gain.value = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (externalSound === undefined) return;
    if (externalSound === 'off' || externalSound === '') {
      setActive('off');
      stop();
    } else {
      setActive(externalSound);
      play(externalSound as any);
    }
  }, [externalSound]);

  useEffect(() => {
    if (disabled) {
      stop();
      setActive('off');
      // Also close AudioContext to be thorough
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => {});
        ctxRef.current = null;
      }
      gainRef.current = null;
    }
  }, [disabled]);

  useEffect(() => {
    return () => {
      stop();
      ctxRef.current?.close().catch(() => {});
    };
  }, []);

  function select(value: string) {
    setActive(value);
    setShowMenu(false);
    if (value === 'off') { stop(); return; }
    play(value as any);
  }

  return (
    <>
      {/* The trigger button (always visible) */}
      <div className={`flex items-center gap-2 ${className || ''}`}>
        <button
          onClick={(e) => { e.stopPropagation(); setShowMenu(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 text-xs text-slate-400 hover:bg-white/10 hover:text-slate-300 transition-all backdrop-blur-sm"
        >
          <span>♫</span>
          <span>{active === 'off' ? 'Sounds' : AMBIENT_OPTIONS.find(o => o.value === active)?.label}</span>
        </button>
        {active !== 'off' && (
          <input
            type="range"
            min="0.05"
            max="0.5"
            step="0.01"
            value={volume}
            onClick={(e) => e.stopPropagation()}
            onChange={e => setVolume(parseFloat(e.target.value))}
            className="w-16 h-1 accent-slate-500 opacity-40 hover:opacity-70 transition-opacity cursor-pointer"
          />
        )}
      </div>

      {/* The bottom sheet (shown when showMenu is true) */}
      {showMenu && (
        <div
          className="fixed inset-0 bg-black/60 flex items-end justify-center backdrop-blur-sm z-[100]"
          onClick={() => setShowMenu(false)}
        >
          <div
            className="w-full max-w-md bg-slate-900 rounded-t-2xl px-6 pt-6 pb-10 border-t border-white/5"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-base font-medium text-white text-center mb-6">Background sounds</h2>

            <div className="flex flex-col gap-3 mb-6">
              {AMBIENT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => select(opt.value)}
                  className={`text-left px-4 py-3 rounded-xl transition-all ${
                    active === opt.value
                      ? 'bg-white/5 border border-white ring-1 ring-white/10'
                      : 'bg-slate-800/50 border border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  <span className="text-sm text-white">{opt.label}</span>
                  <span className="block text-xs text-slate-400 mt-0.5">
                    {opt.value === 'off' && 'Complete silence.'}
                    {opt.value === 'presence' && 'Quiet sounds of someone nearby.'}
                    {opt.value === 'rain' && 'Gentle rain falling.'}
                    {opt.value === 'white' && 'Soft, steady background hum.'}
                    {opt.value === 'brown' && 'Deep, warm background tone.'}
                  </span>
                </button>
              ))}
            </div>

            {active !== 'off' && (
              <div className="flex items-center gap-3 mb-6 px-1">
                <span className="text-xs text-slate-500">Quiet</span>
                <input
                  type="range"
                  min="0.02"
                  max="0.5"
                  step="0.01"
                  value={volume}
                  onChange={e => setVolume(parseFloat(e.target.value))}
                  className="flex-1 h-1 accent-white/40"
                />
                <span className="text-xs text-slate-500">Loud</span>
              </div>
            )}

            <button
              onClick={() => setShowMenu(false)}
              className="w-full py-3 rounded-full bg-slate-800 text-slate-400 text-sm hover:bg-slate-700 transition-all"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}
