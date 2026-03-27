'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { bufferAudioChunk, flushAudioBuffer, resetAudioPlayer, setAudioCallbacks } from '../lib/audioPlayer';

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'ended' | 'error';
type AgentState = 'GREETING' | 'SILENT_PRESENCE' | 'LISTENING' | 'THINKING' | 'RESPONDING' | 'ENDED';
type PresenceStyle = 'quiet' | 'check-ins' | 'talk';

interface UseAudioSessionProps {
  callId: string;
  wsTicket: string;
  presenceStyle: PresenceStyle;
  onAudioStart?: () => void;
  onAudioEnd?: () => void;
}

export function useAudioSession({ callId, wsTicket, presenceStyle, onAudioStart, onAudioEnd }: UseAudioSessionProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
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
    audioCtxRef.current?.close();
    wsRef.current?.close();
    setStatus('ended');
  }, [send]);

  const changeStyle = useCallback((style: PresenceStyle) => send('style_change', { style }), [send]);
  const preferSilence = useCallback(() => send('prefer_silence'), [send]);

  useEffect(() => {
    if (!callId || !wsTicket) return;
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

        if (destroyed) { stream.getTracks().forEach(t => t.stop()); return; }

        // Stream raw PCM to Deepgram via WebSocket
        const audioCtx = new AudioContext({ sampleRate: 16000 });
        audioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const processor = audioCtx.createScriptProcessor(2048, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const float32 = e.inputBuffer.getChannelData(0);
          const int16 = new Int16Array(float32.length);
          for (let i = 0; i < float32.length; i++) {
            int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768));
          }
          // Send as raw binary - Deepgram Voice Agent expects raw PCM
          ws.send(int16.buffer);
        };

        source.connect(processor);
        processor.connect(audioCtx.destination);

        setStatus('connected');
        console.log('[useAudioSession] mic streaming started');
      } catch (err) {
        console.error('[useAudioSession] mic error:', err);
        setStatus('error');
      }
    };

    ws.onmessage = async (evt) => {
      try {
        // Handle binary audio from Deepgram (raw PCM)
        if (evt.data instanceof Blob) {
          const buffer = await evt.data.arrayBuffer();
          const b64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
          bufferAudioChunk(b64);
          return;
        }

        const msg = JSON.parse(evt.data);
        const type = msg.type || msg.event;

        switch (type) {
          case 'connected':
          case 'session_ready':
            setStatus('connected');
            break;
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

    ws.onclose = () => { if (!destroyed) setStatus('ended'); };
    ws.onerror = () => { if (!destroyed) setStatus('error'); };

    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) send('ping');
    }, 20000);

    return () => {
      destroyed = true;
      clearInterval(pingInterval);
      processorRef.current?.disconnect();
      audioCtxRef.current?.close().catch(() => {});
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
