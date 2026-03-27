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

    let sessionId: string | null = null;
    let sessionMode = 'quiet';
    let systemPrompt: string = SYSTEM_PROMPTS.quiet;

    try {
      const call = await prisma.call.findUnique({
        where: { wsTicket: ticket },
        include: { session: true },
      });

      if (!call) {
        console.warn('[ws] invalid or expired ticket');
        clientWs.close(4002, 'invalid_ticket');
        return;
      }

      sessionId = call.session.id;
      sessionMode = call.presenceStyle || 'quiet';
      systemPrompt = SYSTEM_PROMPTS[sessionMode] ?? SYSTEM_PROMPTS.quiet;
      console.log('[ws] session validated, mode:', sessionMode);
    } catch (err: any) {
      console.error('[ws] session lookup error:', err.message);
      clientWs.close(4004, 'session_error');
      return;
    }

    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      console.error('[ws] DEEPGRAM_API_KEY not set');
      clientWs.close(4005, 'missing_api_key');
      return;
    }

    // Access pattern: deepgram.agent.v1.connect() → V1Socket
    const deepgram = new DeepgramClient({ apiKey });
    console.log('[deepgram] DeepgramClient created');

    // --- Audio buffering: incoming client audio is buffered until the underlying
    //     WebSocket is confirmed open and Settings have been sent. ---
    let socketReady = false;
    const audioBuffer: Buffer[] = [];
    let dgSocket: any;

    const sendToClient = (type: string, payload: Record<string, unknown> = {}) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ type, ...payload }));
      }
    };

    // Called once the underlying WebSocket connection is confirmed open.
    // Guards against being called twice (race between ws.on('open') and readyState check).
    function onSocketOpen() {
      if (socketReady) return;
      socketReady = true;
      console.log('[deepgram] socket open — sending Settings');

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

      const underlyingWs = (dgSocket as any).socket as WebSocket;
      underlyingWs.send(JSON.stringify(settings));
      console.log('[deepgram] Settings sent');

      // Inject greeting after a short delay to give the agent time to apply settings
      setTimeout(() => {
        const ws2 = (dgSocket as any).socket as WebSocket;
        if (ws2?.readyState === WebSocket.OPEN) {
          ws2.send(JSON.stringify({
            type: 'InjectAgentMessage',
            message: GREETING,
          }));
          console.log('[deepgram] greeting injected');
        }
      }, 500);

      sendToClient('connected', { state: 'GREETING' });

      // Flush buffered audio
      console.log('[deepgram] flushing', audioBuffer.length, 'buffered audio chunks');
      const ws3 = (dgSocket as any).socket as WebSocket;
      for (const chunk of audioBuffer) {
        if (ws3?.readyState === WebSocket.OPEN) {
          ws3.send(chunk);
        }
      }
      audioBuffer.length = 0;
    }

    try {
      console.log('[deepgram] calling agent.v1.connect()...');
      dgSocket = deepgram.agent.v1.connect({} as any);
      console.log('[deepgram] V1Socket created');
      console.log('[deepgram] socket instance props:', Object.getOwnPropertyNames(dgSocket));
      console.log('[deepgram] socket methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(dgSocket)));

      // ----------------------------------------------------------------
      // FIX: The SDK's own EventEmitter-based 'open' event never fires
      // because the internal WebSocket is set up synchronously but the
      // SDK wrapper does not reliably re-emit the 'open' event to callers.
      //
      // Strategy: poll for (dgSocket as any).socket (the raw ws.WebSocket)
      // and attach our own listeners directly to it. This bypasses the SDK
      // event system entirely and hooks into the raw transport.
      // ----------------------------------------------------------------
      const attachUnderlying = setInterval(() => {
        const ws = (dgSocket as any).socket as WebSocket | undefined;
        if (!ws) return;

        // Found the underlying socket — stop polling
        clearInterval(attachUnderlying);
        console.log('[deepgram] underlying WebSocket found, readyState:', ws.readyState);

        // Handle messages (binary audio frames + JSON control messages)
        ws.on('message', (data: Buffer, isBinary: boolean) => {
          if (isBinary) {
            // Binary frames are raw L16 PCM audio from the agent
            const b64 = data.toString('base64');
            sendToClient('audio_out', { data: b64, mimeType: 'audio/l16', sampleRate: 16000 });
          } else {
            try {
              const msg = JSON.parse(data.toString());
              const msgType: string = msg.type;
              console.log('[deepgram] msg:', msgType);

              if (msgType === 'Welcome') {
                console.log('[deepgram] welcomed by server');
              } else if (msgType === 'SettingsApplied') {
                console.log('[deepgram] settings applied');
              } else if (msgType === 'AgentStartedSpeaking') {
                sendToClient('agent_state', { state: 'RESPONDING' });
                sendToClient('agent_speaking', {});
              } else if (msgType === 'AgentFinishedSpeaking' || msgType === 'AgentAudioDone') {
                sendToClient('agent_state', { state: 'SILENT_PRESENCE' });
                sendToClient('audio_out_done', {});
                sendToClient('agent_done', {});
              } else if (msgType === 'UserStartedSpeaking') {
                sendToClient('agent_state', { state: 'LISTENING' });
                sendToClient('user_speaking', {});
              } else if (msgType === 'ConversationText') {
                const role: string = msg.role;
                const content: string = msg.content || '';
                console.log('[conversation]', role, ':', content.substring(0, 100));
                if (role === 'user') {
                  const lower = content.toLowerCase();
                  if (SAFETY_KEYWORDS.some(kw => lower.includes(kw))) {
                    console.warn('[deepgram] SAFETY keyword detected in user speech');
                    sendToClient('safety_alert', { message: content });
                  }
                }
              } else if (msgType === 'Error') {
                console.error('[deepgram] error:', msg.description || JSON.stringify(msg));
                sendToClient('error', { message: msg.description || JSON.stringify(msg) });
              } else {
                console.log('[deepgram] unhandled msg type:', msgType);
              }
            } catch (e) {
              console.warn('[deepgram] failed to parse message:', e);
            }
          }
        });

        // Attach open handler
        ws.on('open', () => {
          console.log('[deepgram] underlying socket open (via ws.on open)');
          onSocketOpen();
        });

        // Handle already-open case (poll won the race against the open event)
        if (ws.readyState === WebSocket.OPEN) {
          console.log('[deepgram] underlying socket already open at attach time');
          onSocketOpen();
        }

        // Close handler
        ws.on('close', (code: number, reason: Buffer) => {
          console.log('[deepgram] underlying socket closed:', code, reason.toString());
          sendToClient('disconnected', { code });
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.close();
          }
        });

        // Error handler
        ws.on('error', (err: Error) => {
          console.error('[deepgram] underlying socket error:', err.message);
          sendToClient('error', { message: err.message });
        });
      }, 50);

      // Safety: clear the interval and close if the underlying socket never appears
      setTimeout(() => {
        clearInterval(attachUnderlying);
        if (!socketReady) {
          console.error('[deepgram] underlying socket never appeared after 10s');
          sendToClient('error', { message: 'Deepgram socket failed to initialise' });
          clientWs.close(1011, 'deepgram_timeout');
        }
      }, 10000);

      // ----------------------------------------------------------------
      // Handle messages from the browser client
      // ----------------------------------------------------------------
      clientWs.on('message', (data: Buffer, isBinary: boolean) => {
        if (isBinary) {
          // Raw PCM audio from the client microphone — forward to Deepgram
          if (socketReady) {
            const ws = (dgSocket as any).socket as WebSocket;
            if (ws?.readyState === WebSocket.OPEN) {
              ws.send(data);
            }
          } else {
            console.log('[client] binary audio received before socket ready, bytes:', data.length, '— buffering');
            audioBuffer.push(data);
          }
          return;
        }

        // JSON control messages from the client
        try {
          const msg = JSON.parse(data.toString()) as { type: string; data?: string };
          console.log('[client] message:', msg.type);

          if (msg.type === 'audio_chunk' && msg.data) {
            // Base64-encoded audio from the browser
            const chunk = Buffer.from(msg.data, 'base64');
            if (socketReady) {
              const ws = (dgSocket as any).socket as WebSocket;
              if (ws?.readyState === WebSocket.OPEN) {
                ws.send(chunk);
              }
            } else {
              audioBuffer.push(chunk);
            }
          } else if (msg.type === 'disconnect') {
            clientWs.close(1000, 'client_disconnect');
          } else {
            console.log('[client] unhandled msg type:', msg.type);
          }
        } catch {
          console.warn('[client] failed to parse message');
        }
      });

      clientWs.on('close', (code: number, reason: Buffer) => {
        console.log('[ws] client disconnected:', code, reason.toString());
        clearInterval(attachUnderlying);
        const ws = (dgSocket as any).socket as WebSocket | undefined;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
        audioBuffer.length = 0;
      });

      clientWs.on('error', (err: Error) => {
        console.error('[ws] client error:', err.message);
      });

    } catch (err: any) {
      console.error('[deepgram] failed to connect:', err.message);
      clientWs.close(4003, 'deepgram_connect_failed');
      return;
    }
  });
}
