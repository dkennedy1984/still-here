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

  const [presenceStyle, setPresenceStyle] = useState<"quiet" | "check-ins" | "talk">("check-ins");

  // isAudioPlaying is driven by actual browser AudioBufferSource playback events,
  // not server messages — so the orb stays green for the exact duration
  // the user hears audio, no matter how many chunks there are.
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  const { state, hangup, changeStyle, preferSilence } = useAudioSession({
    callId,
    wsTicket: ticket,
    presenceStyle,
    onAudioStart: () => setIsAudioPlaying(true),
    onAudioEnd: () => setIsAudioPlaying(false),
  });

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

  // orbState is driven by actual audio playback — green = AI is speaking in the browser
  const orbState: 'idle' | 'listening' | 'speaking' | 'greeting' = (() => {
    if (isAudioPlaying) return 'speaking';
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
    <div
      className="min-h-screen bg-black flex flex-col items-center justify-center relative"
      onClick={toggleOverlay}
    >
      <PresenceOrb state={orbState} size="lg" />

      {/* Slide-up overlay with controls */}
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
          End
        </button>
      </div>
    </div>
  );
}

export default function CallPage() {
  return (
    <Suspense>
      <CallPageInner />
    </Suspense>
  );
}
