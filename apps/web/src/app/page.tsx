"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { startCall } from "@/lib/api";
import PresenceStyleSheet from "@/components/PresenceStyleSheet";
import { PresenceOrb } from "@/components/PresenceOrb";

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const [presenceStyle, setPresenceStyle] = useState<"silent" | "check-ins" | "talk">("check-ins");
  const callingRef = useRef(false);

  async function handleCall() {
    if (callingRef.current) return; // prevent double-click / double-tap
    callingRef.current = true;
    setLoading(true);
    try {
      const { callId, wsTicket } = await startCall(presenceStyle);
      router.push(`/call?callId=${callId}&ticket=${wsTicket}`);
    } catch (err) {
      console.error("Failed to start call:", err);
      callingRef.current = false;
      setLoading(false);
    }
  }

  function handlePreferSilence() {
    setPresenceStyle("silent");
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6">
      {/* Presence orb */}
      <div className="mb-10">
        <PresenceOrb state="idle" size="lg" />
      </div>

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
          Change style
        </button>
      </div>

      {showSheet && (
        <PresenceStyleSheet
          selected={presenceStyle}
          onSelect={(s) => {
            setPresenceStyle(s);
            setShowSheet(false);
          }}
          onClose={() => setShowSheet(false)}
        />
      )}
    </main>
  );
}
