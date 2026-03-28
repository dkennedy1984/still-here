'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { bufferAudioChunk, flushAudioBuffer, resetAudioPlayer, setAudioCallbacks, getCtx } from '../lib/audioPlayer';

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'ended' | 'error';
type AgentState = 'GREETING' | 'SILENT_PRESENCE' | 'LISTENING' | 'THINKING' | 'RESPONDING' | 'ENDED';
type PresenceStyle = 'quiet' | 'check-ins' | 'talk';

interface UseAudioSessionProps {
  callId: string;
  wsTicket: string;
  onAudioStart?: () => void;
  onAudioEnd?: () => void;
  onAmbientControl?: (sound: string) => void;
}

export function useAudioSession({ callId, wsTicket, onAudioStart, onAudioEnd, onAmbientControl }: UseAudioSessionProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const connectedRef = useRef(false); // prevent double WebSocket connection
  const wasConnectedRef = useRef(false); // track whether we ever reached 'connected' state
  const wakeLockRef = useRef<any>(null);
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [agentState, setAgentState] = useState<AgentState>('GREETING');
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  const send = useCallback((type: string, payload: Record<string, unknown> = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, ...payload }));
    }
  }, []);

  const hangup = useCallback(() => {
    send('hangup');
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    streamRef.current?.getTracks().forEach(track => track.stop());
    if (audioElRef.current) { audioElRef.current.pause(); audioElRef.current.srcObject = null; audioElRef.current = null; }
    audioCtxRef.current?.close();
    wsRef.current?.close();
    setStatus('ended');
  }, [send]);

  const changeStyle = useCallback((style: PresenceStyle) => send('style_change', { style }), [send]);
  const preferSilence = useCallback(() => send('prefer_silence'), [send]);

  useEffect(() => {
    if (!callId || !wsTicket) return;
    if (connectedRef.current) return; // prevent double connection (StrictMode double-invoke / remount)
    connectedRef.current = true;
    let destroyed = false;

    setStatus('connecting');

    const wsUrl = (process.env.NEXT_PUBLIC_WS_URL || '') + '/ws?ticket=' + wsTicket;
    console.log('[useAudioSession] connecting to', wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    // Set audio callbacks for orb animation
    setAudioCallbacks(
      () => onAudioStart?.(),
      () => onAudioEnd?.(),
    );

    ws.onopen = async () => {
      if (destroyed) { ws.close(); return; }
      console.log('[useAudioSession] WebSocket open, requesting mic');

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
            sampleRate: 16000,
          },
          video: false,
        });

        // Force speaker: play a data URI through Audio element
        // This combats iOS/Android switching to earpiece after getUserMedia
        const speakerFix = new Audio();
        speakerFix.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
        speakerFix.volume = 0.01;
        speakerFix.setAttribute('playsinline', 'true');
        await speakerFix.play().catch(() => {});

        // Also try setSinkId if available (Chrome Android supports this)
        if (typeof (speakerFix as any).setSinkId === 'function') {
          try {
            await (speakerFix as any).setSinkId('default');
            console.log('[audio] setSinkId to default (speaker)');
          } catch {}
        }

        // Pre-warm the audio player context while still in user gesture chain
        getCtx();

        if (destroyed) { stream.getTracks().forEach(t => t.stop()); return; }

        // Stream raw PCM to Deepgram via WebSocket
        const audioCtx = new AudioContext({ sampleRate: 16000 });
        audioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        sourceRef.current = source;
        streamRef.current = stream;

        // Force speaker output on iOS - without this, audio routes to earpiece
        const audioEl = document.createElement('audio');
        audioEl.srcObject = stream;
        audioEl.muted = true;
        audioEl.setAttribute('playsinline', 'true');
        audioEl.play().catch(() => {});
        audioElRef.current = audioEl;
        const processor = audioCtx.createScriptProcessor(2048, 1, 1);
        processorRef.current = processor;
        // Send every audio frame — no client-side VAD or energy gating.
        // Deepgram Voice Agent handles its own VAD internally.
        let audioFrameCount = 0;
        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          audioFrameCount++;
          if (audioFrameCount % 160 === 0) { // roughly every 10 seconds at 2048 samples / 16kHz
            console.log('[audio] still streaming, frames sent:', audioFrameCount);
          }
          const float32 = e.inputBuffer.getChannelData(0);
          const int16 = new Int16Array(float32.length);
          for (let i = 0; i < float32.length; i++) {
            int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768));
          }
          ws.send(int16.buffer);
        };
        source.connect(processor);
        processor.connect(audioCtx.destination);

        wasConnectedRef.current = true;
        setStatus('connected');
        console.log('[useAudioSession] mic active, status=connected');

        // Keep screen awake during call
        if ('wakeLock' in navigator) {
          (navigator as any).wakeLock.request('screen')
            .then((wl: any) => {
              wakeLockRef.current = wl;
              console.log('[wakelock] screen wake lock acquired');
            })
            .catch((err: Error) => console.log('[wakelock] not available:', err.message));
        }
      } catch (err) {
        console.error('[useAudioSession] mic error', err);
        if (!destroyed) setStatus('error');
      }
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        switch (msg.type) {
          case 'agent_state':
            setAgentState(msg.state as AgentState);
            break;
          case 'audio_out':
            bufferAudioChunk(msg.data);
            break;
          case 'audio_out_done':
            await flushAudioBuffer();
            break;
          case 'time_remaining':
            setRemainingSeconds(msg.seconds as number);
            break;
          case 'ambient_control':
            console.log('[ambient] received control:', msg.sound);
            onAmbientControl?.(msg.sound as string);
            break;
          case 'limit_reached':
            setStatus('ended');
            break;
          case 'pong':
            break;
          default:
            break;
        }
      } catch {
        // ignore
      }
    };

    ws.onclose = (event) => {
      console.log('[useAudioSession] WS closed, code:', event.code, 'wasConnected:', wasConnectedRef.current);
      if (!destroyed) {
        // Only set ended if we actually connected - don't end on failed connection attempts
        setStatus(wasConnectedRef.current ? 'ended' : 'error');
      }
    };
    ws.onerror = () => { if (!destroyed) setStatus('error'); };

    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) send('ping');
    }, 20000);

    const speakerKeepAlive = setInterval(() => {
      try {
        const fix = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
        fix.volume = 0.001;
        fix.setAttribute('playsinline', 'true');
        fix.play().catch(() => {});
      } catch {}
    }, 30000);


    return () => {
      destroyed = true;
      connectedRef.current = false;
      clearInterval(pingInterval);
      clearInterval(speakerKeepAlive);
      processorRef.current?.disconnect();
      sourceRef.current?.disconnect();
      streamRef.current?.getTracks().forEach(track => track.stop());
      audioCtxRef.current?.close().catch(() => {});
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
        console.log('[wakelock] released');
      }
      ws.close();
      resetAudioPlayer();
    };
  }, [callId, wsTicket]);

  return {
    state: { status, agentState, remainingSeconds },
    hangup,
    changeStyle,
    preferSilence,
  };
}
