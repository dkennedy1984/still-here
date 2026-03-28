"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

function HomePageContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const [presenceStyle, setPresenceStyle] = useState<"silent" | "check-ins" | "talk">("check-ins");
  const [voice, setVoice] = useState<'her' | 'him'>('her');
  const callingRef = useRef(false);
  const [scrolled, setScrolled] = useState(false);

  const searchParams = useSearchParams();
  const upgraded = searchParams?.get('upgraded') === 'true';
  const [showUpgraded, setShowUpgraded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('swy-voice');
    if (saved === 'her' || saved === 'him') setVoice(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem('swy-voice', voice);
  }, [voice]);

  useEffect(() => {
    if (upgraded) {
      setShowUpgraded(true);
      localStorage.setItem('swy-tier', 'paid');
      const t = setTimeout(() => setShowUpgraded(false), 8000);
      return () => clearTimeout(t);
    }
  }, [upgraded]);
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  async function handleCall() {
    console.log('[home] handleCall fired, callingRef:', callingRef.current);
    if (callingRef.current) {
      console.log('[home] BLOCKED double call');
      return;
    }
    callingRef.current = true;
    setLoading(true);

    try {
      // Pre-initialise audio output to speaker BEFORE getUserMedia
      // This must happen in a user gesture handler (click)
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate, audioCtx.sampleRate);
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.start(0);

      // Also create an Audio element to establish media route
      const audio = new Audio();
      audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
      audio.volume = 0.01;
      await audio.play().catch(() => {});

      // Store the audioCtx for the call page to reuse
      (window as any).__swyAudioCtx = audioCtx;

      const { callId, wsTicket } = await startCall(presenceStyle === 'silent' ? 'quiet' : presenceStyle, voice);
      router.push(`/call?callId=${callId}&ticket=${wsTicket}`);
    } catch (err) {
      console.error('Failed to start call:', err);
      callingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <main className="relative flex flex-col items-center justify-center min-h-screen min-h-[100dvh] bg-slate-950 overflow-hidden">
      {showUpgraded && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2"
          style={{ animation: 'fadeIn 0.5s ease' }}>
          <div className="flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-green-400/10 border border-green-400/15 backdrop-blur-sm">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm text-green-300/90 font-medium">You're in</span>
          </div>
          <p className="text-xs text-slate-500">I'm here whenever you need.</p>
        </div>
      )}

      {/* Hero section - full viewport, call-first */}
      <div className="flex flex-col items-center justify-center">
        {/* Presence orb */}
        <div className="flex items-center justify-center mb-10">
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


      </div>

      {/* Bottom controls - fixed, hide on scroll */}
      <div className={`fixed bottom-0 left-0 right-0 z-40 pb-6 pt-4 px-8 flex justify-between items-center transition-opacity duration-300 ${scrolled ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <button
          onClick={() => setShowSheet(true)}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          {presenceStyle === 'silent' ? 'Quiet' : presenceStyle === 'check-ins' ? 'Check-ins' : 'Chatty'} ▾
        </button>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setVoice('her')}
            className={`text-xs px-2.5 py-1 rounded-full transition-all duration-300 ${
              voice === 'her' ? 'bg-white/10 text-white' : 'text-slate-600 hover:text-slate-400'
            }`}
          >
            Her
          </button>
          <button
            onClick={() => setVoice('him')}
            className={`text-xs px-2.5 py-1 rounded-full transition-all duration-300 ${
              voice === 'him' ? 'bg-white/10 text-white' : 'text-slate-600 hover:text-slate-400'
            }`}
          >
            Him
          </button>
        </div>
      </div>

      {/* Content sections - below the fold */}
      <div className="max-w-2xl mx-auto py-24 pb-20">
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

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomePageContent />
    </Suspense>
  );
}
