"use client";

import { useEffect, useState, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { Timer, Users, MessageCircle, Send, Heart, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { Session, ChatMessage, Participant } from "@still-here/shared";

export default function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [joined, setJoined] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSession();
    return () => {
      wsRef.current?.close();
    };
  }, [id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadSession() {
    try {
      const res = await api.get(`/sessions/${id}`);
      setSession(res.data);
    } catch {
      console.error("Failed to load session");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!token) {
      router.push("/auth/login");
      return;
    }

    try {
      await api.post(`/sessions/${id}/join`);
      setJoined(true);
      connectWebSocket();
      await loadSession();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to join";
      alert(message);
    }
  }

  function connectWebSocket() {
    if (!token) return;

    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL}?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join_session", sessionId: id }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case "chat_message":
          setMessages((prev) => [...prev, data.message]);
          break;
        case "participant_update":
          setSession((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              participants: prev.participants.map((p: Participant) =>
                p.userId === data.participant.userId ? data.participant : p
              ),
            };
          });
          break;
        case "participant_joined":
          setSession((prev) => {
            if (!prev) return prev;
            return { ...prev, participants: [...prev.participants, data.participant] };
          });
          break;
        case "participant_left":
          setSession((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              participants: prev.participants.filter((p: Participant) => p.userId !== data.userId),
            };
          });
          break;
        case "encouragement":
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              sessionId: id,
              userId: null,
              userName: data.fromUser,
              content: `${data.fromUser} sent encouragement!`,
              type: "encouragement" as const,
              createdAt: new Date().toISOString(),
            },
          ]);
          break;
      }
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
    };
  }

  function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!messageInput.trim() || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: "send_message", content: messageInput.trim() }));
    setMessageInput("");
  }

  function sendEncouragement(targetUserId: string) {
    if (!wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: "send_encouragement", targetUserId }));
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-surface-400">Session not found.</p>
          <Link href="/sessions" className="btn-primary mt-4 inline-block">
            Back to Sessions
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-surface-800 bg-surface-900/80 backdrop-blur-sm px-4 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/sessions" className="btn-ghost p-2">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-surface-100">{session.title}</h1>
              <div className="flex items-center gap-3 text-sm text-surface-400">
                <span className={`badge ${session.status === "active" ? "badge-active" : "badge-waiting"}`}>
                  {session.status}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {session.participants.length}/{session.maxParticipants}
                </span>
                <span className="flex items-center gap-1">
                  <Timer className="h-3.5 w-3.5" />
                  {session.focusDurationMinutes}min
                </span>
              </div>
            </div>
          </div>

          {!joined && (
            <button onClick={handleJoin} className="btn-primary">
              Join Session
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-7xl p-4">
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Participants */}
          <div className="lg:col-span-1">
            <div className="card p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-surface-500">
                Participants
              </h2>
              <div className="space-y-3">
                {session.participants.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-xl bg-surface-800/50 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600/20 text-sm font-medium text-brand-400">
                          {p.user.displayName.charAt(0).toUpperCase()}
                        </div>
                        {p.status === "focusing" && (
                          <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface-800 bg-focus animate-pulse-slow" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-surface-200">{p.user.displayName}</p>
                        <p className="text-xs text-surface-500">
                          {p.currentTask || (p.status === "focusing" ? "Focusing..." : "Idle")}
                        </p>
                      </div>
                    </div>
                    {joined && p.userId !== token && (
                      <button
                        onClick={() => sendEncouragement(p.userId)}
                        className="btn-ghost p-1.5 text-surface-500 hover:text-pink-400"
                        title="Send encouragement"
                      >
                        <Heart className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Chat */}
          <div className="lg:col-span-2">
            <div className="card flex h-[600px] flex-col">
              <div className="border-b border-surface-700/50 px-6 py-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-surface-500">
                  <MessageCircle className="h-4 w-4" /> Session Chat
                </h2>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                {messages.length === 0 && (
                  <p className="text-center text-sm text-surface-500 py-8">
                    {joined ? "Chat is quiet... say hello!" : "Join the session to chat."}
                  </p>
                )}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`animate-slide-up ${
                      msg.type === "system"
                        ? "text-center text-xs text-surface-500"
                        : msg.type === "encouragement"
                        ? "text-center text-sm text-pink-400"
                        : ""
                    }`}
                  >
                    {msg.type === "text" && (
                      <div className="rounded-xl bg-surface-800/50 px-4 py-2.5">
                        <span className="text-xs font-medium text-brand-400">{msg.userName}</span>
                        <p className="text-sm text-surface-200">{msg.content}</p>
                      </div>
                    )}
                    {msg.type !== "text" && <p>{msg.content}</p>}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {joined && (
                <form onSubmit={sendMessage} className="border-t border-surface-700/50 px-4 py-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="input flex-1"
                      placeholder="Type a message..."
                      maxLength={500}
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                    />
                    <button type="submit" className="btn-primary px-4">
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
