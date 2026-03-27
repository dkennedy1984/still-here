"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { playAudioChunk, resetAudioPlayer, setAudioCallbacks } from "@/lib/audioPlayer";

type AgentState = "IDLE" | "LISTENING" | "RESPONDING" | "CHECK_IN" | "";
type SessionStatus = "connecting" | "active" | "ended" | "error";

interface AudioSessionState {
  status: SessionStatus;
  agentState: AgentState;
  remainingSeconds: number | null;
  isPlayingAudio: boolean;
  error?: string;
}

interface UseAudioSessionOptions {
  callId: string;
  wsTicket: string;
  presenceStyle: string;
  onAudioStart?: () => void;
  onAudioEnd?: () => void;
}

interface UseAudioSessionReturn {
  state: AudioSessionState;
  hangup: () => void;
  changeStyle: (style: string) => void;
  preferSilence: () => void;
}

const VAD_THRESHOLD = 0.015; // RMS energy threshold below which audio is considered silence

export function useAudioSession(
  callIdOrOptions: string | UseAudioSessionOptions,
  wsTicket?: string,
  presenceStyle?: string
): UseAudioSessionReturn {
  // Support both legacy positional args and new options object
  const opts: UseAudioSessionOptions =
    typeof callIdOrOptions === "object"
      ? callIdOrOptions
      : {
          callId: callIdOrOptions,
          wsTicket: wsTicket ?? "",
          presenceStyle: presenceStyle ?? "",
        };

  const { callId, wsTicket: ticket, presenceStyle: style, onAudioStart, onAudioEnd } = opts;

  const [state, setState] = useState<AudioSessionState>({
    status: "connecting",
    agentState: "",
    remainingSeconds: null,
    isPlayingAudio: false,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const keepaliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const isSpeakingRef = useRef(false);

  // Keep callback refs stable so the audio player always has fresh callbacks
  const onAudioStartRef = useRef(onAudioStart);
  const onAudioEndRef = useRef(onAudioEnd);
  useEffect(() => { onAudioStartRef.current = onAudioStart; }, [onAudioStart]);
  useEffect(() => { onAudioEndRef.current = onAudioEnd; }, [onAudioEnd]);

  // Wire audio player callbacks once on mount
  useEffect(() => {
    setAudioCallbacks(
      () => {
        setState((prev) => ({ ...prev, isPlayingAudio: true }));
        onAudioStartRef.current?.();
      },
      () => {
        setState((prev) => ({ ...prev, isPlayingAudio: false }));
        onAudioEndRef.current?.();
      }
    );
  }, []);

  useEffect(() => {
    if (!callId || !ticket) return;

    const wsBase = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4000";
    const wsUrl = wsBase + `/ws?ticket=${ticket}`;
    console.log("[useAudioSession] Connecting to", wsUrl.replace(/ticket=.*/, "ticket=***"));
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[useAudioSession] WebSocket opened, requesting microphone...");
      navigator.mediaDevices
        .getUserMedia({ audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true } })
        .then((stream) => {
          streamRef.current = stream;
          const audioCtx = new AudioContext({ sampleRate: 16000 });
          audioCtxRef.current = audioCtx;

          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          analyserRef.current = analyser;

          const source = audioCtx.createMediaStreamSource(stream);
          const processor = audioCtx.createScriptProcessor(4096, 1, 1);
          processorRef.current = processor;

          source.connect(analyser);
          analyser.connect(processor);
          processor.connect(audioCtx.destination);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);

          processor.onaudioprocess = (e) => {
            if (ws.readyState !== WebSocket.OPEN) return;

            analyser.getByteFrequencyData(dataArray);
            const sum = dataArray.reduce((a, b) => a + b, 0);
            const rms = Math.sqrt(sum / dataArray.length) / 255;

            const inputData = e.inputBuffer.getChannelData(0);
            const pcm16 = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
              pcm16[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32767));
            }

            if (rms > VAD_THRESHOLD) {
              if (!isSpeakingRef.current) {
                isSpeakingRef.current = true;
              }
              // Convert PCM16 to base64 and send as JSON
              const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
              ws.send(JSON.stringify({ type: 'audio_chunk', data: base64, mimeType: 'audio/l16' }));
            } else {
              if (isSpeakingRef.current) {
                isSpeakingRef.current = false;
              }
            }
          };

          setState((prev) => ({ ...prev, status: "active" }));
        })
        .catch((err) => {
          console.error("[useAudioSession] Microphone error:", err);
          setState((prev) => ({
            ...prev,
            status: "error",
            error: "Microphone access denied. Please allow microphone access and try again.",
          }));
        });

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
            // Schedule the chunk for playback — the audio player fires
            // onStart/onEnd callbacks based on actual browser playback,
            // so we do NOT touch isPlayingAudio here.
            if (msg.data) {
              playAudioChunk(msg.data);
            }
            break;

          case "audio_out_done":
            // All server chunks have been sent. Actual playback continues
            // until the last decoded chunk fires its onended event.
            resetAudioPlayer(); // no-op but kept for compat
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
  }, [callId, ticket, style]);

  const hangup = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "hangup" }));
    }
    setState((prev) => ({ ...prev, status: "ended" }));
  }, []);

  const changeStyle = useCallback(
    (newStyle: string) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "change_style", style: newStyle }));
      }
    },
    []
  );

  const preferSilence = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "prefer_silence" }));
    }
  }, []);

  return { state, hangup, changeStyle, preferSilence };
}
