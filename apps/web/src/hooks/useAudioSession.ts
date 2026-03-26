"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { playAudioChunk } from "@/lib/audioPlayer";

type AgentState = "IDLE" | "LISTENING" | "RESPONDING" | "CHECK_IN" | "";
type SessionStatus = "connecting" | "active" | "ended" | "error";

interface AudioSessionState {
  status: SessionStatus;
  agentState: AgentState;
  remainingSeconds: number | null;
  error?: string;
}

interface UseAudioSessionReturn {
  state: AudioSessionState;
  hangup: () => void;
  changeStyle: (style: string) => void;
  preferSilence: () => void;
}

export function useAudioSession(
  callId: string,
  wsTicket: string,
  presenceStyle: string
): UseAudioSessionReturn {
  const [state, setState] = useState<AudioSessionState>({
    status: "connecting",
    agentState: "",
    remainingSeconds: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const keepaliveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!callId || !wsTicket) return;

    const wsBase = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4000";
    const wsUrl = wsBase + `/ws?ticket=${wsTicket}`;
    console.log("[useAudioSession] Connecting to", wsUrl.replace(/ticket=.*/, "ticket=***"));
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[useAudioSession] WebSocket opened, requesting mic immediately");

      // Start mic capture immediately on open — don't wait for server message
      startMicCapture(ws);

      // Start keepalive
      keepaliveRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 20000);
    };

    ws.onerror = (event) => {
      console.error("[useAudioSession] WebSocket error:", event);
      setState((prev) => ({
        ...prev,
        status: "error",
        error: "Connection error. Please try again.",
      }));
    };

    ws.onclose = (event) => {
      console.log("[useAudioSession] WebSocket closed:", event.code, event.reason);
      setState((prev) => {
        // Only set to ended if we were previously active or connecting
        if (prev.status === "active" || prev.status === "connecting") {
          return { ...prev, status: "ended" };
        }
        return prev;
      });
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        // Silently ignore ping/pong keepalive messages
        if (msg.type === "ping" || msg.type === "pong") return;

        switch (msg.type) {
          case "connected":
          case "session_ready":
            console.log(`[useAudioSession] Received ${msg.type}, session is active`);
            setState((prev) => ({
              ...prev,
              status: "active",
              agentState: msg.agentState || msg.state || prev.agentState,
            }));
            break;

          case "agent_state":
            setState((prev) => ({
              ...prev,
              agentState: msg.state || prev.agentState,
            }));
            break;

          case "audio_out":
          case "audio":
            if (msg.data) {
              playAudioChunk(msg.data);
            }
            break;

          case "audio_out_done":
            // Audio stream finished — nothing to do
            break;

          case "time_remaining":
          case "timer":
            setState((prev) => ({
              ...prev,
              remainingSeconds: msg.remaining ?? msg.seconds ?? prev.remainingSeconds,
            }));
            break;

          case "limit_reached":
          case "call_ended":
            setState((prev) => ({ ...prev, status: "ended" }));
            break;

          case "error":
            console.error("[useAudioSession] Server error:", msg.message);
            // Log but don't crash — only set error status for critical errors
            if (msg.fatal) {
              setState((prev) => ({
                ...prev,
                status: "error",
                error: msg.message,
              }));
            }
            break;

          case "style_changed":
          case "encouragement":
            // Informational events — no action needed
            break;

          default:
            // Silently ignore unknown message types
            break;
        }
      } catch (e) {
        console.error("[useAudioSession] Failed to parse message:", e);
      }
    };

    return () => {
      if (keepaliveRef.current) clearInterval(keepaliveRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
        recorderRef.current.stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [callId, wsTicket]);

  async function startMicCapture(ws: WebSocket) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Pick the best supported audio format for this browser
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/ogg;codecs=opus";

      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;

      recorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(",")[1];
            if (base64) {
              ws.send(
                JSON.stringify({
                  type: "audio_data",
                  data: base64,
                  mimeType,
                })
              );
            }
          };
          reader.readAsDataURL(event.data);
        }
      };

      recorder.start(250); // send chunks every 250ms
    } catch (err) {
      console.error("[useAudioSession] Microphone access denied or unavailable:", err);
      setState((prev) => ({
        ...prev,
        status: "error",
        error: "Microphone access denied. Please allow microphone permission and try again.",
      }));
    }
  }

  const hangup = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "end_call" }));
      wsRef.current.close();
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
      recorderRef.current.stream.getTracks().forEach((t) => t.stop());
    }
    setState((prev) => ({ ...prev, status: "ended" }));
  }, []);

  const changeStyle = useCallback((style: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "change_style", style }));
    }
  }, []);

  const preferSilence = useCallback(() => {
    changeStyle("silent");
  }, [changeStyle]);

  return { state, hangup, changeStyle, preferSilence };
}
