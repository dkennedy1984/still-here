"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Users, Timer, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import type { SessionSummary } from "@still-here/shared";
import { POPULAR_TAGS } from "@still-here/shared";
import { useAuthStore } from "@/stores/auth-store";

export default function SessionsPage() {
  const token = useAuthStore((s) => s.token);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
  }, [activeTag]);

  async function loadSessions() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTag) params.set("tag", activeTag);
      const res = await api.get(`/sessions?${params}`);
      setSessions(res.data);
    } catch {
      console.error("Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }

  const filtered = sessions.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.hostName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-surface-100">Sessions</h1>
            <p className="mt-1 text-surface-400">Find a session to focus with others</p>
          </div>
          {token && (
            <Link href="/sessions/create" className="btn-primary gap-2">
              <Plus className="h-4 w-4" /> New Session
            </Link>
          )}
        </div>

        {/* Search + Tags */}
        <div className="mb-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500" />
            <input
              type="text"
              placeholder="Search sessions..."
              className="input pl-11"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {POPULAR_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={`badge transition-colors ${
                  activeTag === tag
                    ? "bg-brand-600 text-white"
                    : "bg-surface-800 text-surface-400 hover:bg-surface-700"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Session list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-6 w-6 animate-spin text-surface-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-surface-400">No sessions found. Be the first to create one!</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((session) => (
              <Link
                key={session.id}
                href={`/sessions/${session.id}`}
                className="card p-6 transition-all hover:border-brand-600/30 hover:shadow-brand-600/5 animate-fade-in"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className={`badge ${
                    session.status === "active" ? "badge-active" : "badge-waiting"
                  }`}>
                    {session.status}
                  </span>
                  <div className="flex items-center gap-1 text-sm text-surface-400">
                    <Users className="h-3.5 w-3.5" />
                    {session.participantCount}/{session.maxParticipants}
                  </div>
                </div>

                <h3 className="mb-1 font-semibold text-surface-100">{session.title}</h3>
                <p className="mb-3 text-sm text-surface-500">by {session.hostName}</p>

                <div className="flex items-center gap-4 text-xs text-surface-400">
                  <div className="flex items-center gap-1">
                    <Timer className="h-3.5 w-3.5" />
                    {session.focusDurationMinutes}min focus
                  </div>
                </div>

                {session.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {session.tags.map((tag) => (
                      <span key={tag} className="badge bg-surface-700/50 text-surface-400">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
