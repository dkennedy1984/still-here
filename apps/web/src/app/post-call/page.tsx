'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef, Suspense } from 'react';
import { FixedOrb } from '../../components/FixedOrb';

function PostCallContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gate = searchParams?.get('gate');

  const [isPaid, setIsPaid] = useState(false);
  const [hasEmail, setHasEmail] = useState(false);
  const [loading, setLoading] = useState(true);
  const tierChecked = useRef(false);

  const [showEmailInput, setShowEmailInput] = useState(false);
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    if (tierChecked.current) return;
    tierChecked.current = true;

    // If gate is set, we already know the tier state — skip the fetch
    if (gate === 'email' || gate === 'limit') {
      setIsPaid(false);
      setHasEmail(gate === 'limit'); // limit means they have email but hit the cap
      setLoading(false);
      if (gate === 'email') setShowEmailInput(false);
      return;
    }

    fetch((process.env.NEXT_PUBLIC_API_URL || '') + '/api/v1/calls/tier', {
      credentials: 'include',
    })
      .then(res => {
        if (!res.ok) throw new Error('tier check failed');
        return res.json();
      })
      .then(data => {
        setIsPaid(data.tier === 'paid');
        // Check localStorage for a stored email as a proxy for "has email"
        const storedEmail = localStorage.getItem('swy-email');
        setHasEmail(!!storedEmail);
        setLoading(false);
      })
      .catch(() => {
        setIsPaid(false);
        setLoading(false);
      });
  }, [gate]);

  const handleCallAgain = async () => {
    try {
      const style = localStorage.getItem('swy-presence') || 'quiet';
      const voice = localStorage.getItem('swy-voice') || 'her';
      const { startCall } = await import('../../lib/api');
      const { callId, wsTicket, error } = await startCall(style, voice);
      if (error === 'email_required') {
        setLoading(false);
        setShowEmailInput(true);
        return;
      }
      if (error === 'monthly_limit') {
        router.push('/post-call?gate=limit');
        return;
      }
      router.push(`/call?callId=${callId}&ticket=${wsTicket}`);
    } catch (err) {
      console.error('Failed to start call:', err);
      router.push('/');
    }
  };

  async function handleRegisterEmail() {
    if (!email.includes('@')) return;
    try {
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || '') + '/api/v1/calls/register-email', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setEmailSent(true);
        setHasEmail(true);
        localStorage.setItem('swy-email', email);
      }
    } catch {}
  }

  if (loading) {
    return <main className="min-h-screen bg-slate-950" />;
  }

  return (
    <main className="relative min-h-screen min-h-[100dvh] bg-slate-950">
      <FixedOrb state="idle" />

      <div className="fixed left-0 right-0 flex flex-col items-center" style={{ bottom: '15%', zIndex: 10 }}>
        <div className="pointer-events-auto flex flex-col items-center text-center">

          {/* STATE A: Paid user */}
          {isPaid && (
            <>
              <h1 className="text-lg text-white">I'll be here when you're ready.</h1>
              <button
                onClick={handleCallAgain}
                className="mt-8 px-20 py-5 rounded-full bg-white text-slate-900 text-xl font-semibold transition-all duration-200 active:scale-95 hover:bg-slate-100"
              >
                Sit with me again
              </button>
              <button
                onClick={() => router.push('/')}
                className="mt-4 text-sm text-slate-500 hover:text-slate-400 transition-colors py-2"
              >
                That's all for now
              </button>
            </>
          )}

          {/* STATE B: Free user WITH email, or monthly limit gate */}
          {!isPaid && (hasEmail || gate === 'limit') && (
            <>
              <h1 className="text-lg text-white">I'm glad we sat together.</h1>
              {gate === 'limit' ? (
                <p className="text-sm text-slate-400 mt-2">You've used all your free calls this month.</p>
              ) : (
                <p className="text-sm text-slate-400 mt-2">Come back anytime you need company.</p>
              )}
              <button
                onClick={() => router.push('/upgrade')}
                className="mt-8 px-20 py-5 rounded-full bg-white text-slate-900 text-xl font-semibold transition-all duration-200 active:scale-95 hover:bg-slate-100"
              >
                Upgrade for more
              </button>
              {gate !== 'limit' && (
                <button
                  onClick={handleCallAgain}
                  className="mt-4 text-sm text-slate-400 hover:text-slate-300 transition-colors py-2"
                >
                  Call again (free)
                </button>
              )}
              <button
                onClick={() => router.push('/')}
                className="mt-4 text-sm text-slate-500 hover:text-slate-400 transition-colors py-2"
              >
                That's all for now
              </button>
            </>
          )}

          {/* STATE C: Free user WITHOUT email (first call complete, gate=email, or no email) */}
          {!isPaid && !hasEmail && gate !== 'limit' && (
            <>
              <h1 className="text-lg text-white">I'm glad we sat together.</h1>
              <p className="text-sm text-slate-400 mt-2">If it helps, you can have this quiet company available whenever you want.</p>

              <button
                onClick={() => router.push('/upgrade')}
                className="mt-8 px-20 py-5 rounded-full bg-white text-slate-900 text-xl font-semibold transition-all duration-200 active:scale-95 hover:bg-slate-100"
              >
                I'd like that
              </button>

              {!showEmailInput ? (
                <button
                  onClick={() => setShowEmailInput(true)}
                  className="mt-4 text-sm text-slate-400 hover:text-slate-300 transition-colors py-2"
                >
                  Try the free plan
                </button>
              ) : !emailSent ? (
                <div className="mt-6 flex flex-col items-center gap-3">
                  <p className="text-xs text-slate-500">So I can remember you next time</p>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleRegisterEmail()}
                    placeholder="your@email.com"
                    className="w-64 px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-slate-500"
                  />
                  <button
                    onClick={handleRegisterEmail}
                    className="px-8 py-2.5 rounded-full bg-white/10 text-white text-sm hover:bg-white/15 transition-colors"
                  >
                    Continue
                  </button>
                </div>
              ) : (
                <p className="mt-4 text-sm text-green-400/80">You're all set. See you next time.</p>
              )}

              <button
                onClick={() => router.push('/')}
                className="mt-4 text-sm text-slate-500 hover:text-slate-400 transition-colors py-2"
              >
                Not right now
              </button>
            </>
          )}

        </div>
      </div>
    </main>
  );
}

export default function PostCallPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-950" />}>
      <PostCallContent />
    </Suspense>
  );
}
