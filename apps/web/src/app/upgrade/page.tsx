"use client";

export default function UpgradePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6">
      <h1 className="text-2xl font-bold text-white mb-8">Be here without limits</h1>

      <div className="mb-8 space-y-4 w-full max-w-xs">
        <div className="flex items-start gap-3">
          <span className="text-green-400 mt-0.5">✓</span>
          <span className="text-white">Unlimited time together</span>
        </div>
        <div className="flex items-start gap-3">
          <span className="text-green-400 mt-0.5">✓</span>
          <span className="text-white">Deeper support if you ask</span>
        </div>
        <div className="flex items-start gap-3">
          <span className="text-green-400 mt-0.5">✓</span>
          <span className="text-white">Choice of presence styles</span>
        </div>
      </div>

      <button className="w-full max-w-xs rounded-full bg-white px-6 py-4 text-lg font-semibold text-slate-900 transition-all duration-200 hover:bg-white/90 active:scale-[0.98]">
        Continue
      </button>

      <p className="mt-4 text-sm text-slate-400">£8 per month</p>
      <p className="mt-2 text-xs text-slate-500">You can cancel anytime.</p>
    </main>
  );
}
