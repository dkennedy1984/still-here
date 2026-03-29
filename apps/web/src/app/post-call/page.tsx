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
    // Paid user - calm, no upsell
    return (
      <main className="flex flex-col items-center justify-center min-h-screen bg-slate-950 px-6">
        <PresenceOrb state="idle" size="lg" />
        
        <h1 className="text-lg text-white mt-8">I'll be here when you're ready.</h1>
        <p className="text-sm text-slate-400 mt-2">Take your time.</p>
        
        <button
          onClick={() => router.push('/')}
          className="mt-12 px-12 py-4 rounded-full bg-white text-slate-900 text-base font-medium tracking-tight hover:bg-white/90 active:scale-95 transition-all duration-150"
        >
          Call again
        </button>
        
        <button
          onClick={() => router.push('/')}
          className="mt-5 text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          I'm done for now
        </button>

        <button
          onClick={async () => {
            try {
              const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/billing/portal`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } });
              const data = await res.json();
              if (data?.url) window.location.href = data.url;
            } catch { }
          }}
          className="mt-4 text-xs text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2"
        >
          Manage subscription
        </button>
      </main>
    );
  }

  // Free user - gentle upgrade prompt (keep existing content)
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-slate-950 px-6">
      <PresenceOrb state="idle" size="sm" />
      
      <h1 className="text-lg text-white mt-8">Still here.</h1>
      <p className="text-sm text-slate-400 mt-2 text-center max-w-xs">Want me to check in on you more often?</p>

      <button
        onClick={() => router.push('/signup')}
        className="mt-12 px-12 py-4 rounded-full bg-white text-slate-900 text-base font-medium tracking-tight hover:bg-white/90 active:scale-95 transition-all duration-150"
      >
        Get daily check-ins
      </button>

      <button
        onClick={() => router.push('/')}
        className="mt-5 text-sm text-slate-500 hover:text-slate-300 transition-colors"
      >
        Not now
      </button>
    </main>
  );
}
