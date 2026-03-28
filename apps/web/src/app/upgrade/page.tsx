"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function UpgradePage() {
  const router = useRouter();
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
      <h1 className="text-2xl font-bold text-white mb-8">Be here, whenever you need.</h1>

      <ul className="space-y-4 text-left w-full max-w-xs mx-auto mb-8">
        {[
          'Up to 30 minutes together per session',
          'Gentle support if you ask for it',
          'Choose how present I am',
        ].map((item) => (
          <li key={item} className="flex items-start gap-3">
            <span className="text-green-400 mt-0.5 flex-shrink-0">✓</span>
            <span className="text-white text-sm">{item}</span>
          </li>
        ))}
      </ul>

      {linkError && (
        <p className="text-amber-400 text-sm mb-4">
          {linkError === "expired"
            ? "That link has expired. Please request a new one."
            : "Something went wrong. Please try again."}
        </p>
      )}

      {!showMagicForm && !magicSent && (
        <button
          onClick={() => setShowMagicForm(true)}
          className="w-full max-w-xs bg-white text-slate-900 font-semibold py-3 px-6 rounded-full hover:bg-slate-100 transition-colors mb-4"
        >
          Continue with email
        </button>
      )}

      {showMagicForm && !magicSent && (
        <form onSubmit={handleMagicLinkSubmit} className="w-full max-w-xs space-y-3 mb-4">
          <input
            type="email"
            value={magicEmail}
            onChange={(e) => setMagicEmail(e.target.value)}
            placeholder="your@email.com"
            required
            className="w-full bg-slate-800 text-white placeholder-slate-500 border border-slate-700 rounded-full py-3 px-5 focus:outline-none focus:border-slate-500"
          />
          {magicError && (
            <p className="text-red-400 text-sm text-center">{magicError}</p>
          )}
          <button
            type="submit"
            disabled={magicLoading}
            className="w-full bg-white text-slate-900 font-semibold py-3 px-6 rounded-full hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            {magicLoading ? "Sending…" : "Send magic link"}
          </button>
        </form>
      )}

      {magicSent && (
        <p className="text-green-400 text-sm mb-4 text-center">
          Check your email — a link is on its way.
        </p>
      )}

      <button
        onClick={() => router.push('/')}
        className="text-slate-500 text-sm hover:text-slate-300 transition-colors"
      >
        Not now
      </button>
    </main>
  );
}
