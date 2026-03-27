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

const GREETING = "Hi. I'm here. You don't have to talk — we can just sit quietly.";
const DG_URL = 'wss://agent.deepgram.com/v1/agent/converse';

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', async (clientWs: WS, req: IncomingMessage) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const ticket = url.searchParams.get('ticket');
    if (!ticket) { clientWs.close(4001, 'missing_ticket'); return; }

    const call = await prisma.call.findUnique({ where: { wsTicket: ticket }, include: { session: true } });
    if (!call) { clientWs.close(4002, 'invalid_ticket'); return; }

    const mode = (call as any).presenceStyle || 'quiet';
    const systemPrompt = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.quiet;

    console.log(`[ws] new connection, callId=${call.id}, mode=${mode}`);

    const sendToClient = (type: string, payload: Record<string, unknown> = {}) => {
      if (clientWs.readyState === WS.OPEN) {
        clientWs.send(JSON.stringify({ type, ...payload }));
      }
    };

    let dgReady = false;
    let isEnded = false;
    let agentSpeaking = false;
    const audioBuffer: Buffer[] = [];

    const endCall = () => {
      if (isEnded) return;
      isEnded = true;
      sendToClient('call_ended');
      try { dgWs.close(); } catch {}
      try { clientWs.close(); } catch {}
    };

    const dgWs = new WebSocket(DG_URL, {
      headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}` },
    });

    dgWs.on('open', () => {
      console.log('[deepgram] connected, sending settings');

      const settings = {
        type: 'Settings',
        audio: {
          input: { encoding: 'linear16', sample_rate: 16000 },
          output: { encoding: 'linear16', sample_rate: 16000, container: 'none' },
        },
        agent: {
          listen: {
            provider: { type: 'deepgram', model: 'nova-2', language: 'en-GB' },
          },
          think: {
            provider: {
              type: 'open_ai',
              model: 'gpt-4o-mini',
            },
            prompt: systemPrompt,
          },
          speak: {
            provider: { type: 'deepgram', model: 'aura-athena-en' },
          },
        },
      };

      console.log('[deepgram] Settings:', JSON.stringify(settings, null, 2));
      dgWs.send(JSON.stringify(settings));
      console.log('[deepgram] Settings sent');
    });

    dgWs.on('message', (data: Buffer, isBinary: boolean) => {
      if (isBinary) {
        console.log('[deepgram] binary audio frame, bytes:', (data as Buffer).length);
        if (!agentSpeaking) {
          agentSpeaking = true;
          sendToClient('agent_state', { state: 'RESPONDING' });
        }
        const b64 = (data as Buffer).toString('base64');
        sendToClient('audio_out', { data: b64, mimeType: 'audio/l16', sampleRate: 16000 });
        return;
      }

      try {
        const msg = JSON.parse(data.toString());
        console.log('[deepgram] msg:', msg.type);

        switch (msg.type) {
          case 'Welcome':
            console.log('[deepgram] welcomed');
            break;
          case 'SettingsApplied':
            console.log('[deepgram] settings applied - injecting greeting');
            dgReady = true;
            sendToClient('connected', { state: 'GREETING' });
            // Inject greeting now that settings are applied
            dgWs.send(JSON.stringify({ type: 'InjectAgentMessage', message: GREETING }));
            // Flush buffered audio
            for (const chunk of audioBuffer) dgWs.send(chunk);
            audioBuffer.length = 0;
            break;
          case 'AgentStartedSpeaking':
            sendToClient('agent_state', { state: 'RESPONDING' });
            break;
          case 'AgentAudioDone':
            console.log('[deepgram] agent audio done - flushing to client');
            agentSpeaking = false;
            sendToClient('audio_out_done');
            sendToClient('agent_state', { state: 'SILENT_PRESENCE' });
            break;
          case 'AgentFinishedSpeaking':
            agentSpeaking = false;
            sendToClient('agent_state', { state: 'SILENT_PRESENCE' });
            sendToClient('audio_out_done');
            break;
          case 'UserStartedSpeaking':
            sendToClient('agent_state', { state: 'LISTENING' });
            break;
          case 'ConversationText':
            console.log('[conversation]', msg.role, ':', (msg.content || '').substring(0, 100));
            if (msg.role === 'user') {
              const lower = (msg.content || '').toLowerCase();
              if (SAFETY_KEYWORDS.some(kw => lower.includes(kw))) {
                dgWs.send(JSON.stringify({
                  type: 'InjectAgentMessage',
                  message: "I hear you, and I'm glad you said something. Please reach out to Samaritans on 116 123 — they're available any time.",
                }));
              }
            }
            break;
          case 'Error':
            console.error('[deepgram] error:', msg.description, '| code:', msg.code);
            break;
          default:
            console.log('[deepgram] unhandled msg type:', msg.type);
        }
      } catch (err) {
        console.error('[deepgram] message parse error:', err);
      }
    });

    dgWs.on('error', (err) => console.error('[deepgram] error:', err));
    dgWs.on('close', (code, reason) => {
      console.log('[deepgram] closed:', code, reason?.toString());
      if (!isEnded) endCall();
    });

    // Forward client audio to Deepgram
    clientWs.on('message', (data: Buffer, isBinary: boolean) => {
      if (!isBinary) {
        // JSON control message from client
        try {
          const msg = JSON.parse(data.toString());
          console.log('[client] msg:', msg.type);
          // Could handle client-side control messages here
        } catch {}
        return;
      }

      // Binary = raw PCM audio from client microphone
      if (dgReady && dgWs.readyState === WebSocket.OPEN) {
        dgWs.send(data);
      } else {
        audioBuffer.push(data as Buffer);
        if (audioBuffer.length > 500) audioBuffer.shift(); // cap buffer
      }
    });

    clientWs.on('close', () => {
      console.log('[client] disconnected');
      if (!isEnded) endCall();
    });

    clientWs.on('error', (err) => console.error('[client] error:', err));
  });
}
