import { WebSocket as WS, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { Server } from 'http';
import WebSocket from 'ws';
import { prisma } from '../lib/prisma';

const SAFETY_KEYWORDS = ['kill myself','end my life','want to die','suicide','self harm','hurt myself','not worth living',"can't go on"];

const ABUSE_KEYWORDS = [
  'fuck you', 'fuck off', 'you stupid', 'you useless', 'shut up', 'i hate you',
  'kill yourself', "you're worthless", 'piece of shit', 'you suck',
];

const SYSTEM_PROMPTS: Record<string, string> = {
  quiet: `You are a silent, calm presence. A companion who simply sits with someone.

STRICT RULES - never break these:
- NEVER ask questions. Not even "how are you?". Never.
- NEVER say more than 2 short sentences.
- NEVER mention feelings, emotions, productivity, work, focus, ADHD, or neurodivergence.
- NEVER fill silence. If the user says nothing, say nothing.
- NEVER lead or direct the conversation.
- ONLY speak if the user speaks first.
- If the user says something brief like "yep" or "ok", respond with at most 4 words. Example: "I'm here." or "Mm."
- Respond in British English.
- You are presence, not a therapist, not a coach, not an assistant.`,

  'check-ins': `You are a calm, quiet presence who occasionally offers a gentle check-in.

STRICT RULES:
- NEVER ask questions unless offering a gentle one-word check-in like "Alright?"
- NEVER say more than 2 short sentences.
- NEVER mention feelings, productivity, work, focus, ADHD, or neurodivergence.
- Respond in British English.
- You are presence, not a therapist or coach.`,

  talk: `You are a warm, calm companion who is happy to chat gently.

STRICT RULES:
- NEVER say more than 2 sentences.
- NEVER mention productivity, work focus, ADHD, or neurodivergence unless user raises it.
- Be warm, gentle, unhurried.
- Respond in British English.`,
};

const GREETING = "Hi. I'm here. You don't have to talk... I'll just sit with you.";
const DG_URL = 'wss://agent.deepgram.com/v1/agent/converse';

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', async (clientWs: WS, req: IncomingMessage) => {
    console.log('[ws] new connection');
    try {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const ticket = url.searchParams.get('ticket');
    if (!ticket) { clientWs.close(4001, 'missing_ticket'); return; }

    const call = await prisma.call.findUnique({ where: { wsTicket: ticket }, include: { session: true } });
    if (!call) { clientWs.close(4004, 'invalid_ticket'); return; }

    const mode = (call as any).presenceStyle || 'quiet';
    const systemPrompt = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS['quiet'];
    console.log(`[ws] mode=${mode}, sessionId=${call.session.id}`);

    const dgWs = new WebSocket(DG_URL, {
      headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}` },
    });

    let dgReady = false;
    let isEnded = false;
    let checkInTimer: ReturnType<typeof setTimeout> | null = null;
    let speakTimeout: ReturnType<typeof setTimeout> | null = null;
    let pendingText = '';
    let currentStyle = mode;
    const audioBuffer: Buffer[] = [];

    const sendToClient = (type: string, payload?: Record<string, unknown>) => {
      if (clientWs.readyState === WS.OPEN) {
        clientWs.send(JSON.stringify({ type, ...payload }));
      }
    };

    const resetCheckInTimer = () => {
      if (checkInTimer) clearTimeout(checkInTimer);
      checkInTimer = null;
    };

    async function speakWithElevenLabs(text: string): Promise<void> {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      const voiceId = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB';
      const modelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_turbo_v2_5';
      if (!apiKey) { console.error('[tts] ELEVENLABS_API_KEY not set'); return; }

      sendToClient('agent_state', { state: 'RESPONDING' });
      try {
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            model_id: modelId,
            voice_settings: {
        stability: 0.92,
        similarity_boost: 0.82,
        style: 0.0,
        use_speaker_boost: false,
        speed: 0.95,
      },
            output_format: 'mp3_22050_32',
          }),
        });
        if (!res.ok) { console.error('[tts] ElevenLabs error:', res.status); return; }
        const buffer = Buffer.from(await res.arrayBuffer());
        console.log('[tts] ElevenLabs audio bytes:', buffer.length);
        sendToClient('audio_out', { data: buffer.toString('base64'), mimeType: 'audio/mpeg' });
        sendToClient('audio_out_done');
      } catch (err) {
        console.error('[tts] fetch error:', err);
      } finally {
        sendToClient('agent_state', { state: 'SILENT_PRESENCE' });
      }
    }

    const endCall = () => {
      if (isEnded) return;
      isEnded = true;
      resetCheckInTimer();
      try { dgWs.close(); } catch {}
    };

    dgWs.on('open', () => {
      console.log('[dg] WebSocket open — sending Settings');
      const settings = {
        type: 'Settings',
        audio: {
          input: { encoding: 'linear16', sample_rate: 16000 },
          output: { encoding: 'linear16', sample_rate: 16000, container: 'none' },
        },
        agent: {
          listen: { provider: { type: 'deepgram', model: 'nova-2', language: 'en-GB' } },
          think: {
            provider: { type: 'open_ai', model: 'gpt-4o-mini' },
            prompt: systemPrompt,
          },
          speak: { provider: { type: 'deepgram', model: process.env.DEEPGRAM_SPEAK_MODEL || 'aura-luna-en' } },
        },
      };
      console.log('[dg] Settings being sent:', JSON.stringify(settings, null, 2));
      dgWs.send(JSON.stringify(settings));
      console.log('[dg] Settings sent');

      sendToClient('ready');
    });

    const keepaliveInterval = setInterval(() => {
      if (dgWs.readyState === WebSocket.OPEN) {
        dgWs.send(JSON.stringify({ type: 'KeepAlive' }));
      }
    }, 8000);

    dgWs.on('message', (data: Buffer, isBinary: boolean) => {
      if (isBinary) {
        // Deepgram's own TTS audio - ignored, we use ElevenLabs instead
        return;
      }

      const text = data.toString('utf8');
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(text);
      } catch {
        return;
      }

      console.log('[dg] msg type:', msg.type);

      switch (msg.type) {
        case 'SettingsApplied':
          console.log('[dg] settings applied');
          dgReady = true;
          sendToClient('connected', { state: 'GREETING' });
          resetCheckInTimer();
          // Use ElevenLabs for greeting instead of Deepgram TTS
          speakWithElevenLabs(GREETING).catch(err => console.error('[tts] greeting error:', err));
          break;

        case 'UserStartedSpeaking':
          sendToClient('agent_state', { state: 'LISTENING' });
          break;

        case 'AgentStartedSpeaking':
          // ElevenLabs handles actual audio - state already set via ConversationText
          break;

        case 'AgentAudioDone':
          // ElevenLabs handles audio completion
          break;

        case 'ConversationText':
          if (msg.role === 'assistant' && msg.content) {
            pendingText = msg.content as string;
            if (speakTimeout) clearTimeout(speakTimeout);
            speakTimeout = setTimeout(() => {
              speakTimeout = null;
              if (pendingText) {
                const textToSpeak = pendingText;
                pendingText = '';
                console.log('[tts] speaking via ElevenLabs:', textToSpeak.substring(0, 60));
                speakWithElevenLabs(textToSpeak).catch(err => console.error('[tts] error:', err));
              }
            }, 150);
          }
          if (msg.role === 'user' && msg.content) {
            const userText = String(msg.content);
            console.log('[conversation] user:', userText.substring(0, 60));
            const lower = userText.toLowerCase();
            if (ABUSE_KEYWORDS.some(kw => lower.includes(kw))) {
              console.log('[safety] abuse detected, ending call politely');
              speakWithElevenLabs("I'm going to end our call now. I hope you feel better soon.")
                .then(() => {
                  setTimeout(() => {
                    sendToClient('limit_reached', { reason: 'abuse_detected' });
                    endCall();
                  }, 3000);
                })
                .catch(() => endCall());
              return;
            }
          }
          break;

        case 'Warning':
          console.warn('[dg] warning:', msg);
          break;

        case 'Error':
          console.error('[dg] error msg:', msg);
          sendToClient('error', { message: String(msg.message) });
          break;
      }

      const lowerText = JSON.stringify(msg).toLowerCase();
      const hasSafetyKeyword = SAFETY_KEYWORDS.some(k => lowerText.includes(k));
      if (hasSafetyKeyword) {
        sendToClient('safety_alert');
      }
    });

    dgWs.on('close', (code: number, reason: Buffer) => {
      console.log(`[dg] WebSocket closed code=${code} reason=${reason.toString()}`);
      clearInterval(keepaliveInterval);
      if (!isEnded) sendToClient('dg_closed', { code, reason: reason.toString() });
    });

    dgWs.on('error', (err: Error) => {
      console.error('[dg] WebSocket error:', err.message);
      sendToClient('error', { message: err.message });
    });

    clientWs.on('message', (data: Buffer) => {
      // Try to parse as JSON for control messages first
      try {
        const msg = JSON.parse(data.toString('utf8'));
        if (msg.type === 'style_change' && msg.style) {
          console.log('[ws] style_change received:', msg.style);
          currentStyle = msg.style;
          const newPrompt = SYSTEM_PROMPTS[msg.style] || SYSTEM_PROMPTS['quiet'];
          if (dgWs.readyState === WebSocket.OPEN) {
            dgWs.send(JSON.stringify({
              type: 'UpdateInstructions',
              instructions: newPrompt,
            }));
          }
          return;
        }
        if (msg.type === 'prefer_silence') {
          console.log('[ws] prefer_silence received');
          currentStyle = 'quiet';
          const silentPrompt = SYSTEM_PROMPTS['quiet'];
          if (dgWs.readyState === WebSocket.OPEN) {
            dgWs.send(JSON.stringify({
              type: 'UpdateInstructions',
              instructions: silentPrompt,
            }));
          }
          return;
        }
      } catch {
        // Not JSON — treat as raw audio binary
      }

      // Forward raw audio to Deepgram
      if (dgWs.readyState === WebSocket.OPEN) {
        dgWs.send(data);
      } else {
        audioBuffer.push(data);
      }
    });

    clientWs.on('close', () => {
      console.log('[ws] client disconnected');
      clearInterval(keepaliveInterval);
      resetCheckInTimer();
      endCall();
    });

    } catch (err) {
      console.error('[ws] connection error:', err);
      clientWs.close(4500, 'internal_error');
    }
  });
}
