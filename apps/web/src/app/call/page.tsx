'use client';
import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAudioSession } from '../../hooks/useAudioSession';
import { PresenceOrb } from '../../components/PresenceOrb';
import { AmbientNoise } from '../../components/AmbientNoise';

function CallPageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const callId = params?.get('callId') ?? '';
  const ticket = params?.get('ticket') ?? '';
  const [presenceStyle, setPresenceStyle] = useState('quiet');
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

  const handleStyleChange = useCallback((style: string) => {
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
      <div className="absolute bottom-0 left-0 right-0 pb-10 pt-4 px-6 flex flex-col items-center gap-5 z-40">

        {/* Presence style pills */}
        <div className="flex gap-2.5">
          {[
            { key: 'quiet', label: 'Quiet' },
            { key: 'check-ins', label: 'Check-ins' },
            { key: 'talk', label: 'Talk' },
          ].map(s => (
            <button
              key={s.key}
              onClick={() => handleStyleChange(s.key)}
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
            className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 active:scale-90 transition-all duration-150 shadow-lg shadow-red-500/20"
          >
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Status */}
        <span className="text-xs text-slate-500 tracking-wide">Still here</span>

      </div>
    </main>
  );
}

export default function CallPage() {
  return (
    <Suspense fallback={<div className="h-[100dvh] bg-slate-950" />}>
      <CallPageInner />
    </Suspense>
  );
}
