'use client';
import { useEffect, useRef, useState } from 'react';

type OrbState = 'idle' | 'listening' | 'speaking' | 'greeting';

interface PresenceOrbProps {
  state: OrbState;
  size?: 'sm' | 'lg';
}

export function PresenceOrb({ state, size = 'lg' }: PresenceOrbProps) {
  const [mounted, setMounted] = useState(false);
  const stateRef = useRef(state);
  const speakingRef = useRef(0);
  const listeningRef = useRef(0);
  const animRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const startRef = useRef(Date.now());

  // Track state without restarting animation
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;

    const LERP_IN = 0.04;  // smoother transition in (~1 second)
    const LERP_OUT = 0.02; // smooth transition out (~2 seconds)
    let microNextEvent = 0;
    let microProgress = -1;

    const animate = () => {
      const t = (Date.now() - startRef.current) / 1000;
      const current = stateRef.current;
      const isSpeaking = current === 'speaking' || current === 'greeting';
      const isListening = current === 'listening';

      // Lerp towards target â fast in, slow out
      const targetSp = isSpeaking ? 1 : 0;
      const targetLs = isListening ? 1 : 0;
      const spLerp = targetSp > speakingRef.current ? LERP_IN : LERP_OUT;
      const lsLerp = targetLs > listeningRef.current ? LERP_IN : LERP_OUT;
      speakingRef.current += (targetSp - speakingRef.current) * spLerp;
      listeningRef.current += (targetLs - listeningRef.current) * lsLerp;
      if (Math.abs(speakingRef.current - targetSp) < 0.005) speakingRef.current = targetSp;
      if (Math.abs(listeningRef.current - targetLs) < 0.005) listeningRef.current = targetLs;

      const sp = speakingRef.current;
      const ls = listeningRef.current;

      // Gentle breathing â same for ALL states, no size difference
      const breathe = Math.sin(t * 0.523) * 0.5 + 0.5; // 12s cycle
      const scale = 0.95 + breathe * 0.05; // gentle 5% breathing, same for all states

      // Disable pulse entirely â no size changes during speaking
      const pulse = 0;

      // Micro-animations during idle
      let microBright = 0;
      if (sp < 0.1 && ls < 0.1) {
        if (t > microNextEvent) {
          microProgress = 0;
          microNextEvent = t + 20 + Math.random() * 40;
        }
        if (microProgress >= 0 && microProgress < 1) {
          microProgress += 0.008;
          microBright = Math.sin(microProgress * Math.PI) * 0.08;
        }
      }

      // Apply to container
      const el = containerRef.current;
      if (el) {
        const idleEl = el.querySelector('.orb-idle') as HTMLElement;
        const speakEl = el.querySelector('.orb-speaking') as HTMLElement;
        const listenEl = el.querySelector('.orb-listening') as HTMLElement;
        const glowEl = el.querySelector('.orb-glow') as HTMLElement;
        const ringsEl = el.querySelector('.orb-rings') as HTMLElement;

        if (idleEl) idleEl.style.opacity = String(Math.max(0, 1 - sp - ls));
        if (speakEl) speakEl.style.opacity = String(sp);
        if (listenEl) listenEl.style.opacity = String(ls);

        // Same scale and brightness for all orb images â no state-based size changes
        const brightness = 1 + microBright + sp * 0.1;
        const orbTransform = `scale(${scale})`;
        const orbFilter = `brightness(${brightness})`;
        [idleEl, speakEl, listenEl].forEach(img => {
          if (img) {
            img.style.transform = orbTransform;
            img.style.filter = orbFilter;
          }
        });

        // Glow
        if (glowEl) glowEl.style.boxShadow = 'none';

        // Ripple rings â only during speaking
        if (ringsEl) {
          ringsEl.style.opacity = String(sp > 0.05 ? sp : 0);
        }
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [mounted, size]);

  const d = size === 'lg' ? 280 : 120; // image display size
  const containerSize = d * 1.8; // room for rings

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center"
      style={{
        width: containerSize,
        height: containerSize,
        opacity: mounted ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }}
    >
      {/* Glow layer */}

      {/* Ripple rings */}
      <div className="orb-rings absolute" style={{ width: d * 2, height: d * 2, opacity: 0 }}>
        <div className="absolute inset-0 rounded-full border border-green-400/30 animate-ripple-1" />
        <div className="absolute inset-0 rounded-full border border-green-400/20 animate-ripple-2" />
        <div className="absolute inset-0 rounded-full border border-green-400/15 animate-ripple-3" />
      </div>

      {/* Idle orb image */}
      <img
        src="/orb/orb--idle.png"
        alt=""
        className="orb-idle absolute"
        style={{
          width: d,
          height: d,
          objectFit: 'contain' as const,
          transition: 'opacity 0.1s ease',
          pointerEvents: 'none',
        }}
        draggable={false}
      />

      {/* Speaking orb image */}
      <img
        src="/orb/orb-speaking.png"
        alt=""
        className="orb-speaking absolute"
        style={{
          width: d,
          height: d,
          objectFit: 'contain' as const,
          opacity: 0,
          transition: 'opacity 0.1s ease',
          pointerEvents: 'none',
        }}
        draggable={false}
      />

      {/* Listening orb image */}
      <img
        src="/orb/orb-listening.png"
        alt=""
        className="orb-listening absolute"
        style={{
          width: d,
          height: d,
          objectFit: 'contain' as const,
          opacity: 0,
          transition: 'opacity 0.1s ease',
          pointerEvents: 'none',
        }}
        draggable={false}
      />
    </div>
  );
}
