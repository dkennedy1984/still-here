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

      {/* Bottom overlay */}
      <div
        className={clsx(
          "absolute bottom-0 left-0 right-0 bg-slate-900/80 backdrop-blur-sm px-6 pb-10 pt-6 transition-all duration-300",
          showOverlay ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
        )}
      >
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={(e) => { e.stopPropagation(); handleHangup(); }}
            className="w-full max-w-xs rounded-full bg-red-500 px-6 py-3 text-white font-medium transition hover:bg-red-600"
          >
            End
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); preferSilence(); }}
            className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Prefer silence
          </button>
        </div>
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
