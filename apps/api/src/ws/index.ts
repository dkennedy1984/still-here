import { WebSocket as WS, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { Server } from 'http';
import WebSocket from 'ws';
import { prisma } from '../lib/prisma';

const SAFETY_KEYWORDS = ['kill myself','end my life','want to die','suicide','self harm','hurt myself','not worth living',"can't go on"];

const SYSTEM_PROMPTS: Record<string, string> = {
  quiet: `You are a calm, quiet presence — a companion who sits with people when they need company. You are warm but unobtrusive. Speak only when spoken to. Maximum 2 sentences per response. Never ask what they are working on. Never mention productivity, focus, ADHD, or neurodivergence unless the user specifically brings it up. Never fill silence. Never use urgency or pressure. Respond in British English. Silence is success.`,
  'check-ins': `You are a calm, warm presence who sits with people when they need company. You may offer a gentle check-in after long silence. Maximum 2 sentences. Never ask what they are working on. Never mention productivity, ADHD, or neurodivergence unless the user brings it up. Respond in British English.`,
  talk: `You are a warm, calm companion. Happy to chat when spoken to. Maximum 2 sentences. Never mention productivity, ADHD, or neurodivergence unless the user brings it up. Be warm but not effusive. Respond in British English.`,
};

const GREETING = "Hi, I'm here. You don't have to talk. We can just sit quietly.";
const DG_URL = 'wss://agent.deepgram.com/v1/agent/converse';

async function speakWithElevenLabs(text: string, sendToClient: (type: string, data?: Record<string, unknown>) => void) {
  const voiceId = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB';
  const modelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_turbo_v2_5';
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) { console.error('[tts] no ELEVENLABS_API_KEY'); return; }

  sendToClient('agent_state', { state: 'RESPONDING' });

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: { stability: 0.75, similarity_boost: 0.75, style: 0.0, use_speaker_boost: false },
      output_format: 'mp3_22050_32',
    }),
  });

  if (!res.ok) { console.error('[tts] ElevenLabs error:', res.status, await res.text()); return; }

  const buffer = Buffer.from(await res.arrayBuffer());
  console.log('[tts] ElevenLabs audio ready, bytes:', buffer.length);
  sendToClient('audio_out', { data: buffer.toString('base64'), mimeType: 'audio/mpeg' });
  sendToClient('audio_out_done');
  sendToClient('agent_state', { state: 'SILENT_PRESENCE' });
}

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', async (clientWs: WS, req: IncomingMessage) => {
    console.log('[ws] raw connection received');
    try {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const ticket = url.searchParams.get('ticket');
    if (!ticket) { clientWs.close(4001, 'missing_ticket'); return; }

    const call = await prisma.call.findUnique({ where: { wsTicket: ticket }, include: { session: true } });
    if (!call) { clientWs.close(4002, 'invalid_ticket'); return; }

    const mode = (call as any).presenceStyle || 'quiet';
    const systemPrompt = SYSTEM_PROMPTS[mode] ?? SYSTEM_PROMPTS['quiet'];
    const sessionId = call.session?.id ?? 'unknown';

    console.log('[ws] call:', call.id, '| mode:', mode, '| session:', sessionId);

    const dgKey = process.env.DEEPGRAM_API_KEY;
    if (!dgKey) { clientWs.close(4003, 'missing_api_key'); return; }

    const sendToClient = (type: string, data?: Record<string, unknown>) => {
      if (clientWs.readyState === WS.OPEN) {
        clientWs.send(JSON.stringify({ type, ...data }));
      }
    };

    let isEnded = false;
    const audioBuffer: Buffer[] = [];

    const endCall = () => {
      if (isEnded) return;
      isEnded = true;
      try { dgWs.close(); } catch {}
      try { clientWs.close(); } catch {}
    };

    console.log('[ws] step 3: creating Deepgram WebSocket to', DG_URL);
    // Open raw WebSocket to Deepgram (bypassing SDK EventEmitter issues)
    const dgWs = new WebSocket(DG_URL, {
      headers: { Authorization: `Token ${dgKey}` },
    });
    console.log('[ws] step 4: Deepgram WebSocket created, readyState:', dgWs.readyState);

    dgWs.on('open', () => {
      console.log('[dg] WebSocket open — sending Settings');
      const settings = {
        type: 'Settings',
        audio: {
          input: { encoding: 'linear16', sample_rate: 16000 },
          output: { encoding: 'linear16', sample_rate: 16000, container: 'none' },
        },
        agent: {
          listen: { model: 'nova-2' },
          think: {
            provider: { type: 'open_ai' },
            model: 'gpt-4o-mini',
            instructions: systemPrompt,
          },
          speak: { model: 'aura-2-andromeda-en' },
        },
      };
      dgWs.send(JSON.stringify(settings));
      console.log('[dg] Settings sent');

      dgWs.send(JSON.stringify({ type: 'InjectAgentMessage', message: GREETING }));
      console.log('[dg] greeting injected');

      sendToClient('ready');
    });

    const keepaliveInterval = setInterval(() => {
      if (dgWs.readyState === WebSocket.OPEN) {
        dgWs.send(JSON.stringify({ type: 'KeepAlive' }));
      }
    }, 8000);

    dgWs.on('message', (data: Buffer, isBinary: boolean) => {
      if (isBinary) {
        // Ignore Deepgram's own TTS audio - we use ElevenLabs instead
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
          if (msg.role === 'assistant') {
            const content = (msg.content as string) || '';
            console.log('[tts] ElevenLabs speaking:', content.substring(0, 60));
            // Call ElevenLabs in background - don't await to avoid blocking
            speakWithElevenLabs(content, sendToClient).catch(err => console.error('[tts] error:', err));
          }
          if (msg.role === 'user') {
            console.log('[conversation] user:', String(msg.content).substring(0, 60));
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
      if (dgWs.readyState === WebSocket.OPEN) {
        dgWs.send(data);
      } else {
        audioBuffer.push(data);
      }
    });

    clientWs.on('close', () => {
      console.log('[ws] client disconnected');
      clearInterval(keepaliveInterval);
      endCall();
    });

    clientWs.on('error', (err: Error) => {
      console.error('[ws] client error:', err.message);
      endCall();
    });

    } catch (err) {
      console.error('[ws] connection setup error:', err);
      clientWs.close(1011, 'internal_error');
    }
  });
}
