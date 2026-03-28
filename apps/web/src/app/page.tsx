"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { startCall } from "@/lib/api";
import PresenceStyleSheet from "@/components/PresenceStyleSheet";
import { PresenceOrb } from "@/components/PresenceOrb";

const homeSources = [
  {
    title: "ADDitude — Get More Done with a Body Double (Patricia Quinn, MD)",
    url: "https://www.additudemag.com/getting-stuff-done-easier-with-a-friend-body-double/",
  },
  {
    title: "Cleveland Clinic — What Is 'Body Doubling' and Can It Help With ADHD?",
    url: "https://health.clevelandclinic.org/body-doubling-for-adhd",
  },
  {
    title: "CHADD — Executive Function Skills",
    url: "https://chadd.org/about-adhd/executive-function-skills/",
  },
];

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const [presenceStyle, setPresenceStyle] = useState<"silent" | "check-ins" | "talk">("check-ins");
  const callingRef = useRef(false);

  async function handleCall() {
    console.log('[home] handleCall fired, callingRef:', callingRef.current);
    if (callingRef.current) {
      console.log('[home] BLOCKED double call');
      return;
    }
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

  return (
    <main className="relative min-h-screen bg-slate-950 px-6">
      {/* Hero section - full viewport, call-first */}
      <div className="flex min-h-screen flex-col items-center justify-center">
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
        <p className="mt-4 text-slate-400 text-sm">I&apos;ll just sit with you.</p>

        {/* Presence preference */}
        <button
          onClick={() => setShowSheet(true)}
          className="mt-6 text-xs text-slate-600 hover:text-slate-400 transition-colors underline underline-offset-2"
        >
          Prefer silence?
        </button>

        {/* Subtle scroll indicator */}
        <div className="absolute bottom-8 flex flex-col items-center animate-fade-in">
          <span className="text-[10px] text-slate-700 mb-2">scroll for context</span>
          <svg className="w-4 h-4 text-slate-700 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7" />
          </svg>
        </div>
      </div>

      {/* Content sections - below the fold */}
      <div className="max-w-2xl mx-auto py-24">
        <h1 className="text-2xl sm:text-3xl font-semibold text-white leading-tight mb-8">
          Quiet body doubling for when starting is hard
        </h1>

        <p className="text-slate-300 leading-relaxed mb-6">
          Sometimes the problem isn&apos;t motivation.<br />
          It&apos;s starting.
        </p>
        <p className="text-slate-300 leading-relaxed mb-6">
          Sit With You is quiet company you can call when you need a little help getting going.<br />
          No pressure. No judgement. No &ldquo;productivity talk&rdquo;.
        </p>

        <h2 className="text-xl font-medium text-white mt-12 mb-4">Call for company (no pressure)</h2>

        <h3 className="text-base font-medium text-white/80 mt-6 mb-3">You don&apos;t have to talk</h3>
        <p className="text-slate-300 leading-relaxed mb-6">
          Silence is welcome here. If you don&apos;t want to speak, you don&apos;t have to.
        </p>

        <h3 className="text-base font-medium text-white/80 mt-6 mb-3">You don&apos;t have to explain</h3>
        <p className="text-slate-300 leading-relaxed mb-6">
          No goals. No reporting. No &ldquo;what are you working on?&rdquo;.<br />
          You&apos;re allowed to arrive exactly as you are.
        </p>

        <h2 className="text-xl font-medium text-white mt-12 mb-4">What this is (and what it isn&apos;t)</h2>

        <h3 className="text-base font-medium text-white/80 mt-6 mb-3">It&apos;s not productivity coaching</h3>
        <p className="text-slate-300 leading-relaxed mb-6">
          We won&apos;t push you, nag you, or try to optimise your day.
        </p>

        <h3 className="text-base font-medium text-white/80 mt-6 mb-3">It&apos;s not accountability</h3>
        <p className="text-slate-300 leading-relaxed mb-6">
          There&apos;s no scoring. No streaks. No guilt if you pause.
        </p>
        <p className="text-slate-300 leading-relaxed mb-6">
          This is simply: company.
        </p>

        <h2 className="text-xl font-medium text-white mt-12 mb-4">If you want a little context</h2>
        <p className="text-slate-300 leading-relaxed mb-6">
          Some people call this body doubling — doing a task while someone else is present. It can help with ADHD, overwhelm, anxiety, and the general “stuck” feeling.
        </p>
        <p className="text-slate-300 leading-relaxed mb-6">
          If you&apos;d like, you can read more — but you don&apos;t have to.
        </p>

        {/* Quiet links */}
        <div className="mt-12 pt-8 border-t border-white/5">
          <div className="flex flex-col gap-3">
            <Link href="/adhd-body-doubling" className="text-sm text-slate-400 hover:text-white transition-colors">
              What is ADHD body doubling? →
            </Link>
            <Link href="/how-it-works" className="text-sm text-slate-400 hover:text-white transition-colors">
              How it works →
            </Link>
            <Link href="/feeling-overwhelmed" className="text-sm text-slate-400 hover:text-white transition-colors">
              Feeling overwhelmed →
            </Link>
          </div>
        </div>

        {/* Sources */}
        <section className="mt-16 pt-8 border-t border-white/5">
          <h2 className="text-xs text-slate-500 uppercase tracking-wider mb-4">Sources & further reading</h2>
          <ul className="space-y-2">
            {homeSources.map((s) => (
              <li key={s.url}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-slate-400 hover:text-white transition-colors"
                >
                  {s.title} ↗
                </a>
              </li>
            ))}
          </ul>
        </section>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-white/5 flex flex-wrap gap-6 text-xs text-slate-600">
          <Link href="/how-it-works" className="hover:text-slate-400 transition-colors">How it works</Link>
          <Link href="/why" className="hover:text-slate-400 transition-colors">Why</Link>
          <Link href="/vs-focusmate" className="hover:text-slate-400 transition-colors">vs Focusmate</Link>
          <span className="ml-auto">© {new Date().getFullYear()} Sit With You</span>
        </footer>
      </div>

      {/* Presence style sheet */}
      {showSheet && (
        <PresenceStyleSheet
          selected={presenceStyle}
          onSelect={(style) => { setPresenceStyle(style); setShowSheet(false); }}
          onClose={() => setShowSheet(false)}
        />
      )}
    </main>
  );
}
