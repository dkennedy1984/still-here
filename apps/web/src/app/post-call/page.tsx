'use client';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { PresenceOrb } from '../../components/PresenceOrb';

export default function PostCallPage() {
  const router = useRouter();
  const [isPaid, setIsPaid] = useState(false);

  useEffect(() => {
    const tier = localStorage.getItem('swy-tier');
    setIsPaid(tier === 'paid');
  }, []);

  if (isPaid) {
    return (
      <main className="relative min-h-screen min-h-[100dvh] bg-slate-950 overflow-hidden">
        {/* Orb - absolute centre, same position */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="-mt-[10vh] sm:mt-0">
            <PresenceOrb state="idle" size="lg" />
          </div>
        </div>

        {/* Content - positioned below the orb */}
        <div className="relative z-30 flex flex-col items-center justify-end min-h-screen min-h-[100dvh] px-6 pb-[12vh]">
          <div className="pointer-events-auto flex flex-col items-center text-center">
            <h1 className="text-lg text-white">I'll be here when you're ready.</h1>
            <p className="text-sm text-slate-400 mt-2">Take your time.</p>

            <button
              onClick={() => router.push('/')}
              className="mt-8 px-12 py-4 rounded-full bg-white text-slate-900 text-base font-medium tracking-tight hover:bg-white/90 active:scale-95 transition-all duration-150"
            >
              Call again
            </button>

            <button
              onClick={() => router.push('/')}
              className="mt-4 text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              I'm done for now
            </button>

            <a
              href="/api/billing/portal"
              className="mt-4 text-xs text-slate-600 hover:text-slate-400 transition-colors underline underline-offset-2"
            >
              Manage subscription
            </a>
          </div>
        </div>
      </main>
    );
  }

  // Free user
  return (
    <main className="relative min-h-screen min-h-[100dvh] bg-slate-950 overflow-hidden">
      {/* Orb - absolute centre, same position */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
        <div className="-mt-[10vh] sm:mt-0">
          <PresenceOrb state="idle" size="lg" />
        </div>
      </div>

      {/* Content - positioned below the orb */}
      <div className="relative z-30 flex flex-col items-center justify-end min-h-screen min-h-[100dvh] px-6 pb-[12vh]">
        <div className="pointer-events-auto flex flex-col items-center text-center">
          <h1 className="text-lg text-white">I'm here whenever you need.</h1>
          <p className="text-sm text-slate-400 mt-2">Want this available anytime?</p>

          <button
            onClick={() => router.push('/upgrade')}
            className="mt-8 px-12 py-4 rounded-full bg-white text-slate-900 text-base font-medium tracking-tight hover:bg-white/90 active:scale-95 transition-all duration-150"
          >
            Stay in touch
          </button>

          <button
            onClick={() => router.push('/')}
            className="mt-4 text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </main>
  );
}
