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
            // Agent finished sending audio for this response
            break;

          case "remaining_seconds":
            setState((prev) => ({
              ...prev,
              remainingSeconds: msg.seconds ?? prev.remainingSeconds,
            }));
            break;

          case "call_ended":
            setState((prev) => ({ ...prev, status: "ended" }));
            break;

          case "error":
            setState((prev) => ({
              ...prev,
              status: "error",
              error: msg.message || "Unknown error occurred.",
            }));
            break;

          default:
            console.log("[useAudioSession] Unknown message type:", msg.type);
        }
      } catch {
        console.error("[useAudioSession] Failed to parse message:", event.data);
      }
    };

    return () => {
      if (keepaliveRef.current) clearInterval(keepaliveRef.current);
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
        recorderRef.current.stream.getTracks().forEach((t) => t.stop());
      }
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [callId, wsTicket]);

  async function startMicCapture(ws: WebSocket) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

      // Pick the best supported audio format for this browser
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;

      recorder.ondataavailable = async (e) => {
        if (e.data.size === 0) return;
        if (ws.readyState !== WebSocket.OPEN) return;

        console.log("[audio] sending chunk, size:", e.data.size);

        const buffer = await e.data.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

        console.log("[ws] sending audio_chunk");
        ws.send(
          JSON.stringify({
            type: "audio_chunk",
            data: base64,
            mimeType,
          })
        );
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
