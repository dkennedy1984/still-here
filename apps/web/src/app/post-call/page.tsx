'use client';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { FixedOrb } from '../../components/FixedOrb';

export default function PostCallPage() {
  const router = useRouter();
  const [isPaid, setIsPaid] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch((process.env.NEXT_PUBLIC_API_URL || '') + '/api/v1/calls/tier', {
      credentials: 'include',
    })
      .then(res => res.json())
      .then(data => {
        setIsPaid(data.tier === 'paid');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleCallAgain = async () => {
    try {
      const style = localStorage.getItem('swy-presence') || 'quiet';
      const voice = localStorage.getItem('swy-voice') || 'her';
      const { startCall } = await import('../../lib/api');
      const { callId, wsTicket } = await startCall(style, voice);
      router.push(`/call?callId=${callId}&ticket=${wsTicket}`);
    } catch (err) {
      console.error('Failed to start call:', err);
      router.push('/');
    }
  };

  if (loading) {
    return <main className="min-h-screen bg-slate-950" />;
  }

  return (
    <main className="relative min-h-screen min-h-[100dvh] bg-slate-950">
      {/* Orb - shared FixedOrb at top 35% */}
      <FixedOrb state="idle" />

      {/* Content below orb */}
      <div className="fixed left-0 right-0 flex flex-col items-center" style={{ bottom: '15%', zIndex: 10 }}>
        <div className="pointer-events-auto flex flex-col items-center text-center">
          {isPaid ? (
            <>
              <h1 className="text-lg text-white">I'll be here when you're ready.</h1>
              <p className="text-sm text-slate-400 mt-2">Take your time.</p>

              <button
                onClick={handleCallAgain}
                className="mt-8 px-20 py-5 rounded-full bg-white text-slate-900 text-xl font-semibold tracking-tight hover:bg-white/90 active:scale-95 transition-all duration-150 shadow-lg shadow-white/10"
              >
                Call again
              </button>

              <button
                onClick={() => router.push('/')}
                className="mt-4 text-sm text-slate-500 hover:text-slate-300 transition-colors"
              >
                I'm done for now
              </button>

              <button
                onClick={async () => {
                  try {
                    const res = await fetch((process.env.NEXT_PUBLIC_API_URL || '') + '/api/billing/portal', {
                      method: 'POST',
                      credentials: 'include',
                      headers: { 'Content-Type': 'application/json' },
                    });
                    const data = await res.json();
                    if (data.url) window.location.href = data.url;
                  } catch (e) {
                    console.error('[portal] error:', e);
                  }
                }}
                className="mt-4 text-xs text-slate-600 hover:text-slate-400 transition-colors"
              >
                Manage subscription
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
    </main>
  );
}
