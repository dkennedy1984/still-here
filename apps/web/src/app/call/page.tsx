'use client';
import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAudioSession } from '../../hooks/useAudioSession';
import { PresenceOrb } from '../../components/PresenceOrb';
import { AmbientNoise } from '../../components/AmbientNoise';

type PresenceStyle = 'quiet' | 'check-ins' | 'talk';

function CallPageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const callId = params?.get('callId') ?? '';
  const ticket = params?.get('ticket') ?? '';
  const [presenceStyle, setPresenceStyle] = useState<PresenceStyle>('quiet');
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [ambientSound, setAmbientSound] = useState('off');
  const wasConnected = useRef(false);

  const { state, hangup, changeStyle } = useAudioSession({
    callId,
    wsTicket: ticket,
    onAudioStart: () => setIsAudioPlaying(true),
    onAudioEnd: () => setIsAudioPlaying(false),
    onAmbientControl: (sound: string) => setAmbientSound(sound),
  });

  useEffect(() => {
    if (state.status === 'connected') wasConnected.current = true;
    if (state.status === 'ended' && wasConnected.current) {
      router.push('/post-call');
    }
  }, [state.status, router]);

  const handleStyleChange = useCallback((style: PresenceStyle) => {
    setPresenceStyle(style);
    changeStyle(style);
  }, [changeStyle]);

  const orbState = isAudioPlaying ? 'speaking'
    : (state.agentState === 'LISTENING' || state.agentState === 'THINKING') ? 'listening'
    : 'idle';

  return (
    <main className="relative h-[100dvh] bg-slate-950 overflow-hidden select-none">

      {/* Orb - absolutely centred on screen */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <PresenceOrb state={orbState} size="lg" />
      </div>

      {/* Controls - anchored to bottom */}
      <div className="absolute bottom-0 left-0 right-0 pb-10 pt-4 px-6 flex flex-col items-center gap-5">

        {/* Presence style pills */}
        <div className="flex gap-2.5">
          {([ 
            { key: 'quiet', label: 'Quiet' },
            { key: 'check-ins', label: 'Check-ins' },
            { key: 'talk', label: 'Talk' },
          ] as { key: PresenceStyle; label: string }[]).map(s => (
            <button
              key={s.key}
              onClick={() => handleStyleChange(s.key as PresenceStyle)}
              className={`px-4 py-2 rounded-full text-sm transition-all duration-200 ${
                presenceStyle === s.key
                  ? 'bg-white/15 text-white ring-1 ring-white/10'
                  : 'bg-white/5 text-slate-500 hover:text-slate-300'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Action row — ambient + hang up */}
        <div className="flex items-center gap-8">
          <AmbientNoise disabled={state.status === 'ended'} externalSound={ambientSound} />
          <button
            onClick={hangup}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-400 active:scale-95 transition-all duration-150 flex items-center justify-center shadow-lg shadow-red-500/30"
            aria-label="Hang up"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
              <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C7.61 21 3 16.39 3 10a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57a1 1 0 01-.24 1.01l-2.21 2.21z"/>
            </svg>
          </button>
        </div>

      </div>
    </main>
  );
}

export default function CallPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <CallPageInner />
    </Suspense>
  );
}
