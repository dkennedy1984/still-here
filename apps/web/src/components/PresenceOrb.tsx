'use client';
import { useEffect, useState } from 'react';

interface PresenceOrbProps {
  state: 'idle' | 'listening' | 'speaking' | 'greeting';
  size?: 'sm' | 'lg';
}

export function PresenceOrb({ state, size = 'lg' }: PresenceOrbProps) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 100); return () => clearTimeout(t); }, []);

  const d = size === 'lg' ? 88 : 64;
  const isSpeaking = state === 'speaking';
  const isListening = state === 'listening';

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: d * 2.4, height: d * 2.4, opacity: visible ? 1 : 0, transition: 'opacity 1.5s ease' }}
    >
      {/* Ripple rings - speaking only, smooth continuous outward ripple */}
      {isSpeaking && (
        <>
          <div className="absolute rounded-full animate-ripple-1"
            style={{ width: d * 2.2, height: d * 2.2, border: '1px solid rgba(134,239,172,0.25)' }} />
          <div className="absolute rounded-full animate-ripple-2"
            style={{ width: d * 2.2, height: d * 2.2, border: '1px solid rgba(134,239,172,0.20)' }} />
          <div className="absolute rounded-full animate-ripple-3"
            style={{ width: d * 2.2, height: d * 2.2, border: '1px solid rgba(134,239,172,0.15)' }} />
        </>
      )}

      {/* Listening ring */}
      {isListening && (
        <div className="absolute rounded-full"
          style={{
            width: d * 1.5, height: d * 1.5,
            border: '1px solid rgba(147,197,253,0.2)',
            animation: 'breathe 3s ease-in-out infinite',
          }} />
      )}

      {/* Glow halo */}
      <div
        className="absolute rounded-full"
        style={{
          width: d * 1.5, height: d * 1.5,
          background: isSpeaking
            ? 'radial-gradient(circle, rgba(134,239,172,0.25) 0%, transparent 70%)'
            : isListening
            ? 'radial-gradient(circle, rgba(147,197,253,0.15) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)',
          filter: 'blur(10px)',
          transition: 'background 0.8s ease',
        }}
      />

      {/* Core orb */}
      <div
        className="relative rounded-full"
        style={{
          width: d, height: d,
          background: isSpeaking
            ? 'radial-gradient(circle at 38% 32%, rgba(200,255,210,0.98) 0%, rgba(100,220,130,0.85) 45%, rgba(40,160,80,0.6) 100%)'
            : isListening
            ? 'radial-gradient(circle at 38% 32%, rgba(210,225,255,0.95) 0%, rgba(150,175,240,0.75) 45%, rgba(90,110,200,0.4) 100%)'
            : 'radial-gradient(circle at 38% 32%, rgba(255,255,255,0.95) 0%, rgba(210,215,225,0.75) 45%, rgba(140,145,165,0.4) 100%)',
          boxShadow: isSpeaking
            ? '0 0 25px rgba(100,220,130,0.4), 0 0 50px rgba(100,220,130,0.15), inset 0 1px 0 rgba(255,255,255,0.9)'
            : isListening
            ? '0 0 20px rgba(150,175,240,0.25), inset 0 1px 0 rgba(255,255,255,0.7)'
            : '0 0 18px rgba(255,255,255,0.12), inset 0 1px 0 rgba(255,255,255,0.6)',
          animation: isSpeaking ? 'none' : 'breathe 5s ease-in-out infinite',
          transition: 'background 0.5s ease, box-shadow 0.5s ease, width 0.4s ease, height 0.4s ease',
        }}
      >
        {/* Specular highlight */}
        <div className="absolute rounded-full"
          style={{ width: '32%', height: '32%', top: '14%', left: '18%', background: 'rgba(255,255,255,0.45)', filter: 'blur(5px)' }} />
      </div>
    </div>
  );
}
