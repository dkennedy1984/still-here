"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { startCall } from "@/lib/api";
import PresenceStyleSheet from "@/components/PresenceStyleSheet";
import { VoiceSheet } from "@/components/VoiceSheet";
import { FixedOrb } from "@/components/FixedOrb";
import { FirstCallSheet } from "@/components/FirstCallSheet";

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
  const [showVoiceSheet, setShowVoiceSheet] = useState(false);
  const [presenceStyle, setPresenceStyle] = useState<"silent" | "check-ins" | "talk">("check-ins");
  const [voice, setVoice] = useState<'her' | 'him'>('her');
  const callingRef = useRef(false);
  const tierChecked = useRef(false);
  const [scrolled, setScrolled] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [showFirstCall, setShowFirstCall] = useState(false);
  const [showScrollHint, setShowScrollHint] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShowScrollHint(false), 8000);
    return () => clearTimeout(t);
  }, []);

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
    if (tierChecked.current) return;
    tierChecked.current = true;
    fetch((process.env.NEXT_PUBLIC_API_URL || '') + '/api/v1/calls/tier', {
      credentials: 'include',
    })
      .then(res => {
        if (!res.ok) throw new Error('tier check failed');
        return res.json();
      })
      .then(data => setIsPaid(data.tier === 'paid'))
      .catch(() => setIsPaid(false));
  }, []);

  useEffect(() => {
    if (upgraded) {
      setShowUpgraded(true);
      const t = setTimeout(() => setShowUpgraded(false), 4000);
      return () => clearTimeout(t);
    }
  }, [upgraded]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleCall = async () => {
    if (callingRef.current || loading) return;

    // Check localStorage directly (not stale state) to avoid race conditions
    if (!localStorage.getItem('swy-onboarded')) {
      setShowFirstCall(true);
      return;
    }

    callingRef.current = true;
    setLoading(true);
    try {
      // Map UI presenceStyle to API mode
      const mode = presenceStyle === 'silent' ? 'quiet' : presenceStyle;
      const { callId, wsTicket, error } = await startCall(mode, voice);

      if (error === 'email_required') {
        router.push('/post-call?gate=email');
        callingRef.current = false;
        setLoading(false);
        return;
      }

      // monthly_limit: allow call to proceed — AI will speak farewell and end gracefully

      router.push(`/call?callId=${callId}&ticket=${wsTicket}`);
    } catch (err) {
      console.error(err);
      callingRef.current = false;
      setLoading(false);
    }
  };

  function handleFirstCallSelect(style: 'quiet' | 'check-ins' | 'talk') {
    localStorage.setItem('swy-onboarded', 'true');
    localStorage.setItem('swy-presence', style);
    setPresenceStyle(style === 'quiet' ? 'silent' : style as "silent" | "check-ins" | "talk");
    setShowFirstCall(false);
    callingRef.current = true;
    setLoading(true);
    startCall(style, voice).then(({ callId, wsTicket, error }) => {
      if (error === 'email_required') {
        router.push('/post-call?gate=email');
        callingRef.current = false;
        setLoading(false);
        return;
      }
      // monthly_limit: allow call to proceed — AI will speak farewell and end gracefully
      router.push(`/call?callId=${callId}&ticket=${wsTicket}`);
    }).catch(err => {
      console.error(err);
      callingRef.current = false;
      setLoading(false);
    });
  }

  return (
    <main className="relative min-h-screen min-h-[100dvh] bg-slate-950 overflow-x-hidden">
      {/* Orb - shared FixedOrb at top 35% */}
      <FixedOrb state="idle" visible={!scrolled} />


      {/* Hero - button just below orb */}
      <div className={`fixed left-0 right-0 flex flex-col items-center transition-opacity duration-200 ${scrolled ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} style={{ bottom: '18svh', zIndex: 10 }}>
        <div className="pointer-events-auto flex flex-col items-center">
          <button
            onClick={handleCall}
            disabled={loading}
            className="px-20 py-5 rounded-full bg-white text-slate-900 text-xl font-semibold tracking-tight hover:bg-white/90 active:scale-95 transition-all duration-150 disabled:opacity-50 shadow-lg shadow-white/10"
          >
            {loading ? '...' : 'Call'}
          </button>
          <p className="mt-4 text-sm text-slate-400">I'll just sit with you.</p>
        </div>
      </div>

      {/* Scroll hint */}
      {showScrollHint && !scrolled && (
        <div className="fixed left-0 right-0 flex justify-center items-center gap-1 animate-bounce-slow transition-opacity duration-500"
             style={{ bottom: '3svh', zIndex: 25, opacity: 0.45 }}>
          <span style={{ color: '#64748b', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Scroll</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5">
            <path d="M7 10l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}

      {/* Upgraded pill */}
      {showUpgraded && (
        <div
          className="fixed top-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          style={{ zIndex: 50 }}
        >
          <div className="flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-green-400/10 border border-green-400/15 backdrop-blur-sm">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm text-green-300/90 font-medium">You're all set</span>
          </div>
          <p className="text-xs text-slate-500">I'll be here whenever you need.</p>
        </div>
      )}

      {/* Below fold content */}
      <section className="relative px-6 max-w-2xl mx-auto pb-20 mt-[110vh]" style={{ zIndex: 10 }}>
  
        <h1 className="text-2xl sm:text-3xl font-semibold text-white leading-tight mb-8">
          Quiet body doubling for when starting is hard
        </h1>

        <p className="text-slate-300 leading-relaxed mb-6">
          Sometimes the problem isn&apos;t motivation.<br />
          It&apos;s starting.
        </p>
        <p className="text-slate-300 leading-relaxed mb-6">
          Sit With You is quiet company you can call when you need a little help getting going.<br />
          No pressure. No judgement. No &quot;productivity talk&quot;.
        </p>

        <h2 className="text-xl font-medium text-white mt-12 mb-4">Call for company (no pressure)</h2>
        
        <h3 className="text-base font-medium text-white/80 mt-6 mb-3">You don&apos;t have to talk</h3>
        <p className="text-slate-300 leading-relaxed mb-6">
          Silence is welcome here. If you don&apos;t want to speak, you don&apos;t have to.
        </p>

        <h3 className="text-base font-medium text-white/80 mt-6 mb-3">You don&apos;t have to explain</h3>
        <p className="text-slate-300 leading-relaxed mb-6">
          No goals. No reporting. No &quot;what are you working on?&quot;.<br />
          You&apos;re allowed to arrive exactly as you are.
        </p>

        <h2 className="text-xl font-medium text-white mt-12 mb-4">What this is (and what it isn&apos;t)</h2>

        <h3 className="text-base font-medium text-white/80 mt-6 mb-3">It&apos;s not productivity coaching</h3>
        <p className="text-slate-300 leading-relaxed mb-6">
          We won&apos;t push you, nag you, or try to optimise your day.
        </p>

        <h3 className="text-base font-medium text-white/80 mt-6 mb-3">It&apos;s not accountability</h3>
        <p className="text-slate-300 leading-relaxed mb-6">
          There&apos;s no scoring. No streaks. No guilt if you pause.<br /><br />
          This is simply: company.
        </p>

        <h2 className="text-xl font-medium text-white mt-12 mb-4">If you want a little context</h2>
        <p className="text-slate-300 leading-relaxed mb-6">
          Some people call this body doubling &mdash; doing a task while someone else is present. It can help with ADHD, overwhelm, anxiety, and the general &quot;stuck&quot; feeling.<br /><br />
          If you&apos;d like, you can read more &mdash; but you don&apos;t have to.
        </p>

        {/* Quiet links to other pages */}
        <div className="mt-8 flex flex-col gap-2">
          <a href="/adhd-body-doubling" className="text-sm text-slate-400 hover:text-white transition-colors underline underline-offset-2">What is ADHD body doubling?</a>
          <a href="/how-it-works" className="text-sm text-slate-400 hover:text-white transition-colors underline underline-offset-2">How it works</a>
          <a href="/feeling-overwhelmed" className="text-sm text-slate-400 hover:text-white transition-colors underline underline-offset-2">Feeling overwhelmed</a>
        </div>

        {/* Sources */}
        <div className="mt-16 pt-8 border-t border-white/5">
          <h2 className="text-xs text-slate-500 uppercase tracking-wider mb-4">Sources &amp; further reading</h2>
          <ul className="space-y-2">
            <li><a href="https://www.additudemag.com/getting-stuff-done-easier-with-a-friend-body-double/" target="_blank" rel="noopener noreferrer" className="text-sm text-slate-400 hover:text-white transition-colors">ADDitude &mdash; Get More Done with a Body Double (Patricia Quinn, MD) &#8599;</a></li>
            <li><a href="https://health.clevelandclinic.org/body-doubling-for-adhd" target="_blank" rel="noopener noreferrer" className="text-sm text-slate-400 hover:text-white transition-colors">Cleveland Clinic &mdash; What Is &apos;Body Doubling&apos; and Can It Help With ADHD? &#8599;</a></li>
            <li><a href="https://chadd.org/about-adhd/executive-function-skills/" target="_blank" rel="noopener noreferrer" className="text-sm text-slate-400 hover:text-white transition-colors">CHADD &mdash; Executive Function Skills &#8599;</a></li>
          </ul>
        </div>
      </section>

      {/* Bottom controls */}
      <div className={`fixed bottom-0 left-0 right-0 pb-6 pt-4 px-6 flex justify-between items-center transition-opacity duration-200 ${
        scrolled ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`} style={{ zIndex: 40 }}>
        <button
          onClick={() => setShowSheet(true)}
          className="px-4 py-2 rounded-full bg-white/5 text-xs text-slate-400 hover:bg-white/10 hover:text-slate-300 transition-all duration-200 backdrop-blur-sm"
        >
          {presenceStyle === 'silent' ? 'Quiet' : presenceStyle === 'check-ins' ? 'Check-ins' : 'Chatty'} ▾
        </button>
        <button
          onClick={() => setShowVoiceSheet(true)}
          className="px-4 py-2 rounded-full bg-white/5 text-xs text-slate-400 hover:bg-white/10 hover:text-slate-300 transition-all duration-200 backdrop-blur-sm"
        >
          {voice === 'her' ? 'Her' : 'Him'} ▾
        </button>
      </div>

      {/* Presence style sheet */}
      {showFirstCall && (
        <FirstCallSheet onSelect={handleFirstCallSelect} />
      )}

      {showSheet && (
        <PresenceStyleSheet
          selected={presenceStyle}
          onSelect={(style) => {
            setPresenceStyle(style);
            localStorage.setItem('swy-onboarded', 'true');
            localStorage.setItem('swy-presence', style === 'silent' ? 'quiet' : style);
            setShowSheet(false);
          }}
          onClose={() => setShowSheet(false)}
        />
      )}

      {showVoiceSheet && (
        <VoiceSheet
          selected={voice}
          onSelect={(v) => {
            setVoice(v);
            localStorage.setItem('swy-onboarded', 'true');
            localStorage.setItem('swy-voice', v);
          }}
          onClose={() => setShowVoiceSheet(false)}
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
