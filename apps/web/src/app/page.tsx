"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSession, createCall } from "@/lib/api";
import PresenceStyleSheet from "@/components/PresenceStyleSheet";

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const [presenceStyle, setPresenceStyle] = useState<"silent" | "check-ins" | "talk">("check-ins");

  async function handleCall() {
    if (loading) return;
    setLoading(true);
    try {
      const sessionId = await createSession();
      const { callId, wsTicket } = await createCall(sessionId, presenceStyle);
      router.push(`/call?callId=${callId}&ticket=${wsTicket}`);
    } catch (err) {
      console.error("Failed to start call:", err);
      setLoading(false);
    }
  }

  function handlePreferSilence() {
    setPresenceStyle("silent");
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6">
      {/* Glowing circle */}
      <div className="mb-10 h-20 w-20 rounded-full bg-white/20 shadow-[0_0_60px_rgba(255,255,255,0.15)] ring-1 ring-white/20 animate-pulse-slow" />

      {/* Call button */}
      <button
        onClick={handleCall}
        disabled={loading}
        className="w-full max-w-xs rounded-full bg-white px-6 py-4 text-lg font-semibold text-slate-900 transition-all duration-200 hover:bg-white/90 active:scale-[0.98] disabled:opacity-50"
      >
        {loading ? "Connecting..." : "Call"}
      </button>

      {/* Subtext */}
      <p className="mt-4 text-slate-400 text-sm">I'll just sit with you.</p>

      {/* Bottom corners */}
      <div className="absolute bottom-8 left-6">
        <button
          onClick={handlePreferSilence}
          className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          Prefer silence
        </button>
      </div>

      <div className="absolute bottom-8 right-6">
        <button
          onClick={() => setShowSheet(true)}
          className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          Presence style
        </button>
      </div>

      {/* Presence style sheet */}
      {showSheet && (
        <PresenceStyleSheet
          selected={presenceStyle}
          onSelect={setPresenceStyle}
          onClose={() => setShowSheet(false)}
        />
      )}
    </main>
  );
}
