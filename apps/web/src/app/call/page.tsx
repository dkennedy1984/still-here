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
  const [ambientSound, setAmbientSound] = useState('presence');
  const [ambientStarted, setAmbientStarted] = useState(false);
  const hasStartedPresenceRef = useRef(false);
  const [crisisInfo, setCrisisInfo] = useState<any>(null);
  const [showControls, setShowControls] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasConnected = useRef(false);
  const hasSentInitialStyle = useRef(false);
  const hasStoppedAudio = useRef(false);

  const { state, hangup, changeStyle } = useAudioSession({
    callId,
    wsTicket: ticket,
    onAudioStart: () => setIsAudioPlaying(true),
    onAudioEnd: () => {
      setIsAudioPlaying(false);
      // Auto-start presence sounds after first audio (greeting) ends
      if (!hasStartedPresenceRef.current) {
        hasStartedPresenceRef.current = true;
        setAmbientStarted(true);
      }
    },
    onAmbientControl: (sound: string) => setAmbientSound(sound),
    onCrisisInfo: (info: any) => setCrisisInfo(info),
  });

  const stopAllAudio = useCallback(() => {
    try {
      if (typeof window !== 'undefined' && (window as any).__presenceAudio) {
        const audio = (window as any).__presenceAudio as HTMLAudioElement;
        audio.pause();
        audio.src = '';
        audio.load();
        (window as any).__presenceAudio = null;
      }
    } catch (e) {
      console.warn('stopAllAudio: presenceAudio error', e);
    }
    // Don't close AudioContext — closing it throws "Cannot close a closed AudioContext"
    // and crashes the stop flow. Just null the ref.
    if (typeof window !== 'undefined') {
      (window as any).__ambientCtx = null;
    }
    try {
      if (typeof window !== 'undefined' && (window as any).__ambientSource) {
        const src = (window as any).__ambientSource as AudioBufferSourceNode;
        try { src.stop(); } catch (_) {}
        (window as any).__ambientSource = null;
      }
    } catch (e) {
      console.warn('stopAllAudio: ambientSource error', e);
    }
  }, []);

  const handleHangup = useCallback(() => {
    hasStoppedAudio.current = true;
    stopAllAudio();
    hangup();
    window.location.href = '/post-call';
  }, [hangup, stopAllAudio]);

  useEffect(() => {
    if (state.status === 'connected' && !hasSentInitialStyle.current) {
      hasSentInitialStyle.current = true;
      wasConnected.current = true;
      changeStyle(presenceStyle);
    }
  }, [state.status, presenceStyle, changeStyle]);

  useEffect(() => {
    if (state.status === 'connected') wasConnected.current = true;
    if (state.status === 'ended' && wasConnected.current && !hasStoppedAudio.current) {
      hasStoppedAudio.current = true;
      stopAllAudio();
      window.location.href = '/post-call';
    }
  }, [state.status, stopAllAudio]);

  const handleScreenTap = useCallback(() => {
    // Start presence sounds on first tap if not already started
    if (!ambientStarted && !hasStartedPresenceRef.current) {
      hasStartedPresenceRef.current = true;
      setAmbientStarted(true);
    }
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  }, [ambientStarted]);

  return (
    <div
      className="relative min-h-screen min-h-[100dvh] bg-slate-950 select-none"
      onClick={handleScreenTap}
    >
      <FixedOrb state={isAudioPlaying ? 'speaking' : (state.agentState === 'LISTENING' || state.agentState === 'THINKING') ? 'listening' : 'idle'} />

      {ambientStarted && (
        <div className="fixed bottom-6 left-6 z-50" onClick={e => e.stopPropagation()}>
          <AmbientNoise
            disabled={state.status === 'ended'}
            externalSound={ambientStarted ? ambientSound : undefined}
          />
        </div>
      )}

      {crisisInfo && (
        <div className="fixed inset-0 z-50 flex items-end justify-center pb-16 px-6 pointer-events-none">
          <div className="bg-slate-800/95 backdrop-blur-sm rounded-2xl p-6 max-w-sm w-full pointer-events-auto">
            <p className="text-white/90 text-sm font-medium mb-1">You matter.</p>
            <p className="text-white/70 text-sm mb-4">If you're in crisis, please reach out.</p>
            {crisisInfo.phone && (
              <a
                href={`tel:${crisisInfo.phone}`}
                className="block w-full text-center bg-rose-500 hover:bg-rose-400 text-white font-semibold py-3 rounded-xl mb-2 transition-colors"
              >
                Call {crisisInfo.phone}
              </a>
            )}
            {crisisInfo.chat && (
              <a
                href={crisisInfo.chat}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center bg-slate-700 hover:bg-slate-600 text-white/90 font-medium py-3 rounded-xl transition-colors"
              >
                Chat online
              </a>
            )}
          </div>
        </div>
      )}

      <div
        className={`fixed bottom-0 left-0 right-0 pb-10 flex flex-col items-center gap-5 transition-opacity duration-500 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Presence style selector */}
        <div className="flex justify-center gap-2.5">
          {(['quiet', 'check-ins', 'talk'] as PresenceStyle[]).map((style) => (
            <button
              key={style}
              onClick={(e) => {
                e.stopPropagation();
                setPresenceStyle(style);
                localStorage.setItem('swy-presence', style);
                changeStyle(style);
              }}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                presenceStyle === style
                  ? 'bg-white text-slate-900'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              {style === 'quiet' ? 'Quiet' : style === 'check-ins' ? 'Check-ins' : 'Talk'}
            </button>
          ))}
        </div>

        {/* Hangup button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleHangup();
          }}
          className="mx-auto w-16 h-16 rounded-full bg-rose-500/90 hover:bg-rose-400 flex items-center justify-center transition-colors shadow-lg"
          aria-label="End call"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
            <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.61 21 3 13.39 3 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.24 1.01l-2.21 2.2z"/>
          </svg>
        </button>
      </div>

      {state.status === 'error' && (
        <div className="fixed inset-0 flex items-center justify-center">
          <div className="text-white/60 text-sm">Connection error. Please try again.</div>
        </div>
      )}
    </div>
  );
}

export default function CallPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-950" />}>
      <CallPageInner />
    </Suspense>
  );
}
