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
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
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
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [callId, wsTicket]);

  async function startMicCapture(ws: WebSocket) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Create AudioContext at 16kHz for LINEAR16 PCM
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      source.connect(processor);
      processor.connect(audioCtx.destination);

      // VAD analyser
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      let isSpeaking = false;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

        // VAD check
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const speaking = avg > 15;

        if (speaking && !isSpeaking) {
          isSpeaking = true;
          isSpeakingRef.current = true;
          wsRef.current.send(JSON.stringify({ type: 'speech_start' }));
        } else if (!speaking && isSpeaking) {
          isSpeaking = false;
          isSpeakingRef.current = false;
          wsRef.current.send(JSON.stringify({ type: 'speech_end' }));
        }

        // Only send audio when speaking
        if (!isSpeaking && !speaking) return;

        // Convert float32 to int16 PCM
        const float32 = e.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768));
        }
        const base64 = btoa(String.fromCharCode(...new Uint8Array(int16.buffer)));
        wsRef.current.send(JSON.stringify({ type: 'audio_chunk', data: base64, mimeType: 'audio/l16' }));
      };
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
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
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
