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

    // Interpolation state — smoothly tracks target
    let targetSpeaking = 0; // 0 = idle, 1 = speaking
    let targetListening = 0; // 0 = idle, 1 = listening
    let currentSpeaking = 0; // smoothly interpolates towards target
    let currentListening = 0;
    const LERP_SPEED = 0.04; // how fast to transition (lower = smoother, 0.04 ≈ 0.5 second)

    const draw = () => {
      const t = (Date.now() - startRef.current) / 1000;
      ctx.clearRect(0, 0, W, H);

      // Update targets based on state
      targetSpeaking = isSpeaking ? 1 : 0;
      targetListening = isListening ? 1 : 0;

      // Smoothly interpolate
      currentSpeaking += (targetSpeaking - currentSpeaking) * LERP_SPEED;
      currentListening += (targetListening - currentListening) * LERP_SPEED;

      // Clamp to avoid floating point drift
      if (Math.abs(currentSpeaking - targetSpeaking) < 0.001) currentSpeaking = targetSpeaking;
      if (Math.abs(currentListening - targetListening) < 0.001) currentListening = targetListening;

      // Smooth waves
      const breathe = Math.sin(t * 0.45) * 0.5 + 0.5; // 0..1 slow breathe
      const pulse = currentSpeaking > 0.001 ? Math.abs(Math.sin(t * 3.8)) * currentSpeaking : 0; // 0..1 fast pulse scaled by speaking blend
      const shimmer = Math.sin(t * 1.2) * 0.5 + 0.5; // slow shimmer

      // Current radius - orb breathes in size slightly, blended between states
      const idleBaseR = r * (0.93 + breathe * 0.08);
      const speakBaseR = r * (1.0 + pulse * 0.06);
      const currentR = idleBaseR + (speakBaseR - idleBaseR) * currentSpeaking;

      // === OUTER AMBIENT GLOW ===
      const glowRIdle = currentR * (2.2 + breathe * 0.2);
      const glowRSpeak = currentR * (2.8 + pulse * 0.4);
      const glowR = glowRIdle + (glowRSpeak - glowRIdle) * currentSpeaking;
      const glowAlpha = (0.06 + breathe * 0.04) + currentSpeaking * (0.12 + pulse * 0.10);

      // Green component blends in with currentSpeaking; blue/listening tint with currentListening
      const glowGreenR = Math.round(90 * currentSpeaking + 200 * (1 - currentSpeaking) - 60 * currentListening);
      const glowGreenG = Math.round(190 + currentSpeaking * 40 + currentListening * 20);
      const glowGreenB = Math.round(110 * currentSpeaking + 240 * (1 - currentSpeaking) + currentListening * 15);
      const glowColor = `rgba(${glowGreenR}, ${glowGreenG}, ${glowGreenB}, ${glowAlpha})`;

      const outerGlow = ctx.createRadialGradient(cx, cy, currentR * 0.5, cx, cy, glowR);
      outerGlow.addColorStop(0, glowColor);
      outerGlow.addColorStop(0.5, `rgba(${glowGreenR}, ${glowGreenG}, ${glowGreenB}, ${glowAlpha * 0.5})`);
      outerGlow.addColorStop(1, 'rgba(0,0,0,0)');
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

      // === RIPPLE RINGS (fade in/out with currentSpeaking) ===
      if (currentSpeaking > 0.01) {
        const maxRippleR = canvasSize * 0.38;
        for (let i = 0; i < 4; i++) {
          const progress = ((t * 0.55 - i * 0.25) % 1 + 1) % 1;
          const rR = currentR * 1.02 + progress * (maxRippleR - currentR);
          const rAlpha = Math.max(0, (1 - progress) * 0.35 * currentSpeaking);
          const lineW = Math.max(0.3, 1.5 * (1 - progress));
          ctx.beginPath();
          ctx.arc(cx, cy, rR, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(100, 235, 120, ${rAlpha})`;
          ctx.lineWidth = lineW;
          ctx.stroke();
        }
      }

      // === LISTENING RING (fade in/out with currentListening) ===
      if (currentListening > 0.01) {
        const lR = currentR * (1.25 + Math.sin(t * 1.8) * 0.06);
        ctx.beginPath();
        ctx.arc(cx, cy, lR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(150, 180, 255, ${(0.2 + breathe * 0.12) * currentListening})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // === CORE SPHERE ===
      // Blend colours based on smooth interpolation
      const speakR = 60 + currentSpeaking * (pulse * 40);
      const speakG = 185 + currentSpeaking * (pulse * 40);
      const speakB = 80 + currentSpeaking * (pulse * 40);

      const idleR = 205 + breathe * 20;
      const idleG = 205 + breathe * 20;
      const idleB = 220 + breathe * 20;

      // Listening colours
      const listenR = 130;
      const listenG = 155;
      const listenB = 240;

      // Interpolate idle → speaking → listening
      const speakFrac = currentSpeaking;
      const listenFrac = currentListening * (1 - currentSpeaking);

      const coreR = idleR + (speakR - idleR) * speakFrac + (listenR - idleR) * listenFrac;
      const coreG = idleG + (speakG - idleG) * speakFrac + (listenG - idleG) * listenFrac;
      const coreB = idleB + (speakB - idleB) * speakFrac + (listenB - idleB) * listenFrac;

      const baseGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, currentR);

      // Top highlight blends between white (idle) and light-green (speaking) / light-blue (listening)
      const topHR = Math.round(200 + (255 - 200) * (1 - speakFrac) * (1 - listenFrac));
      const topHG = Math.round(255);
      const topHB = Math.round(255 - speakFrac * 45 + listenFrac * 0);
      const topAlpha = 0.93 + breathe * 0.05;
      baseGrad.addColorStop(0, `rgba(${topHR}, ${topHG}, ${topHB}, ${topAlpha})`);
      baseGrad.addColorStop(0.5, `rgba(${Math.round(coreR)}, ${Math.round(coreG)}, ${Math.round(coreB)}, 0.92)`);

      // Dark edge: green-dark when speaking, blue-dark when listening, grey when idle
      const edgeR = Math.round(110 - speakFrac * 90 + listenFrac * (65 - 110));
      const edgeG = Math.round(115 + speakFrac * (110 - 115) + listenFrac * (90 - 115));
      const edgeB = Math.round(145 - speakFrac * 105 + listenFrac * (195 - 145));
      baseGrad.addColorStop(1, `rgba(${edgeR}, ${edgeG}, ${edgeB}, 0.75)`);

      ctx.beginPath();
      ctx.arc(cx, cy, currentR, 0, Math.PI * 2);
      ctx.fillStyle = baseGrad;
      ctx.fill();

      // === MOVING LIGHT SWEEP (the shimmer) ===
      const sweepAngle = t * 0.4;
      const sweepX = cx + Math.cos(sweepAngle) * currentR * 0.3;
      const sweepY = cy + Math.sin(sweepAngle) * currentR * 0.3;
      const sweepGrad = ctx.createRadialGradient(sweepX, sweepY, 0, sweepX, sweepY, currentR * 0.8);
      const sweepAlpha = 0.07 + shimmer * 0.05 + currentSpeaking * (0.05 + pulse * 0.03);
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
      // Brighten specular during speaking
      const specAlpha0 = 0.55 + breathe * 0.12 + currentSpeaking * 0.1;
      const specAlpha1 = 0.15 + breathe * 0.05 + currentSpeaking * 0.05;
      specGrad.addColorStop(0, `rgba(255,255,255,${specAlpha0})`);
      specGrad.addColorStop(0.5, `rgba(255,255,255,${specAlpha1})`);
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

      // === INNER PULSE FLASH (speaking only, fades with currentSpeaking) ===
      if (currentSpeaking > 0.01 && pulse > 0.55) {
        const flashAlpha = (pulse - 0.55) * 0.5 * currentSpeaking;
        const flashGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, currentR * 0.7);
        flashGrad.addColorStop(0, `rgba(180,255,195,${flashAlpha})`);
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
