'use client';
import { useEffect, useState } from 'react';

interface PresenceOrbProps {
  state: 'idle' | 'listening' | 'speaking' | 'greeting';
  size?: 'sm' | 'lg';
}

export function PresenceOrb({ state, size = 'lg' }: PresenceOrbProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setTimeout(() => setMounted(true), 100); }, []);

  const baseSize = size === 'lg' ? 96 : 72;

  return (
    <div className="relative flex items-center justify-center" style={{ width: baseSize * 2, height: baseSize * 2 }}>
      
      {/* Outermost ripple ring - only when speaking */}
      {state === 'speaking' && (
        <>
          <div className="absolute rounded-full border-2 border-white/30 animate-ripple-slow"
               style={{ width: baseSize * 1.9, height: baseSize * 1.9 }} />
          <div className="absolute rounded-full border-2 border-white/40 animate-ripple-medium"
               style={{ width: baseSize * 1.6, height: baseSize * 1.6 }} />
          <div className="absolute rounded-full border-2 border-white/50 animate-ripple-fast"
               style={{ width: baseSize * 1.3, height: baseSize * 1.3 }} />
        </>
      )}

      {/* Listening ring - single slow pulse */}
      {state === 'listening' && (
        <div className="absolute rounded-full border-2 border-blue-300/30 animate-pulse-ring"
             style={{ width: baseSize * 1.4, height: baseSize * 1.4 }} />
      )}

      {/* Outer glow layer */}
      <div
        className={`absolute rounded-full transition-all duration-1000 ${
          state === 'speaking' ? 'opacity-60 scale-110' :
          state === 'listening' ? 'opacity-30 scale-100' :
          'opacity-15 scale-100'
        }`}
        style={{
          width: baseSize * 1.2,
          height: baseSize * 1.2,
          background: state === 'speaking'
            ? 'radial-gradient(circle, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 70%)'
            : state === 'listening'
            ? 'radial-gradient(circle, rgba(180,200,255,0.5) 0%, rgba(180,200,255,0) 70%)'
            : 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 70%)',
          filter: 'blur(8px)',
        }}
      />

      {/* Core orb */}
      <div
        className={`relative rounded-full transition-all duration-700 ${
          state === 'idle' ? 'animate-breathe' :
          state === 'greeting' ? 'animate-breathe opacity-0 animate-fade-in' :
          ''
        }`}
        style={{
          width: state === 'speaking' ? baseSize * 1.05 : state === 'listening' ? baseSize * 0.9 : baseSize,
          height: state === 'speaking' ? baseSize * 1.05 : state === 'listening' ? baseSize * 0.9 : baseSize,
          background: state === 'speaking'
            ? 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.95) 0%, rgba(220,220,230,0.7) 50%, rgba(150,150,170,0.4) 100%)'
            : state === 'listening'
            ? 'radial-gradient(circle at 35% 35%, rgba(200,210,255,0.9) 0%, rgba(160,170,220,0.6) 50%, rgba(100,110,160,0.3) 100%)'
            : 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.85) 0%, rgba(200,200,215,0.6) 50%, rgba(130,130,150,0.3) 100%)',
          boxShadow: state === 'speaking'
            ? '0 0 30px rgba(255,255,255,0.3), 0 0 60px rgba(255,255,255,0.15), inset 0 1px 0 rgba(255,255,255,0.8)'
            : state === 'listening'
            ? '0 0 20px rgba(180,200,255,0.2), inset 0 1px 0 rgba(255,255,255,0.6)'
            : '0 0 20px rgba(255,255,255,0.1), inset 0 1px 0 rgba(255,255,255,0.5)',
        }}
      >
        {/* Inner highlight */}
        <div className="absolute rounded-full bg-white/30"
             style={{ width: '35%', height: '35%', top: '15%', left: '20%', filter: 'blur(4px)' }} />
      </div>

      {/* Mounted fade-in */}
      {!mounted && <div className="absolute inset-0 bg-slate-950 rounded-full" />}
    </div>
  );
}
