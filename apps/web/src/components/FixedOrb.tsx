'use client';
import { PresenceOrb } from './PresenceOrb';

interface FixedOrbProps {
  state?: 'idle' | 'listening' | 'speaking' | 'greeting';
}

export function FixedOrb({ state = 'idle' }: FixedOrbProps) {
  console.log('[FixedOrb] rendering, state:', state);
  return (
    <div
      className="fixed left-0 right-0 flex justify-center pointer-events-none"
      style={{ top: '28%', transform: 'translateY(-50%)', zIndex: 15 }}
    >
      <PresenceOrb state={state} size="lg" />
    </div>
  );
}
