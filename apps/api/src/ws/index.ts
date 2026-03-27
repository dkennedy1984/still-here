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

const GREETING = "Hi... I'm here. You don't have to talk. We can just sit quietly.";
const DG_URL = 'wss://agent.deepgram.com/v1/agent/converse';
const speakModel = process.env.DEEPGRAM_SPEAK_MODEL || 'aura-luna-en';

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', async (clientWs: WS, req: IncomingMessage) => {
    console.log('[ws] raw connection received');
    try {
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const ticket = url.searchParams.get('ticket');
      if (!ticket) { clientWs.close(4001, 'missing_ticket'); return; }

      const call = await prisma.call.findUnique({ where: { wsTicket: ticket }, include: { session: true } });
      if (!call) { clientWs.close(4002, 'invalid_ticket'); return; }

      console.log('[ws] connected', { ticket, callId: call.id });

      const style = call.presenceStyle || 'quiet';
      const systemPrompt = SYSTEM_PROMPTS[style] || SYSTEM_PROMPTS.quiet;
      const sessionId = call.session.id;

      const apiKey = process.env.DEEPGRAM_API_KEY;
      if (!apiKey) { clientWs.close(4003, 'missing_api_key'); return; }

      let isEnded = false;

      // Check-in timer — only fires when style is 'check-ins'
      let checkInTimer: ReturnType<typeof setTimeout> | null = null;
      const CHECK_IN_MS = parseInt(process.env.CHECK_IN_TIMEOUT_MS || '1500000', 10);

      function resetCheckInTimer() {
        if (checkInTimer) clearTimeout(checkInTimer);
        if (style !== 'check-ins') return;
        checkInTimer = setTimeout(() => {
          if (dgWs.readyState === WebSocket.OPEN && !isEnded) {
            dgWs.send(JSON.stringify({ type: 'InjectAgentMessage', message: 'Still here.' }));
            resetCheckInTimer();
          }
        }, CHECK_IN_MS);
      }

      function endCall() {
        if (isEnded) return;
        isEnded = true;
        if (checkInTimer) clearTimeout(checkInTimer);
        checkInTimer = null;
        try { dgWs.close(); } catch {}
        try { clientWs.close(1000, 'call_ended'); } catch {}
        prisma.call.update({ where: { id: call!.id }, data: { endedAt: new Date() } }).catch(() => {});
      }

      // Open raw WebSocket to Deepgram
      const dgWs = new WebSocket(DG_URL, {
        headers: { Authorization: `Token ${apiKey}` },
      });

      // Safety check: close if Deepgram never connects
      const safetyTimeout = setTimeout(() => {
        if (!isEnded && dgWs.readyState !== WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ type: 'error', message: 'Deepgram connection timed out' }));
          endCall();
        }
      }, 10000);

      dgWs.on('open', () => {
        clearTimeout(safetyTimeout);

        // Send Settings
        dgWs.send(JSON.stringify({
          type: 'Settings',
          audio: {
            input: { encoding: 'linear16', sample_rate: 16000 },
            output: { encoding: 'linear16', sample_rate: 24000, container: 'none' },
          },
          agent: {
            listen: { model: 'nova-2' },
            think: {
              provider: { type: 'open_ai' },
              model: 'gpt-4o-mini',
              instructions: systemPrompt,
            },
            speak: { model: speakModel },
          },
        }));
      });

      dgWs.on('message', (data: Buffer | string, isBinary: boolean) => {
        if (isBinary) {
          // Audio chunk — forward to client
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(data, { binary: true });
          }
          return;
        }

        let msg: any;
        try { msg = JSON.parse(data.toString()); } catch { return; }

        const type: string = msg.type || '';

        if (type === 'SettingsApplied') {
          // Send greeting once settings are confirmed
          dgWs.send(JSON.stringify({ type: 'InjectAgentMessage', message: GREETING }));
          resetCheckInTimer();
          return;
        }

        if (type === 'ConversationText') {
          // Reset check-in timer on any conversation activity
          resetCheckInTimer();

          const role: string = msg.role || '';
          const text: string = msg.content || msg.text || '';

          // Safety check on user speech
          if (role === 'user') {
            const lower = text.toLowerCase();
            if (SAFETY_KEYWORDS.some(kw => lower.includes(kw))) {
              dgWs.send(JSON.stringify({
                type: 'InjectAgentMessage',
                message: "I hear you. You don't have to be okay right now. If you're in crisis, please reach out to a helpline — you deserve real support.",
              }));
            }
          }

          // Forward to client for display
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: 'transcript', role, text }));
          }

          return;
        }

        if (type === 'AgentAudioDone') {
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: 'agent_audio_done' }));
          }
          return;
        }

        if (type === 'UserStartedSpeaking') {
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: 'user_started_speaking' }));
          }
          return;
        }

        if (type === 'AgentStartedSpeaking') {
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: 'agent_started_speaking' }));
          }
          return;
        }

        // Forward any other JSON messages
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify(msg));
        }
      });

      dgWs.on('close', (code: number, reason: Buffer) => {
        if (!isEnded) endCall();
      });

      dgWs.on('error', (err: Error) => {
        console.error('[dgWs error]', err.message);
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ type: 'error', message: err.message }));
        }
        endCall();
      });

      // Handle messages from client
      clientWs.on('message', (data: Buffer | string, isBinary: boolean) => {
        if (isEnded) return;
        if (isBinary) {
          // Raw audio from client microphone — forward to Deepgram
          if (dgWs.readyState === WebSocket.OPEN) {
            dgWs.send(data, { binary: true });
          }
          return;
        }
        // JSON control messages from client
        let msg: any;
        try { msg = JSON.parse(data.toString()); } catch { return; }
        if (msg.type === 'hangup') {
          endCall();
        }
      });

      clientWs.on('close', () => {
        endCall();
      });

      clientWs.on('error', (err: Error) => {
        console.error('[clientWs error]', err.message);
        endCall();
      });
    } catch (err) {
      console.error('[ws] unhandled error in connection handler:', err);
      if (clientWs.readyState === WS.OPEN) clientWs.close(4000, 'internal_error');
    }
  });
}
