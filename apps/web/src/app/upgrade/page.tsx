"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function UpgradePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showMagicForm, setShowMagicForm] = useState(false);
  const [magicEmail, setMagicEmail] = useState("");
  const [magicSent, setMagicSent] = useState(false);
  const [magicError, setMagicError] = useState("");
  const [magicLoading, setMagicLoading] = useState(false);

  // Check for error/cancelled param
  const searchParams =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : null;
  const linkError = searchParams?.get("error");
  const cancelled = searchParams?.get("cancelled") === "true";

  async function handleUpgrade() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/billing/create-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("No checkout URL returned:", data);
        setLoading(false);
      }
    } catch (err) {
      console.error("Failed to create checkout:", err);
      setLoading(false);
    }
  }

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
      <h1 className="text-2xl font-bold text-white mb-6">
        Be here, whenever you need.
      </h1>

      <div className="flex justify-center">
        <ul className="space-y-3">
        {[
          "Unlimited calls, up to 90 minutes each",
          "Gentle support if you ask for it",
          "Choose your presence style and voice",
        ].map((item) => (
          <li key={item} className="flex items-start gap-3 text-white/80">
            <span className="mt-1 h-2 w-2 rounded-full bg-white/40 shrink-0" />
            <span className="text-sm">{item}</span>
          </li>
        ))}
      </ul>
      </div>

      <div className="text-center mt-6">
        <p className="text-lg text-slate-300">£8 per month</p>
        <p className="text-sm text-slate-500 mt-1">Cancel anytime</p>
      </div>

      {linkError && (
        <p className="text-sm text-red-400 mb-4">
          {linkError === "expired"
            ? "That link has expired. Please request a new one."
            : linkError === "invalid"
              ? "That link is no longer valid."
              : "Something went wrong. Please try again."}
        </p>
      )}

      {cancelled && (
        <p className="text-sm text-slate-400 mb-4">
          No worries — you can upgrade whenever you&apos;re ready.
        </p>
      )}

      <button
        onClick={handleUpgrade}
        disabled={loading}
        className="mt-6 px-20 py-5 rounded-full bg-white text-slate-900 text-xl font-semibold tracking-tight hover:bg-white/90 active:scale-95 transition-all duration-150 disabled:opacity-50 shadow-lg shadow-white/10"
      >
        {loading ? "..." : "Continue"}
      </button>

      <button
        onClick={() => router.push("/")}
        className="mt-4 text-sm text-slate-500 hover:text-slate-300 transition-colors"
      >
        Maybe later
      </button>

      {/* Magic link section for cross-device access */}
      <div className="mt-10 border-t border-white/10 pt-8 w-full max-w-xs">
        <p className="text-xs text-slate-500 text-center mb-2">
          Already subscribed on another device?
        </p>
        {!showMagicForm ? (
          <button
            onClick={() => setShowMagicForm(true)}
            className="w-full text-sm text-slate-400 hover:text-white transition-colors"
          >
            Send me a login link
          </button>
        ) : magicSent ? (
          <p className="text-sm text-green-400/80 text-center">
            Check your email — a link is on its way.
          </p>
        ) : (
          <form onSubmit={handleMagicLinkSubmit} className="space-y-3">
            <input
              type="email"
              value={magicEmail}
              onChange={(e) => setMagicEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-white/20"
            />
            {magicError && (
              <p className="text-xs text-red-400">{magicError}</p>
            )}
            <button
              type="submit"
              disabled={magicLoading}
              className="w-full rounded-lg bg-white/10 py-3 text-sm text-white hover:bg-white/15 transition-colors disabled:opacity-50"
            >
              {magicLoading ? "Sending..." : "Send link"}
            </button>
          </form>
        )}
      </div>

      <p className="text-xs text-slate-600 mt-6">
        By continuing you agree to our{' '}
        <a href="/terms" className="text-slate-500 hover:text-slate-300 underline underline-offset-2">Terms</a>
        {' '}and{' '}
        <a href="/privacy" className="text-slate-500 hover:text-slate-300 underline underline-offset-2">Privacy Policy</a>
      </p>

      <p className="text-xs text-slate-600 mt-4">
        Need help? <a href="mailto:support@sitwithyou.app" className="text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2">support@sitwithyou.app</a>
      </p>
    </main>
  );
}
