import { WebSocket as WS, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { Server } from 'http';
import { createClient } from '@deepgram/sdk';
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
    let rawWs: WS | null = null;
    const audioBuffer: Buffer[] = [];

    const sendToClient = (type: string, payload: Record<string, unknown> = {}) => {
      if (clientWs.readyState === WS.OPEN) {
        clientWs.send(JSON.stringify({ type, ...payload }));
      }
    };

    try {
      const deepgram = createClient(process.env.DEEPGRAM_API_KEY!);

      // agent.v1.connect() returns a Promise — must be awaited to get the actual socket
      const dgSocket = await (deepgram.agent.v1 as any).connect();
      rawWs = (dgSocket as any).socket as WS;

      if (!rawWs) {
        console.error('[deepgram] no underlying socket after await');
        clientWs.close(4003, 'no_socket');
        return;
      }

      console.log('[deepgram] got socket, readyState:', rawWs.readyState);

      const onDgOpen = () => {
        console.log('[deepgram] socket open - sending Settings');
        dgReady = true;

        const settings = {
          type: 'Settings',
          audio: {
            input: { encoding: 'linear16', sample_rate: 16000 },
            output: { encoding: 'linear16', sample_rate: 16000, container: 'none' },
          },
          agent: {
            listen: { provider: { type: 'deepgram', model: 'nova-2', language: 'en-GB' } },
            think: {
              provider: { type: 'open_ai' },
              model: 'gpt-4o-mini',
              instructions: systemPrompt,
            },
            speak: { provider: { type: 'deepgram', model: 'aura-athena-en' } },
          },
        };

        rawWs!.send(JSON.stringify(settings));
        console.log('[deepgram] Settings sent');

        setTimeout(() => {
          if (rawWs && rawWs.readyState === WS.OPEN) {
            rawWs.send(JSON.stringify({ type: 'InjectAgentMessage', message: GREETING }));
            console.log('[deepgram] greeting injected');
          }
        }, 800);

        sendToClient('connected', { state: 'GREETING' });

        // flush buffered audio
        for (const chunk of audioBuffer) rawWs!.send(chunk);
        audioBuffer.length = 0;
      };

      rawWs.on('open', onDgOpen);
      if (rawWs.readyState === WS.OPEN) onDgOpen(); // already open

      rawWs.on('message', (data: Buffer, isBinary: boolean) => {
        if (isBinary) {
          const b64 = data.toString('base64');
          sendToClient('audio_out', { data: b64, mimeType: 'audio/l16', sampleRate: 16000 });
        } else {
          try {
            const msg = JSON.parse(data.toString());
            console.log('[deepgram] msg:', msg.type);
            if (msg.type === 'SettingsApplied') console.log('[deepgram] settings applied');
            if (msg.type === 'AgentStartedSpeaking') sendToClient('agent_state', { state: 'RESPONDING' });
            if (msg.type === 'AgentFinishedSpeaking') {
              sendToClient('agent_state', { state: 'SILENT_PRESENCE' });
              sendToClient('audio_out_done');
            }
            if (msg.type === 'UserStartedSpeaking') sendToClient('agent_state', { state: 'LISTENING' });
            if (msg.type === 'ConversationText') {
              console.log('[conversation]', msg.role, ':', (msg.content || '').substring(0, 100));
              if (msg.role === 'user') {
                const lower = (msg.content || '').toLowerCase();
                if (SAFETY_KEYWORDS.some(kw => lower.includes(kw))) {
                  rawWs!.send(JSON.stringify({
                    type: 'InjectAgentMessage',
                    message: "I hear you, and I'm glad you said something. Please reach out to Samaritans on 116 123 — they're available any time.",
                  }));
                }
              }
            }
            if (msg.type === 'Error') console.error('[deepgram] error:', msg.description);
          } catch {}
        }
      });

      rawWs.on('error', (err) => console.error('[deepgram] ws error:', err));
      rawWs.on('close', (code, reason) => {
        console.log('[deepgram] ws closed:', code, reason?.toString());
        if (!isEnded) endCall();
      });

    } catch (err) {
      console.error('[deepgram] failed to connect:', err);
      clientWs.close(4003, 'deepgram_error');
      return;
    }

    clientWs.on('message', (raw: Buffer, isBinary: boolean) => {
      if (isBinary) {
        if (dgReady && rawWs) {
          rawWs.send(raw);
        } else {
          audioBuffer.push(Buffer.from(raw));
        }
        return;
      }
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'hangup') endCall();
        else if (msg.type === 'ping') sendToClient('pong');
      } catch {}
    });

    clientWs.on('close', () => endCall());
    clientWs.on('error', (err) => console.error('[ws] client error:', err));

    async function endCall() {
      if (isEnded) return;
      isEnded = true;
      const duration = Math.floor((Date.now() - startTime) / 1000);
      await prisma.call.update({ where: { id: call!.id }, data: { endedAt: new Date(), durationSeconds: duration } }).catch(() => {});
      console.log('[ws] call ended, duration:', duration, 's');
    }
  });
}
