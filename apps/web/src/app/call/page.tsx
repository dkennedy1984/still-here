"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAudioSession } from "@/hooks/useAudioSession";
import { PresenceOrb } from "@/components/PresenceOrb";
import clsx from "clsx";
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
    if (state.status === "ended") {
      console.log("[call/page] status=ended, wasConnected:", wasConnected.current);
      if (wasConnected.current) {
        router.push("/post-call");
      }
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
      className="relative flex min-h-screen flex-col items-center justify-center bg-slate-950"
      onClick={toggleOverlay}
    >
      {/* Presence orb */}
      <PresenceOrb state={orbState} size="lg" />

      {/* Overlay: controls */}
      <div
        className={clsx(
          "absolute inset-0 flex flex-col items-center justify-end pb-16 transition-opacity duration-500",
          showOverlay ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-4 w-full max-w-xs px-6">
          <button
            onClick={handleHangup}
            className="w-full rounded-full bg-red-600 px-6 py-4 text-lg font-semibold text-white transition-all duration-200 hover:bg-red-500 active:scale-[0.98]"
          >
            End Call
          </button>


          <div className="flex gap-3">
            {(["quiet", "check-ins", "talk"] as const).map((style) => (
              <button
                key={style}
                onClick={() => { setPresenceStyle(style); changeStyle(style); setShowOverlay(false); }}
                className={clsx(
                  "flex-1 rounded-full px-3 py-2 text-sm font-medium transition-all duration-200 active:scale-[0.98]",
                  presenceStyle === style
                    ? "bg-white text-slate-900"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                )}
              >
                {style === 'quiet' ? 'Quiet' : style === 'check-ins' ? 'Check-ins' : 'Talk'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Status indicator */}
      {state.status === "connecting" && (
        <p className="absolute bottom-8 text-slate-500 text-sm">Connecting...</p>
      )}
      {state.remainingSeconds !== null && state.remainingSeconds <= 60 && (
        <p className="absolute bottom-8 text-slate-400 text-sm">
          {state.remainingSeconds}s remaining
        </p>
      )}

      {/* Always-visible footer: branding + ambient noise + hang up */}
      <div className="fixed bottom-0 left-0 right-0 flex justify-between items-center px-8 pb-10 pt-4">
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-500 tracking-wide">Still here</span>
          <AmbientNoise disabled={state.status === 'ended'} externalSound={ambientSound} />
        </div>
        <button
          onClick={handleHangup}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
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
