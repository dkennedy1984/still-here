'use client';
import { PresenceOrb } from './PresenceOrb';

interface FixedOrbProps {
  state?: 'idle' | 'listening' | 'speaking' | 'greeting';
  visible?: boolean;
}

export function FixedOrb({ state = 'idle', visible = true }: FixedOrbProps) {
  return (
    <div
      className={`fixed left-0 right-0 flex justify-center pointer-events-none transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}
      style={{ top: '35%', transform: 'translateY(-50%)', zIndex: 15 }}
    >
      <PresenceOrb state={state} size="lg" />
    </div>
  );
}
