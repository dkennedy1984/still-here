"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function PostCallContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verified = searchParams.get("verified") === "true";

  if (verified) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6">
        {/* Glowing circle */}
        <div className="mb-8 h-20 w-20 rounded-full bg-white/10 animate-pulse-slow" />

        <p className="text-lg text-white mb-2">You're all set.</p>
        <p className="text-sm text-slate-400 mb-8">I'm here whenever you need.</p>

        <button
          onClick={() => router.push("/")}
          className="w-full max-w-xs rounded-full bg-white px-6 py-4 text-lg font-semibold text-slate-900 transition-all duration-200 hover:bg-white/90 active:scale-[0.98]"
        >
          Start a session
        </button>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6">
      {/* Glowing circle */}
      <div className="mb-8 h-20 w-20 rounded-full bg-white/10 animate-pulse-slow" />

      <p className="text-lg text-white mb-2">I'm here whenever you need.</p>
      <p className="text-sm text-slate-400 mb-8">Want this available anytime?</p>

      <button
        onClick={() => router.push("/upgrade")}
        className="w-full max-w-xs rounded-full bg-white px-6 py-4 text-lg font-semibold text-slate-900 transition-all duration-200 hover:bg-white/90 active:scale-[0.98]"
      >
        Keep this available
      </button>

      <button
        onClick={() => router.push("/")}
        className="mt-4 text-sm text-slate-500 hover:text-slate-300 transition-colors"
      >
        Not now
      </button>
    </main>
  );
}

export default function PostCallPage() {
  return (
    <Suspense>
      <PostCallContent />
    </Suspense>
  );
}
