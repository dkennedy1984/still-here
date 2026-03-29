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
      // Send saved presence style to backend immediately when connected (server defaults to 'quiet')
      if (presenceStyle !== 'quiet') {
        changeStyle(presenceStyle);
      }
    }
  }, [state.status, presenceStyle, changeStyle]);

  useEffect(() => {
    if (state.status === 'ended' && wasConnected.current) {
      const timer = setTimeout(() => router.push('/'), 3000);
      return () => clearTimeout(timer);
    }
  }, [state.status, router]);

  const handleStyleChange = useCallback((style: PresenceStyle) => {
    setPresenceStyle(style);
    localStorage.setItem('swy-presence', style);
    changeStyle(style);
  }, [changeStyle]);

  const handleScreenTap = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), 4000);
  }, []);

  useEffect(() => {
    return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
  }, []);

  const orbState = isAudioPlaying ? 'speaking'
    : (state.agentState === 'LISTENING' || state.agentState === 'THINKING') ? 'listening'
    : 'idle';

  return (
    <main className="relative h-[100dvh] bg-slate-950 overflow-hidden select-none"
          onClick={handleScreenTap}>

      {/* Orb - absolute, same position as home page */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <div className="-mt-[10vh] sm:mt-0">
          <PresenceOrb state={orbState} size="lg" />
        </div>
      </div>

      {/* Tap-to-show controls - centred bottom area */}
      <div className={`absolute bottom-32 sm:bottom-28 left-0 right-0 flex flex-col items-center gap-5 z-30 transition-opacity duration-300 ${
        showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`} onClick={e => e.stopPropagation()}>
        
        {/* Presence style pills */}
        <div className="flex gap-2.5">
          {([
            { key: 'quiet' as PresenceStyle, label: 'Quiet' },
            { key: 'check-ins' as PresenceStyle, label: 'Check-ins' },
            { key: 'talk' as PresenceStyle, label: 'Talk' },
          ]).map(s => (
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

        {/* Hang up button */}
        <button
          onClick={handleHangup}
          className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 active:scale-90 transition-all duration-150 shadow-lg shadow-red-500/20"
        >
          <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ALWAYS visible - fixed to bottom corners */}
      <div className="fixed bottom-6 left-6 z-50" onClick={e => e.stopPropagation()}>
        <AmbientNoise disabled={state.status === 'ended'} externalSound={ambientSound} />
      </div>
      <div className="fixed bottom-6 right-6 z-50">
        <span className="text-xs text-slate-600 tracking-wide">Still here</span>
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
