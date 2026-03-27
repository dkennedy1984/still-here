'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { bufferAudioChunk, flushAudioBuffer, setAudioCallbacks, resetAudioPlayer } from '../lib/audioPlayer';

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

/**
 * Force iOS/Safari to route audio through the loudspeaker instead of the earpiece.
 * iOS classifies AudioContext sessions as "voice call" by default, which routes to
 * the earpiece. Creating a silent <audio> element with autoplay + playsinline signals
 * to AVAudioSession that this is "media playback", switching to the loudspeaker.
 * The element is appended to the DOM and removed on cleanup.
 */
function lockAudioRouteToSpeaker(): HTMLAudioElement {
  const el = document.createElement('audio');
  el.setAttribute('playsinline', '');
  el.setAttribute('autoplay', '');
  el.muted = true;
  el.srcObject = null;
  // A 1-sample silent data URI so the element is "playing" from the browser's perspective
  el.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
  el.style.display = 'none';
  document.body.appendChild(el);
  el.play().catch(() => {}); // ignore autoplay policy rejections
  return el;
}

export function useAudioSession({ callId, wsTicket, presenceStyle, onAudioStart, onAudioEnd }: UseAudioSessionProps) {
  const wsRef = useRef<WebSocket | null>(null);
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
    wsRef.current?.close();
    setStatus('ended');
  }, [send]);

  const changeStyle = useCallback((style: PresenceStyle) => send('style_change', { style }), [send]);
  const preferSilence = useCallback(() => send('prefer_silence'), [send]);

  useEffect(() => {
    if (!callId || !wsTicket) return;
    let destroyed = false;
    let mediaRecorder: MediaRecorder | null = null;
    let audioCtx: AudioContext | null = null;
    let isSpeaking = false;
    let animFrameId: number;
    let speakerLockEl: HTMLAudioElement | null = null;

    setStatus('connecting');
    const wsUrl = (process.env.NEXT_PUBLIC_WS_URL || '') + '/ws?ticket=' + wsTicket;
    console.log('[useAudioSession] Connecting to', wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = async () => {
      if (destroyed) { ws.close(); return; }
      console.log('[useAudioSession] WebSocket opened, requesting mic');
      setStatus('connecting');

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
          video: false,
        });
        if (destroyed) { stream.getTracks().forEach(t => t.stop()); return; }

        setStatus('connected');

        // Force loudspeaker on iOS — must happen before AudioContext is created
        speakerLockEl = lockAudioRouteToSpeaker();

        // --- VAD using Web Audio analyser ---
        audioCtx = new AudioContext({ sampleRate: 16000 });
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.3;
        source.connect(analyser);
        const freqData = new Uint8Array(analyser.frequencyBinCount);

        // --- MediaRecorder for actual audio capture ---
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';
        mediaRecorder = new MediaRecorder(stream, { mimeType });

        mediaRecorder.ondataavailable = async (e) => {
          if (e.data.size < 100 || ws.readyState !== WebSocket.OPEN) return;
          const buf = await e.data.arrayBuffer();
          const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
          ws.send(JSON.stringify({ type: 'audio_chunk', data: b64, mimeType }));
        };

        // --- VAD loop ---
        const SPEECH_THRESHOLD = 35;
        const SILENCE_FRAMES_NEEDED = 25;
        const SPEECH_FRAMES_NEEDED = 5;
        let silenceFrames = 0;
        let speechFrames = 0;

        const vadLoop = () => {
          if (destroyed) return;
          analyser.getByteFrequencyData(freqData);
          const avg = freqData.slice(0, 60).reduce((a, b) => a + b, 0) / 60;

          if (avg > SPEECH_THRESHOLD) {
            silenceFrames = 0;
            speechFrames++;
            if (speechFrames >= SPEECH_FRAMES_NEEDED && !isSpeaking) {
              isSpeaking = true;
              console.log('[vad] speech start, energy:', avg.toFixed(1));
              if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'speech_start' }));
              if (mediaRecorder && mediaRecorder.state === 'inactive') mediaRecorder.start(250);
            }
          } else {
            speechFrames = 0;
            if (isSpeaking) {
              silenceFrames++;
              if (silenceFrames >= SILENCE_FRAMES_NEEDED) {
                isSpeaking = false;
                silenceFrames = 0;
                console.log('[vad] speech end');
                if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
                setTimeout(() => {
                  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'speech_end' }));
                }, 300);
              }
            }
          }
          animFrameId = requestAnimationFrame(vadLoop);
        };
        animFrameId = requestAnimationFrame(vadLoop);

        // Set up audio callbacks for orb
        setAudioCallbacks(
          () => onAudioStart?.(),
          () => onAudioEnd?.(),
        );

      } catch (err) {
        console.error('[useAudioSession] mic error:', err);
        setStatus('error');
      }
    };

    ws.onmessage = async (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        const type = msg.type || msg.event;

        switch (type) {
          case 'connected':
          case 'session_ready':
            setStatus('connected');
            break;
          case 'agent_state':
            setAgentState(msg.state);
            break;
          case 'audio_out':
            bufferAudioChunk(msg.data);
            break;
          case 'audio_out_done':
            await flushAudioBuffer();
            break;
          case 'time_remaining':
            setRemainingSeconds(msg.seconds);
            break;
          case 'limit_reached':
            setStatus('ended');
            break;
          case 'ping':
          case 'pong':
            break;
          default:
            break;
        }
      } catch (err) {
        console.error('[useAudioSession] message error:', err);
      }
    };

    ws.onclose = () => { if (!destroyed) setStatus('ended'); };
    ws.onerror = () => { if (!destroyed) setStatus('error'); };

    // Keepalive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
    }, 20000);

    return () => {
      destroyed = true;
      cancelAnimationFrame(animFrameId);
      clearInterval(pingInterval);
      mediaRecorder?.stop();
      audioCtx?.close();
      ws.close();
      resetAudioPlayer();
      if (speakerLockEl && document.body.contains(speakerLockEl)) {
        document.body.removeChild(speakerLockEl);
      }
    };
  }, [callId, wsTicket]);

  return {
    state: { status, agentState, remainingSeconds },
    hangup,
    changeStyle,
    preferSilence,
  };
}
