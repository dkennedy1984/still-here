"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { startCall } from "@/lib/api";
import PresenceStyleSheet from "@/components/PresenceStyleSheet";
import { FixedOrb } from "@/components/FixedOrb";
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
    const tier = localStorage.getItem('swy-tier');
    setIsPaid(tier === 'paid');
  }, []);

  useEffect(() => {
    if (upgraded) {
      setShowUpgraded(true);
      const t = setTimeout(() => setShowUpgraded(false), 4000);
      return () => clearTimeout(t);
    }
  }, [upgraded]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleCall = async () => {
    if (callingRef.current || loading) return;
    callingRef.current = true;
    setLoading(true);
    try {
      // Map UI presenceStyle to API mode
      const mode = presenceStyle === 'silent' ? 'quiet' : presenceStyle;
      const { callId, wsTicket } = await startCall(mode, voice);
      router.push(`/call?callId=${callId}&ticket=${wsTicket}`);
    } catch (err) {
      console.error(err);
      callingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen min-h-[100dvh] bg-slate-950 overflow-x-hidden">
      {/* Orb - shared FixedOrb at top 28% */}
      <FixedOrb state="idle" />

      {/* DEBUG: Fallback orb with inline styles + z-9999 to force visibility */}
      <div
        id="orb-debug"
        style={{ position: 'fixed', top: '28%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 9999, pointerEvents: 'none' }}
      >
        <PresenceOrb state="idle" size="lg" />
      </div>

      {/* Hero - button below orb */}
      <section
        className="relative flex flex-col items-center justify-end min-h-screen min-h-[100dvh] px-6 pb-[20vh]"
        style={{ zIndex: 10 }}
      >
        <div className="pointer-events-auto flex flex-col items-center">
          <button
            onClick={handleCall}
            disabled={loading}
            className="w-full max-w-xs py-4 rounded-full bg-white text-slate-900 text-lg font-medium tracking-tight hover:bg-white/90 active:scale-95 transition-all duration-150 disabled:opacity-50"
          >
            {loading ? '...' : 'Call'}
          </button>
          <p className="mt-4 text-sm text-slate-400">I'll just sit with you.</p>
        </div>
      </section>

      {/* Upgraded pill */}
      {showUpgraded && (
        <div
          className="fixed top-6 left-1/2 -translate-x-1/2"
          style={{ zIndex: 50 }}
        >
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 text-sm text-white">
            Welcome to Still Here ✦
          </div>
        </div>
      )}

      {/* Below fold content */}
      <section className="relative px-6 max-w-2xl mx-auto pb-20" style={{ zIndex: 10 }}>
        <div className="border-t border-slate-800 pt-12">
          <p className="text-slate-400 text-sm leading-relaxed mb-8">
            Body doubling is a technique where having someone present — even silently — helps you focus and follow through. Originally developed for ADHD, it works for anyone who struggles with procrastination, anxiety, or getting started.
          </p>
          <p className="text-slate-500 text-xs mb-4 uppercase tracking-widest">Research</p>
          <ul className="space-y-3">
            {homeSources.map((s) => (
              <li key={s.url}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 text-sm hover:text-white transition-colors"
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Bottom controls */}
      <div
        className={`fixed bottom-0 left-0 right-0 pb-6 pt-4 px-8 flex justify-between items-center transition-opacity duration-300 ${
          scrolled ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        style={{ zIndex: 40 }}
      >
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

      {/* Presence style sheet */}
      {showSheet && (
        <PresenceStyleSheet
          selected={presenceStyle}
          onSelect={(style) => {
            setPresenceStyle(style);
            localStorage.setItem('swy-presence', style === 'silent' ? 'quiet' : style);
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
    <Suspense>
      <HomePageContent />
    </Suspense>
  );
}
