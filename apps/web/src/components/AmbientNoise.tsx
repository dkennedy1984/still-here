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
        const duration = 120; // 2 minute loop — much less repetitive
        const sr = ctx.sampleRate;
        const bufferSize = sr * duration;
        const buffer = ctx.createBuffer(2, bufferSize, sr);
        const left = buffer.getChannelData(0);
        const right = buffer.getChannelData(1);
        
        // 1. Room tone — very subtle filtered brown noise
        let roomL = 0, roomR = 0;
        for (let i = 0; i < bufferSize; i++) {
          roomL = (roomL + 0.008 * (Math.random() * 2 - 1)) / 1.008;
          roomR = (roomR + 0.008 * (Math.random() * 2 - 1)) / 1.008;
          left[i] = roomL * 0.015;
          right[i] = roomR * 0.015;
        }
        
        // 2. Keyboard typing — realistic clusters with varied rhythm
        let pos = sr * (1 + Math.random() * 3);
        while (pos < bufferSize - sr * 2) {
          // Gap between typing sessions (5-20 seconds)
          pos += Math.floor(sr * (5 + Math.random() * 15));
          if (pos >= bufferSize) break;
          
          // Each session: 1-4 words worth of typing
          const words = 1 + Math.floor(Math.random() * 4);
          for (let w = 0; w < words; w++) {
            // Each word: 2-8 keystrokes
            const keys = 2 + Math.floor(Math.random() * 7);
            for (let k = 0; k < keys; k++) {
              if (pos >= bufferSize) break;
              
              // Individual keystroke — short click with resonance
              const clickLen = Math.floor(sr * (0.008 + Math.random() * 0.008));
              const clickVol = 0.03 + Math.random() * 0.03;
              const pitch = 800 + Math.random() * 2000; // vary pitch per key
              const pan = 0.55 + Math.random() * 0.15; // mostly right (typing position)
              
              for (let s = 0; s < clickLen && (pos + s) < bufferSize; s++) {
                const env = Math.exp(-s / (clickLen * 0.12));
                // Mix of click (noise) and tone (resonance)
                const click = (Math.random() * 2 - 1) * 0.7;
                const tone = Math.sin(s / sr * 2 * Math.PI * pitch) * 0.3;
                const sample = (click + tone) * env * clickVol;
                left[pos + s] += sample * (1 - pan);
                right[pos + s] += sample * pan;
              }
              
              // Gap between keystrokes (50-180ms, varied like real typing)
              const baseGap = 0.06 + Math.random() * 0.1;
              // Occasionally longer pause (thinking between words)
              const pause = Math.random() < 0.15 ? 0.3 + Math.random() * 0.4 : 0;
              pos += Math.floor(sr * (baseGap + pause));
            }
            // Gap between words (150-400ms)
            pos += Math.floor(sr * (0.15 + Math.random() * 0.25));
          }
        }
        
        // 3. Mouse clicks — occasional, different sound than keyboard
        let mousePos = sr * (4 + Math.random() * 10);
        while (mousePos < bufferSize - sr) {
          mousePos += Math.floor(sr * (12 + Math.random() * 25));
          if (mousePos >= bufferSize) break;
          
          // Mouse click: sharper, shorter than keyboard
          const clickLen = Math.floor(sr * 0.005);
          const vol = 0.04 + Math.random() * 0.02;
          for (let s = 0; s < clickLen && (mousePos + s) < bufferSize; s++) {
            const env = Math.exp(-s / (clickLen * 0.08));
            const sample = (Math.random() * 2 - 1) * env * vol;
            left[mousePos + s] += sample * 0.4;
            right[mousePos + s] += sample * 0.6;
          }
          // Sometimes double-click
          if (Math.random() < 0.3) {
            mousePos += Math.floor(sr * 0.08);
            for (let s = 0; s < clickLen && (mousePos + s) < bufferSize; s++) {
              const env = Math.exp(-s / (clickLen * 0.08));
              const sample = (Math.random() * 2 - 1) * env * vol * 0.9;
              left[mousePos + s] += sample * 0.4;
              right[mousePos + s] += sample * 0.6;
            }
          }
        }
        
        // 4. Chair/body movement — soft low-frequency shifts
        let movePos = sr * (6 + Math.random() * 8);
        while (movePos < bufferSize - sr) {
          movePos += Math.floor(sr * (15 + Math.random() * 30));
          if (movePos >= bufferSize) break;
          
          const moveLen = Math.floor(sr * (0.3 + Math.random() * 0.5));
          const moveVol = 0.015 + Math.random() * 0.01;
          for (let s = 0; s < moveLen && (movePos + s) < bufferSize; s++) {
            const env = Math.sin((s / moveLen) * Math.PI);
            // Low frequency rumble with some texture
            const low = Math.sin(s / sr * 2 * Math.PI * (40 + Math.random() * 30)) * 0.6;
            const texture = (Math.random() * 2 - 1) * 0.4;
            const sample = (low + texture) * env * moveVol;
            left[movePos + s] += sample * 0.5;
            right[movePos + s] += sample * 0.5;
          }
        }
        
        // 5. Breathing — very subtle, slow rhythmic volume modulation
        // Not a sound itself, just makes the room tone gently pulse
        for (let i = 0; i < bufferSize; i++) {
          const breathCycle = Math.sin(i / sr * 2 * Math.PI / 5) * 0.5 + 0.5; // 5 second cycle
          left[i] *= (0.85 + breathCycle * 0.15);
          right[i] *= (0.85 + breathCycle * 0.15);
        }
        
        // 6. Cup/object set down — 1-3 times in the whole loop
        const cupCount = 1 + Math.floor(Math.random() * 3);
        for (let c = 0; c < cupCount; c++) {
          const cupPos = Math.floor(sr * (10 + Math.random() * (duration - 15)));
          if (cupPos >= bufferSize) continue;
          
          const cupLen = Math.floor(sr * 0.06);
          const cupVol = 0.04;
          for (let s = 0; s < cupLen && (cupPos + s) < bufferSize; s++) {
            const env = Math.exp(-s / (cupLen * 0.15));
            // Low thud with ceramic resonance
            const thud = Math.sin(s / sr * 2 * Math.PI * 150) * env * 0.7;
            const ring = Math.sin(s / sr * 2 * Math.PI * 1200) * env * env * 0.3;
            const sample = (thud + ring) * cupVol;
            left[cupPos + s] += sample * 0.45;
            right[cupPos + s] += sample * 0.55;
          }
        }
        
        // 7. Page turn / paper rustle — 1-2 times
        const pageCount = 1 + Math.floor(Math.random() * 2);
        for (let p = 0; p < pageCount; p++) {
          const pagePos = Math.floor(sr * (15 + Math.random() * (duration - 20)));
          if (pagePos >= bufferSize) continue;
          
          const pageLen = Math.floor(sr * (0.4 + Math.random() * 0.3));
          const pageVol = 0.02;
          for (let s = 0; s < pageLen && (pagePos + s) < bufferSize; s++) {
            const env = Math.sin((s / pageLen) * Math.PI);
            // High-frequency filtered noise — papery texture
            const noise = (Math.random() * 2 - 1);
            const filtered = noise * env * pageVol * (0.5 + Math.sin(s / sr * 2 * Math.PI * 3) * 0.5);
            left[pagePos + s] += filtered * 0.5;
            right[pagePos + s] += filtered * 0.5;
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
