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
        <PresenceOrb state="idle" size="sm" />
        
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
      </main>
    );
  }

  // Free user - gentle upgrade prompt (keep existing content)
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-slate-950 px-6">
      <PresenceOrb state="idle" size="sm" />
      
      <h1 className="text-lg text-white mt-8">I'm here whenever you need.</h1>
      <p className="text-sm text-slate-400 mt-2">Want this available anytime?</p>
      
      <button
        onClick={() => router.push('/upgrade')}
        className="mt-10 px-12 py-4 rounded-full bg-white text-slate-900 text-base font-medium tracking-tight hover:bg-white/90 active:scale-95 transition-all duration-150"
      >
        Stay in touch
      </button>
      
      <button
        onClick={() => router.push('/')}
        className="mt-5 text-sm text-slate-500 hover:text-slate-300 transition-colors"
      >
        Maybe later
      </button>
    </main>
  );
}
