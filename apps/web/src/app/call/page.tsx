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
      {/* Orb - FIXED to viewport, identical position to home and post-call */}
      <div
        className="fixed top-0 left-0 right-0 h-screen h-[100dvh] flex items-center justify-center pointer-events-none"
        style={{ zIndex: 5 }}
      >
        <div className="-mt-[10vh] sm:mt-0">
          <PresenceOrb state={orbState} size="lg" />
        </div>
      </div>

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
          className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 active:scale-90 transition-all duration-150 shadow-lg shadow-red-500/25"
        >
          <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
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
