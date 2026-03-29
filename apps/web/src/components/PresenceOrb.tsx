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
    const canvasSize = Math.round(r * 7);
    const W = canvasSize;
    const H = canvasSize;
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

      // === OUTER GLOW (drawn first, behind orb) ===
      const maxGlowR = canvasSize * 0.42;
      const glowR = Math.min(currentR * (2.2 + breathe * 0.2 + sp * 0.6), maxGlowR);
      const glowAlpha = 0.06 + breathe * 0.04 + sp * 0.12;
      const outerGlow = ctx.createRadialGradient(cx, cy, currentR * 0.5, cx, cy, glowR);
      outerGlow.addColorStop(0, `rgba(${(200 - sp * 110) | 0}, ${(210 + sp * 20) | 0}, ${(240 - sp * 130) | 0}, ${glowAlpha})`);
      outerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.beginPath();
      ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
      ctx.fillStyle = outerGlow;
      ctx.fill();

      // === IDLE RING ===
      const idleRingR = Math.min(currentR * (1.18 + Math.sin(t * 0.8) * 0.04), canvasSize * 0.35);
      ctx.beginPath();
      ctx.arc(cx, cy, idleRingR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(200, 210, 240, ${0.09 + breathe * 0.05})`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // === BASE ORB — radial gradient with specular highlight offset ===
      const baseGrad = ctx.createRadialGradient(
        cx - r * 0.25, cy - r * 0.3, 0,
        cx, cy, currentR
      );

      const topR = 255 - sp * 55;
      const topG = 255 - sp * 0;
      const topB = 255 - sp * 45;
      const midR = 205 + breathe * 20 - sp * 145 + sp * pulse * 40;
      const midG = 205 + breathe * 20 + sp * 5 + sp * pulse * 40;
      const midB = 220 + breathe * 15 - sp * 140 + sp * pulse * 40;
      const botR = 110 - sp * 80;
      const botG = 115 + sp * 25;
      const botB = 145 - sp * 85;

      baseGrad.addColorStop(0, `rgba(${topR | 0}, ${topG | 0}, ${topB | 0}, 0.98)`);
      baseGrad.addColorStop(0.45, `rgba(${midR | 0}, ${midG | 0}, ${midB | 0}, 0.9)`);
      baseGrad.addColorStop(1, `rgba(${botR | 0}, ${botG | 0}, ${botB | 0}, 0.75)`);

      ctx.beginPath();
      ctx.arc(cx, cy, currentR, 0, Math.PI * 2);
      ctx.fillStyle = baseGrad;
      ctx.fill();

      // === SPECULAR HIGHLIGHT ===
      const specGrad = ctx.createRadialGradient(
        cx - currentR * 0.28, cy - currentR * 0.30, 0,
        cx - currentR * 0.15, cy - currentR * 0.15, currentR * 0.45
      );
      specGrad.addColorStop(0, `rgba(255, 255, 255, ${0.55 + breathe * 0.12})`);
      specGrad.addColorStop(0.5, `rgba(255, 255, 255, ${0.15 + breathe * 0.05})`);
      specGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.beginPath();
      ctx.arc(cx, cy, currentR, 0, Math.PI * 2);
      ctx.fillStyle = specGrad;
      ctx.fill();

      // === LIGHT SWEEP ===
      const sweepAngle = t * 0.4;
      const sweepX = cx + Math.cos(sweepAngle) * currentR * 0.3;
      const sweepY = cy + Math.sin(sweepAngle) * currentR * 0.3;
      const sweepGrad = ctx.createRadialGradient(sweepX, sweepY, 0, sweepX, sweepY, currentR * 0.8);
      sweepGrad.addColorStop(0, `rgba(255, 255, 255, ${0.07 + sp * 0.05})`);
      sweepGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.beginPath();
      ctx.arc(cx, cy, currentR, 0, Math.PI * 2);
      ctx.fillStyle = sweepGrad;
      ctx.fill();

      // === SPEAKING RIPPLE RINGS ===
      if (sp > 0.01) {
        const maxRippleR = Math.min(canvasSize * 0.38, currentR * 3.5);
        for (let i = 0; i < 4; i++) {
          const progress = ((t * 0.55 - i * 0.25) % 1 + 1) % 1;
          const rR = currentR * 1.02 + progress * (maxRippleR - currentR);
          const rAlpha = Math.max(0, (1 - progress) * 0.35 * sp);
          const lineW = Math.max(0.3, 1.5 * (1 - progress));
          ctx.beginPath();
          ctx.arc(cx, cy, rR, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(100, 235, 120, ${rAlpha})`;
          ctx.lineWidth = lineW;
          ctx.stroke();
        }
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [size]);

  const r = size === 'lg' ? 72 : 40;
  const canvasSize = Math.round(r * 7);

  if (!mounted) return null;

  const wrapStyle = { display: 'inline-block', background: 'transparent', lineHeight: 0 } as React.CSSProperties;
  const cvStyle = { display: 'block', background: 'transparent' } as React.CSSProperties;

  return (
    <div style={wrapStyle}>
      <canvas
        ref={canvasRef}
        width={canvasSize}
        height={canvasSize}
        style={cvStyle}
      />
    </div>
  );
}
