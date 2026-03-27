'use client';
import { useEffect, useState, useRef } from 'react';

type OrbState = 'idle' | 'listening' | 'speaking' | 'greeting';

interface PresenceOrbProps {
  state: OrbState;
  size?: 'sm' | 'lg';
}

export function PresenceOrb({ state, size = 'lg' }: PresenceOrbProps) {
  const [mounted, setMounted] = useState(false);
  const [beatPhase, setBeatPhase] = useState(0);
  const animRef = useRef<number>(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    setMounted(true);
    const animate = () => {
      setBeatPhase((Date.now() - startRef.current) / 1000);
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  const d = size === 'lg' ? 96 : 64;
  const isSpeaking = state === 'speaking' || state === 'greeting';
  const isListening = state === 'listening';

  // Breathing calculation - smooth sine wave
  const breathe = Math.sin(beatPhase * 0.4) * 0.5 + 0.5; // 0 to 1, ~15s cycle
  const heartbeat = isSpeaking
    ? Math.sin(beatPhase * 3.5) * 0.5 + 0.5  // faster pulse when speaking
    : Math.sin(beatPhase * 0.7) * 0.5 + 0.5;  // slow pulse at idle

  const coreScale = isSpeaking
    ? 1.05 + heartbeat * 0.08
    : isListening
    ? 0.92 + breathe * 0.03
    : 0.96 + breathe * 0.06;

  const glowIntensity = isSpeaking
    ? 0.35 + heartbeat * 0.2
    : 0.12 + breathe * 0.08;

  const coreColor = isSpeaking
    ? `rgba(${Math.round(100 + heartbeat * 40)}, 220, ${Math.round(120 + heartbeat * 20)}, 0.95)`
    : isListening
    ? 'rgba(180, 200, 255, 0.9)'
    : `rgba(${Math.round(230 + breathe * 25)}, ${Math.round(232 + breathe * 23)}, ${Math.round(240 + breathe * 15)}, 0.92)`;

  const glowColor = isSpeaking
    ? `rgba(80, 200, 100, ${glowIntensity})`
    : isListening
    ? `rgba(120, 160, 255, ${glowIntensity * 0.7})`
    : `rgba(200, 210, 255, ${glowIntensity * 0.5})`;

  return (
    <div
      className="relative flex items-center justify-center select-none"
      style={{
        width: d * 2.8,
        height: d * 2.8,
        opacity: mounted ? 1 : 0,
        transition: 'opacity 2s ease',
      }}
    >
      {/* Outermost ambient glow - very subtle, large */}
      <div
        className="absolute rounded-full"
        style={{
          width: d * 2.6,
          height: d * 2.6,
          background: `radial-gradient(circle, ${glowColor} 0%, transparent 65%)`,
          filter: 'blur(20px)',
          transition: 'background 0.8s ease',
        }}
      />

      {/* Ripple rings - speaking only */}
      {isSpeaking && (
        <>
          {[0, 1, 2].map((i) => {
            const progress = ((beatPhase * 0.5 - i * 0.33) % 1 + 1) % 1;
            const ringScale = 0.7 + progress * 0.6;
            const ringOpacity = Math.max(0, (1 - progress) * 0.5);
            return (
              <div
                key={i}
                className="absolute rounded-full"
                style={{
                  width: d * 1.8,
                  height: d * 1.8,
                  border: `1.5px solid rgba(100, 220, 120, ${ringOpacity})`,
                  transform: `scale(${ringScale})`,
                  // No transition - driven by RAF for smooth animation
                }}
              />
            );
          })}
        </>
      )}

      {/* Listening ring - single slow pulse */}
      {isListening && (
        <div
          className="absolute rounded-full"
          style={{
            width: d * 1.5,
            height: d * 1.5,
            border: '1px solid rgba(150, 180, 255, 0.25)',
            transform: `scale(${0.95 + breathe * 0.1})`,
            opacity: 0.4 + breathe * 0.3,
          }}
        />
      )}

      {/* Mid glow halo */}
      <div
        className="absolute rounded-full"
        style={{
          width: d * 1.4,
          height: d * 1.4,
          background: `radial-gradient(circle, ${glowColor.replace(/[\d.]+\)$/, `${glowIntensity * 1.5})`)} 0%, transparent 70%)`,
          filter: 'blur(8px)',
          transition: 'background 0.6s ease',
        }}
      />

      {/* Core orb */}
      <div
        className="relative rounded-full"
        style={{
          width: d,
          height: d,
          transform: `scale(${coreScale})`,
          background: isSpeaking
            ? `radial-gradient(circle at 38% 30%, rgba(220, 255, 225, 0.99) 0%, rgba(${Math.round(80 + heartbeat * 40)}, 210, ${Math.round(100 + heartbeat * 30)}, 0.92) 45%, rgba(30, 140, 60, 0.7) 100%)`
            : isListening
            ? 'radial-gradient(circle at 38% 30%, rgba(220, 230, 255, 0.98) 0%, rgba(150, 170, 240, 0.8) 45%, rgba(80, 100, 200, 0.5) 100%)'
            : `radial-gradient(circle at 38% 30%, rgba(255, 255, 255, ${0.88 + breathe * 0.1}) 0%, rgba(${Math.round(195 + breathe * 20)}, ${Math.round(198 + breathe * 18)}, ${Math.round(215 + breathe * 12)}, 0.8) 45%, rgba(120, 125, 150, 0.45) 100%)`,
          boxShadow: isSpeaking
            ? `0 0 ${Math.round(20 + heartbeat * 20)}px rgba(80, 210, 100, ${0.35 + heartbeat * 0.2}), 0 0 ${Math.round(40 + heartbeat * 30)}px rgba(80, 210, 100, 0.15), inset 0 1px 0 rgba(255,255,255,0.95)`
            : isListening
            ? '0 0 20px rgba(130, 160, 255, 0.2), inset 0 1px 0 rgba(255,255,255,0.8)'
            : `0 0 ${Math.round(15 + breathe * 12)}px rgba(180, 190, 220, ${0.1 + breathe * 0.08}), inset 0 1px 0 rgba(255,255,255,${0.6 + breathe * 0.2})`,
          transition: 'background 0.6s ease, box-shadow 0.4s ease',
        }}
      >
        {/* Specular highlight - moves slightly */}
        <div
          className="absolute rounded-full"
          style={{
            width: '30%',
            height: '30%',
            top: '12%',
            left: '16%',
            background: `rgba(255,255,255,${0.35 + breathe * 0.15})`,
            filter: 'blur(6px)',
            transition: 'opacity 0.5s ease',
          }}
        />
        {/* Secondary inner glow when speaking */}
        {isSpeaking && (
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `radial-gradient(circle at 50% 50%, rgba(150, 255, 170, ${heartbeat * 0.2}) 0%, transparent 60%)`,
            }}
          />
        )}
      </div>
    </div>
  );
}
