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

    const call = await prisma.call.findUnique({ where: { wsTicket: ticket } }).catch(() => null);
    if (!call) { clientWs.close(4002, 'invalid_ticket'); return; }

    const session = await prisma.session.findUnique({ where: { id: call.sessionId } }).catch(() => null);
    const styleRaw = session?.presenceStyle?.toLowerCase().replace('_', '-') || 'quiet';
    const style = ['quiet','check-ins','talk'].includes(styleRaw) ? styleRaw : 'quiet';
    const systemPrompt = SYSTEM_PROMPTS[style] || SYSTEM_PROMPTS.quiet;

    console.log('[ws] connected, style:', style);

    const startTime = Date.now();
    let isEnded = false;
    let dgReady = false;
    const audioBuffer: Buffer[] = [];

    const sendToClient = (type: string, payload: Record<string, unknown> = {}) => {
      if (clientWs.readyState === WS.OPEN) {
        clientWs.send(JSON.stringify({ type, ...payload }));
      }
    };

    // Direct WebSocket to Deepgram - bypasses SDK entirely
    const dgWs = new WebSocket(DG_URL, {
      headers: { 'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}` },
    });

    dgWs.on('open', () => {
      console.log('[deepgram] connected - sending Settings');

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
            provider: { type: 'open_ai' },
            model: 'gpt-4o-mini',
            instructions: systemPrompt,
          },
          speak: {
            provider: { type: 'deepgram', model: 'aura-athena-en' },
          },
        },
      };

      dgWs.send(JSON.stringify(settings));
      console.log('[deepgram] Settings sent');
    });

    dgWs.on('message', (data: Buffer, isBinary: boolean) => {
      if (isBinary) {
        // Raw PCM audio from Deepgram - forward to client
        const b64 = data.toString('base64');
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
          case 'AgentFinishedSpeaking':
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
    clientWs.on('message', (raw: Buffer, isBinary: boolean) => {
      if (isBinary) {
        if (dgReady && dgWs.readyState === WebSocket.OPEN) {
          dgWs.send(raw);
        } else {
          audioBuffer.push(Buffer.from(raw));
        }
        return;
      }
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'hangup') endCall();
        else if (msg.type === 'ping') sendToClient('pong');
        else if (msg.type === 'style_change' || msg.type === 'prefer_silence') {
          const newStyle = msg.type === 'prefer_silence' ? 'quiet' : (msg.style || 'quiet');
          const newPrompt = SYSTEM_PROMPTS[newStyle] || SYSTEM_PROMPTS.quiet;
          if (dgReady && dgWs.readyState === WebSocket.OPEN) {
            dgWs.send(JSON.stringify({ type: 'UpdateInstructions', instructions: newPrompt }));
          }
        }
      } catch {}
    });

    clientWs.on('close', () => endCall());
    clientWs.on('error', (err) => console.error('[ws] client error:', err));

    async function endCall() {
      if (isEnded) return;
      isEnded = true;
      try { dgWs.close(); } catch {}
      const duration = Math.floor((Date.now() - startTime) / 1000);
      await prisma.call.update({
        where: { id: call!.id },
        data: { endedAt: new Date(), durationSeconds: duration },
      }).catch(() => {});
      console.log('[ws] call ended, duration:', duration, 's');
    }
  });
}
