"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAudioSession } from "@/hooks/useAudioSession";
import { PresenceOrb } from "@/components/PresenceOrb";
import { AmbientNoise } from "@/components/AmbientNoise";

function CallPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const callId = searchParams.get("callId") || "";
  const ticket = searchParams.get("ticket") || "";

  const [presenceStyle, setPresenceStyle] = useState<"quiet" | "check-ins" | "talk">("check-ins");

  // isAudioPlaying is driven by actual browser AudioBufferSource playback events,
  // not server messages — so the orb stays green for the exact duration
  // the user hears audio, no matter how many chunks there are.
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [ambientSound, setAmbientSound] = useState('off');

  const { state, hangup, changeStyle } = useAudioSession({
    callId,
    wsTicket: ticket,
    onAudioStart: () => setIsAudioPlaying(true),
    onAudioEnd: () => setIsAudioPlaying(false),
    onAmbientControl: (sound) => setAmbientSound(sound),
  });

  const [showOverlay, setShowOverlay] = useState(false);

  // Auto-hide overlay after 4 seconds
  useEffect(() => {
    if (!showOverlay) return;
    const timer = setTimeout(() => setShowOverlay(false), 4000);
    return () => clearTimeout(timer);
  }, [showOverlay]);

  // Only navigate to /post-call when ended AND we were previously connected
  // This prevents a remount/failed connection attempt from bouncing the user away
  const wasConnected = useRef(false);
  useEffect(() => {
    if (state.status === "connected") {
      wasConnected.current = true;
      console.log("[call/page] status=connected, wasConnected set to true");
    }
    if (state.status === "ended" && wasConnected.current) {
      router.push("/post-call");
    }
  }, [state.status, router]);

  const handleHangup = useCallback(() => {
    hangup();
    router.push("/post-call");
  }, [hangup, router]);

  const toggleOverlay = useCallback(() => {
    setShowOverlay((prev) => !prev);
  }, []);

  // orbState is driven by actual audio playback — green = AI is speaking in real-time
  const orbState = isAudioPlaying ? "speaking" : state.status === "connected" ? "listening" : "idle";

  return (
    <main
      className="relative flex flex-col items-center justify-center h-[100dvh] bg-slate-950 overflow-hidden"
      onClick={toggleOverlay}
    >
      {/* Orb - centred */}
      <div className="flex items-center justify-center">
        <PresenceOrb state={orbState} size="lg" />
      </div>

      {/* Tap overlay - presence style buttons - only shows on tap */}
      {showOverlay && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center gap-3 px-6 z-30"
             onClick={e => e.stopPropagation()}>
          <button onClick={() => { changeStyle('quiet'); setPresenceStyle('quiet'); setShowOverlay(false); }}
            className="px-4 py-2.5 rounded-full bg-white/10 text-white text-sm hover:bg-white/15 transition-colors">
            Quiet
          </button>
          <button onClick={() => { changeStyle('check-ins'); setPresenceStyle('check-ins'); setShowOverlay(false); }}
            className="px-4 py-2.5 rounded-full bg-white/10 text-white text-sm hover:bg-white/15 transition-colors">
            Check-ins
          </button>
          <button onClick={() => { changeStyle('talk'); setPresenceStyle('talk'); setShowOverlay(false); }}
            className="px-4 py-2.5 rounded-full bg-white/10 text-white text-sm hover:bg-white/15 transition-colors">
            Talk
          </button>
        </div>
      )}

      {/* Status indicator */}
      {state.status === "connecting" && (
        <p className="absolute bottom-8 text-slate-500 text-sm">Connecting...</p>
      )}
      {state.remainingSeconds !== null && state.remainingSeconds <= 60 && (
        <p className="absolute bottom-8 text-slate-400 text-sm">
          {state.remainingSeconds}s remaining
        </p>
      )}

      {/* ALWAYS VISIBLE footer - hang up + ambient + status */}
      <div className="fixed bottom-0 left-0 right-0 flex justify-between items-center px-6 pb-6 pt-3 z-50"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 tracking-wide">Still here</span>
          <AmbientNoise disabled={state.status === 'ended'} externalSound={ambientSound} />
        </div>
        <button
          onClick={handleHangup}
          className="px-5 py-2.5 rounded-full border border-red-400/30 text-red-400 text-sm hover:bg-red-400/10 active:scale-95 transition-all duration-150"
        >
          Hang up
        </button>
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
