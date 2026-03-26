"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAudioSession } from "@/hooks/useAudioSession";
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

  const isActive = state.agentState === "RESPONDING" || state.agentState === "CHECK_IN";

  return (
    <main
      className="relative flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 select-none"
      onClick={toggleOverlay}
    >
      {/* Breathing circle with optional green glow */}
      <div
        className={clsx(
          "h-20 w-20 rounded-full bg-white/10 animate-breathe transition-shadow duration-700",
          isActive && "shadow-[0_0_40px_10px_rgba(34,197,94,0.3)]"
        )}
      />

      {/* Tap overlay */}
      {showOverlay && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/40 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col gap-3 items-center">
            <button
              onClick={() => {
                preferSilence();
                setPresenceStyle("silent");
                setShowOverlay(false);
              }}
              className="w-48 rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm text-white backdrop-blur-sm"
            >
              Prefer silence
            </button>
            <button
              onClick={() => {
                changeStyle("talk");
                setPresenceStyle("talk");
                setShowOverlay(false);
              }}
              className="w-48 rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm text-white backdrop-blur-sm"
            >
              Talk
            </button>
            <button
              onClick={() => setShowOverlay(false)}
              className="w-48 rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm text-white backdrop-blur-sm"
            >
              Music ▾
            </button>
          </div>
        </div>
      )}

      {/* Bottom left */}
      <div className="absolute bottom-8 left-6 z-20">
        <span className="text-sm text-slate-500">Still here</span>
      </div>

      {/* Bottom right */}
      <div className="absolute bottom-8 right-6 z-20">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleHangup();
          }}
          className="rounded-full border border-red-400/30 px-5 py-2 text-sm text-red-400 transition-colors hover:bg-red-400/10"
        >
          Hang up
        </button>
      </div>
    </main>
  );
}

export default function CallPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <CallPageInner />
    </Suspense>
  );
}
