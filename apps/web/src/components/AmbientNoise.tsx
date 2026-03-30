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
      sourceRef.current?.stop();
    } catch {}
    sourceRef.current = null;
    // Don't close the AudioContext here - it may still be needed
  }

  function play(type: 'white' | 'brown' | 'rain' | 'presence') {
    // Stop any existing playback
    stop();

    try {
      // Always create a fresh AudioContext on user gesture (the button click)
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => {});
      }
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      ctxRef.current = ctx;

      // Create gain node
      const gain = ctx.createGain();
      gain.gain.value = volume;
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
        // Create a longer, more natural presence soundscape
        const duration = 30; // 30 second loop for more variety
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate); // stereo for spatial feel
        const left = buffer.getChannelData(0);
        const right = buffer.getChannelData(1);

        // 1. Very subtle room tone (constant, barely there)
        let roomL = 0, roomR = 0;
        for (let i = 0; i < bufferSize; i++) {
          roomL = (roomL + 0.005 * (Math.random() * 2 - 1)) / 1.005;
          roomR = (roomR + 0.005 * (Math.random() * 2 - 1)) / 1.005;
          left[i] = roomL * 0.004;
          right[i] = roomR * 0.004;
        }

        // 2. Soft keyboard-like taps (very quiet, realistic timing)
        // Clusters of 3-8 rapid taps with pauses between
        let pos = ctx.sampleRate * 2; // start after 2 seconds
        while (pos < bufferSize - ctx.sampleRate) {
          // Random pause between typing clusters (3-12 seconds)
          pos += Math.floor(ctx.sampleRate * (3 + Math.random() * 9));
          if (pos >= bufferSize) break;

          // Typing cluster: 2-6 taps
          const numTaps = 2 + Math.floor(Math.random() * 5);
          for (let tap = 0; tap < numTaps; tap++) {
            if (pos >= bufferSize) break;
            const tapLen = Math.floor(ctx.sampleRate * 0.012); // 12ms tap
            const tapVol = 0.008 + Math.random() * 0.006; // vary volume
            const pan = 0.3 + Math.random() * 0.4; // slightly right of centre

            for (let s = 0; s < tapLen && (pos + s) < bufferSize; s++) {
              const env = Math.exp(-s / (tapLen * 0.2)); // sharp attack, quick decay
              const noise = (Math.random() * 2 - 1) * env * tapVol;
              left[pos + s] += noise * (1 - pan);
              right[pos + s] += noise * pan;
            }
            // Gap between taps (80-200ms, like real typing speed)
            pos += Math.floor(ctx.sampleRate * (0.08 + Math.random() * 0.12));
          }
        }

        // 3. Occasional soft rustle/movement (every 8-20 seconds)
        pos = ctx.sampleRate * 5;
        while (pos < bufferSize - ctx.sampleRate) {
          pos += Math.floor(ctx.sampleRate * (8 + Math.random() * 12));
          if (pos >= bufferSize) break;

          const rustleLen = Math.floor(ctx.sampleRate * (0.15 + Math.random() * 0.25)); // 150-400ms
          const rustleVol = 0.004 + Math.random() * 0.004;

          for (let s = 0; s < rustleLen && (pos + s) < bufferSize; s++) {
            const env = Math.sin((s / rustleLen) * Math.PI); // smooth envelope
            const noise = (Math.random() * 2 - 1) * env * rustleVol;
            // Spread across stereo
            left[pos + s] += noise * 0.6;
            right[pos + s] += noise * 0.4;
          }
        }

        // 4. One or two very quiet "settling" sounds (like a cup or book)
        const settleCount = 1 + Math.floor(Math.random() * 2);
        for (let sc = 0; sc < settleCount; sc++) {
          const settlePos = Math.floor(ctx.sampleRate * (8 + Math.random() * (duration - 10)));
          if (settlePos >= bufferSize) continue;
          const settleLen = Math.floor(ctx.sampleRate * 0.04); // 40ms thud
          const settleVol = 0.012;

          for (let s = 0; s < settleLen && (settlePos + s) < bufferSize; s++) {
            const env = Math.exp(-s / (settleLen * 0.15));
            // Low frequency thud
            const thud = Math.sin(s / ctx.sampleRate * 2 * Math.PI * 120) * env * settleVol;
            left[settlePos + s] += thud * 0.5;
            right[settlePos + s] += thud * 0.5;
          }
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(gain);
        source.start(0);
        sourceRef.current = source;
        console.log('[ambient] playing: presence');
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
