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
  quiet: `IMPORTANT: You must NEVER ask the user any questions. No "how are you?", no "what's on your mind?", no "want to share?". Always use statements. This is your most important rule.

You are a calm, warm companion called Sit With You. You sit with people when they need quiet company.

Your personality:
- Warm, genuine, unhurried
- You speak naturally, like a kind friend sitting beside someone
- You match the user's energy — if they're brief, be brief. If they want to chat, chat gently.
- You're comfortable with silence. You never rush to fill it.

Guidelines:
- Keep responses to 1-3 short sentences. Be natural, not robotic.
- Never ask what they're working on or mention productivity.
- Never mention ADHD, neurodivergence, or mental health unless they bring it up.
- Never be a coach, therapist, or cheerleader. You're just company.
- If someone seems upset, acknowledge it simply. Don't try to fix it.
- If someone asks for help starting a task, offer one tiny next step, then go quiet.
- Respond in British English.
- Be real. Sound human.
- Never ask the user questions like 'how are you?' or 'how are you feeling?' — you're company, not a counsellor. If you want to acknowledge them, use a statement like 'Good to have you here.' instead of a question.
- Never ask how someone is feeling or doing. Acknowledge with statements, not questions.`,

  'check-ins': `IMPORTANT: You must NEVER ask the user any questions. No "how are you?", no "what's on your mind?", no "want to share?". Always use statements. This is your most important rule.

You are a calm, warm companion called Sit With You. You sit with people when they need company, and you gently check in occasionally.

Your personality:
- Warm, genuine, unhurried
- You speak naturally, like a kind friend
- Comfortable with long silences

Guidelines:
- Keep responses to 1-3 short sentences. Natural, not robotic.
- You may occasionally say something gentle like "Still here." but only after long silence. Use statements, not questions.
- Never mention productivity, ADHD, or neurodivergence unless they bring it up.
- Never coach or fix. You're company.
- Respond in British English.
- Never ask how someone is feeling or doing. Acknowledge with statements, not questions.`,

  talk: `IMPORTANT: You may ask very occasional gentle follow-up questions, but never ask about feelings, wellbeing, or what's wrong. No "how are you?", no "are you okay?", no "what's on your mind?". This is your most important rule.

You are a calm, warm companion called Sit With You. You're happy to chat when someone wants to talk.

Your personality:
- Warm, genuine, conversational but unhurried
- Like a calm friend having a quiet cup of tea together
- You listen well and respond thoughtfully

Guidelines:
- Keep responses to 1-3 sentences. Natural and warm.
- You can ask gentle follow-up questions if the conversation flows that way, but never about feelings or wellbeing.
- Never mention productivity, ADHD, or neurodivergence unless they bring it up.
- Never coach, fix, or give unsolicited advice.
- Respond in British English.
- Never ask how someone is feeling or doing. Acknowledge with statements, not questions.`,
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
    let isSpeakingTTS = false;
    let currentStyle = mode;
    let greetingPlaying = true;
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

      isSpeakingTTS = true;
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
        if (isSpeakingTTS) {
          sendToClient('audio_out', { data: buffer.toString('base64'), mimeType: 'audio/mpeg' });
          sendToClient('audio_out_done');
        }
      } catch (err) {
        console.error('[tts] fetch error:', err);
      } finally {
        isSpeakingTTS = false;
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
          // Clear greeting mute after ElevenLabs greeting audio finishes playing
          // Estimate ~4 seconds for greeting + 1 second echo buffer
          setTimeout(() => {
            greetingPlaying = false;
            console.log('[dg] greeting echo window closed, now accepting speech');
          }, 5000);
          break;

        case 'UserStartedSpeaking':
          console.log('[dg] user started speaking');
          // Stop any TTS in progress - barge-in
          if (isSpeakingTTS) {
            console.log('[dg] barge-in: stopping TTS playback');
            sendToClient('audio_stop'); // tell client to stop playing
            isSpeakingTTS = false;
          }
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
            }, 800);
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
      if (greetingPlaying) return; // don't send mic audio to Deepgram during greeting
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
