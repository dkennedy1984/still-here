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

  useEffect(() => { setMounted(true); }, []);

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

    const isSpeaking = state === 'speaking' || state === 'greeting';
    const isListening = state === 'listening';

    const draw = () => {
      const t = (Date.now() - startRef.current) / 1000;
      ctx.clearRect(0, 0, W, H);

      // Smooth waves
      const breathe = Math.sin(t * 0.45) * 0.5 + 0.5; // 0..1 slow breathe
      const pulse = isSpeaking ? Math.abs(Math.sin(t * 3.8)) : 0; // 0..1 fast pulse when speaking
      const shimmer = Math.sin(t * 1.2) * 0.5 + 0.5; // slow shimmer

      // Current radius - orb breathes in size slightly
      const currentR = isSpeaking
        ? r * (1.0 + pulse * 0.06)
        : r * (0.93 + breathe * 0.08); // more visible breathing

      // === OUTER AMBIENT GLOW ===
      const glowR = currentR * (isSpeaking ? 2.8 + pulse * 0.4 : 2.2 + breathe * 0.2);
      const glowAlpha = isSpeaking ? 0.12 + pulse * 0.10 : 0.06 + breathe * 0.04;
      const outerGlow = ctx.createRadialGradient(cx, cy, currentR * 0.5, cx, cy, glowR);
      if (isSpeaking) {
        outerGlow.addColorStop(0, `rgba(90, 230, 110, ${glowAlpha * 2})`);
        outerGlow.addColorStop(0.5, `rgba(60, 180, 80, ${glowAlpha})`);
        outerGlow.addColorStop(1, 'rgba(0,0,0,0)');
      } else if (isListening) {
        outerGlow.addColorStop(0, `rgba(140, 170, 255, ${glowAlpha * 1.5})`);
        outerGlow.addColorStop(1, 'rgba(0,0,0,0)');
      } else {
        outerGlow.addColorStop(0, `rgba(200, 210, 240, ${glowAlpha * 1.2})`);
        outerGlow.addColorStop(1, 'rgba(0,0,0,0)');
      }
      ctx.beginPath();
      ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
      ctx.fillStyle = outerGlow;
      ctx.fill();

      // === ALWAYS-PRESENT IDLE RING ===
      const idleRingR = Math.min(currentR * (1.18 + Math.sin(t * 0.8) * 0.04), canvasSize * 0.35);
      ctx.beginPath();
      ctx.arc(cx, cy, idleRingR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(200, 210, 240, ${0.045 + breathe * 0.025})`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // === RIPPLE RINGS (speaking only) ===
      if (isSpeaking) {
        // Ripple rings - ensure they fade out well within canvas bounds
        const maxRippleR = canvasSize * 0.38; // keep rings within 38% of canvas edge
        for (let i = 0; i < 4; i++) {
          const progress = ((t * 0.55 - i * 0.25) % 1 + 1) % 1;
          const rR = currentR * 1.02 + progress * (maxRippleR - currentR);
          const rAlpha = Math.max(0, (1 - progress) * 0.35);
          const lineW = Math.max(0.3, 1.5 * (1 - progress));
          ctx.beginPath();
          ctx.arc(cx, cy, rR, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(100, 235, 120, ${rAlpha})`;
          ctx.lineWidth = lineW;
          ctx.stroke();
        }
      }

      // === LISTENING RING ===
      if (isListening) {
        const lR = currentR * (1.25 + Math.sin(t * 1.8) * 0.06);
        ctx.beginPath();
        ctx.arc(cx, cy, lR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(150, 180, 255, ${0.2 + breathe * 0.12})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // === CORE SPHERE ===
      // Deep base layer
      const baseGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, currentR);
      if (isSpeaking) {
        const g = 185 + pulse * 40 | 0;
        baseGrad.addColorStop(0, `rgba(200, 255, 210, 0.98)`);
        baseGrad.addColorStop(0.5, `rgba(60, ${g}, 80, 0.95)`);
        baseGrad.addColorStop(1, `rgba(20, 110, 40, 0.9)`);
      } else if (isListening) {
        baseGrad.addColorStop(0, 'rgba(215, 225, 255, 0.97)');
        baseGrad.addColorStop(0.5, 'rgba(130, 155, 240, 0.88)');
        baseGrad.addColorStop(1, 'rgba(65, 90, 195, 0.75)');
      } else {
        const b = 205 + breathe * 20 | 0;
        baseGrad.addColorStop(0, `rgba(255,255,255,${0.93 + breathe * 0.05})`);
        baseGrad.addColorStop(0.45, `rgba(${b},${b},${b + 15 | 0},${0.82 + breathe * 0.05})`);
        baseGrad.addColorStop(1, 'rgba(110,115,145,0.65)');
      }
      ctx.beginPath();
      ctx.arc(cx, cy, currentR, 0, Math.PI * 2);
      ctx.fillStyle = baseGrad;
      ctx.fill();

      // === MOVING LIGHT SWEEP (the shimmer) ===
      // A soft light band that slowly moves across the orb surface
      const sweepAngle = t * 0.4;
      const sweepX = cx + Math.cos(sweepAngle) * currentR * 0.3;
      const sweepY = cy + Math.sin(sweepAngle) * currentR * 0.3;
      const sweepGrad = ctx.createRadialGradient(sweepX, sweepY, 0, sweepX, sweepY, currentR * 0.8);
      const sweepAlpha = isSpeaking ? 0.12 + pulse * 0.08 : 0.07 + shimmer * 0.05;
      sweepGrad.addColorStop(0, `rgba(255,255,255,${sweepAlpha})`);
      sweepGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, currentR, 0, Math.PI * 2);
      ctx.fillStyle = sweepGrad;
      ctx.fill();

      // === SECOND LIGHT SWEEP (opposite direction, slower) ===
      const sweep2Angle = -t * 0.25;
      const sweep2X = cx + Math.cos(sweep2Angle) * currentR * 0.4;
      const sweep2Y = cy + Math.sin(sweep2Angle) * currentR * 0.4;
      const sweep2Grad = ctx.createRadialGradient(sweep2X, sweep2Y, 0, sweep2X, sweep2Y, currentR * 0.6);
      sweep2Grad.addColorStop(0, `rgba(255,255,255,${0.04 + shimmer * 0.03})`);
      sweep2Grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, currentR, 0, Math.PI * 2);
      ctx.fillStyle = sweep2Grad;
      ctx.fill();

      // === SPECULAR HIGHLIGHT (top-left, slowly rotating) ===
      const specX = cx - currentR * 0.28;
      const specY = cy - currentR * 0.30;
      const specGrad = ctx.createRadialGradient(specX, specY, 0, specX, specY, currentR * 0.42);
      specGrad.addColorStop(0, `rgba(255,255,255,${0.55 + breathe * 0.12})`);
      specGrad.addColorStop(0.5, `rgba(255,255,255,${0.15 + breathe * 0.05})`);
      specGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, currentR, 0, Math.PI * 2);
      ctx.fillStyle = specGrad;
      ctx.fill();

      // === SMALL SECONDARY HIGHLIGHT (bottom-right reflection) ===
      const spec2X = cx + currentR * 0.32;
      const spec2Y = cy + currentR * 0.28;
      const spec2Grad = ctx.createRadialGradient(spec2X, spec2Y, 0, spec2X, spec2Y, currentR * 0.2);
      spec2Grad.addColorStop(0, `rgba(255,255,255,${0.12 + shimmer * 0.06})`);
      spec2Grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, currentR, 0, Math.PI * 2);
      ctx.fillStyle = spec2Grad;
      ctx.fill();

      // === INNER PULSE FLASH (speaking only) ===
      if (isSpeaking && pulse > 0.55) {
        const flashGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, currentR * 0.7);
        flashGrad.addColorStop(0, `rgba(180,255,195,${(pulse - 0.55) * 0.5})`);
        flashGrad.addColorStop(1, 'rgba(180,255,195,0)');
        ctx.beginPath();
        ctx.arc(cx, cy, currentR * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = flashGrad;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [state, size]);

  const r = size === 'lg' ? 52 : 36;
  const canvasSize = Math.round(r * 9);

  return (
    <div style={{
      opacity: mounted ? 1 : 0,
      transition: 'opacity 2s ease',
      filter: 'drop-shadow(0 0 15px rgba(170,185,220,0.12))',
    }}>
      <canvas ref={canvasRef} width={canvasSize} height={canvasSize} style={{ display: 'block' }} />
    </div>
  );
}
