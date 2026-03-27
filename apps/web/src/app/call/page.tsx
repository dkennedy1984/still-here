"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAudioSession } from "@/hooks/useAudioSession";
import { PresenceOrb } from "@/components/PresenceOrb";
import clsx from "clsx";

function CallPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const callId = searchParams.get("callId") || "";
  const ticket = searchParams.get("ticket") || "";

  const [presenceStyle, setPresenceStyle] = useState<"silent" | "check-ins" | "talk">("check-ins");
  const { state, hangup, changeStyle, preferSilence } = useAudioSession(callId, ticket, presenceStyle);

  const [showOverlay, setShowOverlay] = useState(false);

  // Auto-hide overlay after 4 seconds
  useEffect(() => {
    if (!showOverlay) return;
    const timer = setTimeout(() => setShowOverlay(false), 4000);
    return () => clearTimeout(timer);
  }, [showOverlay]);

  // Navigate to post-call when ended
  useEffect(() => {
    if (state.status === "ended") {
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

  // Map agentState + audio activity to orbState
  // Use isPlayingAudio for real-time sync with voice output
  const orbState: 'idle' | 'listening' | 'speaking' | 'greeting' = (() => {
    if (state.isPlayingAudio) return 'speaking';
    switch (state.agentState) {
      case 'RESPONDING':
      case 'CHECK_IN':
        return 'speaking';
      case 'LISTENING':
        return 'listening';
      case 'IDLE':
        return 'idle';
      default:
        return 'idle';
    }
  })();

  return (
    <main
      className="relative flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 select-none"
      onClick={toggleOverlay}
    >
      {/* Presence orb */}
      <PresenceOrb state={orbState} size="lg" />

      {/* Tap overlay - Prefer silence / Talk / Music */}
      <div
        className={clsx(
          "fixed bottom-20 left-0 right-0 flex justify-center gap-4 px-6 pb-4 pt-2 transition-all duration-300",
          showOverlay ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"
        )}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={() => { preferSilence(); setShowOverlay(false); }}
          className="px-4 py-2 rounded-full border border-slate-600/40 text-slate-400 text-sm
                     hover:bg-slate-800/60 active:scale-95 transition-all duration-150"
        >
          Prefer silence
        </button>
        <button
          onClick={() => { changeStyle("talk"); setShowOverlay(false); }}
          className="px-4 py-2 rounded-full border border-slate-600/40 text-slate-400 text-sm
                     hover:bg-slate-800/60 active:scale-95 transition-all duration-150"
        >
          Talk
        </button>
        <button
          onClick={() => { setShowOverlay(false); }}
          className="px-4 py-2 rounded-full border border-slate-600/40 text-slate-400 text-sm
                     hover:bg-slate-800/60 active:scale-95 transition-all duration-150"
        >
          Music ▾
        </button>
      </div>

      {/* Always visible footer */}
      <div className="fixed bottom-0 left-0 right-0 flex justify-between items-center px-8 pb-10 pt-4"
           onClick={e => e.stopPropagation()}>
        <span className="text-xs text-slate-500 tracking-wide">Still here</span>
        <button
          onClick={handleHangup}
          className="px-5 py-2.5 rounded-full border border-red-400/30 text-red-400 text-sm
                     hover:bg-red-400/10 active:scale-95 transition-all duration-150"
        >
          Hang up
        </button>
      </div>

      {/* Timer / status */}
      {state.remainingSeconds !== null && (
        <p className="absolute top-8 text-slate-500 text-xs tabular-nums">
          {Math.floor(state.remainingSeconds / 60)}:{String(state.remainingSeconds % 60).padStart(2, "0")}
        </p>
      )}
    </main>
  );
}

export default function CallPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">Loading...</div>}>
      <CallPageInner />
    </Suspense>
  );
}
