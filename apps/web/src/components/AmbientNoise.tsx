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
  const [volume, setVolume] = useState(0.3);

  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  function stop() {
    try {
      const layers = (sourceRef.current as any)?.__layers;
      if (layers) {
        layers.forEach((s: AudioBufferSourceNode) => { try { s.stop(); } catch {} });
      }
      sourceRef.current?.stop();
    } catch {}
    sourceRef.current = null;
  }

  function play(type: 'white' | 'brown' | 'rain' | 'presence') {
    console.log('[ambient] play called, type:', type);
    // Stop any existing playback
    stop();

    try {
      // Always create a fresh AudioContext on user gesture (the button click)
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => {});
      }
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      ctxRef.current = ctx;

      // Resume AudioContext - may be suspended on mobile if not directly in user gesture chain
      if (ctx.state === 'suspended') {
        ctx.resume().then(() => {
          console.log('[ambient] AudioContext resumed');
        }).catch(() => {
          console.log('[ambient] AudioContext resume failed');
        });
      }

      // Create gain node
      const gain = ctx.createGain();
      // Presence needs higher gain since the generated sounds are subtle
      if (type === 'presence') {
        gain.gain.value = Math.min(volume * 5, 0.5); // 5x normal gain, capped at 0.5
      } else {
        gain.gain.value = volume;
      }
      gain.connect(ctx.destination);
      gainRef.current = gain;

      // Generate noise buffer
      const bufferSize = ctx.sampleRate * 2;
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
        let max = 0;
        for (let i = 0; i < bufferSize; i++) {
          const abs = Math.abs(data[i]);
          if (abs > max) max = abs;
        }
        if (max > 0) for (let i = 0; i < bufferSize; i++) data[i] /= max;
      } else if (type === 'rain') {
        let last = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          data[i] = (last + 0.04 * white) / 1.04;
          last = data[i];
          if (Math.random() < 0.001) data[i] += (Math.random() - 0.5) * 0.3;
        }
      }

      if (type === 'presence') {
        try {
          const layers: AudioBufferSourceNode[] = [];
          const sr = ctx.sampleRate;
          
          // Layer 1: Room tone (7 seconds)
          const rt = ctx.createBuffer(1, sr * 7, sr);
          const rtL = rt.getChannelData(0);
          let rL = 0;
          for (let i = 0; i < sr * 7; i++) {
            rL = (rL + 0.008 * (Math.random() * 2 - 1)) / 1.008;
            rtL[i] = rL;
          }
          const rtSrc = ctx.createBufferSource();
          rtSrc.buffer = rt; rtSrc.loop = true;
          const rtG = ctx.createGain(); rtG.gain.value = 0.04;
          rtSrc.connect(rtG); rtG.connect(gain); rtSrc.start(0);
          layers.push(rtSrc);
          
          // Layer 2: Keyboard typing clusters (11 seconds)
          const kb = ctx.createBuffer(1, sr * 11, sr);
          const kbL = kb.getChannelData(0);
          let kPos = Math.floor(sr * (0.5 + Math.random() * 2));
          while (kPos < sr * 11 - sr) {
            const keys = 2 + Math.floor(Math.random() * 6);
            for (let k = 0; k < keys && kPos < sr * 11; k++) {
              const len = Math.floor(sr * (0.008 + Math.random() * 0.008));
              const vol = 0.15 + Math.random() * 0.1;
              const pitch = 800 + Math.random() * 2000;
              for (let s = 0; s < len && (kPos + s) < sr * 11; s++) {
                const env = Math.exp(-s / (len * 0.12));
                const sample = ((Math.random() * 2 - 1) * 0.7 + Math.sin(s / sr * 2 * Math.PI * pitch) * 0.3) * env * vol;
                kbL[kPos + s] += sample;
              }
              kPos += Math.floor(sr * (0.06 + Math.random() * 0.12));
            }
            kPos += Math.floor(sr * (1.5 + Math.random() * 4));
          }
          const kbSrc = ctx.createBufferSource();
          kbSrc.buffer = kb; kbSrc.loop = true;
          const kbG = ctx.createGain(); kbG.gain.value = 0.15;
          kbSrc.connect(kbG); kbG.connect(gain); kbSrc.start(0);
          layers.push(kbSrc);
          
          // Layer 3: Movement/rustle (13 seconds)
          const mv = ctx.createBuffer(1, sr * 13, sr);
          const mvL = mv.getChannelData(0);
          let mPos = Math.floor(sr * (3 + Math.random() * 4));
          while (mPos < sr * 13 - sr) {
            const len = Math.floor(sr * (0.2 + Math.random() * 0.4));
            const vol = 0.05 + Math.random() * 0.03;
            for (let s = 0; s < len && (mPos + s) < sr * 13; s++) {
              const env = Math.sin((s / len) * Math.PI);
              const sample = (Math.sin(s / sr * 2 * Math.PI * (40 + Math.random() * 30)) * 0.6 + (Math.random() * 2 - 1) * 0.4) * env * vol;
              mvL[mPos + s] += sample;
            }
            mPos += Math.floor(sr * (4 + Math.random() * 6));
          }
          const mvSrc = ctx.createBufferSource();
          mvSrc.buffer = mv; mvSrc.loop = true;
          const mvG = ctx.createGain(); mvG.gain.value = 0.2;
          mvSrc.connect(mvG); mvG.connect(gain); mvSrc.start(0);
          layers.push(mvSrc);
          
          // Layer 4: Mouse clicks + cup sounds (17 seconds)
          const mc = ctx.createBuffer(1, sr * 17, sr);
          const mcL = mc.getChannelData(0);
          // Mouse clicks
          let cPos = Math.floor(sr * (3 + Math.random() * 5));
          while (cPos < sr * 17 - sr) {
            const len = Math.floor(sr * 0.005);
            const vol = 0.12;
            for (let s = 0; s < len && (cPos + s) < sr * 17; s++) {
              const env = Math.exp(-s / (len * 0.08));
              const sample = (Math.random() * 2 - 1) * env * vol;
              mcL[cPos + s] += sample;
            }
            if (Math.random() < 0.3) {
              cPos += Math.floor(sr * 0.08);
              for (let s = 0; s < len && (cPos + s) < sr * 17; s++) {
                const env = Math.exp(-s / (len * 0.08));
                mcL[cPos + s] += (Math.random() * 2 - 1) * env * vol * 0.9;
              }
            }
            cPos += Math.floor(sr * (5 + Math.random() * 8));
          }
          // One cup set-down
          const cupPos = Math.floor(sr * (8 + Math.random() * 6));
          if (cupPos < sr * 17 - sr) {
            const cupLen = Math.floor(sr * 0.06);
            for (let s = 0; s < cupLen && (cupPos + s) < sr * 17; s++) {
              const env = Math.exp(-s / (cupLen * 0.15));
              const sample = (Math.sin(s / sr * 2 * Math.PI * 150) * 0.7 + Math.sin(s / sr * 2 * Math.PI * 1200) * env * 0.3) * env * 0.05;
              mcL[cupPos + s] += sample;
            }
          }
          const mcSrc = ctx.createBufferSource();
          mcSrc.buffer = mc; mcSrc.loop = true;
          const mcG = ctx.createGain(); mcG.gain.value = 0.15;
          mcSrc.connect(mcG); mcG.connect(gain); mcSrc.start(0);
          layers.push(mcSrc);
          
          // Store all layers for cleanup
          sourceRef.current = rtSrc;
          (sourceRef.current as any).__layers = layers;
          
          console.log('[ambient] playing: presence (4 mono layers)');
        } catch (err) {
          console.error('[ambient] presence buffer error:', err);
        }
        return;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      // Apply low-pass filter for white noise to avoid mic interference
      if (type === 'white') {
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 250;
        source.connect(filter);
        filter.connect(gain);
      } else {
        source.connect(gain);
      }

      source.start(0);
      sourceRef.current = source;
      console.log('[ambient] source started, ctx state:', ctx.state);

      // Handle the source ending unexpectedly
      source.onended = () => {
        console.log('[ambient] source ended unexpectedly');
      };

      console.log('[ambient] playing:', type);
    } catch (err) {
      console.error('[ambient] play error:', err);
    }
  }

  function select(value: string) {
    setActive(value);
    setShowMenu(false);
    if (value === 'off') {
      stop();
      return;
    }
    play(value as 'white' | 'brown' | 'rain' | 'presence');
  }

  useEffect(() => {
    if (gainRef.current) {
      gainRef.current.gain.value = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (disabled) {
      stop();
      setActive('off');
    }
  }, [disabled]);

  useEffect(() => {
    if (externalSound && externalSound !== active) {
      select(externalSound);
    }
  }, [externalSound]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => {});
      }
    };
  }, []);

  const activeLabel = AMBIENT_OPTIONS.find(o => o.value === active)?.label ?? 'Off';

  function getOptBtnStyle(isActive: boolean): React.CSSProperties {
    return {
      display: 'block',
      width: '100%',
      textAlign: 'left',
      background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
      border: 'none',
      color: '#fff',
      padding: '8px 12px',
      borderRadius: 6,
      cursor: 'pointer',
      fontSize: 13,
    };
  }
  const wrapStyle: React.CSSProperties = { position: 'relative', display: 'inline-block' };
  const btnStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 8,
    color: '#fff',
    padding: '6px 12px',
    fontSize: 13,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  };
  const menuStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '110%',
    left: 0,
    background: '#1a1a2e',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 10,
    padding: 8,
    minWidth: 160,
    zIndex: 100,
  };
  const dividerStyle: React.CSSProperties = {
    borderTop: '1px solid rgba(255,255,255,0.1)',
    marginTop: 8,
    paddingTop: 8,
  };
  const labelStyle: React.CSSProperties = {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    display: 'block',
    marginBottom: 4,
  };
  const sliderStyle: React.CSSProperties = { width: '100%', accentColor: '#a78bfa' };

  return (
    <div style={wrapStyle} className={className}>
      <button
        onClick={() => setShowMenu(prev => !prev)}
        style={btnStyle}
      >
        <span>&#127911;</span>
        <span>{activeLabel}</span>
      </button>

      {showMenu && (
        <div style={menuStyle}>
          {AMBIENT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => select(opt.value)}
              style={getOptBtnStyle(active === opt.value)}
            >
              {opt.label}
            </button>
          ))}

          <div style={dividerStyle}>
            <label style={labelStyle}>
              Volume
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={e => setVolume(parseFloat(e.target.value))}
              style={sliderStyle}
            />
          </div>
        </div>
      )}
    </div>
  );
}
