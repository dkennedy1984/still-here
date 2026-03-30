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
        // Mostly silence with occasional soft noise bursts (keyboard, rustling)
        const presenceBuf = ctx.createBuffer(1, ctx.sampleRate * 10, ctx.sampleRate);
        const presenceData = presenceBuf.getChannelData(0);

        // Add 3-5 random soft "activity" sounds
        const numEvents = 3 + Math.floor(Math.random() * 3);
        for (let e = 0; e < numEvents; e++) {
          const start = Math.floor(Math.random() * (presenceBuf.length - ctx.sampleRate * 0.3));
          const duration = Math.floor(ctx.sampleRate * (0.05 + Math.random() * 0.15));
          for (let i = 0; i < duration; i++) {
            const env = Math.sin((i / duration) * Math.PI);
            presenceData[start + i] = (Math.random() * 2 - 1) * env * 0.03;
          }
        }

        // Very subtle room tone
        let roomLast = 0;
        for (let i = 0; i < presenceBuf.length; i++) {
          const white = Math.random() * 2 - 1;
          roomLast = (roomLast + 0.01 * white) / 1.01;
          presenceData[i] += roomLast * 0.008;
        }

        const presenceSource = ctx.createBufferSource();
        presenceSource.buffer = presenceBuf;
        presenceSource.loop = true;
        presenceSource.connect(gain);
        presenceSource.start(0);
        sourceRef.current = presenceSource;
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
