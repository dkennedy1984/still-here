import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { Server } from 'http';
import { createClient } from '@deepgram/sdk';
import { prisma } from '../lib/prisma';

const SAFETY_KEYWORDS = ['kill myself','end my life','want to die','suicide','self harm','hurt myself','not worth living',"can't go on"];

const SYSTEM_PROMPTS: Record<string, string> = {
  quiet: `You are a calm, quiet body-doubling companion for someone who may have ADHD. You are present but not intrusive. Speak only when spoken to. Maximum 2 sentences per response. Never ask what they are working on. Never mention productivity or focus. Never fill silence. Never use urgency or pressure. If asked for help starting a task, offer only 1-3 small next steps then ask if they want more or prefer silence. Respond in British English. Silence is success.`,
  'check-ins': `You are a calm, quiet body-doubling companion for someone who may have ADHD. You may occasionally offer a gentle check-in if there has been long silence. Maximum 2 sentences per response. Never ask what they are working on. Never mention productivity. Respond in British English.`,
  talk: `You are a warm, calm body-doubling companion for someone who may have ADHD. You are happy to chat when spoken to. Maximum 2 sentences per response. Never mention productivity or focus. Be warm but not effusive. Respond in British English.`,
};

const GREETING = "Hi. I'm here. You don't have to talk — we can just sit quietly.";

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', async (clientWs: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const ticket = url.searchParams.get('ticket');

    console.log('[ws] new connection');

    if (!ticket) { clientWs.close(4001, 'missing_ticket'); return; }

    const call = await prisma.call.findUnique({ where: { wsTicket: ticket } }).catch(() => null);
    if (!call) { clientWs.close(4002, 'invalid_ticket'); return; }

    // Get session for presence style
    const session = await prisma.session.findUnique({ where: { id: call.sessionId } }).catch(() => null);
    const style = (session?.presenceStyle?.toLowerCase().replace('_', '-') || 'quiet') as string;
    const systemPrompt = SYSTEM_PROMPTS[style] || SYSTEM_PROMPTS.quiet;

    const startTime = Date.now();
    let deepgramAgent: any = null;
    let isEnded = false;

    const deepgram = createClient(process.env.DEEPGRAM_API_KEY!);

    try {
      deepgramAgent = deepgram.agent();
    } catch (err) {
      console.error('[deepgram] failed to create agent:', err);
      clientWs.close(4003, 'agent_error');
      return;
    }

    const sendToClient = (event: string, payload: Record<string, unknown> = {}) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ type: event, ...payload }));
      }
    };

    deepgramAgent.on('open', () => {
      console.log('[deepgram] agent connected');

      // Configure the Voice Agent
      deepgramAgent.configure({
        type: 'SettingsConfiguration',
        audio: {
          input: {
            encoding: 'linear16',
            sample_rate: 16000,
          },
          output: {
            encoding: 'linear16',
            sample_rate: 16000,
            container: 'none',
          },
        },
        agent: {
          listen: {
            model: 'nova-2',
          },
          think: {
            provider: {
              type: 'open_ai',
            },
            model: 'gpt-4o-mini',
            instructions: systemPrompt,
          },
          speak: {
            model: 'aura-athena-en',
          },
          greeting: GREETING,
        },
      });

      sendToClient('connected', { state: 'GREETING' });
    });

    // Agent audio → client
    deepgramAgent.on('audio', (audio: Buffer) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        const b64 = Buffer.from(audio).toString('base64');
        sendToClient('audio_out', { data: b64, mimeType: 'audio/l16', sampleRate: 16000 });
      }
    });

    deepgramAgent.on('AgentStartedSpeaking', () => {
      console.log('[agent] started speaking');
      sendToClient('agent_state', { state: 'RESPONDING' });
    });

    deepgramAgent.on('AgentFinishedSpeaking', () => {
      console.log('[agent] finished speaking');
      sendToClient('agent_state', { state: 'SILENT_PRESENCE' });
      sendToClient('audio_out_done');
    });

    deepgramAgent.on('UserStartedSpeaking', () => {
      console.log('[agent] user speaking detected');
      sendToClient('agent_state', { state: 'LISTENING' });
    });

    deepgramAgent.on('ConversationText', (data: any) => {
      console.log('[agent] conversation:', data?.role, data?.content?.substring(0, 100));
      // Safety check on user input
      if (data?.role === 'user') {
        const lower = (data.content || '').toLowerCase();
        if (SAFETY_KEYWORDS.some(kw => lower.includes(kw))) {
          console.log('[safety] crisis keywords detected');
          // Inject safety response - deepgram will speak it
          deepgramAgent.send(JSON.stringify({
            type: 'InjectAgentMessage',
            message: "I hear you, and I'm glad you said something. Please reach out to Samaritans on 116 123 — they're available any time.",
          }));
        }
      }
    });

    deepgramAgent.on('error', (err: any) => {
      console.error('[deepgram] agent error:', err);
    });

    deepgramAgent.on('close', () => {
      console.log('[deepgram] agent closed');
      if (!isEnded) endCall();
    });

    // Client audio → Deepgram
    clientWs.on('message', (raw: Buffer, isBinary: boolean) => {
      try {
        if (isBinary) {
          // Raw PCM audio from browser - forward directly to Deepgram
          if (deepgramAgent && !isEnded) {
            deepgramAgent.send(raw);
          }
          return;
        }
        // JSON control messages
        const msg = JSON.parse(raw.toString());
        const type = msg.type || msg.event;

        if (type === 'hangup') {
          endCall();
        } else if (type === 'style_change' || type === 'prefer_silence') {
          const newStyle = type === 'prefer_silence' ? 'quiet' : (msg.style || 'quiet');
          const newPrompt = SYSTEM_PROMPTS[newStyle] || SYSTEM_PROMPTS.quiet;
          // Update agent instructions
          deepgramAgent?.send(JSON.stringify({
            type: 'UpdateInstructions',
            instructions: newPrompt,
          }));
        } else if (type === 'ping') {
          sendToClient('pong');
        }
      } catch (err) {
        // Ignore parse errors on binary frames
      }
    });

    clientWs.on('close', () => {
      console.log('[ws] client disconnected');
      endCall();
    });

    clientWs.on('error', (err) => {
      console.error('[ws] client error:', err);
    });

    async function endCall() {
      if (isEnded) return;
      isEnded = true;
      try {
        deepgramAgent?.close();
      } catch {}
      const duration = Math.floor((Date.now() - startTime) / 1000);
      await prisma.call.update({
        where: { id: call.id },
        data: { endedAt: new Date(), durationSeconds: duration },
      }).catch(() => {});
      console.log('[ws] call ended, duration:', duration, 's');
    }
  });
}
