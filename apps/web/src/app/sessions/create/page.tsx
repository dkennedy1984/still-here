"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { POPULAR_TAGS, SESSION_FOCUS_MIN, SESSION_FOCUS_MAX } from "../../../lib/shared";
import type { CreateSessionInput } from "../../../lib/shared";

export default function CreateSessionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<CreateSessionInput>({
    title: "",
    description: "",
    visibility: "public",
    focusDurationMinutes: 25,
    breakDurationMinutes: 5,
    maxParticipants: 10,
    tags: [],
  });

  function toggleTag(tag: string) {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : prev.tags.length < 5
        ? [...prev.tags, tag]
        : prev.tags,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post<{ data: { id: string } }>("/sessions", form);
      router.push(`/sessions/${res.data.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create session";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-2 text-3xl font-bold text-surface-100">Create a Session</h1>
        <p className="mb-8 text-surface-400">Set up a focus room for others to join.</p>

        {error && (
          <div className="mb-6 rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="card p-8 space-y-6">
          <div>
            <label htmlFor="title" className="mb-1.5 block text-sm font-medium text-surface-300">
              Session Title
            </label>
            <input
              id="title"
              type="text"
              required
              minLength={3}
              maxLength={100}
              className="input"
              placeholder="e.g., Morning deep work sprint"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div>
            <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-surface-300">
              Description (optional)
            </label>
            <textarea
              id="description"
              maxLength={500}
              rows={3}
              className="input resize-none"
              placeholder="What will you be working on?"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="focus" className="mb-1.5 block text-sm font-medium text-surface-300">
                Focus Duration (min)
              </label>
              <input
                id="focus"
                type="number"
                min={SESSION_FOCUS_MIN}
                max={SESSION_FOCUS_MAX}
                className="input"
                value={form.focusDurationMinutes}
                onChange={(e) => setForm({ ...form, focusDurationMinutes: parseInt(e.target.value) || 25 })}
              />
            </div>
            <div>
              <label htmlFor="break" className="mb-1.5 block text-sm font-medium text-surface-300">
                Break Duration (min)
              </label>
              <input
                id="break"
                type="number"
                min={1}
                max={30}
                className="input"
                value={form.breakDurationMinutes}
                onChange={(e) => setForm({ ...form, breakDurationMinutes: parseInt(e.target.value) || 5 })}
              />
            </div>
          </div>

          <div>
            <label htmlFor="maxParticipants" className="mb-1.5 block text-sm font-medium text-surface-300">
              Max Participants
            </label>
            <input
              id="maxParticipants"
              type="number"
              min={2}
              max={50}
              className="input"
              value={form.maxParticipants}
              onChange={(e) => setForm({ ...form, maxParticipants: parseInt(e.target.value) || 10 })}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-surface-300">
              Visibility
            </label>
            <div className="flex gap-3">
              {(["public", "private", "friends"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setForm({ ...form, visibility: v })}
                  className={`btn-ghost ${form.visibility === v ? "bg-brand-600/10 text-brand-400 border border-brand-600/30" : ""}`}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-surface-300">
              Tags (up to 5)
            </label>
            <div className="flex flex-wrap gap-2">
              {POPULAR_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`badge transition-colors ${
                    form.tags.includes(tag)
                      ? "bg-brand-600 text-white"
                      : "bg-surface-700 text-surface-400 hover:bg-surface-600"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Creating..." : "Create Session"}
          </button>
        </form>
      </div>
    </main>
  );
}
