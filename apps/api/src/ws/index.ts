import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { Server } from 'http';
import { DeepgramClient } from '@deepgram/sdk';
import { prisma } from '../lib/prisma';

const SAFETY_KEYWORDS = ['kill myself','end my life','want to die','suicide','self harm','hurt myself','not worth living',"can't go on"];

const SYSTEM_PROMPTS: Record<string, string> = {
  quiet: `You are a calm, quiet presence — a companion who sits with people when they need company. You are warm but unobtrusive. Speak only when spoken to. Maximum 2 sentences per response. Never ask what they are working on. Never mention productivity, focus, ADHD, or neurodivergence unless the user specifically brings it up. Never fill silence. Never use urgency or pressure. Respond in British English. Silence is success.`,
  'check-ins': `You are a calm, warm presence who sits with people when they need company. You may offer a gentle check-in after long silence. Maximum 2 sentences. Never ask what they are working on. Never mention productivity, ADHD, or neurodivergence unless the user brings it up. Respond in British English.`,
  talk: `You are a warm, calm companion. Happy to chat when spoken to. Maximum 2 sentences. Never mention productivity, ADHD, or neurodivergence unless the user brings it up. Be warm but not effusive. Respond in British English.`,
};

const GREETING = "Hi. I'm here. You don't have to talk — we can just sit quietly.";

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', async (clientWs: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const ticket = url.searchParams.get('ticket');
    console.log('[ws] new connection, ticket:', ticket?.substring(0, 20));

    if (!ticket) { clientWs.close(4001, 'missing_ticket'); return; }

    const call = await prisma.call.findUnique({ where: { wsTicket: ticket } }).catch(() => null);
    if (!call) { clientWs.close(4002, 'invalid_ticket'); return; }

    const mode = call.presenceStyle ?? 'quiet';
    const systemPrompt = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.quiet;

    const sendToClient = (type: string, payload: object) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ type, ...payload }));
      }
    };

    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      console.error('[deepgram] DEEPGRAM_API_KEY is not set');
      clientWs.close(4005, 'missing_api_key');
      return;
    }

    let dgSocket: Awaited<ReturnType<InstanceType<typeof DeepgramClient>['agent']['v1']['connect']>> | null = null;

    try {
      const deepgram = new DeepgramClient({ apiKey });

      console.log('[deepgram] connecting via SDK v5...');
      dgSocket = await deepgram.agent.v1.connect({
        Authorization: `Token ${apiKey}`,
      });

      dgSocket.on('open', () => {
        console.log('[deepgram] WebSocket open — sending settings');

        dgSocket!.sendSettings({
          audio: {
            input: { encoding: 'linear16', sample_rate: 16000 },
            output: { encoding: 'linear16', sample_rate: 16000, container: 'none' },
          },
          agent: {
            listen: {
              provider: {
                type: 'deepgram',
                model: 'nova-2',
              },
            },
            think: {
              provider: {
                type: 'open_ai',
                model: 'gpt-4o-mini',
              },
              prompt: systemPrompt,
            },
            speak: {
              provider: {
                type: 'deepgram',
                model: 'aura-athena-en',
              },
            },
          },
        } as any);

        console.log('[deepgram] settings sent');
        sendToClient('connected', { state: 'GREETING' });
      });

      dgSocket.on('message', (msg) => {
        // Binary audio frames come through as Buffer/Uint8Array
        if (msg instanceof Buffer || msg instanceof Uint8Array) {
          const buf = Buffer.from(msg);
          console.log('[deepgram] audio chunk received, bytes:', buf.length);
          if (clientWs.readyState === WebSocket.OPEN && buf.length > 0) {
            const b64 = buf.toString('base64');
            sendToClient('audio_out', { data: b64, mimeType: 'audio/l16', sampleRate: 16000 });
          }
          return;
        }

        // Typed JSON messages
        const data = msg as any;
        const msgType: string = typeof data === 'string' ? JSON.parse(data).type : data?.type ?? '';
        const payload = typeof data === 'string' ? JSON.parse(data) : data;

        console.log('[deepgram] message:', msgType, JSON.stringify(payload));

        if (msgType === 'Welcome') {
          console.log('[deepgram] session welcomed');
        } else if (msgType === 'SettingsApplied') {
          console.log('[deepgram] settings applied — injecting greeting');
          setTimeout(() => {
            if (dgSocket) {
              dgSocket.sendInjectAgentMessage({ message: GREETING } as any);
              console.log('[deepgram] greeting injected');
            }
          }, 500);
        } else if (msgType === 'ConversationText') {
          const role = payload.role;
          const content = payload.content;
          if (role === 'user') {
            console.log('[deepgram] user said:', content);
            const lower = (content || '').toLowerCase();
            if (SAFETY_KEYWORDS.some(kw => lower.includes(kw))) {
              console.log('[deepgram] SAFETY keyword detected');
              sendToClient('safety_alert', { message: content });
            }
          } else if (role === 'assistant') {
            console.log('[deepgram] assistant said:', content);
          }
        } else if (msgType === 'UserStartedSpeaking') {
          sendToClient('user_speaking', {});
        } else if (msgType === 'AgentStartedSpeaking') {
          sendToClient('agent_speaking', {});
        } else if (msgType === 'AgentAudioDone') {
          sendToClient('agent_done', {});
        } else if (msgType === 'Error') {
          console.error('[deepgram] error message:', JSON.stringify(payload));
          sendToClient('error', { message: JSON.stringify(payload) });
        }
      });

      dgSocket.on('error', (err: Error) => {
        console.error('[deepgram] socket error:', err.message);
        sendToClient('error', { message: err.message });
      });

      dgSocket.on('close', (event: any) => {
        console.log('[deepgram] socket closed:', event?.code, event?.reason);
        sendToClient('disconnected', { code: event?.code });
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.close();
        }
      });

    } catch (err: any) {
      console.error('[deepgram] failed to connect:', err.message);
      clientWs.close(4003, 'deepgram_connect_failed');
      return;
    }

    clientWs.on('message', (data: Buffer, isBinary: boolean) => {
      if (isBinary) {
        // Forward raw PCM audio from client to Deepgram
        if (dgSocket) {
          (dgSocket as any).sendBinary(data as any);
        }
      } else {
        // Control messages from client
        try {
          const msg = JSON.parse(data.toString()) as { type: string };
          console.log('[client] message:', msg.type);
          if (msg.type === 'disconnect') {
            clientWs.close();
          }
        } catch {
          // ignore unparseable client messages
        }
      }
    });

    clientWs.on('close', () => {
      console.log('[ws] client disconnected');
      if (dgSocket) {
        dgSocket.socket.close();
      }
    });

    clientWs.on('error', (err) => {
      console.error('[ws] client error:', err.message);
    });
  });
}
