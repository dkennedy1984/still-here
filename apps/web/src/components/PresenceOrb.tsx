'use client';
import { useEffect, useRef, useState } from 'react';

type OrbState = 'idle' | 'listening' | 'speaking' | 'greeting';

interface PresenceOrbProps {
  state: OrbState;
  size?: 'sm' | 'lg';
}

interface Particle {
  angle: number;
  radius: number;
  size: number;
  speed: number;
  opacity: number;
  baseRadius: number;
}

export function PresenceOrb({ state, size = 'lg' }: PresenceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const startRef = useRef(Date.now());
  const particlesRef = useRef<Particle[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    // Init particles
    const count = 18;
    particlesRef.current = Array.from({ length: count }, (_, i) => ({
      angle: (i / count) * Math.PI * 2,
      radius: 0,
      size: Math.random() * 2.5 + 1,
      speed: Math.random() * 0.3 + 0.15,
      opacity: Math.random() * 0.4 + 0.2,
      baseRadius: Math.random() * 0.25 + 0.55,
    }));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const d = size === 'lg' ? 100 : 68;
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;

    const isSpeaking = state === 'speaking' || state === 'greeting';
    const isListening = state === 'listening';

    const draw = () => {
      const t = (Date.now() - startRef.current) / 1000;
      ctx.clearRect(0, 0, W, H);

      // Smooth breathe and heartbeat
      const breathe = Math.sin(t * 0.5) * 0.5 + 0.5;
      const heartbeat = isSpeaking
        ? Math.abs(Math.sin(t * 5.0))
        : Math.sin(t * 0.9) * 0.5 + 0.5;

      // Wobble factors for blob shape - more wobble when speaking
      const wobbleAmount = isSpeaking ? 0.12 + heartbeat * 0.08 : 0.04 + breathe * 0.03;
      const wobbleSpeed = isSpeaking ? 3.5 : 0.7;

      // Draw blob as polygon with sine-distorted radius
      const points = 120;
      const baseR = isSpeaking
        ? d * (0.5 + heartbeat * 0.08)
        : isListening
        ? d * (0.47 + breathe * 0.02)
        : d * (0.46 + breathe * 0.05);

      // Outer glow
      const glowR = baseR * (isSpeaking ? 1.8 + heartbeat * 0.3 : 1.5 + breathe * 0.1);
      const glowAlpha = isSpeaking ? 0.18 + heartbeat * 0.15 : 0.08 + breathe * 0.05;
      const glowGrad = ctx.createRadialGradient(cx, cy, baseR * 0.3, cx, cy, glowR);
      if (isSpeaking) {
        glowGrad.addColorStop(0, `rgba(80, 220, 100, ${glowAlpha * 1.5})`);
        glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
      } else {
        glowGrad.addColorStop(0, `rgba(180, 190, 230, ${glowAlpha})`);
        glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
      }
      ctx.beginPath();
      ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
      ctx.fillStyle = glowGrad;
      ctx.fill();

      // Ripple rings when speaking
      if (isSpeaking) {
        for (let i = 0; i < 4; i++) {
          const progress = ((t * 0.7 - i * 0.25) % 1 + 1) % 1;
          const rippleR = baseR * (0.8 + progress * 1.4);
          const alpha = Math.max(0, (1 - progress) * 0.5);
          ctx.beginPath();
          ctx.arc(cx, cy, rippleR, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(80, 220, 100, ${alpha})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      // Listening pulse ring
      if (isListening) {
        const lR = baseR * (1.3 + Math.sin(t * 2) * 0.08);
        ctx.beginPath();
        ctx.arc(cx, cy, lR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(140, 170, 255, ${0.25 + breathe * 0.15})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      // Blob shape
      ctx.beginPath();
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const wobble1 = Math.sin(angle * 3 + t * wobbleSpeed) * wobbleAmount;
        const wobble2 = Math.sin(angle * 5 - t * wobbleSpeed * 0.7) * wobbleAmount * 0.5;
        const wobble3 = Math.sin(angle * 7 + t * wobbleSpeed * 1.3) * wobbleAmount * 0.3;
        const r = baseR * (1 + wobble1 + wobble2 + wobble3);
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();

      // Blob fill gradient
      const blobGrad = ctx.createRadialGradient(cx - baseR * 0.25, cy - baseR * 0.3, 0, cx, cy, baseR * 1.1);
      if (isSpeaking) {
        blobGrad.addColorStop(0, `rgba(230, 255, 235, 0.99)`);
        blobGrad.addColorStop(0.4, `rgba(${70 + heartbeat * 50 | 0}, ${200 + heartbeat * 30 | 0}, ${80 + heartbeat * 40 | 0}, 0.95)`);
        blobGrad.addColorStop(1, `rgba(20, 130, 50, 0.8)`);
      } else if (isListening) {
        blobGrad.addColorStop(0, 'rgba(220, 228, 255, 0.97)');
        blobGrad.addColorStop(0.4, 'rgba(140, 165, 245, 0.85)');
        blobGrad.addColorStop(1, 'rgba(70, 95, 200, 0.6)');
      } else {
        const b = 195 + breathe * 25 | 0;
        blobGrad.addColorStop(0, `rgba(255, 255, 255, ${0.92 + breathe * 0.07})`);
        blobGrad.addColorStop(0.4, `rgba(${b}, ${b}, ${b + 18 | 0}, 0.82)`);
        blobGrad.addColorStop(1, 'rgba(115, 120, 148, 0.5)');
      }
      ctx.fillStyle = blobGrad;
      ctx.fill();

      // Specular highlight
      const specGrad = ctx.createRadialGradient(cx - baseR * 0.3, cy - baseR * 0.32, 0, cx - baseR * 0.15, cy - baseR * 0.15, baseR * 0.55);
      specGrad.addColorStop(0, `rgba(255,255,255,${0.5 + breathe * 0.15})`);
      specGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = specGrad;
      ctx.fill();

      // Inner pulse flash when speaking
      if (isSpeaking && heartbeat > 0.5) {
        const pulseGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR * 0.65);
        pulseGrad.addColorStop(0, `rgba(200, 255, 210, ${(heartbeat - 0.5) * 0.45})`);
        pulseGrad.addColorStop(1, 'rgba(200,255,210,0)');
        ctx.fillStyle = pulseGrad;
        ctx.fill();
      }

      // Particles
      const particles = particlesRef.current;
      particles.forEach(p => {
        p.angle += p.speed * 0.012 * (isSpeaking ? 2.5 : 1);
        const targetR = isSpeaking
          ? baseR * (p.baseRadius + heartbeat * 0.4)
          : baseR * p.baseRadius;
        p.radius += (targetR - p.radius) * 0.08;

        const px = cx + Math.cos(p.angle) * p.radius;
        const py = cy + Math.sin(p.angle) * p.radius;
        const alpha = p.opacity * (isSpeaking ? 0.7 + heartbeat * 0.3 : 0.3 + breathe * 0.2);

        ctx.beginPath();
        ctx.arc(px, py, p.size * (isSpeaking ? 1 + heartbeat * 0.5 : 1), 0, Math.PI * 2);
        ctx.fillStyle = isSpeaking
          ? `rgba(150, 255, 170, ${alpha})`
          : `rgba(200, 210, 240, ${alpha})`;
        ctx.fill();
      });

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [state, size]);

  const d = size === 'lg' ? 100 : 68;
  const canvasSize = d * 3.2;

  return (
    <div
      style={{
        opacity: mounted ? 1 : 0,
        transition: 'opacity 2s ease',
        filter: 'drop-shadow(0 0 20px rgba(180,190,230,0.15))',
      }}
    >
      <canvas
        ref={canvasRef}
        width={canvasSize}
        height={canvasSize}
        style={{ display: 'block' }}
      />
    </div>
  );
}
