'use client';
import { useEffect, useRef, useState } from 'react';

type OrbState = 'idle' | 'listening' | 'speaking' | 'greeting';

interface PresenceOrbProps {
  state: OrbState;
  size?: 'sm' | 'lg';
}

export function PresenceOrb({ state, size = 'lg' }: PresenceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const startRef = useRef(Date.now());
  const [mounted, setMounted] = useState(false);

  // --- FIX: keep interpolation values in refs so they persist across re-renders ---
  const speakingRef = useRef(0);
  const listeningRef = useRef(0);

  // --- FIX: track current state in a ref so the animation loop never needs state in its deps ---
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => { setMounted(true); }, []);

  // Animation loop depends only on [size] — never restarts on state change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const r = size === 'lg' ? 72 : 40;
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;

    const draw = () => {
      const t = (Date.now() - startRef.current) / 1000;
      ctx.clearRect(0, 0, W, H);

      // Read current state from ref — no stale closure
      const currentState = stateRef.current;
      const targetSpeaking = (currentState === 'speaking' || currentState === 'greeting') ? 1 : 0;
      const targetListening = currentState === 'listening' ? 1 : 0;

      // Very slow lerp — 0.015 ≈ 2 seconds to fully transition
      speakingRef.current += (targetSpeaking - speakingRef.current) * 0.015;
      listeningRef.current += (targetListening - listeningRef.current) * 0.015;

      // Clamp near-target to avoid infinite float drift
      if (Math.abs(speakingRef.current - targetSpeaking) < 0.005) speakingRef.current = targetSpeaking;
      if (Math.abs(listeningRef.current - targetListening) < 0.005) listeningRef.current = targetListening;

      const sp = speakingRef.current;   // 0–1, speaking blend
      const ls = listeningRef.current;  // 0–1, listening blend

      // === TIMING ===
      const breathe = (Math.sin(t * 0.9) + 1) / 2;
      const pulse   = (Math.sin(t * 3.2) + 1) / 2;

      // === RADIUS — blend idle/speaking/listening sizes ===
      const idleR    = r * (1 + breathe * 0.03);
      const speakR   = r * (1 + (0.04 + pulse * 0.08));
      const listenR  = r * (1 + breathe * 0.025);
      const currentR = idleR + (speakR - idleR) * sp + (listenR - idleR) * ls;

      // === OUTER GLOW ===
      const glowIdleA    = 0.12 + breathe * 0.06;
      const glowSpeakA   = 0.25 + pulse * 0.15;
      const glowListenA  = 0.18 + breathe * 0.08;
      const glowAlpha    = glowIdleA + (glowSpeakA - glowIdleA) * sp + (glowListenA - glowIdleA) * ls;

      const glowIdleR_c   = 200; const glowIdleG_c   = 200; const glowIdleB_c   = 215;
      const glowSpeakR_c  =  60; const glowSpeakG_c  = 210; const glowSpeakB_c  =  80;
      const glowListenR_c = 130; const glowListenG_c = 155; const glowListenB_c = 240;

      const glowR = glowIdleR_c + (glowSpeakR_c - glowIdleR_c) * sp + (glowListenR_c - glowIdleR_c) * ls;
      const glowG = glowIdleG_c + (glowSpeakG_c - glowIdleG_c) * sp + (glowListenG_c - glowIdleG_c) * ls;
      const glowB = glowIdleB_c + (glowSpeakB_c - glowIdleB_c) * sp + (glowListenB_c - glowIdleB_c) * ls;

      const outerGlow = ctx.createRadialGradient(cx, cy, currentR * 0.6, cx, cy, currentR * 2.2);
      outerGlow.addColorStop(0, `rgba(${Math.round(glowR)}, ${Math.round(glowG)}, ${Math.round(glowB)}, ${glowAlpha})`);
      outerGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, currentR * 2.2, 0, Math.PI * 2);
      ctx.fillStyle = outerGlow;
      ctx.fill();

      // === RIPPLE RINGS (only visible while speaking) ===
      if (sp > 0.01) {
        const maxRippleR = currentR * 1.6;
        const numRipples = 3;
        for (let i = 0; i < numRipples; i++) {
          const offset  = i / numRipples;
          const progress = ((t * 0.55 + offset) % 1);
          const rR       = currentR * 1.02 + progress * (maxRippleR - currentR);
          const rAlpha   = Math.max(0, (1 - progress) * 0.35 * sp);
          const lineW    = Math.max(0.3, 1.5 * (1 - progress));
          ctx.beginPath();
          ctx.arc(cx, cy, rR, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(100, 235, 120, ${rAlpha})`;
          ctx.lineWidth = lineW;
          ctx.stroke();
        }
      }

      // === LISTENING RING (fade in/out with ls) ===
      if (ls > 0.01) {
        const lR = currentR * (1.25 + Math.sin(t * 1.8) * 0.06);
        ctx.beginPath();
        ctx.arc(cx, cy, lR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(150, 180, 255, ${(0.2 + breathe * 0.12) * ls})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // === CORE SPHERE — full colour blend ===
      const idleR_c  = 205 + breathe * 20;
      const idleG_c  = 205 + breathe * 20;
      const idleB_c  = 220 + breathe * 20;

      const speakR_c = 60  + pulse * 40;
      const speakG_c = 185 + pulse * 40;
      const speakB_c = 80  + pulse * 40;

      const listenR_c = 130;
      const listenG_c = 155;
      const listenB_c = 240;

      // sp and ls can both be non-zero during cross-fade; ls de-weighted by (1-sp) to keep sum ≤ 1
      const listenFrac = ls * (1 - sp);

      const coreR = idleR_c + (speakR_c - idleR_c) * sp + (listenR_c - idleR_c) * listenFrac;
      const coreG = idleG_c + (speakG_c - idleG_c) * sp + (listenG_c - idleG_c) * listenFrac;
      const coreB = idleB_c + (speakB_c - idleB_c) * sp + (listenB_c - idleB_c) * listenFrac;

      const baseGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, currentR);

      // Top highlight blends between soft white (idle) and bright white (speaking)
      const highlightAlpha = 0.55 + sp * 0.25 + breathe * 0.1;
      baseGrad.addColorStop(0,   `rgba(255,255,255,${highlightAlpha})`);
      baseGrad.addColorStop(0.3, `rgba(${Math.round(coreR)},${Math.round(coreG)},${Math.round(coreB)},0.9)`);
      baseGrad.addColorStop(0.7, `rgba(${Math.round(coreR * 0.8)},${Math.round(coreG * 0.8)},${Math.round(coreB * 0.8)},0.95)`);
      baseGrad.addColorStop(1,   `rgba(${Math.round(coreR * 0.6)},${Math.round(coreG * 0.6)},${Math.round(coreB * 0.6)},1)`);

      ctx.beginPath();
      ctx.arc(cx, cy, currentR, 0, Math.PI * 2);
      ctx.fillStyle = baseGrad;
      ctx.fill();

      // === SPECULAR HIGHLIGHT ===
      const specAlpha  = 0.4 + sp * 0.2 + breathe * 0.05;
      const specSize   = currentR * (0.45 + sp * 0.1);
      const specX      = cx - currentR * 0.28;
      const specY      = cy - currentR * 0.32;
      const specGrad   = ctx.createRadialGradient(specX, specY, 0, specX, specY, specSize);
      specGrad.addColorStop(0,   `rgba(255,255,255,${specAlpha})`);
      specGrad.addColorStop(0.5, `rgba(255,255,255,${specAlpha * 0.3})`);
      specGrad.addColorStop(1,   'rgba(255,255,255,0)');

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, currentR, 0, Math.PI * 2);
      ctx.clip();
      ctx.beginPath();
      ctx.arc(specX, specY, specSize, 0, Math.PI * 2);
      ctx.fillStyle = specGrad;
      ctx.fill();
      ctx.restore();

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
    };
  }, [size]); // NOT [state, size] — state changes are picked up via stateRef

  const dim = size === 'lg' ? 200 : 112;

  return (
    <canvas
      ref={canvasRef}
      width={dim}
      height={dim}
      style={{ display: mounted ? 'block' : 'none' }}
    />
  );
}
