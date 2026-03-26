"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { playAudioChunk } from "@/lib/audioPlayer";

type AgentState = "IDLE" | "LISTENING" | "RESPONDING" | "CHECK_IN" | "";
type SessionStatus = "connecting" | "active" | "ended";

interface AudioSessionState {
  status: SessionStatus;
  agentState: AgentState;
  remainingSeconds: number | null;
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

    const wsUrl = (process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001") + `/ws?ticket=${wsTicket}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setState((prev) => ({ ...prev, status: "active" }));

      // Start keepalive
      keepaliveRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 20000);

      // Start mic capture
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          const recorder = new MediaRecorder(stream, {
            mimeType: "audio/webm;codecs=opus",
          });
          recorderRef.current = recorder;

          recorder.ondataavailable = async (event) => {
            if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
              const buffer = await event.data.arrayBuffer();
              const base64 = btoa(
                String.fromCharCode(...new Uint8Array(buffer))
              );
              ws.send(
                JSON.stringify({ type: "audio_chunk", data: base64 })
              );
            }
          };

          recorder.start(100);
        })
        .catch((err) => {
          console.error("Mic access denied:", err);
        });
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === "agent_state") {
          setState((prev) => ({ ...prev, agentState: msg.state }));
        }

        if (msg.type === "audio_out") {
          playAudioChunk(msg.data);
        }

        if (msg.type === "limit_reached") {
          setState((prev) => ({ ...prev, status: "ended" }));
        }

        if (msg.type === "remaining_seconds") {
          setState((prev) => ({
            ...prev,
            remainingSeconds: msg.seconds,
          }));
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      setState((prev) => ({ ...prev, status: "ended" }));
    };

    ws.onerror = () => {
      setState((prev) => ({ ...prev, status: "ended" }));
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

  const hangup = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "hangup" }));
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
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "change_style", style: "silent" }));
    }
  }, []);

  return { state, hangup, changeStyle, preferSilence };
}
