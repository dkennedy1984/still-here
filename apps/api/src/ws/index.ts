import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { Server } from 'http';
import WS from 'ws';
import { prisma } from '../lib/prisma';

const SAFETY_KEYWORDS = ['kill myself','end my life','want to die','suicide','self harm','hurt myself','not worth living',"can't go on"];

const SYSTEM_PROMPTS: Record<string, string> = {
  quiet: `You are a calm, quiet body-doubling companion for someone who may have ADHD. You are present but not intrusive. Speak only when spoken to. Maximum 2 sentences per response. Never ask what they are working on. Never mention productivity or focus. Never fill silence. Never use urgency or pressure. Respond in British English. Silence is success.`,
  'check-ins': `You are a calm, quiet body-doubling companion for someone who may have ADHD. You may occasionally offer a gentle check-in after long silence. Maximum 2 sentences. Never ask what they are working on. Never mention productivity. Respond in British English.`,
  talk: `You are a warm, calm body-doubling companion for someone who may have ADHD. Happy to chat when spoken to. Maximum 2 sentences. Never mention productivity. Be warm but not effusive. Respond in British English.`,
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

    const mode = (call.presenceStyle as string) || 'quiet';
    const systemPrompt = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.quiet;

    const sendToClient = (type: string, payload: object) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ type, ...payload }));
      }
    };

    let dgWs: WS | null = null;

    const openTimeout = setTimeout(() => {
      console.log('[deepgram] connection timeout');
      clientWs.close(4003, 'deepgram_timeout');
    }, 10000);

    dgWs = new WS('wss://agent.deepgram.com/v1/agent', {
      headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}` },
    });

    dgWs.on('open', () => {
      console.log('[deepgram] WebSocket connected - sending Settings');
      clearTimeout(openTimeout);

      // Correct Deepgram Voice Agent Settings format (type: "Settings", not "SettingsConfiguration")
      // listen.provider.model goes inside provider object
      // think.provider contains type+model; instructions at think level
      // No greeting field - send InjectAgentMessage separately after SettingsApplied
      const config = {
        type: 'Settings',
        audio: {
          input: { encoding: 'linear16', sample_rate: 16000 },
          output: { encoding: 'linear16', sample_rate: 16000, container: 'none' },
        },
        agent: {
          listen: {
            provider: { type: 'deepgram', model: 'nova-2' },
          },
          think: {
            provider: { type: 'open_ai', model: 'gpt-4o-mini' },
            instructions: systemPrompt,
          },
          speak: {
            provider: { type: 'deepgram', model: 'aura-athena-en' },
          },
        },
        context: {
          messages: [],
          replay: false,
        },
      };

      dgWs!.send(JSON.stringify(config));
      console.log('[deepgram] Settings sent:', JSON.stringify(config));
      sendToClient('connected', { state: 'GREETING' });
    });

    dgWs.on('message', (data: Buffer, isBinary: boolean) => {
      if (isBinary) {
        // Raw PCM audio — forward to client
        console.log('[deepgram] audio chunk received, bytes:', data?.length ?? 0);
        if (clientWs.readyState === WebSocket.OPEN && data && data.length > 0) {
          const b64 = Buffer.from(data).toString('base64');
          sendToClient('audio_out', { data: b64, mimeType: 'audio/l16', sampleRate: 16000 });
        }
      } else {
        // Log ALL non-audio messages in full for debugging
        const rawStr = data.toString();
        let msg: { type: string; role?: string; content?: string; message?: string };
        try {
          msg = JSON.parse(rawStr) as { type: string; role?: string; content?: string; message?: string };
        } catch (e) {
          console.log('[deepgram] unparseable message:', rawStr);
          return;
        }
        const msgType = msg.type;

        // Log every non-audio message in full
        console.log('[deepgram] message type:', msgType, '| full payload:', rawStr);

        if (msgType === 'Welcome') {
          console.log('[deepgram] welcomed, session ready');
        } else if (msgType === 'SettingsApplied') {
          console.log('[deepgram] SettingsApplied — injecting greeting');
          // Send greeting as InjectAgentMessage after settings are confirmed applied
          setTimeout(() => {
            if (dgWs && dgWs.readyState === WS.OPEN) {
              const greetingMsg = JSON.stringify({ type: 'InjectAgentMessage', message: GREETING });
              dgWs.send(greetingMsg);
              console.log('[deepgram] InjectAgentMessage sent:', greetingMsg);
            }
          }, 500);
        } else if (msgType === 'ConversationText') {
          const role = msg.role;
          const content = msg.content;
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
          console.error('[deepgram] Error message:', rawStr);
          sendToClient('error', { message: rawStr });
        }
      }
    });

    dgWs.on('error', (err) => {
      console.error('[deepgram] WebSocket error:', err.message);
      sendToClient('error', { message: err.message });
    });

    dgWs.on('close', (code, reason) => {
      console.log('[deepgram] WebSocket closed:', code, reason?.toString());
      sendToClient('disconnected', { code });
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close();
      }
    });

    clientWs.on('message', (data: Buffer, isBinary: boolean) => {
      if (isBinary) {
        // Forward raw PCM audio from client to Deepgram
        if (dgWs && dgWs.readyState === WS.OPEN) {
          dgWs.send(data);
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
      if (dgWs && dgWs.readyState === WS.OPEN) {
        dgWs.close();
      }
    });

    clientWs.on('error', (err) => {
      console.error('[ws] client error:', err.message);
    });
  });
}
