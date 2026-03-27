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

const VAD_THRESHOLD = 0.015; // RMS energy threshold below which audio is considered silence

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
  const analyserRef = useRef<AnalyserNode | null>(null);
  const isSpeakingRef = useRef(false);

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
              error: msg.message || "An error occurred",
            }));
            break;

          default:
            console.log("[useAudioSession] Unknown message type:", msg.type);
        }
      } catch (err) {
        console.error("[useAudioSession] Failed to parse message:", err);
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

      // Set up AnalyserNode for Voice Activity Detection
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Start a VAD polling loop
      const dataArray = new Float32Array(analyser.fftSize);
      function checkVAD() {
        if (!analyserRef.current) return;
        analyserRef.current.getFloatTimeDomainData(dataArray);
        // Calculate RMS energy
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / dataArray.length);
        isSpeakingRef.current = rms > VAD_THRESHOLD;
        requestAnimationFrame(checkVAD);
      }
      checkVAD();

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;

      recorder.ondataavailable = async (e) => {
        if (e.data.size === 0) return;
        if (ws.readyState !== WebSocket.OPEN) return;

        // Only send audio when VAD detects speech
        if (!isSpeakingRef.current) return;

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
      wsRef.current.send(JSON.stringify({ type: "hangup" }));
      wsRef.current.close();
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
      recorderRef.current.stream.getTracks().forEach((t) => t.stop());
    }
    if (analyserRef.current) {
      analyserRef.current = null;
    }
    setState((prev) => ({ ...prev, status: "ended" }));
  }, []);

  const changeStyle = useCallback((style: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "style_change", style }));
    }
  }, []);

  const preferSilence = useCallback(() => {
    changeStyle("silent");
  }, [changeStyle]);

  return { state, hangup, changeStyle, preferSilence };
}
