"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function UpgradePage() {
  const [showMagicForm, setShowMagicForm] = useState(false);
  const [magicEmail, setMagicEmail] = useState("");
  const [magicSent, setMagicSent] = useState(false);
  const [magicError, setMagicError] = useState("");
  const [magicLoading, setMagicLoading] = useState(false);

  // Check for error param (e.g. expired magic link)
  const searchParams = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search)
    : null;
  const linkError = searchParams?.get("error");

  async function handleMagicLinkSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMagicError("");
    setMagicLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/magic-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: magicEmail }),
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        setMagicSent(true);
      } else {
        setMagicError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setMagicError("Could not reach the server. Please try again.");
    } finally {
      setMagicLoading(false);
    }
  }

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

      {linkError === "expired" && (
        <p className="mt-3 text-sm text-amber-400">That link has expired. Request a new one below.</p>
      )}

      <button className="mt-4 text-sm text-slate-500 hover:text-slate-300 transition-colors">
        Not now
      </button>

      {/* Already a member section */}
      <div className="mt-10 border-t border-slate-800 pt-8 w-full max-w-xs text-center">
        {!showMagicForm && !magicSent && (
          <button
            onClick={() => setShowMagicForm(true)}
            className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Already a member? Access on this device →
          </button>
        )}

        {showMagicForm && !magicSent && (
          <form onSubmit={handleMagicLinkSubmit} className="space-y-3">
            <p className="text-sm text-slate-400">Enter your email and we'll send you a link.</p>
            <input
              type="email"
              value={magicEmail}
              onChange={(e) => setMagicEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-500"
            />
            {magicError && (
              <p className="text-xs text-red-400">{magicError}</p>
            )}
            <button
              type="submit"
              disabled={magicLoading}
              className="w-full rounded-full bg-slate-700 px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-slate-600 active:scale-[0.98] disabled:opacity-50"
            >
              {magicLoading ? "Sending\u2026" : "Send link"}
            </button>
            <button
              type="button"
              onClick={() => setShowMagicForm(false)}
              className="text-xs text-slate-500 hover:text-slate-400 transition-colors"
            >
              Cancel
            </button>
          </form>
        )}

        {magicSent && (
          <p className="text-sm text-slate-300">
            Check your email \u2014 we\u2019ve sent you a link.
          </p>
        )}
      </div>
    </main>
  );
}
