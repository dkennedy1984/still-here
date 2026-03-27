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

    const session = await prisma.session.findUnique({ where: { id: call.sessionId } }).catch(() => null);
    const styleRaw = session?.presenceStyle?.toLowerCase().replace('_', '-') || 'quiet';
    const style = ['quiet','check-ins','talk'].includes(styleRaw) ? styleRaw : 'quiet';
    const systemPrompt = SYSTEM_PROMPTS[style] || SYSTEM_PROMPTS.quiet;

    const startTime = Date.now();
    let isEnded = false;
    let dgWs: WS | null = null;

    const sendToClient = (type: string, payload: Record<string, unknown> = {}) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ type, ...payload }));
      }
    };

    // Connection timeout
    const openTimeout = setTimeout(() => {
      console.error('[deepgram] TIMEOUT: WebSocket open never fired after 15s');
      sendToClient('error', { message: 'Voice agent connection timeout' });
      endCall();
    }, 15000);

    try {
      console.log('[deepgram] connecting directly via WebSocket...');
      dgWs = new WS('wss://agent.deepgram.com/v1/agent/converse', {
        headers: {
          'Authorization': 'Token ' + process.env.DEEPGRAM_API_KEY,
        },
      });

      dgWs.on('open', () => {
        console.log('[deepgram] WebSocket connected - sending SettingsConfiguration');
        clearTimeout(openTimeout);

        const config = {
          type: 'SettingsConfiguration',
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
            speak: { model: 'aura-athena-en' },
            greeting: GREETING,
          },
        };

        dgWs!.send(JSON.stringify(config));
        console.log('[deepgram] SettingsConfiguration sent');
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
          const msg = JSON.parse(data.toString()) as { type: string; role?: string; content?: string; message?: string };
          const msgType = msg.type;

          if (msgType !== 'Welcome') {
            console.log('[deepgram] message:', msgType, JSON.stringify(msg).substring(0, 200));
          }

          if (msgType === 'Welcome') {
            console.log('[deepgram] welcomed, session ready');
          } else if (msgType === 'SettingsApplied') {
            console.log('[deepgram] settings applied');
          } else if (msgType === 'AgentStartedSpeaking') {
            sendToClient('agent_state', { state: 'RESPONDING' });
          } else if (msgType === 'AgentFinishedSpeaking') {
            sendToClient('agent_state', { state: 'SILENT_PRESENCE' });
            sendToClient('audio_out_done');
          } else if (msgType === 'UserStartedSpeaking') {
            sendToClient('agent_state', { state: 'LISTENING' });
          } else if (msgType === 'ConversationText') {
            console.log('[conversation]', msg.role, ':', (msg.content || '').substring(0, 100));
            if (msg.role === 'user') {
              const lower = (msg.content || '').toLowerCase();
              if (SAFETY_KEYWORDS.some(kw => lower.includes(kw))) {
                dgWs?.send(JSON.stringify({
                  type: 'InjectAgentMessage',
                  message: "I hear you, and I'm glad you said something. Please reach out to Samaritans on 116 123, available any time.",
                }));
              }
            }
          }
        }
      });

      dgWs.on('error', (err) => {
        console.error('[deepgram] ws error:', err);
      });

      dgWs.on('close', (code, reason) => {
        console.log('[deepgram] ws closed:', code, reason.toString());
        if (!isEnded) endCall();
      });

    } catch (err) {
      clearTimeout(openTimeout);
      console.error('[deepgram] failed to connect:', err);
      clientWs.close(4003, 'agent_error');
      return;
    }

    clientWs.on('message', (raw: Buffer, isBinary: boolean) => {
      if (isBinary) {
        if (dgWs && dgWs.readyState === WS.OPEN && !isEnded) dgWs.send(raw);
        return;
      }
      try {
        const msg = JSON.parse(raw.toString());
        const type = msg.type || msg.event;
        if (type === 'hangup') { endCall(); }
        else if (type === 'style_change' || type === 'prefer_silence') {
          const newStyle = type === 'prefer_silence' ? 'quiet' : (msg.style || 'quiet');
          const newPrompt = SYSTEM_PROMPTS[newStyle] || SYSTEM_PROMPTS.quiet;
          if (dgWs && dgWs.readyState === WS.OPEN) {
            dgWs.send(JSON.stringify({ type: 'UpdateInstructions', instructions: newPrompt }));
          }
        } else if (type === 'ping') { sendToClient('pong'); }
      } catch {}
    });

    clientWs.on('close', () => { console.log('[ws] client disconnected'); endCall(); });
    clientWs.on('error', (err) => console.error('[ws] error:', err));

    async function endCall() {
      if (isEnded) return;
      isEnded = true;
      try { if (dgWs) dgWs.close(); } catch {}
      const duration = Math.floor((Date.now() - startTime) / 1000);
      if (!call) return;
      await prisma.call.update({ where: { id: call.id }, data: { endedAt: new Date(), durationSeconds: duration } }).catch(() => {});
      console.log('[ws] call ended, duration:', duration, 's');
    }
  });
}
