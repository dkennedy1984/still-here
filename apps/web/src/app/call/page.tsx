'use client';
import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAudioSession } from '../../hooks/useAudioSession';
import { FixedOrb } from '../../components/FixedOrb';
import { AmbientNoise } from '../../components/AmbientNoise';

type PresenceStyle = 'quiet' | 'check-ins' | 'talk';

function CallPageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const callId = params?.get('callId') ?? '';
  const ticket = params?.get('ticket') ?? '';
  const [presenceStyle, setPresenceStyle] = useState<PresenceStyle>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('swy-presence');
      if (saved === 'quiet' || saved === 'check-ins' || saved === 'talk') return saved;
    }
    return 'quiet';
  });
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [ambientSound, setAmbientSound] = useState('off');
  const [showControls, setShowControls] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasConnected = useRef(false);
  const hasSentInitialStyle = useRef(false);

  const { state, hangup, changeStyle } = useAudioSession({
    callId,
    wsTicket: ticket,
    onAudioStart: () => setIsAudioPlaying(true),
    onAudioEnd: () => setIsAudioPlaying(false),
    onAmbientControl: (sound: string) => setAmbientSound(sound),
  });

  const handleHangup = useCallback(() => {
    hangup();
    // Navigate after a single frame to allow cleanup to start
    requestAnimationFrame(() => {
      router.push('/post-call');
    });
  }, [router, hangup]);

  useEffect(() => {
    if (state.status === 'connected' && !hasSentInitialStyle.current) {
      hasSentInitialStyle.current = true;
      wasConnected.current = true;
      changeStyle(presenceStyle);
    }
  }, [state.status, presenceStyle, changeStyle]);

  useEffect(() => {
    if (wasConnected.current && state.status === 'ended') {
      router.push('/post-call');
    }
  }, [state.status, router]);

  const handleScreenTap = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  const orbState: 'idle' | 'listening' | 'speaking' | 'greeting' = isAudioPlaying ? 'speaking'
    : (state.agentState === 'LISTENING' || state.agentState === 'THINKING') ? 'listening'
    : 'idle';

  const presenceLabels: Record<PresenceStyle, string> = {
    'quiet': 'Quiet',
    'check-ins': 'Check-ins',
    'talk': 'Talk',
  };

  return (
    <main
      className="relative h-[100dvh] bg-slate-950 overflow-hidden select-none"
      onClick={handleScreenTap}
    >
      {/* Orb - shared FixedOrb at top 28% */}
      <FixedOrb state={orbState} />

      {/* Tap controls */}
      <div
        className={`fixed bottom-32 sm:bottom-28 left-0 right-0 flex flex-col items-center gap-5 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ zIndex: 30 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Presence style pills */}
        <div className="flex gap-2">
          {(['quiet', 'check-ins', 'talk'] as PresenceStyle[]).map((s) => (
            <button
              key={s}
              onClick={() => {
                setPresenceStyle(s);
                localStorage.setItem('swy-presence', s);
                changeStyle(s);
              }}
              className={`px-4 py-1.5 rounded-full text-xs transition-all duration-150 ${
                presenceStyle === s
                  ? 'bg-white text-slate-900'
                  : 'bg-white/10 text-slate-300 hover:bg-white/20'
              }`}
            >
              {presenceLabels[s]}
            </button>
          ))}
        </div>

        {/* Hang up */}
        <button
          onClick={handleHangup}
          className="px-8 py-4 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 active:scale-95 transition-all duration-150 shadow-lg shadow-red-500/25"
        >
          <svg className="w-6 h-6 text-white rotate-[135deg]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
          </svg>
        </button>
      </div>

      {/* Ambient noise - bottom left */}
      <div
        className="fixed bottom-6 left-6"
        style={{ zIndex: 30 }}
        onClick={(e) => e.stopPropagation()}
      >
        <AmbientNoise
          disabled={state.status === 'ended'}
          externalSound={ambientSound}
        />
      </div>

      {/* Still here - bottom right */}
      <div className="fixed bottom-6 right-6" style={{ zIndex: 30 }}>
        <span className="text-xs text-slate-600">Still here</span>
      </div>
    </main>
  );
}

export default function CallPage() {
  return (
    <Suspense>
      <CallPageInner />
    </Suspense>
  );
}
