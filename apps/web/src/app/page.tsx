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
  const [isPaid, setIsPaid] = useState(false);

  const searchParams = useSearchParams();
  const upgraded = searchParams?.get('upgraded') === 'true';
  const [showUpgraded, setShowUpgraded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('swy-voice');
    if (saved === 'her' || saved === 'him') setVoice(saved);
    const savedPresence = localStorage.getItem('swy-presence');
    // localStorage stores 'quiet' (the mapped value), map back to 'silent' for home screen
    if (savedPresence === 'quiet' || savedPresence === 'silent' || savedPresence === 'check-ins' || savedPresence === 'talk') {
      setPresenceStyle(savedPresence === 'quiet' ? 'silent' : savedPresence as "silent" | "check-ins" | "talk");
    }
  }, []);

  useEffect(() => {
    if (upgraded) {
      setShowUpgraded(true);
      const t = setTimeout(() => setShowUpgraded(false), 4000);
      return () => clearTimeout(t);
    }
  }, [upgraded]);

  useEffect(() => {
    setIsPaid(localStorage.getItem('swy-tier') === 'paid');
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
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

      const { callId, wsTicket } = await startCall(presenceStyle === 'silent' ? 'quiet' : presenceStyle, voice);
      router.push(`/call?callId=${callId}&ticket=${wsTicket}`);
    } catch (err) {
      console.error('Failed to start call:', err);
      callingRef.current = false;
      setLoading(false);
    }
  }


  const FADE_IN_STYLE = { animation: 'fadeIn 0.5s ease' };

  return (
    <main className="relative min-h-screen min-h-[100dvh] bg-slate-950 overflow-hidden">
      {/* Upgraded confirmation */}
      {showUpgraded && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2"
          style={FADE_IN_STYLE}>
          <div className="flex items-center gap-2 bg-green-950/80 border border-green-800/50 rounded-full px-4 py-2 backdrop-blur-sm">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm text-green-300/90 font-medium">You&apos;re in</span>
          </div>
          <p className="text-xs text-slate-500">I&apos;m here whenever you need.</p>
        </div>
      )}

      {/* Hero content */}
      <section className="relative z-10 flex flex-col items-center justify-center min-h-screen min-h-[100dvh] px-6">
        <div className="mb-12 -mt-[5vh]">
          <PresenceOrb state="idle" size="lg" />
        </div>
        <div className="pointer-events-auto flex flex-col items-center">
          <button
            onClick={handleCall}
            disabled={loading}
            className="w-full max-w-xs py-4 rounded-full bg-white text-slate-900 text-lg font-medium tracking-tight hover:bg-white/90 active:scale-95 transition-all duration-150 disabled:opacity-50"
          >
            {loading ? '...' : 'Call'}
          </button>
          <p className="mt-4 text-sm text-slate-400">I&apos;ll just sit with you.</p>
        </div>
      </section>

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
      <section className="relative z-10 px-6 max-w-2xl mx-auto pb-20">
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
          There&apos;s no system here. No method. No plan to optimise your day.
        </p>

        <h3 className="text-base font-medium text-white/80 mt-6 mb-3">It&apos;s not accountability</h3>
        <p className="text-slate-300 leading-relaxed mb-6">
          You don&apos;t owe anyone a report. You don&apos;t have to explain what you did or didn&apos;t do.
        </p>

        <h3 className="text-base font-medium text-white/80 mt-6 mb-3">It&apos;s not a productivity app</h3>
        <p className="text-slate-300 leading-relaxed mb-6">
          No timers. No streaks. No gamification.
        </p>

        <div className="mt-12 flex flex-col gap-3">
          <Link href="/how-it-works" className="text-sm text-slate-400 hover:text-white transition-colors">
            How it works →
          </Link>
          <Link href="/feeling-overwhelmed" className="text-sm text-slate-400 hover:text-white transition-colors">
            Feeling overwhelmed →
          </Link>
        </div>

        {/* Sources */}
        <section className="mt-16 pt-8 border-t border-white/5">
          <h2 className="text-xs text-slate-500 uppercase tracking-wider mb-4">Sources &amp; further reading</h2>
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
          <Link href="/terms" className="hover:text-slate-400 transition-colors">Terms</Link>
          <Link href="/privacy" className="hover:text-slate-400 transition-colors">Privacy</Link>
          <span className="ml-auto">© {new Date().getFullYear()} Sit With You</span>
        </footer>
      </section>

      {showSheet && (
        <PresenceStyleSheet
          selected={presenceStyle}
          onSelect={(s) => {
            setPresenceStyle(s);
            localStorage.setItem('swy-presence', s === 'silent' ? 'quiet' : s);
            setShowSheet(false);
          }}
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
