'use client';
import { useEffect, useState, useRef } from 'react';

type OrbState = 'idle' | 'listening' | 'speaking' | 'greeting';

interface PresenceOrbProps {
  state: OrbState;
  size?: 'sm' | 'lg';
}

export function PresenceOrb({ state, size = 'lg' }: PresenceOrbProps) {
  const [mounted, setMounted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const d = size === 'lg' ? 96 : 64;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const r = d / 2;

    const isSpeaking = state === 'speaking' || state === 'greeting';
    const isListening = state === 'listening';

    const draw = () => {
      const t = (Date.now() - startRef.current) / 1000;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Breathing: slow sine wave
      const breathe = Math.sin(t * 0.4) * 0.5 + 0.5;
      const heartbeat = isSpeaking ? Math.sin(t * 4.0) * 0.5 + 0.5 : Math.sin(t * 0.8) * 0.5 + 0.5;

      // Ripple rings when speaking
      if (isSpeaking) {
        for (let i = 0; i < 3; i++) {
          const progress = ((t * 0.6 - i * 0.33) % 1 + 1) % 1;
          const rippleR = r * (0.9 + progress * 1.1);
          const alpha = (1 - progress) * 0.4;
          ctx.beginPath();
          ctx.arc(cx, cy, rippleR, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(100, 220, 120, ${alpha})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      // Listening ring
      if (isListening) {
        const listenR = r * (1.2 + breathe * 0.1);
        ctx.beginPath();
        ctx.arc(cx, cy, listenR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(160, 190, 255, ${0.2 + breathe * 0.15})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Outer glow
      const glowR = isSpeaking ? r * (1.1 + heartbeat * 0.15) : r * (1.05 + breathe * 0.08);
      const glowColor = isSpeaking ? `rgba(80, 200, 100, ${0.15 + heartbeat * 0.15})` : `rgba(180, 190, 220, ${0.08 + breathe * 0.06})`;
      const glow = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, glowR * 1.5);
      glow.addColorStop(0, glowColor);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, glowR * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Core orb
      const coreR = isSpeaking ? r * (1.0 + heartbeat * 0.06) : r * (0.97 + breathe * 0.04);
      const coreGrad = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, 0, cx, cy, coreR);
      if (isSpeaking) {
        coreGrad.addColorStop(0, `rgba(220, 255, 225, 0.99)`);
        coreGrad.addColorStop(0.45, `rgba(${80 + heartbeat * 40 | 0}, 210, ${100 + heartbeat * 30 | 0}, 0.92)`);
        coreGrad.addColorStop(1, `rgba(30, 140, 60, 0.75)`);
      } else if (isListening) {
        coreGrad.addColorStop(0, 'rgba(220, 230, 255, 0.97)');
        coreGrad.addColorStop(0.45, 'rgba(150, 170, 240, 0.8)');
        coreGrad.addColorStop(1, 'rgba(80, 100, 200, 0.5)');
      } else {
        const wb = 200 + breathe * 20 | 0;
        coreGrad.addColorStop(0, `rgba(255, 255, 255, ${0.88 + breathe * 0.1})`);
        coreGrad.addColorStop(0.45, `rgba(${wb}, ${wb}, ${wb + 15 | 0}, 0.78)`);
        coreGrad.addColorStop(1, 'rgba(120, 125, 150, 0.45)');
      }
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fillStyle = coreGrad;
      ctx.fill();

      // Specular highlight
      const specGrad = ctx.createRadialGradient(cx - r * 0.28, cy - r * 0.28, 0, cx - r * 0.15, cy - r * 0.15, r * 0.45);
      specGrad.addColorStop(0, `rgba(255,255,255,${0.45 + breathe * 0.15})`);
      specGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fillStyle = specGrad;
      ctx.fill();

      // Inner pulse when speaking
      if (isSpeaking && heartbeat > 0.6) {
        const pulseGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.6);
        pulseGrad.addColorStop(0, `rgba(180, 255, 190, ${(heartbeat - 0.6) * 0.4})`);
        pulseGrad.addColorStop(1, 'rgba(180,255,190,0)');
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = pulseGrad;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [state, size]);

  const d = size === 'lg' ? 96 : 64;
  const canvasSize = d * 3;

  return (
    <div style={{ opacity: mounted ? 1 : 0, transition: 'opacity 2s ease' }}>
      <canvas
        ref={canvasRef}
        width={canvasSize}
        height={canvasSize}
        style={{ display: 'block' }}
      />
    </div>
  );
}
