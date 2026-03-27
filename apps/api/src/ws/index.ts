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

    let call: { id: string; sessionId: string; presenceStyle?: string } | null = null;
    try {
      call = await prisma.call.findUnique({ where: { wsTicket: ticket } });
      if (!call) {
        console.warn('[ws] invalid or expired ticket');
        clientWs.close(4002, 'invalid_ticket');
        return;
      }
      await prisma.call.update({ where: { id: call.id }, data: { wsTicket: call.id } });






    } catch (err: any) {
      console.error('[ws] ticket validation error:', err.message);
      clientWs.close(4000, 'internal_error');
      return;
    }

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

    // SDK v5: DefaultDeepgramClient is now called DeepgramClient (Fern-generated)
    // Access pattern: deepgram.agent.v1.connect({ Authorization: 'Token KEY' }) → V1Socket
    const deepgram = new DeepgramClient({ apiKey });
    console.log('[deepgram] DeepgramClient created');
    console.log('[deepgram] agent methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(deepgram.agent)));
    console.log('[deepgram] agent.v1 methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(deepgram.agent.v1)));

    let dgSocket: Awaited<ReturnType<InstanceType<typeof DeepgramClient>['agent']['v1']['connect']>> | null = null;

    try {
      console.log('[deepgram] calling agent.v1.connect()...');
      dgSocket = await deepgram.agent.v1.connect({
        Authorization: `Token ${apiKey}`,
      });

      console.log('[deepgram] V1Socket created');
      console.log('[deepgram] socket methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(dgSocket)));

      dgSocket.on('open', () => {
        console.log('[deepgram] WebSocket open — sending settings (SDK v5 sendSettings)');

        // AgentV1Settings shape (SDK v5, verified from source):
        //   type: "Settings"  ← REQUIRED
        //   audio: { input: { encoding, sample_rate }, output: { encoding, sample_rate, container } }
        //   agent: {
        //     listen: { provider: { type: "deepgram", model?, version? } }
        //     think: { provider: { type: "open_ai", model }, prompt? }
        //     speak: { provider: { type: "deepgram", model } }
        //   }
        const settings = {
          type: 'Settings' as const,
          audio: {
            input: { encoding: 'linear16' as const, sample_rate: 16000 },
            output: { encoding: 'linear16' as const, sample_rate: 16000, container: 'none' as const },
          },
          agent: {
            listen: {
              provider: {
                type: 'deepgram' as const,
                model: 'nova-2',
              },
            },
            think: {
              provider: {
                type: 'open_ai' as const,
                model: 'gpt-4o-mini',
              },
              prompt: systemPrompt,
            },
            speak: {
              provider: {
                type: 'deepgram' as const,
                model: 'aura-athena-en',
              },
            },
          },
        };

        console.log('[deepgram] sendSettings payload type:', settings.type);
        dgSocket!.sendSettings(settings as any);
        console.log('[deepgram] settings sent');
        sendToClient('connected', { state: 'GREETING' });
      });

      dgSocket.on('message', (msg) => {
        // In SDK v5, the message event receives PARSED JSON objects (fromJson is called internally).
        // Binary audio frames DO NOT come through this event — they come through the underlying socket.
        // All messages here are typed JSON objects from Deepgram.
        const data = msg as any;
        const msgType: string = data?.type ?? (typeof data === 'string' ? JSON.parse(data)?.type : '');
        console.log('[deepgram] message event type:', msgType, '| raw:', JSON.stringify(data)?.substring(0, 200));

        if (msgType === 'Welcome') {
          console.log('[deepgram] session welcomed — agent is ready');
        } else if (msgType === 'SettingsApplied') {
          console.log('[deepgram] settings applied — injecting greeting after 500ms');
          setTimeout(() => {
            if (dgSocket) {
              // AgentV1InjectAgentMessage requires { type: "InjectAgentMessage", message: string }
              dgSocket.sendInjectAgentMessage({ type: 'InjectAgentMessage', message: GREETING });
              console.log('[deepgram] greeting injected:', GREETING);
            }
          }, 500);
        } else if (msgType === 'ConversationText') {
          const role = data?.role;
          const content = data?.content;
          if (role === 'user') {
            console.log('[deepgram] user said:', content);
            const lower = (content || '').toLowerCase();
            if (SAFETY_KEYWORDS.some(kw => lower.includes(kw))) {
              console.warn('[deepgram] SAFETY keyword detected in user speech');
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
          console.error('[deepgram] error message:', JSON.stringify(data));
          sendToClient('error', { message: JSON.stringify(data) });
        } else {
          console.log('[deepgram] unhandled message type:', msgType);
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

      // Also listen on the underlying WebSocket for binary audio frames.
      // SDK v5 routes JSON messages through dgSocket.on('message'), but raw binary
      // audio from the agent (TTS output) may come through the underlying socket.
      const underlyingSocket = (dgSocket as any).socket;
      if (underlyingSocket) {
        console.log('[deepgram] attaching binary audio listener to underlying socket');
        underlyingSocket.addEventListener('message', (event: any) => {
          const raw = event.data;
          if (raw instanceof ArrayBuffer || Buffer.isBuffer(raw) || raw instanceof Uint8Array) {
            const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw instanceof ArrayBuffer ? new Uint8Array(raw) : raw);
            console.log('[deepgram] binary audio chunk received, bytes:', buf.length);
            if (clientWs.readyState === WebSocket.OPEN && buf.length > 0) {
              const b64 = buf.toString('base64');
              sendToClient('audio_out', { data: b64, mimeType: 'audio/l16', sampleRate: 16000 });
            }
          }
        });
      } else {
        console.warn('[deepgram] no underlying socket found for binary audio — audio output may not work');
      }

    } catch (err: any) {
      console.error('[deepgram] failed to connect:', err.message);
      clientWs.close(4003, 'deepgram_connect_failed');
      return;
    }

    clientWs.on('message', (data: Buffer, isBinary: boolean) => {
      if (isBinary) {
        // Forward raw PCM audio from client → Deepgram using sendMedia (proper SDK v5 API)
        if (dgSocket) {
          console.log('[client] binary audio received, bytes:', (data as Buffer).length, '— forwarding via sendMedia');
          dgSocket.sendMedia(data as unknown as ArrayBufferView);
        }
      } else {
        // Control messages from client
        try {
          const msg = JSON.parse(data.toString()) as { type: string };
          console.log('[client] message:', msg.type);
          if (msg.type === 'disconnect') {
            clientWs.close(1000, 'client_disconnect');
          }
        } catch {
          console.warn('[client] failed to parse message');
        }
      }
    });

    clientWs.on('close', (code, reason) => {
      console.log('[ws] client disconnected:', code, reason.toString());
      if (dgSocket) {
        try { dgSocket.close(); } catch {}
        dgSocket = null;
      }
    });

    clientWs.on('error', (err) => {
      console.error('[ws] client error:', err.message);
    });
  });
}
