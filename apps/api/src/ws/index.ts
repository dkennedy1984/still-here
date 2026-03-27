import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { Server } from 'http';
import { createClient } from '@deepgram/sdk';
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
    let deepgramAgent: any = null;

    const sendToClient = (type: string, payload: Record<string, unknown> = {}) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ type, ...payload }));
      }
    };

    try {
      const deepgram = createClient(process.env.DEEPGRAM_API_KEY!);
      console.log('[deepgram] creating agent...');
      deepgramAgent = deepgram.agent();
      console.log('[deepgram] agent created, typeof:', typeof deepgramAgent);
      console.log('[deepgram] agent keys:', Object.keys(deepgramAgent || {}).join(', '));
      console.log('[deepgram] waiting for open event...');

      // Connection timeout - if open never fires within 15 seconds, abort
      const openTimeout = setTimeout(() => {
        console.error('[deepgram] TIMEOUT: agent open event never fired after 15s');
        sendToClient('error', { message: 'Voice agent connection timeout' });
        endCall();
      }, 15000);

      deepgramAgent.on('open', () => {
        console.log('[deepgram] agent OPEN event fired - sending SettingsConfiguration');
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

        deepgramAgent.send(JSON.stringify(config));
        console.log('[deepgram] SettingsConfiguration sent');
        sendToClient('connected', { state: 'GREETING' });
      });

      deepgramAgent.on('audio', (audio: Buffer) => {
        console.log('[deepgram] audio chunk received, bytes:', audio?.length ?? 0);
        if (clientWs.readyState === WebSocket.OPEN && audio && audio.length > 0) {
          const b64 = Buffer.from(audio).toString('base64');
          sendToClient('audio_out', { data: b64, mimeType: 'audio/l16', sampleRate: 16000 });
        }
      });

      deepgramAgent.on('AgentStartedSpeaking', () => {
        console.log('[deepgram] AgentStartedSpeaking event');
        sendToClient('agent_state', { state: 'RESPONDING' });
      });

      deepgramAgent.on('AgentFinishedSpeaking', () => {
        console.log('[deepgram] AgentFinishedSpeaking event');
        sendToClient('agent_state', { state: 'SILENT_PRESENCE' });
        sendToClient('audio_out_done');
      });

      deepgramAgent.on('UserStartedSpeaking', () => {
        console.log('[deepgram] UserStartedSpeaking event');
        sendToClient('agent_state', { state: 'LISTENING' });
      });

      deepgramAgent.on('ConversationText', (data: any) => {
        console.log('[deepgram] ConversationText:', data?.role, ':', (data?.content || '').substring(0, 100));
        if (data?.role === 'user') {
          const lower = (data.content || '').toLowerCase();
          if (SAFETY_KEYWORDS.some(kw => lower.includes(kw))) {
            deepgramAgent?.send(JSON.stringify({
              type: 'InjectAgentMessage',
              message: "I hear you, and I'm glad you said something. Please reach out to Samaritans on 116 123, available any time.",
            }));
          }
        }
      });

      deepgramAgent.on('error', (err: any) => {
        console.error('[deepgram] error event:', JSON.stringify(err));
      });

      deepgramAgent.on('close', () => {
        console.log('[deepgram] close event fired');
        if (!isEnded) endCall();
      });

      // Log ALL events for debugging (wildcard listener)
      deepgramAgent.on('*', (event: string, data: any) => {
        if (!['audio'].includes(event)) {
          console.log('[deepgram] wildcard event:', event, data ? JSON.stringify(data).substring(0, 200) : '');
        }
      });

    } catch (err) {
      console.error('[deepgram] failed to create agent:', err);
      clientWs.close(4003, 'agent_error');
      return;
    }

    clientWs.on('message', (raw: Buffer, isBinary: boolean) => {
      if (isBinary) {
        if (deepgramAgent && !isEnded) deepgramAgent.send(raw);
        return;
      }
      try {
        const msg = JSON.parse(raw.toString());
        const type = msg.type || msg.event;
        if (type === 'hangup') { endCall(); }
        else if (type === 'style_change' || type === 'prefer_silence') {
          const newStyle = type === 'prefer_silence' ? 'quiet' : (msg.style || 'quiet');
          const newPrompt = SYSTEM_PROMPTS[newStyle] || SYSTEM_PROMPTS.quiet;
          deepgramAgent?.send(JSON.stringify({ type: 'UpdateInstructions', instructions: newPrompt }));
        } else if (type === 'ping') { sendToClient('pong'); }
      } catch {}
    });

    clientWs.on('close', () => { console.log('[ws] client disconnected'); endCall(); });
    clientWs.on('error', (err) => console.error('[ws] error:', err));

    async function endCall() {
      if (isEnded) return;
      isEnded = true;
      try { deepgramAgent?.finish(); } catch {}
      const duration = Math.floor((Date.now() - startTime) / 1000);
      if (!call) return;
      await prisma.call.update({ where: { id: call.id }, data: { endedAt: new Date(), durationSeconds: duration } }).catch(() => {});
      console.log('[ws] call ended, duration:', duration, 's');
    }
  });
}
