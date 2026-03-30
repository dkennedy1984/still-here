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
  const [volume, setVolume] = useState(0.2);

  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const presenceAudioRef = useRef<HTMLAudioElement | null>(null);
  const isDisabledRef = useRef(false);
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userOverrideRef = useRef(false);
  const activeRef = useRef('off'); // Tracks current active value without stale closure issues

  function stop() {
    // Clear any ongoing fade-in
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
    // Stop presence HTML Audio
    if (presenceAudioRef.current) {
      presenceAudioRef.current.pause();
      presenceAudioRef.current.currentTime = 0;
      // Remove from DOM
      if (presenceAudioRef.current.parentNode) {
        presenceAudioRef.current.parentNode.removeChild(presenceAudioRef.current);
      }
      presenceAudioRef.current = null;
    }
    // Stop by DOM ID
    const domAudio = document.getElementById('swy-presence-audio') as HTMLAudioElement;
    if (domAudio) { domAudio.pause(); domAudio.currentTime = 0; domAudio.remove(); }
    // Global ref
    if (typeof window !== 'undefined' && (window as any).__presenceAudio) {
      (window as any).__presenceAudio.pause();
      (window as any).__presenceAudio.currentTime = 0;
      (window as any).__presenceAudio = null;
    }
    // Stop AudioContext source nodes (but DON'T close the context)
    try {
      const layers = (sourceRef.current as any)?.__layers;
      if (layers) { layers.forEach((s: AudioBufferSourceNode) => { try { s.stop(); } catch {} }); }
      if (sourceRef.current) { try { sourceRef.current.stop(); } catch {} }
    } catch {}
    sourceRef.current = null;
    // Don't close gainRef — just disconnect
    if (gainRef.current) { try { gainRef.current.disconnect(); } catch {} }
    gainRef.current = null;
    // DO NOT close ctxRef — this causes the crash
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
  
                // Very quiet room tone
                sample += (Math.random() * 2 - 1) * 0.003;
  
                // Slow breathing (subtle)
                const breathRate = 0.2 + (li * 0.05);
                const breathAmp = 0.004 + li * 0.001;
                sample += Math.sin(breathPhase) * breathAmp;
                breathPhase += (2 * Math.PI * breathRate) / sr;
  
                // Occasional subtle room shift
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
    if (isDisabledRef.current) return; // Never play if disabled
    console.log('[ambient] play called, type:', type);
    stop();

    try {
      // Reuse existing AudioContext if available and not closed, otherwise create new
      if (!ctxRef.current || ctxRef.current.state === 'closed') {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        ctxRef.current = ctx;
        (window as any).__ambientCtx = ctx;
      }
      const ctx = ctxRef.current;

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
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(gain);
        source.start();
        sourceRef.current = source;
      } else if (type === 'brown') {
        const bufferSize = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let lastOut = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          data[i] = (lastOut + (0.02 * white)) / 1.02;
          lastOut = data[i];
          data[i] *= 3.5;
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
          audio.volume = 0; // Start silent for fade-in

          presenceAudioRef.current = audio;
      // Store globally so it can be stopped from anywhere
      (window as any).__presenceAudio = audio;
          audio.oncanplaythrough = () => {
            if (activeRef.current !== 'presence' || isDisabledRef.current) {
              console.log('[ambient] oncanplaythrough fired but active=' + activeRef.current + ' or disabled — aborting');
              audio.pause();
              audio.src = '';
              return;
            }
            audio.play().catch(() => {});
            console.log('[ambient] playing: presence (real audio file)');
            // Fade in over 3 seconds
            const targetVol = Math.min(volume * 3, 1.0);
            let fadeVol = 0;
            const fadeInterval = setInterval(() => {
              if (!presenceAudioRef.current) {
                clearInterval(fadeInterval);
                if (fadeIntervalRef.current === fadeInterval) fadeIntervalRef.current = null;
                return;
              }
              fadeVol += targetVol / 50;
              if (fadeVol >= targetVol) {
                fadeVol = targetVol;
                clearInterval(fadeInterval);
                if (fadeIntervalRef.current === fadeInterval) fadeIntervalRef.current = null;
              }
              presenceAudioRef.current.volume = fadeVol;
            }, 100);
            fadeIntervalRef.current = fadeInterval;
          };

          audio.onerror = () => {
            if (!presenceAudioRef.current) return; // Already stopped, don't restart
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

  // Keep activeRef in sync so async callbacks (oncanplaythrough) can check current state
  useEffect(() => { activeRef.current = active; }, [active]);

  useEffect(() => {
    // User changed volume — cancel any ongoing fade-in
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
    if (gainRef.current) gainRef.current.gain.value = volume;
    // Also update presence HTML Audio element volume
    if (presenceAudioRef.current) {
      presenceAudioRef.current.volume = Math.min(volume * 3, 1.0);
    }
  }, [volume]);

  useEffect(() => {
    if (disabled) return;
    if (userOverrideRef.current) {
      console.log('[ambient] externalSound ignored — user override active, externalSound:', externalSound);
      return;
    }
    if (externalSound === undefined) return;
    if (externalSound === 'off' || externalSound === '') {
      console.log('[ambient] externalSound triggering stop');
      setActive('off');
      stop();
    } else {
      console.log('[ambient] externalSound triggering play:', externalSound);
      setActive(externalSound);
      play(externalSound as any);
    }
  }, [externalSound, disabled]);

  useEffect(() => {
    if (disabled) {
      isDisabledRef.current = true;
      stop();
      setActive('off');
      // DO NOT close AudioContext here
    } else {
      isDisabledRef.current = false;
    }
  }, [disabled]);

  useEffect(() => {
    return () => {
      stop();
      // DO NOT close AudioContext here either
    };
  }, []);

  function select(value: string) {
    console.log('[ambient] select called:', value);
    userOverrideRef.current = true;

    // Kill ALL audio by finding it in the DOM - no refs needed
    const el = document.getElementById('swy-presence-audio') as HTMLAudioElement;
    if (el) {
      console.log('[ambient] found presence audio in DOM, pausing');
      el.oncanplaythrough = null;
      el.onerror = null;
      el.onended = null;
      el.pause();
      el.currentTime = 0;
      el.src = '';
      el.remove();
    }
    if ((window as any).__presenceAudio) {
      console.log('[ambient] found presence audio on window, pausing');
      (window as any).__presenceAudio.oncanplaythrough = null;
      (window as any).__presenceAudio.onerror = null;
      (window as any).__presenceAudio.onended = null;
      (window as any).__presenceAudio.pause();
      (window as any).__presenceAudio.currentTime = 0;
      (window as any).__presenceAudio.src = '';
      (window as any).__presenceAudio = null;
    }
    // Also try ref
    if (presenceAudioRef.current) {
      console.log('[ambient] found presence audio on ref, pausing');
      presenceAudioRef.current.oncanplaythrough = null;
      presenceAudioRef.current.onerror = null;
      presenceAudioRef.current.onended = null;
      presenceAudioRef.current.pause();
      presenceAudioRef.current.currentTime = 0;
      presenceAudioRef.current.src = '';
      presenceAudioRef.current = null;
    }
    // Stop generated sounds
    try {
      const layers = (sourceRef.current as any)?.__layers;
      if (layers) { layers.forEach((s: AudioBufferSourceNode) => { try { s.stop(); } catch {} }); }
      if (sourceRef.current) { try { sourceRef.current.stop(); } catch {} }
    } catch {}
    sourceRef.current = null;
    if (gainRef.current) { try { gainRef.current.disconnect(); } catch {} }
    gainRef.current = null;
    // Clear fade
    if (fadeIntervalRef.current) { clearInterval(fadeIntervalRef.current); fadeIntervalRef.current = null; }

    console.log('[ambient] stopped all audio in select()');

    setActive(value);
    setShowMenu(false);

    if (value === 'off') return;
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
            <h2 className="text-base font-medium text-slate-200 mb-4">Background sounds</h2>
            <div className="flex flex-col gap-2">
              {AMBIENT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={(e) => { e.stopPropagation(); console.log('[ambient] option clicked:', opt.value); select(opt.value); }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all ${
                    active === opt.value
                      ? 'bg-slate-700 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                  }`}
                >
                  <span>{opt.label}</span>
                  {active === opt.value && <span className="ml-auto text-slate-400 text-xs">Playing</span>}
                </button>
              ))}
            </div>
            {active !== 'off' && (
              <div className="mt-4 flex items-center gap-3">
                <span className="text-xs text-slate-500">Volume</span>
                <input
                  type="range"
                  min="0.05"
                  max="0.5"
                  step="0.01"
                  value={volume}
                  onChange={e => setVolume(parseFloat(e.target.value))}
                  className="flex-1 h-1 accent-slate-500 cursor-pointer"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
